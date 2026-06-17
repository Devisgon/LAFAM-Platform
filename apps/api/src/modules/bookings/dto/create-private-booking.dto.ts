// apps/api/src/modules/bookings/dto/create-private-booking.dto.ts
/**
 * LAFAM create private trainer booking DTO.
 *
 * Role:
 * - Validates request body for creating a private one-on-one trainer booking.
 * - Supports customer self-booking and admin-created private bookings.
 * - Captures trainer, date, start time, duration, studio, payment requirement,
 *   and idempotency key.
 *
 * Important:
 * - Private trainer bookings do not use pilates_class_schedules.
 * - end_time is not accepted from the client.
 * - Backend calculates end_time from start_time + duration_minutes.
 * - user_id is optional here because customer routes resolve it from auth.
 * - Admin routes may require user_id in service logic.
 * - Trainer availability, trainer conflicts, class schedule conflicts, and private
 *   booking conflicts are handled in service/repository/RPC logic.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import {
  BOOKING_DATE_PATTERN,
  BOOKING_DEFAULT_PAYMENT_REQUIRED,
  BOOKING_IDEMPOTENCY_KEY_MAX_LENGTH,
  BOOKING_TIME_VALUE_PATTERN,
  BOOKING_UUID_VERSION,
  PRIVATE_BOOKING_DEFAULT_DURATION_MINUTES,
  PRIVATE_BOOKING_DEFAULT_PAYMENT_REQUIRED,
  PRIVATE_BOOKING_DEFAULT_STUDIO,
  PRIVATE_BOOKING_DURATION_MAX_MINUTES,
  PRIVATE_BOOKING_DURATION_MIN_MINUTES,
  PRIVATE_BOOKING_STUDIO_MAX_LENGTH,
  PRIVATE_BOOKING_STUDIO_MIN_LENGTH,
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

export class CreatePrivateBookingDto {
  @ApiPropertyOptional({
    description:
      'Customer user identifier. Required for admin-created private bookings. Customer self-booking routes resolve this from auth.',
    example: '2c5a7d11-8e20-43c7-a9d1-6bb2d3d9d6b4',
    format: 'uuid',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsUUID(BOOKING_UUID_VERSION, {
    message: 'user_id must be a valid UUID.',
  })
  readonly user_id?: string;

  @ApiProperty({
    description: 'Trainer staff profile identifier for the private session.',
    example: '4df33c73-4fd5-46bb-a7a5-f5a9914de18a',
    format: 'uuid',
  })
  @Transform(requiredTrimmedString)
  @IsUUID(BOOKING_UUID_VERSION, {
    message: 'trainer_staff_profile_id must be a valid UUID.',
  })
  readonly trainer_staff_profile_id!: string;

  @ApiProperty({
    description: 'Private session date. Format: YYYY-MM-DD.',
    example: '2026-06-20',
  })
  @Transform(requiredTrimmedString)
  @Matches(BOOKING_DATE_PATTERN, {
    message: 'session_date must use YYYY-MM-DD format.',
  })
  readonly session_date!: string;

  @ApiProperty({
    description: 'Private session start time in 24-hour HH:mm format.',
    example: '11:00',
  })
  @Transform(requiredTrimmedString)
  @Matches(BOOKING_TIME_VALUE_PATTERN, {
    message: 'start_time must use HH:mm 24-hour format.',
  })
  readonly start_time!: string;

  @ApiPropertyOptional({
    description:
      'Private session duration in minutes. Backend calculates end_time from this value.',
    example: PRIVATE_BOOKING_DEFAULT_DURATION_MINUTES,
    default: PRIVATE_BOOKING_DEFAULT_DURATION_MINUTES,
    minimum: PRIVATE_BOOKING_DURATION_MIN_MINUTES,
    maximum: PRIVATE_BOOKING_DURATION_MAX_MINUTES,
  })
  @Transform(optionalInteger)
  @IsOptional()
  @IsInt({
    message: 'duration_minutes must be an integer.',
  })
  @Min(PRIVATE_BOOKING_DURATION_MIN_MINUTES, {
    message: `duration_minutes must be at least ${PRIVATE_BOOKING_DURATION_MIN_MINUTES}.`,
  })
  @Max(PRIVATE_BOOKING_DURATION_MAX_MINUTES, {
    message: `duration_minutes must not exceed ${PRIVATE_BOOKING_DURATION_MAX_MINUTES}.`,
  })
  readonly duration_minutes?: number = PRIVATE_BOOKING_DEFAULT_DURATION_MINUTES;

  @ApiPropertyOptional({
    description:
      'Studio or room where the private trainer session will happen.',
    example: PRIVATE_BOOKING_DEFAULT_STUDIO,
    default: PRIVATE_BOOKING_DEFAULT_STUDIO,
    minLength: PRIVATE_BOOKING_STUDIO_MIN_LENGTH,
    maxLength: PRIVATE_BOOKING_STUDIO_MAX_LENGTH,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsString({
    message: 'studio must be a string.',
  })
  @MinLength(PRIVATE_BOOKING_STUDIO_MIN_LENGTH, {
    message: `studio must be at least ${PRIVATE_BOOKING_STUDIO_MIN_LENGTH} characters long.`,
  })
  @MaxLength(PRIVATE_BOOKING_STUDIO_MAX_LENGTH, {
    message: `studio must not exceed ${PRIVATE_BOOKING_STUDIO_MAX_LENGTH} characters.`,
  })
  readonly studio?: string = PRIVATE_BOOKING_DEFAULT_STUDIO;

  @ApiPropertyOptional({
    description:
      'Whether this private booking requires payment before confirmation.',
    example: BOOKING_DEFAULT_PAYMENT_REQUIRED,
    default: PRIVATE_BOOKING_DEFAULT_PAYMENT_REQUIRED,
  })
  @Transform(optionalBoolean)
  @IsOptional()
  @IsBoolean({
    message: 'payment_required must be a boolean.',
  })
  readonly payment_required?: boolean =
    PRIVATE_BOOKING_DEFAULT_PAYMENT_REQUIRED;

  @ApiPropertyOptional({
    description:
      'Idempotency key used to safely retry private booking creation without creating duplicates.',
    example: 'private-booking-2026-06-20-11-00-user-2c5a7d11',
    maxLength: BOOKING_IDEMPOTENCY_KEY_MAX_LENGTH,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsString({
    message: 'idempotency_key must be a string.',
  })
  @MaxLength(BOOKING_IDEMPOTENCY_KEY_MAX_LENGTH, {
    message: `idempotency_key must not exceed ${BOOKING_IDEMPOTENCY_KEY_MAX_LENGTH} characters.`,
  })
  readonly idempotency_key?: string;
}
