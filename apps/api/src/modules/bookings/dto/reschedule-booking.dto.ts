// apps/api/src/modules/bookings/dto/reschedule-booking.dto.ts
/**
 * LAFAM Booking reschedule DTO.
 *
 * Role:
 * - Validates booking reschedule payload shape.
 * - Accepts the target Pilates schedule id.
 * - Accepts optional waitlist fallback behavior when the target schedule is full.
 * - Accepts an optional human-readable reschedule reason.
 *
 * Important:
 * - This DTO validates request shape only.
 * - It does not check whether the original booking exists.
 * - It does not check whether the target schedule exists.
 * - It does not check target schedule capacity.
 * - It does not check booking ownership.
 * - It does not decide whether the booking can be rescheduled.
 * - Service/domain policy/database transaction logic must own those checks.
 */

import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { BOOKING_CANCEL_REASON_MAX_LENGTH } from '../constants/booking.constants';

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

export class RescheduleBookingDto {
  @IsUUID('4', {
    message: 'target_schedule_id must be a valid UUID.',
  })
  readonly target_schedule_id!: string;

  @IsOptional()
  @IsBoolean({
    message: 'join_waitlist_if_full must be a boolean value.',
  })
  readonly join_waitlist_if_full?: boolean;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeOptionalString(value))
  @IsString({
    message: 'reason must be a string.',
  })
  @MaxLength(BOOKING_CANCEL_REASON_MAX_LENGTH, {
    message: `reason must not exceed ${BOOKING_CANCEL_REASON_MAX_LENGTH} characters.`,
  })
  readonly reason?: string;
}
