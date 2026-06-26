// apps/api/src/modules/bookings/dto/create-admin-bulk-booking.dto.ts
/**
 * LAFAM admin/staff/trainer bulk booking creation DTO.
 *
 * Role:
 * - Validates admin-facing bulk Pilates booking creation payload shape.
 * - Requires the target customer user ID.
 * - Accepts multiple Pilates schedule IDs selected from a date-first schedule list.
 * - Accepts optional idempotency and admin notes.
 *
 * Important:
 * - This DTO validates request shape only.
 * - It does not decide whether the actor is admin, staff, or trainer.
 * - It does not check trainer schedule ownership.
 * - It does not check customer existence.
 * - It does not check schedule existence.
 * - It does not check schedule capacity.
 * - It does not calculate prices.
 * - It does not accept payment_required, payment_status, status, price, currency, or created_by fields.
 * - Service/database transaction logic owns authorization, pricing, payment-required enforcement, and seat-hold truth.
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
  BOOKING_ORDER_ADMIN_NOTES_MAX_LENGTH,
} from '../constants/booking.constants';

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function normalizeRequiredString(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
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

export class CreateAdminBulkBookingDto {
  @Transform(({ value }: { value: unknown }) => normalizeRequiredString(value))
  @IsUUID('4', {
    message: 'customer_user_id must be a valid UUID.',
  })
  readonly customer_user_id!: string;

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

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeOptionalString(value))
  @IsString({
    message: 'admin_notes must be a string.',
  })
  @MaxLength(BOOKING_ORDER_ADMIN_NOTES_MAX_LENGTH, {
    message: `admin_notes must not exceed ${BOOKING_ORDER_ADMIN_NOTES_MAX_LENGTH} characters.`,
  })
  readonly admin_notes?: string;
}
