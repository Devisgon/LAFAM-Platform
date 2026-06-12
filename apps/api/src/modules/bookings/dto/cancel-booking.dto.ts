// apps/api/src/modules/bookings/dto/cancel-booking.dto.ts
/**
 * LAFAM Booking cancellation DTO.
 *
 * Role:
 * - Validates booking cancellation payload shape.
 * - Accepts an optional human-readable cancellation reason.
 *
 * Important:
 * - This DTO validates request shape only.
 * - It does not check whether the booking exists.
 * - It does not check booking ownership.
 * - It does not check whether the booking can be cancelled.
 * - Service/domain policy logic must own lifecycle and authorization checks.
 */

import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { BOOKING_CANCEL_REASON_MAX_LENGTH } from '../constants/booking.constants';

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

export class CancelBookingDto {
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
