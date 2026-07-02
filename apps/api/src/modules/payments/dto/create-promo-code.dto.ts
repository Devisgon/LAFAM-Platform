import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
const CREATE_PROMO_STATUSES = ['draft', ...PROMO_CODE_STATUSES] as const;

function trimmedString(params: TransformFnParams): unknown {
  const value: unknown = params.value;

  return typeof value === 'string' ? value.trim() : value;
}

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

export class CreatePromoCodeDto {
  @ApiProperty({
    example: 'INTRO10',
  })
  @Transform(trimmedString)
  @MaxLength(64)
  readonly code!: string;

  @ApiPropertyOptional()
  @Transform(optionalTrimmedString)
  @IsOptional()
  @MaxLength(500)
  readonly description?: string | null;

  @ApiProperty({
    enum: PROMO_DISCOUNT_TYPES,
  })
  @IsIn(PROMO_DISCOUNT_TYPES)
  readonly discount_type!: (typeof PROMO_DISCOUNT_TYPES)[number];

  @ApiProperty()
  @Transform(optionalNumber)
  @IsNumber()
  @Min(0)
  readonly discount_value!: number;

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
    enum: CREATE_PROMO_STATUSES,
  })
  @IsOptional()
  @IsIn(CREATE_PROMO_STATUSES)
  readonly status?: (typeof CREATE_PROMO_STATUSES)[number];

  @ApiPropertyOptional({
    default: 'KWD',
  })
  @IsOptional()
  @IsIn(['KWD'])
  readonly currency?: 'KWD';

  @ApiPropertyOptional()
  @Transform(optionalNumber)
  @IsOptional()
  @IsNumber()
  @Min(0)
  readonly minimum_order_amount?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  readonly first_time_customer_only?: boolean;

  @ApiPropertyOptional({
    enum: PAYMENT_BOOKING_TARGET_TYPES,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsIn(PAYMENT_BOOKING_TARGET_TYPES, { each: true })
  readonly allowed_target_types?: (typeof PAYMENT_BOOKING_TARGET_TYPES)[number][];

  @ApiPropertyOptional({
    enum: PAYMENT_METHODS,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsIn(PAYMENT_METHODS, { each: true })
  readonly allowed_payment_methods?: (typeof PAYMENT_METHODS)[number][];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  readonly target_ids?: Record<string, unknown>;

  @ApiPropertyOptional()
  @Transform(optionalTrimmedString)
  @IsOptional()
  @MaxLength(2000)
  readonly admin_notes?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  readonly metadata?: Record<string, unknown>;
}
