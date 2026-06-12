// apps/api/src/modules/bookings/domain/waitlist-fifo.policy.ts
/**
 * LAFAM Booking waitlist FIFO policy.
 *
 * Role:
 * - Defines strict FIFO ordering rules for Pilates schedule waitlists.
 * - Defines allowed waitlist status transitions.
 * - Defines pure policy checks for joining, cancelling, promoting, converting,
 *   expiring, and removing waitlist entries.
 *
 * Important:
 * - This file contains pure waitlist policy logic only.
 * - Do not place database queries here.
 * - Do not place Supabase calls here.
 * - Do not place DTO validation decorators here.
 * - FIFO order must be decided by server/database values, never by frontend input.
 * - Correct FIFO order is: position ASC, joined_at ASC, id ASC.
 */

import { AppError } from '../../../common/errors/app-error';
import {
  WAITLIST_ACTIVE_STATUSES,
  WAITLIST_STATUS_CANCELLED,
  WAITLIST_STATUS_CONVERTED,
  WAITLIST_STATUS_EXPIRED,
  WAITLIST_STATUS_PROMOTED,
  WAITLIST_STATUS_REMOVED,
  WAITLIST_STATUS_WAITING,
  WAITLIST_TERMINAL_STATUSES,
  type BookingWaitlistStatus,
} from '../constants/booking.constants';

export interface WaitlistFifoState {
  readonly id: string;
  readonly schedule_id: string;
  readonly user_id: string;
  readonly position: number;
  readonly status: BookingWaitlistStatus;
  readonly joined_at: string;
  readonly promoted_at: string | null;
  readonly expired_at: string | null;
  readonly cancelled_at: string | null;
  readonly promotion_expires_at: string | null;
  readonly converted_booking_id: string | null;
}

export interface WaitlistFifoCandidate {
  readonly id: string;
  readonly position: number;
  readonly joined_at: string;
}

export interface WaitlistFifoOrderKey {
  readonly position: number;
  readonly joined_at: string;
  readonly id: string;
}

export interface WaitlistStatusTransition {
  readonly from_status: BookingWaitlistStatus;
  readonly to_status: BookingWaitlistStatus;
}

const WAITLIST_ALLOWED_STATUS_TRANSITIONS: ReadonlyMap<
  BookingWaitlistStatus,
  readonly BookingWaitlistStatus[]
> = new Map<BookingWaitlistStatus, readonly BookingWaitlistStatus[]>([
  [
    WAITLIST_STATUS_WAITING,
    [
      WAITLIST_STATUS_PROMOTED,
      WAITLIST_STATUS_CONVERTED,
      WAITLIST_STATUS_CANCELLED,
      WAITLIST_STATUS_EXPIRED,
      WAITLIST_STATUS_REMOVED,
    ],
  ],
  [
    WAITLIST_STATUS_PROMOTED,
    [
      WAITLIST_STATUS_CONVERTED,
      WAITLIST_STATUS_CANCELLED,
      WAITLIST_STATUS_EXPIRED,
      WAITLIST_STATUS_REMOVED,
    ],
  ],
  [WAITLIST_STATUS_CANCELLED, [WAITLIST_STATUS_REMOVED]],
  [WAITLIST_STATUS_EXPIRED, [WAITLIST_STATUS_REMOVED]],
  [WAITLIST_STATUS_CONVERTED, [WAITLIST_STATUS_REMOVED]],
  [WAITLIST_STATUS_REMOVED, []],
]);

function includesWaitlistStatus(
  statuses: readonly BookingWaitlistStatus[],
  status: BookingWaitlistStatus,
): boolean {
  return statuses.includes(status);
}

function parseFifoJoinedAt(value: string): number {
  const parsedValue = Date.parse(value);

  if (Number.isNaN(parsedValue)) {
    return Number.MAX_SAFE_INTEGER;
  }

  return parsedValue;
}

export function isWaitlistActiveStatus(status: BookingWaitlistStatus): boolean {
  return includesWaitlistStatus(WAITLIST_ACTIVE_STATUSES, status);
}

export function isWaitlistTerminalStatus(
  status: BookingWaitlistStatus,
): boolean {
  return includesWaitlistStatus(WAITLIST_TERMINAL_STATUSES, status);
}

export function getAllowedWaitlistStatusTransitions(
  status: BookingWaitlistStatus,
): readonly BookingWaitlistStatus[] {
  return WAITLIST_ALLOWED_STATUS_TRANSITIONS.get(status) ?? [];
}

export function canTransitionWaitlistStatus(
  fromStatus: BookingWaitlistStatus,
  toStatus: BookingWaitlistStatus,
): boolean {
  if (fromStatus === toStatus) {
    return false;
  }

  return getAllowedWaitlistStatusTransitions(fromStatus).includes(toStatus);
}

export function assertWaitlistStatusTransitionAllowed(
  transition: WaitlistStatusTransition,
): void {
  if (
    canTransitionWaitlistStatus(transition.from_status, transition.to_status)
  ) {
    return;
  }

  throw AppError.bookingInvalidStatusTransition(
    `Waitlist entry cannot move from ${transition.from_status} to ${transition.to_status}.`,
    {
      from_status: transition.from_status,
      to_status: transition.to_status,
    },
  );
}

export function getWaitlistFifoOrderKey(
  waitlist: WaitlistFifoCandidate,
): WaitlistFifoOrderKey {
  return {
    position: waitlist.position,
    joined_at: waitlist.joined_at,
    id: waitlist.id,
  };
}

export function compareWaitlistFifoEntries(
  left: WaitlistFifoCandidate,
  right: WaitlistFifoCandidate,
): number {
  if (left.position !== right.position) {
    return left.position - right.position;
  }

  const leftJoinedAt = parseFifoJoinedAt(left.joined_at);
  const rightJoinedAt = parseFifoJoinedAt(right.joined_at);

  if (leftJoinedAt !== rightJoinedAt) {
    return leftJoinedAt - rightJoinedAt;
  }

  return left.id.localeCompare(right.id);
}

export function sortWaitlistFifoEntries<T extends WaitlistFifoCandidate>(
  entries: readonly T[],
): readonly T[] {
  return [...entries].sort(compareWaitlistFifoEntries);
}

export function getFirstWaitlistFifoEntry<T extends WaitlistFifoCandidate>(
  entries: readonly T[],
): T | null {
  const sortedEntries = sortWaitlistFifoEntries(entries);

  return sortedEntries[0] ?? null;
}

export function buildNextWaitlistPosition(
  currentHighestPosition: number | null | undefined,
): number {
  if (
    typeof currentHighestPosition !== 'number' ||
    !Number.isInteger(currentHighestPosition) ||
    currentHighestPosition < 1
  ) {
    return 1;
  }

  return currentHighestPosition + 1;
}

export function assertWaitlistPositionIsValid(position: number): void {
  if (Number.isInteger(position) && position > 0) {
    return;
  }

  throw AppError.bookingInvalidStatusTransition(
    'Waitlist position must be a positive integer.',
    {
      position,
    },
  );
}

export function assertWaitlistEntryExists<T extends WaitlistFifoState>(
  waitlist: T | null | undefined,
): asserts waitlist is T {
  if (waitlist) {
    return;
  }

  throw AppError.bookingWaitlistNotFound();
}

export function assertNoActiveWaitlistEntry(
  existingWaitlist: WaitlistFifoState | null | undefined,
): void {
  if (!existingWaitlist) {
    return;
  }

  if (!isWaitlistActiveStatus(existingWaitlist.status)) {
    return;
  }

  throw AppError.bookingDuplicateWaitlistEntry(
    'User already has an active waitlist entry for this schedule.',
    {
      waitlist_id: existingWaitlist.id,
      schedule_id: existingWaitlist.schedule_id,
      user_id: existingWaitlist.user_id,
      status: existingWaitlist.status,
    },
  );
}

export function assertWaitlistCanBeCancelled(
  waitlist: WaitlistFifoState,
): void {
  if (waitlist.status === WAITLIST_STATUS_CANCELLED) {
    throw AppError.bookingInvalidStatusTransition(
      'This waitlist entry is already cancelled.',
      {
        waitlist_id: waitlist.id,
        current_status: waitlist.status,
      },
    );
  }

  if (!isWaitlistActiveStatus(waitlist.status)) {
    throw AppError.bookingInvalidStatusTransition(
      'Only active waitlist entries can be cancelled.',
      {
        waitlist_id: waitlist.id,
        current_status: waitlist.status,
        active_statuses: [...WAITLIST_ACTIVE_STATUSES],
      },
    );
  }

  assertWaitlistStatusTransitionAllowed({
    from_status: waitlist.status,
    to_status: WAITLIST_STATUS_CANCELLED,
  });
}

export function assertWaitlistCanBePromoted(waitlist: WaitlistFifoState): void {
  if (waitlist.status !== WAITLIST_STATUS_WAITING) {
    throw AppError.bookingWaitlistPromotionFailed(
      'Only waiting waitlist entries can be promoted.',
      {
        waitlist_id: waitlist.id,
        current_status: waitlist.status,
        required_status: WAITLIST_STATUS_WAITING,
      },
    );
  }

  assertWaitlistStatusTransitionAllowed({
    from_status: waitlist.status,
    to_status: WAITLIST_STATUS_PROMOTED,
  });
}

export function assertWaitlistCanBeConverted(
  waitlist: WaitlistFifoState,
): void {
  if (
    waitlist.status !== WAITLIST_STATUS_WAITING &&
    waitlist.status !== WAITLIST_STATUS_PROMOTED
  ) {
    throw AppError.bookingWaitlistPromotionFailed(
      'Only waiting or promoted waitlist entries can be converted to a booking.',
      {
        waitlist_id: waitlist.id,
        current_status: waitlist.status,
        allowed_statuses: [WAITLIST_STATUS_WAITING, WAITLIST_STATUS_PROMOTED],
      },
    );
  }

  assertWaitlistStatusTransitionAllowed({
    from_status: waitlist.status,
    to_status: WAITLIST_STATUS_CONVERTED,
  });
}

export function assertWaitlistCanBeExpired(waitlist: WaitlistFifoState): void {
  if (!isWaitlistActiveStatus(waitlist.status)) {
    throw AppError.bookingInvalidStatusTransition(
      'Only active waitlist entries can expire.',
      {
        waitlist_id: waitlist.id,
        current_status: waitlist.status,
        active_statuses: [...WAITLIST_ACTIVE_STATUSES],
      },
    );
  }

  assertWaitlistStatusTransitionAllowed({
    from_status: waitlist.status,
    to_status: WAITLIST_STATUS_EXPIRED,
  });
}

export function assertWaitlistCanBeRemoved(waitlist: WaitlistFifoState): void {
  if (waitlist.status === WAITLIST_STATUS_REMOVED) {
    throw AppError.bookingInvalidStatusTransition(
      'This waitlist entry is already removed.',
      {
        waitlist_id: waitlist.id,
        current_status: waitlist.status,
      },
    );
  }

  assertWaitlistStatusTransitionAllowed({
    from_status: waitlist.status,
    to_status: WAITLIST_STATUS_REMOVED,
  });
}

export function assertWaitlistBelongsToUser(
  waitlist: WaitlistFifoState,
  userId: string,
): void {
  if (waitlist.user_id === userId) {
    return;
  }

  throw AppError.bookingAccessDenied(
    'You are not allowed to access this waitlist entry.',
    {
      waitlist_id: waitlist.id,
      owner_user_id: waitlist.user_id,
      requester_user_id: userId,
    },
  );
}

export function assertWaitlistBelongsToSchedule(
  waitlist: WaitlistFifoState,
  scheduleId: string,
): void {
  if (waitlist.schedule_id === scheduleId) {
    return;
  }

  throw AppError.bookingInvalidStatusTransition(
    'Waitlist entry does not belong to the requested schedule.',
    {
      waitlist_id: waitlist.id,
      waitlist_schedule_id: waitlist.schedule_id,
      requested_schedule_id: scheduleId,
    },
  );
}

export function assertWaitlistEntryIsFirstInFifo(
  targetWaitlist: WaitlistFifoCandidate,
  firstWaitlist: WaitlistFifoCandidate | null | undefined,
): void {
  if (firstWaitlist && firstWaitlist.id === targetWaitlist.id) {
    return;
  }

  throw AppError.bookingWaitlistPromotionFailed(
    'Only the first FIFO waitlist entry can be promoted.',
    {
      target_waitlist_id: targetWaitlist.id,
      first_waitlist_id: firstWaitlist?.id ?? null,
      target_order_key: getWaitlistFifoOrderKey(targetWaitlist),
      first_order_key: firstWaitlist
        ? getWaitlistFifoOrderKey(firstWaitlist)
        : null,
    },
  );
}

export function assertWaitlistFifoOrderIsValid(
  entries: readonly WaitlistFifoCandidate[],
): void {
  const seenPositions = new Set<number>();
  let previousEntry: WaitlistFifoCandidate | null = null;

  for (const entry of entries) {
    assertWaitlistPositionIsValid(entry.position);

    if (seenPositions.has(entry.position)) {
      throw AppError.bookingWaitlistPromotionFailed(
        'Duplicate waitlist positions were detected.',
        {
          duplicate_position: entry.position,
          waitlist_id: entry.id,
        },
      );
    }

    seenPositions.add(entry.position);

    if (previousEntry && compareWaitlistFifoEntries(previousEntry, entry) > 0) {
      throw AppError.bookingWaitlistPromotionFailed(
        'Waitlist entries are not in FIFO order.',
        {
          previous_waitlist_id: previousEntry.id,
          current_waitlist_id: entry.id,
          previous_order_key: getWaitlistFifoOrderKey(previousEntry),
          current_order_key: getWaitlistFifoOrderKey(entry),
        },
      );
    }

    previousEntry = entry;
  }
}

export function assertWaitlistPromotionHasNotExpired(
  waitlist: WaitlistFifoState,
  now: Date = new Date(),
): void {
  if (!waitlist.promotion_expires_at) {
    return;
  }

  const promotionExpiryTime = Date.parse(waitlist.promotion_expires_at);

  if (Number.isNaN(promotionExpiryTime)) {
    throw AppError.bookingInvalidStatusTransition(
      'Waitlist promotion expiry timestamp is invalid.',
      {
        waitlist_id: waitlist.id,
        promotion_expires_at: waitlist.promotion_expires_at,
      },
    );
  }

  if (promotionExpiryTime > now.getTime()) {
    return;
  }

  throw AppError.bookingWaitlistPromotionFailed(
    'Waitlist promotion has expired.',
    {
      waitlist_id: waitlist.id,
      promotion_expires_at: waitlist.promotion_expires_at,
      checked_at: now.toISOString(),
    },
  );
}

export function assertWaitlistStateIsConsistent(
  waitlist: WaitlistFifoState,
): void {
  assertWaitlistPositionIsValid(waitlist.position);

  if (waitlist.status === WAITLIST_STATUS_PROMOTED && !waitlist.promoted_at) {
    throw AppError.bookingInvalidStatusTransition(
      'Promoted waitlist entries must have a promotion timestamp.',
      {
        waitlist_id: waitlist.id,
        current_status: waitlist.status,
        promoted_at: waitlist.promoted_at,
      },
    );
  }

  if (
    waitlist.status === WAITLIST_STATUS_CONVERTED &&
    (!waitlist.promoted_at || !waitlist.converted_booking_id)
  ) {
    throw AppError.bookingInvalidStatusTransition(
      'Converted waitlist entries must have a promotion timestamp and converted booking id.',
      {
        waitlist_id: waitlist.id,
        current_status: waitlist.status,
        promoted_at: waitlist.promoted_at,
        converted_booking_id: waitlist.converted_booking_id,
      },
    );
  }

  if (waitlist.status === WAITLIST_STATUS_EXPIRED && !waitlist.expired_at) {
    throw AppError.bookingInvalidStatusTransition(
      'Expired waitlist entries must have an expiry timestamp.',
      {
        waitlist_id: waitlist.id,
        current_status: waitlist.status,
        expired_at: waitlist.expired_at,
      },
    );
  }

  if (waitlist.status === WAITLIST_STATUS_CANCELLED && !waitlist.cancelled_at) {
    throw AppError.bookingInvalidStatusTransition(
      'Cancelled waitlist entries must have a cancellation timestamp.',
      {
        waitlist_id: waitlist.id,
        current_status: waitlist.status,
        cancelled_at: waitlist.cancelled_at,
      },
    );
  }
}
