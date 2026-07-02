// apps/api/src/modules/promo-codes/dto/list-promo-redemptions-query.dto.ts
/**
 * LAFAM Promo Code Module redemption list-query DTO.
 *
 * Role:
 * - Validates admin/staff promo-code redemption listing filters at the HTTP boundary.
 * - Normalizes redemption status, checkout target, IDs, date range, pagination, and sorting query values.
 * - Keeps redemption history queries bounded before service and repository filtering.
 *
 * Important:
 * - Query DTO validation does not decide authorization.
 * - Services must still enforce admin/staff visibility rules.
 * - Customer-facing endpoints must not expose redemption history through this DTO.
 * - Promo-code redemptions are financial audit records, so pagination and filters must stay explicit.
 */

import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

import {
  PROMO_CODE_ALLOWED_TARGET_TYPES,
  PROMO_CODE_REDEMPTION_DEFAULT_SORT_DIRECTION,
  PROMO_CODE_REDEMPTION_DEFAULT_SORT_FIELD,
  PROMO_CODE_REDEMPTION_LIST_DEFAULT_LIMIT,
  PROMO_CODE_REDEMPTION_LIST_DEFAULT_OFFSET,
  PROMO_CODE_REDEMPTION_LIST_MAX_LIMIT,
  PROMO_CODE_REDEMPTION_SORT_FIELDS,
  PROMO_CODE_REDEMPTION_STATUSES,
  PROMO_CODE_SORT_DIRECTIONS,
} from '../constants/promo-code.constants';
import type {
  PromoCodeAllowedTargetType,
  PromoCodeRedemptionSortField,
  PromoCodeRedemptionStatus,
  PromoCodeSortDirection,
} from '../constants/promo-code.constants';

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

function normalizeOptionalLowercaseString(value: unknown): unknown {
  const trimmedValue = trimOptionalString(value);

  if (typeof trimmedValue !== 'string') {
    return trimmedValue;
  }

  return trimmedValue.toLowerCase();
}

function toOptionalInteger(value: unknown): unknown {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? Number(trimmedValue) : undefined;
}

export class ListPromoRedemptionsQueryDto {
  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsUUID('4', {
    message: 'promo_code_id must be a valid UUID.',
  })
  promo_code_id?: string;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsUUID('4', {
    message: 'user_id must be a valid UUID.',
  })
  user_id?: string;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsUUID('4', {
    message: 'payment_id must be a valid UUID.',
  })
  payment_id?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalLowercaseString(value))
  @IsString({
    message: 'status must be a string.',
  })
  @IsIn(PROMO_CODE_REDEMPTION_STATUSES, {
    message: `status must be one of: ${PROMO_CODE_REDEMPTION_STATUSES.join(', ')}.`,
  })
  status?: PromoCodeRedemptionStatus;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalLowercaseString(value))
  @IsString({
    message: 'target_type must be a string.',
  })
  @IsIn(PROMO_CODE_ALLOWED_TARGET_TYPES, {
    message: `target_type must be one of: ${PROMO_CODE_ALLOWED_TARGET_TYPES.join(', ')}.`,
  })
  target_type?: PromoCodeAllowedTargetType;

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
  @Transform(({ value }) => trimOptionalString(value))
  @IsISO8601(
    {
      strict: true,
    },
    {
      message: 'from_date must be a valid ISO 8601 date-time string.',
    },
  )
  from_date?: string;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsISO8601(
    {
      strict: true,
    },
    {
      message: 'to_date must be a valid ISO 8601 date-time string.',
    },
  )
  to_date?: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalInteger(value))
  @Type(() => Number)
  @IsInt({
    message: 'limit must be an integer.',
  })
  @Min(1, {
    message: 'limit must be at least 1.',
  })
  @Max(PROMO_CODE_REDEMPTION_LIST_MAX_LIMIT, {
    message: `limit cannot be greater than ${PROMO_CODE_REDEMPTION_LIST_MAX_LIMIT}.`,
  })
  limit?: number = PROMO_CODE_REDEMPTION_LIST_DEFAULT_LIMIT;

  @IsOptional()
  @Transform(({ value }) => toOptionalInteger(value))
  @Type(() => Number)
  @IsInt({
    message: 'offset must be an integer.',
  })
  @Min(0, {
    message: 'offset must be at least 0.',
  })
  offset?: number = PROMO_CODE_REDEMPTION_LIST_DEFAULT_OFFSET;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalLowercaseString(value))
  @IsString({
    message: 'sort_by must be a string.',
  })
  @IsIn(PROMO_CODE_REDEMPTION_SORT_FIELDS, {
    message: `sort_by must be one of: ${PROMO_CODE_REDEMPTION_SORT_FIELDS.join(', ')}.`,
  })
  sort_by?: PromoCodeRedemptionSortField =
    PROMO_CODE_REDEMPTION_DEFAULT_SORT_FIELD;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalLowercaseString(value))
  @IsString({
    message: 'sort_direction must be a string.',
  })
  @IsIn(PROMO_CODE_SORT_DIRECTIONS, {
    message: `sort_direction must be one of: ${PROMO_CODE_SORT_DIRECTIONS.join(', ')}.`,
  })
  sort_direction?: PromoCodeSortDirection =
    PROMO_CODE_REDEMPTION_DEFAULT_SORT_DIRECTION;
}
