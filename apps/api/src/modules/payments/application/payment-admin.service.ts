// apps/api/src/modules/payments/application/payment-admin.service.ts
/**
 * LAFAM Payment admin service.
 *
 * Role:
 * - Provides admin payment listing.
 * - Provides admin payment detail with transactions and discounts.
 * - Provides admin payment transaction listing.
 * - Orchestrates admin refunds.
 * - Preserves booking-order payment identity in admin payment summaries.
 * - Keeps refund eligibility inside PaymentLifecyclePolicy.
 * - Keeps external refund provider calls behind PaymentGatewayService.
 * - Keeps final refund mutation inside refund_payment_atomic.
 *
 * Important:
 * - This service does not calculate checkout pricing.
 * - This service does not verify customer ownership because admin routes are role-protected by controllers/guards.
 * - This service does not directly mutate wallet balances.
 * - This service does not fake provider refund success.
 * - Full refunds are supported by the current atomic refund RPC.
 * - Booking-order refunds remain full-order only in this phase.
 * - Partial refunds are rejected until the atomic refund RPC and database contract explicitly support them.
 */

import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import type { DatabaseJsonObject } from '../../../database/database.types';
import { AuthUserRepository } from '../../auth/repositories/auth-user.repository';
import type { AuthUserInternalProfile } from '../../auth/types/auth-user.types';
import { EmailNotificationService } from '../../notifications/application/email-notification.service';
import {
  EMAIL_NOTIFICATION_ENTITY_TYPE_PAYMENT,
  EMAIL_NOTIFICATION_EVENT_PAYMENT_REFUND_FAILED_OR_MANUAL_REVIEW_REQUIRED,
  EMAIL_NOTIFICATION_EVENT_PAYMENT_REFUNDED,
  EMAIL_RECIPIENT_ROLE_CUSTOMER,
} from '../../notifications/constants/notification.constants';
import { createPaymentEmailIdempotencyKey } from '../../notifications/domain/email-idempotency.policy';
import type {
  EmailNotificationEvent,
  EmailRecipient,
} from '../../notifications/types/notification.types';
import {
  PAYMENT_DEFAULT_CURRENCY,
  PAYMENT_METHOD_WALLET,
  PAYMENT_PROVIDER_WALLET,
  PAYMENT_STATUS_MANUAL_REFUND_REQUIRED,
  PAYMENT_STATUS_REFUND_PROCESSING,
  PAYMENT_STATUS_REFUND_REQUESTED,
  PAYMENT_TRANSACTION_STATUS_FAILED,
  PAYMENT_TRANSACTION_STATUS_PENDING,
  PAYMENT_TRANSACTION_STATUS_SUCCEEDED,
  PAYMENT_TRANSACTION_TYPE_REFUND_FAILED,
  PAYMENT_TRANSACTION_TYPE_REFUND_PROCESSED,
  PAYMENT_TRANSACTION_TYPE_REFUND_REQUESTED,
  isPaymentCurrency,
  isPaymentExternalGatewayProvider,
  type PaymentCurrency,
  type PaymentProvider,
} from '../constants/payment.constants';
import { PaymentLifecyclePolicy } from '../domain/payment-lifecycle.policy';
import { PaymentSecurityPolicy } from '../domain/payment-security.policy';
import { PaymentRepository } from '../repositories/payment.repository';
import type {
  PaymentDetail,
  PaymentDetailResponse,
  PaymentDiscountRecord,
  PaymentDiscountSummary,
  PaymentGatewayRefundResult,
  PaymentListQuery,
  PaymentListResponse,
  PaymentPaginatedResult,
  PaymentRecord,
  PaymentRefundResponse,
  PaymentSummary,
  PaymentTransactionCreateRecord,
  PaymentTransactionListQuery,
  PaymentTransactionRecord,
  PaymentTransactionSummary,
  RefundPaymentInput,
} from '../types/payment.types';
import { PaymentGatewayService } from './payment-gateway.service';

export interface PaymentAdminRefundInput extends RefundPaymentInput {
  readonly refund_amount?: number;
  readonly idempotency_key?: string;
  readonly metadata?: DatabaseJsonObject;
}

interface PaymentAdminDetailInput {
  readonly payment_id: string;
  readonly include_transactions?: boolean;
  readonly include_discounts?: boolean;
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

const PAYMENT_REFUND_FAILED_CODE = 'PAYMENT_REFUND_FAILED';
const PAYMENT_PARTIAL_REFUND_UNSUPPORTED_CODE =
  'PAYMENT_PARTIAL_REFUND_UNSUPPORTED';

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function roundPaymentAmount(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function safeFailureMessage(error: unknown): string {
  if (error instanceof Error && hasText(error.message)) {
    return error.message.slice(0, 1000);
  }

  return 'Refund failed.';
}

function normalizePaymentCurrency(
  currency: string | null | undefined,
): PaymentCurrency {
  const normalizedCurrency = hasText(currency)
    ? currency.trim().toUpperCase()
    : PAYMENT_DEFAULT_CURRENCY;

  if (isPaymentCurrency(normalizedCurrency)) {
    return normalizedCurrency;
  }

  throw AppError.paymentCurrencyUnsupported('Payment currency must be KWD.', {
    currency: normalizedCurrency,
  });
}

function buildPaginatedResult<TItem>(input: {
  readonly records: readonly TItem[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}): PaymentPaginatedResult<TItem> {
  return {
    items: input.records,
    total: input.total,
    limit: input.limit,
    offset: input.offset,
    has_more: input.offset + input.records.length < input.total,
  };
}

function mapPaymentToSummary(payment: PaymentRecord): PaymentSummary {
  return {
    id: payment.id,
    payment_number: payment.payment_number,
    receipt_number: payment.receipt_number,
    user_id: payment.user_id,
    target_type: payment.target_type,
    booking_id: payment.booking_id,
    private_booking_id: payment.private_booking_id,
    booking_order_id: payment.booking_order_id,
    amount: payment.amount,
    discount_amount: payment.discount_amount,
    final_amount: payment.final_amount,
    currency: normalizePaymentCurrency(payment.currency),
    payment_method: payment.payment_method,
    payment_provider: payment.payment_provider,
    status: payment.status,
    redirect_url: payment.redirect_url,
    paid_at: payment.paid_at,
    failed_at: payment.failed_at,
    cancelled_at: payment.cancelled_at,
    expired_at: payment.expired_at,
    refunded_at: payment.refunded_at,
    refunded_amount: payment.refunded_amount,
    expires_at: payment.expires_at,
    created_at: payment.created_at,
    updated_at: payment.updated_at,
    realtime_version: payment.realtime_version,
  };
}

function mapPaymentToDetail(input: {
  readonly payment: PaymentRecord;
  readonly transactions?: readonly PaymentTransactionSummary[];
  readonly discounts?: readonly PaymentDiscountSummary[];
}): PaymentDetail {
  return {
    ...mapPaymentToSummary(input.payment),
    gateway_reference: input.payment.gateway_reference,
    gateway_payment_id: input.payment.gateway_payment_id,
    gateway_invoice_id: input.payment.gateway_invoice_id,
    webhook_verified_at: input.payment.webhook_verified_at,
    failure_code: input.payment.failure_code,
    failure_message: input.payment.failure_message,
    metadata: input.payment.metadata,
    ...(input.transactions ? { transactions: input.transactions } : {}),
    ...(input.discounts ? { discounts: input.discounts } : {}),
  };
}

function mapPaymentTransactionToSummary(
  transaction: PaymentTransactionRecord,
): PaymentTransactionSummary {
  return {
    id: transaction.id,
    payment_id: transaction.payment_id,
    transaction_type: transaction.transaction_type,
    transaction_status: transaction.transaction_status,
    provider: transaction.provider,
    provider_reference: transaction.provider_reference,
    failure_code: transaction.failure_code,
    failure_message: transaction.failure_message,
    metadata: transaction.metadata,
    processed_at: transaction.processed_at,
    created_at: transaction.created_at,
  };
}

function mapPaymentDiscountToSummary(
  discount: PaymentDiscountRecord,
): PaymentDiscountSummary {
  return {
    id: discount.id,
    payment_id: discount.payment_id,
    promo_code_id: discount.promo_code_id,
    code: discount.code,
    discount_amount: discount.discount_amount,
    metadata: discount.metadata,
    created_at: discount.created_at,
  };
}

function resolveRequestedRefundAmount(input: {
  readonly payment: PaymentRecord;
  readonly requested_refund_amount?: number;
}): number {
  const refundableAmount = roundPaymentAmount(
    PaymentLifecyclePolicy.resolveRefundableAmount(input.payment),
  );

  if (typeof input.requested_refund_amount === 'undefined') {
    return refundableAmount;
  }

  const requestedRefundAmount = roundPaymentAmount(
    input.requested_refund_amount,
  );

  if (requestedRefundAmount !== refundableAmount) {
    throw AppError.refundNotAllowed(
      'Partial refunds are not supported by the current atomic refund RPC.',
      {
        payment_id: input.payment.id,
        payment_number: input.payment.payment_number,
        requested_refund_amount: requestedRefundAmount,
        refundable_amount: refundableAmount,
        failure_code: PAYMENT_PARTIAL_REFUND_UNSUPPORTED_CODE,
      },
    );
  }

  return requestedRefundAmount;
}

function buildRefundIdempotencyKey(input: {
  readonly payment_id: string;
  readonly idempotency_key?: string;
}): string {
  if (hasText(input.idempotency_key)) {
    return input.idempotency_key.trim();
  }

  return `admin-refund-${input.payment_id}`;
}

function buildRefundGatewayResponse(input: {
  readonly source: string;
  readonly provider: PaymentProvider;
  readonly refund_amount: number;
  readonly currency: PaymentCurrency;
  readonly reason: string;
  readonly admin_user_id: string;
  readonly sanitized_metadata: DatabaseJsonObject;
  readonly removed_metadata_keys: readonly string[];
  readonly provider_result?: PaymentGatewayRefundResult;
}): DatabaseJsonObject {
  return {
    source: input.source,
    provider: input.provider,
    refund_amount: input.refund_amount,
    currency: input.currency,
    reason: input.reason,
    admin_user_id: input.admin_user_id,
    metadata: input.sanitized_metadata,
    removed_metadata_keys: [...input.removed_metadata_keys],
    ...(input.provider_result
      ? {
          provider_result: {
            provider: input.provider_result.provider,
            provider_reference: input.provider_result.provider_reference,
            status: input.provider_result.status,
            refunded_amount: input.provider_result.refunded_amount,
            failure_code: input.provider_result.failure_code,
            failure_message: input.provider_result.failure_message,
            raw_response: input.provider_result.raw_response,
          },
        }
      : {}),
  };
}

function resolveRefundTransactionStatus(
  providerResult: PaymentGatewayRefundResult,
): PaymentTransactionCreateRecord['transaction_status'] {
  return providerResult.status === 'refund_failed'
    ? PAYMENT_TRANSACTION_STATUS_FAILED
    : PAYMENT_TRANSACTION_STATUS_SUCCEEDED;
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  if (!hasText(value)) {
    return null;
  }

  return value.trim();
}

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

function resolvePaymentTargetLabel(payment: PaymentRecord): string {
  if (hasText(payment.booking_order_id)) {
    return 'booking order';
  }

  if (hasText(payment.booking_id)) {
    return 'booking';
  }

  if (hasText(payment.private_booking_id)) {
    return 'private booking';
  }

  if (payment.target_type === 'wallet_top_up') {
    return 'wallet top-up';
  }

  return payment.target_type;
}

function createPaymentCustomerEmailRecipient(
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

function buildRefundEmailTemplateData(input: {
  readonly payment: PaymentRecord;
  readonly refundAmount: number;
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
    'targetType',
    resolvePaymentTargetLabel(input.payment),
  );
  addOptionalTemplateString(
    templateData,
    'amountLabel',
    formatMoneyAmount(input.payment.final_amount, input.payment.currency),
  );
  addOptionalTemplateString(
    templateData,
    'refundAmountLabel',
    formatMoneyAmount(input.refundAmount, input.payment.currency),
  );
  addOptionalTemplateNumber(templateData, 'amount', input.payment.amount);
  addOptionalTemplateNumber(
    templateData,
    'discountAmount',
    input.payment.discount_amount,
  );
  addOptionalTemplateNumber(
    templateData,
    'finalAmount',
    input.payment.final_amount,
  );
  addOptionalTemplateNumber(templateData, 'refundAmount', input.refundAmount);
  addOptionalTemplateString(templateData, 'currency', input.payment.currency);
  addOptionalTemplateString(templateData, 'paidAt', input.payment.paid_at);
  addOptionalTemplateString(
    templateData,
    'refundedAt',
    input.payment.refunded_at,
  );

  return templateData;
}

function buildRefundEmailMetadata(input: {
  readonly payment: PaymentRecord;
  readonly refundAmount: number;
}): DatabaseJsonObject {
  return {
    payment_id: input.payment.id,
    payment_number: input.payment.payment_number,
    receipt_number: input.payment.receipt_number,
    user_id: input.payment.user_id,
    target_type: input.payment.target_type,
    booking_id: input.payment.booking_id,
    private_booking_id: input.payment.private_booking_id,
    booking_order_id: input.payment.booking_order_id,
    amount: input.payment.amount,
    discount_amount: input.payment.discount_amount,
    final_amount: input.payment.final_amount,
    refund_amount: input.refundAmount,
    refunded_amount: input.payment.refunded_amount,
    currency: input.payment.currency,
    payment_method: input.payment.payment_method,
    payment_provider: input.payment.payment_provider,
    status: input.payment.status,
  };
}

@Injectable()
export class PaymentAdminService {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly paymentGatewayService: PaymentGatewayService,
    private readonly authUserRepository: AuthUserRepository,
    private readonly emailNotificationService: EmailNotificationService,
  ) {}

  async listAdminPayments(
    input: PaymentListQuery,
  ): Promise<PaymentListResponse> {
    const result = await this.paymentRepository.listPayments(input);

    return {
      payments: buildPaginatedResult({
        records: result.records.map(mapPaymentToSummary),
        total: result.total,
        limit: input.limit,
        offset: input.offset,
      }),
    };
  }

  async getAdminPaymentById(
    input: PaymentAdminDetailInput,
  ): Promise<PaymentDetailResponse> {
    const payment = await this.getPaymentOrThrow(input.payment_id);

    const transactions =
      input.include_transactions === false
        ? undefined
        : await this.getPaymentTransactionSummaries(payment.id);

    const discounts =
      input.include_discounts === false
        ? undefined
        : await this.getPaymentDiscountSummaries(payment.id);

    return {
      payment: mapPaymentToDetail({
        payment,
        transactions,
        discounts,
      }),
    };
  }

  async listAdminPaymentTransactions(
    input: PaymentTransactionListQuery,
  ): Promise<PaymentPaginatedResult<PaymentTransactionSummary>> {
    const payment = await this.paymentRepository.findPaymentById(
      input.payment_id,
    );

    if (!payment) {
      throw AppError.paymentNotFound('The requested payment was not found.', {
        payment_id: input.payment_id,
      });
    }

    const result = await this.paymentRepository.listPaymentTransactions(input);

    return buildPaginatedResult({
      records: result.records.map(mapPaymentTransactionToSummary),
      total: result.total,
      limit: input.limit,
      offset: input.offset,
    });
  }

  async refundPayment(
    input: PaymentAdminRefundInput,
  ): Promise<PaymentRefundResponse> {
    const payment = await this.getPaymentOrThrow(input.payment_id);

    PaymentSecurityPolicy.assertAdminActionHasAuditReason({
      admin_user_id: input.actor_admin_id,
      reason: input.reason,
      metadata: input.metadata,
    });

    const sanitizedMetadata = PaymentSecurityPolicy.sanitizeMetadata(
      input.metadata,
    );

    const refundAmount = resolveRequestedRefundAmount({
      payment,
      requested_refund_amount: input.refund_amount,
    });

    PaymentLifecyclePolicy.assertCanRequestRefund({
      payment,
      requested_refund_amount: refundAmount,
    });

    const currency = normalizePaymentCurrency(payment.currency);

    await this.createPaymentTransaction({
      payment_id: payment.id,
      transaction_type: PAYMENT_TRANSACTION_TYPE_REFUND_REQUESTED,
      transaction_status: PAYMENT_TRANSACTION_STATUS_PENDING,
      provider: payment.payment_provider,
      provider_reference: payment.gateway_reference,
      gateway_request: {
        payment_id: payment.id,
        payment_number: payment.payment_number,
        admin_user_id: input.actor_admin_id,
        reason: input.reason,
        requested_refund_amount: refundAmount,
        currency,
      },
      metadata: {
        refund_stage: 'admin_refund_requested',
        sanitized_metadata: sanitizedMetadata.sanitized,
        removed_metadata_keys: [...sanitizedMetadata.removed_keys],
      },
    });

    if (this.isWalletRefund(payment)) {
      return this.refundWalletPayment({
        payment,
        actor_admin_id: input.actor_admin_id,
        reason: input.reason,
        refund_amount: refundAmount,
        currency,
        sanitized_metadata: sanitizedMetadata.sanitized,
        removed_metadata_keys: sanitizedMetadata.removed_keys,
      });
    }

    if (!isPaymentExternalGatewayProvider(payment.payment_provider)) {
      const manualPayment = await this.markManualRefundRequired({
        payment,
        actor_admin_id: input.actor_admin_id,
        reason: input.reason,
        refund_amount: refundAmount,
        currency,
        sanitized_metadata: sanitizedMetadata.sanitized,
        removed_metadata_keys: sanitizedMetadata.removed_keys,
        failure_code: 'PAYMENT_PROVIDER_NOT_REFUNDABLE',
        failure_message:
          'Payment provider does not support automated refund through the configured gateway.',
      });

      return {
        payment: mapPaymentToSummary(manualPayment),
      };
    }

    return this.refundExternalProviderPayment({
      payment,
      actor_admin_id: input.actor_admin_id,
      reason: input.reason,
      refund_amount: refundAmount,
      currency,
      idempotency_key: buildRefundIdempotencyKey({
        payment_id: payment.id,
        idempotency_key: input.idempotency_key,
      }),
      sanitized_metadata: sanitizedMetadata.sanitized,
      removed_metadata_keys: sanitizedMetadata.removed_keys,
    });
  }

  async expireUnpaidPaymentIntents(): Promise<readonly PaymentSummary[]> {
    const expiredPayments =
      await this.paymentRepository.expirePaymentIntentsAtomic();

    const summaries: PaymentSummary[] = [];

    for (const expiredPayment of expiredPayments) {
      const payment = await this.paymentRepository.findPaymentById(
        expiredPayment.payment_id,
      );

      if (payment) {
        summaries.push(mapPaymentToSummary(payment));
      }
    }

    return summaries;
  }

  private async refundWalletPayment(input: {
    readonly payment: PaymentRecord;
    readonly actor_admin_id: string;
    readonly reason: string;
    readonly refund_amount: number;
    readonly currency: PaymentCurrency;
    readonly sanitized_metadata: DatabaseJsonObject;
    readonly removed_metadata_keys: readonly string[];
  }): Promise<PaymentRefundResponse> {
    const gatewayResponse = buildRefundGatewayResponse({
      source: 'wallet_atomic_refund',
      provider: PAYMENT_PROVIDER_WALLET,
      refund_amount: input.refund_amount,
      currency: input.currency,
      reason: input.reason,
      admin_user_id: input.actor_admin_id,
      sanitized_metadata: input.sanitized_metadata,
      removed_metadata_keys: input.removed_metadata_keys,
    });

    await this.paymentRepository.refundPaymentAtomic({
      payment_id: input.payment.id,
      actor_admin_id: input.actor_admin_id,
      reason: input.reason,
      refund_amount: input.refund_amount,
      gateway_response: gatewayResponse,
    });

    const updatedPayment = await this.getPaymentOrThrow(input.payment.id);

    await this.notifyPaymentRefunded({
      payment: updatedPayment,
      refundAmount: input.refund_amount,
    });

    return {
      payment: mapPaymentToSummary(updatedPayment),
    };
  }

  private async refundExternalProviderPayment(input: {
    readonly payment: PaymentRecord;
    readonly actor_admin_id: string;
    readonly reason: string;
    readonly refund_amount: number;
    readonly currency: PaymentCurrency;
    readonly idempotency_key: string;
    readonly sanitized_metadata: DatabaseJsonObject;
    readonly removed_metadata_keys: readonly string[];
  }): Promise<PaymentRefundResponse> {
    try {
      const providerResult = await this.paymentGatewayService.refundPayment({
        payment: input.payment,
        reason: input.reason,
        amount: input.refund_amount,
        currency: input.currency,
        idempotency_key: input.idempotency_key,
        metadata: {
          admin_user_id: input.actor_admin_id,
          sanitized_metadata: input.sanitized_metadata,
          removed_metadata_keys: [...input.removed_metadata_keys],
        },
      });

      await this.createPaymentTransaction({
        payment_id: input.payment.id,
        transaction_type:
          providerResult.status === 'refund_failed'
            ? PAYMENT_TRANSACTION_TYPE_REFUND_FAILED
            : PAYMENT_TRANSACTION_TYPE_REFUND_PROCESSED,
        transaction_status: resolveRefundTransactionStatus(providerResult),
        provider: providerResult.provider,
        provider_reference: providerResult.provider_reference,
        gateway_request: {
          payment_id: input.payment.id,
          payment_number: input.payment.payment_number,
          requested_refund_amount: input.refund_amount,
          currency: input.currency,
          reason: input.reason,
          idempotency_key: input.idempotency_key,
        },
        gateway_response: buildRefundGatewayResponse({
          source: 'external_provider_refund',
          provider: providerResult.provider,
          refund_amount: input.refund_amount,
          currency: input.currency,
          reason: input.reason,
          admin_user_id: input.actor_admin_id,
          sanitized_metadata: input.sanitized_metadata,
          removed_metadata_keys: input.removed_metadata_keys,
          provider_result: providerResult,
        }),
        failure_code: providerResult.failure_code,
        failure_message: providerResult.failure_message,
        metadata: {
          refund_stage: 'external_provider_refund',
        },
      });

      return this.applyProviderRefundResult({
        payment: input.payment,
        actor_admin_id: input.actor_admin_id,
        reason: input.reason,
        refund_amount: input.refund_amount,
        currency: input.currency,
        sanitized_metadata: input.sanitized_metadata,
        removed_metadata_keys: input.removed_metadata_keys,
        provider_result: providerResult,
      });
    } catch (error) {
      await this.createPaymentTransaction({
        payment_id: input.payment.id,
        transaction_type: PAYMENT_TRANSACTION_TYPE_REFUND_FAILED,
        transaction_status: PAYMENT_TRANSACTION_STATUS_FAILED,
        provider: input.payment.payment_provider,
        provider_reference: input.payment.gateway_reference,
        gateway_request: {
          payment_id: input.payment.id,
          payment_number: input.payment.payment_number,
          requested_refund_amount: input.refund_amount,
          currency: input.currency,
          reason: input.reason,
          idempotency_key: input.idempotency_key,
        },
        gateway_response: {
          refund_failed: true,
        },
        failure_code: PAYMENT_REFUND_FAILED_CODE,
        failure_message: safeFailureMessage(error),
        metadata: {
          refund_stage: 'external_provider_refund_failed',
        },
      });

      throw error;
    }
  }

  private async applyProviderRefundResult(input: {
    readonly payment: PaymentRecord;
    readonly actor_admin_id: string;
    readonly reason: string;
    readonly refund_amount: number;
    readonly currency: PaymentCurrency;
    readonly sanitized_metadata: DatabaseJsonObject;
    readonly removed_metadata_keys: readonly string[];
    readonly provider_result: PaymentGatewayRefundResult;
  }): Promise<PaymentRefundResponse> {
    if (input.provider_result.status === 'refunded') {
      PaymentLifecyclePolicy.assertCanMarkRefunded(input.payment);

      await this.paymentRepository.refundPaymentAtomic({
        payment_id: input.payment.id,
        actor_admin_id: input.actor_admin_id,
        reason: input.reason,
        refund_amount: input.refund_amount,
        gateway_response: buildRefundGatewayResponse({
          source: 'external_provider_refunded',
          provider: input.provider_result.provider,
          refund_amount: input.refund_amount,
          currency: input.currency,
          reason: input.reason,
          admin_user_id: input.actor_admin_id,
          sanitized_metadata: input.sanitized_metadata,
          removed_metadata_keys: input.removed_metadata_keys,
          provider_result: input.provider_result,
        }),
      });

      const updatedPayment = await this.getPaymentOrThrow(input.payment.id);

      await this.notifyPaymentRefunded({
        payment: updatedPayment,
        refundAmount: input.refund_amount,
      });

      return {
        payment: mapPaymentToSummary(updatedPayment),
      };
    }

    if (
      input.provider_result.status === 'refund_requested' ||
      input.provider_result.status === 'refund_processing'
    ) {
      const nextStatus =
        input.provider_result.status === 'refund_requested'
          ? PAYMENT_STATUS_REFUND_REQUESTED
          : PAYMENT_STATUS_REFUND_PROCESSING;

      const updatedPayment = await this.updateRefundLifecycleStatus({
        payment: input.payment,
        next_status: nextStatus,
        gateway_response: buildRefundGatewayResponse({
          source: 'external_provider_refund_pending',
          provider: input.provider_result.provider,
          refund_amount: input.refund_amount,
          currency: input.currency,
          reason: input.reason,
          admin_user_id: input.actor_admin_id,
          sanitized_metadata: input.sanitized_metadata,
          removed_metadata_keys: input.removed_metadata_keys,
          provider_result: input.provider_result,
        }),
      });

      return {
        payment: mapPaymentToSummary(updatedPayment),
      };
    }

    if (input.provider_result.status === 'manual_refund_required') {
      const manualPayment = await this.markManualRefundRequired({
        payment: input.payment,
        actor_admin_id: input.actor_admin_id,
        reason: input.reason,
        refund_amount: input.refund_amount,
        currency: input.currency,
        sanitized_metadata: input.sanitized_metadata,
        removed_metadata_keys: input.removed_metadata_keys,
        failure_code:
          input.provider_result.failure_code ??
          'PAYMENT_MANUAL_REFUND_REQUIRED',
        failure_message:
          input.provider_result.failure_message ??
          'Manual refund is required for this payment provider.',
        provider_result: input.provider_result,
      });

      await this.notifyPaymentRefundFailedOrManualReviewRequired({
        payment: manualPayment,
        refundAmount: input.refund_amount,
      });

      return {
        payment: mapPaymentToSummary(manualPayment),
      };
    }

    throw AppError.refundFailed({
      payment_id: input.payment.id,
      provider: input.provider_result.provider,
      provider_status: input.provider_result.status,
      failure_code: input.provider_result.failure_code,
      failure_message: input.provider_result.failure_message,
    });
  }

  private async updateRefundLifecycleStatus(input: {
    readonly payment: PaymentRecord;
    readonly next_status:
      | typeof PAYMENT_STATUS_REFUND_REQUESTED
      | typeof PAYMENT_STATUS_REFUND_PROCESSING;
    readonly gateway_response: DatabaseJsonObject;
  }): Promise<PaymentRecord> {
    const transition = PaymentLifecyclePolicy.assertTransitionAllowed({
      current_status: input.payment.status,
      next_status: input.next_status,
    });

    if (transition.ignored) {
      throw AppError.refundNotAllowed(
        'Payment cannot move to requested refund status in its current state.',
        {
          payment_id: input.payment.id,
          payment_number: input.payment.payment_number,
          current_status: input.payment.status,
          next_status: input.next_status,
          reason: transition.reason,
        },
      );
    }

    return this.paymentRepository.updatePayment(input.payment.id, {
      status: input.next_status,
      failure_code: null,
      failure_message: null,
      metadata: {
        ...input.payment.metadata,
        refund_gateway_response: input.gateway_response,
      },
    });
  }

  private async markManualRefundRequired(input: {
    readonly payment: PaymentRecord;
    readonly actor_admin_id: string;
    readonly reason: string;
    readonly refund_amount: number;
    readonly currency: PaymentCurrency;
    readonly sanitized_metadata: DatabaseJsonObject;
    readonly removed_metadata_keys: readonly string[];
    readonly failure_code: string;
    readonly failure_message: string;
    readonly provider_result?: PaymentGatewayRefundResult;
  }): Promise<PaymentRecord> {
    PaymentLifecyclePolicy.assertCanMarkManualRefundRequired(input.payment);

    await this.createPaymentTransaction({
      payment_id: input.payment.id,
      transaction_type: PAYMENT_TRANSACTION_TYPE_REFUND_FAILED,
      transaction_status: PAYMENT_TRANSACTION_STATUS_FAILED,
      provider:
        input.provider_result?.provider ?? input.payment.payment_provider,
      provider_reference:
        input.provider_result?.provider_reference ??
        input.payment.gateway_reference,
      gateway_response: buildRefundGatewayResponse({
        source: 'manual_refund_required',
        provider:
          input.provider_result?.provider ?? input.payment.payment_provider,
        refund_amount: input.refund_amount,
        currency: input.currency,
        reason: input.reason,
        admin_user_id: input.actor_admin_id,
        sanitized_metadata: input.sanitized_metadata,
        removed_metadata_keys: input.removed_metadata_keys,
        provider_result: input.provider_result,
      }),
      failure_code: input.failure_code,
      failure_message: input.failure_message,
      metadata: {
        refund_stage: 'manual_refund_required',
      },
    });

    return this.paymentRepository.updatePayment(input.payment.id, {
      status: PAYMENT_STATUS_MANUAL_REFUND_REQUIRED,
      failure_code: input.failure_code,
      failure_message: input.failure_message,
      metadata: {
        ...input.payment.metadata,
        manual_refund_required: {
          actor_admin_id: input.actor_admin_id,
          reason: input.reason,
          refund_amount: input.refund_amount,
          currency: input.currency,
          metadata: input.sanitized_metadata,
          removed_metadata_keys: [...input.removed_metadata_keys],
        },
      },
    });
  }

  private async notifyRefundEmailBestEffort(input: {
    readonly payment: PaymentRecord;
    readonly refundAmount: number;
    readonly eventType: EmailNotificationEvent;
  }): Promise<void> {
    try {
      const user = await this.authUserRepository.findById({
        userId: input.payment.user_id,
      });
      const recipient = createPaymentCustomerEmailRecipient(user);

      if (!recipient) {
        return;
      }

      await this.emailNotificationService.createFromTemplate({
        eventType: input.eventType,
        recipient,
        templateData: buildRefundEmailTemplateData({
          payment: input.payment,
          refundAmount: input.refundAmount,
          recipient,
        }),
        entity: {
          entityType: EMAIL_NOTIFICATION_ENTITY_TYPE_PAYMENT,
          entityId: input.payment.id,
        },
        idempotencyKey: createPaymentEmailIdempotencyKey({
          eventType: input.eventType,
          paymentId: input.payment.id,
          recipient,
        }),
        metadata: buildRefundEmailMetadata({
          payment: input.payment,
          refundAmount: input.refundAmount,
        }),
      });
    } catch {
      // Best-effort notification side effect. The committed refund/payment state remains authoritative.
    }
  }

  private async notifyPaymentRefunded(input: {
    readonly payment: PaymentRecord;
    readonly refundAmount: number;
  }): Promise<void> {
    await this.notifyRefundEmailBestEffort({
      payment: input.payment,
      refundAmount: input.refundAmount,
      eventType: EMAIL_NOTIFICATION_EVENT_PAYMENT_REFUNDED,
    });
  }

  private async notifyPaymentRefundFailedOrManualReviewRequired(input: {
    readonly payment: PaymentRecord;
    readonly refundAmount: number;
  }): Promise<void> {
    await this.notifyRefundEmailBestEffort({
      payment: input.payment,
      refundAmount: input.refundAmount,
      eventType:
        EMAIL_NOTIFICATION_EVENT_PAYMENT_REFUND_FAILED_OR_MANUAL_REVIEW_REQUIRED,
    });
  }

  private async getPaymentTransactionSummaries(
    paymentId: string,
  ): Promise<readonly PaymentTransactionSummary[]> {
    const transactions =
      await this.paymentRepository.findPaymentTransactions(paymentId);

    return transactions.map(mapPaymentTransactionToSummary);
  }

  private async getPaymentDiscountSummaries(
    paymentId: string,
  ): Promise<readonly PaymentDiscountSummary[]> {
    const discounts =
      await this.paymentRepository.findPaymentDiscounts(paymentId);

    return discounts.map(mapPaymentDiscountToSummary);
  }

  private async getPaymentOrThrow(paymentId: string): Promise<PaymentRecord> {
    const payment = await this.paymentRepository.findPaymentById(paymentId);

    if (!payment) {
      throw AppError.paymentNotFound('The requested payment was not found.', {
        payment_id: paymentId,
      });
    }

    return payment;
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

  private isWalletRefund(payment: PaymentRecord): boolean {
    return (
      payment.payment_method === PAYMENT_METHOD_WALLET ||
      payment.payment_provider === PAYMENT_PROVIDER_WALLET
    );
  }
}
