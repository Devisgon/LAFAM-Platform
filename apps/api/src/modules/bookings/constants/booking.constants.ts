// apps/api/src/modules/bookings/constants/booking.constants.ts
/**
 * LAFAM Booking module constants.
 *
 * Role:
 * - Defines Booking Module statuses, payment states, sources, waitlist states,
 *   private trainer booking states, route prefixes, validation limits,
 *   pagination defaults, RPC action results, calendar event types,
 *   domain event names, payment-flow state groups, and role access rules.
 * - Keeps DTOs, services, repositories, controllers, and Swagger aligned.
 * - Defines staff and trainer as the same operational booking-management access level.
 *
 * Important:
 * - This file contains constants and lightweight type guards only.
 * - Do not place database queries here.
 * - Do not place service logic here.
 * - Do not place secrets or environment-derived values here.
 * - Booking is the source of truth for real schedule availability.
 * - Payment is the source of truth for payment settlement.
 * - Pilates class bookings and private trainer bookings must remain separate flows.
 * - Bookings that require payment must start as pending_payment.
 * - Bookings must not be confirmed by the frontend.
 * - Staff and trainer users are not scoped differently for current admin booking access.
 */

import {
  AUTH_ADMIN_ROLE,
  AUTH_CUSTOMER_ROLE,
  AUTH_STAFF_ROLE,
  AUTH_SUPER_ADMIN_ROLE,
  AUTH_TRAINER_ROLE,
  type AuthUserRole,
} from '../../auth/constants/auth-role.constants';

export const BOOKINGS_MODULE_NAME = 'bookings' as const;

export const BOOKING_CUSTOMER_ROUTE_PREFIX = 'bookings' as const;
export const BOOKING_CUSTOMER_BULK_ROUTE_PREFIX = 'bookings/bulk' as const;

export const BOOKING_CUSTOMER_ORDER_ROUTE_PREFIX = 'bookings/orders' as const;

export const BOOKING_CUSTOMER_WAITLIST_ROUTE_PREFIX =
  'bookings/waitlist' as const;

export const BOOKING_CUSTOMER_PRIVATE_ROUTE_PREFIX =
  'bookings/private-trainer' as const;

export const BOOKING_CUSTOMER_PRIVATE_AVAILABILITY_ROUTE_PREFIX =
  'bookings/private-trainer/availability' as const;

export const BOOKING_ADMIN_ROUTE_PREFIX = 'admin/bookings' as const;
export const BOOKING_ADMIN_BULK_ROUTE_PREFIX = 'admin/bookings/bulk' as const;

export const BOOKING_ADMIN_ORDER_ROUTE_PREFIX =
  'admin/bookings/orders' as const;

export const BOOKING_ADMIN_WAITLIST_ROUTE_PREFIX =
  'admin/bookings/waitlist' as const;

export const BOOKING_ADMIN_PRIVATE_ROUTE_PREFIX =
  'admin/bookings/private-trainer' as const;

export const BOOKING_ADMIN_CALENDAR_ROUTE_PREFIX =
  'admin/bookings/calendar' as const;

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
export const BOOKING_ORDER_STATUSES = [
  'pending_payment',
  'paid',
  'expired',
  'cancelled',
  'refunded',
] as const;

export type BookingOrderStatus = (typeof BOOKING_ORDER_STATUSES)[number];

export const BOOKING_ORDER_STATUS_PENDING_PAYMENT =
  'pending_payment' satisfies BookingOrderStatus;

export const BOOKING_ORDER_STATUS_PAID = 'paid' satisfies BookingOrderStatus;

export const BOOKING_ORDER_STATUS_EXPIRED =
  'expired' satisfies BookingOrderStatus;

export const BOOKING_ORDER_STATUS_CANCELLED =
  'cancelled' satisfies BookingOrderStatus;

export const BOOKING_ORDER_STATUS_REFUNDED =
  'refunded' satisfies BookingOrderStatus;

export const BOOKING_ORDER_PAYABLE_STATUSES = [
  BOOKING_ORDER_STATUS_PENDING_PAYMENT,
] as const satisfies readonly BookingOrderStatus[];

export const BOOKING_ORDER_TERMINAL_STATUSES = [
  BOOKING_ORDER_STATUS_PAID,
  BOOKING_ORDER_STATUS_EXPIRED,
  BOOKING_ORDER_STATUS_CANCELLED,
  BOOKING_ORDER_STATUS_REFUNDED,
] as const satisfies readonly BookingOrderStatus[];
export const BOOKING_ORDER_ITEM_STATUSES = [
  'pending_payment',
  'confirmed',
  'expired',
  'cancelled',
  'refunded',
] as const;

export type BookingOrderItemStatus =
  (typeof BOOKING_ORDER_ITEM_STATUSES)[number];

export const BOOKING_ORDER_ITEM_STATUS_PENDING_PAYMENT =
  'pending_payment' satisfies BookingOrderItemStatus;

export const BOOKING_ORDER_ITEM_STATUS_CONFIRMED =
  'confirmed' satisfies BookingOrderItemStatus;

export const BOOKING_ORDER_ITEM_STATUS_EXPIRED =
  'expired' satisfies BookingOrderItemStatus;

export const BOOKING_ORDER_ITEM_STATUS_CANCELLED =
  'cancelled' satisfies BookingOrderItemStatus;

export const BOOKING_ORDER_ITEM_STATUS_REFUNDED =
  'refunded' satisfies BookingOrderItemStatus;

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

export const BOOKING_PAYMENT_PENDING_BOOKING_STATUSES = [
  BOOKING_STATUS_PENDING_PAYMENT,
] as const satisfies readonly BookingStatus[];

export const BOOKING_PAYMENT_CONFIRMATION_ALLOWED_STATUSES = [
  BOOKING_STATUS_PENDING_PAYMENT,
  BOOKING_STATUS_CONFIRMED,
] as const satisfies readonly BookingStatus[];

export const BOOKING_PAYMENT_FAILURE_ALLOWED_STATUSES = [
  BOOKING_STATUS_PENDING_PAYMENT,
] as const satisfies readonly BookingStatus[];

export const BOOKING_PAYMENT_EXPIRABLE_STATUSES = [
  BOOKING_STATUS_PENDING_PAYMENT,
] as const satisfies readonly BookingStatus[];

export type BookingPaymentPendingBookingStatus =
  (typeof BOOKING_PAYMENT_PENDING_BOOKING_STATUSES)[number];

export type BookingPaymentConfirmationAllowedStatus =
  (typeof BOOKING_PAYMENT_CONFIRMATION_ALLOWED_STATUSES)[number];

export type BookingPaymentFailureAllowedStatus =
  (typeof BOOKING_PAYMENT_FAILURE_ALLOWED_STATUSES)[number];

export type BookingPaymentExpirableStatus =
  (typeof BOOKING_PAYMENT_EXPIRABLE_STATUSES)[number];

export const PRIVATE_BOOKING_ACTIVE_STATUSES = [
  BOOKING_STATUS_PENDING_PAYMENT,
  BOOKING_STATUS_CONFIRMED,
] as const satisfies readonly BookingStatus[];

export const PRIVATE_BOOKING_VISIBLE_HISTORY_STATUSES = [
  BOOKING_STATUS_CONFIRMED,
  BOOKING_STATUS_CANCELLED,
  BOOKING_STATUS_COMPLETED,
  BOOKING_STATUS_NO_SHOW,
  BOOKING_STATUS_EXPIRED,
  BOOKING_STATUS_RESCHEDULED,
] as const satisfies readonly BookingStatus[];

export const PRIVATE_BOOKING_TERMINAL_STATUSES = [
  BOOKING_STATUS_CANCELLED,
  BOOKING_STATUS_COMPLETED,
  BOOKING_STATUS_NO_SHOW,
  BOOKING_STATUS_EXPIRED,
  BOOKING_STATUS_RESCHEDULED,
  BOOKING_STATUS_DELETED,
] as const satisfies readonly BookingStatus[];

export const PRIVATE_BOOKING_CANCELLABLE_STATUSES = [
  BOOKING_STATUS_PENDING_PAYMENT,
  BOOKING_STATUS_CONFIRMED,
] as const satisfies readonly BookingStatus[];

export const PRIVATE_BOOKING_RESCHEDULABLE_STATUSES = [
  BOOKING_STATUS_PENDING_PAYMENT,
  BOOKING_STATUS_CONFIRMED,
] as const satisfies readonly BookingStatus[];

export const PRIVATE_BOOKING_PAYMENT_PENDING_BOOKING_STATUSES =
  BOOKING_PAYMENT_PENDING_BOOKING_STATUSES;

export const PRIVATE_BOOKING_PAYMENT_CONFIRMATION_ALLOWED_STATUSES =
  BOOKING_PAYMENT_CONFIRMATION_ALLOWED_STATUSES;

export const PRIVATE_BOOKING_PAYMENT_FAILURE_ALLOWED_STATUSES =
  BOOKING_PAYMENT_FAILURE_ALLOWED_STATUSES;

export const PRIVATE_BOOKING_PAYMENT_EXPIRABLE_STATUSES =
  BOOKING_PAYMENT_EXPIRABLE_STATUSES;

export type PrivateBookingActiveStatus =
  (typeof PRIVATE_BOOKING_ACTIVE_STATUSES)[number];

export type PrivateBookingTerminalStatus =
  (typeof PRIVATE_BOOKING_TERMINAL_STATUSES)[number];

export type PrivateBookingCancellableStatus =
  (typeof PRIVATE_BOOKING_CANCELLABLE_STATUSES)[number];

export type PrivateBookingReschedulableStatus =
  (typeof PRIVATE_BOOKING_RESCHEDULABLE_STATUSES)[number];

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

export const BOOKING_PAYMENT_PAYABLE_STATUSES = [
  BOOKING_PAYMENT_STATUS_PENDING,
  BOOKING_PAYMENT_STATUS_FAILED,
] as const satisfies readonly BookingPaymentStatus[];

export const BOOKING_PAYMENT_RETRYABLE_STATUSES = [
  BOOKING_PAYMENT_STATUS_FAILED,
] as const satisfies readonly BookingPaymentStatus[];

export const BOOKING_PAYMENT_SETTLED_STATUSES = [
  BOOKING_PAYMENT_STATUS_NOT_REQUIRED,
  BOOKING_PAYMENT_STATUS_PAID,
] as const satisfies readonly BookingPaymentStatus[];

export const BOOKING_PAYMENT_FAILURE_STATUSES = [
  BOOKING_PAYMENT_STATUS_FAILED,
  BOOKING_PAYMENT_STATUS_EXPIRED,
] as const satisfies readonly BookingPaymentStatus[];

export const BOOKING_PAYMENT_TERMINAL_STATUSES = [
  BOOKING_PAYMENT_STATUS_NOT_REQUIRED,
  BOOKING_PAYMENT_STATUS_PAID,
  BOOKING_PAYMENT_STATUS_REFUNDED,
  BOOKING_PAYMENT_STATUS_EXPIRED,
] as const satisfies readonly BookingPaymentStatus[];

export const BOOKING_PAYMENT_REFUNDABLE_STATUSES = [
  BOOKING_PAYMENT_STATUS_PAID,
] as const satisfies readonly BookingPaymentStatus[];

export const BOOKING_PAYMENT_CONFIRMING_STATUSES = [
  BOOKING_PAYMENT_STATUS_NOT_REQUIRED,
  BOOKING_PAYMENT_STATUS_PAID,
] as const satisfies readonly BookingPaymentStatus[];

export const PRIVATE_BOOKING_PAYMENT_PAYABLE_STATUSES =
  BOOKING_PAYMENT_PAYABLE_STATUSES;

export const PRIVATE_BOOKING_PAYMENT_RETRYABLE_STATUSES =
  BOOKING_PAYMENT_RETRYABLE_STATUSES;

export const PRIVATE_BOOKING_PAYMENT_SETTLED_STATUSES =
  BOOKING_PAYMENT_SETTLED_STATUSES;

export const PRIVATE_BOOKING_PAYMENT_FAILURE_STATUSES =
  BOOKING_PAYMENT_FAILURE_STATUSES;

export const PRIVATE_BOOKING_PAYMENT_TERMINAL_STATUSES =
  BOOKING_PAYMENT_TERMINAL_STATUSES;

export const PRIVATE_BOOKING_PAYMENT_REFUNDABLE_STATUSES =
  BOOKING_PAYMENT_REFUNDABLE_STATUSES;

export const PRIVATE_BOOKING_PAYMENT_CONFIRMING_STATUSES =
  BOOKING_PAYMENT_CONFIRMING_STATUSES;

export type BookingPaymentPayableStatus =
  (typeof BOOKING_PAYMENT_PAYABLE_STATUSES)[number];

export type BookingPaymentRetryableStatus =
  (typeof BOOKING_PAYMENT_RETRYABLE_STATUSES)[number];

export type BookingPaymentSettledStatus =
  (typeof BOOKING_PAYMENT_SETTLED_STATUSES)[number];

export type BookingPaymentFailureStatus =
  (typeof BOOKING_PAYMENT_FAILURE_STATUSES)[number];

export type BookingPaymentTerminalStatus =
  (typeof BOOKING_PAYMENT_TERMINAL_STATUSES)[number];

export type BookingPaymentRefundableStatus =
  (typeof BOOKING_PAYMENT_REFUNDABLE_STATUSES)[number];

export type BookingPaymentConfirmingStatus =
  (typeof BOOKING_PAYMENT_CONFIRMING_STATUSES)[number];

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

export const PRIVATE_BOOKING_HISTORY_ACTIONS = [
  'private_booking_created',
  'private_booking_confirmed',
  'private_booking_cancelled',
  'private_booking_completed',
  'private_booking_no_show',
  'private_booking_expired',
  'private_booking_rescheduled',
  'private_booking_admin_override',
] as const;

export type PrivateBookingHistoryAction =
  (typeof PRIVATE_BOOKING_HISTORY_ACTIONS)[number];

export const PRIVATE_BOOKING_HISTORY_ACTION_CREATED =
  'private_booking_created' satisfies PrivateBookingHistoryAction;

export const PRIVATE_BOOKING_HISTORY_ACTION_CONFIRMED =
  'private_booking_confirmed' satisfies PrivateBookingHistoryAction;

export const PRIVATE_BOOKING_HISTORY_ACTION_CANCELLED =
  'private_booking_cancelled' satisfies PrivateBookingHistoryAction;

export const PRIVATE_BOOKING_HISTORY_ACTION_COMPLETED =
  'private_booking_completed' satisfies PrivateBookingHistoryAction;

export const PRIVATE_BOOKING_HISTORY_ACTION_NO_SHOW =
  'private_booking_no_show' satisfies PrivateBookingHistoryAction;

export const PRIVATE_BOOKING_HISTORY_ACTION_EXPIRED =
  'private_booking_expired' satisfies PrivateBookingHistoryAction;

export const PRIVATE_BOOKING_HISTORY_ACTION_RESCHEDULED =
  'private_booking_rescheduled' satisfies PrivateBookingHistoryAction;

export const PRIVATE_BOOKING_HISTORY_ACTION_ADMIN_OVERRIDE =
  'private_booking_admin_override' satisfies PrivateBookingHistoryAction;

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
export const BOOKING_ORDER_RPC_ACTION_RESULTS = [
  'created_order',
  'existing_order',
] as const;

export type BookingOrderRpcActionResult =
  (typeof BOOKING_ORDER_RPC_ACTION_RESULTS)[number];

export const BOOKING_ORDER_RPC_ACTION_CREATED_ORDER =
  'created_order' satisfies BookingOrderRpcActionResult;

export const BOOKING_ORDER_RPC_ACTION_EXISTING_ORDER =
  'existing_order' satisfies BookingOrderRpcActionResult;

export const PRIVATE_BOOKING_RPC_ACTION_RESULTS = [
  'existing_private_booking',
  'private_booked',
  'private_cancelled',
  'private_rescheduled',
] as const;

export type PrivateBookingRpcActionResult =
  (typeof PRIVATE_BOOKING_RPC_ACTION_RESULTS)[number];

export const PRIVATE_BOOKING_RPC_ACTION_EXISTING_PRIVATE_BOOKING =
  'existing_private_booking' satisfies PrivateBookingRpcActionResult;

export const PRIVATE_BOOKING_RPC_ACTION_BOOKED =
  'private_booked' satisfies PrivateBookingRpcActionResult;

export const PRIVATE_BOOKING_RPC_ACTION_CANCELLED =
  'private_cancelled' satisfies PrivateBookingRpcActionResult;

export const PRIVATE_BOOKING_RPC_ACTION_RESCHEDULED =
  'private_rescheduled' satisfies PrivateBookingRpcActionResult;

export const BOOKING_DOMAIN_EVENTS = [
  'booking.created',
  'booking.cancelled',
  'booking.rescheduled',
  'booking.expired',
  'booking.payment_confirmed',
  'booking.payment_expired',
  'booking_order.created',
  'booking_order.item_created',
  'booking_order.paid',
  'booking_order.item_confirmed',
  'booking_order.expired',
  'booking_order.item_expired',
  'bulk_booking.created',
  'waitlist.joined',
  'waitlist.promoted',
  'availability.changed',
  'private_booking.created',
  'private_booking.cancelled',
  'private_booking.rescheduled',
  'private_booking.expired',
  'private_booking.completed',
  'private_booking.no_show',
  'private_booking.payment_confirmed',
  'private_booking.payment_expired',
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
export const BOOKING_EVENT_PAYMENT_CONFIRMED =
  'booking.payment_confirmed' satisfies BookingDomainEventName;

export const BOOKING_EVENT_PAYMENT_EXPIRED =
  'booking.payment_expired' satisfies BookingDomainEventName;

export const BOOKING_EVENT_ORDER_CREATED =
  'booking_order.created' satisfies BookingDomainEventName;

export const BOOKING_EVENT_ORDER_ITEM_CREATED =
  'booking_order.item_created' satisfies BookingDomainEventName;

export const BOOKING_EVENT_ORDER_PAID =
  'booking_order.paid' satisfies BookingDomainEventName;

export const BOOKING_EVENT_ORDER_ITEM_CONFIRMED =
  'booking_order.item_confirmed' satisfies BookingDomainEventName;

export const BOOKING_EVENT_ORDER_EXPIRED =
  'booking_order.expired' satisfies BookingDomainEventName;

export const BOOKING_EVENT_ORDER_ITEM_EXPIRED =
  'booking_order.item_expired' satisfies BookingDomainEventName;

export const BOOKING_EVENT_BULK_BOOKING_CREATED =
  'bulk_booking.created' satisfies BookingDomainEventName;

export const BOOKING_EVENT_WAITLIST_JOINED =
  'waitlist.joined' satisfies BookingDomainEventName;

export const BOOKING_EVENT_WAITLIST_PROMOTED =
  'waitlist.promoted' satisfies BookingDomainEventName;

export const BOOKING_EVENT_AVAILABILITY_CHANGED =
  'availability.changed' satisfies BookingDomainEventName;

export const BOOKING_EVENT_PRIVATE_BOOKING_CREATED =
  'private_booking.created' satisfies BookingDomainEventName;

export const BOOKING_EVENT_PRIVATE_BOOKING_CANCELLED =
  'private_booking.cancelled' satisfies BookingDomainEventName;

export const BOOKING_EVENT_PRIVATE_BOOKING_RESCHEDULED =
  'private_booking.rescheduled' satisfies BookingDomainEventName;

export const BOOKING_EVENT_PRIVATE_BOOKING_EXPIRED =
  'private_booking.expired' satisfies BookingDomainEventName;

export const BOOKING_EVENT_PRIVATE_BOOKING_COMPLETED =
  'private_booking.completed' satisfies BookingDomainEventName;

export const BOOKING_EVENT_PRIVATE_BOOKING_NO_SHOW =
  'private_booking.no_show' satisfies BookingDomainEventName;
export const BOOKING_EVENT_PRIVATE_BOOKING_PAYMENT_CONFIRMED =
  'private_booking.payment_confirmed' satisfies BookingDomainEventName;

export const BOOKING_EVENT_PRIVATE_BOOKING_PAYMENT_EXPIRED =
  'private_booking.payment_expired' satisfies BookingDomainEventName;

export const BOOKING_CALENDAR_EVENT_TYPES = [
  'pilates_schedule',
  'pilates_booking',
  'waitlist_entry',
  'private_trainer_booking',
] as const;

export type BookingCalendarEventType =
  (typeof BOOKING_CALENDAR_EVENT_TYPES)[number];

export const BOOKING_CALENDAR_EVENT_TYPE_PILATES_SCHEDULE =
  'pilates_schedule' satisfies BookingCalendarEventType;

export const BOOKING_CALENDAR_EVENT_TYPE_PILATES_BOOKING =
  'pilates_booking' satisfies BookingCalendarEventType;

export const BOOKING_CALENDAR_EVENT_TYPE_WAITLIST_ENTRY =
  'waitlist_entry' satisfies BookingCalendarEventType;

export const BOOKING_CALENDAR_EVENT_TYPE_PRIVATE_TRAINER_BOOKING =
  'private_trainer_booking' satisfies BookingCalendarEventType;

export const BOOKING_CUSTOMER_ACCESS_ROLES = [
  AUTH_CUSTOMER_ROLE,
] as const satisfies readonly AuthUserRole[];

export const BOOKING_ADMIN_ACCESS_ROLES = [
  AUTH_ADMIN_ROLE,
  AUTH_SUPER_ADMIN_ROLE,
] as const satisfies readonly AuthUserRole[];

export const BOOKING_OPERATIONAL_ADMIN_ACCESS_ROLES = [
  AUTH_ADMIN_ROLE,
  AUTH_SUPER_ADMIN_ROLE,
  AUTH_STAFF_ROLE,
  AUTH_TRAINER_ROLE,
] as const satisfies readonly AuthUserRole[];

/**
 * Backward-compatible alias used by existing Booking controller imports.
 *
 * Important:
 * - The historical name says "staff", but the current access group includes
 *   admin, super_admin, staff, and trainer.
 * - Do not use this name for new code. Prefer BOOKING_OPERATIONAL_ADMIN_ACCESS_ROLES.
 */
export const BOOKING_STAFF_ADMIN_ACCESS_ROLES =
  BOOKING_OPERATIONAL_ADMIN_ACCESS_ROLES;

/**
 * Backward-compatible empty alias for the old trainer-scoped access model.
 *
 * Important:
 * - Trainer is no longer scoped for current admin booking access.
 * - Trainer is included in BOOKING_OPERATIONAL_ADMIN_ACCESS_ROLES and
 *   BOOKING_FULL_MANAGEMENT_ROLES.
 * - This export is kept to avoid breaking existing imports until the policy
 *   and service files are cleaned up in the next steps.
 */
export const BOOKING_TRAINER_SCOPED_ACCESS_ROLES: readonly AuthUserRole[] = [];

export const BOOKING_ADMIN_AND_STAFF_ACCESS_ROLES =
  BOOKING_OPERATIONAL_ADMIN_ACCESS_ROLES;

export const BOOKING_FULL_MANAGEMENT_ROLES =
  BOOKING_OPERATIONAL_ADMIN_ACCESS_ROLES;

/**
 * No role currently uses scoped booking management.
 *
 * Trainer used to enter this group, but the approved access model now gives
 * trainer the same booking-management scope as staff.
 */
export const BOOKING_SCOPED_MANAGEMENT_ROLES: readonly AuthUserRole[] = [];

export const BOOKING_DEFAULT_LIMIT = 20 as const;
export const BOOKING_MAX_LIMIT = 100 as const;
export const BOOKING_DEFAULT_OFFSET = 0 as const;

export const BOOKING_ADMIN_DEFAULT_LIMIT = 50 as const;
export const BOOKING_ADMIN_MAX_LIMIT = 100 as const;
export const BOOKING_ADMIN_DEFAULT_OFFSET = 0 as const;

export const PRIVATE_BOOKING_DEFAULT_LIMIT = 20 as const;
export const PRIVATE_BOOKING_MAX_LIMIT = 100 as const;
export const PRIVATE_BOOKING_DEFAULT_OFFSET = 0 as const;

export const PRIVATE_BOOKING_ADMIN_DEFAULT_LIMIT = 50 as const;
export const PRIVATE_BOOKING_ADMIN_MAX_LIMIT = 100 as const;
export const PRIVATE_BOOKING_ADMIN_DEFAULT_OFFSET = 0 as const;

export const BOOKING_IDEMPOTENCY_KEY_MAX_LENGTH = 160 as const;
export const BOOKING_CANCEL_REASON_MAX_LENGTH = 1000 as const;
export const BOOKING_ADMIN_NOTES_MAX_LENGTH = 2000 as const;
export const BOOKING_BULK_MIN_SCHEDULE_COUNT = 1 as const;
export const BOOKING_BULK_MAX_SCHEDULE_COUNT = 20 as const;

export const BOOKING_ORDER_NUMBER_MAX_LENGTH = 100 as const;
export const BOOKING_ORDER_CREATED_BY_ROLE_MAX_LENGTH = 80 as const;
export const BOOKING_ORDER_ADMIN_NOTES_MAX_LENGTH =
  BOOKING_ADMIN_NOTES_MAX_LENGTH;

export const BOOKING_PAYMENT_HOLD_TTL_MINUTES = 15 as const;
export const BOOKING_ORDER_PAYMENT_HOLD_TTL_MINUTES =
  BOOKING_PAYMENT_HOLD_TTL_MINUTES;

export const BOOKING_ORDER_DEFAULT_CURRENCY = 'KWD' as const;
export const BOOKING_ORDER_ALLOWED_CURRENCIES = [
  BOOKING_ORDER_DEFAULT_CURRENCY,
] as const;

export const BOOKING_ORDER_PRICE_AMOUNT_MIN = 0.001 as const;
export const BOOKING_ORDER_PRICE_DECIMAL_PLACES = 3 as const;
export const BOOKING_HISTORY_NOTES_MAX_LENGTH = 2000 as const;
export const BOOKING_ACTOR_ROLE_MAX_LENGTH = 80 as const;

export const BOOKING_PAYMENT_HOLD_EXPIRING_SOON_THRESHOLD_MINUTES = 5 as const;

export const BOOKING_DEFAULT_PAYMENT_REQUIRED = true as const;
export const PRIVATE_BOOKING_DEFAULT_PAYMENT_REQUIRED = true as const;
export const PRIVATE_BOOKING_PRICE_AMOUNT_MIN = 0 as const;
export const PRIVATE_BOOKING_PRICE_DECIMAL_PLACES = 3 as const;
export const PRIVATE_BOOKING_DEFAULT_PRICE_AMOUNT = 0 as const;
export const PRIVATE_BOOKING_DEFAULT_CURRENCY = 'KWD' as const;
export const PRIVATE_BOOKING_ALLOWED_CURRENCIES = [
  PRIVATE_BOOKING_DEFAULT_CURRENCY,
] as const;

export const BOOKING_PAYMENT_REQUIRED_DEFAULT_STATUS =
  BOOKING_PAYMENT_STATUS_PENDING;

export const BOOKING_PAYMENT_NOT_REQUIRED_DEFAULT_STATUS =
  BOOKING_PAYMENT_STATUS_NOT_REQUIRED;

export const PRIVATE_BOOKING_PAYMENT_REQUIRED_DEFAULT_STATUS =
  BOOKING_PAYMENT_STATUS_PENDING;

export const PRIVATE_BOOKING_PAYMENT_NOT_REQUIRED_DEFAULT_STATUS =
  BOOKING_PAYMENT_STATUS_NOT_REQUIRED;

export const PRIVATE_BOOKING_DEFAULT_STUDIO = 'LAFAM Pilates Studio' as const;
export const PRIVATE_BOOKING_STUDIO_MIN_LENGTH = 2 as const;
export const PRIVATE_BOOKING_STUDIO_MAX_LENGTH = 120 as const;

export const PRIVATE_BOOKING_DURATION_MIN_MINUTES = 15 as const;
export const PRIVATE_BOOKING_DURATION_MAX_MINUTES = 240 as const;
export const PRIVATE_BOOKING_DEFAULT_DURATION_MINUTES = 60 as const;

export const PRIVATE_BOOKING_AVAILABILITY_SLOT_INTERVAL_MINUTES = 15 as const;
export const PRIVATE_BOOKING_AVAILABILITY_MAX_RANGE_DAYS = 31 as const;

export const BOOKING_ADMIN_CALENDAR_MAX_RANGE_DAYS = 93 as const;
export const BOOKING_ADMIN_CALENDAR_DEFAULT_INCLUDE_CLASS_SCHEDULES =
  true as const;
export const BOOKING_ADMIN_CALENDAR_DEFAULT_INCLUDE_CLASS_BOOKINGS =
  false as const;
export const BOOKING_ADMIN_CALENDAR_DEFAULT_INCLUDE_WAITLIST = false as const;
export const BOOKING_ADMIN_CALENDAR_DEFAULT_INCLUDE_PRIVATE_BOOKINGS =
  true as const;

export const BOOKING_UUID_VERSION = '4' as const;

export const BOOKING_ID_PARAM_NAME = 'bookingId' as const;
export const BOOKING_ORDER_ID_PARAM_NAME = 'bookingOrderId' as const;
export const BOOKING_WAITLIST_ID_PARAM_NAME = 'waitlistId' as const;
export const BOOKING_SCHEDULE_ID_PARAM_NAME = 'scheduleId' as const;
export const PRIVATE_BOOKING_ID_PARAM_NAME = 'privateBookingId' as const;
export const PRIVATE_BOOKING_TRAINER_ID_PARAM_NAME = 'trainerId' as const;

export const BOOKING_SEARCH_MAX_LENGTH = 254 as const;

export const BOOKING_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export const BOOKING_TIME_VALUE_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/u;

export const BOOKING_SORT_FIELDS = [
  'created_at',
  'schedule_date',
  'start_time',
  'status',
] as const;

export type BookingSortField = (typeof BOOKING_SORT_FIELDS)[number];

export const BOOKING_DEFAULT_SORT_FIELD =
  'created_at' satisfies BookingSortField;

export const PRIVATE_BOOKING_SORT_FIELDS = [
  'created_at',
  'session_date',
  'start_time',
  'status',
] as const;

export type PrivateBookingSortField =
  (typeof PRIVATE_BOOKING_SORT_FIELDS)[number];

export const PRIVATE_BOOKING_DEFAULT_SORT_FIELD =
  'created_at' satisfies PrivateBookingSortField;

export const BOOKING_CALENDAR_SORT_FIELDS = [
  'start_at',
  'event_type',
  'status',
] as const;

export type BookingCalendarSortField =
  (typeof BOOKING_CALENDAR_SORT_FIELDS)[number];

export const BOOKING_CALENDAR_DEFAULT_SORT_FIELD =
  'start_at' satisfies BookingCalendarSortField;

export const BOOKING_SORT_DIRECTIONS = ['asc', 'desc'] as const;

export type BookingSortDirection = (typeof BOOKING_SORT_DIRECTIONS)[number];

export const BOOKING_DEFAULT_SORT_DIRECTION =
  'desc' satisfies BookingSortDirection;

export const BOOKING_CALENDAR_DEFAULT_SORT_DIRECTION =
  'asc' satisfies BookingSortDirection;

export function isBookingStatus(value: string): value is BookingStatus {
  return BOOKING_STATUSES.includes(value as BookingStatus);
}
export function isBookingOrderStatus(
  value: string,
): value is BookingOrderStatus {
  return BOOKING_ORDER_STATUSES.includes(value as BookingOrderStatus);
}

export function isBookingOrderPayableStatus(
  value: string,
): value is (typeof BOOKING_ORDER_PAYABLE_STATUSES)[number] {
  return BOOKING_ORDER_PAYABLE_STATUSES.includes(
    value as (typeof BOOKING_ORDER_PAYABLE_STATUSES)[number],
  );
}

export function isBookingOrderTerminalStatus(
  value: string,
): value is (typeof BOOKING_ORDER_TERMINAL_STATUSES)[number] {
  return BOOKING_ORDER_TERMINAL_STATUSES.includes(
    value as (typeof BOOKING_ORDER_TERMINAL_STATUSES)[number],
  );
}

export function isBookingOrderItemStatus(
  value: string,
): value is BookingOrderItemStatus {
  return BOOKING_ORDER_ITEM_STATUSES.includes(value as BookingOrderItemStatus);
}

export function isBookingActiveStatus(
  value: string,
): value is (typeof BOOKING_ACTIVE_STATUSES)[number] {
  return BOOKING_ACTIVE_STATUSES.includes(
    value as (typeof BOOKING_ACTIVE_STATUSES)[number],
  );
}

export function isBookingTerminalStatus(
  value: string,
): value is (typeof BOOKING_TERMINAL_STATUSES)[number] {
  return BOOKING_TERMINAL_STATUSES.includes(
    value as (typeof BOOKING_TERMINAL_STATUSES)[number],
  );
}

export function isBookingCancellableStatus(
  value: string,
): value is (typeof BOOKING_CANCELLABLE_STATUSES)[number] {
  return BOOKING_CANCELLABLE_STATUSES.includes(
    value as (typeof BOOKING_CANCELLABLE_STATUSES)[number],
  );
}

export function isBookingReschedulableStatus(
  value: string,
): value is (typeof BOOKING_RESCHEDULABLE_STATUSES)[number] {
  return BOOKING_RESCHEDULABLE_STATUSES.includes(
    value as (typeof BOOKING_RESCHEDULABLE_STATUSES)[number],
  );
}

export function isBookingPaymentPendingBookingStatus(
  value: string,
): value is BookingPaymentPendingBookingStatus {
  return BOOKING_PAYMENT_PENDING_BOOKING_STATUSES.includes(
    value as BookingPaymentPendingBookingStatus,
  );
}

export function isBookingPaymentConfirmationAllowedStatus(
  value: string,
): value is BookingPaymentConfirmationAllowedStatus {
  return BOOKING_PAYMENT_CONFIRMATION_ALLOWED_STATUSES.includes(
    value as BookingPaymentConfirmationAllowedStatus,
  );
}

export function isBookingPaymentFailureAllowedStatus(
  value: string,
): value is BookingPaymentFailureAllowedStatus {
  return BOOKING_PAYMENT_FAILURE_ALLOWED_STATUSES.includes(
    value as BookingPaymentFailureAllowedStatus,
  );
}

export function isBookingPaymentExpirableStatus(
  value: string,
): value is BookingPaymentExpirableStatus {
  return BOOKING_PAYMENT_EXPIRABLE_STATUSES.includes(
    value as BookingPaymentExpirableStatus,
  );
}

export function isPrivateBookingActiveStatus(
  value: string,
): value is PrivateBookingActiveStatus {
  return PRIVATE_BOOKING_ACTIVE_STATUSES.includes(
    value as PrivateBookingActiveStatus,
  );
}

export function isPrivateBookingTerminalStatus(
  value: string,
): value is PrivateBookingTerminalStatus {
  return PRIVATE_BOOKING_TERMINAL_STATUSES.includes(
    value as PrivateBookingTerminalStatus,
  );
}

export function isPrivateBookingCancellableStatus(
  value: string,
): value is PrivateBookingCancellableStatus {
  return PRIVATE_BOOKING_CANCELLABLE_STATUSES.includes(
    value as PrivateBookingCancellableStatus,
  );
}

export function isPrivateBookingReschedulableStatus(
  value: string,
): value is PrivateBookingReschedulableStatus {
  return PRIVATE_BOOKING_RESCHEDULABLE_STATUSES.includes(
    value as PrivateBookingReschedulableStatus,
  );
}

export function isBookingPaymentStatus(
  value: string,
): value is BookingPaymentStatus {
  return BOOKING_PAYMENT_STATUSES.includes(value as BookingPaymentStatus);
}

export function isBookingPaymentPayableStatus(
  value: string,
): value is BookingPaymentPayableStatus {
  return BOOKING_PAYMENT_PAYABLE_STATUSES.includes(
    value as BookingPaymentPayableStatus,
  );
}

export function isBookingPaymentRetryableStatus(
  value: string,
): value is BookingPaymentRetryableStatus {
  return BOOKING_PAYMENT_RETRYABLE_STATUSES.includes(
    value as BookingPaymentRetryableStatus,
  );
}

export function isBookingPaymentSettledStatus(
  value: string,
): value is BookingPaymentSettledStatus {
  return BOOKING_PAYMENT_SETTLED_STATUSES.includes(
    value as BookingPaymentSettledStatus,
  );
}

export function isBookingPaymentFailureStatus(
  value: string,
): value is BookingPaymentFailureStatus {
  return BOOKING_PAYMENT_FAILURE_STATUSES.includes(
    value as BookingPaymentFailureStatus,
  );
}

export function isBookingPaymentTerminalStatus(
  value: string,
): value is BookingPaymentTerminalStatus {
  return BOOKING_PAYMENT_TERMINAL_STATUSES.includes(
    value as BookingPaymentTerminalStatus,
  );
}

export function isBookingPaymentRefundableStatus(
  value: string,
): value is BookingPaymentRefundableStatus {
  return BOOKING_PAYMENT_REFUNDABLE_STATUSES.includes(
    value as BookingPaymentRefundableStatus,
  );
}

export function isBookingPaymentConfirmingStatus(
  value: string,
): value is BookingPaymentConfirmingStatus {
  return BOOKING_PAYMENT_CONFIRMING_STATUSES.includes(
    value as BookingPaymentConfirmingStatus,
  );
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

export function isPrivateBookingHistoryAction(
  value: string,
): value is PrivateBookingHistoryAction {
  return PRIVATE_BOOKING_HISTORY_ACTIONS.includes(
    value as PrivateBookingHistoryAction,
  );
}

export function isBookingRpcActionResult(
  value: string,
): value is BookingRpcActionResult {
  return BOOKING_RPC_ACTION_RESULTS.includes(value as BookingRpcActionResult);
}
export function isBookingOrderRpcActionResult(
  value: string,
): value is BookingOrderRpcActionResult {
  return BOOKING_ORDER_RPC_ACTION_RESULTS.includes(
    value as BookingOrderRpcActionResult,
  );
}

export function isPrivateBookingRpcActionResult(
  value: string,
): value is PrivateBookingRpcActionResult {
  return PRIVATE_BOOKING_RPC_ACTION_RESULTS.includes(
    value as PrivateBookingRpcActionResult,
  );
}

export function isBookingDomainEventName(
  value: string,
): value is BookingDomainEventName {
  return BOOKING_DOMAIN_EVENTS.includes(value as BookingDomainEventName);
}

export function isBookingCalendarEventType(
  value: string,
): value is BookingCalendarEventType {
  return BOOKING_CALENDAR_EVENT_TYPES.includes(
    value as BookingCalendarEventType,
  );
}

export function isBookingSortField(value: string): value is BookingSortField {
  return BOOKING_SORT_FIELDS.includes(value as BookingSortField);
}

export function isPrivateBookingSortField(
  value: string,
): value is PrivateBookingSortField {
  return PRIVATE_BOOKING_SORT_FIELDS.includes(value as PrivateBookingSortField);
}

export function isBookingCalendarSortField(
  value: string,
): value is BookingCalendarSortField {
  return BOOKING_CALENDAR_SORT_FIELDS.includes(
    value as BookingCalendarSortField,
  );
}

export function isBookingSortDirection(
  value: string,
): value is BookingSortDirection {
  return BOOKING_SORT_DIRECTIONS.includes(value as BookingSortDirection);
}
