// apps/api/src/modules/bookings/application/booking-customer.service.ts
/**
 * LAFAM customer booking service.
 *
 * Role:
 * - Owns customer-facing Booking Module business flows.
 * - Creates Pilates class bookings through atomic PostgreSQL booking RPC.
 * - Creates private trainer bookings through atomic PostgreSQL private booking RPC.
 * - Lists the authenticated customer's class bookings and private bookings.
 * - Reads customer booking details.
 * - Cancels customer bookings.
 * - Reschedules customer bookings.
 * - Lists and cancels customer waitlist entries.
 *
 * Important:
 * - This service does not calculate Pilates class seat capacity in TypeScript.
 * - This service does not insert bookings directly.
 * - This service does not trust user_id from request query/body.
 * - Customer ownership always comes from the authenticated user context.
 * - Guest users are blocked by guards/RPC rules and cannot create real bookings.
 * - Class booking RPC functions remain the class booking concurrency authority.
 * - Private booking RPC functions remain the private trainer conflict authority.
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
  PRIVATE_BOOKING_DEFAULT_DURATION_MINUTES,
  PRIVATE_BOOKING_DEFAULT_PAYMENT_REQUIRED,
  PRIVATE_BOOKING_DEFAULT_STUDIO,
  WAITLIST_STATUS_WAITING,
} from '../constants/booking.constants';
import { assertBookingCanBeCancelled } from '../domain/booking-lifecycle.policy';
import { PrivateBookingLifecyclePolicy } from '../domain/private-booking-lifecycle.policy';
import {
  assertWaitlistBelongsToUser,
  assertWaitlistCanBeCancelled,
  assertWaitlistEntryExists,
} from '../domain/waitlist-fifo.policy';
import type { CancelBookingDto } from '../dto/cancel-booking.dto';
import type { CreateBookingDto } from '../dto/create-booking.dto';
import type { CreatePrivateBookingDto } from '../dto/create-private-booking.dto';
import type { ListBookingsQueryDto } from '../dto/list-bookings-query.dto';
import type { ListPrivateBookingsQueryDto } from '../dto/list-private-bookings-query.dto';
import type { RescheduleBookingDto } from '../dto/reschedule-booking.dto';
import type { ReschedulePrivateBookingDto } from '../dto/reschedule-private-booking.dto';
import { BookingRepository } from '../repositories/booking.repository';
import { BookingAvailabilityService } from './booking-availability.service';
import type {
  BookingAvailabilitySnapshot,
  BookingCancelAtomicRpcRow,
  BookingCancelResult,
  BookingClassSnapshot,
  BookingCreateAtomicRpcRow,
  BookingCreateResult,
  BookingCustomerListFilters,
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
  PrivateBookingCancelResult,
  PrivateBookingCreateResult,
  PrivateBookingCustomerListFilters,
  PrivateBookingDetail,
  PrivateBookingHistoryEntry,
  PrivateBookingHydratedRow,
  PrivateBookingListItem,
  PrivateBookingListResult,
  PrivateBookingRescheduleResult,
  PrivateBookingSafeBooking,
} from '../types/booking.types';

type BookingHydratedStaffProfile = NonNullable<
  BookingHydratedRow['staff_profiles']
>;

type PrivateBookingHydratedStaffProfile = NonNullable<
  PrivateBookingHydratedRow['staff_profiles']
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

  async createPrivateBooking(
    userId: string,
    dto: CreatePrivateBookingDto,
  ): Promise<PrivateBookingCreateResult> {
    PrivateBookingLifecyclePolicy.assertCustomerUserIdAvailable(userId);

    const sessionDate = PrivateBookingLifecyclePolicy.normalizeIsoDate(
      dto.session_date,
      'session_date',
    );
    const startTime = PrivateBookingLifecyclePolicy.normalizeTimeValue(
      dto.start_time,
      'start_time',
    );
    const durationMinutes =
      dto.duration_minutes ?? PRIVATE_BOOKING_DEFAULT_DURATION_MINUTES;

    PrivateBookingLifecyclePolicy.assertSessionDateIsNotInPast(sessionDate);
    PrivateBookingLifecyclePolicy.assertPrivateBookingDuration(durationMinutes);
    PrivateBookingLifecyclePolicy.calculateEndTime(startTime, durationMinutes);

    const rpcResult = await this.bookingRepository.createPrivateBookingAtomic({
      user_id: userId,
      trainer_staff_profile_id: dto.trainer_staff_profile_id,
      session_date: sessionDate,
      start_time: startTime,
      duration_minutes: durationMinutes,
      studio: dto.studio ?? PRIVATE_BOOKING_DEFAULT_STUDIO,
      payment_required:
        dto.payment_required ?? PRIVATE_BOOKING_DEFAULT_PAYMENT_REQUIRED,
      idempotency_key: dto.idempotency_key ?? null,
      created_by_admin_id: null,
      source: BOOKING_SOURCE_CUSTOMER_WEB,
    });

    const actionResult = this.resolvePrivateCreateActionResult(
      rpcResult.rpc.action_result,
    );
    const privateBookingId = this.requireReturnedPrivateBookingId(
      rpcResult.rpc.private_booking_id,
      'create_private_trainer_booking_atomic did not return private_booking_id.',
    );
    const privateBooking = await this.getRequiredCustomerPrivateBookingListItem(
      userId,
      privateBookingId,
    );

    return {
      result: actionResult,
      private_booking: privateBooking,
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

  async listPrivateBookings(
    userId: string,
    dto: ListPrivateBookingsQueryDto,
  ): Promise<PrivateBookingListResult> {
    PrivateBookingLifecyclePolicy.assertCustomerUserIdAvailable(userId);

    const filters = this.buildCustomerPrivateBookingFilters(userId, dto);
    const result =
      await this.bookingRepository.listCustomerPrivateBookings(filters);

    return {
      private_bookings: result.rows.map((row) =>
        this.toPrivateBookingListItem(row),
      ),
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

  async getPrivateBookingById(
    userId: string,
    privateBookingId: string,
  ): Promise<PrivateBookingDetail> {
    PrivateBookingLifecyclePolicy.assertCustomerUserIdAvailable(userId);

    const lookup = await this.bookingRepository.findPrivateBookingByIdForUser({
      private_booking_id: privateBookingId,
      user_id: userId,
      include_deleted: false,
    });

    if (!lookup.private_booking) {
      throw AppError.privateBookingNotFound();
    }

    return this.toPrivateBookingDetail(
      lookup.private_booking,
      lookup.history.map((history) => ({
        id: history.id,
        private_booking_id: history.private_booking_id,
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

  async cancelPrivateBooking(
    userId: string,
    privateBookingId: string,
    dto: CancelBookingDto,
  ): Promise<PrivateBookingCancelResult> {
    PrivateBookingLifecyclePolicy.assertCustomerUserIdAvailable(userId);

    const existingLookup =
      await this.bookingRepository.findPrivateBookingByIdForUser({
        private_booking_id: privateBookingId,
        user_id: userId,
        include_deleted: false,
      });

    if (!existingLookup.private_booking) {
      throw AppError.privateBookingNotFound();
    }

    PrivateBookingLifecyclePolicy.assertPrivateBookingCanBeCancelled(
      existingLookup.private_booking,
    );

    const rpcResult = await this.bookingRepository.cancelPrivateBookingAtomic({
      private_booking_id: privateBookingId,
      actor_user_id: userId,
      actor_admin_id: null,
      reason: dto.reason ?? null,
    });

    const actionResult = this.resolvePrivateCancelActionResult(
      rpcResult.rpc.action_result,
    );
    const cancelledPrivateBooking =
      await this.getRequiredCustomerPrivateBookingListItem(
        userId,
        rpcResult.rpc.private_booking_id,
      );

    return {
      result: actionResult,
      private_booking: cancelledPrivateBooking,
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

  async reschedulePrivateBooking(
    userId: string,
    privateBookingId: string,
    dto: ReschedulePrivateBookingDto,
  ): Promise<PrivateBookingRescheduleResult> {
    PrivateBookingLifecyclePolicy.assertCustomerUserIdAvailable(userId);

    const existingLookup =
      await this.bookingRepository.findPrivateBookingByIdForUser({
        private_booking_id: privateBookingId,
        user_id: userId,
        include_deleted: false,
      });

    if (!existingLookup.private_booking) {
      throw AppError.privateBookingNotFound();
    }

    PrivateBookingLifecyclePolicy.assertPrivateBookingCanBeRescheduled(
      existingLookup.private_booking,
    );

    const targetSessionDate = PrivateBookingLifecyclePolicy.normalizeIsoDate(
      dto.target_session_date,
      'target_session_date',
    );
    const targetStartTime = PrivateBookingLifecyclePolicy.normalizeTimeValue(
      dto.target_start_time,
      'target_start_time',
    );
    const targetDurationMinutes =
      dto.target_duration_minutes ??
      existingLookup.private_booking.duration_minutes;
    const paymentRequired =
      dto.payment_required ?? existingLookup.private_booking.payment_required;

    PrivateBookingLifecyclePolicy.assertTargetSessionDateIsNotInPast(
      targetSessionDate,
    );
    PrivateBookingLifecyclePolicy.assertPrivateBookingDuration(
      targetDurationMinutes,
    );
    PrivateBookingLifecyclePolicy.calculateEndTime(
      targetStartTime,
      targetDurationMinutes,
    );

    const rpcResult =
      await this.bookingRepository.reschedulePrivateBookingAtomic({
        private_booking_id: privateBookingId,
        target_session_date: targetSessionDate,
        target_start_time: targetStartTime,
        target_duration_minutes: targetDurationMinutes,
        studio: dto.studio ?? null,
        actor_user_id: userId,
        actor_admin_id: null,
        reason: dto.reason ?? null,
        idempotency_key: dto.idempotency_key ?? null,
        payment_required: paymentRequired,
      });

    const actionResult = this.resolvePrivateRescheduleActionResult(
      rpcResult.rpc.action_result,
    );
    const oldPrivateBooking =
      await this.getRequiredCustomerPrivateBookingListItem(
        userId,
        rpcResult.rpc.old_private_booking_id,
      );
    const newPrivateBookingId = this.requireReturnedPrivateBookingId(
      rpcResult.rpc.new_private_booking_id,
      'reschedule_private_trainer_booking_atomic did not return new_private_booking_id.',
    );
    const newPrivateBooking =
      await this.getRequiredCustomerPrivateBookingListItem(
        userId,
        newPrivateBookingId,
      );

    return {
      result: actionResult,
      old_private_booking: oldPrivateBooking,
      new_private_booking: newPrivateBooking,
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

  private async getRequiredCustomerPrivateBookingListItem(
    userId: string,
    privateBookingId: string,
  ): Promise<PrivateBookingListItem> {
    const lookup = await this.bookingRepository.findPrivateBookingByIdForUser({
      private_booking_id: privateBookingId,
      user_id: userId,
      include_deleted: false,
    });

    if (!lookup.private_booking) {
      throw AppError.privateBookingNotFound();
    }

    return this.toPrivateBookingListItem(lookup.private_booking);
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
  ): BookingCustomerListFilters {
    return {
      status: dto.status ?? null,
      user_id: userId,
      from_date: dto.from_date ?? null,
      to_date: dto.to_date ?? null,
      limit: dto.limit,
      offset: dto.offset,
      sort_by: dto.sort_by,
      sort_direction: dto.sort_direction,
    };
  }

  private buildCustomerPrivateBookingFilters(
    userId: string,
    dto: ListPrivateBookingsQueryDto,
  ): PrivateBookingCustomerListFilters {
    return {
      user_id: userId,
      status: dto.status ?? null,
      trainer_staff_profile_id: dto.trainer_staff_profile_id ?? null,
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

  private toPrivateBookingDetail(
    row: PrivateBookingHydratedRow,
    history: readonly PrivateBookingHistoryEntry[],
  ): PrivateBookingDetail {
    return {
      ...this.toPrivateBookingListItem(row),
      history,
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

  private toPrivateBookingListItem(
    row: PrivateBookingHydratedRow,
  ): PrivateBookingListItem {
    return {
      ...this.toSafePrivateBooking(row),
      customer: this.toSafeUserSnapshot(row.app_users ?? null),
      trainer: this.toPrivateTrainerSnapshot(row.staff_profiles ?? null),
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

  private toSafePrivateBooking(
    row: PrivateBookingHydratedRow,
  ): PrivateBookingSafeBooking {
    return {
      id: row.id,
      booking_number: row.booking_number,
      user_id: row.user_id,
      trainer_staff_profile_id: row.trainer_staff_profile_id,
      session_date: row.session_date,
      start_time: row.start_time,
      end_time: row.end_time,
      duration_minutes: row.duration_minutes,
      studio: row.studio,
      status: row.status,
      source: row.source,
      payment_status: row.payment_status,
      payment_required: row.payment_required,
      seat_hold_expires_at: row.seat_hold_expires_at,
      confirmed_at: row.confirmed_at,
      cancelled_at: row.cancelled_at,
      completed_at: row.completed_at,
      no_show_at: row.no_show_at,
      rescheduled_at: row.rescheduled_at,
      rescheduled_from_private_booking_id:
        row.rescheduled_from_private_booking_id,
      rescheduled_to_private_booking_id: row.rescheduled_to_private_booking_id,
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

  private toPrivateTrainerSnapshot(
    row: PrivateBookingHydratedStaffProfile | null,
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

  private resolvePrivateCreateActionResult(
    value: string,
  ): PrivateBookingCreateResult['result'] {
    if (value === 'existing_private_booking' || value === 'private_booked') {
      return value;
    }

    throw AppError.privateBookingDatabaseTransactionFailed(
      new Error(
        `Unexpected create private booking RPC action result: ${value}`,
      ),
    );
  }

  private resolvePrivateCancelActionResult(
    value: string,
  ): PrivateBookingCancelResult['result'] {
    if (value === 'private_cancelled') {
      return value;
    }

    throw AppError.privateBookingDatabaseTransactionFailed(
      new Error(
        `Unexpected cancel private booking RPC action result: ${value}`,
      ),
    );
  }

  private resolvePrivateRescheduleActionResult(
    value: string,
  ): PrivateBookingRescheduleResult['result'] {
    if (value === 'private_rescheduled') {
      return value;
    }

    throw AppError.privateBookingDatabaseTransactionFailed(
      new Error(
        `Unexpected reschedule private booking RPC action result: ${value}`,
      ),
    );
  }

  private requireReturnedId(value: string | null, message: string): string {
    if (value) {
      return value;
    }

    throw AppError.bookingDatabaseTransactionFailed(new Error(message));
  }

  private requireReturnedPrivateBookingId(
    value: string | null,
    message: string,
  ): string {
    if (value) {
      return value;
    }

    throw AppError.privateBookingDatabaseTransactionFailed(new Error(message));
  }
}
