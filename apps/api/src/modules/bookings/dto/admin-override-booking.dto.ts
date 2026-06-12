// apps/api/src/modules/bookings/dto/admin-override-booking.dto.ts
/**
 * LAFAM admin booking override DTO.
 *
 * Role:
 * - Validates admin booking override payload shape.
 * - Accepts the target booking status.
 * - Requires a human-readable reason for audit clarity.
 * - Accepts optional admin notes for internal context.
 *
 * Important:
 * - This DTO validates request shape only.
 * - It does not check whether the booking exists.
 * - It does not check whether the admin has permission.
 * - It does not decide whether the requested status transition is allowed.
 * - It does not allow silent override without an audit reason.
 * - Service/domain policy logic must own lifecycle and authorization checks.
 */

import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import {
  BOOKING_ADMIN_NOTES_MAX_LENGTH,
  BOOKING_CANCEL_REASON_MAX_LENGTH,
  BOOKING_STATUSES,
  type BookingStatus,
} from '../constants/booking.constants';

function normalizeRequiredString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

export class AdminOverrideBookingDto {
  @Transform(({ value }: { value: unknown }) => normalizeRequiredString(value))
  @IsString({
    message: 'target_status must be a string.',
  })
  @IsNotEmpty({
    message: 'target_status is required.',
  })
  @IsIn(BOOKING_STATUSES, {
    message: `target_status must be one of: ${BOOKING_STATUSES.join(', ')}.`,
  })
  readonly target_status!: BookingStatus;

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

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeOptionalString(value))
  @IsString({
    message: 'admin_notes must be a string.',
  })
  @MaxLength(BOOKING_ADMIN_NOTES_MAX_LENGTH, {
    message: `admin_notes must not exceed ${BOOKING_ADMIN_NOTES_MAX_LENGTH} characters.`,
  })
  readonly admin_notes?: string;
}
