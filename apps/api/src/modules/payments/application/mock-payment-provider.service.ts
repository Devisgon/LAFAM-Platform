// apps/api/src/modules/payments/application/mock-payment-provider.service.ts
/**
 * LAFAM mock payment provider adapter.
 *
 * Role:
 * - Provides a safe local-development payment gateway implementation.
 * - Simulates hosted redirect payment creation.
 * - Simulates provider verification.
 * - Simulates refunds.
 * - Parses mock webhook payloads into normalized PaymentWebhookParsedEvent objects.
 *
 * Important:
 * - This file does not talk to KNET, Tap, MyFatoorah, or Checkout.com.
 * - This file does not collect, store, or process card data.
 * - This file must not be used to claim live settlement.
 * - This file exists so backend Payment flow can be developed without live KNET credentials.
 * - Business services must still use lifecycle policy, idempotency checks, ownership checks, and atomic database RPCs.
 */

import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import type {
  DatabaseJson,
  DatabaseJsonObject,
} from '../../../database/database.types';
import {
  MOCK_PAYMENT_REFERENCE_PREFIX,
  PAYMENT_CHECKOUT_INTENT_TTL_MINUTES,
  PAYMENT_CALLBACK_RESULT_CANCELLED,
  PAYMENT_CALLBACK_RESULT_FAILED,
  PAYMENT_CALLBACK_RESULT_SUCCESS,
  PAYMENT_PROVIDER_MOCK,
  PAYMENT_TARGET_TYPE_WALLET_TOP_UP,
  PAYMENT_WALLET_TOP_UP_INTENT_TTL_MINUTES,
  PAYMENT_WEBHOOK_EVENT_PAYMENT_CANCELLED,
  PAYMENT_WEBHOOK_EVENT_PAYMENT_FAILED,
  PAYMENT_WEBHOOK_EVENT_PAYMENT_REFUNDED,
  PAYMENT_WEBHOOK_EVENT_PAYMENT_SUCCEEDED,
  PAYMENT_WEBHOOK_EVENTS,
  type PaymentWebhookEvent,
} from '../constants/payment.constants';
import type {
  PaymentGatewayCreateHostedPaymentInput,
  PaymentGatewayCreateHostedPaymentResult,
  PaymentGatewayRefundInput,
  PaymentGatewayRefundResult,
  PaymentGatewayVerifyPaymentInput,
  PaymentGatewayVerifyPaymentResult,
  PaymentProviderVerificationStatus,
  PaymentWebhookInput,
  PaymentWebhookParsedEvent,
} from '../types/payment.types';
import type { PaymentGatewayProviderAdapter } from './payment-gateway.service';

const MOCK_PAYMENT_STATUS_PAID = 'paid';
const MOCK_PAYMENT_STATUS_FAILED = 'failed';
const MOCK_PAYMENT_STATUS_CANCELLED = 'cancelled';
const MOCK_PAYMENT_STATUS_PENDING = 'pending';
const MOCK_PAYMENT_STATUS_REFUNDED = 'refunded';

const MOCK_STATUS_PAID_VALUES = new Set([
  MOCK_PAYMENT_STATUS_PAID,
  'success',
  'successful',
  'succeeded',
  'approved',
  'captured',
]);

const MOCK_STATUS_FAILED_VALUES = new Set([
  MOCK_PAYMENT_STATUS_FAILED,
  'failure',
  'declined',
  'denied',
  'rejected',
  'error',
]);

const MOCK_STATUS_CANCELLED_VALUES = new Set([
  MOCK_PAYMENT_STATUS_CANCELLED,
  'canceled',
  'voided',
  'aborted',
]);

const MOCK_STATUS_PENDING_VALUES = new Set([
  MOCK_PAYMENT_STATUS_PENDING,
  'processing',
  'requires_redirect',
  'requires_action',
]);

const MOCK_STATUS_REFUNDED_VALUES = new Set([
  MOCK_PAYMENT_STATUS_REFUNDED,
  'refund_completed',
  'refund_succeeded',
]);

const PAYMENT_WEBHOOK_EVENT_SET = new Set<PaymentWebhookEvent>(
  PAYMENT_WEBHOOK_EVENTS,
);

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeStatus(value: string | null): string | null {
  return hasText(value) ? value.trim().toLowerCase() : null;
}

function getJsonValue(
  payload: DatabaseJsonObject,
  key: string,
): DatabaseJson | undefined {
  return payload[key];
}

function getStringValue(
  payload: DatabaseJsonObject,
  key: string,
): string | null {
  const value = getJsonValue(payload, key);

  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function getNestedObject(
  payload: DatabaseJsonObject,
  key: string,
): DatabaseJsonObject | null {
  const value = getJsonValue(payload, key);

  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value
    : null;
}

function getStringFromPayloadPaths(
  payload: DatabaseJsonObject,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const directValue = getStringValue(payload, key);

    if (directValue !== null) {
      return directValue;
    }
  }

  const paymentObject = getNestedObject(payload, 'payment');

  if (paymentObject !== null) {
    for (const key of keys) {
      const nestedValue = getStringValue(paymentObject, key);

      if (nestedValue !== null) {
        return nestedValue;
      }
    }
  }

  const dataObject = getNestedObject(payload, 'data');

  if (dataObject !== null) {
    for (const key of keys) {
      const nestedValue = getStringValue(dataObject, key);

      if (nestedValue !== null) {
        return nestedValue;
      }
    }
  }

  return null;
}

function createMockReference(paymentId: string, label: string): string {
  return `${MOCK_PAYMENT_REFERENCE_PREFIX}_${label}_${paymentId}_${randomUUID()}`;
}

function createMockGatewayPaymentId(paymentId: string): string {
  return `mock_gateway_payment_${paymentId}_${randomUUID()}`;
}

function createMockGatewayInvoiceId(paymentId: string): string {
  return `mock_gateway_invoice_${paymentId}_${randomUUID()}`;
}

function resolveIntentTtlMinutes(
  input: PaymentGatewayCreateHostedPaymentInput,
): number {
  return input.target_type === PAYMENT_TARGET_TYPE_WALLET_TOP_UP
    ? PAYMENT_WALLET_TOP_UP_INTENT_TTL_MINUTES
    : PAYMENT_CHECKOUT_INTENT_TTL_MINUTES;
}

function resolveExpiresAt(
  input: PaymentGatewayCreateHostedPaymentInput,
): string {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + resolveIntentTtlMinutes(input));

  return expiresAt.toISOString();
}

function appendQueryParams(
  url: string,
  params: Record<string, string>,
): string {
  try {
    const parsedUrl = new URL(url);

    for (const [key, value] of Object.entries(params)) {
      parsedUrl.searchParams.set(key, value);
    }

    return parsedUrl.toString();
  } catch {
    throw AppError.invalidRequest('Mock payment callback URL is invalid.', {
      callback_url: url,
    });
  }
}

function buildMockRedirectUrl(input: {
  readonly callback_url: string;
  readonly payment_id: string;
  readonly provider_reference: string;
  readonly gateway_payment_id: string;
  readonly gateway_invoice_id: string;
}): string {
  return appendQueryParams(input.callback_url, {
    payment_id: input.payment_id,
    provider_reference: input.provider_reference,
    gateway_payment_id: input.gateway_payment_id,
    gateway_invoice_id: input.gateway_invoice_id,
    result: PAYMENT_CALLBACK_RESULT_SUCCESS,
  });
}

function resolveVerificationStatusFromText(
  status: string | null,
): PaymentProviderVerificationStatus {
  const normalizedStatus = normalizeStatus(status);

  if (normalizedStatus === null) {
    return 'unknown';
  }

  if (MOCK_STATUS_PAID_VALUES.has(normalizedStatus)) {
    return 'paid';
  }

  if (MOCK_STATUS_FAILED_VALUES.has(normalizedStatus)) {
    return 'failed';
  }

  if (MOCK_STATUS_CANCELLED_VALUES.has(normalizedStatus)) {
    return 'cancelled';
  }

  if (MOCK_STATUS_PENDING_VALUES.has(normalizedStatus)) {
    return 'pending';
  }

  if (MOCK_STATUS_REFUNDED_VALUES.has(normalizedStatus)) {
    return 'paid';
  }

  return 'unknown';
}

function resolveVerificationStatusFromReference(
  reference: string | null,
): PaymentProviderVerificationStatus {
  const normalizedReference = normalizeStatus(reference);

  if (normalizedReference === null) {
    return 'paid';
  }

  if (normalizedReference.includes(MOCK_PAYMENT_STATUS_FAILED)) {
    return 'failed';
  }

  if (
    normalizedReference.includes(MOCK_PAYMENT_STATUS_CANCELLED) ||
    normalizedReference.includes('canceled')
  ) {
    return 'cancelled';
  }

  if (normalizedReference.includes(MOCK_PAYMENT_STATUS_PENDING)) {
    return 'pending';
  }

  return 'paid';
}

function resolveGatewayReference(input: PaymentGatewayVerifyPaymentInput): {
  readonly provider_reference: string | null;
  readonly gateway_payment_id: string | null;
  readonly gateway_invoice_id: string | null;
} {
  return {
    provider_reference:
      input.provider_reference ?? input.payment.gateway_reference,
    gateway_payment_id:
      input.gateway_payment_id ?? input.payment.gateway_payment_id,
    gateway_invoice_id:
      input.gateway_invoice_id ?? input.payment.gateway_invoice_id,
  };
}

function resolveWebhookEventFromStatus(
  payload: DatabaseJsonObject,
  status: PaymentProviderVerificationStatus,
): PaymentWebhookEvent {
  const rawEventType = getStringFromPayloadPaths(payload, [
    'event_type',
    'type',
    'event',
  ]);

  if (
    rawEventType !== null &&
    PAYMENT_WEBHOOK_EVENT_SET.has(rawEventType as PaymentWebhookEvent)
  ) {
    return rawEventType as PaymentWebhookEvent;
  }

  const rawStatus = normalizeStatus(
    getStringFromPayloadPaths(payload, [
      'status',
      'payment_status',
      'result',
      'transaction_status',
    ]),
  );

  if (rawStatus !== null && MOCK_STATUS_REFUNDED_VALUES.has(rawStatus)) {
    return PAYMENT_WEBHOOK_EVENT_PAYMENT_REFUNDED;
  }

  if (status === 'paid') {
    return PAYMENT_WEBHOOK_EVENT_PAYMENT_SUCCEEDED;
  }

  if (status === 'failed') {
    return PAYMENT_WEBHOOK_EVENT_PAYMENT_FAILED;
  }

  if (status === 'cancelled') {
    return PAYMENT_WEBHOOK_EVENT_PAYMENT_CANCELLED;
  }

  throw AppError.paymentWebhookInvalid(
    'Mock webhook event type could not be resolved.',
    {
      provider: PAYMENT_PROVIDER_MOCK,
      raw_event_type: rawEventType,
      raw_status: rawStatus,
      normalized_status: status,
    },
  );
}

function resolveWebhookStatus(
  payload: DatabaseJsonObject,
): PaymentProviderVerificationStatus {
  const callbackResult = getStringFromPayloadPaths(payload, [
    'result',
    'callback_result',
  ]);

  if (callbackResult === PAYMENT_CALLBACK_RESULT_SUCCESS) {
    return 'paid';
  }

  if (callbackResult === PAYMENT_CALLBACK_RESULT_FAILED) {
    return 'failed';
  }

  if (callbackResult === PAYMENT_CALLBACK_RESULT_CANCELLED) {
    return 'cancelled';
  }

  return resolveVerificationStatusFromText(
    getStringFromPayloadPaths(payload, [
      'status',
      'payment_status',
      'transaction_status',
    ]),
  );
}

function createRawCreateHostedPaymentResponse(input: {
  readonly provider_reference: string;
  readonly gateway_payment_id: string;
  readonly gateway_invoice_id: string;
  readonly redirect_url: string;
  readonly expires_at: string;
  readonly payment: PaymentGatewayCreateHostedPaymentInput;
}): DatabaseJsonObject {
  return {
    provider: PAYMENT_PROVIDER_MOCK,
    operation: 'create_hosted_payment',
    provider_reference: input.provider_reference,
    gateway_payment_id: input.gateway_payment_id,
    gateway_invoice_id: input.gateway_invoice_id,
    redirect_url: input.redirect_url,
    expires_at: input.expires_at,
    payment_id: input.payment.payment_id,
    payment_number: input.payment.payment_number,
    user_id: input.payment.user_id,
    amount: input.payment.amount,
    currency: input.payment.currency,
    payment_method: input.payment.payment_method,
    target_type: input.payment.target_type,
    booking_id: input.payment.booking_id,
    private_booking_id: input.payment.private_booking_id,
    callback_url: input.payment.callback_url,
    webhook_url: input.payment.webhook_url,
    frontend_success_url: input.payment.frontend_success_url,
    frontend_failure_url: input.payment.frontend_failure_url,
    idempotency_key: input.payment.idempotency_key,
  };
}

@Injectable()
export class MockPaymentProviderService implements PaymentGatewayProviderAdapter {
  readonly provider = PAYMENT_PROVIDER_MOCK;

  createHostedPayment(
    input: PaymentGatewayCreateHostedPaymentInput,
  ): Promise<PaymentGatewayCreateHostedPaymentResult> {
    const providerReference = createMockReference(input.payment_id, 'intent');
    const gatewayPaymentId = createMockGatewayPaymentId(input.payment_id);
    const gatewayInvoiceId = createMockGatewayInvoiceId(input.payment_id);
    const expiresAt = resolveExpiresAt(input);
    const redirectUrl = buildMockRedirectUrl({
      callback_url: input.callback_url,
      payment_id: input.payment_id,
      provider_reference: providerReference,
      gateway_payment_id: gatewayPaymentId,
      gateway_invoice_id: gatewayInvoiceId,
    });

    return Promise.resolve({
      provider: PAYMENT_PROVIDER_MOCK,
      provider_reference: providerReference,
      gateway_payment_id: gatewayPaymentId,
      gateway_invoice_id: gatewayInvoiceId,
      redirect_url: redirectUrl,
      expires_at: expiresAt,
      raw_response: createRawCreateHostedPaymentResponse({
        provider_reference: providerReference,
        gateway_payment_id: gatewayPaymentId,
        gateway_invoice_id: gatewayInvoiceId,
        redirect_url: redirectUrl,
        expires_at: expiresAt,
        payment: input,
      }),
    });
  }

  verifyPayment(
    input: PaymentGatewayVerifyPaymentInput,
  ): Promise<PaymentGatewayVerifyPaymentResult> {
    const references = resolveGatewayReference(input);
    const status = resolveVerificationStatusFromReference(
      references.provider_reference ??
        references.gateway_payment_id ??
        references.gateway_invoice_id,
    );

    return Promise.resolve({
      provider: PAYMENT_PROVIDER_MOCK,
      provider_reference: references.provider_reference,
      gateway_payment_id: references.gateway_payment_id,
      gateway_invoice_id: references.gateway_invoice_id,
      status,
      failure_code: status === 'failed' ? 'MOCK_PAYMENT_FAILED' : null,
      failure_message:
        status === 'failed'
          ? 'Mock provider simulated a failed payment.'
          : null,
      raw_response: {
        provider: PAYMENT_PROVIDER_MOCK,
        operation: 'verify_payment',
        payment_id: input.payment.id,
        payment_number: input.payment.payment_number,
        provider_reference: references.provider_reference,
        gateway_payment_id: references.gateway_payment_id,
        gateway_invoice_id: references.gateway_invoice_id,
        status,
      },
    });
  }

  refundPayment(
    input: PaymentGatewayRefundInput,
  ): Promise<PaymentGatewayRefundResult> {
    return Promise.resolve({
      provider: PAYMENT_PROVIDER_MOCK,
      provider_reference:
        input.payment.gateway_reference ??
        createMockReference(input.payment.id, 'refund'),
      status: 'refunded',
      refunded_amount: input.amount,
      failure_code: null,
      failure_message: null,
      raw_response: {
        provider: PAYMENT_PROVIDER_MOCK,
        operation: 'refund_payment',
        payment_id: input.payment.id,
        payment_number: input.payment.payment_number,
        provider_reference: input.payment.gateway_reference,
        requested_refund_amount: input.amount,
        refunded_amount: input.amount,
        currency: input.currency,
        reason: input.reason,
        idempotency_key: input.idempotency_key,
        status: 'refunded',
        metadata: input.metadata,
      },
    });
  }

  verifyWebhookSignature(input: PaymentWebhookInput): Promise<boolean> {
    return Promise.resolve(input.provider === PAYMENT_PROVIDER_MOCK);
  }

  parseWebhook(input: PaymentWebhookInput): Promise<PaymentWebhookParsedEvent> {
    const providerReference = getStringFromPayloadPaths(input.payload, [
      'provider_reference',
      'gateway_reference',
      'transaction_reference',
      'reference_id',
    ]);

    const gatewayPaymentId = getStringFromPayloadPaths(input.payload, [
      'gateway_payment_id',
      'payment_id',
      'paymentId',
      'transaction_id',
      'transactionId',
    ]);

    const gatewayInvoiceId = getStringFromPayloadPaths(input.payload, [
      'gateway_invoice_id',
      'invoice_id',
      'invoiceId',
    ]);

    const paymentId = getStringFromPayloadPaths(input.payload, [
      'lafam_payment_id',
      'payment_id_local',
      'local_payment_id',
      'payment_id',
    ]);

    const status = resolveWebhookStatus(input.payload);
    const eventType = resolveWebhookEventFromStatus(input.payload, status);

    return Promise.resolve({
      provider: PAYMENT_PROVIDER_MOCK,
      event_id:
        input.headers.event_id ??
        getStringFromPayloadPaths(input.payload, [
          'event_id',
          'eventId',
          'webhook_id',
          'webhookId',
        ]) ??
        `mock_event_${randomUUID()}`,
      event_type: eventType,
      payment_id: paymentId,
      provider_reference: providerReference,
      gateway_payment_id: gatewayPaymentId,
      gateway_invoice_id: gatewayInvoiceId,
      status,
      failure_code: getStringFromPayloadPaths(input.payload, [
        'failure_code',
        'error_code',
        'response_code',
        'code',
      ]),
      failure_message: getStringFromPayloadPaths(input.payload, [
        'failure_message',
        'error_message',
        'response_message',
        'message',
      ]),
      occurred_at:
        getStringFromPayloadPaths(input.payload, [
          'occurred_at',
          'created_at',
          'timestamp',
          'event_time',
        ]) ?? new Date().toISOString(),
      raw_payload: input.payload,
    });
  }
}
