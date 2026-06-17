// apps/api/src/modules/bookings/domain/private-booking-lifecycle.policy.ts
/**
 * LAFAM private booking lifecycle policy.
 *
 * Role:
 * - Owns pure private trainer booking lifecycle checks.
 * - Validates private booking date/time/duration rules.
 * - Validates cancellation and reschedule status transitions.
 * - Validates customer ownership checks for customer-facing private booking flows.
 * - Validates private availability and calendar date ranges before service/repository work.
 *
 * Important:
 * - This policy does not query the database.
 * - This policy does not call Supabase RPCs.
 * - This policy does not check trainer availability.
 * - This policy does not check trainer conflicts.
 * - Service/repository logic must handle database-backed checks.
 */

import { AppError } from '../../../common/errors/app-error';
import {
  BOOKING_ADMIN_CALENDAR_MAX_RANGE_DAYS,
  BOOKING_DATE_PATTERN,
  BOOKING_STATUS_DELETED,
  BOOKING_TIME_VALUE_PATTERN,
  PRIVATE_BOOKING_AVAILABILITY_MAX_RANGE_DAYS,
  PRIVATE_BOOKING_DURATION_MAX_MINUTES,
  PRIVATE_BOOKING_DURATION_MIN_MINUTES,
  isPrivateBookingCancellableStatus,
  isPrivateBookingReschedulableStatus,
  type BookingStatus,
} from '../constants/booking.constants';
import type { PrivateBookingRecord } from '../types/booking.types';

interface ParsedIsoDateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

interface PrivateBookingLifecycleRecord {
  readonly id: string;
  readonly user_id: string;
  readonly status: BookingStatus;
  readonly session_date: string;
  readonly start_time: string;
  readonly end_time: string;
  readonly duration_minutes: number;
  readonly deleted_at: string | null;
}

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function toLifecycleRecord(
  booking: PrivateBookingRecord,
): PrivateBookingLifecycleRecord {
  return {
    id: booking.id,
    user_id: booking.user_id,
    status: booking.status,
    session_date: booking.session_date,
    start_time: booking.start_time,
    end_time: booking.end_time,
    duration_minutes: booking.duration_minutes,
    deleted_at: booking.deleted_at,
  };
}

export class PrivateBookingLifecyclePolicy {
  static assertCustomerUserIdAvailable(
    userId: string | null | undefined,
  ): void {
    if (typeof userId === 'string' && userId.trim().length > 0) {
      return;
    }

    throw AppError.invalidRequest(
      'A customer user id is required for private trainer booking.',
    );
  }

  static assertPrivateBookingBelongsToUser(
    booking: PrivateBookingRecord,
    userId: string,
  ): void {
    const lifecycleRecord = toLifecycleRecord(booking);

    if (lifecycleRecord.user_id === userId) {
      return;
    }

    throw AppError.privateBookingAccessDenied(
      'You are not allowed to access this private trainer booking.',
      {
        private_booking_id: lifecycleRecord.id,
        user_id: userId,
      },
    );
  }

  static assertPrivateBookingCanBeCancelled(
    booking: PrivateBookingRecord,
  ): void {
    const lifecycleRecord = toLifecycleRecord(booking);

    this.assertPrivateBookingIsNotDeleted(lifecycleRecord);

    if (isPrivateBookingCancellableStatus(lifecycleRecord.status)) {
      return;
    }

    throw AppError.privateBookingInvalidStatus(
      'This private trainer booking cannot be cancelled in its current status.',
      {
        private_booking_id: lifecycleRecord.id,
        status: lifecycleRecord.status,
      },
    );
  }

  static assertPrivateBookingCanBeRescheduled(
    booking: PrivateBookingRecord,
  ): void {
    const lifecycleRecord = toLifecycleRecord(booking);

    this.assertPrivateBookingIsNotDeleted(lifecycleRecord);

    if (isPrivateBookingReschedulableStatus(lifecycleRecord.status)) {
      return;
    }

    throw AppError.privateBookingInvalidStatus(
      'This private trainer booking cannot be rescheduled in its current status.',
      {
        private_booking_id: lifecycleRecord.id,
        status: lifecycleRecord.status,
      },
    );
  }

  static assertSessionDateIsNotInPast(sessionDate: string): void {
    const normalizedSessionDate = this.normalizeIsoDate(
      sessionDate,
      'session_date',
    );
    const today = this.todayIsoDate();

    if (normalizedSessionDate >= today) {
      return;
    }

    throw AppError.invalidRequest(
      'Private trainer booking session_date cannot be in the past.',
      {
        session_date: normalizedSessionDate,
        today,
      },
    );
  }

  static assertTargetSessionDateIsNotInPast(targetSessionDate: string): void {
    const normalizedTargetSessionDate = this.normalizeIsoDate(
      targetSessionDate,
      'target_session_date',
    );
    const today = this.todayIsoDate();

    if (normalizedTargetSessionDate >= today) {
      return;
    }

    throw AppError.invalidRequest(
      'Private trainer booking target_session_date cannot be in the past.',
      {
        target_session_date: normalizedTargetSessionDate,
        today,
      },
    );
  }

  static assertPrivateBookingDuration(durationMinutes: number): void {
    if (
      Number.isInteger(durationMinutes) &&
      durationMinutes >= PRIVATE_BOOKING_DURATION_MIN_MINUTES &&
      durationMinutes <= PRIVATE_BOOKING_DURATION_MAX_MINUTES
    ) {
      return;
    }

    throw AppError.invalidRequest(
      `Private trainer booking duration_minutes must be between ${PRIVATE_BOOKING_DURATION_MIN_MINUTES} and ${PRIVATE_BOOKING_DURATION_MAX_MINUTES}.`,
      {
        duration_minutes: durationMinutes,
        min_duration_minutes: PRIVATE_BOOKING_DURATION_MIN_MINUTES,
        max_duration_minutes: PRIVATE_BOOKING_DURATION_MAX_MINUTES,
      },
    );
  }

  static calculateEndTime(startTime: string, durationMinutes: number): string {
    this.assertPrivateBookingDuration(durationMinutes);

    const startTotalMinutes = this.parseTimeToMinutes(startTime, 'start_time');
    const endTotalMinutes = startTotalMinutes + durationMinutes;

    if (endTotalMinutes >= MINUTES_PER_DAY) {
      throw AppError.invalidRequest(
        'Private trainer booking end time must stay on the same calendar day.',
        {
          start_time: startTime,
          duration_minutes: durationMinutes,
        },
      );
    }

    if (endTotalMinutes <= startTotalMinutes) {
      throw AppError.invalidRequest(
        'Private trainer booking end time must be after start_time.',
        {
          start_time: startTime,
          duration_minutes: durationMinutes,
        },
      );
    }

    return this.formatMinutesToTime(endTotalMinutes);
  }

  static buildDateTime(
    dateValue: string,
    timeValue: string,
    fieldName: string,
  ): string {
    const normalizedDate = this.normalizeIsoDate(dateValue, fieldName);
    const normalizedTime = this.normalizeTimeValue(
      timeValue,
      `${fieldName}_time`,
    );

    return `${normalizedDate}T${normalizedTime}:00.000Z`;
  }

  static assertPrivateAvailabilityRangeAllowed(
    fromDate: string,
    toDate: string,
  ): void {
    this.assertDateRangeAllowed({
      fromDate,
      toDate,
      maxRangeDays: PRIVATE_BOOKING_AVAILABILITY_MAX_RANGE_DAYS,
      errorCode: 'availability',
    });
  }

  static assertAdminCalendarRangeAllowed(
    fromDate: string,
    toDate: string,
  ): void {
    this.assertDateRangeAllowed({
      fromDate,
      toDate,
      maxRangeDays: BOOKING_ADMIN_CALENDAR_MAX_RANGE_DAYS,
      errorCode: 'calendar',
    });
  }

  static normalizeIsoDate(value: string, fieldName: string): string {
    const date = this.parseIsoDate(value, fieldName);

    return this.formatIsoDate(date);
  }

  static normalizeTimeValue(value: string, fieldName: string): string {
    this.parseTimeToMinutes(value, fieldName);

    return value;
  }

  static getDateRangeDays(fromDate: string, toDate: string): number {
    const from = this.parseIsoDate(fromDate, 'from_date');
    const to = this.parseIsoDate(toDate, 'to_date');

    return this.calculateInclusiveDateRangeDays(from, to);
  }

  private static assertPrivateBookingIsNotDeleted(
    booking: PrivateBookingLifecycleRecord,
  ): void {
    if (
      booking.status !== BOOKING_STATUS_DELETED &&
      booking.deleted_at === null
    ) {
      return;
    }

    throw AppError.privateBookingInvalidStatus(
      'This private trainer booking has been deleted.',
      {
        private_booking_id: booking.id,
        status: booking.status,
      },
    );
  }

  private static assertDateRangeAllowed(input: {
    readonly fromDate: string;
    readonly toDate: string;
    readonly maxRangeDays: number;
    readonly errorCode: 'availability' | 'calendar';
  }): void {
    const from = this.parseIsoDate(input.fromDate, 'from_date');
    const to = this.parseIsoDate(input.toDate, 'to_date');

    if (from.getTime() > to.getTime()) {
      throw AppError.invalidRequest(
        'from_date must be before or equal to to_date.',
        {
          from_date: input.fromDate,
          to_date: input.toDate,
        },
      );
    }

    const rangeDays = this.calculateInclusiveDateRangeDays(from, to);

    if (rangeDays <= input.maxRangeDays) {
      return;
    }

    if (input.errorCode === 'calendar') {
      throw AppError.calendarRangeTooLarge(
        `Calendar date range cannot exceed ${input.maxRangeDays} days.`,
        {
          from_date: input.fromDate,
          to_date: input.toDate,
          range_days: rangeDays,
          max_range_days: input.maxRangeDays,
        },
      );
    }

    throw AppError.invalidRequest(
      `Private trainer availability date range cannot exceed ${input.maxRangeDays} days.`,
      {
        from_date: input.fromDate,
        to_date: input.toDate,
        range_days: rangeDays,
        max_range_days: input.maxRangeDays,
      },
    );
  }

  private static parseTimeToMinutes(
    timeValue: string,
    fieldName: string,
  ): number {
    const match = BOOKING_TIME_VALUE_PATTERN.exec(timeValue);

    if (!match) {
      throw AppError.invalidRequest(
        `${fieldName} must use HH:mm 24-hour format.`,
        {
          [fieldName]: timeValue,
        },
      );
    }

    const hourText = match[1];
    const minuteText = match[2];

    if (typeof hourText !== 'string' || typeof minuteText !== 'string') {
      throw AppError.invalidRequest(
        `${fieldName} must use HH:mm 24-hour format.`,
        {
          [fieldName]: timeValue,
        },
      );
    }

    return Number(hourText) * MINUTES_PER_HOUR + Number(minuteText);
  }

  private static formatMinutesToTime(totalMinutes: number): string {
    if (totalMinutes < 0 || totalMinutes >= MINUTES_PER_DAY) {
      throw AppError.invalidRequest(
        'Private trainer booking time must stay within the same calendar day.',
        {
          total_minutes: totalMinutes,
        },
      );
    }

    const hour = Math.floor(totalMinutes / MINUTES_PER_HOUR);
    const minute = totalMinutes % MINUTES_PER_HOUR;

    return `${this.pad2(hour)}:${this.pad2(minute)}`;
  }

  private static parseIsoDate(value: string, fieldName: string): Date {
    if (!BOOKING_DATE_PATTERN.test(value)) {
      throw AppError.invalidRequest(
        `${fieldName} must use YYYY-MM-DD format.`,
        {
          [fieldName]: value,
        },
      );
    }

    const parts = this.parseIsoDateParts(value, fieldName);

    if (!this.isValidDateParts(parts.year, parts.month, parts.day)) {
      throw AppError.invalidRequest(`${fieldName} must be a real date.`, {
        [fieldName]: value,
      });
    }

    return this.createUtcDate(parts.year, parts.month, parts.day);
  }

  private static parseIsoDateParts(
    value: string,
    fieldName: string,
  ): ParsedIsoDateParts {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);

    if (!match) {
      throw AppError.invalidRequest(
        `${fieldName} must use YYYY-MM-DD format.`,
        {
          [fieldName]: value,
        },
      );
    }

    const yearText = match[1];
    const monthText = match[2];
    const dayText = match[3];

    if (
      typeof yearText !== 'string' ||
      typeof monthText !== 'string' ||
      typeof dayText !== 'string'
    ) {
      throw AppError.invalidRequest(
        `${fieldName} must use YYYY-MM-DD format.`,
        {
          [fieldName]: value,
        },
      );
    }

    return {
      year: Number(yearText),
      month: Number(monthText),
      day: Number(dayText),
    };
  }

  private static isValidDateParts(
    year: number,
    month: number,
    day: number,
  ): boolean {
    const date = this.createUtcDate(year, month, day);

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }

  private static createUtcDate(year: number, month: number, day: number): Date {
    return new Date(Date.UTC(year, month - 1, day));
  }

  private static calculateInclusiveDateRangeDays(from: Date, to: Date): number {
    const difference = to.getTime() - from.getTime();

    return Math.floor(difference / MILLISECONDS_PER_DAY) + 1;
  }

  private static todayIsoDate(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private static formatIsoDate(date: Date): string {
    return [
      date.getUTCFullYear(),
      this.pad2(date.getUTCMonth() + 1),
      this.pad2(date.getUTCDate()),
    ].join('-');
  }

  private static pad2(value: number): string {
    return String(value).padStart(2, '0');
  }
}
