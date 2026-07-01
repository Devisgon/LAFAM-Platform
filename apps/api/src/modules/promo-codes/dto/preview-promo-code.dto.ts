// apps/api/src/modules/promo-codes/dto/preview-promo-code.dto.ts
/**
 * LAFAM Promo Code Module customer-preview DTO.
 *
 * Role:
 * - Validates customer promo-code preview payloads at the HTTP boundary.
 * - Normalizes promo code, checkout target, payment method, and target IDs before service logic.
 * - Supports previewing discount eligibility before payment checkout is created.
 *
 * Important:
 * - Preview does not reserve a promo-code redemption.
 * - Checkout must revalidate and reserve the promo code again.
 * - Frontend-submitted subtotal, discount, final amount, redemption count, or payment truth must never be trusted.
 * - Promo codes are intentionally not allowed for wallet top-up.
 * - Target-reference consistency is enforced again in service/domain policy because route DTOs are not business authority.
 */

import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import {
  PROMO_CODE_ALLOWED_PAYMENT_METHODS,
  PROMO_CODE_ALLOWED_TARGET_TYPES,
  PROMO_CODE_CODE_MAX_LENGTH,
  PROMO_CODE_CODE_MIN_LENGTH,
  PROMO_CODE_PATTERN,
} from '../constants/promo-code.constants';
import type {
  PromoCodeAllowedPaymentMethod,
  PromoCodeAllowedTargetType,
} from '../constants/promo-code.constants';

function normalizePromoCode(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().toUpperCase();
}

function trimOptionalString(value: unknown): unknown {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function normalizeLowercaseString(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim().toLowerCase();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function normalizeOptionalLowercaseString(value: unknown): unknown {
  const trimmedValue = trimOptionalString(value);

  if (typeof trimmedValue !== 'string') {
    return trimmedValue;
  }

  return trimmedValue.toLowerCase();
}

export class PreviewPromoCodeDto {
  @Transform(({ value }) => normalizePromoCode(value))
  @IsString({
    message: 'promo_code must be a string.',
  })
  @IsNotEmpty({
    message: 'promo_code is required.',
  })
  @MinLength(PROMO_CODE_CODE_MIN_LENGTH, {
    message: `promo_code must be at least ${PROMO_CODE_CODE_MIN_LENGTH} characters long.`,
  })
  @MaxLength(PROMO_CODE_CODE_MAX_LENGTH, {
    message: `promo_code cannot be longer than ${PROMO_CODE_CODE_MAX_LENGTH} characters.`,
  })
  @Matches(PROMO_CODE_PATTERN, {
    message:
      'promo_code may contain only uppercase letters, numbers, underscores, and hyphens, and must start and end with a letter or number.',
  })
  promo_code!: string;

  @Transform(({ value }) => normalizeLowercaseString(value))
  @IsString({
    message: 'target_type must be a string.',
  })
  @IsIn(PROMO_CODE_ALLOWED_TARGET_TYPES, {
    message: `target_type must be one of: ${PROMO_CODE_ALLOWED_TARGET_TYPES.join(', ')}.`,
  })
  target_type!: PromoCodeAllowedTargetType;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsUUID('4', {
    message: 'booking_id must be a valid UUID.',
  })
  booking_id?: string;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsUUID('4', {
    message: 'private_booking_id must be a valid UUID.',
  })
  private_booking_id?: string;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsUUID('4', {
    message: 'booking_order_id must be a valid UUID.',
  })
  booking_order_id?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalLowercaseString(value))
  @IsString({
    message: 'payment_method must be a string.',
  })
  @IsIn(PROMO_CODE_ALLOWED_PAYMENT_METHODS, {
    message: `payment_method must be one of: ${PROMO_CODE_ALLOWED_PAYMENT_METHODS.join(', ')}.`,
  })
  payment_method?: PromoCodeAllowedPaymentMethod;
}
