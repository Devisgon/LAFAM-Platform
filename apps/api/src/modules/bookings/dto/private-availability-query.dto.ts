// apps/api/src/modules/bookings/dto/private-availability-query.dto.ts
/**
 * LAFAM private trainer availability query DTO.
 *
 * Role:
 * - Validates query parameters for checking private trainer booking availability.
 * - Captures date range, session duration, and optional studio filter.
 *
 * Important:
 * - trainer id belongs in the route param, not in this query DTO.
 * - This DTO validates query shape only.
 * - It does not calculate available slots.
 * - It does not check trainer profile status.
 * - It does not check trainer schedule conflicts.
 * - Availability calculation belongs in service/repository logic.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
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
  BOOKING_DATE_PATTERN,
  PRIVATE_BOOKING_AVAILABILITY_MAX_RANGE_DAYS,
  PRIVATE_BOOKING_AVAILABILITY_SLOT_INTERVAL_MINUTES,
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

export class PrivateAvailabilityQueryDto {
  @ApiProperty({
    description:
      'Availability start date. Format: YYYY-MM-DD. Service logic enforces the maximum range.',
    example: '2026-06-20',
  })
  @Transform(requiredTrimmedString)
  @Matches(BOOKING_DATE_PATTERN, {
    message: 'from_date must use YYYY-MM-DD format.',
  })
  readonly from_date!: string;

  @ApiProperty({
    description: `Availability end date. Format: YYYY-MM-DD. Maximum supported range is ${PRIVATE_BOOKING_AVAILABILITY_MAX_RANGE_DAYS} days.`,
    example: '2026-06-30',
  })
  @Transform(requiredTrimmedString)
  @Matches(BOOKING_DATE_PATTERN, {
    message: 'to_date must use YYYY-MM-DD format.',
  })
  readonly to_date!: string;

  @ApiPropertyOptional({
    description: `Requested private session duration in minutes. Availability slots are generated on ${PRIVATE_BOOKING_AVAILABILITY_SLOT_INTERVAL_MINUTES}-minute boundaries.`,
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
      'Optional studio or room filter for private trainer availability.',
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
}
