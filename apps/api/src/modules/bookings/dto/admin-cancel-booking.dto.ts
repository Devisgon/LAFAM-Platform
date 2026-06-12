// apps/api/src/modules/bookings/dto/admin-cancel-booking.dto.ts
/**
 * LAFAM admin booking cancellation DTO.
 *
 * Role:
 * - Validates admin booking cancellation payload shape.
 * - Requires a human-readable cancellation reason for audit clarity.
 *
 * Important:
 * - This DTO validates request shape only.
 * - It does not check whether the booking exists.
 * - It does not check whether the admin has permission.
 * - It does not check whether the booking can be cancelled.
 * - Service/domain policy logic must own lifecycle and authorization checks.
 */

import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { BOOKING_CANCEL_REASON_MAX_LENGTH } from '../constants/booking.constants';

function normalizeRequiredString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

export class AdminCancelBookingDto {
  @Transform(({ value }: { value: unknown }) => normalizeRequiredString(value))
  @IsString({
    message: 'reason must be a string.',
  })
  @IsNotEmpty({
    message: 'reason is required.',
  })
  @MaxLength(BOOKING_CANCEL_REASON_MAX_LENGTH, {
    message: `reason must not exceed ${BOOKING_CANCEL_REASON_MAX_LENGTH} characters.`,
  })
  readonly reason!: string;
}
