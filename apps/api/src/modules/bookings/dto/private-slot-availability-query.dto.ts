import { Transform, type TransformFnParams } from 'class-transformer';
import { IsInt, Matches, Max, Min } from 'class-validator';

import {
  BOOKING_DATE_PATTERN,
  BOOKING_TIME_VALUE_PATTERN,
  PRIVATE_BOOKING_DEFAULT_DURATION_MINUTES,
  PRIVATE_BOOKING_DURATION_MAX_MINUTES,
  PRIVATE_BOOKING_DURATION_MIN_MINUTES,
} from '../constants/booking.constants';

function trimmedString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function integer({ value }: TransformFnParams): unknown {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string' || !/^\d+$/u.test(value.trim())) return value;
  return Number(value);
}

export class PrivateSlotAvailabilityQueryDto {
  @Transform(trimmedString)
  @Matches(BOOKING_DATE_PATTERN, {
    message: 'session_date must use YYYY-MM-DD format.',
  })
  readonly session_date!: string;

  @Transform(trimmedString)
  @Matches(BOOKING_TIME_VALUE_PATTERN, {
    message: 'start_time must use HH:mm format.',
  })
  readonly start_time!: string;

  @Transform(integer)
  @IsInt({ message: 'duration_minutes must be an integer.' })
  @Min(PRIVATE_BOOKING_DURATION_MIN_MINUTES)
  @Max(PRIVATE_BOOKING_DURATION_MAX_MINUTES)
  readonly duration_minutes: number = PRIVATE_BOOKING_DEFAULT_DURATION_MINUTES;
}
