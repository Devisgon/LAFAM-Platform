// apps/api/src/modules/payments/application/payment-checkout.service.ts
/**
 * LAFAM Payment checkout service.
 *
 * Role:
 * - Orchestrates checkout creation for hosted KNET/card payments.
 * - Orchestrates immediate wallet payment settlement.
 * - Delegates trusted amount calculation to PaymentPricingService.
 * - Delegates hosted provider work to PaymentGatewayService.
 * - Delegates wallet mutation to atomic wallet RPC through WalletRepository.
 * - Supports single booking, private booking, booking-order, and wallet top-up checkout flows.
 * - Writes payment transaction audit rows around checkout operations.
 *
 * Important:
 * - Frontend amount is never trusted.
 * - This service does not calculate class/private/order booking prices itself.
 * - This service does not verify callbacks/webhooks.
 * - This service does not mutate wallet balances directly.
 * - This service does not directly confirm bookings.
 * - Payment/wallet/database RPCs own final atomic state mutation.
 * - Booking-order wallet checkout must debit once for the whole order.
 */

import { forwardRef, Inject, Injectable } from '@nestjs/common';

import { currentPaymentConfig } from '../../../common/config';
import { AppError } from '../../../common/errors/app-error';
import { SUPABASE_ADMIN_CLIENT } from '../../../database/database.constants';
import type {
  DatabaseJsonObject,
  LAFAMSupabaseClient,
} from '../../../database/database.types';
import { AuthUserRepository } from '../../auth/repositories/auth-user.repository';
import type { AuthUserInternalProfile } from '../../auth/types/auth-user.types';
import { EmailNotificationService } from '../../notifications/application/email-notification.service';
import {
  EMAIL_NOTIFICATION_ENTITY_TYPE_WALLET_LEDGER_ENTRY,
  EMAIL_NOTIFICATION_EVENT_WALLET_BOOKING_DEBIT_SUCCESS,
  EMAIL_RECIPIENT_ROLE_CUSTOMER,
} from '../../notifications/constants/notification.constants';
import { createWalletLedgerEmailIdempotencyKey } from '../../notifications/domain/email-idempotency.policy';
import type { EmailRecipient } from '../../notifications/types/notification.types';
import { PromoCodeCustomerService } from '../../promo-codes/application/promo-code-customer.service';
import {
  PROMO_CODE_ALLOWED_PAYMENT_METHODS,
  PROMO_CODE_ALLOWED_TARGET_TYPES,
} from '../../promo-codes/constants/promo-code.constants';
import type {
  PromoCodeAllowedPaymentMethod,
  PromoCodeAllowedTargetType,
} from '../../promo-codes/constants/promo-code.constants';
import type {
  PromoCodeReservationResult,
  PromoCodeResolvedCheckoutTarget,
} from '../../promo-codes/types/promo-code.types';
import {
  PAYMENT_CHECKOUT_INTENT_TTL_MINUTES,
  PAYMENT_METHOD_WALLET,
  PAYMENT_PROVIDER_WALLET,
  PAYMENT_STATUS_PAID,
  PAYMENT_STATUS_PENDING,
  PAYMENT_STATUS_REQUIRES_REDIRECT,
  PAYMENT_TARGET_TYPE_BOOKING,
  PAYMENT_TARGET_TYPE_BOOKING_ORDER,
  PAYMENT_TARGET_TYPE_PRIVATE_BOOKING,
  PAYMENT_TARGET_TYPE_WALLET_TOP_UP,
  PAYMENT_TRANSACTION_STATUS_FAILED,
  PAYMENT_TRANSACTION_STATUS_SUCCEEDED,
  PAYMENT_TRANSACTION_TYPE_INTENT_CREATED,
  PAYMENT_TRANSACTION_TYPE_PROVIDER_REQUEST,
  PAYMENT_TRANSACTION_TYPE_PROVIDER_RESPONSE,
  PAYMENT_TRANSACTION_TYPE_WALLET_DEBIT,
  PAYMENT_WALLET_TOP_UP_INTENT_TTL_MINUTES,
  WALLET_LEDGER_ENTRY_TYPE_BOOKING_ORDER_PAYMENT,
  WALLET_LEDGER_ENTRY_TYPE_BOOKING_PAYMENT,
  WALLET_LEDGER_ENTRY_TYPE_PRIVATE_BOOKING_PAYMENT,
  isPaymentExternalGatewayProvider,
  isPaymentHostedRedirectMethod,
  type PaymentCurrency,
  type PaymentExternalGatewayProvider,
  type PaymentHostedRedirectMethod,
  type PaymentProvider,
  type WalletDebitEntryType,
} from '../constants/payment.constants';
import { PaymentLifecyclePolicy } from '../domain/payment-lifecycle.policy';
import { PaymentSecurityPolicy } from '../domain/payment-security.policy';
import { WalletLedgerPolicy } from '../domain/wallet-ledger.policy';
import { PaymentRepository } from '../repositories/payment.repository';
import { WalletRepository } from '../repositories/wallet.repository';
import type {
  CreateCheckoutPaymentCommand,
  CreateCheckoutPaymentInput,
  DebitWalletForBookingAtomicResult,
  DebitWalletForBookingOrderAtomicResult,
  PaymentCheckoutHostedRedirectResult,
  PaymentCheckoutResult,
  PaymentCheckoutWalletResult,
  PaymentGatewayCreateHostedPaymentResult,
  PaymentPriceResolutionResult,
  PaymentPromoCodeCheckoutContext,
  PaymentPromoCodeReservationSnapshot,
  PaymentRecord,
  PaymentTransactionCreateRecord,
} from '../types/payment.types';
import { PaymentGatewayService } from './payment-gateway.service';
import { PaymentPricingService } from './payment-pricing.service';

export interface PaymentCheckoutServiceInput extends CreateCheckoutPaymentInput {
  readonly currency?: PaymentCurrency;
  readonly is_guest?: boolean;
}

interface CheckoutUserContext {
  readonly user_id: string;
  readonly is_guest: boolean;
}

interface CheckoutIntentContext {
  readonly pricing: PaymentPriceResolutionResult;
  readonly promo_code_checkout: PaymentPromoCodeCheckoutContext;
  readonly command: CreateCheckoutPaymentCommand;
  readonly payment: PaymentRecord;
}

interface CheckoutPaymentIntentAtomicResult {
  readonly payment_id: string;
  readonly payment_number: string;
  readonly status: PaymentRecord['status'];
  readonly target_type: PaymentRecord['target_type'];
  readonly booking_id: string | null;
  readonly private_booking_id: string | null;
  readonly booking_order_id: string | null;
  readonly final_amount: number;
  readonly currency: string;
}

interface PaymentTransactionAuditInput {
  readonly payment_id: string;
  readonly transaction_type: PaymentTransactionCreateRecord['transaction_type'];
  readonly transaction_status: PaymentTransactionCreateRecord['transaction_status'];
  readonly provider: PaymentProvider;
  readonly provider_reference?: string | null;
  readonly gateway_request?: DatabaseJsonObject;
  readonly gateway_response?: DatabaseJsonObject;
  readonly failure_code?: string | null;
  readonly failure_message?: string | null;
  readonly metadata?: DatabaseJsonObject;
}

const CHECKOUT_FAILURE_CODE_PROVIDER_CREATE_FAILED =
  'PAYMENT_PROVIDER_CREATE_FAILED';

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  if (!hasText(value)) {
    return null;
  }

  return value.trim();
}

function resolveIntentTtlMinutes(
  targetType: PaymentCheckoutServiceInput['target_type'],
): number {
  return targetType === PAYMENT_TARGET_TYPE_WALLET_TOP_UP
    ? PAYMENT_WALLET_TOP_UP_INTENT_TTL_MINUTES
    : PAYMENT_CHECKOUT_INTENT_TTL_MINUTES;
}

function resolveIntentExpiresAt(
  targetType: PaymentCheckoutServiceInput['target_type'],
): string {
  const expiresAt = new Date();
  expiresAt.setMinutes(
    expiresAt.getMinutes() + resolveIntentTtlMinutes(targetType),
  );

  return expiresAt.toISOString();
}

function resolveGatewayProvider(): PaymentExternalGatewayProvider {
  const provider = currentPaymentConfig.provider;

  if (isPaymentExternalGatewayProvider(provider)) {
    return provider;
  }

  throw AppError.paymentProviderUnavailable({
    provider,
    reason:
      'Configured payment provider does not support hosted checkout creation.',
  });
}

function assertHostedCheckoutMethod(
  paymentMethod: PaymentCheckoutServiceInput['payment_method'],
): PaymentHostedRedirectMethod {
  if (isPaymentHostedRedirectMethod(paymentMethod)) {
    return paymentMethod;
  }

  throw AppError.paymentMethodUnsupported(
    'Selected payment method does not support hosted checkout.',
    {
      payment_method: paymentMethod,
    },
  );
}

function resolveDebitLedgerEntryTypeForCheckoutTarget(
  targetType: PaymentCheckoutServiceInput['target_type'],
): WalletDebitEntryType {
  if (targetType === PAYMENT_TARGET_TYPE_BOOKING) {
    return WALLET_LEDGER_ENTRY_TYPE_BOOKING_PAYMENT;
  }

  if (targetType === PAYMENT_TARGET_TYPE_PRIVATE_BOOKING) {
    return WALLET_LEDGER_ENTRY_TYPE_PRIVATE_BOOKING_PAYMENT;
  }

  if (targetType === PAYMENT_TARGET_TYPE_BOOKING_ORDER) {
    return WALLET_LEDGER_ENTRY_TYPE_BOOKING_ORDER_PAYMENT;
  }

  throw AppError.invalidRequest(
    'Wallet checkout can only debit wallet for booking, private booking, or booking order targets.',
    {
      target_type: targetType,
    },
  );
}

function safeFailureMessage(error: unknown): string {
  if (error instanceof Error && hasText(error.message)) {
    return error.message.slice(0, 1000);
  }

  return 'Payment provider request failed.';
}
function isPromoCodeRequested(input: PaymentCheckoutServiceInput): boolean {
  return hasText(input.promo_code);
}

function isPromoCodeAllowedPaymentMethod(
  paymentMethod: string,
): paymentMethod is PromoCodeAllowedPaymentMethod {
  return PROMO_CODE_ALLOWED_PAYMENT_METHODS.some(
    (allowedPaymentMethod) => allowedPaymentMethod === paymentMethod,
  );
}

function resolvePromoCodePaymentMethod(
  paymentMethod: PaymentCheckoutServiceInput['payment_method'],
): PromoCodeAllowedPaymentMethod {
  if (isPromoCodeAllowedPaymentMethod(paymentMethod)) {
    return paymentMethod;
  }

  throw AppError.promoCodePaymentMethodNotAllowed(
    'Promo codes are not supported for this payment method.',
    {
      payment_method: paymentMethod,
    },
  );
}

function isPromoCodeAllowedTargetType(
  targetType: string,
): targetType is PromoCodeAllowedTargetType {
  return PROMO_CODE_ALLOWED_TARGET_TYPES.some(
    (allowedTargetType) => allowedTargetType === targetType,
  );
}

function resolvePromoCodeTargetType(
  targetType: PaymentPriceResolutionResult['target']['target_type'],
): PromoCodeAllowedTargetType {
  if (isPromoCodeAllowedTargetType(targetType)) {
    return targetType;
  }

  throw AppError.promoCodeTargetNotAllowed(
    'Promo codes are not supported for this checkout target.',
    {
      target_type: targetType,
    },
  );
}

function emptyPromoCodeCheckoutContext(
  promoCode?: string | null,
): PaymentPromoCodeCheckoutContext {
  return {
    promo_code: normalizeOptionalText(promoCode),
    reservation: null,
  };
}

function toPromoCodeResolvedCheckoutTarget(input: {
  readonly user_id: string;
  readonly pricing: PaymentPriceResolutionResult;
  readonly payment_method: PromoCodeAllowedPaymentMethod;
}): PromoCodeResolvedCheckoutTarget {
  return {
    user_id: input.user_id,
    target_type: resolvePromoCodeTargetType(input.pricing.target.target_type),
    booking_id: input.pricing.target.booking_id,
    private_booking_id: input.pricing.target.private_booking_id,
    booking_order_id: input.pricing.target.booking_order_id,
    subtotal_amount: input.pricing.amount,
    currency: input.pricing.currency,
    payment_method: input.payment_method,
    class_id: null,
    schedule_id: null,
    trainer_staff_profile_id: null,
    metadata: {
      source: 'payment_checkout_service',
    },
  };
}

function toPromoCodeReservationSnapshot(input: {
  readonly reservation: PromoCodeReservationResult;
  readonly pricing: PaymentPriceResolutionResult;
}): PaymentPromoCodeReservationSnapshot {
  return {
    promo_code_id: input.reservation.promo_code.id,
    promo_code: input.reservation.promo_code.code,
    promo_code_redemption_id: input.reservation.redemption.redemption_id,
    subtotal_amount: input.reservation.pricing.subtotal_amount,
    discount_amount: input.reservation.pricing.discount_amount,
    final_amount: input.reservation.pricing.final_amount,
    currency: input.pricing.currency,
    expires_at: input.reservation.redemption.expires_at ?? null,
    metadata: {
      source: 'payment_checkout_service',
      target_type: input.pricing.target.target_type,
      booking_id: input.pricing.target.booking_id,
      private_booking_id: input.pricing.target.private_booking_id,
      booking_order_id: input.pricing.target.booking_order_id,
    },
  };
}

function toPromoCodeReservationMetadata(
  reservation: PaymentPromoCodeReservationSnapshot | null,
): DatabaseJsonObject | null {
  if (!reservation) {
    return null;
  }

  return {
    promo_code_id: reservation.promo_code_id,
    promo_code: reservation.promo_code,
    promo_code_redemption_id: reservation.promo_code_redemption_id,
    subtotal_amount: reservation.subtotal_amount,
    discount_amount: reservation.discount_amount,
    final_amount: reservation.final_amount,
    currency: reservation.currency,
    expires_at: reservation.expires_at,
    metadata: reservation.metadata,
  };
}

function applyPromoCodeCheckoutToPricing(input: {
  readonly pricing: PaymentPriceResolutionResult;
  readonly promo_code_checkout: PaymentPromoCodeCheckoutContext;
}): PaymentPriceResolutionResult {
  const reservation = input.promo_code_checkout.reservation;

  if (!reservation) {
    return input.pricing;
  }

  return {
    ...input.pricing,
    discount_amount: reservation.discount_amount,
    final_amount: reservation.final_amount,
    promo_code_id: reservation.promo_code_id,
    promo_code: reservation.promo_code,
    promo_code_redemption_id: reservation.promo_code_redemption_id,
    discount_metadata: reservation.metadata,
  };
}

function resolvePromoCodeReservationIdempotencyKey(
  input: PaymentCheckoutServiceInput,
): string {
  const explicitIdempotencyKey = normalizeOptionalText(input.idempotency_key);

  if (explicitIdempotencyKey !== null) {
    return explicitIdempotencyKey;
  }

  const promoCode = normalizeOptionalText(input.promo_code) ?? 'promo';
  const targetId =
    normalizeOptionalText(input.booking_id) ??
    normalizeOptionalText(input.private_booking_id) ??
    normalizeOptionalText(input.booking_order_id) ??
    'target';

  return `checkout:${input.target_type}:${targetId}:${promoCode}`;
}

function buildCheckoutMetadata(input: {
  readonly originalInput: PaymentCheckoutServiceInput;
  readonly pricing: PaymentPriceResolutionResult;
  readonly promoCodeCheckout: PaymentPromoCodeCheckoutContext;
  readonly sanitizedClientMetadata: DatabaseJsonObject;
  readonly removedMetadataKeys: readonly string[];
}): DatabaseJsonObject {
  return {
    client_metadata: input.sanitizedClientMetadata,
    removed_metadata_keys: [...input.removedMetadataKeys],
    checkout: {
      target_type: input.originalInput.target_type,
      booking_id: input.originalInput.booking_id ?? null,
      private_booking_id: input.originalInput.private_booking_id ?? null,
      booking_order_id: input.originalInput.booking_order_id ?? null,
      payment_method: input.originalInput.payment_method,
      idempotency_key: input.originalInput.idempotency_key ?? null,
      promo_code: input.originalInput.promo_code ?? null,
      promo_code_redemption_id:
        input.promoCodeCheckout.reservation?.promo_code_redemption_id ?? null,
    },
    pricing: {
      target_type: input.pricing.target.target_type,
      booking_id: input.pricing.target.booking_id,
      private_booking_id: input.pricing.target.private_booking_id,
      booking_order_id: input.pricing.target.booking_order_id,
      amount: input.pricing.amount,
      discount_amount: input.pricing.discount_amount,
      final_amount: input.pricing.final_amount,
      currency: input.pricing.currency,
      promo_code_id: input.pricing.promo_code_id,
      promo_code: input.pricing.promo_code,
      promo_code_redemption_id: input.pricing.promo_code_redemption_id,
      discount_metadata: input.pricing.discount_metadata,
    },
    promo_code_reservation: toPromoCodeReservationMetadata(
      input.promoCodeCheckout.reservation,
    ),
  };
}

function buildHostedPaymentRequestPayload(
  command: CreateCheckoutPaymentCommand,
): DatabaseJsonObject {
  return {
    user_id: command.user_id,
    target_type: command.target.target_type,
    booking_id: command.target.booking_id,
    private_booking_id: command.target.private_booking_id,
    booking_order_id: command.target.booking_order_id,
    amount: command.final_amount,
    currency: command.currency,
    payment_method: command.payment_method,
    payment_provider: command.payment_provider,
    callback_url: command.callback_url,
    idempotency_key: command.idempotency_key,
    promo_code_redemption_id: command.promo_code_redemption_id,
  };
}

function buildProviderResponsePayload(
  result: PaymentGatewayCreateHostedPaymentResult,
): DatabaseJsonObject {
  return {
    provider: result.provider,
    provider_reference: result.provider_reference,
    gateway_payment_id: result.gateway_payment_id,
    gateway_invoice_id: result.gateway_invoice_id,
    redirect_url: result.redirect_url,
    expires_at: result.expires_at,
    raw_response: result.raw_response,
  };
}

function buildWalletDebitMetadata(input: {
  readonly checkout_stage: string;
  readonly payment: PaymentRecord;
}): DatabaseJsonObject {
  return {
    checkout_stage: input.checkout_stage,
    payment_id: input.payment.id,
    payment_number: input.payment.payment_number,
    target_type: input.payment.target_type,
    booking_id: input.payment.booking_id,
    private_booking_id: input.payment.private_booking_id,
    booking_order_id: input.payment.booking_order_id,
  };
}

function resolveWalletDebitDescription(payment: PaymentRecord): string {
  if (payment.target_type === PAYMENT_TARGET_TYPE_BOOKING_ORDER) {
    return 'Wallet payment for booking order checkout.';
  }

  if (payment.target_type === PAYMENT_TARGET_TYPE_PRIVATE_BOOKING) {
    return 'Wallet payment for private booking checkout.';
  }

  return 'Wallet payment for booking checkout.';
}

type WalletBookingDebitResult =
  | DebitWalletForBookingAtomicResult
  | DebitWalletForBookingOrderAtomicResult;

function formatMoneyAmount(
  amount: number | null | undefined,
  currency: string | null | undefined,
): string | null {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return null;
  }

  const normalizedCurrency = normalizeOptionalText(currency);

  if (!normalizedCurrency) {
    return amount.toFixed(3);
  }

  return `${amount.toFixed(3)} ${normalizedCurrency}`;
}

function addOptionalTemplateString(
  target: DatabaseJsonObject,
  key: string,
  value: string | null | undefined,
): void {
  const normalizedValue = normalizeOptionalText(value);

  if (normalizedValue) {
    target[key] = normalizedValue;
  }
}

function addOptionalTemplateNumber(
  target: DatabaseJsonObject,
  key: string,
  value: number | null | undefined,
): void {
  if (typeof value === 'number' && Number.isFinite(value)) {
    target[key] = value;
  }
}

function resolveWalletDebitBookingId(
  walletDebit: WalletBookingDebitResult,
): string | null {
  return 'booking_id' in walletDebit ? walletDebit.booking_id : null;
}

function resolveWalletDebitPrivateBookingId(
  walletDebit: WalletBookingDebitResult,
): string | null {
  return 'private_booking_id' in walletDebit
    ? walletDebit.private_booking_id
    : null;
}

function resolveWalletDebitBookingOrderId(
  walletDebit: WalletBookingDebitResult,
): string | null {
  return 'booking_order_id' in walletDebit
    ? walletDebit.booking_order_id
    : null;
}

function createWalletCustomerEmailRecipient(
  user: AuthUserInternalProfile | null,
): EmailRecipient | null {
  if (!user) {
    return null;
  }

  const email = normalizeOptionalText(user.email);

  if (!email) {
    return null;
  }

  return {
    role: EMAIL_RECIPIENT_ROLE_CUSTOMER,
    email,
    name: user.fullName,
    appUserId: user.id,
  };
}

function buildWalletBookingDebitEmailTemplateData(input: {
  readonly payment: PaymentRecord;
  readonly walletDebit: WalletBookingDebitResult;
  readonly recipient: EmailRecipient;
}): DatabaseJsonObject {
  const templateData: DatabaseJsonObject = {};

  addOptionalTemplateString(
    templateData,
    'recipientName',
    input.recipient.name,
  );
  addOptionalTemplateString(
    templateData,
    'paymentNumber',
    input.payment.payment_number,
  );
  addOptionalTemplateString(
    templateData,
    'receiptNumber',
    input.payment.receipt_number,
  );
  addOptionalTemplateString(
    templateData,
    'amountLabel',
    formatMoneyAmount(input.payment.final_amount, input.payment.currency),
  );
  addOptionalTemplateNumber(templateData, 'amount', input.payment.final_amount);
  addOptionalTemplateString(templateData, 'currency', input.payment.currency);
  addOptionalTemplateNumber(
    templateData,
    'walletBalance',
    input.walletDebit.available_balance,
  );
  addOptionalTemplateString(
    templateData,
    'walletBalanceLabel',
    formatMoneyAmount(
      input.walletDebit.available_balance,
      input.payment.currency,
    ),
  );

  return templateData;
}

function buildWalletBookingDebitEmailMetadata(input: {
  readonly payment: PaymentRecord;
  readonly walletDebit: WalletBookingDebitResult;
}): DatabaseJsonObject {
  return {
    payment_id: input.payment.id,
    payment_number: input.payment.payment_number,
    receipt_number: input.payment.receipt_number,
    user_id: input.payment.user_id,
    target_type: input.payment.target_type,
    wallet_account_id: input.walletDebit.wallet_account_id,
    wallet_ledger_entry_id: input.walletDebit.ledger_entry_id,
    booking_id: resolveWalletDebitBookingId(input.walletDebit),
    private_booking_id: resolveWalletDebitPrivateBookingId(input.walletDebit),
    booking_order_id: resolveWalletDebitBookingOrderId(input.walletDebit),
    amount: input.payment.amount,
    discount_amount: input.payment.discount_amount,
    final_amount: input.payment.final_amount,
    currency: input.payment.currency,
    available_balance: input.walletDebit.available_balance,
  };
}

@Injectable()
export class PaymentCheckoutService {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly adminClient: LAFAMSupabaseClient,
    private readonly paymentPricingService: PaymentPricingService,
    private readonly paymentGatewayService: PaymentGatewayService,
    private readonly paymentRepository: PaymentRepository,
    private readonly walletRepository: WalletRepository,
    private readonly authUserRepository: AuthUserRepository,
    private readonly emailNotificationService: EmailNotificationService,
    @Inject(forwardRef(() => PromoCodeCustomerService))
    private readonly promoCodeCustomerService: PromoCodeCustomerService,
  ) {}

  async createCheckoutPayment(
    input: PaymentCheckoutServiceInput,
  ): Promise<PaymentCheckoutResult> {
    const userContext = await this.resolveCheckoutUserContext(input);
    const basePricing = await this.paymentPricingService.resolveCheckoutPricing(
      {
        user_id: input.user_id,
        target_type: input.target_type,
        booking_id: input.booking_id,
        private_booking_id: input.private_booking_id,
        booking_order_id: input.booking_order_id,
        wallet_top_up_amount: input.wallet_top_up_amount,
        currency: input.currency,
        promo_code: input.promo_code,
      },
    );

    this.assertCheckoutAllowed({
      input,
      pricing: basePricing,
      userContext,
    });

    const promoCodeCheckout = await this.resolvePromoCodeCheckoutContext({
      input,
      pricing: basePricing,
    });

    const pricing = applyPromoCodeCheckoutToPricing({
      pricing: basePricing,
      promo_code_checkout: promoCodeCheckout,
    });

    this.assertCheckoutAllowed({
      input,
      pricing,
      userContext,
    });

    if (input.payment_method === PAYMENT_METHOD_WALLET) {
      return this.createWalletCheckoutPayment({
        input,
        pricing,
        promoCodeCheckout,
      });
    }

    return this.createHostedCheckoutPayment({
      input,
      pricing,
      promoCodeCheckout,
    });
  }

  private assertCheckoutAllowed(input: {
    readonly input: PaymentCheckoutServiceInput;
    readonly pricing: PaymentPriceResolutionResult;
    readonly userContext: CheckoutUserContext;
  }): void {
    PaymentSecurityPolicy.assertIdempotencyKey(input.input.idempotency_key);

    PaymentSecurityPolicy.assertResolvedTargetShape(input.pricing.target);

    PaymentSecurityPolicy.assertAmountIntegrity({
      amount: input.pricing.amount,
      discount_amount: input.pricing.discount_amount,
      final_amount: input.pricing.final_amount,
    });

    PaymentSecurityPolicy.assertPaymentMethodAllowedForTarget({
      target_type: input.pricing.target.target_type,
      payment_method: input.input.payment_method,
      currency: input.pricing.currency,
      is_guest: input.userContext.is_guest,
    });
  }

  private async createHostedCheckoutPayment(input: {
    readonly input: PaymentCheckoutServiceInput;
    readonly pricing: PaymentPriceResolutionResult;
    readonly promoCodeCheckout: PaymentPromoCodeCheckoutContext;
  }): Promise<PaymentCheckoutHostedRedirectResult> {
    const hostedPaymentMethod = assertHostedCheckoutMethod(
      input.input.payment_method,
    );
    const gatewayProvider = resolveGatewayProvider();

    const intentContext = await this.createCheckoutIntent({
      originalInput: input.input,
      pricing: input.pricing,
      promoCodeCheckout: input.promoCodeCheckout,
      payment_provider: gatewayProvider,
      callback_url: currentPaymentConfig.redirect.knetCallbackUrl,
    });

    const payment = intentContext.payment;

    if (
      payment.status === PAYMENT_STATUS_REQUIRES_REDIRECT &&
      hasText(payment.redirect_url)
    ) {
      return {
        payment,
        status: payment.status,
        requires_redirect: true,
        redirect_url: payment.redirect_url,
        expires_at: payment.expires_at,
      };
    }

    if (payment.status === PAYMENT_STATUS_PAID) {
      throw AppError.paymentAlreadyPaid(
        'This payment has already been completed.',
        {
          payment_id: payment.id,
          payment_number: payment.payment_number,
          status: payment.status,
        },
      );
    }

    PaymentLifecyclePolicy.assertPaymentNotExpired({
      payment,
    });
    PaymentLifecyclePolicy.assertCanCreateHostedRedirect(payment);

    await this.createPaymentTransaction({
      payment_id: payment.id,
      transaction_type: PAYMENT_TRANSACTION_TYPE_PROVIDER_REQUEST,
      transaction_status: PAYMENT_TRANSACTION_STATUS_SUCCEEDED,
      provider: gatewayProvider,
      gateway_request: buildHostedPaymentRequestPayload(intentContext.command),
      metadata: {
        checkout_stage: 'hosted_provider_request',
        promo_code_redemption_id:
          intentContext.command.promo_code_redemption_id,
      },
    });

    const providerResult = await this.createHostedPaymentWithAudit({
      payment,
      command: intentContext.command,
      hostedPaymentMethod,
      gatewayProvider,
      promoCodeCheckout: input.promoCodeCheckout,
    });

    const updatedPayment = await this.paymentRepository.updatePayment(
      payment.id,
      {
        status: PAYMENT_STATUS_REQUIRES_REDIRECT,
        gateway_reference: providerResult.provider_reference,
        gateway_payment_id: providerResult.gateway_payment_id,
        gateway_invoice_id: providerResult.gateway_invoice_id,
        redirect_url: providerResult.redirect_url,
        callback_url: intentContext.command.callback_url,
        expires_at:
          providerResult.expires_at ?? intentContext.command.expires_at,
      },
    );

    return {
      payment: updatedPayment,
      status: updatedPayment.status,
      requires_redirect: true,
      redirect_url: providerResult.redirect_url,
      expires_at: updatedPayment.expires_at,
    };
  }

  private async createHostedPaymentWithAudit(input: {
    readonly payment: PaymentRecord;
    readonly command: CreateCheckoutPaymentCommand;
    readonly hostedPaymentMethod: PaymentHostedRedirectMethod;
    readonly gatewayProvider: PaymentExternalGatewayProvider;
    readonly promoCodeCheckout: PaymentPromoCodeCheckoutContext;
  }): Promise<PaymentGatewayCreateHostedPaymentResult> {
    try {
      const providerResult =
        await this.paymentGatewayService.createHostedPayment({
          payment_id: input.payment.id,
          payment_number: input.payment.payment_number,
          user_id: input.payment.user_id,
          amount: input.payment.final_amount,
          currency: input.command.currency,
          payment_method: input.hostedPaymentMethod,
          provider: input.gatewayProvider,
          target_type: input.payment.target_type,
          booking_id: input.payment.booking_id,
          private_booking_id: input.payment.private_booking_id,
          booking_order_id: input.payment.booking_order_id,
          callback_url: currentPaymentConfig.redirect.knetCallbackUrl,
          webhook_url: currentPaymentConfig.redirect.knetWebhookUrl,
          frontend_success_url:
            currentPaymentConfig.redirect.frontendSuccessUrl,
          frontend_failure_url:
            currentPaymentConfig.redirect.frontendFailureUrl,
          idempotency_key: input.payment.idempotency_key,
          metadata: input.payment.metadata,
        });

      await this.createPaymentTransaction({
        payment_id: input.payment.id,
        transaction_type: PAYMENT_TRANSACTION_TYPE_PROVIDER_RESPONSE,
        transaction_status: PAYMENT_TRANSACTION_STATUS_SUCCEEDED,
        provider: providerResult.provider,
        provider_reference: providerResult.provider_reference,
        gateway_request: buildHostedPaymentRequestPayload(input.command),
        gateway_response: buildProviderResponsePayload(providerResult),
        metadata: {
          checkout_stage: 'hosted_provider_response',
          promo_code_redemption_id: input.command.promo_code_redemption_id,
        },
      });

      return providerResult;
    } catch (error) {
      await this.createPaymentTransaction({
        payment_id: input.payment.id,
        transaction_type: PAYMENT_TRANSACTION_TYPE_PROVIDER_RESPONSE,
        transaction_status: PAYMENT_TRANSACTION_STATUS_FAILED,
        provider: input.gatewayProvider,
        gateway_request: buildHostedPaymentRequestPayload(input.command),
        gateway_response: {
          provider: input.gatewayProvider,
          operation: 'create_hosted_payment',
          failed: true,
        },
        failure_code: CHECKOUT_FAILURE_CODE_PROVIDER_CREATE_FAILED,
        failure_message: safeFailureMessage(error),
        metadata: {
          checkout_stage: 'hosted_provider_response',
          promo_code_redemption_id: input.command.promo_code_redemption_id,
        },
      });

      await this.releasePromoCodeCheckoutReservation({
        promoCodeCheckout: input.promoCodeCheckout,
        paymentId: input.payment.id,
        releaseReason: 'hosted_provider_create_failed',
        metadata: {
          checkout_stage: 'hosted_provider_response',
          failure_code: CHECKOUT_FAILURE_CODE_PROVIDER_CREATE_FAILED,
        },
      });

      throw error;
    }
  }

  private async createWalletCheckoutPayment(input: {
    readonly input: PaymentCheckoutServiceInput;
    readonly pricing: PaymentPriceResolutionResult;
    readonly promoCodeCheckout: PaymentPromoCodeCheckoutContext;
  }): Promise<PaymentCheckoutWalletResult> {
    const intentContext = await this.createCheckoutIntent({
      originalInput: input.input,
      pricing: input.pricing,
      promoCodeCheckout: input.promoCodeCheckout,
      payment_provider: PAYMENT_PROVIDER_WALLET,
      callback_url: null,
    });

    const payment = intentContext.payment;

    if (payment.status === PAYMENT_STATUS_PAID) {
      return this.resolveExistingWalletCheckoutResult(payment);
    }

    try {
      PaymentLifecyclePolicy.assertPaymentNotExpired({
        payment,
      });

      const entryType = resolveDebitLedgerEntryTypeForCheckoutTarget(
        payment.target_type,
      );
      const description = resolveWalletDebitDescription(payment);

      WalletLedgerPolicy.assertDebitInput({
        user_id: payment.user_id,
        payment_id: payment.id,
        currency: input.pricing.currency,
        amount: input.pricing.final_amount,
        entry_type: entryType,
        booking_id: payment.booking_id,
        private_booking_id: payment.private_booking_id,
        booking_order_id: payment.booking_order_id,
        description,
        metadata: buildWalletDebitMetadata({
          checkout_stage: 'wallet_debit_validation',
          payment,
        }),
      });

      if (payment.target_type === PAYMENT_TARGET_TYPE_BOOKING_ORDER) {
        const walletDebit =
          await this.walletRepository.debitWalletForBookingOrderAtomic({
            payment_id: payment.id,
            description,
            metadata: buildWalletDebitMetadata({
              checkout_stage: 'wallet_debit',
              payment,
            }),
          });

        await this.markPromoCodeRedemptionRedeemedForPayment({
          promoCodeCheckout: input.promoCodeCheckout,
          paymentId: payment.id,
          metadata: {
            checkout_stage: 'wallet_debit',
            wallet_ledger_entry_id: walletDebit.ledger_entry_id,
          },
        });

        await this.createPaymentTransaction({
          payment_id: payment.id,
          transaction_type: PAYMENT_TRANSACTION_TYPE_WALLET_DEBIT,
          transaction_status: PAYMENT_TRANSACTION_STATUS_SUCCEEDED,
          provider: PAYMENT_PROVIDER_WALLET,
          gateway_response: {
            wallet_account_id: walletDebit.wallet_account_id,
            wallet_ledger_entry_id: walletDebit.ledger_entry_id,
            available_balance: walletDebit.available_balance,
            booking_id: null,
            private_booking_id: null,
            booking_order_id: walletDebit.booking_order_id,
          },
          metadata: {
            checkout_stage: 'wallet_debit',
            promo_code_redemption_id:
              input.promoCodeCheckout.reservation?.promo_code_redemption_id ??
              null,
          },
        });

        const updatedPayment = await this.getPaymentOrThrow(payment.id);

        await this.notifyWalletBookingDebitSuccess({
          payment: updatedPayment,
          walletDebit,
        });

        return {
          payment: updatedPayment,
          status: updatedPayment.status,
          requires_redirect: false,
          wallet_account_id: walletDebit.wallet_account_id,
          wallet_ledger_entry_id: walletDebit.ledger_entry_id,
          available_balance: walletDebit.available_balance,
          booking_order_id: walletDebit.booking_order_id,
        };
      }

      const walletDebit =
        await this.walletRepository.debitWalletForBookingAtomic({
          payment_id: payment.id,
          description,
          metadata: buildWalletDebitMetadata({
            checkout_stage: 'wallet_debit',
            payment,
          }),
        });

      await this.markPromoCodeRedemptionRedeemedForPayment({
        promoCodeCheckout: input.promoCodeCheckout,
        paymentId: payment.id,
        metadata: {
          checkout_stage: 'wallet_debit',
          wallet_ledger_entry_id: walletDebit.ledger_entry_id,
        },
      });

      await this.createPaymentTransaction({
        payment_id: payment.id,
        transaction_type: PAYMENT_TRANSACTION_TYPE_WALLET_DEBIT,
        transaction_status: PAYMENT_TRANSACTION_STATUS_SUCCEEDED,
        provider: PAYMENT_PROVIDER_WALLET,
        gateway_response: {
          wallet_account_id: walletDebit.wallet_account_id,
          wallet_ledger_entry_id: walletDebit.ledger_entry_id,
          available_balance: walletDebit.available_balance,
          booking_id: walletDebit.booking_id,
          private_booking_id: walletDebit.private_booking_id,
          booking_order_id: null,
        },
        metadata: {
          checkout_stage: 'wallet_debit',
          promo_code_redemption_id:
            input.promoCodeCheckout.reservation?.promo_code_redemption_id ??
            null,
        },
      });

      const updatedPayment = await this.getPaymentOrThrow(payment.id);

      await this.notifyWalletBookingDebitSuccess({
        payment: updatedPayment,
        walletDebit,
      });

      return {
        payment: updatedPayment,
        status: updatedPayment.status,
        requires_redirect: false,
        wallet_account_id: walletDebit.wallet_account_id,
        wallet_ledger_entry_id: walletDebit.ledger_entry_id,
        available_balance: walletDebit.available_balance,
        booking_order_id: updatedPayment.booking_order_id,
      };
    } catch (error) {
      await this.releasePromoCodeCheckoutReservation({
        promoCodeCheckout: input.promoCodeCheckout,
        paymentId: payment.id,
        releaseReason: 'wallet_checkout_failed',
        metadata: {
          checkout_stage: 'wallet_debit',
          failure_message: safeFailureMessage(error),
        },
      });

      throw error;
    }
  }
  private async notifyWalletBookingDebitSuccess(input: {
    readonly payment: PaymentRecord;
    readonly walletDebit: WalletBookingDebitResult;
  }): Promise<void> {
    try {
      const user = await this.authUserRepository.findById({
        userId: input.payment.user_id,
      });
      const recipient = createWalletCustomerEmailRecipient(user);

      if (!recipient) {
        return;
      }

      await this.emailNotificationService.createFromTemplate({
        eventType: EMAIL_NOTIFICATION_EVENT_WALLET_BOOKING_DEBIT_SUCCESS,
        recipient,
        templateData: buildWalletBookingDebitEmailTemplateData({
          payment: input.payment,
          walletDebit: input.walletDebit,
          recipient,
        }),
        entity: {
          entityType: EMAIL_NOTIFICATION_ENTITY_TYPE_WALLET_LEDGER_ENTRY,
          entityId: input.walletDebit.ledger_entry_id,
        },
        idempotencyKey: createWalletLedgerEmailIdempotencyKey({
          eventType: EMAIL_NOTIFICATION_EVENT_WALLET_BOOKING_DEBIT_SUCCESS,
          walletLedgerEntryId: input.walletDebit.ledger_entry_id,
          recipient,
          scope: input.payment.id,
        }),
        metadata: buildWalletBookingDebitEmailMetadata(input),
      });
    } catch {
      // Best-effort notification side effect. The committed wallet debit remains authoritative.
    }
  }

  private async resolveExistingWalletCheckoutResult(
    payment: PaymentRecord,
  ): Promise<PaymentCheckoutWalletResult> {
    const ledgerEntries =
      await this.walletRepository.listWalletLedgerEntriesByPaymentId(
        payment.id,
      );

    const ledgerEntry = ledgerEntries[0];

    if (!ledgerEntry) {
      throw AppError.walletTransactionFailed(
        new Error(
          'Paid wallet payment exists without a matching wallet ledger entry.',
        ),
      );
    }

    const wallet = await this.walletRepository.findWalletAccountById(
      ledgerEntry.wallet_account_id,
    );

    if (!wallet) {
      throw AppError.walletNotFound('Wallet account was not found.', {
        wallet_account_id: ledgerEntry.wallet_account_id,
        payment_id: payment.id,
      });
    }

    return {
      payment,
      status: payment.status,
      requires_redirect: false,
      wallet_account_id: ledgerEntry.wallet_account_id,
      wallet_ledger_entry_id: ledgerEntry.id,
      available_balance: wallet.available_balance,
      booking_order_id: payment.booking_order_id,
    };
  }

  private async createCheckoutIntent(input: {
    readonly originalInput: PaymentCheckoutServiceInput;
    readonly pricing: PaymentPriceResolutionResult;
    readonly promoCodeCheckout: PaymentPromoCodeCheckoutContext;
    readonly payment_provider: PaymentProvider;
    readonly callback_url: string | null;
  }): Promise<CheckoutIntentContext> {
    const sanitizedMetadataResult = PaymentSecurityPolicy.sanitizeMetadata(
      input.originalInput.metadata,
    );

    const command: CreateCheckoutPaymentCommand = {
      user_id: input.originalInput.user_id,
      target: input.pricing.target,
      amount: input.pricing.amount,
      discount_amount: input.pricing.discount_amount,
      final_amount: input.pricing.final_amount,
      currency: input.pricing.currency,
      payment_method: input.originalInput.payment_method,
      payment_provider: input.payment_provider,
      idempotency_key: normalizeOptionalText(
        input.originalInput.idempotency_key,
      ),
      redirect_url: null,
      callback_url: input.callback_url,
      gateway_reference: null,
      gateway_payment_id: null,
      gateway_invoice_id: null,
      expires_at: resolveIntentExpiresAt(input.originalInput.target_type),
      promo_code_redemption_id:
        input.promoCodeCheckout.reservation?.promo_code_redemption_id ?? null,
      metadata: buildCheckoutMetadata({
        originalInput: input.originalInput,
        pricing: input.pricing,
        promoCodeCheckout: input.promoCodeCheckout,
        sanitizedClientMetadata: sanitizedMetadataResult.sanitized,
        removedMetadataKeys: sanitizedMetadataResult.removed_keys,
      }),
    };

    let paymentIntent: CheckoutPaymentIntentAtomicResult;

    try {
      paymentIntent = await this.paymentRepository.createPaymentIntentAtomic({
        user_id: command.user_id,
        target_type: command.target.target_type,
        booking_id: command.target.booking_id,
        private_booking_id: command.target.private_booking_id,
        booking_order_id: command.target.booking_order_id,
        amount: command.amount,
        discount_amount: command.discount_amount,
        final_amount: command.final_amount,
        currency: command.currency,
        payment_method: command.payment_method,
        payment_provider: command.payment_provider,
        status: PAYMENT_STATUS_PENDING,
        redirect_url: command.redirect_url,
        callback_url: command.callback_url,
        gateway_reference: command.gateway_reference,
        gateway_payment_id: command.gateway_payment_id,
        gateway_invoice_id: command.gateway_invoice_id,
        expires_at: command.expires_at,
        idempotency_key: command.idempotency_key,
        promo_code_redemption_id: command.promo_code_redemption_id,
        metadata: command.metadata,
      });
    } catch (error) {
      await this.releasePromoCodeCheckoutReservation({
        promoCodeCheckout: input.promoCodeCheckout,
        paymentId: null,
        releaseReason: 'payment_intent_create_failed',
        metadata: {
          checkout_stage: 'payment_intent_create',
          failure_message: safeFailureMessage(error),
        },
      });

      throw error;
    }

    const payment = await this.getPaymentOrThrow(paymentIntent.payment_id);

    try {
      await this.attachPromoCodeReservationToPayment({
        payment,
        promoCodeCheckout: input.promoCodeCheckout,
      });

      await this.createPaymentDiscountForPromoCode({
        payment,
        promoCodeCheckout: input.promoCodeCheckout,
      });
    } catch (error) {
      await this.releasePromoCodeCheckoutReservation({
        promoCodeCheckout: input.promoCodeCheckout,
        paymentId: payment.id,
        releaseReason: 'promo_code_payment_attach_failed',
        metadata: {
          checkout_stage: 'promo_code_payment_attach',
          failure_message: safeFailureMessage(error),
        },
      });

      throw error;
    }

    await this.createPaymentTransaction({
      payment_id: payment.id,
      transaction_type: PAYMENT_TRANSACTION_TYPE_INTENT_CREATED,
      transaction_status: PAYMENT_TRANSACTION_STATUS_SUCCEEDED,
      provider: command.payment_provider,
      gateway_response: {
        payment_id: paymentIntent.payment_id,
        payment_number: paymentIntent.payment_number,
        status: paymentIntent.status,
        target_type: paymentIntent.target_type,
        booking_id: paymentIntent.booking_id,
        private_booking_id: paymentIntent.private_booking_id,
        booking_order_id: paymentIntent.booking_order_id,
        final_amount: paymentIntent.final_amount,
        currency: paymentIntent.currency,
        promo_code_redemption_id: command.promo_code_redemption_id,
      },
      metadata: {
        checkout_stage: 'payment_intent_created',
        promo_code_redemption_id: command.promo_code_redemption_id,
      },
    });

    return {
      pricing: input.pricing,
      promo_code_checkout: input.promoCodeCheckout,
      command,
      payment,
    };
  }

  private async resolvePromoCodeCheckoutContext(input: {
    readonly input: PaymentCheckoutServiceInput;
    readonly pricing: PaymentPriceResolutionResult;
  }): Promise<PaymentPromoCodeCheckoutContext> {
    const promoCode = normalizeOptionalText(input.input.promo_code);

    if (!isPromoCodeRequested(input.input) || promoCode === null) {
      return emptyPromoCodeCheckoutContext(input.input.promo_code);
    }

    const paymentMethod = resolvePromoCodePaymentMethod(
      input.input.payment_method,
    );

    const reservation = await this.promoCodeCustomerService.reservePromoCode({
      code: promoCode,
      user_id: input.input.user_id,
      payment_method: paymentMethod,
      target: toPromoCodeResolvedCheckoutTarget({
        user_id: input.input.user_id,
        pricing: input.pricing,
        payment_method: paymentMethod,
      }),
      idempotency_key: resolvePromoCodeReservationIdempotencyKey(input.input),
      expires_at: resolveIntentExpiresAt(input.input.target_type),
      metadata: {
        checkout_stage: 'promo_code_reservation',
        target_type: input.pricing.target.target_type,
        booking_id: input.pricing.target.booking_id,
        private_booking_id: input.pricing.target.private_booking_id,
        booking_order_id: input.pricing.target.booking_order_id,
        payment_method: input.input.payment_method,
      },
    });

    return {
      promo_code: promoCode,
      reservation: toPromoCodeReservationSnapshot({
        reservation,
        pricing: input.pricing,
      }),
    };
  }

  private async attachPromoCodeReservationToPayment(input: {
    readonly payment: PaymentRecord;
    readonly promoCodeCheckout: PaymentPromoCodeCheckoutContext;
  }): Promise<void> {
    const reservation = input.promoCodeCheckout.reservation;

    if (!reservation) {
      return;
    }

    await this.promoCodeCustomerService.attachPromoCodeRedemptionPayment({
      redemption_id: reservation.promo_code_redemption_id,
      payment_id: input.payment.id,
      metadata: {
        checkout_stage: 'promo_code_payment_attach',
        payment_number: input.payment.payment_number,
      },
    });
  }

  private async createPaymentDiscountForPromoCode(input: {
    readonly payment: PaymentRecord;
    readonly promoCodeCheckout: PaymentPromoCodeCheckoutContext;
  }): Promise<void> {
    const reservation = input.promoCodeCheckout.reservation;

    if (!reservation) {
      return;
    }

    const existingDiscounts = await this.paymentRepository.findPaymentDiscounts(
      input.payment.id,
    );

    const existingDiscount = existingDiscounts.find(
      (discount) =>
        discount.promo_code_redemption_id ===
        reservation.promo_code_redemption_id,
    );

    if (existingDiscount) {
      return;
    }

    await this.paymentRepository.createPaymentDiscount({
      payment_id: input.payment.id,
      promo_code_id: reservation.promo_code_id,
      promo_code_redemption_id: reservation.promo_code_redemption_id,
      code: reservation.promo_code,
      discount_amount: reservation.discount_amount,
      metadata: reservation.metadata,
    });
  }

  private async markPromoCodeRedemptionRedeemedForPayment(input: {
    readonly promoCodeCheckout: PaymentPromoCodeCheckoutContext;
    readonly paymentId: string;
    readonly metadata: DatabaseJsonObject;
  }): Promise<void> {
    const reservation = input.promoCodeCheckout.reservation;

    if (!reservation) {
      return;
    }

    await this.promoCodeCustomerService.markPromoCodeRedemptionRedeemed({
      redemption_id: reservation.promo_code_redemption_id,
      payment_id: input.paymentId,
      metadata: input.metadata,
    });
  }

  private async releasePromoCodeCheckoutReservation(input: {
    readonly promoCodeCheckout: PaymentPromoCodeCheckoutContext;
    readonly paymentId: string | null;
    readonly releaseReason: string;
    readonly metadata: DatabaseJsonObject;
  }): Promise<void> {
    const reservation = input.promoCodeCheckout.reservation;

    if (!reservation) {
      return;
    }

    try {
      await this.promoCodeCustomerService.releasePromoCodeRedemption({
        redemption_id: reservation.promo_code_redemption_id,
        payment_id: input.paymentId,
        release_reason: input.releaseReason,
        metadata: input.metadata,
      });
    } catch {
      // Cleanup failure must not hide the original checkout failure.
    }
  }

  private async createPaymentTransaction(
    input: PaymentTransactionAuditInput,
  ): Promise<void> {
    await this.paymentRepository.createPaymentTransaction({
      payment_id: input.payment_id,
      transaction_type: input.transaction_type,
      transaction_status: input.transaction_status,
      provider: input.provider,
      provider_reference: input.provider_reference ?? null,
      gateway_request: input.gateway_request ?? {},
      gateway_response: input.gateway_response ?? {},
      failure_code: input.failure_code ?? null,
      failure_message: input.failure_message ?? null,
      metadata: input.metadata ?? {},
      processed_at: new Date().toISOString(),
    });
  }

  private async resolveCheckoutUserContext(
    input: PaymentCheckoutServiceInput,
  ): Promise<CheckoutUserContext> {
    if (typeof input.is_guest === 'boolean') {
      return {
        user_id: input.user_id,
        is_guest: input.is_guest,
      };
    }

    const { data, error } = await this.adminClient
      .from('app_users')
      .select('id, is_guest')
      .eq('id', input.user_id)
      .maybeSingle();

    if (error) {
      throw AppError.databaseOperationFailed(error);
    }

    if (!data) {
      throw AppError.paymentAccessDenied(
        'Authenticated checkout user was not found.',
        {
          user_id: input.user_id,
        },
      );
    }

    return {
      user_id: data.id,
      is_guest: data.is_guest,
    };
  }

  private async getPaymentOrThrow(paymentId: string): Promise<PaymentRecord> {
    const payment = await this.paymentRepository.findPaymentById(paymentId);

    if (!payment) {
      throw AppError.paymentDatabaseTransactionFailed(
        new Error('Payment intent was created but could not be reloaded.'),
      );
    }

    return payment;
  }
}
