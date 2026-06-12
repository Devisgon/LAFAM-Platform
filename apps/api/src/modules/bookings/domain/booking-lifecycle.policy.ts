// apps/api/src/modules/bookings/domain/booking-lifecycle.policy.ts
/**
 * LAFAM Booking lifecycle policy.
 *
 * Role:
 * - Defines allowed Booking status transitions.
 * - Defines lifecycle checks for cancel, reschedule, complete, no-show, expire,
 *   delete, and admin override flows.
 * - Keeps Booking business rules outside controllers and repositories.
 *
 * Important:
 * - This file contains pure lifecycle policy logic.
 * - Do not place database queries here.
 * - Do not place Supabase calls here.
 * - Do not place DTO validation decorators here.
 * - Service classes should call these functions before mutating booking state.
 */

import { AppError } from '../../../common/errors/app-error';
import {
  BOOKING_ACTIVE_STATUSES,
  BOOKING_CANCELLABLE_STATUSES,
  BOOKING_RESCHEDULABLE_STATUSES,
  BOOKING_STATUS_CANCELLED,
  BOOKING_STATUS_COMPLETED,
  BOOKING_STATUS_CONFIRMED,
  BOOKING_STATUS_DELETED,
  BOOKING_STATUS_EXPIRED,
  BOOKING_STATUS_NO_SHOW,
  BOOKING_STATUS_PENDING_PAYMENT,
  BOOKING_STATUS_RESCHEDULED,
  BOOKING_TERMINAL_STATUSES,
  BOOKING_VISIBLE_HISTORY_STATUSES,
  type BookingPaymentStatus,
  type BookingStatus,
} from '../constants/booking.constants';

export interface BookingLifecycleState {
  readonly status: BookingStatus;
  readonly payment_status: BookingPaymentStatus;
  readonly payment_required: boolean;
  readonly seat_hold_expires_at: string | null;
  readonly confirmed_at: string | null;
  readonly cancelled_at: string | null;
  readonly completed_at: string | null;
  readonly no_show_at: string | null;
  readonly deleted_at?: string | null;
}

export interface BookingLifecycleTransition {
  readonly from_status: BookingStatus;
  readonly to_status: BookingStatus;
}

const BOOKING_ALLOWED_STATUS_TRANSITIONS: ReadonlyMap<
  BookingStatus,
  readonly BookingStatus[]
> = new Map<BookingStatus, readonly BookingStatus[]>([
  [
    BOOKING_STATUS_PENDING_PAYMENT,
    [
      BOOKING_STATUS_CONFIRMED,
      BOOKING_STATUS_CANCELLED,
      BOOKING_STATUS_EXPIRED,
      BOOKING_STATUS_DELETED,
    ],
  ],
  [
    BOOKING_STATUS_CONFIRMED,
    [
      BOOKING_STATUS_CANCELLED,
      BOOKING_STATUS_COMPLETED,
      BOOKING_STATUS_NO_SHOW,
      BOOKING_STATUS_RESCHEDULED,
      BOOKING_STATUS_DELETED,
    ],
  ],
  [BOOKING_STATUS_CANCELLED, [BOOKING_STATUS_DELETED]],
  [BOOKING_STATUS_COMPLETED, [BOOKING_STATUS_DELETED]],
  [BOOKING_STATUS_NO_SHOW, [BOOKING_STATUS_DELETED]],
  [BOOKING_STATUS_EXPIRED, [BOOKING_STATUS_DELETED]],
  [BOOKING_STATUS_RESCHEDULED, [BOOKING_STATUS_DELETED]],
  [BOOKING_STATUS_DELETED, []],
]);

function includesBookingStatus(
  statuses: readonly BookingStatus[],
  status: BookingStatus,
): boolean {
  return statuses.includes(status);
}

export function isBookingActiveStatus(status: BookingStatus): boolean {
  return includesBookingStatus(BOOKING_ACTIVE_STATUSES, status);
}

export function isBookingTerminalStatus(status: BookingStatus): boolean {
  return includesBookingStatus(BOOKING_TERMINAL_STATUSES, status);
}

export function isBookingVisibleHistoryStatus(status: BookingStatus): boolean {
  return includesBookingStatus(BOOKING_VISIBLE_HISTORY_STATUSES, status);
}

export function isBookingCancellableStatus(status: BookingStatus): boolean {
  return includesBookingStatus(BOOKING_CANCELLABLE_STATUSES, status);
}

export function isBookingReschedulableStatus(status: BookingStatus): boolean {
  return includesBookingStatus(BOOKING_RESCHEDULABLE_STATUSES, status);
}

export function getAllowedBookingStatusTransitions(
  status: BookingStatus,
): readonly BookingStatus[] {
  return BOOKING_ALLOWED_STATUS_TRANSITIONS.get(status) ?? [];
}

export function canTransitionBookingStatus(
  fromStatus: BookingStatus,
  toStatus: BookingStatus,
): boolean {
  if (fromStatus === toStatus) {
    return false;
  }

  return getAllowedBookingStatusTransitions(fromStatus).includes(toStatus);
}

export function assertBookingStatusTransitionAllowed(
  transition: BookingLifecycleTransition,
): void {
  if (
    canTransitionBookingStatus(transition.from_status, transition.to_status)
  ) {
    return;
  }

  throw AppError.bookingInvalidStatusTransition(
    `Booking cannot move from ${transition.from_status} to ${transition.to_status}.`,
    {
      from_status: transition.from_status,
      to_status: transition.to_status,
    },
  );
}

export function assertBookingCanBeCancelled(
  booking: BookingLifecycleState,
): void {
  if (booking.status === BOOKING_STATUS_CANCELLED) {
    throw AppError.bookingAlreadyCancelled();
  }

  if (booking.status === BOOKING_STATUS_COMPLETED) {
    throw AppError.bookingAlreadyCompleted();
  }

  if (!isBookingCancellableStatus(booking.status)) {
    throw AppError.bookingInvalidStatusTransition(
      'Only active bookings can be cancelled.',
      {
        current_status: booking.status,
        allowed_statuses: [...BOOKING_CANCELLABLE_STATUSES],
      },
    );
  }

  assertBookingStatusTransitionAllowed({
    from_status: booking.status,
    to_status: BOOKING_STATUS_CANCELLED,
  });
}

export function assertBookingCanBeRescheduled(
  booking: BookingLifecycleState,
): void {
  if (booking.status === BOOKING_STATUS_CANCELLED) {
    throw AppError.bookingAlreadyCancelled(
      'Cancelled bookings cannot be rescheduled.',
    );
  }

  if (booking.status === BOOKING_STATUS_COMPLETED) {
    throw AppError.bookingAlreadyCompleted(
      'Completed bookings cannot be rescheduled.',
    );
  }

  if (!isBookingReschedulableStatus(booking.status)) {
    throw AppError.bookingInvalidStatusTransition(
      'Only confirmed bookings can be rescheduled.',
      {
        current_status: booking.status,
        allowed_statuses: [...BOOKING_RESCHEDULABLE_STATUSES],
      },
    );
  }

  assertBookingStatusTransitionAllowed({
    from_status: booking.status,
    to_status: BOOKING_STATUS_RESCHEDULED,
  });
}

export function assertBookingCanBeConfirmed(
  booking: BookingLifecycleState,
): void {
  if (booking.status !== BOOKING_STATUS_PENDING_PAYMENT) {
    throw AppError.bookingInvalidStatusTransition(
      'Only pending-payment bookings can be confirmed.',
      {
        current_status: booking.status,
        required_status: BOOKING_STATUS_PENDING_PAYMENT,
      },
    );
  }

  if (booking.payment_required && booking.payment_status !== 'paid') {
    throw AppError.bookingPaymentRequired(
      'Payment must be paid before this booking can be confirmed.',
      {
        payment_required: booking.payment_required,
        payment_status: booking.payment_status,
      },
    );
  }

  assertBookingStatusTransitionAllowed({
    from_status: booking.status,
    to_status: BOOKING_STATUS_CONFIRMED,
  });
}

export function assertBookingCanBeCompleted(
  booking: BookingLifecycleState,
): void {
  if (booking.status === BOOKING_STATUS_CANCELLED) {
    throw AppError.bookingAlreadyCancelled(
      'Cancelled bookings cannot be completed.',
    );
  }

  if (booking.status === BOOKING_STATUS_COMPLETED) {
    throw AppError.bookingAlreadyCompleted();
  }

  if (booking.status !== BOOKING_STATUS_CONFIRMED) {
    throw AppError.bookingInvalidStatusTransition(
      'Only confirmed bookings can be completed.',
      {
        current_status: booking.status,
        required_status: BOOKING_STATUS_CONFIRMED,
      },
    );
  }

  assertBookingStatusTransitionAllowed({
    from_status: booking.status,
    to_status: BOOKING_STATUS_COMPLETED,
  });
}

export function assertBookingCanBeMarkedNoShow(
  booking: BookingLifecycleState,
): void {
  if (booking.status === BOOKING_STATUS_CANCELLED) {
    throw AppError.bookingAlreadyCancelled(
      'Cancelled bookings cannot be marked as no-show.',
    );
  }

  if (booking.status === BOOKING_STATUS_COMPLETED) {
    throw AppError.bookingAlreadyCompleted(
      'Completed bookings cannot be marked as no-show.',
    );
  }

  if (booking.status !== BOOKING_STATUS_CONFIRMED) {
    throw AppError.bookingInvalidStatusTransition(
      'Only confirmed bookings can be marked as no-show.',
      {
        current_status: booking.status,
        required_status: BOOKING_STATUS_CONFIRMED,
      },
    );
  }

  assertBookingStatusTransitionAllowed({
    from_status: booking.status,
    to_status: BOOKING_STATUS_NO_SHOW,
  });
}

export function assertBookingCanBeExpired(
  booking: BookingLifecycleState,
): void {
  if (booking.status !== BOOKING_STATUS_PENDING_PAYMENT) {
    throw AppError.bookingInvalidStatusTransition(
      'Only pending-payment bookings can expire.',
      {
        current_status: booking.status,
        required_status: BOOKING_STATUS_PENDING_PAYMENT,
      },
    );
  }

  assertBookingStatusTransitionAllowed({
    from_status: booking.status,
    to_status: BOOKING_STATUS_EXPIRED,
  });
}

export function assertBookingCanBeSoftDeleted(
  booking: BookingLifecycleState,
): void {
  if (booking.status === BOOKING_STATUS_DELETED || booking.deleted_at) {
    throw AppError.bookingInvalidStatusTransition(
      'This booking has already been deleted.',
      {
        current_status: booking.status,
        deleted_at: booking.deleted_at ?? null,
      },
    );
  }

  assertBookingStatusTransitionAllowed({
    from_status: booking.status,
    to_status: BOOKING_STATUS_DELETED,
  });
}

export function assertAdminCanOverrideBookingStatus(
  booking: BookingLifecycleState,
  targetStatus: BookingStatus,
): void {
  if (targetStatus === BOOKING_STATUS_DELETED) {
    throw AppError.bookingInvalidStatusTransition(
      'Bookings cannot be deleted through admin override.',
      {
        current_status: booking.status,
        target_status: targetStatus,
      },
    );
  }

  if (booking.status === targetStatus) {
    throw AppError.bookingInvalidStatusTransition(
      'Booking is already in the requested status.',
      {
        current_status: booking.status,
        target_status: targetStatus,
      },
    );
  }

  assertBookingStatusTransitionAllowed({
    from_status: booking.status,
    to_status: targetStatus,
  });
}

export function assertBookingIsActive(booking: BookingLifecycleState): void {
  if (isBookingActiveStatus(booking.status)) {
    return;
  }

  throw AppError.bookingInvalidStatusTransition('Booking is not active.', {
    current_status: booking.status,
    active_statuses: [...BOOKING_ACTIVE_STATUSES],
  });
}

export function assertBookingIsNotDeleted(
  booking: BookingLifecycleState,
): void {
  if (booking.status !== BOOKING_STATUS_DELETED && !booking.deleted_at) {
    return;
  }

  throw AppError.bookingNotFound();
}

export function assertBookingPaymentStateIsConsistent(
  booking: BookingLifecycleState,
): void {
  if (!booking.payment_required && booking.payment_status !== 'not_required') {
    throw AppError.bookingInvalidStatusTransition(
      'Booking payment state is inconsistent.',
      {
        payment_required: booking.payment_required,
        payment_status: booking.payment_status,
      },
    );
  }

  if (booking.payment_required && booking.payment_status === 'not_required') {
    throw AppError.bookingInvalidStatusTransition(
      'Payment-required bookings cannot use not_required payment status.',
      {
        payment_required: booking.payment_required,
        payment_status: booking.payment_status,
      },
    );
  }

  if (
    booking.status === BOOKING_STATUS_PENDING_PAYMENT &&
    booking.seat_hold_expires_at === null
  ) {
    throw AppError.bookingInvalidStatusTransition(
      'Pending-payment bookings must have a seat hold expiry.',
      {
        current_status: booking.status,
        seat_hold_expires_at: booking.seat_hold_expires_at,
      },
    );
  }

  if (
    booking.status === BOOKING_STATUS_CONFIRMED &&
    booking.confirmed_at === null
  ) {
    throw AppError.bookingInvalidStatusTransition(
      'Confirmed bookings must have a confirmation timestamp.',
      {
        current_status: booking.status,
        confirmed_at: booking.confirmed_at,
      },
    );
  }

  if (
    booking.status === BOOKING_STATUS_CANCELLED &&
    booking.cancelled_at === null
  ) {
    throw AppError.bookingInvalidStatusTransition(
      'Cancelled bookings must have a cancellation timestamp.',
      {
        current_status: booking.status,
        cancelled_at: booking.cancelled_at,
      },
    );
  }

  if (
    booking.status === BOOKING_STATUS_COMPLETED &&
    booking.completed_at === null
  ) {
    throw AppError.bookingInvalidStatusTransition(
      'Completed bookings must have a completion timestamp.',
      {
        current_status: booking.status,
        completed_at: booking.completed_at,
      },
    );
  }

  if (
    booking.status === BOOKING_STATUS_NO_SHOW &&
    booking.no_show_at === null
  ) {
    throw AppError.bookingInvalidStatusTransition(
      'No-show bookings must have a no-show timestamp.',
      {
        current_status: booking.status,
        no_show_at: booking.no_show_at,
      },
    );
  }

  if (booking.status === BOOKING_STATUS_DELETED && !booking.deleted_at) {
    throw AppError.bookingInvalidStatusTransition(
      'Deleted bookings must have a deletion timestamp.',
      {
        current_status: booking.status,
        deleted_at: booking.deleted_at ?? null,
      },
    );
  }
}
