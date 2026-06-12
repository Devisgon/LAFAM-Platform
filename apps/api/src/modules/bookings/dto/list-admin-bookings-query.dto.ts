// apps/api/src/modules/bookings/dto/list-admin-bookings-query.dto.ts
/**
 * LAFAM admin booking list query DTO.
 *
 * Role:
 * - Validates admin-facing booking list query parameters.
 * - Supports booking status and payment status filtering.
 * - Supports schedule, class, trainer, and user filtering.
 * - Supports search, date range, pagination, and safe sorting.
 *
 * Important:
 * - This DTO validates query shape only.
 * - It does not decide authorization.
 * - It does not check whether referenced ids exist.
 * - It does not expose mutation behavior.
 * - Admin role guards must protect controllers using this DTO.
 */

import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  BOOKING_ADMIN_DEFAULT_LIMIT,
  BOOKING_ADMIN_DEFAULT_OFFSET,
  BOOKING_ADMIN_MAX_LIMIT,
  BOOKING_DEFAULT_SORT_DIRECTION,
  BOOKING_DEFAULT_SORT_FIELD,
  BOOKING_PAYMENT_STATUSES,
  BOOKING_SEARCH_MAX_LENGTH,
  BOOKING_SORT_DIRECTIONS,
  BOOKING_SORT_FIELDS,
  BOOKING_STATUSES,
  type BookingPaymentStatus,
  type BookingSortDirection,
  type BookingSortField,
  type BookingStatus,
} from '../constants/booking.constants';

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function normalizeOptionalInteger(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : Number.NaN;
  }

  if (typeof value !== 'string') {
    return Number.NaN;
  }

  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return undefined;
  }

  const parsedValue = Number(trimmedValue);

  return Number.isInteger(parsedValue) ? parsedValue : Number.NaN;
}

export class ListAdminBookingsQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeOptionalString(value))
  @IsString({
    message: 'search must be a string.',
  })
  @MaxLength(BOOKING_SEARCH_MAX_LENGTH, {
    message: `search must not exceed ${BOOKING_SEARCH_MAX_LENGTH} characters.`,
  })
  readonly search?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeOptionalString(value))
  @IsIn(BOOKING_STATUSES, {
    message: `status must be one of: ${BOOKING_STATUSES.join(', ')}.`,
  })
  readonly status?: BookingStatus;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeOptionalString(value))
  @IsIn(BOOKING_PAYMENT_STATUSES, {
    message: `payment_status must be one of: ${BOOKING_PAYMENT_STATUSES.join(', ')}.`,
  })
  readonly payment_status?: BookingPaymentStatus;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeOptionalString(value))
  @IsUUID('4', {
    message: 'schedule_id must be a valid UUID.',
  })
  readonly schedule_id?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeOptionalString(value))
  @IsUUID('4', {
    message: 'class_id must be a valid UUID.',
  })
  readonly class_id?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeOptionalString(value))
  @IsUUID('4', {
    message: 'trainer_staff_profile_id must be a valid UUID.',
  })
  readonly trainer_staff_profile_id?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeOptionalString(value))
  @IsUUID('4', {
    message: 'user_id must be a valid UUID.',
  })
  readonly user_id?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeOptionalString(value))
  @IsDateString(
    {},
    {
      message: 'from_date must be a valid ISO date string.',
    },
  )
  readonly from_date?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeOptionalString(value))
  @IsDateString(
    {},
    {
      message: 'to_date must be a valid ISO date string.',
    },
  )
  readonly to_date?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeOptionalInteger(value))
  @IsInt({
    message: 'limit must be an integer.',
  })
  @Min(1, {
    message: 'limit must be at least 1.',
  })
  @Max(BOOKING_ADMIN_MAX_LIMIT, {
    message: `limit must not exceed ${BOOKING_ADMIN_MAX_LIMIT}.`,
  })
  readonly limit: number = BOOKING_ADMIN_DEFAULT_LIMIT;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeOptionalInteger(value))
  @IsInt({
    message: 'offset must be an integer.',
  })
  @Min(0, {
    message: 'offset must be at least 0.',
  })
  readonly offset: number = BOOKING_ADMIN_DEFAULT_OFFSET;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeOptionalString(value))
  @IsIn(BOOKING_SORT_FIELDS, {
    message: `sort_by must be one of: ${BOOKING_SORT_FIELDS.join(', ')}.`,
  })
  readonly sort_by: BookingSortField = BOOKING_DEFAULT_SORT_FIELD;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeOptionalString(value))
  @IsIn(BOOKING_SORT_DIRECTIONS, {
    message: `sort_direction must be one of: ${BOOKING_SORT_DIRECTIONS.join(', ')}.`,
  })
  readonly sort_direction: BookingSortDirection =
    BOOKING_DEFAULT_SORT_DIRECTION;
}
