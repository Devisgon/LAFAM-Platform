// apps/api/src/modules/bookings/application/booking-availability.service.ts
/**
 * LAFAM Booking availability service.
 *
 * Role:
 * - Reads real Pilates schedule availability from the Booking repository.
 * - Converts database/RPC availability rows into API-safe availability snapshots.
 * - Provides assertion helpers for single booking and bulk booking flows.
 * - Rejects full schedules for bulk booking because bulk booking does not create waitlist entries.
 *
 * Important:
 * - This service does not calculate capacity from TypeScript queries.
 * - Real availability comes from the database RPC function.
 * - Booking remains the source of truth for confirmed seats, pending holds,
 *   available seats, and waitlist count.
 * - This service does not mutate bookings.
 * - This service does not create waitlist entries.
 * - This service does not implement WebSocket/SSE.
 * - Database RPCs remain the final concurrency authority.
 */

import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { BookingOrderLifecyclePolicy } from '../domain/booking-order-lifecycle.policy';
import { BookingRepository } from '../repositories/booking.repository';
import type {
  BookingAvailabilityPayload,
  BookingAvailabilityResult,
  BookingAvailabilityRpcRow,
  BookingAvailabilitySnapshot,
} from '../types/booking.types';

export interface BookingBulkAvailabilityPayload {
  readonly schedule_ids: readonly string[];
}

export interface BookingBulkAvailabilityResult {
  readonly availability: readonly BookingAvailabilitySnapshot[];
}

interface BulkUnavailableScheduleSnapshot {
  readonly schedule_id: string;
  readonly capacity: number;
  readonly booked_count: number;
  readonly pending_hold_count: number;
  readonly available_seats: number;
  readonly waitlist_count: number;
}

function toBulkUnavailableScheduleSnapshot(
  availability: BookingAvailabilitySnapshot,
): BulkUnavailableScheduleSnapshot {
  return {
    schedule_id: availability.schedule_id,
    capacity: availability.capacity,
    booked_count: availability.booked_count,
    pending_hold_count: availability.pending_hold_count,
    available_seats: availability.available_seats,
    waitlist_count: availability.waitlist_count,
  };
}

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

  async getBulkScheduleAvailability(
    input: BookingBulkAvailabilityPayload,
  ): Promise<BookingBulkAvailabilityResult> {
    const availability = await this.getBulkAvailabilitySnapshots(input);

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

  async getBulkAvailabilitySnapshots(
    input: BookingBulkAvailabilityPayload,
  ): Promise<readonly BookingAvailabilitySnapshot[]> {
    BookingOrderLifecyclePolicy.assertScheduleSelectionIsValid(
      input.schedule_ids,
    );

    const availabilitySnapshots = await Promise.all(
      input.schedule_ids.map((scheduleId) =>
        this.getAvailabilitySnapshotForBulk(scheduleId),
      ),
    );

    BookingOrderLifecyclePolicy.assertScheduleSelectionMatchesLookup(
      input.schedule_ids,
      availabilitySnapshots.map((availability) => availability.schedule_id),
    );

    return availabilitySnapshots;
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

  async assertBulkSchedulesHaveAvailableSeats(
    input: BookingBulkAvailabilityPayload,
  ): Promise<readonly BookingAvailabilitySnapshot[]> {
    const availabilitySnapshots =
      await this.getBulkAvailabilitySnapshots(input);

    const unavailableSchedules = availabilitySnapshots
      .filter((availability) => this.isScheduleFull(availability))
      .map(toBulkUnavailableScheduleSnapshot);

    if (unavailableSchedules.length === 0) {
      return availabilitySnapshots;
    }

    throw AppError.bulkBookingFullScheduleRejected(
      'Bulk booking only supports schedules with available seats.',
      {
        unavailable_schedules: unavailableSchedules,
        unavailable_count: unavailableSchedules.length,
        requested_count: input.schedule_ids.length,
      },
    );
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

  private async getAvailabilitySnapshotForBulk(
    scheduleId: string,
  ): Promise<BookingAvailabilitySnapshot> {
    const lookup = await this.bookingRepository.getAvailability({
      schedule_id: scheduleId,
    });

    if (!lookup.availability) {
      throw AppError.bulkBookingScheduleUnavailable(
        'One or more selected schedules are not available for booking.',
        {
          schedule_id: scheduleId,
        },
      );
    }

    return this.toAvailabilitySnapshot(lookup.availability);
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
