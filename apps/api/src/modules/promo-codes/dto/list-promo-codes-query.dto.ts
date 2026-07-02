// apps/api/src/modules/promo-codes/dto/list-promo-codes-query.dto.ts
/**
 * LAFAM Promo Code Module list-query DTO.
 *
 * Role:
 * - Validates admin/staff promo-code listing filters at the HTTP boundary.
 * - Normalizes search, status, discount type, target type, payment method, creator, date, pagination, and sorting query values.
 * - Keeps list behavior predictable before service and repository filtering.
 *
 * Important:
 * - Query DTO validation does not decide authorization.
 * - Services must still enforce admin/staff visibility rules.
 * - Deleted promo codes must not be returned unless include_deleted is explicitly true and the actor is allowed to view them.
 * - Pagination and sorting must stay bounded to protect the API from expensive unbounded reads.
 */

import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  PROMO_CODE_ALLOWED_CREATOR_ROLES,
  PROMO_CODE_ALLOWED_PAYMENT_METHODS,
  PROMO_CODE_ALLOWED_TARGET_TYPES,
  PROMO_CODE_DEFAULT_SORT_DIRECTION,
  PROMO_CODE_DEFAULT_SORT_FIELD,
  PROMO_CODE_DISCOUNT_TYPES,
  PROMO_CODE_LIST_DEFAULT_LIMIT,
  PROMO_CODE_LIST_DEFAULT_OFFSET,
  PROMO_CODE_LIST_MAX_LIMIT,
  PROMO_CODE_SORT_DIRECTIONS,
  PROMO_CODE_SORT_FIELDS,
  PROMO_CODE_STATUSES,
} from '../constants/promo-code.constants';
import type {
  PromoCodeAllowedCreatorRole,
  PromoCodeAllowedPaymentMethod,
  PromoCodeAllowedTargetType,
  PromoCodeDiscountType,
  PromoCodeSortDirection,
  PromoCodeSortField,
  PromoCodeStatus,
} from '../constants/promo-code.constants';

const PROMO_CODE_SEARCH_MAX_LENGTH = 120;

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

function normalizeOptionalSearch(value: unknown): unknown {
  const trimmedValue = trimOptionalString(value);

  if (typeof trimmedValue !== 'string') {
    return trimmedValue;
  }

  return trimmedValue;
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

export class ListPromoCodesQueryDto {
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalSearch(value))
  @IsString({
    message: 'search must be a string.',
  })
  @MaxLength(PROMO_CODE_SEARCH_MAX_LENGTH, {
    message: `search cannot be longer than ${PROMO_CODE_SEARCH_MAX_LENGTH} characters.`,
  })
  search?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalLowercaseString(value))
  @IsString({
    message: 'status must be a string.',
  })
  @IsIn(PROMO_CODE_STATUSES, {
    message: `status must be one of: ${PROMO_CODE_STATUSES.join(', ')}.`,
  })
  status?: PromoCodeStatus;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalLowercaseString(value))
  @IsString({
    message: 'discount_type must be a string.',
  })
  @IsIn(PROMO_CODE_DISCOUNT_TYPES, {
    message: `discount_type must be one of: ${PROMO_CODE_DISCOUNT_TYPES.join(', ')}.`,
  })
  discount_type?: PromoCodeDiscountType;

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
  @Transform(({ value }) => normalizeOptionalLowercaseString(value))
  @IsString({
    message: 'payment_method must be a string.',
  })
  @IsIn(PROMO_CODE_ALLOWED_PAYMENT_METHODS, {
    message: `payment_method must be one of: ${PROMO_CODE_ALLOWED_PAYMENT_METHODS.join(', ')}.`,
  })
  payment_method?: PromoCodeAllowedPaymentMethod;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsUUID('4', {
    message: 'created_by_admin_id must be a valid UUID.',
  })
  created_by_admin_id?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalLowercaseString(value))
  @IsString({
    message: 'created_by_role must be a string.',
  })
  @IsIn(PROMO_CODE_ALLOWED_CREATOR_ROLES, {
    message: `created_by_role must be one of: ${PROMO_CODE_ALLOWED_CREATOR_ROLES.join(', ')}.`,
  })
  created_by_role?: PromoCodeAllowedCreatorRole;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsISO8601(
    {
      strict: true,
    },
    {
      message: 'starts_from must be a valid ISO 8601 date-time string.',
    },
  )
  starts_from?: string;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsISO8601(
    {
      strict: true,
    },
    {
      message: 'starts_to must be a valid ISO 8601 date-time string.',
    },
  )
  starts_to?: string;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsISO8601(
    {
      strict: true,
    },
    {
      message: 'ends_from must be a valid ISO 8601 date-time string.',
    },
  )
  ends_from?: string;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsISO8601(
    {
      strict: true,
    },
    {
      message: 'ends_to must be a valid ISO 8601 date-time string.',
    },
  )
  ends_to?: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean({
    message: 'include_deleted must be a boolean.',
  })
  include_deleted?: boolean;

  @IsOptional()
  @Transform(({ value }) => toOptionalInteger(value))
  @Type(() => Number)
  @IsInt({
    message: 'limit must be an integer.',
  })
  @Min(1, {
    message: 'limit must be at least 1.',
  })
  @Max(PROMO_CODE_LIST_MAX_LIMIT, {
    message: `limit cannot be greater than ${PROMO_CODE_LIST_MAX_LIMIT}.`,
  })
  limit?: number = PROMO_CODE_LIST_DEFAULT_LIMIT;

  @IsOptional()
  @Transform(({ value }) => toOptionalInteger(value))
  @Type(() => Number)
  @IsInt({
    message: 'offset must be an integer.',
  })
  @Min(0, {
    message: 'offset must be at least 0.',
  })
  offset?: number = PROMO_CODE_LIST_DEFAULT_OFFSET;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalLowercaseString(value))
  @IsString({
    message: 'sort_by must be a string.',
  })
  @IsIn(PROMO_CODE_SORT_FIELDS, {
    message: `sort_by must be one of: ${PROMO_CODE_SORT_FIELDS.join(', ')}.`,
  })
  sort_by?: PromoCodeSortField = PROMO_CODE_DEFAULT_SORT_FIELD;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalLowercaseString(value))
  @IsString({
    message: 'sort_direction must be a string.',
  })
  @IsIn(PROMO_CODE_SORT_DIRECTIONS, {
    message: `sort_direction must be one of: ${PROMO_CODE_SORT_DIRECTIONS.join(', ')}.`,
  })
  sort_direction?: PromoCodeSortDirection = PROMO_CODE_DEFAULT_SORT_DIRECTION;
}
