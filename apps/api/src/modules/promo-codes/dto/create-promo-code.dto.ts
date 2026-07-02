// apps/api/src/modules/promo-codes/dto/create-promo-code.dto.ts
/**
 * LAFAM Promo Code Module create DTOs.
 *
 * Role:
 * - Validates admin/staff promo-code creation payloads at the HTTP boundary.
 * - Normalizes promo-code text, timestamps, target arrays, and optional numeric limits before service logic.
 * - Keeps discount, target, payment-method, staff-limit, and metadata inputs explicit.
 *
 * Important:
 * - DTO validation does not make a promo code financially safe by itself.
 * - Services and domain policies must still enforce role limits, lifecycle rules, target eligibility, and discount safety.
 * - Frontend-submitted discount outcomes, final amounts, redemption counts, and payment truth must never be trusted.
 * - Promo codes are intentionally not allowed for wallet top-up.
 */

import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import {
  PROMO_CODE_ADMIN_NOTES_MAX_LENGTH,
  PROMO_CODE_ALLOWED_PAYMENT_METHODS,
  PROMO_CODE_ALLOWED_TARGET_TYPES,
  PROMO_CODE_CODE_MAX_LENGTH,
  PROMO_CODE_CODE_MIN_LENGTH,
  PROMO_CODE_DEFAULT_CURRENCY,
  PROMO_CODE_DESCRIPTION_MAX_LENGTH,
  PROMO_CODE_DISCOUNT_TYPES,
  PROMO_CODE_FIXED_AMOUNT_MIN_VALUE,
  PROMO_CODE_MAX_REDEMPTIONS_MIN_VALUE,
  PROMO_CODE_MAX_REDEMPTIONS_MIN_VALUE as PROMO_CODE_MIN_REDEMPTIONS_VALUE,
  PROMO_CODE_MINIMUM_ORDER_MIN_AMOUNT,
  PROMO_CODE_PATTERN,
  PROMO_CODE_PERCENTAGE_MAX_VALUE,
  PROMO_CODE_PERCENTAGE_MIN_VALUE,
  PROMO_CODE_PER_USER_LIMIT_MIN_VALUE,
  PROMO_CODE_STATUSES,
} from '../constants/promo-code.constants';
import type {
  PromoCodeAllowedPaymentMethod,
  PromoCodeAllowedTargetType,
  PromoCodeDiscountType,
  PromoCodeStatus,
} from '../constants/promo-code.constants';

const PROMO_CODE_TARGET_IDS_MAX_SIZE = 100;

function normalizePromoCode(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().toUpperCase();
}

function trimOptionalString(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function normalizeOptionalCurrency(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim().toUpperCase();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function toOptionalNumber(value: unknown): unknown {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  if (typeof value === 'string') {
    const trimmedValue = value.trim();

    return trimmedValue.length > 0 ? Number(trimmedValue) : undefined;
  }

  return value;
}

function toOptionalBoolean(value: unknown): unknown {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === 'true') {
    return true;
  }

  if (normalizedValue === 'false') {
    return false;
  }

  return value;
}
function isNormalizedStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

function normalizeOptionalStringArray(value: unknown): unknown {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return value;
  }

  const normalizedValues = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return normalizedValues.length > 0 ? normalizedValues : undefined;
}

function normalizeOptionalUuidArray(value: unknown): unknown {
  return normalizeOptionalStringArray(value);
}

function normalizeOptionalTargetTypes(value: unknown): unknown {
  const normalizedValue = normalizeOptionalStringArray(value);

  if (!isNormalizedStringArray(normalizedValue)) {
    return normalizedValue;
  }

  return normalizedValue.map((item) => item.toLowerCase());
}

function normalizeOptionalPaymentMethods(value: unknown): unknown {
  const normalizedValue = normalizeOptionalStringArray(value);

  if (!isNormalizedStringArray(normalizedValue)) {
    return normalizedValue;
  }

  return normalizedValue.map((item) => item.toLowerCase());
}

function normalizeOptionalStatus(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim().toLowerCase();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function normalizeOptionalDiscountType(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim().toLowerCase();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

export class CreatePromoCodeTargetsDto {
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalUuidArray(value))
  @IsArray({
    message: 'class_ids must be an array.',
  })
  @ArrayUnique({
    message: 'class_ids must not contain duplicate values.',
  })
  @ArrayMaxSize(PROMO_CODE_TARGET_IDS_MAX_SIZE, {
    message: `class_ids cannot contain more than ${PROMO_CODE_TARGET_IDS_MAX_SIZE} values.`,
  })
  @IsUUID('4', {
    each: true,
    message: 'Each class_ids value must be a valid UUID.',
  })
  class_ids?: string[];

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalUuidArray(value))
  @IsArray({
    message: 'schedule_ids must be an array.',
  })
  @ArrayUnique({
    message: 'schedule_ids must not contain duplicate values.',
  })
  @ArrayMaxSize(PROMO_CODE_TARGET_IDS_MAX_SIZE, {
    message: `schedule_ids cannot contain more than ${PROMO_CODE_TARGET_IDS_MAX_SIZE} values.`,
  })
  @IsUUID('4', {
    each: true,
    message: 'Each schedule_ids value must be a valid UUID.',
  })
  schedule_ids?: string[];

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalUuidArray(value))
  @IsArray({
    message: 'trainer_staff_profile_ids must be an array.',
  })
  @ArrayUnique({
    message: 'trainer_staff_profile_ids must not contain duplicate values.',
  })
  @ArrayMaxSize(PROMO_CODE_TARGET_IDS_MAX_SIZE, {
    message: `trainer_staff_profile_ids cannot contain more than ${PROMO_CODE_TARGET_IDS_MAX_SIZE} values.`,
  })
  @IsUUID('4', {
    each: true,
    message: 'Each trainer_staff_profile_ids value must be a valid UUID.',
  })
  trainer_staff_profile_ids?: string[];

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalUuidArray(value))
  @IsArray({
    message: 'customer_user_ids must be an array.',
  })
  @ArrayUnique({
    message: 'customer_user_ids must not contain duplicate values.',
  })
  @ArrayMaxSize(PROMO_CODE_TARGET_IDS_MAX_SIZE, {
    message: `customer_user_ids cannot contain more than ${PROMO_CODE_TARGET_IDS_MAX_SIZE} values.`,
  })
  @IsUUID('4', {
    each: true,
    message: 'Each customer_user_ids value must be a valid UUID.',
  })
  customer_user_ids?: string[];
}

export class CreatePromoCodeDto {
  @Transform(({ value }) => normalizePromoCode(value))
  @IsString({
    message: 'code must be a string.',
  })
  @IsNotEmpty({
    message: 'code is required.',
  })
  @MinLength(PROMO_CODE_CODE_MIN_LENGTH, {
    message: `code must be at least ${PROMO_CODE_CODE_MIN_LENGTH} characters long.`,
  })
  @MaxLength(PROMO_CODE_CODE_MAX_LENGTH, {
    message: `code cannot be longer than ${PROMO_CODE_CODE_MAX_LENGTH} characters.`,
  })
  @Matches(PROMO_CODE_PATTERN, {
    message:
      'code may contain only uppercase letters, numbers, underscores, and hyphens, and must start and end with a letter or number.',
  })
  code!: string;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString({
    message: 'description must be a string.',
  })
  @MaxLength(PROMO_CODE_DESCRIPTION_MAX_LENGTH, {
    message: `description cannot be longer than ${PROMO_CODE_DESCRIPTION_MAX_LENGTH} characters.`,
  })
  description?: string;

  @Transform(({ value }) => normalizeOptionalDiscountType(value))
  @IsString({
    message: 'discount_type must be a string.',
  })
  @IsIn(PROMO_CODE_DISCOUNT_TYPES, {
    message: `discount_type must be one of: ${PROMO_CODE_DISCOUNT_TYPES.join(', ')}.`,
  })
  discount_type!: PromoCodeDiscountType;

  @Transform(({ value }) => toOptionalNumber(value))
  @Type(() => Number)
  @Min(PROMO_CODE_FIXED_AMOUNT_MIN_VALUE, {
    message: `discount_value must be at least ${PROMO_CODE_FIXED_AMOUNT_MIN_VALUE}.`,
  })
  @Max(PROMO_CODE_PERCENTAGE_MAX_VALUE, {
    message: `discount_value cannot be greater than ${PROMO_CODE_PERCENTAGE_MAX_VALUE}.`,
  })
  discount_value!: number;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @Type(() => Number)
  @Min(PROMO_CODE_PERCENTAGE_MIN_VALUE, {
    message: `max_discount_amount must be at least ${PROMO_CODE_PERCENTAGE_MIN_VALUE}.`,
  })
  max_discount_amount?: number;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsISO8601(
    {
      strict: true,
    },
    {
      message: 'starts_at must be a valid ISO 8601 date-time string.',
    },
  )
  starts_at?: string;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsISO8601(
    {
      strict: true,
    },
    {
      message: 'ends_at must be a valid ISO 8601 date-time string.',
    },
  )
  ends_at?: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @Type(() => Number)
  @IsInt({
    message: 'max_redemptions must be an integer.',
  })
  @Min(PROMO_CODE_MAX_REDEMPTIONS_MIN_VALUE, {
    message: `max_redemptions must be at least ${PROMO_CODE_MIN_REDEMPTIONS_VALUE}.`,
  })
  max_redemptions?: number;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @Type(() => Number)
  @IsInt({
    message: 'per_user_limit must be an integer.',
  })
  @Min(PROMO_CODE_PER_USER_LIMIT_MIN_VALUE, {
    message: `per_user_limit must be at least ${PROMO_CODE_PER_USER_LIMIT_MIN_VALUE}.`,
  })
  per_user_limit?: number;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalStatus(value))
  @IsString({
    message: 'status must be a string.',
  })
  @IsIn(PROMO_CODE_STATUSES, {
    message: `status must be one of: ${PROMO_CODE_STATUSES.join(', ')}.`,
  })
  status?: PromoCodeStatus;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalCurrency(value))
  @IsString({
    message: 'currency must be a string.',
  })
  @Matches(/^[A-Z]{3}$/, {
    message: 'currency must be a valid uppercase three-letter currency code.',
  })
  currency?: string = PROMO_CODE_DEFAULT_CURRENCY;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @Type(() => Number)
  @Min(PROMO_CODE_MINIMUM_ORDER_MIN_AMOUNT, {
    message: `minimum_order_amount must be at least ${PROMO_CODE_MINIMUM_ORDER_MIN_AMOUNT}.`,
  })
  minimum_order_amount?: number;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean({
    message: 'first_time_customer_only must be a boolean.',
  })
  first_time_customer_only?: boolean;

  @Transform(({ value }) => normalizeOptionalTargetTypes(value))
  @IsArray({
    message: 'allowed_target_types must be an array.',
  })
  @ArrayUnique({
    message: 'allowed_target_types must not contain duplicate values.',
  })
  @ArrayMaxSize(PROMO_CODE_ALLOWED_TARGET_TYPES.length, {
    message: `allowed_target_types cannot contain more than ${PROMO_CODE_ALLOWED_TARGET_TYPES.length} values.`,
  })
  @IsIn(PROMO_CODE_ALLOWED_TARGET_TYPES, {
    each: true,
    message: `Each allowed_target_types value must be one of: ${PROMO_CODE_ALLOWED_TARGET_TYPES.join(', ')}.`,
  })
  allowed_target_types!: PromoCodeAllowedTargetType[];

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalPaymentMethods(value))
  @IsArray({
    message: 'allowed_payment_methods must be an array.',
  })
  @ArrayUnique({
    message: 'allowed_payment_methods must not contain duplicate values.',
  })
  @ArrayMaxSize(PROMO_CODE_ALLOWED_PAYMENT_METHODS.length, {
    message: `allowed_payment_methods cannot contain more than ${PROMO_CODE_ALLOWED_PAYMENT_METHODS.length} values.`,
  })
  @IsIn(PROMO_CODE_ALLOWED_PAYMENT_METHODS, {
    each: true,
    message: `Each allowed_payment_methods value must be one of: ${PROMO_CODE_ALLOWED_PAYMENT_METHODS.join(', ')}.`,
  })
  allowed_payment_methods?: PromoCodeAllowedPaymentMethod[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePromoCodeTargetsDto)
  target_ids?: CreatePromoCodeTargetsDto;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString({
    message: 'admin_notes must be a string.',
  })
  @MaxLength(PROMO_CODE_ADMIN_NOTES_MAX_LENGTH, {
    message: `admin_notes cannot be longer than ${PROMO_CODE_ADMIN_NOTES_MAX_LENGTH} characters.`,
  })
  admin_notes?: string;

  @IsOptional()
  @IsObject({
    message: 'metadata must be a JSON object.',
  })
  metadata?: Record<string, unknown>;
}
