// apps/api/src/modules/payments/dto/payment-callback-query.dto.ts
/**
 * LAFAM payment callback query DTO.
 *
 * Role:
 * - Validates provider/browser redirect callback query parameters.
 * - Supports KNET-style hosted payment return flows.
 * - Accepts provider references needed by callback verification services.
 *
 * Important:
 * - Callback is not payment truth.
 * - Callback query fields are not trusted proof of successful payment.
 * - PaymentCallbackService must verify status with the configured provider.
 * - Webhook/provider verification remains the reliable settlement source.
 * - This DTO must not accept raw card data or secrets.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import {
  PAYMENT_CALLBACK_RESULT_CANCELLED,
  PAYMENT_CALLBACK_RESULT_FAILED,
  PAYMENT_CALLBACK_RESULT_MAX_LENGTH,
  PAYMENT_CALLBACK_RESULT_SUCCESS,
  PAYMENT_CALLBACK_RESULTS,
  PAYMENT_GATEWAY_INVOICE_ID_MAX_LENGTH,
  PAYMENT_GATEWAY_PAYMENT_ID_MAX_LENGTH,
  PAYMENT_GATEWAY_REFERENCE_MAX_LENGTH,
} from '../constants/payment.constants';

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

export class PaymentCallbackQueryDto {
  @ApiPropertyOptional({
    description:
      'Local LAFAM payment identifier. This is optional because some providers return only provider-side references.',
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
      'Provider payment reference returned by the hosted payment provider.',
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
    description:
      'Gateway payment identifier returned by the hosted payment provider.',
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
    description:
      'Gateway invoice identifier returned by the hosted payment provider.',
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
      'Provider/browser callback result hint. This value is not trusted as final payment status.',
    enum: PAYMENT_CALLBACK_RESULTS,
    example: PAYMENT_CALLBACK_RESULT_SUCCESS,
    maxLength: PAYMENT_CALLBACK_RESULT_MAX_LENGTH,
  })
  @Transform(optionalLowercaseTrimmedString)
  @IsOptional()
  @IsString({
    message: 'result must be a string.',
  })
  @MaxLength(PAYMENT_CALLBACK_RESULT_MAX_LENGTH, {
    message: `result must not exceed ${PAYMENT_CALLBACK_RESULT_MAX_LENGTH} characters.`,
  })
  @IsIn(PAYMENT_CALLBACK_RESULTS, {
    message: 'result must be success, failed, or cancelled.',
  })
  readonly result?:
    | typeof PAYMENT_CALLBACK_RESULT_SUCCESS
    | typeof PAYMENT_CALLBACK_RESULT_FAILED
    | typeof PAYMENT_CALLBACK_RESULT_CANCELLED;

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
}
