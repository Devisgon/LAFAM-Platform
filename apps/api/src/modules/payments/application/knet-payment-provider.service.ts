// apps/api/src/modules/payments/application/knet-payment-provider.service.ts
/**
 * LAFAM KNET payment provider adapter.
 *
 * Role:
 * - Implements the PaymentGatewayProviderAdapter contract for the KNET provider boundary.
 * - Keeps direct KNET/provider-specific behavior outside checkout/callback/refund services.
 * - Provides safe webhook signature verification helpers.
 * - Parses provider payloads into normalized PaymentWebhookParsedEvent objects.
 *
 * Important:
 * - This file does not collect, store, or process raw card data.
 * - This file does not fake successful KNET settlement.
 * - This file does not invent a direct KNET API contract.
 * - Hosted payment creation and live payment verification require the selected real provider contract.
 * - Local development should use MockPaymentProvider until real provider API documentation is available.
 * - Business services must continue to treat webhook/callback data as untrusted until verified.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { currentPaymentConfig } from '../../../common/config';
import { AppError } from '../../../common/errors/app-error';
import type {
  DatabaseJson,
  DatabaseJsonObject,
} from '../../../database/database.types';
import {
  PAYMENT_PROVIDER_KNET,
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

const KNET_SIGNATURE_PREFIX = 'sha256=';
const KNET_HMAC_ALGORITHM = 'sha256';

const KNET_PAID_STATUSES = new Set([
  'paid',
  'success',
  'successful',
  'succeeded',
  'captured',
  'approved',
  'authorized',
]);

const KNET_FAILED_STATUSES = new Set([
  'failed',
  'failure',
  'declined',
  'denied',
  'error',
  'rejected',
]);

const KNET_CANCELLED_STATUSES = new Set([
  'cancelled',
  'canceled',
  'voided',
  'aborted',
]);

const KNET_PENDING_STATUSES = new Set([
  'pending',
  'processing',
  'requires_redirect',
  'requires_action',
  'initiated',
]);

const KNET_REFUNDED_STATUSES = new Set([
  'refunded',
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

function normalizeProviderReference(value: string | null): string | null {
  return hasText(value) ? value.trim() : null;
}

function normalizeSignature(signature: string): string {
  const trimmedSignature = signature.trim();

  return trimmedSignature.startsWith(KNET_SIGNATURE_PREFIX)
    ? trimmedSignature.slice(KNET_SIGNATURE_PREFIX.length)
    : trimmedSignature;
}

function createExpectedSignature(input: {
  readonly rawBody: string;
  readonly webhookSecret: string;
  readonly timestamp: string | null;
}): string {
  const signedPayload = hasText(input.timestamp)
    ? `${input.timestamp}.${input.rawBody}`
    : input.rawBody;

  return createHmac(KNET_HMAC_ALGORITHM, input.webhookSecret)
    .update(signedPayload)
    .digest('hex');
}

function signaturesMatch(
  expectedSignature: string,
  receivedSignature: string,
): boolean {
  const normalizedExpectedSignature = normalizeSignature(expectedSignature);
  const normalizedReceivedSignature = normalizeSignature(receivedSignature);

  const expectedBuffer = Buffer.from(normalizedExpectedSignature, 'hex');
  const receivedBuffer = Buffer.from(normalizedReceivedSignature, 'hex');

  if (expectedBuffer.length === 0 || receivedBuffer.length === 0) {
    return false;
  }

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

function resolveVerificationStatusFromText(
  status: string | null,
): PaymentProviderVerificationStatus {
  const normalizedStatus = normalizeStatus(status);

  if (normalizedStatus === null) {
    return 'unknown';
  }

  if (KNET_PAID_STATUSES.has(normalizedStatus)) {
    return 'paid';
  }

  if (KNET_FAILED_STATUSES.has(normalizedStatus)) {
    return 'failed';
  }

  if (KNET_CANCELLED_STATUSES.has(normalizedStatus)) {
    return 'cancelled';
  }

  if (KNET_PENDING_STATUSES.has(normalizedStatus)) {
    return 'pending';
  }

  if (KNET_REFUNDED_STATUSES.has(normalizedStatus)) {
    return 'paid';
  }

  return 'unknown';
}

function resolveWebhookEventFromPayload(
  payload: DatabaseJsonObject,
  status: PaymentProviderVerificationStatus,
): PaymentWebhookEvent {
  const eventType = getStringFromPayloadPaths(payload, [
    'event_type',
    'type',
    'event',
  ]);

  if (
    eventType !== null &&
    PAYMENT_WEBHOOK_EVENT_SET.has(eventType as PaymentWebhookEvent)
  ) {
    return eventType as PaymentWebhookEvent;
  }

  const rawStatus = normalizeStatus(
    getStringFromPayloadPaths(payload, [
      'status',
      'payment_status',
      'result',
      'transaction_status',
    ]),
  );

  if (rawStatus !== null && KNET_REFUNDED_STATUSES.has(rawStatus)) {
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
    'KNET webhook event type could not be resolved.',
    {
      provider: PAYMENT_PROVIDER_KNET,
      raw_event_type: eventType,
      raw_status: rawStatus,
      normalized_status: status,
    },
  );
}

function resolveGatewayReference(input: PaymentGatewayVerifyPaymentInput): {
  readonly provider_reference: string | null;
  readonly gateway_payment_id: string | null;
  readonly gateway_invoice_id: string | null;
} {
  return {
    provider_reference:
      normalizeProviderReference(input.provider_reference ?? null) ??
      normalizeProviderReference(input.payment.gateway_reference),
    gateway_payment_id:
      normalizeProviderReference(input.gateway_payment_id ?? null) ??
      normalizeProviderReference(input.payment.gateway_payment_id),
    gateway_invoice_id:
      normalizeProviderReference(input.gateway_invoice_id ?? null) ??
      normalizeProviderReference(input.payment.gateway_invoice_id),
  };
}

function createUnavailableCause(operation: string): Record<string, unknown> {
  return {
    provider: PAYMENT_PROVIDER_KNET,
    operation,
    reason:
      'Direct KNET live API contract is not implemented in this adapter yet. Use the mock provider for local development or add the selected PSP/direct-KNET contract before enabling live KNET.',
  };
}

function assertKnetProviderConfigured(operation: string): void {
  if (currentPaymentConfig.knet.isConfigured) {
    return;
  }

  throw AppError.paymentProviderUnavailable({
    provider: PAYMENT_PROVIDER_KNET,
    operation,
    reason:
      'KNET provider is not fully configured. Merchant id, secret key, webhook secret, and active API base URL are required outside mock mode.',
  });
}

@Injectable()
export class KnetPaymentProviderService implements PaymentGatewayProviderAdapter {
  readonly provider = PAYMENT_PROVIDER_KNET;

  createHostedPayment(
    input: PaymentGatewayCreateHostedPaymentInput,
  ): Promise<PaymentGatewayCreateHostedPaymentResult> {
    assertKnetProviderConfigured('create_hosted_payment');

    throw AppError.paymentProviderUnavailable({
      ...createUnavailableCause('create_hosted_payment'),
      payment_id: input.payment_id,
      payment_number: input.payment_number,
      amount: input.amount,
      currency: input.currency,
      payment_method: input.payment_method,
      callback_url: input.callback_url,
      webhook_url: input.webhook_url,
    });
  }

  verifyPayment(
    input: PaymentGatewayVerifyPaymentInput,
  ): Promise<PaymentGatewayVerifyPaymentResult> {
    assertKnetProviderConfigured('verify_payment');

    const references = resolveGatewayReference(input);

    return Promise.resolve({
      provider: PAYMENT_PROVIDER_KNET,
      provider_reference: references.provider_reference,
      gateway_payment_id: references.gateway_payment_id,
      gateway_invoice_id: references.gateway_invoice_id,
      status: 'unknown',
      failure_code: 'KNET_VERIFICATION_NOT_IMPLEMENTED',
      failure_message:
        'Direct KNET payment verification requires the selected live provider API contract.',
      raw_response: {
        provider: PAYMENT_PROVIDER_KNET,
        operation: 'verify_payment',
        verification_available: false,
      },
    });
  }

  refundPayment(
    input: PaymentGatewayRefundInput,
  ): Promise<PaymentGatewayRefundResult> {
    assertKnetProviderConfigured('refund_payment');

    return Promise.resolve({
      provider: PAYMENT_PROVIDER_KNET,
      provider_reference: input.payment.gateway_reference,
      status: 'manual_refund_required',
      refunded_amount: 0,
      failure_code: 'KNET_REFUND_NOT_IMPLEMENTED',
      failure_message:
        'Direct KNET refund requires the selected live provider API contract.',
      raw_response: {
        provider: PAYMENT_PROVIDER_KNET,
        operation: 'refund_payment',
        refund_available: false,
        payment_id: input.payment.id,
        requested_refund_amount: input.amount,
        currency: input.currency,
      },
    });
  }

  verifyWebhookSignature(input: PaymentWebhookInput): Promise<boolean> {
    assertKnetProviderConfigured('verify_webhook_signature');

    if (!hasText(input.headers.signature)) {
      return Promise.resolve(false);
    }

    const expectedSignature = createExpectedSignature({
      rawBody: input.raw_body,
      webhookSecret: currentPaymentConfig.knet.webhookSecret,
      timestamp: input.headers.timestamp,
    });

    return Promise.resolve(
      signaturesMatch(expectedSignature, input.headers.signature),
    );
  }

  parseWebhook(input: PaymentWebhookInput): Promise<PaymentWebhookParsedEvent> {
    const providerReference = getStringFromPayloadPaths(input.payload, [
      'provider_reference',
      'gateway_reference',
      'transaction_reference',
      'reference_id',
      'track_id',
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
    ]);

    const status = resolveVerificationStatusFromText(
      getStringFromPayloadPaths(input.payload, [
        'status',
        'payment_status',
        'result',
        'transaction_status',
      ]),
    );

    const eventType = resolveWebhookEventFromPayload(input.payload, status);

    return Promise.resolve({
      provider: PAYMENT_PROVIDER_KNET,
      event_id:
        input.headers.event_id ??
        getStringFromPayloadPaths(input.payload, [
          'event_id',
          'eventId',
          'webhook_id',
          'webhookId',
        ]),
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
