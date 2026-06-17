// apps/api/src/modules/bookings/dto/list-admin-calendar-query.dto.ts
/**
 * LAFAM admin booking calendar query DTO.
 *
 * Role:
 * - Validates query parameters for the admin booking calendar endpoint.
 * - Supports date range filtering, trainer/class/customer filtering,
 *   event-type inclusion toggles, and safe sorting.
 *
 * Important:
 * - This DTO validates query shape only.
 * - Calendar range-size validation belongs in service logic.
 * - Admin authorization belongs in controller/service guards.
 * - Default calendar view includes class schedules and private trainer bookings.
 * - Class bookings and waitlist entries are excluded by default to avoid noisy calendars.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsUUID, Matches } from 'class-validator';

import {
  BOOKING_ADMIN_CALENDAR_DEFAULT_INCLUDE_CLASS_BOOKINGS,
  BOOKING_ADMIN_CALENDAR_DEFAULT_INCLUDE_CLASS_SCHEDULES,
  BOOKING_ADMIN_CALENDAR_DEFAULT_INCLUDE_PRIVATE_BOOKINGS,
  BOOKING_ADMIN_CALENDAR_DEFAULT_INCLUDE_WAITLIST,
  BOOKING_ADMIN_CALENDAR_MAX_RANGE_DAYS,
  BOOKING_CALENDAR_DEFAULT_SORT_DIRECTION,
  BOOKING_CALENDAR_DEFAULT_SORT_FIELD,
  BOOKING_CALENDAR_SORT_FIELDS,
  BOOKING_DATE_PATTERN,
  BOOKING_SORT_DIRECTIONS,
  BOOKING_UUID_VERSION,
  type BookingCalendarSortField,
  type BookingSortDirection,
} from '../constants/booking.constants';

function requiredTrimmedString({ value }: TransformFnParams): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
}

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

function optionalBoolean({ value }: TransformFnParams): unknown {
  if (typeof value === 'undefined' || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (['true', '1', 'yes'].includes(normalizedValue)) {
    return true;
  }

  if (['false', '0', 'no'].includes(normalizedValue)) {
    return false;
  }

  return value;
}

export class ListAdminCalendarQueryDto {
  @ApiProperty({
    description: `Calendar start date. Format: YYYY-MM-DD. Maximum supported range is ${BOOKING_ADMIN_CALENDAR_MAX_RANGE_DAYS} days.`,
    example: '2026-06-20',
  })
  @Transform(requiredTrimmedString)
  @Matches(BOOKING_DATE_PATTERN, {
    message: 'from_date must use YYYY-MM-DD format.',
  })
  readonly from_date!: string;

  @ApiProperty({
    description: `Calendar end date. Format: YYYY-MM-DD. Maximum supported range is ${BOOKING_ADMIN_CALENDAR_MAX_RANGE_DAYS} days.`,
    example: '2026-06-30',
  })
  @Transform(requiredTrimmedString)
  @Matches(BOOKING_DATE_PATTERN, {
    message: 'to_date must use YYYY-MM-DD format.',
  })
  readonly to_date!: string;

  @ApiPropertyOptional({
    description: 'Filter calendar events by trainer staff profile identifier.',
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
    description: 'Filter calendar events by Pilates class identifier.',
    example: '9b5b8e3e-8e27-4f5d-a4f8-6f85f8b6f9f1',
    format: 'uuid',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsUUID(BOOKING_UUID_VERSION, {
    message: 'class_id must be a valid UUID.',
  })
  readonly class_id?: string;

  @ApiPropertyOptional({
    description: 'Filter calendar events by customer user identifier.',
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
    description: 'Whether Pilates class schedule events should be included.',
    example: BOOKING_ADMIN_CALENDAR_DEFAULT_INCLUDE_CLASS_SCHEDULES,
    default: BOOKING_ADMIN_CALENDAR_DEFAULT_INCLUDE_CLASS_SCHEDULES,
  })
  @Transform(optionalBoolean)
  @IsOptional()
  @IsBoolean({
    message: 'include_class_schedules must be a boolean.',
  })
  readonly include_class_schedules?: boolean =
    BOOKING_ADMIN_CALENDAR_DEFAULT_INCLUDE_CLASS_SCHEDULES;

  @ApiPropertyOptional({
    description:
      'Whether individual Pilates class booking events should be included.',
    example: BOOKING_ADMIN_CALENDAR_DEFAULT_INCLUDE_CLASS_BOOKINGS,
    default: BOOKING_ADMIN_CALENDAR_DEFAULT_INCLUDE_CLASS_BOOKINGS,
  })
  @Transform(optionalBoolean)
  @IsOptional()
  @IsBoolean({
    message: 'include_class_bookings must be a boolean.',
  })
  readonly include_class_bookings?: boolean =
    BOOKING_ADMIN_CALENDAR_DEFAULT_INCLUDE_CLASS_BOOKINGS;

  @ApiPropertyOptional({
    description: 'Whether waitlist entry events should be included.',
    example: BOOKING_ADMIN_CALENDAR_DEFAULT_INCLUDE_WAITLIST,
    default: BOOKING_ADMIN_CALENDAR_DEFAULT_INCLUDE_WAITLIST,
  })
  @Transform(optionalBoolean)
  @IsOptional()
  @IsBoolean({
    message: 'include_waitlist must be a boolean.',
  })
  readonly include_waitlist?: boolean =
    BOOKING_ADMIN_CALENDAR_DEFAULT_INCLUDE_WAITLIST;

  @ApiPropertyOptional({
    description: 'Whether private trainer booking events should be included.',
    example: BOOKING_ADMIN_CALENDAR_DEFAULT_INCLUDE_PRIVATE_BOOKINGS,
    default: BOOKING_ADMIN_CALENDAR_DEFAULT_INCLUDE_PRIVATE_BOOKINGS,
  })
  @Transform(optionalBoolean)
  @IsOptional()
  @IsBoolean({
    message: 'include_private_bookings must be a boolean.',
  })
  readonly include_private_bookings?: boolean =
    BOOKING_ADMIN_CALENDAR_DEFAULT_INCLUDE_PRIVATE_BOOKINGS;

  @ApiPropertyOptional({
    description: 'Field used to sort calendar events.',
    enum: BOOKING_CALENDAR_SORT_FIELDS,
    example: BOOKING_CALENDAR_DEFAULT_SORT_FIELD,
    default: BOOKING_CALENDAR_DEFAULT_SORT_FIELD,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(BOOKING_CALENDAR_SORT_FIELDS, {
    message: 'sort_by must be one of: start_at, event_type, status.',
  })
  readonly sort_by: BookingCalendarSortField =
    BOOKING_CALENDAR_DEFAULT_SORT_FIELD;

  @ApiPropertyOptional({
    description: 'Calendar sort direction.',
    enum: BOOKING_SORT_DIRECTIONS,
    example: BOOKING_CALENDAR_DEFAULT_SORT_DIRECTION,
    default: BOOKING_CALENDAR_DEFAULT_SORT_DIRECTION,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(BOOKING_SORT_DIRECTIONS, {
    message: 'sort_direction must be either asc or desc.',
  })
  readonly sort_direction: BookingSortDirection =
    BOOKING_CALENDAR_DEFAULT_SORT_DIRECTION;
}
