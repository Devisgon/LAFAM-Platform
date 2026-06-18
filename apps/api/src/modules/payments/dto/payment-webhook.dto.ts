// apps/api/src/modules/payments/dto/payment-webhook.dto.ts
/**
 * LAFAM payment webhook DTO.
 *
 * Role:
 * - Validates normalized payment webhook request bodies.
 * - Supports KNET/provider hosted payment webhook events.
 * - Allows provider references required for idempotent payment verification.
 * - Keeps webhook payload shape bounded before it reaches PaymentCallbackService.
 *
 * Important:
 * - Webhook body is not trusted just because it passed DTO validation.
 * - Webhook signature verification must happen before trusting provider fields.
 * - Provider status must still be verified through the configured gateway adapter.
 * - Duplicate webhook events must be handled idempotently by service/database logic.
 * - This DTO must not accept raw card data, secrets, or authorization tokens.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import {
  PAYMENT_FAILURE_CODE_MAX_LENGTH,
  PAYMENT_FAILURE_MESSAGE_MAX_LENGTH,
  PAYMENT_GATEWAY_INVOICE_ID_MAX_LENGTH,
  PAYMENT_GATEWAY_PAYMENT_ID_MAX_LENGTH,
  PAYMENT_GATEWAY_REFERENCE_MAX_LENGTH,
  PAYMENT_WEBHOOK_EVENT_ID_MAX_LENGTH,
  PAYMENT_WEBHOOK_EVENT_PAYMENT_CANCELLED,
  PAYMENT_WEBHOOK_EVENT_PAYMENT_FAILED,
  PAYMENT_WEBHOOK_EVENT_PAYMENT_REFUNDED,
  PAYMENT_WEBHOOK_EVENT_PAYMENT_SUCCEEDED,
  PAYMENT_WEBHOOK_EVENT_TYPE_MAX_LENGTH,
  PAYMENT_WEBHOOK_EVENTS,
} from '../constants/payment.constants';

const WEBHOOK_STATUS_VALUES = [
  'paid',
  'failed',
  'cancelled',
  'pending',
  'unknown',
] as const;

type PaymentWebhookStatus = (typeof WEBHOOK_STATUS_VALUES)[number];

function optionalTrimmedString(params: TransformFnParams): unknown {
  const value: unknown = params.value;

  if (typeof value === 'undefined' || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function requiredTrimmedString(params: TransformFnParams): unknown {
  const value: unknown = params.value;

  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
}

function optionalLowercaseTrimmedString(params: TransformFnParams): unknown {
  const value: unknown = params.value;

  if (typeof value === 'undefined' || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue.toLowerCase() : undefined;
}

export class PaymentWebhookDto {
  @ApiProperty({
    description:
      'Normalized webhook event type. Provider-specific payloads must be normalized before business logic trusts them.',
    enum: PAYMENT_WEBHOOK_EVENTS,
    example: PAYMENT_WEBHOOK_EVENT_PAYMENT_SUCCEEDED,
    maxLength: PAYMENT_WEBHOOK_EVENT_TYPE_MAX_LENGTH,
  })
  @Transform(requiredTrimmedString)
  @IsString({
    message: 'event_type must be a string.',
  })
  @MaxLength(PAYMENT_WEBHOOK_EVENT_TYPE_MAX_LENGTH, {
    message: `event_type must not exceed ${PAYMENT_WEBHOOK_EVENT_TYPE_MAX_LENGTH} characters.`,
  })
  @IsIn(PAYMENT_WEBHOOK_EVENTS, {
    message:
      'event_type must be payment.succeeded, payment.failed, payment.cancelled, or payment.refunded.',
  })
  readonly event_type!:
    | typeof PAYMENT_WEBHOOK_EVENT_PAYMENT_SUCCEEDED
    | typeof PAYMENT_WEBHOOK_EVENT_PAYMENT_FAILED
    | typeof PAYMENT_WEBHOOK_EVENT_PAYMENT_CANCELLED
    | typeof PAYMENT_WEBHOOK_EVENT_PAYMENT_REFUNDED;

  @ApiPropertyOptional({
    description:
      'Provider webhook event identifier. Used for replay protection and idempotency when the provider supplies one.',
    example: 'evt_20260617_000001',
    maxLength: PAYMENT_WEBHOOK_EVENT_ID_MAX_LENGTH,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsString({
    message: 'event_id must be a string.',
  })
  @MaxLength(PAYMENT_WEBHOOK_EVENT_ID_MAX_LENGTH, {
    message: `event_id must not exceed ${PAYMENT_WEBHOOK_EVENT_ID_MAX_LENGTH} characters.`,
  })
  readonly event_id?: string;

  @ApiPropertyOptional({
    description:
      'Local LAFAM payment identifier. Optional because some providers only return gateway-side references.',
    example: '2a3417a5-6427-47e4-b412-587f3e1ebfd0',
    format: 'uuid',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsUUID('4', {
    message: 'payment_id must be a valid UUID.',
  })
  readonly payment_id?: string;

  @ApiPropertyOptional({
    description:
      'Provider payment reference used to locate and verify the payment.',
    example: 'knet-ref-20260617-000001',
    maxLength: PAYMENT_GATEWAY_REFERENCE_MAX_LENGTH,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsString({
    message: 'provider_reference must be a string.',
  })
  @MaxLength(PAYMENT_GATEWAY_REFERENCE_MAX_LENGTH, {
    message: `provider_reference must not exceed ${PAYMENT_GATEWAY_REFERENCE_MAX_LENGTH} characters.`,
  })
  readonly provider_reference?: string;

  @ApiPropertyOptional({
    description: 'Gateway payment identifier used to locate provider payment.',
    example: 'gw-payment-123456789',
    maxLength: PAYMENT_GATEWAY_PAYMENT_ID_MAX_LENGTH,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsString({
    message: 'gateway_payment_id must be a string.',
  })
  @MaxLength(PAYMENT_GATEWAY_PAYMENT_ID_MAX_LENGTH, {
    message: `gateway_payment_id must not exceed ${PAYMENT_GATEWAY_PAYMENT_ID_MAX_LENGTH} characters.`,
  })
  readonly gateway_payment_id?: string;

  @ApiPropertyOptional({
    description: 'Gateway invoice identifier used to locate provider payment.',
    example: 'gw-invoice-987654321',
    maxLength: PAYMENT_GATEWAY_INVOICE_ID_MAX_LENGTH,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsString({
    message: 'gateway_invoice_id must be a string.',
  })
  @MaxLength(PAYMENT_GATEWAY_INVOICE_ID_MAX_LENGTH, {
    message: `gateway_invoice_id must not exceed ${PAYMENT_GATEWAY_INVOICE_ID_MAX_LENGTH} characters.`,
  })
  readonly gateway_invoice_id?: string;

  @ApiPropertyOptional({
    description:
      'Normalized provider status hint. This is not trusted until provider verification succeeds.',
    enum: WEBHOOK_STATUS_VALUES,
    example: 'paid',
  })
  @Transform(optionalLowercaseTrimmedString)
  @IsOptional()
  @IsString({
    message: 'status must be a string.',
  })
  @IsIn(WEBHOOK_STATUS_VALUES, {
    message: 'status must be paid, failed, cancelled, pending, or unknown.',
  })
  readonly status?: PaymentWebhookStatus;

  @ApiPropertyOptional({
    description: 'Provider failure code when the webhook represents a failure.',
    example: 'insufficient_funds',
    maxLength: PAYMENT_FAILURE_CODE_MAX_LENGTH,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsString({
    message: 'failure_code must be a string.',
  })
  @MaxLength(PAYMENT_FAILURE_CODE_MAX_LENGTH, {
    message: `failure_code must not exceed ${PAYMENT_FAILURE_CODE_MAX_LENGTH} characters.`,
  })
  readonly failure_code?: string;

  @ApiPropertyOptional({
    description:
      'Sanitized provider failure message when the webhook represents a failure.',
    example: 'Payment was declined by the issuing bank.',
    maxLength: PAYMENT_FAILURE_MESSAGE_MAX_LENGTH,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsString({
    message: 'failure_message must be a string.',
  })
  @MaxLength(PAYMENT_FAILURE_MESSAGE_MAX_LENGTH, {
    message: `failure_message must not exceed ${PAYMENT_FAILURE_MESSAGE_MAX_LENGTH} characters.`,
  })
  readonly failure_message?: string;

  @ApiPropertyOptional({
    description:
      'ISO timestamp when the provider says the event occurred. Used only as provider metadata, not as proof of settlement.',
    example: '2026-06-17T10:30:00.000Z',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsDateString(
    {},
    {
      message: 'occurred_at must be a valid ISO date string.',
    },
  )
  readonly occurred_at?: string;

  @ApiPropertyOptional({
    description:
      'Provider transaction alias. Accepted for compatibility with providers that use transaction_id instead of gateway_payment_id.',
    example: 'txn-123456789',
    maxLength: PAYMENT_GATEWAY_PAYMENT_ID_MAX_LENGTH,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsString({
    message: 'transaction_id must be a string.',
  })
  @MaxLength(PAYMENT_GATEWAY_PAYMENT_ID_MAX_LENGTH, {
    message: `transaction_id must not exceed ${PAYMENT_GATEWAY_PAYMENT_ID_MAX_LENGTH} characters.`,
  })
  readonly transaction_id?: string;

  @ApiPropertyOptional({
    description:
      'Provider invoice alias. Accepted for compatibility with providers that use invoice_id instead of gateway_invoice_id.',
    example: 'invoice-987654321',
    maxLength: PAYMENT_GATEWAY_INVOICE_ID_MAX_LENGTH,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsString({
    message: 'invoice_id must be a string.',
  })
  @MaxLength(PAYMENT_GATEWAY_INVOICE_ID_MAX_LENGTH, {
    message: `invoice_id must not exceed ${PAYMENT_GATEWAY_INVOICE_ID_MAX_LENGTH} characters.`,
  })
  readonly invoice_id?: string;

  @ApiPropertyOptional({
    description:
      'Provider reference alias. Accepted for compatibility with providers that use reference_id instead of provider_reference.',
    example: 'provider-ref-000001',
    maxLength: PAYMENT_GATEWAY_REFERENCE_MAX_LENGTH,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsString({
    message: 'reference_id must be a string.',
  })
  @MaxLength(PAYMENT_GATEWAY_REFERENCE_MAX_LENGTH, {
    message: `reference_id must not exceed ${PAYMENT_GATEWAY_REFERENCE_MAX_LENGTH} characters.`,
  })
  readonly reference_id?: string;

  @ApiPropertyOptional({
    description:
      'Bounded provider payload metadata. Services must sanitize sensitive fields before storing or logging this object.',
    example: {
      provider_status: 'CAPTURED',
      provider_message: 'Payment successful',
    },
  })
  @IsOptional()
  @IsObject({
    message: 'payload must be an object.',
  })
  readonly payload?: Record<string, unknown>;
}
