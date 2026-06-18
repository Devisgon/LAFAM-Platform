// apps/api/src/modules/payments/dto/refund-payment.dto.ts
/**
 * LAFAM refund and admin wallet adjustment DTOs.
 *
 * Role:
 * - Validates admin payment refund request bodies.
 * - Validates admin wallet adjustment request bodies.
 * - Enforces audit-reason requirements for sensitive money mutations.
 * - Applies amount precision and bounded metadata validation at the request edge.
 *
 * Important:
 * - DTO validation is not authorization.
 * - Admin/super-admin role checks must still be enforced by controllers/guards.
 * - Refund eligibility must still be enforced by PaymentLifecyclePolicy.
 * - Wallet adjustment safety must still be enforced by WalletLedgerPolicy and atomic RPCs.
 * - Services must sanitize metadata before storing or logging provider-sensitive values.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import {
  PAYMENT_AMOUNT_DECIMAL_PLACES,
  PAYMENT_AMOUNT_MAX,
  PAYMENT_DEFAULT_CURRENCY,
  PAYMENT_IDEMPOTENCY_KEY_MAX_LENGTH,
  PAYMENT_IDEMPOTENCY_KEY_MIN_LENGTH,
  PAYMENT_REFUND_AMOUNT_MIN,
  REFUND_REASON_MAX_LENGTH,
  REFUND_REASON_MIN_LENGTH,
  WALLET_ADMIN_ADJUSTMENT_AMOUNT_MAX,
  WALLET_ADMIN_ADJUSTMENT_AMOUNT_MIN,
  WALLET_ADMIN_ADJUSTMENT_REASON_MAX_LENGTH,
  WALLET_ADMIN_ADJUSTMENT_REASON_MIN_LENGTH,
  WALLET_LEDGER_ENTRY_TYPE_ADMIN_ADJUSTMENT_CREDIT,
  WALLET_LEDGER_ENTRY_TYPE_ADMIN_ADJUSTMENT_DEBIT,
} from '../constants/payment.constants';

const ADMIN_WALLET_ADJUSTMENT_TYPES = [
  WALLET_LEDGER_ENTRY_TYPE_ADMIN_ADJUSTMENT_CREDIT,
  WALLET_LEDGER_ENTRY_TYPE_ADMIN_ADJUSTMENT_DEBIT,
] as const;

function requiredTrimmedString(params: TransformFnParams): unknown {
  const value: unknown = params.value;

  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
}

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

function decimalValue(value: unknown): unknown {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();

  if (!/^-?\d+(?:\.\d+)?$/u.test(trimmedValue)) {
    return value;
  }

  return Number(trimmedValue);
}

function optionalDecimal(params: TransformFnParams): unknown {
  const value: unknown = params.value;

  if (typeof value === 'undefined' || value === null || value === '') {
    return undefined;
  }

  return decimalValue(value);
}

function requiredDecimal(params: TransformFnParams): unknown {
  return decimalValue(params.value);
}

export class RefundPaymentDto {
  @ApiProperty({
    description:
      'Admin audit reason for the refund. Required for accountability and payment investigation trails.',
    example: 'Customer cancelled before the allowed cancellation deadline.',
    minLength: REFUND_REASON_MIN_LENGTH,
    maxLength: REFUND_REASON_MAX_LENGTH,
  })
  @Transform(requiredTrimmedString)
  @IsString({
    message: 'reason must be a string.',
  })
  @MinLength(REFUND_REASON_MIN_LENGTH, {
    message: `reason must be at least ${REFUND_REASON_MIN_LENGTH} characters long.`,
  })
  @MaxLength(REFUND_REASON_MAX_LENGTH, {
    message: `reason must not exceed ${REFUND_REASON_MAX_LENGTH} characters.`,
  })
  readonly reason!: string;

  @ApiPropertyOptional({
    description:
      'Optional refund amount. If omitted, the service may process a full eligible refund. Currency is KWD only in this phase.',
    example: 15,
    minimum: PAYMENT_REFUND_AMOUNT_MIN,
    maximum: PAYMENT_AMOUNT_MAX,
  })
  @Transform(optionalDecimal)
  @IsOptional()
  @IsNumber(
    {
      maxDecimalPlaces: PAYMENT_AMOUNT_DECIMAL_PLACES,
    },
    {
      message: `refund_amount must be a number with no more than ${PAYMENT_AMOUNT_DECIMAL_PLACES} decimal places.`,
    },
  )
  @Min(PAYMENT_REFUND_AMOUNT_MIN, {
    message: `refund_amount must be at least ${PAYMENT_REFUND_AMOUNT_MIN}.`,
  })
  @Max(PAYMENT_AMOUNT_MAX, {
    message: `refund_amount must not exceed ${PAYMENT_AMOUNT_MAX}.`,
  })
  readonly refund_amount?: number;

  @ApiPropertyOptional({
    description:
      'Client/admin generated idempotency key used to prevent duplicate refund submission.',
    example: 'refund-20260617-payment-2a3417a5',
    minLength: PAYMENT_IDEMPOTENCY_KEY_MIN_LENGTH,
    maxLength: PAYMENT_IDEMPOTENCY_KEY_MAX_LENGTH,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsString({
    message: 'idempotency_key must be a string.',
  })
  @MinLength(PAYMENT_IDEMPOTENCY_KEY_MIN_LENGTH, {
    message: `idempotency_key must be at least ${PAYMENT_IDEMPOTENCY_KEY_MIN_LENGTH} characters long.`,
  })
  @MaxLength(PAYMENT_IDEMPOTENCY_KEY_MAX_LENGTH, {
    message: `idempotency_key must not exceed ${PAYMENT_IDEMPOTENCY_KEY_MAX_LENGTH} characters.`,
  })
  readonly idempotency_key?: string;

  @ApiPropertyOptional({
    description:
      'Optional refund metadata. Services must sanitize metadata before storing or logging.',
    example: {
      refund_source: 'admin_dashboard',
      note: 'Approved by studio manager',
    },
  })
  @IsOptional()
  @IsObject({
    message: 'metadata must be an object.',
  })
  readonly metadata?: Record<string, unknown>;
}

export class AdminWalletAdjustmentDto {
  @ApiProperty({
    description:
      'Wallet adjustment direction. Credit adds balance. Debit removes balance. Both require an audit reason.',
    enum: ADMIN_WALLET_ADJUSTMENT_TYPES,
    example: WALLET_LEDGER_ENTRY_TYPE_ADMIN_ADJUSTMENT_CREDIT,
  })
  @Transform(requiredTrimmedString)
  @IsIn(ADMIN_WALLET_ADJUSTMENT_TYPES, {
    message:
      'entry_type must be admin_adjustment_credit or admin_adjustment_debit.',
  })
  readonly entry_type!:
    | typeof WALLET_LEDGER_ENTRY_TYPE_ADMIN_ADJUSTMENT_CREDIT
    | typeof WALLET_LEDGER_ENTRY_TYPE_ADMIN_ADJUSTMENT_DEBIT;

  @ApiProperty({
    description: `Wallet adjustment amount in ${PAYMENT_DEFAULT_CURRENCY}.`,
    example: 10,
    minimum: WALLET_ADMIN_ADJUSTMENT_AMOUNT_MIN,
    maximum: WALLET_ADMIN_ADJUSTMENT_AMOUNT_MAX,
  })
  @Transform(requiredDecimal)
  @IsNumber(
    {
      maxDecimalPlaces: PAYMENT_AMOUNT_DECIMAL_PLACES,
    },
    {
      message: `amount must be a number with no more than ${PAYMENT_AMOUNT_DECIMAL_PLACES} decimal places.`,
    },
  )
  @Min(WALLET_ADMIN_ADJUSTMENT_AMOUNT_MIN, {
    message: `amount must be at least ${WALLET_ADMIN_ADJUSTMENT_AMOUNT_MIN}.`,
  })
  @Max(WALLET_ADMIN_ADJUSTMENT_AMOUNT_MAX, {
    message: `amount must not exceed ${WALLET_ADMIN_ADJUSTMENT_AMOUNT_MAX}.`,
  })
  readonly amount!: number;

  @ApiProperty({
    description:
      'Admin audit reason for the wallet adjustment. Required because manual wallet mutations are high-risk.',
    example: 'Manual correction for failed gateway refund.',
    minLength: WALLET_ADMIN_ADJUSTMENT_REASON_MIN_LENGTH,
    maxLength: WALLET_ADMIN_ADJUSTMENT_REASON_MAX_LENGTH,
  })
  @Transform(requiredTrimmedString)
  @IsString({
    message: 'reason must be a string.',
  })
  @MinLength(WALLET_ADMIN_ADJUSTMENT_REASON_MIN_LENGTH, {
    message: `reason must be at least ${WALLET_ADMIN_ADJUSTMENT_REASON_MIN_LENGTH} characters long.`,
  })
  @MaxLength(WALLET_ADMIN_ADJUSTMENT_REASON_MAX_LENGTH, {
    message: `reason must not exceed ${WALLET_ADMIN_ADJUSTMENT_REASON_MAX_LENGTH} characters.`,
  })
  readonly reason!: string;

  @ApiPropertyOptional({
    description:
      'Client/admin generated idempotency key used to prevent duplicate wallet adjustment submission.',
    example: 'wallet-adjustment-20260617-user-302d9725',
    minLength: PAYMENT_IDEMPOTENCY_KEY_MIN_LENGTH,
    maxLength: PAYMENT_IDEMPOTENCY_KEY_MAX_LENGTH,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsString({
    message: 'idempotency_key must be a string.',
  })
  @MinLength(PAYMENT_IDEMPOTENCY_KEY_MIN_LENGTH, {
    message: `idempotency_key must be at least ${PAYMENT_IDEMPOTENCY_KEY_MIN_LENGTH} characters long.`,
  })
  @MaxLength(PAYMENT_IDEMPOTENCY_KEY_MAX_LENGTH, {
    message: `idempotency_key must not exceed ${PAYMENT_IDEMPOTENCY_KEY_MAX_LENGTH} characters.`,
  })
  readonly idempotency_key?: string;

  @ApiPropertyOptional({
    description:
      'Optional wallet adjustment metadata. Services must sanitize metadata before storing or logging.',
    example: {
      adjustment_source: 'admin_dashboard',
      reference: 'manual-refund-case-001',
    },
  })
  @IsOptional()
  @IsObject({
    message: 'metadata must be an object.',
  })
  readonly metadata?: Record<string, unknown>;
}
