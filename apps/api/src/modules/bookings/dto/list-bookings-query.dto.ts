// apps/api/src/modules/bookings/dto/list-bookings-query.dto.ts
/**
 * LAFAM customer booking list query DTO.
 *
 * Role:
 * - Validates customer-facing booking list query parameters.
 * - Supports optional status filtering.
 * - Supports optional schedule date range filtering.
 * - Supports pagination.
 * - Supports safe sorting.
 *
 * Important:
 * - This DTO validates query shape only.
 * - It does not decide booking ownership.
 * - It does not expose admin-only filters.
 * - The service layer must force the current authenticated user id.
 * - Customers must never be allowed to list another user's bookings through query params.
 */

import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

import {
  BOOKING_DEFAULT_LIMIT,
  BOOKING_DEFAULT_OFFSET,
  BOOKING_DEFAULT_SORT_DIRECTION,
  BOOKING_DEFAULT_SORT_FIELD,
  BOOKING_MAX_LIMIT,
  BOOKING_SORT_DIRECTIONS,
  BOOKING_SORT_FIELDS,
  BOOKING_STATUSES,
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

export class ListBookingsQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeOptionalString(value))
  @IsIn(BOOKING_STATUSES, {
    message: `status must be one of: ${BOOKING_STATUSES.join(', ')}.`,
  })
  readonly status?: BookingStatus;

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
  @Max(BOOKING_MAX_LIMIT, {
    message: `limit must not exceed ${BOOKING_MAX_LIMIT}.`,
  })
  readonly limit: number = BOOKING_DEFAULT_LIMIT;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeOptionalInteger(value))
  @IsInt({
    message: 'offset must be an integer.',
  })
  @Min(0, {
    message: 'offset must be at least 0.',
  })
  readonly offset: number = BOOKING_DEFAULT_OFFSET;

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
