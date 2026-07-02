import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

import {
  PAYMENT_BOOKING_TARGET_TYPES,
  PAYMENT_METHODS,
  PROMO_CODE_STATUSES,
  PROMO_DISCOUNT_TYPES,
} from '../constants/payment.constants';

const ISO_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/u;

function optionalTrimmedString(params: TransformFnParams): unknown {
  const value: unknown = params.value;

  if (typeof value === 'undefined') return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return value;

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function optionalNumber(params: TransformFnParams): unknown {
  const value: unknown = params.value;

  if (typeof value === 'undefined') return undefined;
  if (value === null || value === '') return null;
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return value;

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? Number(trimmedValue) : null;
}

export class UpdatePromoCodeDto {
  @ApiPropertyOptional()
  @Transform(optionalTrimmedString)
  @IsOptional()
  @MaxLength(500)
  readonly description?: string | null;

  @ApiPropertyOptional({
    enum: PROMO_DISCOUNT_TYPES,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PROMO_DISCOUNT_TYPES)
  readonly discount_type?: (typeof PROMO_DISCOUNT_TYPES)[number];

  @ApiPropertyOptional()
  @Transform(optionalNumber)
  @IsOptional()
  @IsNumber()
  @Min(0)
  readonly discount_value?: number | null;

  @ApiPropertyOptional()
  @Transform(optionalNumber)
  @IsOptional()
  @IsNumber()
  @Min(0)
  readonly max_discount_amount?: number | null;

  @ApiPropertyOptional()
  @Transform(optionalTrimmedString)
  @IsOptional()
  @Matches(ISO_DATE_TIME_PATTERN, {
    message: 'starts_at must be an ISO date or timestamp.',
  })
  readonly starts_at?: string | null;

  @ApiPropertyOptional()
  @Transform(optionalTrimmedString)
  @IsOptional()
  @Matches(ISO_DATE_TIME_PATTERN, {
    message: 'ends_at must be an ISO date or timestamp.',
  })
  readonly ends_at?: string | null;

  @ApiPropertyOptional()
  @Transform(optionalNumber)
  @IsOptional()
  @IsNumber()
  @Min(0)
  readonly max_redemptions?: number | null;

  @ApiPropertyOptional()
  @Transform(optionalNumber)
  @IsOptional()
  @IsNumber()
  @Min(0)
  readonly per_user_limit?: number | null;

  @ApiPropertyOptional({
    enum: PROMO_CODE_STATUSES,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PROMO_CODE_STATUSES)
  readonly status?: (typeof PROMO_CODE_STATUSES)[number];

  @ApiPropertyOptional({
    description: 'Accepted for API contract compatibility.',
  })
  @IsOptional()
  @IsBoolean()
  readonly first_time_customer_only?: boolean;

  @ApiPropertyOptional({
    description: 'Accepted for API contract compatibility.',
  })
  @Transform(optionalNumber)
  @IsOptional()
  @IsNumber()
  @Min(0)
  readonly minimum_order_amount?: number | null;

  @ApiPropertyOptional({
    description: 'Accepted for API contract compatibility.',
    enum: PAYMENT_BOOKING_TARGET_TYPES,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsIn(PAYMENT_BOOKING_TARGET_TYPES, { each: true })
  readonly allowed_target_types?: (typeof PAYMENT_BOOKING_TARGET_TYPES)[number][];

  @ApiPropertyOptional({
    description: 'Accepted for API contract compatibility.',
    enum: PAYMENT_METHODS,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsIn(PAYMENT_METHODS, { each: true })
  readonly allowed_payment_methods?: (typeof PAYMENT_METHODS)[number][];

  @ApiPropertyOptional({
    description: 'Accepted for API contract compatibility.',
  })
  @IsOptional()
  @IsObject()
  readonly target_ids?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Accepted for API contract compatibility.',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @MaxLength(2000)
  readonly admin_notes?: string | null;

  @ApiPropertyOptional({
    description: 'Accepted for API contract compatibility.',
  })
  @IsOptional()
  @IsObject()
  readonly metadata?: Record<string, unknown>;
}
