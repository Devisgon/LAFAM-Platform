import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

import { PAYMENT_BOOKING_TARGET_TYPES } from '../constants/payment.constants';

const ISO_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/u;

const PROMO_CODE_REDEMPTION_STATUSES = [
  'reserved',
  'redeemed',
  'released',
  'voided',
] as const;
const PROMO_CODE_REDEMPTION_SORT_FIELDS = [
  'created_at',
  'reserved_at',
  'redeemed_at',
  'released_at',
  'expires_at',
] as const;
const PROMO_CODE_REDEMPTION_SORT_DIRECTIONS = ['asc', 'desc'] as const;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export type PromoCodeRedemptionStatus =
  (typeof PROMO_CODE_REDEMPTION_STATUSES)[number];
export type PromoCodeRedemptionSortField =
  (typeof PROMO_CODE_REDEMPTION_SORT_FIELDS)[number];
export type PromoCodeRedemptionSortDirection =
  (typeof PROMO_CODE_REDEMPTION_SORT_DIRECTIONS)[number];

function optionalTrimmedString(params: TransformFnParams): unknown {
  const value: unknown = params.value;

  if (typeof value === 'undefined' || value === null) return undefined;
  if (typeof value !== 'string') return value;

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function integerWithDefault(defaultValue: number) {
  return (params: TransformFnParams): unknown => {
    const value: unknown = params.value;

    if (typeof value === 'undefined' || value === null || value === '') {
      return defaultValue;
    }

    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return value;

    const trimmedValue = value.trim();

    return /^\d+$/u.test(trimmedValue) ? Number(trimmedValue) : value;
  };
}

export class ListPromoCodeRedemptionsQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsUUID('4')
  readonly user_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsUUID('4')
  readonly payment_id?: string;

  @ApiPropertyOptional({ enum: PROMO_CODE_REDEMPTION_STATUSES })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PROMO_CODE_REDEMPTION_STATUSES)
  readonly status?: PromoCodeRedemptionStatus;

  @ApiPropertyOptional({ enum: PAYMENT_BOOKING_TARGET_TYPES })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PAYMENT_BOOKING_TARGET_TYPES)
  readonly target_type?: (typeof PAYMENT_BOOKING_TARGET_TYPES)[number];

  @ApiPropertyOptional({ format: 'uuid' })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsUUID('4')
  readonly booking_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsUUID('4')
  readonly private_booking_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsUUID('4')
  readonly booking_order_id?: string;

  @ApiPropertyOptional()
  @Transform(optionalTrimmedString)
  @IsOptional()
  @Matches(ISO_DATE_TIME_PATTERN)
  readonly from_date?: string;

  @ApiPropertyOptional()
  @Transform(optionalTrimmedString)
  @IsOptional()
  @Matches(ISO_DATE_TIME_PATTERN)
  readonly to_date?: string;

  @ApiPropertyOptional({
    default: DEFAULT_LIMIT,
    maximum: MAX_LIMIT,
    minimum: 1,
  })
  @Transform(integerWithDefault(DEFAULT_LIMIT))
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  readonly limit: number = DEFAULT_LIMIT;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @Transform(integerWithDefault(0))
  @IsInt()
  @Min(0)
  readonly offset: number = 0;

  @ApiPropertyOptional({
    default: 'created_at',
    enum: PROMO_CODE_REDEMPTION_SORT_FIELDS,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PROMO_CODE_REDEMPTION_SORT_FIELDS)
  readonly sort_by: PromoCodeRedemptionSortField = 'created_at';

  @ApiPropertyOptional({
    default: 'desc',
    enum: PROMO_CODE_REDEMPTION_SORT_DIRECTIONS,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PROMO_CODE_REDEMPTION_SORT_DIRECTIONS)
  readonly sort_direction: PromoCodeRedemptionSortDirection = 'desc';
}
