import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

import {
  PAYMENT_METHODS,
  PAYMENT_BOOKING_TARGET_TYPES,
  PROMO_CODE_STATUSES,
  PROMO_DISCOUNT_TYPES,
} from '../constants/payment.constants';

const ISO_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/u;

const PROMO_CODE_LIST_DEFAULT_LIMIT = 20;
const PROMO_CODE_LIST_MAX_LIMIT = 100;
const PROMO_CODE_SORT_FIELDS = [
  'created_at',
  'updated_at',
  'code',
  'status',
  'starts_at',
  'ends_at',
  'redemption_count',
] as const;
const PROMO_CODE_SORT_DIRECTIONS = ['asc', 'desc'] as const;
const PROMO_CREATED_BY_ROLES = [
  'super_admin',
  'admin',
  'staff',
  'system',
] as const;

export type PromoCodeSortField = (typeof PROMO_CODE_SORT_FIELDS)[number];
export type PromoCodeSortDirection =
  (typeof PROMO_CODE_SORT_DIRECTIONS)[number];
export type PromoCreatedByRole = (typeof PROMO_CREATED_BY_ROLES)[number];

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

function integerWithDefault(defaultValue: number) {
  return (params: TransformFnParams): unknown => {
    const value: unknown = params.value;

    if (typeof value === 'undefined' || value === null || value === '') {
      return defaultValue;
    }

    if (typeof value === 'number') {
      return value;
    }

    if (typeof value !== 'string') {
      return value;
    }

    const trimmedValue = value.trim();

    return /^\d+$/u.test(trimmedValue) ? Number(trimmedValue) : value;
  };
}

function optionalBooleanWithDefault(defaultValue: boolean) {
  return (params: TransformFnParams): unknown => {
    const value: unknown = params.value;

    if (typeof value === 'undefined' || value === null || value === '') {
      return defaultValue;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value !== 'string') {
      return value;
    }

    if (value === 'true') return true;
    if (value === 'false') return false;

    return value;
  };
}

export class ListPromoCodesQueryDto {
  @ApiPropertyOptional({
    description: 'Case-insensitive search over promo-code code/description.',
    example: 'intro',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  readonly search?: string;

  @ApiPropertyOptional({
    description: 'Filter by promo-code status.',
    enum: PROMO_CODE_STATUSES,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PROMO_CODE_STATUSES, {
    message: 'status must be active, inactive, expired, or deleted.',
  })
  readonly status?: (typeof PROMO_CODE_STATUSES)[number];

  @ApiPropertyOptional({
    description: 'Filter by promo discount type.',
    enum: PROMO_DISCOUNT_TYPES,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PROMO_DISCOUNT_TYPES, {
    message: 'discount_type must be percentage or fixed_amount.',
  })
  readonly discount_type?: (typeof PROMO_DISCOUNT_TYPES)[number];

  @ApiPropertyOptional({
    description: 'Accepted for API contract compatibility.',
    enum: PAYMENT_BOOKING_TARGET_TYPES,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PAYMENT_BOOKING_TARGET_TYPES, {
    message: 'target_type must be booking, private_booking, or booking_order.',
  })
  readonly target_type?: (typeof PAYMENT_BOOKING_TARGET_TYPES)[number];

  @ApiPropertyOptional({
    description: 'Accepted for API contract compatibility.',
    enum: PAYMENT_METHODS,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PAYMENT_METHODS, {
    message: 'payment_method must be knet, card, or wallet.',
  })
  readonly payment_method?: (typeof PAYMENT_METHODS)[number];

  @ApiPropertyOptional({
    description: 'Filter by creating admin app-user id.',
    format: 'uuid',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsUUID('4', {
    message: 'created_by_admin_id must be a valid UUID.',
  })
  readonly created_by_admin_id?: string;

  @ApiPropertyOptional({
    description: 'Accepted for API contract compatibility.',
    enum: PROMO_CREATED_BY_ROLES,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PROMO_CREATED_BY_ROLES, {
    message: 'created_by_role must be super_admin, admin, staff, or system.',
  })
  readonly created_by_role?: PromoCreatedByRole;

  @ApiPropertyOptional({
    description: 'Filter codes starting on or after this timestamp.',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @Matches(ISO_DATE_TIME_PATTERN, {
    message: 'starts_from must be an ISO date or timestamp.',
  })
  readonly starts_from?: string;

  @ApiPropertyOptional({
    description: 'Filter codes starting on or before this timestamp.',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @Matches(ISO_DATE_TIME_PATTERN, {
    message: 'starts_to must be an ISO date or timestamp.',
  })
  readonly starts_to?: string;

  @ApiPropertyOptional({
    description: 'Filter codes ending on or after this timestamp.',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @Matches(ISO_DATE_TIME_PATTERN, {
    message: 'ends_from must be an ISO date or timestamp.',
  })
  readonly ends_from?: string;

  @ApiPropertyOptional({
    description: 'Filter codes ending on or before this timestamp.',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @Matches(ISO_DATE_TIME_PATTERN, {
    message: 'ends_to must be an ISO date or timestamp.',
  })
  readonly ends_to?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Include soft-deleted promo codes.',
  })
  @Transform(optionalBooleanWithDefault(false))
  @IsBoolean({
    message: 'include_deleted must be true or false.',
  })
  readonly include_deleted: boolean = false;

  @ApiPropertyOptional({
    default: PROMO_CODE_LIST_DEFAULT_LIMIT,
    maximum: PROMO_CODE_LIST_MAX_LIMIT,
    minimum: 1,
  })
  @Transform(integerWithDefault(PROMO_CODE_LIST_DEFAULT_LIMIT))
  @IsInt()
  @Min(1)
  @Max(PROMO_CODE_LIST_MAX_LIMIT)
  readonly limit: number = PROMO_CODE_LIST_DEFAULT_LIMIT;

  @ApiPropertyOptional({
    default: 0,
    minimum: 0,
  })
  @Transform(integerWithDefault(0))
  @IsInt()
  @Min(0)
  readonly offset: number = 0;

  @ApiPropertyOptional({
    default: 'created_at',
    enum: PROMO_CODE_SORT_FIELDS,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PROMO_CODE_SORT_FIELDS)
  readonly sort_by: PromoCodeSortField = 'created_at';

  @ApiPropertyOptional({
    default: 'desc',
    enum: PROMO_CODE_SORT_DIRECTIONS,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PROMO_CODE_SORT_DIRECTIONS)
  readonly sort_direction: PromoCodeSortDirection = 'desc';
}
