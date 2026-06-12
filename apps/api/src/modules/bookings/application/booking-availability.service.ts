// apps/api/src/modules/bookings/application/booking-availability.service.ts
/**
 * LAFAM Booking availability service.
 *
 * Role:
 * - Reads real Pilates schedule availability from the Booking repository.
 * - Converts database/RPC availability rows into API-safe availability snapshots.
 * - Provides small assertion helpers for services that need seat/waitlist checks.
 *
 * Important:
 * - This service does not calculate capacity from TypeScript queries.
 * - Real availability comes from the database RPC function.
 * - Booking remains the source of truth for confirmed seats, pending holds,
 *   available seats, and waitlist count.
 * - This service does not mutate bookings.
 * - This service does not implement WebSocket/SSE.
 */

import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { BookingRepository } from '../repositories/booking.repository';
import type {
  BookingAvailabilityPayload,
  BookingAvailabilityResult,
  BookingAvailabilityRpcRow,
  BookingAvailabilitySnapshot,
} from '../types/booking.types';

@Injectable()
export class BookingAvailabilityService {
  constructor(private readonly bookingRepository: BookingRepository) {}

  async getScheduleAvailability(
    scheduleId: string,
  ): Promise<BookingAvailabilityResult> {
    const availability = await this.getAvailabilitySnapshot({
      schedule_id: scheduleId,
    });

    return {
      availability,
    };
  }

  async getAvailabilitySnapshot(
    input: BookingAvailabilityPayload,
  ): Promise<BookingAvailabilitySnapshot> {
    const lookup = await this.bookingRepository.getAvailability(input);

    if (!lookup.availability) {
      throw AppError.bookingScheduleNotFound();
    }

    return this.toAvailabilitySnapshot(lookup.availability);
  }

  async assertScheduleHasAvailableSeat(
    scheduleId: string,
  ): Promise<BookingAvailabilitySnapshot> {
    const availability = await this.getAvailabilitySnapshot({
      schedule_id: scheduleId,
    });

    if (availability.available_seats > 0) {
      return availability;
    }

    throw AppError.bookingCapacityFull(undefined, {
      schedule_id: scheduleId,
      capacity: availability.capacity,
      booked_count: availability.booked_count,
      pending_hold_count: availability.pending_hold_count,
      available_seats: availability.available_seats,
      waitlist_count: availability.waitlist_count,
    });
  }

  async assertScheduleCanAcceptWaitlist(
    scheduleId: string,
  ): Promise<BookingAvailabilitySnapshot> {
    const availability = await this.getAvailabilitySnapshot({
      schedule_id: scheduleId,
    });

    if (availability.waitlist_available) {
      return availability;
    }

    throw AppError.bookingScheduleNotBookable(
      'This Pilates schedule is not currently accepting waitlist entries.',
      {
        schedule_id: scheduleId,
        capacity: availability.capacity,
        booked_count: availability.booked_count,
        pending_hold_count: availability.pending_hold_count,
        available_seats: availability.available_seats,
        waitlist_count: availability.waitlist_count,
        waitlist_available: availability.waitlist_available,
      },
    );
  }

  isScheduleFull(availability: BookingAvailabilitySnapshot): boolean {
    return availability.available_seats <= 0;
  }

  isWaitlistAvailable(availability: BookingAvailabilitySnapshot): boolean {
    return availability.waitlist_available;
  }

  private toAvailabilitySnapshot(
    row: BookingAvailabilityRpcRow,
  ): BookingAvailabilitySnapshot {
    return {
      schedule_id: row.schedule_id,
      capacity: row.capacity,
      booked_count: row.booked_count,
      pending_hold_count: row.pending_hold_count,
      available_seats: row.available_seats,
      waitlist_count: row.waitlist_count,
      waitlist_available: row.waitlist_available,
      schedule_realtime_version: row.schedule_realtime_version,
    };
  }
}
