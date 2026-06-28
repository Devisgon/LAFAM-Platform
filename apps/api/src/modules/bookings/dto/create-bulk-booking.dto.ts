// apps/api/src/modules/bookings/dto/create-bulk-booking.dto.ts
/**
 * LAFAM customer bulk booking creation DTO.
 *
 * Role:
 * - Validates customer-facing bulk Pilates booking creation payload shape.
 * - Accepts multiple Pilates schedule IDs selected from a date-first schedule list.
 * - Accepts an optional idempotency key to protect retry/double-click flows.
 *
 * Important:
 * - This DTO validates request shape only.
 * - It does not check schedule existence.
 * - It does not check schedule capacity.
 * - It does not check duplicate active bookings.
 * - It does not calculate prices.
 * - It does not accept payment_required, payment_status, status, price, or currency.
 * - Service/database transaction logic owns booking, payment, and seat-hold truth.
 */

import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import {
  BOOKING_BULK_MAX_SCHEDULE_COUNT,
  BOOKING_BULK_MIN_SCHEDULE_COUNT,
  BOOKING_IDEMPOTENCY_KEY_MAX_LENGTH,
} from '../constants/booking.constants';

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function normalizeScheduleIds(value: unknown): unknown {
  if (!isUnknownArray(value)) {
    return value;
  }

  return value.map((item: unknown): unknown => {
    if (typeof item !== 'string') {
      return item;
    }

    return item.trim();
  });
}

export class CreateBulkBookingDto {
  @Transform(({ value }: { value: unknown }) => normalizeScheduleIds(value))
  @IsArray({
    message: 'schedule_ids must be an array.',
  })
  @ArrayMinSize(BOOKING_BULK_MIN_SCHEDULE_COUNT, {
    message: `schedule_ids must contain at least ${BOOKING_BULK_MIN_SCHEDULE_COUNT} schedule.`,
  })
  @ArrayMaxSize(BOOKING_BULK_MAX_SCHEDULE_COUNT, {
    message: `schedule_ids must not contain more than ${BOOKING_BULK_MAX_SCHEDULE_COUNT} schedules.`,
  })
  @ArrayUnique({
    message: 'schedule_ids must not contain duplicate schedules.',
  })
  @IsUUID('4', {
    each: true,
    message: 'Each schedule_id must be a valid UUID.',
  })
  readonly schedule_ids!: string[];

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
