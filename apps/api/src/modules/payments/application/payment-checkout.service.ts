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
 * - Writes payment transaction audit rows around checkout operations.
 *
 * Important:
 * - Frontend amount is never trusted.
 * - This service does not calculate class/private booking prices itself.
 * - This service does not verify callbacks/webhooks.
 * - This service does not mutate wallet balances directly.
 * - This service does not directly confirm bookings.
 * - Payment/wallet/database RPCs own final atomic state mutation.
 */

import { Inject, Injectable } from '@nestjs/common';

import { currentPaymentConfig } from '../../../common/config';
import { AppError } from '../../../common/errors/app-error';
import { SUPABASE_ADMIN_CLIENT } from '../../../database/database.constants';
import type {
  DatabaseJsonObject,
  LAFAMSupabaseClient,
} from '../../../database/database.types';
import {
  PAYMENT_CHECKOUT_INTENT_TTL_MINUTES,
  PAYMENT_METHOD_WALLET,
  PAYMENT_PROVIDER_WALLET,
  PAYMENT_STATUS_PAID,
  PAYMENT_STATUS_PENDING,
  PAYMENT_STATUS_REQUIRES_REDIRECT,
  PAYMENT_TARGET_TYPE_BOOKING,
  PAYMENT_TARGET_TYPE_PRIVATE_BOOKING,
  PAYMENT_TARGET_TYPE_WALLET_TOP_UP,
  PAYMENT_TRANSACTION_STATUS_FAILED,
  PAYMENT_TRANSACTION_STATUS_SUCCEEDED,
  PAYMENT_TRANSACTION_TYPE_INTENT_CREATED,
  PAYMENT_TRANSACTION_TYPE_PROVIDER_REQUEST,
  PAYMENT_TRANSACTION_TYPE_PROVIDER_RESPONSE,
  PAYMENT_TRANSACTION_TYPE_WALLET_DEBIT,
  PAYMENT_WALLET_TOP_UP_INTENT_TTL_MINUTES,
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
  PaymentCheckoutHostedRedirectResult,
  PaymentCheckoutResult,
  PaymentCheckoutWalletResult,
  PaymentGatewayCreateHostedPaymentResult,
  PaymentPriceResolutionResult,
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
  readonly command: CreateCheckoutPaymentCommand;
  readonly payment: PaymentRecord;
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

  throw AppError.invalidRequest(
    'Wallet checkout can only debit wallet for booking or private booking targets.',
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

function buildCheckoutMetadata(input: {
  readonly originalInput: PaymentCheckoutServiceInput;
  readonly pricing: PaymentPriceResolutionResult;
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
      payment_method: input.originalInput.payment_method,
      idempotency_key: input.originalInput.idempotency_key ?? null,
      promo_code: input.originalInput.promo_code ?? null,
    },
    pricing: {
      amount: input.pricing.amount,
      discount_amount: input.pricing.discount_amount,
      final_amount: input.pricing.final_amount,
      currency: input.pricing.currency,
      promo_code_id: input.pricing.promo_code_id,
      promo_code: input.pricing.promo_code,
      discount_metadata: input.pricing.discount_metadata,
    },
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
    amount: command.final_amount,
    currency: command.currency,
    payment_method: command.payment_method,
    payment_provider: command.payment_provider,
    callback_url: command.callback_url,
    idempotency_key: command.idempotency_key,
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

@Injectable()
export class PaymentCheckoutService {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly adminClient: LAFAMSupabaseClient,
    private readonly paymentPricingService: PaymentPricingService,
    private readonly paymentGatewayService: PaymentGatewayService,
    private readonly paymentRepository: PaymentRepository,
    private readonly walletRepository: WalletRepository,
  ) {}

  async createCheckoutPayment(
    input: PaymentCheckoutServiceInput,
  ): Promise<PaymentCheckoutResult> {
    const userContext = await this.resolveCheckoutUserContext(input);
    const pricing = await this.paymentPricingService.resolveCheckoutPricing({
      user_id: input.user_id,
      target_type: input.target_type,
      booking_id: input.booking_id,
      private_booking_id: input.private_booking_id,
      wallet_top_up_amount: input.wallet_top_up_amount,
      currency: input.currency,
      promo_code: input.promo_code,
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
      });
    }

    return this.createHostedCheckoutPayment({
      input,
      pricing,
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
  }): Promise<PaymentCheckoutHostedRedirectResult> {
    const hostedPaymentMethod = assertHostedCheckoutMethod(
      input.input.payment_method,
    );
    const gatewayProvider = resolveGatewayProvider();

    const intentContext = await this.createCheckoutIntent({
      originalInput: input.input,
      pricing: input.pricing,
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
      },
    });

    const providerResult = await this.createHostedPaymentWithAudit({
      payment,
      command: intentContext.command,
      hostedPaymentMethod,
      gatewayProvider,
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
        },
      });

      throw error;
    }
  }

  private async createWalletCheckoutPayment(input: {
    readonly input: PaymentCheckoutServiceInput;
    readonly pricing: PaymentPriceResolutionResult;
  }): Promise<PaymentCheckoutWalletResult> {
    const intentContext = await this.createCheckoutIntent({
      originalInput: input.input,
      pricing: input.pricing,
      payment_provider: PAYMENT_PROVIDER_WALLET,
      callback_url: null,
    });

    const payment = intentContext.payment;

    if (payment.status === PAYMENT_STATUS_PAID) {
      return this.resolveExistingWalletCheckoutResult(payment);
    }

    PaymentLifecyclePolicy.assertPaymentNotExpired({
      payment,
    });

    const entryType = resolveDebitLedgerEntryTypeForCheckoutTarget(
      payment.target_type,
    );

    WalletLedgerPolicy.assertDebitInput({
      user_id: payment.user_id,
      payment_id: payment.id,
      currency: input.pricing.currency,
      amount: input.pricing.final_amount,
      entry_type: entryType,
      booking_id: payment.booking_id,
      private_booking_id: payment.private_booking_id,
      description: 'Wallet payment for booking checkout.',
      metadata: {
        checkout_stage: 'wallet_debit_validation',
        payment_id: payment.id,
        payment_number: payment.payment_number,
        target_type: payment.target_type,
        booking_id: payment.booking_id,
        private_booking_id: payment.private_booking_id,
      },
    });

    const walletDebit = await this.walletRepository.debitWalletForBookingAtomic(
      {
        payment_id: payment.id,
        description: 'Wallet payment for booking checkout.',
        metadata: {
          checkout_stage: 'wallet_debit',
          payment_id: payment.id,
          payment_number: payment.payment_number,
          target_type: payment.target_type,
          booking_id: payment.booking_id,
          private_booking_id: payment.private_booking_id,
        },
      },
    );

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
      },
      metadata: {
        checkout_stage: 'wallet_debit',
      },
    });

    const updatedPayment = await this.getPaymentOrThrow(payment.id);

    return {
      payment: updatedPayment,
      status: updatedPayment.status,
      requires_redirect: false,
      wallet_account_id: walletDebit.wallet_account_id,
      wallet_ledger_entry_id: walletDebit.ledger_entry_id,
      available_balance: walletDebit.available_balance,
    };
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
    };
  }

  private async createCheckoutIntent(input: {
    readonly originalInput: PaymentCheckoutServiceInput;
    readonly pricing: PaymentPriceResolutionResult;
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
      metadata: buildCheckoutMetadata({
        originalInput: input.originalInput,
        pricing: input.pricing,
        sanitizedClientMetadata: sanitizedMetadataResult.sanitized,
        removedMetadataKeys: sanitizedMetadataResult.removed_keys,
      }),
    };

    const paymentIntent =
      await this.paymentRepository.createPaymentIntentAtomic({
        user_id: command.user_id,
        target_type: command.target.target_type,
        booking_id: command.target.booking_id,
        private_booking_id: command.target.private_booking_id,
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
        metadata: command.metadata,
      });

    const payment = await this.getPaymentOrThrow(paymentIntent.payment_id);

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
        final_amount: paymentIntent.final_amount,
        currency: paymentIntent.currency,
      },
      metadata: {
        checkout_stage: 'payment_intent_created',
      },
    });

    return {
      pricing: input.pricing,
      command,
      payment,
    };
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
