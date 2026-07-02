// apps/api/src/modules/payments/dto/create-checkout-payment.dto.ts
/**
 * LAFAM create checkout payment DTO.
 *
 * Role:
 * - Validates customer checkout request bodies.
 * - Supports payable Pilates booking checkout.
 * - Supports payable private trainer booking checkout.
 * - Supports payable bulk booking-order checkout.
 * - Supports wallet top-up checkout through hosted payment methods.
 * - Accepts payment method selection without accepting trusted payment amount for bookings.
 *
 * Important:
 * - Frontend amount is not trusted for booking/private booking/booking-order payments.
 * - Booking/private booking/booking-order prices are resolved by backend services.
 * - wallet_top_up_amount is allowed only for wallet top-up target.
 * - Wallet top-up cannot use wallet as the payment method.
 * - KNET/card payments must use hosted redirect flow.
 * - Wallet payment uses internal wallet ledger debit.
 * - No raw card data is accepted here.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsDefined,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate,
  ValidateIf,
  type ValidationArguments,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

import {
  PAYMENT_ALLOWED_CURRENCIES,
  PAYMENT_AMOUNT_DECIMAL_PLACES,
  PAYMENT_DEFAULT_CURRENCY,
  PAYMENT_IDEMPOTENCY_KEY_MAX_LENGTH,
  PAYMENT_IDEMPOTENCY_KEY_MIN_LENGTH,
  PAYMENT_METHOD_CARD,
  PAYMENT_METHOD_KNET,
  PAYMENT_METHOD_WALLET,
  PAYMENT_METHODS,
  PAYMENT_TARGET_TYPE_BOOKING,
  PAYMENT_TARGET_TYPE_BOOKING_ORDER,
  PAYMENT_TARGET_TYPE_PRIVATE_BOOKING,
  PAYMENT_TARGET_TYPE_WALLET_TOP_UP,
  PAYMENT_TARGET_TYPES,
  WALLET_TOP_UP_AMOUNT_MAX,
  WALLET_TOP_UP_AMOUNT_MIN,
} from '../constants/payment.constants';
import {
  PROMO_CODE_CODE_MAX_LENGTH,
  PROMO_CODE_CODE_MIN_LENGTH,
  PROMO_CODE_PATTERN,
} from '../../promo-codes/constants/promo-code.constants';

function requiredTrimmedString({ value }: TransformFnParams): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
}

function optionalTrimmedString({ value }: TransformFnParams): unknown {
  if (typeof value === 'undefined' || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function optionalUppercaseTrimmedString(params: TransformFnParams): unknown {
  const value: unknown = params.value;

  if (typeof value === 'undefined' || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue.toUpperCase() : undefined;
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

function optionalDecimal({ value }: TransformFnParams): unknown {
  if (typeof value === 'undefined' || value === null || value === '') {
    return undefined;
  }

  return decimalValue(value);
}

function isBookingTarget(dto: CreateCheckoutPaymentDto): boolean {
  return dto.target_type === PAYMENT_TARGET_TYPE_BOOKING;
}

function isPrivateBookingTarget(dto: CreateCheckoutPaymentDto): boolean {
  return dto.target_type === PAYMENT_TARGET_TYPE_PRIVATE_BOOKING;
}

function isBookingOrderTarget(dto: CreateCheckoutPaymentDto): boolean {
  return dto.target_type === PAYMENT_TARGET_TYPE_BOOKING_ORDER;
}

function isWalletTopUpTarget(dto: CreateCheckoutPaymentDto): boolean {
  return dto.target_type === PAYMENT_TARGET_TYPE_WALLET_TOP_UP;
}

function isNotWalletTopUpTarget(dto: CreateCheckoutPaymentDto): boolean {
  return dto.target_type !== PAYMENT_TARGET_TYPE_WALLET_TOP_UP;
}

@ValidatorConstraint({
  name: 'promoCodeAllowedForCheckoutTarget',
  async: false,
})
class PromoCodeAllowedForCheckoutTargetConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as CreateCheckoutPaymentDto;

    if (dto.target_type !== PAYMENT_TARGET_TYPE_WALLET_TOP_UP) {
      return true;
    }

    return value === undefined || value === null || value === '';
  }

  defaultMessage(): string {
    return 'promo_code is not supported when target_type is wallet_top_up.';
  }
}

export class CreateCheckoutPaymentDto {
  @ApiProperty({
    description: 'Payable target type for this checkout request.',
    enum: PAYMENT_TARGET_TYPES,
    example: PAYMENT_TARGET_TYPE_BOOKING,
  })
  @Transform(requiredTrimmedString)
  @IsIn(PAYMENT_TARGET_TYPES, {
    message:
      'target_type must be booking, private_booking, booking_order, or wallet_top_up.',
  })
  readonly target_type!:
    | typeof PAYMENT_TARGET_TYPE_BOOKING
    | typeof PAYMENT_TARGET_TYPE_PRIVATE_BOOKING
    | typeof PAYMENT_TARGET_TYPE_BOOKING_ORDER
    | typeof PAYMENT_TARGET_TYPE_WALLET_TOP_UP;

  @ApiPropertyOptional({
    description:
      'Booking identifier. Required when target_type is booking. The backend resolves the trusted amount from this booking.',
    example: '7d7eb3a7-4a75-4ed4-9c65-34d740a56aa4',
    format: 'uuid',
  })
  @ValidateIf(isBookingTarget)
  @IsDefined({
    message: 'booking_id is required when target_type is booking.',
  })
  @Transform(requiredTrimmedString)
  @IsUUID('4', {
    message: 'booking_id must be a valid UUID.',
  })
  readonly booking_id?: string;

  @ApiPropertyOptional({
    description:
      'Private trainer booking identifier. Required when target_type is private_booking. The backend resolves the trusted amount from this private booking.',
    example: '81a0fbd2-f9e1-41d4-a7d8-60a6099c1d08',
    format: 'uuid',
  })
  @ValidateIf(isPrivateBookingTarget)
  @IsDefined({
    message:
      'private_booking_id is required when target_type is private_booking.',
  })
  @Transform(requiredTrimmedString)
  @IsUUID('4', {
    message: 'private_booking_id must be a valid UUID.',
  })
  readonly private_booking_id?: string;

  @ApiPropertyOptional({
    description:
      'Booking order identifier. Required when target_type is booking_order. The backend resolves the trusted amount from the full booking order.',
    example: '4fb96de0-b109-4ad7-8f94-0a6de30f32ef',
    format: 'uuid',
  })
  @ValidateIf(isBookingOrderTarget)
  @IsDefined({
    message: 'booking_order_id is required when target_type is booking_order.',
  })
  @Transform(requiredTrimmedString)
  @IsUUID('4', {
    message: 'booking_order_id must be a valid UUID.',
  })
  readonly booking_order_id?: string;

  @ApiPropertyOptional({
    description:
      'Wallet top-up amount. Required only when target_type is wallet_top_up. Booking, private booking, and booking-order checkout amounts are never trusted from frontend.',
    example: 25,
    minimum: WALLET_TOP_UP_AMOUNT_MIN,
    maximum: WALLET_TOP_UP_AMOUNT_MAX,
  })
  @ValidateIf(isWalletTopUpTarget)
  @IsDefined({
    message:
      'wallet_top_up_amount is required when target_type is wallet_top_up.',
  })
  @Transform(optionalDecimal)
  @IsNumber(
    {
      maxDecimalPlaces: PAYMENT_AMOUNT_DECIMAL_PLACES,
    },
    {
      message: `wallet_top_up_amount must be a number with no more than ${PAYMENT_AMOUNT_DECIMAL_PLACES} decimal places.`,
    },
  )
  @Min(WALLET_TOP_UP_AMOUNT_MIN, {
    message: `wallet_top_up_amount must be at least ${WALLET_TOP_UP_AMOUNT_MIN}.`,
  })
  @Max(WALLET_TOP_UP_AMOUNT_MAX, {
    message: `wallet_top_up_amount must not exceed ${WALLET_TOP_UP_AMOUNT_MAX}.`,
  })
  readonly wallet_top_up_amount?: number;

  @ApiProperty({
    description:
      'Selected payment method. KNET/card use hosted redirect. Wallet uses internal wallet ledger debit and cannot be used for wallet top-up.',
    enum: PAYMENT_METHODS,
    example: PAYMENT_METHOD_KNET,
  })
  @Transform(requiredTrimmedString)
  @IsIn(PAYMENT_METHODS, {
    message: 'payment_method must be knet, card, or wallet.',
  })
  readonly payment_method!:
    | typeof PAYMENT_METHOD_KNET
    | typeof PAYMENT_METHOD_CARD
    | typeof PAYMENT_METHOD_WALLET;

  @ApiPropertyOptional({
    description:
      'Payment currency. Current Payment Module supports KWD only. Booking/private booking/booking-order currency is still resolved from backend-owned records.',
    enum: PAYMENT_ALLOWED_CURRENCIES,
    example: PAYMENT_DEFAULT_CURRENCY,
    default: PAYMENT_DEFAULT_CURRENCY,
  })
  @Transform(optionalUppercaseTrimmedString)
  @IsOptional()
  @IsIn(PAYMENT_ALLOWED_CURRENCIES, {
    message: 'currency must be KWD.',
  })
  readonly currency?: typeof PAYMENT_DEFAULT_CURRENCY;

  @ApiPropertyOptional({
    description:
      'Client-generated idempotency key. Prevents duplicate checkout creation when the client retries the same request.',
    example: 'checkout-20260617-user-123-booking-456',
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
      'Optional promo code. Accepted only for booking, private_booking, and booking_order checkout. Wallet top-up does not support promo codes. The backend validates, reserves, and recalculates the discount server-side through the Promo Code module.',
    example: 'WELCOME10',
    minLength: PROMO_CODE_CODE_MIN_LENGTH,
    maxLength: PROMO_CODE_CODE_MAX_LENGTH,
  })
  @Validate(PromoCodeAllowedForCheckoutTargetConstraint)
  @Transform(optionalUppercaseTrimmedString)
  @IsOptional()
  @IsString({
    message: 'promo_code must be a string.',
  })
  @MinLength(PROMO_CODE_CODE_MIN_LENGTH, {
    message: `promo_code must be at least ${PROMO_CODE_CODE_MIN_LENGTH} characters long.`,
  })
  @MaxLength(PROMO_CODE_CODE_MAX_LENGTH, {
    message: `promo_code must not exceed ${PROMO_CODE_CODE_MAX_LENGTH} characters.`,
  })
  @Matches(PROMO_CODE_PATTERN, {
    message:
      'promo_code may contain only uppercase letters, numbers, underscores, and hyphens, and must start and end with a letter or number.',
  })
  readonly promo_code?: string;

  @ApiPropertyOptional({
    description:
      'Optional client metadata. Services must sanitize metadata before storing or logging provider-sensitive values.',
    example: {
      checkout_source: 'web',
      screen: 'checkout',
    },
  })
  @IsOptional()
  @IsObject({
    message: 'metadata must be an object.',
  })
  readonly metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Reserved guard field. This field must not be sent for booking/private booking/booking-order targets because frontend-submitted amounts are not trusted.',
    deprecated: true,
  })
  @ValidateIf(isNotWalletTopUpTarget)
  @IsOptional()
  readonly amount?: never;
}
