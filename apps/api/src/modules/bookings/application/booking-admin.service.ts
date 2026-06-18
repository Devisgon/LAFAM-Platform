// apps/api/src/modules/bookings/application/booking-admin.service.ts
/**
 * LAFAM admin booking service.
 *
 * Role:
 * - Owns admin-facing Booking Module business flows.
 * - Lists and reads bookings across customers.
 * - Lists, reads, creates, cancels, and reschedules private trainer bookings.
 * - Cancels bookings through the atomic cancellation RPC.
 * - Reschedules bookings through the atomic reschedule RPC.
 * - Performs controlled admin status overrides.
 * - Lists and removes schedule waitlist entries.
 *
 * Important:
 * - This service does not calculate seat capacity in TypeScript.
 * - This service does not insert Pilates class bookings directly.
 * - This service does not insert private trainer bookings directly.
 * - Booking RPC functions remain the concurrency authority.
 * - Private booking RPC functions remain the trainer conflict authority.
 * - Admin mutation flows must leave audit/history records.
 * - Controllers must protect this service with admin/super-admin role guards.
 */

import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import type {
  AppUserRow,
  PilatesClassRow,
  PilatesClassScheduleRow,
} from '../../../database/database.types';
import {
  BOOKING_ADMIN_DEFAULT_LIMIT,
  BOOKING_ADMIN_DEFAULT_OFFSET,
  BOOKING_PAYMENT_CONFIRMING_STATUSES,
  BOOKING_PAYMENT_FAILURE_STATUSES,
  BOOKING_PAYMENT_PAYABLE_STATUSES,
  BOOKING_PAYMENT_REFUNDABLE_STATUSES,
  BOOKING_PAYMENT_RETRYABLE_STATUSES,
  BOOKING_PAYMENT_SETTLED_STATUSES,
  BOOKING_PAYMENT_TERMINAL_STATUSES,
  BOOKING_RPC_ACTION_CANCELLED,
  BOOKING_RPC_ACTION_CANCELLED_AND_PROMOTED,
  BOOKING_RPC_ACTION_RESCHEDULED,
  BOOKING_RPC_ACTION_TARGET_WAITLISTED,
  BOOKING_SOURCE_ADMIN_DASHBOARD,
  BOOKING_STATUS_CONFIRMED,
  BOOKING_STATUS_PENDING_PAYMENT,
  PRIVATE_BOOKING_DEFAULT_DURATION_MINUTES,
  PRIVATE_BOOKING_DEFAULT_PAYMENT_REQUIRED,
  PRIVATE_BOOKING_DEFAULT_STUDIO,
  WAITLIST_STATUS_WAITING,
  type BookingWaitlistStatus,
} from '../constants/booking.constants';
import {
  assertAdminCanOverrideBookingStatus,
  assertBookingCanBeCancelled,
  assertBookingCanBeRescheduled,
} from '../domain/booking-lifecycle.policy';
import { PrivateBookingLifecyclePolicy } from '../domain/private-booking-lifecycle.policy';
import {
  assertWaitlistCanBeRemoved,
  assertWaitlistEntryExists,
} from '../domain/waitlist-fifo.policy';
import type { AdminCancelBookingDto } from '../dto/admin-cancel-booking.dto';
import type { AdminOverrideBookingDto } from '../dto/admin-override-booking.dto';
import type { CreatePrivateBookingDto } from '../dto/create-private-booking.dto';
import type { ListAdminBookingsQueryDto } from '../dto/list-admin-bookings-query.dto';
import type { ListAdminPrivateBookingsQueryDto } from '../dto/list-private-bookings-query.dto';
import type { RescheduleBookingDto } from '../dto/reschedule-booking.dto';
import type { ReschedulePrivateBookingDto } from '../dto/reschedule-private-booking.dto';
import { BookingRepository } from '../repositories/booking.repository';
import { BookingAvailabilityService } from './booking-availability.service';
import type {
  BookingAdminListFilters,
  BookingAvailabilitySnapshot,
  BookingCancelAtomicRpcRow,
  BookingCancelResult,
  BookingClassSnapshot,
  BookingDetail,
  BookingHistoryEntry,
  BookingHydratedPaymentRow,
  BookingHydratedRow,
  BookingListItem,
  BookingListResult,
  BookingPaymentStateSnapshot,
  BookingPaymentSummary,
  BookingPriceSnapshot,
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
  PrivateBookingAdminListFilters,
  PrivateBookingCancelResult,
  PrivateBookingCreateResult,
  PrivateBookingDetail,
  PrivateBookingHistoryEntry,
  PrivateBookingHistoryRecord,
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
function getLatestHydratedPayment(
  payments: readonly BookingHydratedPaymentRow[] | null | undefined,
): BookingHydratedPaymentRow | null {
  if (!payments || payments.length === 0) {
    return null;
  }

  return (
    [...payments].sort((left, right) =>
      right.created_at.localeCompare(left.created_at),
    )[0] ?? null
  );
}

function isPaymentStatusIncluded<TStatus extends string>(
  statuses: readonly TStatus[],
  value: string,
): value is TStatus {
  return statuses.includes(value as TStatus);
}

function hasSeatHoldExpired(seatHoldExpiresAt: string | null): boolean {
  if (!seatHoldExpiresAt) {
    return false;
  }

  return new Date(seatHoldExpiresAt).getTime() <= Date.now();
}

function toPaymentSummary(
  payment: BookingHydratedPaymentRow | null,
  targetKind: BookingPaymentSummary['target_kind'],
): BookingPaymentSummary | null {
  if (!payment) {
    return null;
  }

  return {
    id: payment.id,
    payment_number: payment.payment_number,
    receipt_number: payment.receipt_number,
    target_kind: targetKind,
    booking_id: payment.booking_id,
    private_booking_id: payment.private_booking_id,
    amount: payment.amount,
    discount_amount: payment.discount_amount,
    final_amount: payment.final_amount,
    currency: payment.currency,
    payment_method: payment.payment_method,
    payment_provider: payment.payment_provider,
    status: payment.status,
    redirect_url: payment.redirect_url,
    paid_at: payment.paid_at,
    failed_at: payment.failed_at,
    cancelled_at: payment.cancelled_at,
    expired_at: payment.expired_at,
    refunded_at: payment.refunded_at,
    refunded_amount: payment.refunded_amount,
    expires_at: payment.expires_at,
    created_at: payment.created_at,
    updated_at: payment.updated_at,
  };
}

function buildPaymentStateSnapshot(input: {
  readonly booking_status: BookingHydratedRow['status'];
  readonly payment_required: boolean;
  readonly payment_status: BookingHydratedRow['payment_status'];
  readonly seat_hold_expires_at: string | null;
  readonly latest_payment: BookingPaymentSummary | null;
}): BookingPaymentStateSnapshot {
  const holdExpired = hasSeatHoldExpired(input.seat_hold_expires_at);
  const isPendingBooking =
    input.booking_status === BOOKING_STATUS_PENDING_PAYMENT;

  const isPayable =
    input.payment_required &&
    isPendingBooking &&
    !holdExpired &&
    isPaymentStatusIncluded(
      BOOKING_PAYMENT_PAYABLE_STATUSES,
      input.payment_status,
    );

  const isRetryable =
    input.payment_required &&
    isPendingBooking &&
    !holdExpired &&
    isPaymentStatusIncluded(
      BOOKING_PAYMENT_RETRYABLE_STATUSES,
      input.payment_status,
    );

  const isSettled = isPaymentStatusIncluded(
    BOOKING_PAYMENT_SETTLED_STATUSES,
    input.payment_status,
  );

  const isFailed = isPaymentStatusIncluded(
    BOOKING_PAYMENT_FAILURE_STATUSES,
    input.payment_status,
  );

  const isTerminal = isPaymentStatusIncluded(
    BOOKING_PAYMENT_TERMINAL_STATUSES,
    input.payment_status,
  );

  const isRefundable = isPaymentStatusIncluded(
    BOOKING_PAYMENT_REFUNDABLE_STATUSES,
    input.payment_status,
  );

  const confirmsBooking = isPaymentStatusIncluded(
    BOOKING_PAYMENT_CONFIRMING_STATUSES,
    input.payment_status,
  );

  return {
    payment_required: input.payment_required,
    payment_status: input.payment_status,
    seat_hold_expires_at: input.seat_hold_expires_at,
    is_pending_payment: input.payment_required && isPendingBooking,
    is_payable: isPayable,
    is_retryable: isRetryable,
    is_settled: isSettled,
    is_failed: isFailed,
    is_terminal: isTerminal,
    is_refundable: isRefundable,
    confirms_booking: confirmsBooking,
    checkout_required: isPayable,
    hold_expires_at: input.seat_hold_expires_at,
    latest_payment: input.latest_payment,
  };
}

function resolveClassBookingPriceSnapshot(
  row: BookingHydratedRow,
): BookingPriceSnapshot {
  const schedule = row.pilates_class_schedules ?? null;
  const pilatesClass = row.pilates_classes ?? null;

  if (
    typeof schedule?.price_amount === 'number' &&
    schedule.price_amount >= 0
  ) {
    return {
      amount: schedule.price_amount,
      currency: schedule.currency ?? pilatesClass?.currency ?? null,
      source: 'schedule_override',
    };
  }

  if (
    typeof pilatesClass?.default_price_amount === 'number' &&
    pilatesClass.default_price_amount >= 0
  ) {
    return {
      amount: pilatesClass.default_price_amount,
      currency: pilatesClass.currency ?? schedule?.currency ?? null,
      source: 'class_default',
    };
  }

  return {
    amount: null,
    currency: schedule?.currency ?? pilatesClass?.currency ?? null,
    source: 'not_configured',
  };
}

function resolvePrivateBookingPriceSnapshot(
  row: PrivateBookingHydratedRow,
): BookingPriceSnapshot {
  if (typeof row.price_amount === 'number' && row.price_amount >= 0) {
    return {
      amount: row.price_amount,
      currency: row.currency,
      source: 'private_booking',
    };
  }

  return {
    amount: null,
    currency: row.currency,
    source: 'not_configured',
  };
}

function assertAdminOverrideDoesNotBypassPayment(
  booking: BookingHydratedRow,
  targetStatus: BookingHydratedRow['status'],
): void {
  if (targetStatus !== BOOKING_STATUS_CONFIRMED) {
    return;
  }

  if (!booking.payment_required) {
    return;
  }

  if (
    isPaymentStatusIncluded(
      BOOKING_PAYMENT_CONFIRMING_STATUSES,
      booking.payment_status,
    )
  ) {
    return;
  }

  throw AppError.invalidRequest(
    'Admin cannot confirm a payment-required booking before payment is settled.',
    {
      booking_id: booking.id,
      booking_number: booking.booking_number,
      current_status: booking.status,
      target_status: targetStatus,
      payment_required: booking.payment_required,
      payment_status: booking.payment_status,
    },
  );
}

@Injectable()
export class BookingAdminService {
  constructor(
    private readonly bookingRepository: BookingRepository,
    private readonly bookingAvailabilityService: BookingAvailabilityService,
  ) {}

  async listBookings(
    dto: ListAdminBookingsQueryDto,
  ): Promise<BookingListResult> {
    const filters = this.buildAdminBookingFilters(dto);
    const result = await this.bookingRepository.listAdminBookings(filters);

    return {
      bookings: result.rows.map((row) => this.toBookingListItem(row)),
      total: result.total,
      limit: filters.limit,
      offset: filters.offset,
    };
  }

  async listPrivateBookings(
    dto: ListAdminPrivateBookingsQueryDto,
  ): Promise<PrivateBookingListResult> {
    const filters = this.buildAdminPrivateBookingFilters(dto);
    const result =
      await this.bookingRepository.listAdminPrivateBookings(filters);

    return {
      private_bookings: result.rows.map((row) =>
        this.toPrivateBookingListItem(row),
      ),
      total: result.total,
      limit: filters.limit,
      offset: filters.offset,
    };
  }

  async createPrivateBooking(
    adminUserId: string,
    dto: CreatePrivateBookingDto,
  ): Promise<PrivateBookingCreateResult> {
    const customerUserId = this.requireCustomerUserId(dto.user_id);
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
      user_id: customerUserId,
      trainer_staff_profile_id: dto.trainer_staff_profile_id,
      session_date: sessionDate,
      start_time: startTime,
      duration_minutes: durationMinutes,
      studio: dto.studio ?? PRIVATE_BOOKING_DEFAULT_STUDIO,
      payment_required:
        dto.payment_required ?? PRIVATE_BOOKING_DEFAULT_PAYMENT_REQUIRED,
      idempotency_key: dto.idempotency_key ?? null,
      created_by_admin_id: adminUserId,
      source: BOOKING_SOURCE_ADMIN_DASHBOARD,
    });

    const actionResult = this.resolvePrivateCreateActionResult(
      rpcResult.rpc.action_result,
    );
    const privateBookingId = this.requireReturnedPrivateBookingId(
      rpcResult.rpc.private_booking_id,
      'create_private_trainer_booking_atomic did not return private_booking_id.',
    );
    const privateBooking =
      await this.getRequiredPrivateBookingListItem(privateBookingId);

    return {
      result: actionResult,
      private_booking: privateBooking,
      payment_state: privateBooking.payment_state ?? null,
      checkout_required:
        privateBooking.payment_state?.checkout_required ?? false,
    };
  }

  async getBookingById(bookingId: string): Promise<BookingDetail> {
    const lookup = await this.bookingRepository.findBookingById({
      booking_id: bookingId,
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
      lookup.history.map((history) => this.toHistoryEntry(history)),
      availability,
    );
  }

  async getPrivateBookingById(
    privateBookingId: string,
  ): Promise<PrivateBookingDetail> {
    const lookup = await this.bookingRepository.findPrivateBookingById({
      private_booking_id: privateBookingId,
      include_deleted: false,
    });

    if (!lookup.private_booking) {
      throw AppError.privateBookingNotFound();
    }

    return this.toPrivateBookingDetail(
      lookup.private_booking,
      lookup.history.map((history) => this.toPrivateHistoryEntry(history)),
    );
  }

  async cancelBooking(
    adminUserId: string,
    bookingId: string,
    dto: AdminCancelBookingDto,
  ): Promise<BookingCancelResult> {
    const existingLookup = await this.bookingRepository.findBookingById({
      booking_id: bookingId,
      include_deleted: false,
    });

    if (!existingLookup.booking) {
      throw AppError.bookingNotFound();
    }

    assertBookingCanBeCancelled(existingLookup.booking);

    const rpcResult = await this.bookingRepository.cancelBookingAtomic({
      booking_id: bookingId,
      actor_user_id: null,
      actor_admin_id: adminUserId,
      reason: dto.reason,
    });

    const actionResult = this.resolveCancelActionResult(
      rpcResult.rpc.action_result,
    );
    const availability = this.toAvailabilitySnapshot(
      rpcResult.rpc,
      existingLookup.booking.schedule_id,
    );

    const cancelledBooking = await this.getRequiredBookingListItem(
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
    adminUserId: string,
    privateBookingId: string,
    dto: AdminCancelBookingDto,
  ): Promise<PrivateBookingCancelResult> {
    const existingLookup = await this.bookingRepository.findPrivateBookingById({
      private_booking_id: privateBookingId,
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
      actor_user_id: null,
      actor_admin_id: adminUserId,
      reason: dto.reason,
    });

    const actionResult = this.resolvePrivateCancelActionResult(
      rpcResult.rpc.action_result,
    );
    const privateBooking = await this.getRequiredPrivateBookingListItem(
      rpcResult.rpc.private_booking_id,
    );

    return {
      result: actionResult,
      private_booking: privateBooking,
    };
  }

  async rescheduleBooking(
    adminUserId: string,
    bookingId: string,
    dto: RescheduleBookingDto,
  ): Promise<BookingRescheduleResult> {
    const existingLookup = await this.bookingRepository.findBookingById({
      booking_id: bookingId,
      include_deleted: false,
    });

    if (!existingLookup.booking) {
      throw AppError.bookingNotFound();
    }

    assertBookingCanBeRescheduled(existingLookup.booking);

    const rpcResult = await this.bookingRepository.rescheduleBookingAtomic({
      booking_id: bookingId,
      target_schedule_id: dto.target_schedule_id,
      actor_user_id: null,
      actor_admin_id: adminUserId,
      join_waitlist_if_full: dto.join_waitlist_if_full ?? false,
      reason: dto.reason ?? null,
    });

    const actionResult = this.resolveRescheduleActionResult(
      rpcResult.rpc.action_result,
    );
    const availability = this.toAvailabilitySnapshot(
      rpcResult.rpc,
      dto.target_schedule_id,
    );

    const oldBooking = await this.getRequiredBookingListItem(
      rpcResult.rpc.old_booking_id,
    );

    if (actionResult === BOOKING_RPC_ACTION_TARGET_WAITLISTED) {
      const waitlistId = this.requireReturnedId(
        rpcResult.rpc.waitlist_id,
        'reschedule_pilates_booking_atomic did not return waitlist_id.',
      );
      const waitlist = await this.getRequiredWaitlistItem(waitlistId);

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
    const newBooking = await this.getRequiredBookingListItem(newBookingId);

    return {
      result: actionResult,
      old_booking: oldBooking,
      new_booking: newBooking,
      waitlist: null,
      availability,
    };
  }

  async reschedulePrivateBooking(
    adminUserId: string,
    privateBookingId: string,
    dto: ReschedulePrivateBookingDto,
  ): Promise<PrivateBookingRescheduleResult> {
    const existingLookup = await this.bookingRepository.findPrivateBookingById({
      private_booking_id: privateBookingId,
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
        actor_user_id: null,
        actor_admin_id: adminUserId,
        reason: dto.reason ?? null,
        idempotency_key: dto.idempotency_key ?? null,
        payment_required: paymentRequired,
      });

    const actionResult = this.resolvePrivateRescheduleActionResult(
      rpcResult.rpc.action_result,
    );
    const oldPrivateBooking = await this.getRequiredPrivateBookingListItem(
      rpcResult.rpc.old_private_booking_id,
    );
    const newPrivateBookingId = this.requireReturnedPrivateBookingId(
      rpcResult.rpc.new_private_booking_id,
      'reschedule_private_trainer_booking_atomic did not return new_private_booking_id.',
    );
    const newPrivateBooking =
      await this.getRequiredPrivateBookingListItem(newPrivateBookingId);

    return {
      result: actionResult,
      old_private_booking: oldPrivateBooking,
      new_private_booking: newPrivateBooking,
    };
  }

  async overrideBookingStatus(
    adminUserId: string,
    bookingId: string,
    dto: AdminOverrideBookingDto,
  ): Promise<BookingDetail> {
    const existingLookup = await this.bookingRepository.findBookingById({
      booking_id: bookingId,
      include_deleted: false,
    });

    if (!existingLookup.booking) {
      throw AppError.bookingNotFound();
    }

    assertAdminCanOverrideBookingStatus(
      existingLookup.booking,
      dto.target_status,
    );
    assertAdminOverrideDoesNotBypassPayment(
      existingLookup.booking,
      dto.target_status,
    );

    await this.bookingRepository.overrideBookingStatus({
      booking_id: bookingId,
      target_status: dto.target_status,
      actor_admin_id: adminUserId,
      reason: dto.reason,
      admin_notes: dto.admin_notes ?? null,
      changed_at: new Date().toISOString(),
    });

    return this.getBookingById(bookingId);
  }

  async listScheduleWaitlist(
    scheduleId: string,
    status: BookingWaitlistStatus | null = WAITLIST_STATUS_WAITING,
    limit = BOOKING_ADMIN_DEFAULT_LIMIT,
    offset = BOOKING_ADMIN_DEFAULT_OFFSET,
  ): Promise<BookingWaitlistListResult> {
    const result = await this.bookingRepository.listAdminScheduleWaitlist({
      schedule_id: scheduleId,
      status,
      limit,
      offset,
    });

    return {
      waitlist: result.rows.map((row) => this.toWaitlistListItem(row)),
      total: result.total,
      limit,
      offset,
    };
  }

  async removeWaitlistEntry(
    waitlistId: string,
    reason: string | null = null,
  ): Promise<BookingWaitlistListItem> {
    const lookup = await this.bookingRepository.findWaitlistById({
      waitlist_id: waitlistId,
    });

    assertWaitlistEntryExists(lookup.waitlist);
    assertWaitlistCanBeRemoved(lookup.waitlist);

    await this.bookingRepository.removeWaitlistEntry({
      waitlist_id: waitlistId,
      reason,
    });

    return this.getRequiredWaitlistItem(waitlistId);
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

  private async getRequiredPrivateBookingListItem(
    privateBookingId: string,
  ): Promise<PrivateBookingListItem> {
    const lookup = await this.bookingRepository.findPrivateBookingById({
      private_booking_id: privateBookingId,
      include_deleted: false,
    });

    if (!lookup.private_booking) {
      throw AppError.privateBookingNotFound();
    }

    return this.toPrivateBookingListItem(lookup.private_booking);
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

  private buildAdminBookingFilters(
    dto: ListAdminBookingsQueryDto,
  ): BookingAdminListFilters {
    return {
      search: dto.search ?? null,
      status: dto.status ?? null,
      payment_status: dto.payment_status ?? null,
      schedule_id: dto.schedule_id ?? null,
      class_id: dto.class_id ?? null,
      trainer_staff_profile_id: dto.trainer_staff_profile_id ?? null,
      user_id: dto.user_id ?? null,
      from_date: dto.from_date ?? null,
      to_date: dto.to_date ?? null,
      limit: dto.limit,
      offset: dto.offset,
      sort_by: dto.sort_by,
      sort_direction: dto.sort_direction,
    };
  }

  private buildAdminPrivateBookingFilters(
    dto: ListAdminPrivateBookingsQueryDto,
  ): PrivateBookingAdminListFilters {
    return {
      search: dto.search ?? null,
      status: dto.status ?? null,
      payment_status: dto.payment_status ?? null,
      trainer_staff_profile_id: dto.trainer_staff_profile_id ?? null,
      user_id: dto.user_id ?? null,
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
    const latestPayment = toPaymentSummary(
      getLatestHydratedPayment(row.payments),
      'booking',
    );
    const paymentState = buildPaymentStateSnapshot({
      booking_status: row.status,
      payment_required: row.payment_required,
      payment_status: row.payment_status,
      seat_hold_expires_at: row.seat_hold_expires_at,
      latest_payment: latestPayment,
    });

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
      price: resolveClassBookingPriceSnapshot(row),
      payment_state: paymentState,
      latest_payment: latestPayment,
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
    const latestPayment = toPaymentSummary(
      getLatestHydratedPayment(row.payments),
      'private_booking',
    );
    const paymentState = buildPaymentStateSnapshot({
      booking_status: row.status,
      payment_required: row.payment_required,
      payment_status: row.payment_status,
      seat_hold_expires_at: row.seat_hold_expires_at,
      latest_payment: latestPayment,
    });

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
      price_amount: row.price_amount,
      currency: row.currency,
      price: resolvePrivateBookingPriceSnapshot(row),
      status: row.status,
      source: row.source,
      payment_status: row.payment_status,
      payment_required: row.payment_required,
      seat_hold_expires_at: row.seat_hold_expires_at,
      payment_state: paymentState,
      latest_payment: latestPayment,
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

  private toHistoryEntry(row: BookingHistoryEntry): BookingHistoryEntry {
    return {
      id: row.id,
      booking_id: row.booking_id,
      actor_user_id: row.actor_user_id,
      actor_admin_id: row.actor_admin_id,
      actor_role: row.actor_role,
      action: row.action,
      from_status: row.from_status,
      to_status: row.to_status,
      notes: row.notes,
      metadata: row.metadata,
      created_at: row.created_at,
    };
  }

  private toPrivateHistoryEntry(
    row: PrivateBookingHistoryRecord,
  ): PrivateBookingHistoryEntry {
    return {
      id: row.id,
      private_booking_id: row.private_booking_id,
      actor_user_id: row.actor_user_id,
      actor_admin_id: row.actor_admin_id,
      actor_role: row.actor_role,
      action: row.action,
      from_status: row.from_status,
      to_status: row.to_status,
      notes: row.notes,
      metadata: row.metadata,
      created_at: row.created_at,
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
      default_price_amount: row.default_price_amount,
      currency: row.currency,
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
      price_amount: row.price_amount,
      currency: row.currency,
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
    row: BookingCancelAtomicRpcRow | BookingRescheduleAtomicRpcRow,
    scheduleId: string,
  ): BookingAvailabilitySnapshot {
    return {
      schedule_id: scheduleId,
      capacity: row.capacity,
      booked_count: row.booked_count,
      pending_hold_count: row.pending_hold_count,
      available_seats: row.available_seats,
      waitlist_count: row.waitlist_count,
      waitlist_available: row.available_seats <= 0,
      schedule_realtime_version: row.schedule_realtime_version,
    };
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

  private requireCustomerUserId(value: string | undefined): string {
    PrivateBookingLifecyclePolicy.assertCustomerUserIdAvailable(value);

    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }

    throw AppError.invalidRequest(
      'user_id is required for admin-created private trainer booking.',
    );
  }
}
