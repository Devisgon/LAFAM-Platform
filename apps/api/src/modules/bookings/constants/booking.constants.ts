// apps/api/src/modules/bookings/constants/booking.constants.ts
/**
 * LAFAM Booking module constants.
 *
 * Role:
 * - Defines Booking Module statuses, payment states, sources, waitlist states,
 *   route prefixes, validation limits, pagination defaults, RPC action results,
 *   domain event names, and role access rules.
 * - Keeps DTOs, services, repositories, controllers, and Swagger aligned.
 *
 * Important:
 * - This file contains constants and lightweight type guards only.
 * - Do not place database queries here.
 * - Do not place service logic here.
 * - Do not place secrets or environment-derived values here.
 * - Booking is the source of truth for real schedule availability.
 * - Pilates and Salon booking flows must remain separate.
 */

import {
  AUTH_ADMIN_ROLE,
  AUTH_CUSTOMER_ROLE,
  AUTH_SUPER_ADMIN_ROLE,
  type AuthUserRole,
} from '../../auth/constants/auth-role.constants';

export const BOOKINGS_MODULE_NAME = 'bookings' as const;

export const BOOKING_CUSTOMER_ROUTE_PREFIX = 'bookings' as const;

export const BOOKING_CUSTOMER_WAITLIST_ROUTE_PREFIX =
  'bookings/waitlist' as const;

export const BOOKING_ADMIN_ROUTE_PREFIX = 'admin/bookings' as const;

export const BOOKING_ADMIN_WAITLIST_ROUTE_PREFIX =
  'admin/bookings/waitlist' as const;

export const BOOKING_ADMIN_SCHEDULE_WAITLIST_ROUTE_PREFIX =
  'admin/pilates/schedules' as const;

export const BOOKING_PUBLIC_AVAILABILITY_ROUTE_PREFIX =
  'pilates/schedules' as const;

export const BOOKING_STATUSES = [
  'pending_payment',
  'confirmed',
  'cancelled',
  'completed',
  'no_show',
  'expired',
  'rescheduled',
  'deleted',
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_STATUS_PENDING_PAYMENT =
  'pending_payment' satisfies BookingStatus;

export const BOOKING_STATUS_CONFIRMED = 'confirmed' satisfies BookingStatus;

export const BOOKING_STATUS_CANCELLED = 'cancelled' satisfies BookingStatus;

export const BOOKING_STATUS_COMPLETED = 'completed' satisfies BookingStatus;

export const BOOKING_STATUS_NO_SHOW = 'no_show' satisfies BookingStatus;

export const BOOKING_STATUS_EXPIRED = 'expired' satisfies BookingStatus;

export const BOOKING_STATUS_RESCHEDULED = 'rescheduled' satisfies BookingStatus;

export const BOOKING_STATUS_DELETED = 'deleted' satisfies BookingStatus;

export const BOOKING_ACTIVE_STATUSES = [
  BOOKING_STATUS_PENDING_PAYMENT,
  BOOKING_STATUS_CONFIRMED,
] as const satisfies readonly BookingStatus[];

export const BOOKING_VISIBLE_HISTORY_STATUSES = [
  BOOKING_STATUS_CONFIRMED,
  BOOKING_STATUS_CANCELLED,
  BOOKING_STATUS_COMPLETED,
  BOOKING_STATUS_NO_SHOW,
  BOOKING_STATUS_EXPIRED,
  BOOKING_STATUS_RESCHEDULED,
] as const satisfies readonly BookingStatus[];

export const BOOKING_TERMINAL_STATUSES = [
  BOOKING_STATUS_CANCELLED,
  BOOKING_STATUS_COMPLETED,
  BOOKING_STATUS_NO_SHOW,
  BOOKING_STATUS_EXPIRED,
  BOOKING_STATUS_RESCHEDULED,
  BOOKING_STATUS_DELETED,
] as const satisfies readonly BookingStatus[];

export const BOOKING_CANCELLABLE_STATUSES = [
  BOOKING_STATUS_PENDING_PAYMENT,
  BOOKING_STATUS_CONFIRMED,
] as const satisfies readonly BookingStatus[];

export const BOOKING_RESCHEDULABLE_STATUSES = [
  BOOKING_STATUS_CONFIRMED,
] as const satisfies readonly BookingStatus[];

export const BOOKING_PAYMENT_STATUSES = [
  'not_required',
  'pending',
  'paid',
  'failed',
  'refunded',
  'expired',
] as const;

export type BookingPaymentStatus = (typeof BOOKING_PAYMENT_STATUSES)[number];

export const BOOKING_PAYMENT_STATUS_NOT_REQUIRED =
  'not_required' satisfies BookingPaymentStatus;

export const BOOKING_PAYMENT_STATUS_PENDING =
  'pending' satisfies BookingPaymentStatus;

export const BOOKING_PAYMENT_STATUS_PAID =
  'paid' satisfies BookingPaymentStatus;

export const BOOKING_PAYMENT_STATUS_FAILED =
  'failed' satisfies BookingPaymentStatus;

export const BOOKING_PAYMENT_STATUS_REFUNDED =
  'refunded' satisfies BookingPaymentStatus;

export const BOOKING_PAYMENT_STATUS_EXPIRED =
  'expired' satisfies BookingPaymentStatus;

export const BOOKING_SOURCES = [
  'customer_web',
  'admin_dashboard',
  'system_waitlist_promotion',
] as const;

export type BookingSource = (typeof BOOKING_SOURCES)[number];

export const BOOKING_SOURCE_CUSTOMER_WEB =
  'customer_web' satisfies BookingSource;

export const BOOKING_SOURCE_ADMIN_DASHBOARD =
  'admin_dashboard' satisfies BookingSource;

export const BOOKING_SOURCE_SYSTEM_WAITLIST_PROMOTION =
  'system_waitlist_promotion' satisfies BookingSource;

export const WAITLIST_STATUSES = [
  'waiting',
  'promoted',
  'expired',
  'cancelled',
  'converted',
  'removed',
] as const;

export type BookingWaitlistStatus = (typeof WAITLIST_STATUSES)[number];

export const WAITLIST_STATUS_WAITING =
  'waiting' satisfies BookingWaitlistStatus;

export const WAITLIST_STATUS_PROMOTED =
  'promoted' satisfies BookingWaitlistStatus;

export const WAITLIST_STATUS_EXPIRED =
  'expired' satisfies BookingWaitlistStatus;

export const WAITLIST_STATUS_CANCELLED =
  'cancelled' satisfies BookingWaitlistStatus;

export const WAITLIST_STATUS_CONVERTED =
  'converted' satisfies BookingWaitlistStatus;

export const WAITLIST_STATUS_REMOVED =
  'removed' satisfies BookingWaitlistStatus;

export const WAITLIST_ACTIVE_STATUSES = [
  WAITLIST_STATUS_WAITING,
  WAITLIST_STATUS_PROMOTED,
] as const satisfies readonly BookingWaitlistStatus[];

export const WAITLIST_TERMINAL_STATUSES = [
  WAITLIST_STATUS_EXPIRED,
  WAITLIST_STATUS_CANCELLED,
  WAITLIST_STATUS_CONVERTED,
  WAITLIST_STATUS_REMOVED,
] as const satisfies readonly BookingWaitlistStatus[];

export const BOOKING_HISTORY_ACTIONS = [
  'booking_created',
  'booking_confirmed',
  'booking_cancelled',
  'booking_completed',
  'booking_no_show',
  'booking_expired',
  'booking_rescheduled',
  'waitlist_joined',
  'waitlist_promoted',
  'waitlist_cancelled',
  'admin_override',
] as const;

export type BookingHistoryAction = (typeof BOOKING_HISTORY_ACTIONS)[number];

export const BOOKING_HISTORY_ACTION_BOOKING_CREATED =
  'booking_created' satisfies BookingHistoryAction;

export const BOOKING_HISTORY_ACTION_BOOKING_CONFIRMED =
  'booking_confirmed' satisfies BookingHistoryAction;

export const BOOKING_HISTORY_ACTION_BOOKING_CANCELLED =
  'booking_cancelled' satisfies BookingHistoryAction;

export const BOOKING_HISTORY_ACTION_BOOKING_COMPLETED =
  'booking_completed' satisfies BookingHistoryAction;

export const BOOKING_HISTORY_ACTION_BOOKING_NO_SHOW =
  'booking_no_show' satisfies BookingHistoryAction;

export const BOOKING_HISTORY_ACTION_BOOKING_EXPIRED =
  'booking_expired' satisfies BookingHistoryAction;

export const BOOKING_HISTORY_ACTION_BOOKING_RESCHEDULED =
  'booking_rescheduled' satisfies BookingHistoryAction;

export const BOOKING_HISTORY_ACTION_WAITLIST_JOINED =
  'waitlist_joined' satisfies BookingHistoryAction;

export const BOOKING_HISTORY_ACTION_WAITLIST_PROMOTED =
  'waitlist_promoted' satisfies BookingHistoryAction;

export const BOOKING_HISTORY_ACTION_WAITLIST_CANCELLED =
  'waitlist_cancelled' satisfies BookingHistoryAction;

export const BOOKING_HISTORY_ACTION_ADMIN_OVERRIDE =
  'admin_override' satisfies BookingHistoryAction;

export const BOOKING_RPC_ACTION_RESULTS = [
  'existing_booking',
  'booked',
  'waitlisted',
  'cancelled',
  'cancelled_and_promoted',
  'target_waitlisted',
  'rescheduled',
] as const;

export type BookingRpcActionResult =
  (typeof BOOKING_RPC_ACTION_RESULTS)[number];

export const BOOKING_RPC_ACTION_EXISTING_BOOKING =
  'existing_booking' satisfies BookingRpcActionResult;

export const BOOKING_RPC_ACTION_BOOKED =
  'booked' satisfies BookingRpcActionResult;

export const BOOKING_RPC_ACTION_WAITLISTED =
  'waitlisted' satisfies BookingRpcActionResult;

export const BOOKING_RPC_ACTION_CANCELLED =
  'cancelled' satisfies BookingRpcActionResult;

export const BOOKING_RPC_ACTION_CANCELLED_AND_PROMOTED =
  'cancelled_and_promoted' satisfies BookingRpcActionResult;

export const BOOKING_RPC_ACTION_TARGET_WAITLISTED =
  'target_waitlisted' satisfies BookingRpcActionResult;

export const BOOKING_RPC_ACTION_RESCHEDULED =
  'rescheduled' satisfies BookingRpcActionResult;

export const BOOKING_DOMAIN_EVENTS = [
  'booking.created',
  'booking.cancelled',
  'booking.rescheduled',
  'booking.expired',
  'waitlist.joined',
  'waitlist.promoted',
  'availability.changed',
] as const;

export type BookingDomainEventName = (typeof BOOKING_DOMAIN_EVENTS)[number];

export const BOOKING_EVENT_CREATED =
  'booking.created' satisfies BookingDomainEventName;

export const BOOKING_EVENT_CANCELLED =
  'booking.cancelled' satisfies BookingDomainEventName;

export const BOOKING_EVENT_RESCHEDULED =
  'booking.rescheduled' satisfies BookingDomainEventName;

export const BOOKING_EVENT_EXPIRED =
  'booking.expired' satisfies BookingDomainEventName;

export const BOOKING_EVENT_WAITLIST_JOINED =
  'waitlist.joined' satisfies BookingDomainEventName;

export const BOOKING_EVENT_WAITLIST_PROMOTED =
  'waitlist.promoted' satisfies BookingDomainEventName;

export const BOOKING_EVENT_AVAILABILITY_CHANGED =
  'availability.changed' satisfies BookingDomainEventName;

export const BOOKING_CUSTOMER_ACCESS_ROLES = [
  AUTH_CUSTOMER_ROLE,
] as const satisfies readonly AuthUserRole[];

export const BOOKING_ADMIN_ACCESS_ROLES = [
  AUTH_ADMIN_ROLE,
  AUTH_SUPER_ADMIN_ROLE,
] as const satisfies readonly AuthUserRole[];

export const BOOKING_DEFAULT_LIMIT = 20 as const;
export const BOOKING_MAX_LIMIT = 100 as const;
export const BOOKING_DEFAULT_OFFSET = 0 as const;

export const BOOKING_ADMIN_DEFAULT_LIMIT = 50 as const;
export const BOOKING_ADMIN_MAX_LIMIT = 100 as const;
export const BOOKING_ADMIN_DEFAULT_OFFSET = 0 as const;

export const BOOKING_IDEMPOTENCY_KEY_MAX_LENGTH = 160 as const;
export const BOOKING_CANCEL_REASON_MAX_LENGTH = 1000 as const;
export const BOOKING_ADMIN_NOTES_MAX_LENGTH = 2000 as const;
export const BOOKING_HISTORY_NOTES_MAX_LENGTH = 2000 as const;
export const BOOKING_ACTOR_ROLE_MAX_LENGTH = 80 as const;

export const BOOKING_PAYMENT_HOLD_TTL_MINUTES = 15 as const;

export const BOOKING_DEFAULT_PAYMENT_REQUIRED = false as const;

export const BOOKING_UUID_VERSION = '4' as const;

export const BOOKING_ID_PARAM_NAME = 'bookingId' as const;
export const BOOKING_WAITLIST_ID_PARAM_NAME = 'waitlistId' as const;
export const BOOKING_SCHEDULE_ID_PARAM_NAME = 'scheduleId' as const;

export const BOOKING_SEARCH_MAX_LENGTH = 254 as const;

export const BOOKING_SORT_FIELDS = [
  'created_at',
  'schedule_date',
  'start_time',
  'status',
] as const;

export type BookingSortField = (typeof BOOKING_SORT_FIELDS)[number];

export const BOOKING_DEFAULT_SORT_FIELD =
  'created_at' satisfies BookingSortField;

export const BOOKING_SORT_DIRECTIONS = ['asc', 'desc'] as const;

export type BookingSortDirection = (typeof BOOKING_SORT_DIRECTIONS)[number];

export const BOOKING_DEFAULT_SORT_DIRECTION =
  'desc' satisfies BookingSortDirection;

export function isBookingStatus(value: string): value is BookingStatus {
  return BOOKING_STATUSES.includes(value as BookingStatus);
}

export function isBookingPaymentStatus(
  value: string,
): value is BookingPaymentStatus {
  return BOOKING_PAYMENT_STATUSES.includes(value as BookingPaymentStatus);
}

export function isBookingSource(value: string): value is BookingSource {
  return BOOKING_SOURCES.includes(value as BookingSource);
}

export function isBookingWaitlistStatus(
  value: string,
): value is BookingWaitlistStatus {
  return WAITLIST_STATUSES.includes(value as BookingWaitlistStatus);
}

export function isBookingHistoryAction(
  value: string,
): value is BookingHistoryAction {
  return BOOKING_HISTORY_ACTIONS.includes(value as BookingHistoryAction);
}

export function isBookingRpcActionResult(
  value: string,
): value is BookingRpcActionResult {
  return BOOKING_RPC_ACTION_RESULTS.includes(value as BookingRpcActionResult);
}

export function isBookingDomainEventName(
  value: string,
): value is BookingDomainEventName {
  return BOOKING_DOMAIN_EVENTS.includes(value as BookingDomainEventName);
}
