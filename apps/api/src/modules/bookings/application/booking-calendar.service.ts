// apps/api/src/modules/bookings/application/booking-calendar.service.ts
/**
 * LAFAM booking calendar service.
 *
 * Role:
 * - Builds the admin booking calendar response.
 * - Combines Pilates class schedules, class bookings, waitlist entries,
 *   and private trainer bookings into one normalized calendar event list.
 * - Applies calendar date-range validation before repository reads.
 *
 * Important:
 * - This service is read-only.
 * - This service does not mutate bookings.
 * - This service does not perform authorization.
 * - Controllers must protect this service with admin/super-admin role guards.
 * - Default calendar output should stay focused: class schedules + private bookings.
 * - Individual class bookings and waitlist entries are optional because they can make
 *   the calendar noisy.
 */

import { Injectable } from '@nestjs/common';

import type { ListAdminCalendarQueryDto } from '../dto/list-admin-calendar-query.dto';
import { PrivateBookingLifecyclePolicy } from '../domain/private-booking-lifecycle.policy';
import {
  BookingRepository,
  type BookingCalendarPilatesScheduleHydratedRow,
} from '../repositories/booking.repository';
import type {
  BookingCalendarEvent,
  BookingCalendarFilters,
  BookingCalendarResult,
  BookingHydratedRow,
  BookingIsoDateString,
  BookingIsoDateTimeString,
  BookingTimeString,
  BookingWaitlistHydratedRow,
  PrivateBookingHydratedRow,
} from '../types/booking.types';

function buildUtcDateTime(
  dateValue: BookingIsoDateString,
  timeValue: BookingTimeString,
): BookingIsoDateTimeString {
  return `${dateValue}T${timeValue}:00.000Z`;
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, 'en', {
    sensitivity: 'base',
    numeric: true,
  });
}

interface CalendarScheduleDateTimeSource {
  readonly class_date: BookingIsoDateString;
  readonly start_time: BookingTimeString;
  readonly end_time: BookingTimeString;
}

function maybeScheduleDateTime(
  schedule: CalendarScheduleDateTimeSource | null | undefined,
): {
  readonly date: BookingIsoDateString;
  readonly start_time: BookingTimeString;
  readonly end_time: BookingTimeString;
  readonly starts_at: BookingIsoDateTimeString;
  readonly ends_at: BookingIsoDateTimeString;
} | null {
  if (!schedule) {
    return null;
  }

  return {
    date: schedule.class_date,
    start_time: schedule.start_time,
    end_time: schedule.end_time,
    starts_at: buildUtcDateTime(schedule.class_date, schedule.start_time),
    ends_at: buildUtcDateTime(schedule.class_date, schedule.end_time),
  };
}

@Injectable()
export class BookingCalendarService {
  constructor(private readonly bookingRepository: BookingRepository) {}

  async listAdminCalendar(
    dto: ListAdminCalendarQueryDto,
  ): Promise<BookingCalendarResult> {
    const filters = this.buildCalendarFilters(dto);

    const [scheduleRows, bookingRows, waitlistRows, privateBookingRows] =
      await Promise.all([
        this.bookingRepository.listCalendarClassSchedules(filters),
        this.bookingRepository.listCalendarClassBookings(filters),
        this.bookingRepository.listCalendarWaitlist(filters),
        this.bookingRepository.listCalendarPrivateBookings(filters),
      ]);

    const events = [
      ...scheduleRows.map((row) => this.toClassScheduleEvent(row)),
      ...bookingRows
        .map((row) => this.toClassBookingEvent(row))
        .filter((event): event is BookingCalendarEvent => event !== null),
      ...waitlistRows
        .map((row) => this.toWaitlistEvent(row))
        .filter((event): event is BookingCalendarEvent => event !== null),
      ...privateBookingRows.map((row) => this.toPrivateBookingEvent(row)),
    ];

    const sortedEvents = this.sortEvents(events, filters);

    return {
      events: sortedEvents,
      from_date: filters.from_date,
      to_date: filters.to_date,
      total: sortedEvents.length,
    };
  }

  private buildCalendarFilters(
    dto: ListAdminCalendarQueryDto,
  ): BookingCalendarFilters {
    const fromDate = PrivateBookingLifecyclePolicy.normalizeIsoDate(
      dto.from_date,
      'from_date',
    );
    const toDate = PrivateBookingLifecyclePolicy.normalizeIsoDate(
      dto.to_date,
      'to_date',
    );

    PrivateBookingLifecyclePolicy.assertAdminCalendarRangeAllowed(
      fromDate,
      toDate,
    );

    return {
      from_date: fromDate,
      to_date: toDate,
      trainer_staff_profile_id: dto.trainer_staff_profile_id ?? null,
      class_id: dto.class_id ?? null,
      user_id: dto.user_id ?? null,
      include_class_schedules: dto.include_class_schedules ?? true,
      include_class_bookings: dto.include_class_bookings ?? false,
      include_waitlist: dto.include_waitlist ?? false,
      include_private_bookings: dto.include_private_bookings ?? true,
      sort_by: dto.sort_by,
      sort_direction: dto.sort_direction,
    };
  }

  private toClassScheduleEvent(
    row: BookingCalendarPilatesScheduleHydratedRow,
  ): BookingCalendarEvent {
    return {
      id: `pilates_schedule:${row.id}`,
      event_type: 'pilates_schedule',
      title: row.pilates_classes?.title ?? 'Pilates class schedule',
      status: row.status,
      starts_at: buildUtcDateTime(row.class_date, row.start_time),
      ends_at: buildUtcDateTime(row.class_date, row.end_time),
      date: row.class_date,
      start_time: row.start_time,
      end_time: row.end_time,
      trainer_staff_profile_id: row.trainer_staff_profile_id,
      user_id: null,
      class_id: row.class_id,
      schedule_id: row.id,
      booking_id: null,
      waitlist_id: null,
      private_booking_id: null,
      source: {
        source_table: 'pilates_class_schedules',
        schedule_id: row.id,
        class_id: row.class_id,
        class_title: row.pilates_classes?.title ?? null,
        trainer_staff_profile_id: row.trainer_staff_profile_id,
        trainer_display_name: row.staff_profiles?.display_name ?? null,
        studio: row.studio,
        duration_minutes: row.duration_minutes,
        capacity: row.capacity,
        realtime_version: row.realtime_version,
      },
    };
  }

  private toClassBookingEvent(
    row: BookingHydratedRow,
  ): BookingCalendarEvent | null {
    const scheduleTime = maybeScheduleDateTime(row.pilates_class_schedules);

    if (!scheduleTime) {
      return null;
    }

    return {
      id: `pilates_booking:${row.id}`,
      event_type: 'pilates_booking',
      title: row.pilates_classes?.title
        ? `Booking: ${row.pilates_classes.title}`
        : `Booking ${row.booking_number}`,
      status: row.status,
      starts_at: scheduleTime.starts_at,
      ends_at: scheduleTime.ends_at,
      date: scheduleTime.date,
      start_time: scheduleTime.start_time,
      end_time: scheduleTime.end_time,
      trainer_staff_profile_id: row.trainer_staff_profile_id,
      user_id: row.user_id,
      class_id: row.class_id,
      schedule_id: row.schedule_id,
      booking_id: row.id,
      waitlist_id: null,
      private_booking_id: null,
      source: {
        source_table: 'bookings',
        booking_id: row.id,
        booking_number: row.booking_number,
        user_id: row.user_id,
        customer_full_name: row.app_users?.full_name ?? null,
        customer_email: row.app_users?.email ?? null,
        schedule_id: row.schedule_id,
        class_id: row.class_id,
        class_title: row.pilates_classes?.title ?? null,
        trainer_staff_profile_id: row.trainer_staff_profile_id,
        trainer_display_name: row.staff_profiles?.display_name ?? null,
        payment_status: row.payment_status,
        payment_required: row.payment_required,
      },
    };
  }

  private toWaitlistEvent(
    row: BookingWaitlistHydratedRow,
  ): BookingCalendarEvent | null {
    const scheduleTime = maybeScheduleDateTime(row.pilates_class_schedules);

    if (!scheduleTime) {
      return null;
    }

    return {
      id: `waitlist_entry:${row.id}`,
      event_type: 'waitlist_entry',
      title: row.pilates_classes?.title
        ? `Waitlist: ${row.pilates_classes.title}`
        : 'Waitlist entry',
      status: row.status,
      starts_at: scheduleTime.starts_at,
      ends_at: scheduleTime.ends_at,
      date: scheduleTime.date,
      start_time: scheduleTime.start_time,
      end_time: scheduleTime.end_time,
      trainer_staff_profile_id:
        row.pilates_class_schedules?.trainer_staff_profile_id ?? null,
      user_id: row.user_id,
      class_id: row.class_id,
      schedule_id: row.schedule_id,
      booking_id: null,
      waitlist_id: row.id,
      private_booking_id: null,
      source: {
        source_table: 'booking_waitlist',
        waitlist_id: row.id,
        user_id: row.user_id,
        customer_full_name: row.app_users?.full_name ?? null,
        customer_email: row.app_users?.email ?? null,
        schedule_id: row.schedule_id,
        class_id: row.class_id,
        class_title: row.pilates_classes?.title ?? null,
        position: row.position,
        promotion_expires_at: row.promotion_expires_at,
        converted_booking_id: row.converted_booking_id,
      },
    };
  }

  private toPrivateBookingEvent(
    row: PrivateBookingHydratedRow,
  ): BookingCalendarEvent {
    return {
      id: `private_trainer_booking:${row.id}`,
      event_type: 'private_trainer_booking',
      title: `Private trainer booking ${row.booking_number}`,
      status: row.status,
      starts_at: buildUtcDateTime(row.session_date, row.start_time),
      ends_at: buildUtcDateTime(row.session_date, row.end_time),
      date: row.session_date,
      start_time: row.start_time,
      end_time: row.end_time,
      trainer_staff_profile_id: row.trainer_staff_profile_id,
      user_id: row.user_id,
      class_id: null,
      schedule_id: null,
      booking_id: null,
      waitlist_id: null,
      private_booking_id: row.id,
      source: {
        source_table: 'private_trainer_bookings',
        private_booking_id: row.id,
        booking_number: row.booking_number,
        user_id: row.user_id,
        customer_full_name: row.app_users?.full_name ?? null,
        customer_email: row.app_users?.email ?? null,
        trainer_staff_profile_id: row.trainer_staff_profile_id,
        trainer_display_name: row.staff_profiles?.display_name ?? null,
        session_date: row.session_date,
        studio: row.studio,
        duration_minutes: row.duration_minutes,
        payment_status: row.payment_status,
        payment_required: row.payment_required,
      },
    };
  }

  private sortEvents(
    events: readonly BookingCalendarEvent[],
    filters: BookingCalendarFilters,
  ): readonly BookingCalendarEvent[] {
    const direction = filters.sort_direction === 'asc' ? 1 : -1;

    return [...events].sort((left, right) => {
      const primaryComparison =
        compareText(
          this.getSortValue(left, filters.sort_by),
          this.getSortValue(right, filters.sort_by),
        ) * direction;

      if (primaryComparison !== 0) {
        return primaryComparison;
      }

      const startComparison = compareText(left.starts_at, right.starts_at);

      if (startComparison !== 0) {
        return startComparison;
      }

      return compareText(left.id, right.id);
    });
  }

  private getSortValue(
    event: BookingCalendarEvent,
    sortBy: BookingCalendarFilters['sort_by'],
  ): string {
    if (sortBy === 'event_type') {
      return event.event_type;
    }

    if (sortBy === 'status') {
      return event.status;
    }

    return event.starts_at;
  }
}
