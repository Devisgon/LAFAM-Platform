// apps/api/src/modules/bookings/dto/reschedule-private-booking.dto.ts
/**
 * LAFAM reschedule private trainer booking DTO.
 *
 * Role:
 * - Validates request body for rescheduling a private one-on-one trainer booking.
 * - Captures the new target date, start time, optional duration, optional studio,
 *   optional reason, optional idempotency key, and optional payment requirement.
 *
 * Important:
 * - private_booking_id is not accepted from the body; it belongs in the route param.
 * - end_time is not accepted from the client.
 * - Backend calculates end_time from target_start_time + target_duration_minutes.
 * - If target_duration_minutes is omitted, service logic may preserve the existing booking duration.
 * - If studio is omitted, service logic may preserve the existing booking studio.
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
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import {
  BOOKING_CANCEL_REASON_MAX_LENGTH,
  BOOKING_DATE_PATTERN,
  BOOKING_DEFAULT_PAYMENT_REQUIRED,
  BOOKING_IDEMPOTENCY_KEY_MAX_LENGTH,
  BOOKING_TIME_VALUE_PATTERN,
  PRIVATE_BOOKING_DEFAULT_DURATION_MINUTES,
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

export class ReschedulePrivateBookingDto {
  @ApiProperty({
    description: 'New private session date. Format: YYYY-MM-DD.',
    example: '2026-06-21',
  })
  @Transform(requiredTrimmedString)
  @Matches(BOOKING_DATE_PATTERN, {
    message: 'target_session_date must use YYYY-MM-DD format.',
  })
  readonly target_session_date!: string;

  @ApiProperty({
    description: 'New private session start time in 24-hour HH:mm format.',
    example: '12:00',
  })
  @Transform(requiredTrimmedString)
  @Matches(BOOKING_TIME_VALUE_PATTERN, {
    message: 'target_start_time must use HH:mm 24-hour format.',
  })
  readonly target_start_time!: string;

  @ApiPropertyOptional({
    description:
      'New private session duration in minutes. If omitted, service logic may preserve the existing booking duration.',
    example: PRIVATE_BOOKING_DEFAULT_DURATION_MINUTES,
    minimum: PRIVATE_BOOKING_DURATION_MIN_MINUTES,
    maximum: PRIVATE_BOOKING_DURATION_MAX_MINUTES,
  })
  @Transform(optionalInteger)
  @IsOptional()
  @IsInt({
    message: 'target_duration_minutes must be an integer.',
  })
  @Min(PRIVATE_BOOKING_DURATION_MIN_MINUTES, {
    message: `target_duration_minutes must be at least ${PRIVATE_BOOKING_DURATION_MIN_MINUTES}.`,
  })
  @Max(PRIVATE_BOOKING_DURATION_MAX_MINUTES, {
    message: `target_duration_minutes must not exceed ${PRIVATE_BOOKING_DURATION_MAX_MINUTES}.`,
  })
  readonly target_duration_minutes?: number;

  @ApiPropertyOptional({
    description:
      'New studio or room for the private trainer session. If omitted, service logic may preserve the existing booking studio.',
    example: PRIVATE_BOOKING_DEFAULT_STUDIO,
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
  readonly studio?: string;

  @ApiPropertyOptional({
    description: 'Reason for rescheduling the private trainer booking.',
    example: 'Customer requested a later time.',
    maxLength: BOOKING_CANCEL_REASON_MAX_LENGTH,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsString({
    message: 'reason must be a string.',
  })
  @MaxLength(BOOKING_CANCEL_REASON_MAX_LENGTH, {
    message: `reason must not exceed ${BOOKING_CANCEL_REASON_MAX_LENGTH} characters.`,
  })
  readonly reason?: string;

  @ApiPropertyOptional({
    description:
      'Idempotency key used to safely retry private booking rescheduling without creating duplicate replacement bookings.',
    example: 'private-reschedule-2026-06-21-12-00-user-2c5a7d11',
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

  @ApiPropertyOptional({
    description:
      'Whether the replacement private booking requires payment before confirmation. If omitted, service logic may preserve the existing payment behavior.',
    example: BOOKING_DEFAULT_PAYMENT_REQUIRED,
  })
  @Transform(optionalBoolean)
  @IsOptional()
  @IsBoolean({
    message: 'payment_required must be a boolean.',
  })
  readonly payment_required?: boolean;
}
