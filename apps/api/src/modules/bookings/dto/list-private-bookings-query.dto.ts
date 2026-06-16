// apps/api/src/modules/bookings/dto/list-private-bookings-query.dto.ts
/**
 * LAFAM list private trainer bookings query DTOs.
 *
 * Role:
 * - Validates customer private booking list query parameters.
 * - Validates admin private booking list query parameters.
 * - Supports status, trainer, customer, payment status, date range, pagination,
 *   search, and safe sorting.
 *
 * Important:
 * - Customer query must not accept user_id. Service logic must force the current
 *   authenticated customer id.
 * - Admin query may accept user_id because admins can filter private bookings
 *   for a specific customer.
 * - This DTO validates query shape only.
 * - Authorization and ownership checks belong in service logic.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  BOOKING_ADMIN_DEFAULT_OFFSET,
  BOOKING_DATE_PATTERN,
  BOOKING_DEFAULT_SORT_DIRECTION,
  BOOKING_PAYMENT_STATUSES,
  BOOKING_SEARCH_MAX_LENGTH,
  BOOKING_SORT_DIRECTIONS,
  BOOKING_STATUSES,
  BOOKING_UUID_VERSION,
  PRIVATE_BOOKING_ADMIN_DEFAULT_LIMIT,
  PRIVATE_BOOKING_ADMIN_MAX_LIMIT,
  PRIVATE_BOOKING_DEFAULT_LIMIT,
  PRIVATE_BOOKING_DEFAULT_OFFSET,
  PRIVATE_BOOKING_DEFAULT_SORT_FIELD,
  PRIVATE_BOOKING_MAX_LIMIT,
  PRIVATE_BOOKING_SORT_FIELDS,
  type BookingPaymentStatus,
  type BookingSortDirection,
  type BookingStatus,
  type PrivateBookingSortField,
} from '../constants/booking.constants';

function optionalTrimmedString({ value }: TransformFnParams): unknown {
  if (typeof value === 'undefined' || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function optionalInteger({ value }: TransformFnParams): unknown {
  if (typeof value === 'undefined' || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();

  if (!/^-?\d+$/u.test(trimmedValue)) {
    return value;
  }

  return Number(trimmedValue);
}

export class ListPrivateBookingsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter private bookings by booking status.',
    enum: BOOKING_STATUSES,
    example: 'confirmed',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(BOOKING_STATUSES, {
    message:
      'status must be one of: pending_payment, confirmed, cancelled, completed, no_show, expired, rescheduled, deleted.',
  })
  readonly status?: BookingStatus;

  @ApiPropertyOptional({
    description: 'Filter private bookings by trainer staff profile identifier.',
    example: '4df33c73-4fd5-46bb-a7a5-f5a9914de18a',
    format: 'uuid',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsUUID(BOOKING_UUID_VERSION, {
    message: 'trainer_staff_profile_id must be a valid UUID.',
  })
  readonly trainer_staff_profile_id?: string;

  @ApiPropertyOptional({
    description:
      'Start date for private booking filtering. Format: YYYY-MM-DD.',
    example: '2026-06-20',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @Matches(BOOKING_DATE_PATTERN, {
    message: 'from_date must use YYYY-MM-DD format.',
  })
  readonly from_date?: string;

  @ApiPropertyOptional({
    description: 'End date for private booking filtering. Format: YYYY-MM-DD.',
    example: '2026-06-30',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @Matches(BOOKING_DATE_PATTERN, {
    message: 'to_date must use YYYY-MM-DD format.',
  })
  readonly to_date?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of private bookings to return.',
    example: PRIVATE_BOOKING_DEFAULT_LIMIT,
    default: PRIVATE_BOOKING_DEFAULT_LIMIT,
    minimum: 1,
    maximum: PRIVATE_BOOKING_MAX_LIMIT,
  })
  @Transform(optionalInteger)
  @IsOptional()
  @IsInt({
    message: 'limit must be an integer.',
  })
  @Min(1, {
    message: 'limit must be at least 1.',
  })
  @Max(PRIVATE_BOOKING_MAX_LIMIT, {
    message: `limit must not exceed ${PRIVATE_BOOKING_MAX_LIMIT}.`,
  })
  readonly limit: number = PRIVATE_BOOKING_DEFAULT_LIMIT;

  @ApiPropertyOptional({
    description: 'Number of private bookings to skip.',
    example: PRIVATE_BOOKING_DEFAULT_OFFSET,
    default: PRIVATE_BOOKING_DEFAULT_OFFSET,
    minimum: 0,
  })
  @Transform(optionalInteger)
  @IsOptional()
  @IsInt({
    message: 'offset must be an integer.',
  })
  @Min(0, {
    message: 'offset must be at least 0.',
  })
  readonly offset: number = PRIVATE_BOOKING_DEFAULT_OFFSET;

  @ApiPropertyOptional({
    description: 'Field used to sort private bookings.',
    enum: PRIVATE_BOOKING_SORT_FIELDS,
    example: PRIVATE_BOOKING_DEFAULT_SORT_FIELD,
    default: PRIVATE_BOOKING_DEFAULT_SORT_FIELD,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PRIVATE_BOOKING_SORT_FIELDS, {
    message:
      'sort_by must be one of: created_at, session_date, start_time, status.',
  })
  readonly sort_by: PrivateBookingSortField =
    PRIVATE_BOOKING_DEFAULT_SORT_FIELD;

  @ApiPropertyOptional({
    description: 'Sort direction.',
    enum: BOOKING_SORT_DIRECTIONS,
    example: BOOKING_DEFAULT_SORT_DIRECTION,
    default: BOOKING_DEFAULT_SORT_DIRECTION,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(BOOKING_SORT_DIRECTIONS, {
    message: 'sort_direction must be either asc or desc.',
  })
  readonly sort_direction: BookingSortDirection =
    BOOKING_DEFAULT_SORT_DIRECTION;
}

export class ListAdminPrivateBookingsQueryDto {
  @ApiPropertyOptional({
    description:
      'Search private bookings by customer email, customer name, phone, booking number, or trainer name.',
    example: 'customer@example.com',
    maxLength: BOOKING_SEARCH_MAX_LENGTH,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsString({
    message: 'search must be a string.',
  })
  @MaxLength(BOOKING_SEARCH_MAX_LENGTH, {
    message: `search must not exceed ${BOOKING_SEARCH_MAX_LENGTH} characters.`,
  })
  readonly search?: string;

  @ApiPropertyOptional({
    description: 'Filter private bookings by booking status.',
    enum: BOOKING_STATUSES,
    example: 'confirmed',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(BOOKING_STATUSES, {
    message:
      'status must be one of: pending_payment, confirmed, cancelled, completed, no_show, expired, rescheduled, deleted.',
  })
  readonly status?: BookingStatus;

  @ApiPropertyOptional({
    description: 'Filter private bookings by payment status.',
    enum: BOOKING_PAYMENT_STATUSES,
    example: 'not_required',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(BOOKING_PAYMENT_STATUSES, {
    message:
      'payment_status must be one of: not_required, pending, paid, failed, refunded, expired.',
  })
  readonly payment_status?: BookingPaymentStatus;

  @ApiPropertyOptional({
    description: 'Filter private bookings by trainer staff profile identifier.',
    example: '4df33c73-4fd5-46bb-a7a5-f5a9914de18a',
    format: 'uuid',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsUUID(BOOKING_UUID_VERSION, {
    message: 'trainer_staff_profile_id must be a valid UUID.',
  })
  readonly trainer_staff_profile_id?: string;

  @ApiPropertyOptional({
    description: 'Filter private bookings by customer user identifier.',
    example: '2c5a7d11-8e20-43c7-a9d1-6bb2d3d9d6b4',
    format: 'uuid',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsUUID(BOOKING_UUID_VERSION, {
    message: 'user_id must be a valid UUID.',
  })
  readonly user_id?: string;

  @ApiPropertyOptional({
    description:
      'Start date for private booking filtering. Format: YYYY-MM-DD.',
    example: '2026-06-20',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @Matches(BOOKING_DATE_PATTERN, {
    message: 'from_date must use YYYY-MM-DD format.',
  })
  readonly from_date?: string;

  @ApiPropertyOptional({
    description: 'End date for private booking filtering. Format: YYYY-MM-DD.',
    example: '2026-06-30',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @Matches(BOOKING_DATE_PATTERN, {
    message: 'to_date must use YYYY-MM-DD format.',
  })
  readonly to_date?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of admin private bookings to return.',
    example: PRIVATE_BOOKING_ADMIN_DEFAULT_LIMIT,
    default: PRIVATE_BOOKING_ADMIN_DEFAULT_LIMIT,
    minimum: 1,
    maximum: PRIVATE_BOOKING_ADMIN_MAX_LIMIT,
  })
  @Transform(optionalInteger)
  @IsOptional()
  @IsInt({
    message: 'limit must be an integer.',
  })
  @Min(1, {
    message: 'limit must be at least 1.',
  })
  @Max(PRIVATE_BOOKING_ADMIN_MAX_LIMIT, {
    message: `limit must not exceed ${PRIVATE_BOOKING_ADMIN_MAX_LIMIT}.`,
  })
  readonly limit: number = PRIVATE_BOOKING_ADMIN_DEFAULT_LIMIT;

  @ApiPropertyOptional({
    description: 'Number of admin private bookings to skip.',
    example: BOOKING_ADMIN_DEFAULT_OFFSET,
    default: BOOKING_ADMIN_DEFAULT_OFFSET,
    minimum: 0,
  })
  @Transform(optionalInteger)
  @IsOptional()
  @IsInt({
    message: 'offset must be an integer.',
  })
  @Min(0, {
    message: 'offset must be at least 0.',
  })
  readonly offset: number = BOOKING_ADMIN_DEFAULT_OFFSET;

  @ApiPropertyOptional({
    description: 'Field used to sort private bookings.',
    enum: PRIVATE_BOOKING_SORT_FIELDS,
    example: PRIVATE_BOOKING_DEFAULT_SORT_FIELD,
    default: PRIVATE_BOOKING_DEFAULT_SORT_FIELD,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PRIVATE_BOOKING_SORT_FIELDS, {
    message:
      'sort_by must be one of: created_at, session_date, start_time, status.',
  })
  readonly sort_by: PrivateBookingSortField =
    PRIVATE_BOOKING_DEFAULT_SORT_FIELD;

  @ApiPropertyOptional({
    description: 'Sort direction.',
    enum: BOOKING_SORT_DIRECTIONS,
    example: BOOKING_DEFAULT_SORT_DIRECTION,
    default: BOOKING_DEFAULT_SORT_DIRECTION,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(BOOKING_SORT_DIRECTIONS, {
    message: 'sort_direction must be either asc or desc.',
  })
  readonly sort_direction: BookingSortDirection =
    BOOKING_DEFAULT_SORT_DIRECTION;
}
