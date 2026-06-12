// apps/api/src/modules/bookings/dto/create-booking.dto.ts
/**
 * LAFAM Booking creation DTO.
 *
 * Role:
 * - Validates customer/admin booking creation payload shape.
 * - Accepts the Pilates schedule id the user wants to book.
 * - Accepts an optional idempotency key to protect retry/double-click flows.
 * - Accepts optional payment_required only for controlled backend/admin use.
 *
 * Important:
 * - This DTO validates request shape only.
 * - It does not check schedule existence.
 * - It does not check schedule capacity.
 * - It does not check duplicate booking state.
 * - It does not decide whether the user can book.
 * - Service/database transaction logic must own those checks.
 */

import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { BOOKING_IDEMPOTENCY_KEY_MAX_LENGTH } from '../constants/booking.constants';

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

export class CreateBookingDto {
  @IsUUID('4', {
    message: 'schedule_id must be a valid UUID.',
  })
  readonly schedule_id!: string;

  @IsOptional()
  @IsBoolean({
    message: 'payment_required must be a boolean value.',
  })
  readonly payment_required?: boolean;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeOptionalString(value))
  @IsString({
    message: 'idempotency_key must be a string.',
  })
  @MaxLength(BOOKING_IDEMPOTENCY_KEY_MAX_LENGTH, {
    message: `idempotency_key must not exceed ${BOOKING_IDEMPOTENCY_KEY_MAX_LENGTH} characters.`,
  })
  readonly idempotency_key?: string;
}
