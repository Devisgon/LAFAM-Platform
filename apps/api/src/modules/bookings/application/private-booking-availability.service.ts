// apps/api/src/modules/bookings/application/private-booking-availability.service.ts
/**
 * LAFAM private booking availability service.
 *
 * Role:
 * - Calculates available one-on-one private trainer booking slots.
 * - Uses the BookingRepository RPC helpers for trainer availability and conflict checks.
 * - Returns normalized availability slots for a trainer over a requested date range.
 *
 * Important:
 * - This service does not create bookings.
 * - This service does not mutate database state.
 * - This service does not trust query params without policy validation.
 * - Trainer availability is checked through database-backed helper functions.
 * - Trainer conflicts are checked against both Pilates class schedules and private trainer bookings.
 */

import { Injectable } from '@nestjs/common';

import {
  PRIVATE_BOOKING_AVAILABILITY_SLOT_INTERVAL_MINUTES,
  PRIVATE_BOOKING_DEFAULT_DURATION_MINUTES,
} from '../constants/booking.constants';
import type { PrivateAvailabilityQueryDto } from '../dto/private-availability-query.dto';
import { PrivateBookingLifecyclePolicy } from '../domain/private-booking-lifecycle.policy';
import { BookingRepository } from '../repositories/booking.repository';
import type {
  BookingIsoDateString,
  BookingTimeString,
  PrivateBookingAvailabilityResult,
  PrivateBookingAvailabilitySlot,
} from '../types/booking.types';

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

function formatMinutesToTime(totalMinutes: number): BookingTimeString {
  const hour = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minute = totalMinutes % MINUTES_PER_HOUR;

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function parseIsoDate(dateValue: string): Date {
  const [yearText, monthText, dayText] = dateValue.split('-');

  return new Date(
    Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)),
  );
}

function formatIsoDate(date: Date): BookingIsoDateString {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date.getTime());

  nextDate.setUTCDate(nextDate.getUTCDate() + days);

  return nextDate;
}

function eachDateInRange(
  fromDate: BookingIsoDateString,
  toDate: BookingIsoDateString,
): readonly BookingIsoDateString[] {
  const dates: BookingIsoDateString[] = [];
  const startDate = parseIsoDate(fromDate);
  const endDate = parseIsoDate(toDate);

  for (
    let cursor = startDate;
    cursor.getTime() <= endDate.getTime();
    cursor = addDays(cursor, 1)
  ) {
    dates.push(formatIsoDate(cursor));
  }

  return dates;
}

function buildSlotDateTime(
  dateValue: BookingIsoDateString,
  timeValue: BookingTimeString,
): string {
  return `${dateValue}T${timeValue}:00.000Z`;
}

function isSlotInPast(
  dateValue: BookingIsoDateString,
  startTime: BookingTimeString,
): boolean {
  const startsAt = new Date(buildSlotDateTime(dateValue, startTime)).getTime();

  return startsAt < Date.now();
}

function buildUnavailableSlot(input: {
  readonly trainerStaffProfileId: string;
  readonly sessionDate: BookingIsoDateString;
  readonly startTime: BookingTimeString;
  readonly endTime: BookingTimeString;
  readonly durationMinutes: number;
  readonly unavailableReason: string;
}): PrivateBookingAvailabilitySlot {
  return {
    trainer_staff_profile_id: input.trainerStaffProfileId,
    session_date: input.sessionDate,
    start_time: input.startTime,
    end_time: input.endTime,
    duration_minutes: input.durationMinutes,
    available: false,
    unavailable_reason: input.unavailableReason,
  };
}

function buildAvailableSlot(input: {
  readonly trainerStaffProfileId: string;
  readonly sessionDate: BookingIsoDateString;
  readonly startTime: BookingTimeString;
  readonly endTime: BookingTimeString;
  readonly durationMinutes: number;
}): PrivateBookingAvailabilitySlot {
  return {
    trainer_staff_profile_id: input.trainerStaffProfileId,
    session_date: input.sessionDate,
    start_time: input.startTime,
    end_time: input.endTime,
    duration_minutes: input.durationMinutes,
    available: true,
    unavailable_reason: null,
  };
}

@Injectable()
export class PrivateBookingAvailabilityService {
  constructor(private readonly bookingRepository: BookingRepository) {}

  async getTrainerAvailability(
    trainerStaffProfileId: string,
    dto: PrivateAvailabilityQueryDto,
  ): Promise<PrivateBookingAvailabilityResult> {
    const fromDate = PrivateBookingLifecyclePolicy.normalizeIsoDate(
      dto.from_date,
      'from_date',
    );
    const toDate = PrivateBookingLifecyclePolicy.normalizeIsoDate(
      dto.to_date,
      'to_date',
    );
    const durationMinutes =
      dto.duration_minutes ?? PRIVATE_BOOKING_DEFAULT_DURATION_MINUTES;

    PrivateBookingLifecyclePolicy.assertPrivateAvailabilityRangeAllowed(
      fromDate,
      toDate,
    );
    PrivateBookingLifecyclePolicy.assertPrivateBookingDuration(durationMinutes);

    const dates = eachDateInRange(fromDate, toDate);
    const slots: PrivateBookingAvailabilitySlot[] = [];

    for (const sessionDate of dates) {
      const dateSlots = await this.buildSlotsForDate({
        trainerStaffProfileId,
        sessionDate,
        durationMinutes,
      });

      slots.push(...dateSlots);
    }

    return {
      trainer_staff_profile_id: trainerStaffProfileId,
      from_date: fromDate,
      to_date: toDate,
      duration_minutes: durationMinutes,
      slots,
    };
  }

  private async buildSlotsForDate(input: {
    readonly trainerStaffProfileId: string;
    readonly sessionDate: BookingIsoDateString;
    readonly durationMinutes: number;
  }): Promise<readonly PrivateBookingAvailabilitySlot[]> {
    const slots: PrivateBookingAvailabilitySlot[] = [];

    for (
      let startMinutes = 0;
      startMinutes + input.durationMinutes < MINUTES_PER_DAY;
      startMinutes += PRIVATE_BOOKING_AVAILABILITY_SLOT_INTERVAL_MINUTES
    ) {
      const startTime = formatMinutesToTime(startMinutes);
      const endTime = formatMinutesToTime(startMinutes + input.durationMinutes);

      const slot = await this.buildSlotAvailability({
        trainerStaffProfileId: input.trainerStaffProfileId,
        sessionDate: input.sessionDate,
        startTime,
        endTime,
        durationMinutes: input.durationMinutes,
      });

      if (slot.available) {
        slots.push(slot);
      }
    }

    return slots;
  }

  private async buildSlotAvailability(input: {
    readonly trainerStaffProfileId: string;
    readonly sessionDate: BookingIsoDateString;
    readonly startTime: BookingTimeString;
    readonly endTime: BookingTimeString;
    readonly durationMinutes: number;
  }): Promise<PrivateBookingAvailabilitySlot> {
    if (isSlotInPast(input.sessionDate, input.startTime)) {
      return buildUnavailableSlot({
        trainerStaffProfileId: input.trainerStaffProfileId,
        sessionDate: input.sessionDate,
        startTime: input.startTime,
        endTime: input.endTime,
        durationMinutes: input.durationMinutes,
        unavailableReason: 'past_slot',
      });
    }

    const isStaffAvailable =
      await this.bookingRepository.isStaffAvailableForPrivateTime({
        trainer_staff_profile_id: input.trainerStaffProfileId,
        session_date: input.sessionDate,
        start_time: input.startTime,
        end_time: input.endTime,
      });

    if (!isStaffAvailable) {
      return buildUnavailableSlot({
        trainerStaffProfileId: input.trainerStaffProfileId,
        sessionDate: input.sessionDate,
        startTime: input.startTime,
        endTime: input.endTime,
        durationMinutes: input.durationMinutes,
        unavailableReason: 'trainer_not_available',
      });
    }

    const hasClassScheduleConflict =
      await this.bookingRepository.hasTrainerClassScheduleConflict({
        trainer_staff_profile_id: input.trainerStaffProfileId,
        session_date: input.sessionDate,
        start_time: input.startTime,
        end_time: input.endTime,
      });

    if (hasClassScheduleConflict) {
      return buildUnavailableSlot({
        trainerStaffProfileId: input.trainerStaffProfileId,
        sessionDate: input.sessionDate,
        startTime: input.startTime,
        endTime: input.endTime,
        durationMinutes: input.durationMinutes,
        unavailableReason: 'pilates_class_schedule_conflict',
      });
    }

    const hasPrivateBookingConflict =
      await this.bookingRepository.hasTrainerPrivateBookingConflict({
        trainer_staff_profile_id: input.trainerStaffProfileId,
        session_date: input.sessionDate,
        start_time: input.startTime,
        end_time: input.endTime,
      });

    if (hasPrivateBookingConflict) {
      return buildUnavailableSlot({
        trainerStaffProfileId: input.trainerStaffProfileId,
        sessionDate: input.sessionDate,
        startTime: input.startTime,
        endTime: input.endTime,
        durationMinutes: input.durationMinutes,
        unavailableReason: 'private_booking_conflict',
      });
    }

    return buildAvailableSlot({
      trainerStaffProfileId: input.trainerStaffProfileId,
      sessionDate: input.sessionDate,
      startTime: input.startTime,
      endTime: input.endTime,
      durationMinutes: input.durationMinutes,
    });
  }
}
