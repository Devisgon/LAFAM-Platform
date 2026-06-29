// apps/api/src/modules/payments/application/payment-callback.service.ts
/**
 * LAFAM Payment callback service.
 *
 * Role:
 * - Handles hosted payment browser callbacks.
 * - Handles provider webhooks.
 * - Verifies provider payment status through PaymentGatewayService.
 * - Applies safe payment lifecycle transitions through PaymentLifecyclePolicy.
 * - Calls atomic payment mutation RPC wrappers through PaymentRepository.
 * - Builds frontend redirect URLs for callback completion.
 *
 * Important:
 * - Browser callback is not payment truth.
 * - Webhook signature must be verified before trusting webhook payload.
 * - Provider verification decides settlement status.
 * - Duplicate paid/failed/cancelled webhook events must be idempotent.
 * - Paid status is protected from failed/cancelled events arriving later.
 * - This service does not calculate prices.
 * - This service does not debit/credit wallet directly.
 * - mark_payment_paid_atomic handles booking confirmation, booking-order confirmation, and wallet top-up credit.
 */

import { Injectable } from '@nestjs/common';

import { currentPaymentConfig } from '../../../common/config';
import { AppError } from '../../../common/errors/app-error';
import type { DatabaseJsonObject } from '../../../database/database.types';
import { AuthUserRepository } from '../../auth/repositories/auth-user.repository';
import type { AuthUserInternalProfile } from '../../auth/types/auth-user.types';
import { EmailNotificationService } from '../../notifications/application/email-notification.service';
import {
  EMAIL_NOTIFICATION_ENTITY_TYPE_PAYMENT,
  EMAIL_NOTIFICATION_EVENT_PAYMENT_CANCELLED,
  EMAIL_NOTIFICATION_EVENT_PAYMENT_FAILED,
  EMAIL_NOTIFICATION_EVENT_PAYMENT_SUCCESS_RECEIPT,
  EMAIL_RECIPIENT_ROLE_CUSTOMER,
} from '../../notifications/constants/notification.constants';
import { createPaymentEmailIdempotencyKey } from '../../notifications/domain/email-idempotency.policy';
import type {
  EmailNotificationEvent,
  EmailRecipient,
} from '../../notifications/types/notification.types';
import {
  PAYMENT_PROVIDER_MOCK,
  PAYMENT_STATUS_CANCELLED,
  PAYMENT_STATUS_FAILED,
  PAYMENT_STATUS_PAID,
  PAYMENT_STATUS_PROCESSING,
  PAYMENT_TRANSACTION_STATUS_FAILED,
  PAYMENT_TRANSACTION_STATUS_IGNORED,
  PAYMENT_TRANSACTION_STATUS_SUCCEEDED,
  PAYMENT_TRANSACTION_TYPE_CALLBACK_RECEIVED,
  PAYMENT_TRANSACTION_TYPE_STATUS_CHANGE,
  PAYMENT_TRANSACTION_TYPE_VERIFICATION,
  PAYMENT_TRANSACTION_TYPE_WEBHOOK_RECEIVED,
  PAYMENT_WEBHOOK_EVENT_PAYMENT_REFUNDED,
  type PaymentProvider,
  type PaymentStatus,
} from '../constants/payment.constants';
import { PaymentLifecyclePolicy } from '../domain/payment-lifecycle.policy';
import { PaymentSecurityPolicy } from '../domain/payment-security.policy';
import { PaymentRepository } from '../repositories/payment.repository';
import type {
  PaymentCallbackInput,
  PaymentCallbackResultPayload,
  PaymentGatewayVerifyPaymentResult,
  PaymentProviderVerificationStatus,
  PaymentRecord,
  PaymentTransactionCreateRecord,
  PaymentUpdateRecord,
  PaymentWebhookHandlingResult,
  PaymentWebhookInput,
  PaymentWebhookParsedEvent,
} from '../types/payment.types';
import { PaymentGatewayService } from './payment-gateway.service';

export interface VerifyCustomerPaymentInput {
  readonly payment_id: string;
  readonly user_id: string;
  readonly provider_reference?: string | null;
  readonly gateway_payment_id?: string | null;
  readonly gateway_invoice_id?: string | null;
}

interface PaymentReferenceInput {
  readonly payment_id?: string | null;
  readonly provider_reference?: string | null;
  readonly gateway_payment_id?: string | null;
  readonly gateway_invoice_id?: string | null;
}

interface PaymentVerificationApplicationInput {
  readonly payment: PaymentRecord;
  readonly references: PaymentReferenceInput;
  readonly source: 'callback' | 'webhook' | 'customer_verify';
  readonly webhook_verified: boolean;
  readonly raw_payload: DatabaseJsonObject;
  readonly swallow_provider_errors: boolean;
}

interface PaymentVerificationApplicationResult {
  readonly payment: PaymentRecord;
  readonly ignored: boolean;
  readonly provider_status: PaymentProviderVerificationStatus;
  readonly reason: string | null;
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

const PAYMENT_VERIFICATION_FAILED_CODE = 'PAYMENT_VERIFICATION_FAILED';
const PAYMENT_WEBHOOK_REFUND_EVENT_IGNORED_CODE =
  'PAYMENT_WEBHOOK_REFUND_EVENT_IGNORED';
const PAYMENT_EVENT_ALREADY_SETTLED_CODE = 'PAYMENT_EVENT_ALREADY_SETTLED';

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

function safeFailureMessage(error: unknown): string {
  if (error instanceof Error && hasText(error.message)) {
    return error.message.slice(0, 1000);
  }

  return 'Payment provider verification failed.';
}

function resolveCallbackProviderReferences(
  input: PaymentCallbackInput,
): PaymentReferenceInput {
  return {
    payment_id: normalizeOptionalText(input.payment_id),
    provider_reference: normalizeOptionalText(input.provider_reference),
    gateway_payment_id: normalizeOptionalText(input.gateway_payment_id),
    gateway_invoice_id: normalizeOptionalText(input.gateway_invoice_id),
  };
}

function resolveWebhookProviderReferences(
  event: PaymentWebhookParsedEvent,
): PaymentReferenceInput {
  return {
    payment_id: normalizeOptionalText(event.payment_id),
    provider_reference: normalizeOptionalText(event.provider_reference),
    gateway_payment_id: normalizeOptionalText(event.gateway_payment_id),
    gateway_invoice_id: normalizeOptionalText(event.gateway_invoice_id),
  };
}

function buildPaymentRedirectUrl(input: {
  readonly base_url: string;
  readonly payment: PaymentRecord | null;
  readonly status: PaymentStatus | null;
  readonly reason?: string | null;
}): string {
  const redirectUrl = new URL(input.base_url);

  if (input.payment) {
    redirectUrl.searchParams.set('payment_id', input.payment.id);
    redirectUrl.searchParams.set(
      'payment_number',
      input.payment.payment_number,
    );
    redirectUrl.searchParams.set('target_type', input.payment.target_type);

    if (hasText(input.payment.booking_id)) {
      redirectUrl.searchParams.set('booking_id', input.payment.booking_id);
    }

    if (hasText(input.payment.private_booking_id)) {
      redirectUrl.searchParams.set(
        'private_booking_id',
        input.payment.private_booking_id,
      );
    }

    if (hasText(input.payment.booking_order_id)) {
      redirectUrl.searchParams.set(
        'booking_order_id',
        input.payment.booking_order_id,
      );
    }
  }

  if (input.status) {
    redirectUrl.searchParams.set('status', input.status);
  }

  if (hasText(input.reason)) {
    redirectUrl.searchParams.set('reason', input.reason);
  }

  return redirectUrl.toString();
}

function buildCallbackPayload(input: {
  readonly payment: PaymentRecord | null;
  readonly status: PaymentStatus | null;
  readonly frontend_redirect_url: string;
}): PaymentCallbackResultPayload {
  return {
    payment_id: input.payment?.id ?? null,
    payment_number: input.payment?.payment_number ?? null,
    status: input.status,
    frontend_redirect_url: input.frontend_redirect_url,
  };
}

function resolveFrontendRedirectUrl(input: {
  readonly payment: PaymentRecord | null;
  readonly status: PaymentStatus | null;
  readonly reason?: string | null;
}): string {
  const baseUrl =
    input.status === PAYMENT_STATUS_PAID
      ? currentPaymentConfig.redirect.frontendSuccessUrl
      : currentPaymentConfig.redirect.frontendFailureUrl;

  return buildPaymentRedirectUrl({
    base_url: baseUrl,
    payment: input.payment,
    status: input.status,
    reason: input.reason ?? null,
  });
}

function buildPaymentTargetAuditPayload(
  payment: PaymentRecord,
): DatabaseJsonObject {
  return {
    payment_id: payment.id,
    payment_number: payment.payment_number,
    user_id: payment.user_id,
    target_type: payment.target_type,
    booking_id: payment.booking_id,
    private_booking_id: payment.private_booking_id,
    booking_order_id: payment.booking_order_id,
  };
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

function buildPaymentEmailTemplateData(input: {
  readonly payment: PaymentRecord;
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
    'paymentMethod',
    input.payment.payment_method,
  );
  addOptionalTemplateString(
    templateData,
    'paymentProvider',
    input.payment.payment_provider,
  );
  addOptionalTemplateString(
    templateData,
    'amountLabel',
    formatMoneyAmount(input.payment.final_amount, input.payment.currency),
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
  addOptionalTemplateString(templateData, 'currency', input.payment.currency);
  addOptionalTemplateString(templateData, 'paidAt', input.payment.paid_at);
  addOptionalTemplateString(templateData, 'failedAt', input.payment.failed_at);
  addOptionalTemplateString(
    templateData,
    'cancelledAt',
    input.payment.cancelled_at,
  );
  addOptionalTemplateString(
    templateData,
    'expiresAt',
    input.payment.expires_at,
  );

  return templateData;
}

function buildPaymentEmailMetadata(payment: PaymentRecord): DatabaseJsonObject {
  return {
    payment_id: payment.id,
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
    currency: payment.currency,
    payment_method: payment.payment_method,
    payment_provider: payment.payment_provider,
    status: payment.status,
  };
}

function buildProviderVerificationPayload(input: {
  readonly payment: PaymentRecord;
  readonly source: PaymentVerificationApplicationInput['source'];
  readonly result: PaymentGatewayVerifyPaymentResult;
  readonly raw_payload: DatabaseJsonObject;
}): DatabaseJsonObject {
  return {
    source: input.source,
    target: buildPaymentTargetAuditPayload(input.payment),
    provider: input.result.provider,
    provider_reference: input.result.provider_reference,
    gateway_payment_id: input.result.gateway_payment_id,
    gateway_invoice_id: input.result.gateway_invoice_id,
    provider_status: input.result.status,
    failure_code: input.result.failure_code,
    failure_message: input.result.failure_message,
    raw_response: input.result.raw_response,
    raw_payload: input.raw_payload,
  };
}

function resolveVerificationTransactionStatus(
  providerStatus: PaymentProviderVerificationStatus,
): PaymentTransactionCreateRecord['transaction_status'] {
  return providerStatus === 'unknown'
    ? PAYMENT_TRANSACTION_STATUS_FAILED
    : PAYMENT_TRANSACTION_STATUS_SUCCEEDED;
}

function resolveStatusChangeTransactionStatus(
  ignored: boolean,
): PaymentTransactionCreateRecord['transaction_status'] {
  return ignored
    ? PAYMENT_TRANSACTION_STATUS_IGNORED
    : PAYMENT_TRANSACTION_STATUS_SUCCEEDED;
}

function shouldReturnCurrentSettlementState(payment: PaymentRecord): boolean {
  return (
    PaymentLifecyclePolicy.isPaid(payment) ||
    PaymentLifecyclePolicy.isFailure(payment) ||
    PaymentLifecyclePolicy.isRefundLifecycle(payment) ||
    PaymentLifecyclePolicy.isTerminal(payment)
  );
}

@Injectable()
export class PaymentCallbackService {
  constructor(
    private readonly paymentGatewayService: PaymentGatewayService,
    private readonly paymentRepository: PaymentRepository,
    private readonly authUserRepository: AuthUserRepository,
    private readonly emailNotificationService: EmailNotificationService,
  ) {}

  async handleCallback(
    input: PaymentCallbackInput,
  ): Promise<PaymentCallbackResultPayload> {
    const references = resolveCallbackProviderReferences(input);

    PaymentSecurityPolicy.assertReferencePresent(references);

    const payment =
      await this.paymentRepository.findPaymentByReferences(references);

    if (!payment) {
      return buildCallbackPayload({
        payment: null,
        status: null,
        frontend_redirect_url: resolveFrontendRedirectUrl({
          payment: null,
          status: null,
          reason: 'payment_not_found',
        }),
      });
    }

    await this.createPaymentTransaction({
      payment_id: payment.id,
      transaction_type: PAYMENT_TRANSACTION_TYPE_CALLBACK_RECEIVED,
      transaction_status: PAYMENT_TRANSACTION_STATUS_SUCCEEDED,
      provider: input.provider,
      provider_reference: references.provider_reference,
      gateway_request: input.raw_query,
      gateway_response: {
        target: buildPaymentTargetAuditPayload(payment),
        payment_id: references.payment_id,
        provider_reference: references.provider_reference,
        gateway_payment_id: references.gateway_payment_id,
        gateway_invoice_id: references.gateway_invoice_id,
        callback_result: input.result ?? null,
      },
      metadata: {
        source: 'callback',
      },
    });

    if (payment.payment_provider !== input.provider) {
      return buildCallbackPayload({
        payment,
        status: payment.status,
        frontend_redirect_url: resolveFrontendRedirectUrl({
          payment,
          status: payment.status,
          reason: 'provider_mismatch',
        }),
      });
    }

    const result = await this.verifyAndApplyProviderStatus({
      payment,
      references,
      source: 'callback',
      webhook_verified: false,
      raw_payload: input.raw_query,
      swallow_provider_errors: true,
    });

    const redirectUrl = resolveFrontendRedirectUrl({
      payment: result.payment,
      status: result.payment.status,
      reason: result.reason,
    });

    return buildCallbackPayload({
      payment: result.payment,
      status: result.payment.status,
      frontend_redirect_url: redirectUrl,
    });
  }

  async verifyPaymentForCustomer(
    input: VerifyCustomerPaymentInput,
  ): Promise<PaymentRecord> {
    const payment = await this.paymentRepository.findPaymentByIdForUser(
      input.payment_id,
      input.user_id,
    );

    if (!payment) {
      throw AppError.paymentNotFound('The requested payment was not found.', {
        payment_id: input.payment_id,
        user_id: input.user_id,
      });
    }

    PaymentSecurityPolicy.assertPaymentOwnedByUser({
      payment,
      user_id: input.user_id,
    });

    const result = await this.verifyAndApplyProviderStatus({
      payment,
      references: {
        payment_id: input.payment_id,
        provider_reference: input.provider_reference ?? null,
        gateway_payment_id: input.gateway_payment_id ?? null,
        gateway_invoice_id: input.gateway_invoice_id ?? null,
      },
      source: 'customer_verify',
      webhook_verified: false,
      raw_payload: {
        payment_id: input.payment_id,
        provider_reference: input.provider_reference ?? null,
        gateway_payment_id: input.gateway_payment_id ?? null,
        gateway_invoice_id: input.gateway_invoice_id ?? null,
      },
      swallow_provider_errors: false,
    });

    return result.payment;
  }

  async handleWebhook(
    input: PaymentWebhookInput,
  ): Promise<PaymentWebhookHandlingResult> {
    PaymentSecurityPolicy.assertWebhookSignaturePresent(
      input.headers,
      input.provider,
    );

    PaymentSecurityPolicy.assertWebhookTimestampFresh({
      headers: input.headers,
      require_timestamp: input.provider !== PAYMENT_PROVIDER_MOCK,
    });

    await this.paymentGatewayService.verifyWebhookSignature(input);

    const event = await this.paymentGatewayService.parseWebhook(input);

    if (event.event_type === PAYMENT_WEBHOOK_EVENT_PAYMENT_REFUNDED) {
      return this.handleIgnoredRefundWebhook(event);
    }

    const references = resolveWebhookProviderReferences(event);

    PaymentSecurityPolicy.assertReferencePresent(references);

    const payment =
      await this.paymentRepository.findPaymentByReferences(references);

    if (!payment) {
      return {
        accepted: true,
        ignored: true,
        payment_id: null,
        status: null,
      };
    }

    await this.createPaymentTransaction({
      payment_id: payment.id,
      transaction_type: PAYMENT_TRANSACTION_TYPE_WEBHOOK_RECEIVED,
      transaction_status: PAYMENT_TRANSACTION_STATUS_SUCCEEDED,
      provider: event.provider,
      provider_reference: event.provider_reference,
      gateway_request: {
        headers: {
          event_id: input.headers.event_id,
          timestamp: input.headers.timestamp,
          signature_present: hasText(input.headers.signature),
        },
      },
      gateway_response: {
        target: buildPaymentTargetAuditPayload(payment),
        event_id: event.event_id,
        event_type: event.event_type,
        provider_reference: event.provider_reference,
        gateway_payment_id: event.gateway_payment_id,
        gateway_invoice_id: event.gateway_invoice_id,
        provider_status: event.status,
        failure_code: event.failure_code,
        failure_message: event.failure_message,
        occurred_at: event.occurred_at,
        raw_payload: event.raw_payload,
      },
      metadata: {
        source: 'webhook',
      },
    });

    if (payment.payment_provider !== event.provider) {
      await this.createPaymentTransaction({
        payment_id: payment.id,
        transaction_type: PAYMENT_TRANSACTION_TYPE_STATUS_CHANGE,
        transaction_status: PAYMENT_TRANSACTION_STATUS_IGNORED,
        provider: event.provider,
        provider_reference: event.provider_reference,
        gateway_response: {
          target: buildPaymentTargetAuditPayload(payment),
          reason: 'provider_mismatch',
          payment_provider: payment.payment_provider,
          webhook_provider: event.provider,
          event_id: event.event_id,
          event_type: event.event_type,
        },
        metadata: {
          source: 'webhook',
        },
      });

      return {
        accepted: true,
        ignored: true,
        payment_id: payment.id,
        status: payment.status,
      };
    }

    const result = await this.verifyAndApplyProviderStatus({
      payment,
      references,
      source: 'webhook',
      webhook_verified: true,
      raw_payload: event.raw_payload,
      swallow_provider_errors: false,
    });

    return {
      accepted: true,
      ignored: result.ignored,
      payment_id: result.payment.id,
      status: result.payment.status,
    };
  }

  private async notifyPaymentStatusEmailBestEffort(input: {
    readonly payment: PaymentRecord;
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
        templateData: buildPaymentEmailTemplateData({
          payment: input.payment,
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
        metadata: buildPaymentEmailMetadata(input.payment),
      });
    } catch {
      // Best-effort notification side effect. Verified payment state remains authoritative.
    }
  }

  private async notifyPaymentSuccessReceipt(
    payment: PaymentRecord,
  ): Promise<void> {
    await this.notifyPaymentStatusEmailBestEffort({
      payment,
      eventType: EMAIL_NOTIFICATION_EVENT_PAYMENT_SUCCESS_RECEIPT,
    });
  }

  private async notifyPaymentFailed(payment: PaymentRecord): Promise<void> {
    await this.notifyPaymentStatusEmailBestEffort({
      payment,
      eventType: EMAIL_NOTIFICATION_EVENT_PAYMENT_FAILED,
    });
  }

  private async notifyPaymentCancelled(payment: PaymentRecord): Promise<void> {
    await this.notifyPaymentStatusEmailBestEffort({
      payment,
      eventType: EMAIL_NOTIFICATION_EVENT_PAYMENT_CANCELLED,
    });
  }

  private async handleIgnoredRefundWebhook(
    event: PaymentWebhookParsedEvent,
  ): Promise<PaymentWebhookHandlingResult> {
    const references = resolveWebhookProviderReferences(event);

    PaymentSecurityPolicy.assertReferencePresent(references);

    const payment =
      await this.paymentRepository.findPaymentByReferences(references);

    if (!payment) {
      return {
        accepted: true,
        ignored: true,
        payment_id: null,
        status: null,
      };
    }

    await this.createPaymentTransaction({
      payment_id: payment.id,
      transaction_type: PAYMENT_TRANSACTION_TYPE_WEBHOOK_RECEIVED,
      transaction_status: PAYMENT_TRANSACTION_STATUS_IGNORED,
      provider: event.provider,
      provider_reference: event.provider_reference,
      gateway_response: {
        target: buildPaymentTargetAuditPayload(payment),
        event_id: event.event_id,
        event_type: event.event_type,
        provider_status: event.status,
        failure_code: PAYMENT_WEBHOOK_REFUND_EVENT_IGNORED_CODE,
        failure_message:
          'Provider refund webhook was ignored because refunds are controlled by the admin refund flow.',
        raw_payload: event.raw_payload,
      },
      metadata: {
        source: 'webhook',
      },
    });

    return {
      accepted: true,
      ignored: true,
      payment_id: payment.id,
      status: payment.status,
    };
  }

  private async verifyAndApplyProviderStatus(
    input: PaymentVerificationApplicationInput,
  ): Promise<PaymentVerificationApplicationResult> {
    let payment = await this.getPaymentOrThrow(input.payment.id);

    if (shouldReturnCurrentSettlementState(payment)) {
      await this.createPaymentTransaction({
        payment_id: payment.id,
        transaction_type: PAYMENT_TRANSACTION_TYPE_STATUS_CHANGE,
        transaction_status: PAYMENT_TRANSACTION_STATUS_IGNORED,
        provider: payment.payment_provider,
        provider_reference: payment.gateway_reference,
        gateway_response: {
          source: input.source,
          target: buildPaymentTargetAuditPayload(payment),
          reason: PAYMENT_EVENT_ALREADY_SETTLED_CODE,
          current_status: payment.status,
        },
        metadata: {
          source: input.source,
        },
      });

      return {
        payment,
        ignored: true,
        provider_status: this.mapCurrentPaymentStatusToProviderStatus(payment),
        reason: PAYMENT_EVENT_ALREADY_SETTLED_CODE,
      };
    }

    let verification: PaymentGatewayVerifyPaymentResult;

    try {
      verification = await this.paymentGatewayService.verifyPayment({
        payment,
        provider_reference:
          input.references.provider_reference ?? payment.gateway_reference,
        gateway_payment_id:
          input.references.gateway_payment_id ?? payment.gateway_payment_id,
        gateway_invoice_id:
          input.references.gateway_invoice_id ?? payment.gateway_invoice_id,
      });
    } catch (error) {
      await this.createPaymentTransaction({
        payment_id: payment.id,
        transaction_type: PAYMENT_TRANSACTION_TYPE_VERIFICATION,
        transaction_status: PAYMENT_TRANSACTION_STATUS_FAILED,
        provider: payment.payment_provider,
        provider_reference:
          input.references.provider_reference ?? payment.gateway_reference,
        gateway_request: {
          source: input.source,
          target: buildPaymentTargetAuditPayload(payment),
          payment_id: payment.id,
          provider_reference: input.references.provider_reference ?? null,
          gateway_payment_id: input.references.gateway_payment_id ?? null,
          gateway_invoice_id: input.references.gateway_invoice_id ?? null,
        },
        gateway_response: {
          source: input.source,
          target: buildPaymentTargetAuditPayload(payment),
          verification_failed: true,
        },
        failure_code: PAYMENT_VERIFICATION_FAILED_CODE,
        failure_message: safeFailureMessage(error),
        metadata: {
          source: input.source,
        },
      });

      if (input.swallow_provider_errors) {
        return {
          payment,
          ignored: false,
          provider_status: 'unknown',
          reason: PAYMENT_VERIFICATION_FAILED_CODE,
        };
      }

      throw error;
    }

    await this.createPaymentTransaction({
      payment_id: payment.id,
      transaction_type: PAYMENT_TRANSACTION_TYPE_VERIFICATION,
      transaction_status: resolveVerificationTransactionStatus(
        verification.status,
      ),
      provider: verification.provider,
      provider_reference: verification.provider_reference,
      gateway_request: {
        source: input.source,
        target: buildPaymentTargetAuditPayload(payment),
        payment_id: payment.id,
        provider_reference: input.references.provider_reference ?? null,
        gateway_payment_id: input.references.gateway_payment_id ?? null,
        gateway_invoice_id: input.references.gateway_invoice_id ?? null,
      },
      gateway_response: buildProviderVerificationPayload({
        payment,
        source: input.source,
        result: verification,
        raw_payload: input.raw_payload,
      }),
      failure_code: verification.failure_code,
      failure_message: verification.failure_message,
      metadata: {
        source: input.source,
      },
    });

    payment = await this.persistGatewayReferences(payment, verification);

    const decision = PaymentLifecyclePolicy.resolveProviderVerificationDecision(
      {
        payment,
        provider_status: verification.status,
        failure_code: verification.failure_code,
        failure_message: verification.failure_message,
      },
    );

    if (!decision.should_mutate || decision.next_status === null) {
      await this.createPaymentTransaction({
        payment_id: payment.id,
        transaction_type: PAYMENT_TRANSACTION_TYPE_STATUS_CHANGE,
        transaction_status: resolveStatusChangeTransactionStatus(
          decision.ignored,
        ),
        provider: verification.provider,
        provider_reference: verification.provider_reference,
        gateway_response: {
          source: input.source,
          target: buildPaymentTargetAuditPayload(payment),
          provider_status: verification.status,
          current_status: payment.status,
          next_status: decision.next_status,
          ignored: decision.ignored,
          reason: decision.reason,
        },
        metadata: {
          source: input.source,
        },
      });

      return {
        payment,
        ignored: decision.ignored,
        provider_status: verification.status,
        reason: decision.reason,
      };
    }

    const updatedPayment = await this.applyPaymentStatusMutation({
      payment,
      next_status: decision.next_status,
      verification,
      webhook_verified: input.webhook_verified,
      source: input.source,
      raw_payload: input.raw_payload,
    });

    return {
      payment: updatedPayment,
      ignored: false,
      provider_status: verification.status,
      reason: decision.reason,
    };
  }

  private async applyPaymentStatusMutation(input: {
    readonly payment: PaymentRecord;
    readonly next_status: PaymentStatus;
    readonly verification: PaymentGatewayVerifyPaymentResult;
    readonly webhook_verified: boolean;
    readonly source: PaymentVerificationApplicationInput['source'];
    readonly raw_payload: DatabaseJsonObject;
  }): Promise<PaymentRecord> {
    if (input.next_status === PAYMENT_STATUS_PAID) {
      PaymentLifecyclePolicy.assertCanMarkPaid(input.payment);

      await this.paymentRepository.markPaymentPaidAtomic({
        payment_id: input.payment.id,
        provider_reference:
          input.verification.provider_reference ??
          input.payment.gateway_reference,
        gateway_payment_id:
          input.verification.gateway_payment_id ??
          input.payment.gateway_payment_id,
        gateway_invoice_id:
          input.verification.gateway_invoice_id ??
          input.payment.gateway_invoice_id,
        gateway_response: buildProviderVerificationPayload({
          payment: input.payment,
          source: input.source,
          result: input.verification,
          raw_payload: input.raw_payload,
        }),
        webhook_verified: input.webhook_verified,
      });

      const updatedPayment = await this.getPaymentOrThrow(input.payment.id);

      await this.createStatusChangeTransaction({
        payment: updatedPayment,
        previous_status: input.payment.status,
        next_status: PAYMENT_STATUS_PAID,
        verification: input.verification,
        source: input.source,
      });

      await this.notifyPaymentSuccessReceipt(updatedPayment);

      return updatedPayment;
    }

    if (input.next_status === PAYMENT_STATUS_FAILED) {
      PaymentLifecyclePolicy.assertCanMarkFailed(input.payment);

      await this.paymentRepository.markPaymentFailedAtomic({
        payment_id: input.payment.id,
        failure_code: input.verification.failure_code,
        failure_message: input.verification.failure_message,
        gateway_response: buildProviderVerificationPayload({
          payment: input.payment,
          source: input.source,
          result: input.verification,
          raw_payload: input.raw_payload,
        }),
      });

      const updatedPayment = await this.getPaymentOrThrow(input.payment.id);

      await this.createStatusChangeTransaction({
        payment: updatedPayment,
        previous_status: input.payment.status,
        next_status: PAYMENT_STATUS_FAILED,
        verification: input.verification,
        source: input.source,
      });

      await this.notifyPaymentFailed(updatedPayment);

      return updatedPayment;
    }

    if (input.next_status === PAYMENT_STATUS_CANCELLED) {
      PaymentLifecyclePolicy.assertCanMarkCancelled(input.payment);

      await this.paymentRepository.markPaymentCancelledAtomic({
        payment_id: input.payment.id,
        reason:
          input.verification.failure_message ??
          input.verification.failure_code ??
          'Payment was cancelled by provider.',
        gateway_response: buildProviderVerificationPayload({
          payment: input.payment,
          source: input.source,
          result: input.verification,
          raw_payload: input.raw_payload,
        }),
      });

      const updatedPayment = await this.getPaymentOrThrow(input.payment.id);

      await this.createStatusChangeTransaction({
        payment: updatedPayment,
        previous_status: input.payment.status,
        next_status: PAYMENT_STATUS_CANCELLED,
        verification: input.verification,
        source: input.source,
      });

      await this.notifyPaymentCancelled(updatedPayment);

      return updatedPayment;
    }

    if (input.next_status === PAYMENT_STATUS_PROCESSING) {
      PaymentLifecyclePolicy.assertTransitionAllowed({
        current_status: input.payment.status,
        next_status: PAYMENT_STATUS_PROCESSING,
      });

      const updatedPayment = await this.paymentRepository.updatePayment(
        input.payment.id,
        {
          status: PAYMENT_STATUS_PROCESSING,
          gateway_reference:
            input.verification.provider_reference ??
            input.payment.gateway_reference,
          gateway_payment_id:
            input.verification.gateway_payment_id ??
            input.payment.gateway_payment_id,
          gateway_invoice_id:
            input.verification.gateway_invoice_id ??
            input.payment.gateway_invoice_id,
        },
      );

      await this.createStatusChangeTransaction({
        payment: updatedPayment,
        previous_status: input.payment.status,
        next_status: PAYMENT_STATUS_PROCESSING,
        verification: input.verification,
        source: input.source,
      });

      return updatedPayment;
    }

    throw AppError.paymentProviderVerificationFailed({
      message: 'Unsupported provider verification status mutation.',
      payment_id: input.payment.id,
      current_status: input.payment.status,
      next_status: input.next_status,
      provider_status: input.verification.status,
    });
  }

  private async persistGatewayReferences(
    payment: PaymentRecord,
    verification: PaymentGatewayVerifyPaymentResult,
  ): Promise<PaymentRecord> {
    const patch: PaymentUpdateRecord = {};

    if (
      !hasText(payment.gateway_reference) &&
      hasText(verification.provider_reference)
    ) {
      patch.gateway_reference = verification.provider_reference;
    }

    if (
      !hasText(payment.gateway_payment_id) &&
      hasText(verification.gateway_payment_id)
    ) {
      patch.gateway_payment_id = verification.gateway_payment_id;
    }

    if (
      !hasText(payment.gateway_invoice_id) &&
      hasText(verification.gateway_invoice_id)
    ) {
      patch.gateway_invoice_id = verification.gateway_invoice_id;
    }

    if (Object.keys(patch).length === 0) {
      return payment;
    }

    return this.paymentRepository.updatePayment(payment.id, patch);
  }

  private async createStatusChangeTransaction(input: {
    readonly payment: PaymentRecord;
    readonly previous_status: PaymentStatus;
    readonly next_status: PaymentStatus;
    readonly verification: PaymentGatewayVerifyPaymentResult;
    readonly source: PaymentVerificationApplicationInput['source'];
  }): Promise<void> {
    await this.createPaymentTransaction({
      payment_id: input.payment.id,
      transaction_type: PAYMENT_TRANSACTION_TYPE_STATUS_CHANGE,
      transaction_status: PAYMENT_TRANSACTION_STATUS_SUCCEEDED,
      provider: input.verification.provider,
      provider_reference: input.verification.provider_reference,
      gateway_response: {
        source: input.source,
        target: buildPaymentTargetAuditPayload(input.payment),
        previous_status: input.previous_status,
        next_status: input.next_status,
        provider_status: input.verification.status,
        provider_reference: input.verification.provider_reference,
        gateway_payment_id: input.verification.gateway_payment_id,
        gateway_invoice_id: input.verification.gateway_invoice_id,
      },
      metadata: {
        source: input.source,
      },
    });
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

  private async getPaymentOrThrow(paymentId: string): Promise<PaymentRecord> {
    const payment = await this.paymentRepository.findPaymentById(paymentId);

    if (!payment) {
      throw AppError.paymentNotFound('The requested payment was not found.', {
        payment_id: paymentId,
      });
    }

    return payment;
  }

  private mapCurrentPaymentStatusToProviderStatus(
    payment: PaymentRecord,
  ): PaymentProviderVerificationStatus {
    if (payment.status === PAYMENT_STATUS_PAID) {
      return 'paid';
    }

    if (payment.status === PAYMENT_STATUS_FAILED) {
      return 'failed';
    }

    if (payment.status === PAYMENT_STATUS_CANCELLED) {
      return 'cancelled';
    }

    if (payment.status === PAYMENT_STATUS_PROCESSING) {
      return 'pending';
    }

    return 'unknown';
  }
}
