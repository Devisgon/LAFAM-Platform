// apps/api/src/modules/bookings/application/booking-customer.service.ts
/**
 * LAFAM customer booking service.
 *
 * Role:
 * - Owns customer-facing Booking Module business flows.
 * - Creates Pilates bookings through atomic PostgreSQL booking RPC.
 * - Lists the authenticated customer's bookings.
 * - Reads customer booking details.
 * - Cancels customer bookings.
 * - Reschedules customer bookings.
 * - Lists and cancels customer waitlist entries.
 *
 * Important:
 * - This service does not calculate seat capacity in TypeScript.
 * - This service does not insert bookings directly.
 * - This service does not trust user_id from request query/body.
 * - Customer ownership always comes from the authenticated user context.
 * - Guest users are blocked by guards/RPC rules and cannot create real bookings.
 * - Booking RPC functions remain the concurrency authority.
 */

import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import type {
  AppUserRow,
  PilatesClassRow,
  PilatesClassScheduleRow,
} from '../../../database/database.types';
import {
  BOOKING_DEFAULT_PAYMENT_REQUIRED,
  BOOKING_RPC_ACTION_BOOKED,
  BOOKING_RPC_ACTION_CANCELLED,
  BOOKING_RPC_ACTION_CANCELLED_AND_PROMOTED,
  BOOKING_RPC_ACTION_EXISTING_BOOKING,
  BOOKING_RPC_ACTION_RESCHEDULED,
  BOOKING_RPC_ACTION_TARGET_WAITLISTED,
  BOOKING_RPC_ACTION_WAITLISTED,
  BOOKING_SOURCE_CUSTOMER_WEB,
  WAITLIST_STATUS_WAITING,
} from '../constants/booking.constants';
import { assertBookingCanBeCancelled } from '../domain/booking-lifecycle.policy';
import {
  assertWaitlistBelongsToUser,
  assertWaitlistCanBeCancelled,
  assertWaitlistEntryExists,
} from '../domain/waitlist-fifo.policy';
import type { CancelBookingDto } from '../dto/cancel-booking.dto';
import type { CreateBookingDto } from '../dto/create-booking.dto';
import type { ListBookingsQueryDto } from '../dto/list-bookings-query.dto';
import type { RescheduleBookingDto } from '../dto/reschedule-booking.dto';
import { BookingRepository } from '../repositories/booking.repository';
import { BookingAvailabilityService } from './booking-availability.service';
import type {
  BookingAdminListFilters,
  BookingAvailabilitySnapshot,
  BookingCancelAtomicRpcRow,
  BookingCancelResult,
  BookingClassSnapshot,
  BookingCreateAtomicRpcRow,
  BookingCreateResult,
  BookingDetail,
  BookingHistoryEntry,
  BookingHydratedRow,
  BookingListItem,
  BookingListResult,
  BookingRescheduleAtomicRpcRow,
  BookingRescheduleResult,
  BookingSafeBooking,
  BookingSafeUserSnapshot,
  BookingScheduleSnapshot,
  BookingTrainerSnapshot,
  BookingWaitlistEntry,
  BookingWaitlistHydratedRow,
  BookingWaitlistListItem,
  BookingWaitlistListResult,
} from '../types/booking.types';

type BookingHydratedStaffProfile = NonNullable<
  BookingHydratedRow['staff_profiles']
>;

@Injectable()
export class BookingCustomerService {
  constructor(
    private readonly bookingRepository: BookingRepository,
    private readonly bookingAvailabilityService: BookingAvailabilityService,
  ) {}

  async createBooking(
    userId: string,
    dto: CreateBookingDto,
  ): Promise<BookingCreateResult> {
    const rpcResult = await this.bookingRepository.createBookingAtomic({
      user_id: userId,
      schedule_id: dto.schedule_id,
      payment_required:
        dto.payment_required ?? BOOKING_DEFAULT_PAYMENT_REQUIRED,
      idempotency_key: dto.idempotency_key ?? null,
      created_by_admin_id: null,
      source: BOOKING_SOURCE_CUSTOMER_WEB,
    });

    const actionResult = this.resolveCreateActionResult(
      rpcResult.rpc.action_result,
    );
    const availability = this.toAvailabilitySnapshot(rpcResult.rpc);

    if (
      actionResult === BOOKING_RPC_ACTION_EXISTING_BOOKING ||
      actionResult === BOOKING_RPC_ACTION_BOOKED
    ) {
      const bookingId = this.requireReturnedId(
        rpcResult.rpc.booking_id,
        'create_pilates_booking_atomic did not return booking_id.',
      );
      const booking = await this.getRequiredCustomerBookingListItem(
        userId,
        bookingId,
      );

      return {
        result: actionResult,
        booking,
        waitlist: null,
        availability,
      };
    }

    const waitlistId = this.requireReturnedId(
      rpcResult.rpc.waitlist_id,
      'create_pilates_booking_atomic did not return waitlist_id.',
    );
    const waitlist = await this.getRequiredCustomerWaitlistItem(
      userId,
      waitlistId,
    );

    return {
      result: actionResult,
      booking: null,
      waitlist,
      availability,
    };
  }

  async listBookings(
    userId: string,
    dto: ListBookingsQueryDto,
  ): Promise<BookingListResult> {
    const filters = this.buildCustomerBookingFilters(userId, dto);
    const result = await this.bookingRepository.listCustomerBookings(filters);

    return {
      bookings: result.rows.map((row) => this.toBookingListItem(row)),
      total: result.total,
      limit: filters.limit,
      offset: filters.offset,
    };
  }

  async getBookingById(
    userId: string,
    bookingId: string,
  ): Promise<BookingDetail> {
    const lookup = await this.bookingRepository.findBookingByIdForUser({
      booking_id: bookingId,
      user_id: userId,
      include_deleted: false,
    });

    if (!lookup.booking) {
      throw AppError.bookingNotFound();
    }

    const availability =
      await this.bookingAvailabilityService.getAvailabilitySnapshot({
        schedule_id: lookup.booking.schedule_id,
      });

    return this.toBookingDetail(
      lookup.booking,
      lookup.history.map((history) => ({
        id: history.id,
        booking_id: history.booking_id,
        actor_user_id: history.actor_user_id,
        actor_admin_id: history.actor_admin_id,
        actor_role: history.actor_role,
        action: history.action,
        from_status: history.from_status,
        to_status: history.to_status,
        notes: history.notes,
        metadata: history.metadata,
        created_at: history.created_at,
      })),
      availability,
    );
  }

  async cancelBooking(
    userId: string,
    bookingId: string,
    dto: CancelBookingDto,
  ): Promise<BookingCancelResult> {
    const existingLookup = await this.bookingRepository.findBookingByIdForUser({
      booking_id: bookingId,
      user_id: userId,
      include_deleted: false,
    });

    if (!existingLookup.booking) {
      throw AppError.bookingNotFound();
    }

    assertBookingCanBeCancelled(existingLookup.booking);

    const rpcResult = await this.bookingRepository.cancelBookingAtomic({
      booking_id: bookingId,
      actor_user_id: userId,
      actor_admin_id: null,
      reason: dto.reason ?? null,
    });

    const actionResult = this.resolveCancelActionResult(
      rpcResult.rpc.action_result,
    );
    const availability = this.toAvailabilitySnapshot(rpcResult.rpc);

    const cancelledBooking = await this.getRequiredCustomerBookingListItem(
      userId,
      rpcResult.rpc.cancelled_booking_id,
    );

    const promotedBooking = rpcResult.rpc.promoted_booking_id
      ? await this.getRequiredBookingListItem(rpcResult.rpc.promoted_booking_id)
      : null;

    const promotedWaitlist = rpcResult.rpc.promoted_waitlist_id
      ? await this.getRequiredWaitlistItem(rpcResult.rpc.promoted_waitlist_id)
      : null;

    return {
      result: actionResult,
      cancelled_booking: cancelledBooking,
      promoted_booking: promotedBooking,
      promoted_waitlist: promotedWaitlist,
      availability,
    };
  }

  async rescheduleBooking(
    userId: string,
    bookingId: string,
    dto: RescheduleBookingDto,
  ): Promise<BookingRescheduleResult> {
    const existingLookup = await this.bookingRepository.findBookingByIdForUser({
      booking_id: bookingId,
      user_id: userId,
      include_deleted: false,
    });

    if (!existingLookup.booking) {
      throw AppError.bookingNotFound();
    }

    const rpcResult = await this.bookingRepository.rescheduleBookingAtomic({
      booking_id: bookingId,
      target_schedule_id: dto.target_schedule_id,
      actor_user_id: userId,
      actor_admin_id: null,
      join_waitlist_if_full: dto.join_waitlist_if_full ?? false,
      reason: dto.reason ?? null,
    });

    const actionResult = this.resolveRescheduleActionResult(
      rpcResult.rpc.action_result,
    );
    const availability = this.toAvailabilitySnapshot(rpcResult.rpc);

    const oldBooking = await this.getRequiredCustomerBookingListItem(
      userId,
      rpcResult.rpc.old_booking_id,
    );

    if (actionResult === BOOKING_RPC_ACTION_TARGET_WAITLISTED) {
      const waitlistId = this.requireReturnedId(
        rpcResult.rpc.waitlist_id,
        'reschedule_pilates_booking_atomic did not return waitlist_id.',
      );
      const waitlist = await this.getRequiredCustomerWaitlistItem(
        userId,
        waitlistId,
      );

      return {
        result: actionResult,
        old_booking: oldBooking,
        new_booking: null,
        waitlist,
        availability,
      };
    }

    const newBookingId = this.requireReturnedId(
      rpcResult.rpc.new_booking_id,
      'reschedule_pilates_booking_atomic did not return new_booking_id.',
    );
    const newBooking = await this.getRequiredCustomerBookingListItem(
      userId,
      newBookingId,
    );

    return {
      result: actionResult,
      old_booking: oldBooking,
      new_booking: newBooking,
      waitlist: null,
      availability,
    };
  }

  async listWaitlist(userId: string): Promise<BookingWaitlistListResult> {
    const result = await this.bookingRepository.listCustomerWaitlist({
      user_id: userId,
      schedule_id: null,
      status: WAITLIST_STATUS_WAITING,
      limit: 20,
      offset: 0,
    });

    return {
      waitlist: result.rows.map((row) => this.toWaitlistListItem(row)),
      total: result.total,
      limit: 20,
      offset: 0,
    };
  }

  async cancelWaitlistEntry(
    userId: string,
    waitlistId: string,
    dto: CancelBookingDto,
  ): Promise<BookingWaitlistListItem> {
    const lookup = await this.bookingRepository.findWaitlistByIdForUser({
      waitlist_id: waitlistId,
      user_id: userId,
    });

    assertWaitlistEntryExists(lookup.waitlist);
    assertWaitlistBelongsToUser(lookup.waitlist, userId);
    assertWaitlistCanBeCancelled(lookup.waitlist);

    await this.bookingRepository.cancelWaitlistEntry({
      waitlist_id: waitlistId,
      reason: dto.reason ?? null,
    });

    return this.getRequiredCustomerWaitlistItem(userId, waitlistId);
  }

  private async getRequiredCustomerBookingListItem(
    userId: string,
    bookingId: string,
  ): Promise<BookingListItem> {
    const lookup = await this.bookingRepository.findBookingByIdForUser({
      booking_id: bookingId,
      user_id: userId,
      include_deleted: false,
    });

    if (!lookup.booking) {
      throw AppError.bookingNotFound();
    }

    return this.toBookingListItem(lookup.booking);
  }

  private async getRequiredBookingListItem(
    bookingId: string,
  ): Promise<BookingListItem> {
    const lookup = await this.bookingRepository.findBookingById({
      booking_id: bookingId,
      include_deleted: false,
    });

    if (!lookup.booking) {
      throw AppError.bookingNotFound();
    }

    return this.toBookingListItem(lookup.booking);
  }

  private async getRequiredCustomerWaitlistItem(
    userId: string,
    waitlistId: string,
  ): Promise<BookingWaitlistListItem> {
    const lookup = await this.bookingRepository.findWaitlistByIdForUser({
      waitlist_id: waitlistId,
      user_id: userId,
    });

    if (!lookup.waitlist) {
      throw AppError.bookingWaitlistNotFound();
    }

    return this.toWaitlistListItem(lookup.waitlist);
  }

  private async getRequiredWaitlistItem(
    waitlistId: string,
  ): Promise<BookingWaitlistListItem> {
    const lookup = await this.bookingRepository.findWaitlistById({
      waitlist_id: waitlistId,
    });

    if (!lookup.waitlist) {
      throw AppError.bookingWaitlistNotFound();
    }

    return this.toWaitlistListItem(lookup.waitlist);
  }

  private buildCustomerBookingFilters(
    userId: string,
    dto: ListBookingsQueryDto,
  ): BookingAdminListFilters {
    return {
      search: null,
      status: dto.status ?? null,
      payment_status: null,
      schedule_id: null,
      class_id: null,
      trainer_staff_profile_id: null,
      user_id: userId,
      from_date: dto.from_date ?? null,
      to_date: dto.to_date ?? null,
      limit: dto.limit,
      offset: dto.offset,
      sort_by: dto.sort_by,
      sort_direction: dto.sort_direction,
    };
  }

  private toBookingDetail(
    row: BookingHydratedRow,
    history: readonly BookingHistoryEntry[],
    availability: BookingAvailabilitySnapshot | null,
  ): BookingDetail {
    return {
      ...this.toBookingListItem(row),
      history,
      availability,
    };
  }

  private toBookingListItem(row: BookingHydratedRow): BookingListItem {
    return {
      ...this.toSafeBooking(row),
      customer: this.toSafeUserSnapshot(row.app_users ?? null),
      class: this.toClassSnapshot(row.pilates_classes ?? null),
      schedule: this.toScheduleSnapshot(row.pilates_class_schedules ?? null),
      trainer: this.toTrainerSnapshot(row.staff_profiles ?? null),
    };
  }

  private toSafeBooking(row: BookingHydratedRow): BookingSafeBooking {
    return {
      id: row.id,
      booking_number: row.booking_number,
      user_id: row.user_id,
      schedule_id: row.schedule_id,
      class_id: row.class_id,
      trainer_staff_profile_id: row.trainer_staff_profile_id,
      status: row.status,
      source: row.source,
      payment_status: row.payment_status,
      payment_required: row.payment_required,
      seat_hold_expires_at: row.seat_hold_expires_at,
      confirmed_at: row.confirmed_at,
      cancelled_at: row.cancelled_at,
      completed_at: row.completed_at,
      no_show_at: row.no_show_at,
      rescheduled_from_booking_id: row.rescheduled_from_booking_id,
      cancellation_reason: row.cancellation_reason,
      admin_notes: row.admin_notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      realtime_version: row.realtime_version,
    };
  }

  private toWaitlistListItem(
    row: BookingWaitlistHydratedRow,
  ): BookingWaitlistListItem {
    return {
      ...this.toWaitlistEntry(row),
      customer: this.toSafeUserSnapshot(row.app_users ?? null),
      class: this.toClassSnapshot(row.pilates_classes ?? null),
      schedule: this.toScheduleSnapshot(row.pilates_class_schedules ?? null),
      trainer: null,
    };
  }

  private toWaitlistEntry(
    row: BookingWaitlistHydratedRow,
  ): BookingWaitlistEntry {
    return {
      id: row.id,
      schedule_id: row.schedule_id,
      class_id: row.class_id,
      user_id: row.user_id,
      position: row.position,
      status: row.status,
      joined_at: row.joined_at,
      promoted_at: row.promoted_at,
      expired_at: row.expired_at,
      cancelled_at: row.cancelled_at,
      promotion_expires_at: row.promotion_expires_at,
      converted_booking_id: row.converted_booking_id,
      cancellation_reason: row.cancellation_reason,
      created_at: row.created_at,
      updated_at: row.updated_at,
      realtime_version: row.realtime_version,
    };
  }

  private toSafeUserSnapshot(
    row: AppUserRow | null,
  ): BookingSafeUserSnapshot | null {
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      email: row.email,
      phone: row.phone,
      full_name: row.full_name,
      role: row.role,
      status: row.status,
      is_guest: row.is_guest,
      avatar_path: row.avatar_path,
    };
  }

  private toClassSnapshot(
    row: PilatesClassRow | null,
  ): BookingClassSnapshot | null {
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      title: row.title,
      description: row.description,
      level: row.level,
      status: row.status,
      duration_minutes: row.default_duration_minutes,
      capacity: row.default_capacity,
      cover_image_path: row.image_path,
    };
  }

  private toScheduleSnapshot(
    row: PilatesClassScheduleRow | null,
  ): BookingScheduleSnapshot | null {
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      class_id: row.class_id,
      trainer_staff_profile_id: row.trainer_staff_profile_id,
      studio: row.studio,
      class_date: row.class_date,
      start_time: row.start_time,
      end_time: row.end_time,
      duration_minutes: row.duration_minutes,
      capacity: row.capacity,
      status: row.status,
      cancellation_reason: row.cancellation_reason,
      cancelled_at: row.cancelled_at,
      completed_at: row.completed_at,
      realtime_version: row.realtime_version,
    };
  }

  private toTrainerSnapshot(
    row: BookingHydratedStaffProfile | null,
  ): BookingTrainerSnapshot | null {
    if (!row) {
      return null;
    }

    return {
      staff_profile_id: row.id,
      app_user_id: row.app_user_id,
      display_name: row.display_name,
      post_title: row.post_title,
      email: row.app_users?.email ?? null,
      phone: row.app_users?.phone ?? null,
      avatar_path: row.app_users?.avatar_path ?? null,
    };
  }

  private toAvailabilitySnapshot(
    row:
      | BookingCreateAtomicRpcRow
      | BookingCancelAtomicRpcRow
      | BookingRescheduleAtomicRpcRow,
  ): BookingAvailabilitySnapshot {
    return {
      schedule_id: this.resolveAvailabilityScheduleId(row),
      capacity: row.capacity,
      booked_count: row.booked_count,
      pending_hold_count: row.pending_hold_count,
      available_seats: row.available_seats,
      waitlist_count: row.waitlist_count,
      waitlist_available: row.available_seats <= 0,
      schedule_realtime_version: row.schedule_realtime_version,
    };
  }

  private resolveAvailabilityScheduleId(
    row:
      | BookingCreateAtomicRpcRow
      | BookingCancelAtomicRpcRow
      | BookingRescheduleAtomicRpcRow,
  ): string {
    if ('old_booking_id' in row) {
      return row.new_booking_id ?? row.waitlist_id ?? row.old_booking_id;
    }

    if ('cancelled_booking_id' in row) {
      return (
        row.promoted_booking_id ??
        row.promoted_waitlist_id ??
        row.cancelled_booking_id
      );
    }

    return row.booking_id ?? row.waitlist_id ?? '';
  }

  private resolveCreateActionResult(
    value: string,
  ): BookingCreateResult['result'] {
    if (
      value === BOOKING_RPC_ACTION_EXISTING_BOOKING ||
      value === BOOKING_RPC_ACTION_BOOKED ||
      value === BOOKING_RPC_ACTION_WAITLISTED
    ) {
      return value;
    }

    throw AppError.bookingDatabaseTransactionFailed(
      new Error(`Unexpected create booking RPC action result: ${value}`),
    );
  }

  private resolveCancelActionResult(
    value: string,
  ): BookingCancelResult['result'] {
    if (
      value === BOOKING_RPC_ACTION_CANCELLED ||
      value === BOOKING_RPC_ACTION_CANCELLED_AND_PROMOTED
    ) {
      return value;
    }

    throw AppError.bookingDatabaseTransactionFailed(
      new Error(`Unexpected cancel booking RPC action result: ${value}`),
    );
  }

  private resolveRescheduleActionResult(
    value: string,
  ): BookingRescheduleResult['result'] {
    if (
      value === BOOKING_RPC_ACTION_RESCHEDULED ||
      value === BOOKING_RPC_ACTION_TARGET_WAITLISTED
    ) {
      return value;
    }

    throw AppError.bookingDatabaseTransactionFailed(
      new Error(`Unexpected reschedule booking RPC action result: ${value}`),
    );
  }

  private requireReturnedId(value: string | null, message: string): string {
    if (value) {
      return value;
    }

    throw AppError.bookingDatabaseTransactionFailed(new Error(message));
  }
}
