// apps/api/src/modules/bookings/types/booking.types.ts
/**
 * LAFAM Booking module types.
 *
 * Role:
 * - Defines API-safe Booking Module contracts.
 * - Defines repository payload and result types.
 * - Defines availability, waitlist, history, payment-state, and event contracts.
 * - Defines payment-aware booking response and repository contracts.
 * - Keeps controllers, services, repositories, Payment Module integration,
 *   and Swagger-facing response shapes aligned.
 *
 * Important:
 * - This file contains types only.
 * - Do not place validation decorators here.
 * - Do not place database queries here.
 * - Do not place business rules here.
 * - Booking is the source of truth for real Pilates schedule availability.
 * - Payment is the source of truth for payment settlement.
 * - Booking responses may expose payment state, but payment mutation remains
 *   controlled by Payment Module atomic RPC flows.
 * - WebSocket/SSE is not implemented yet; this file only defines event-ready payload contracts.
 */

import type { AuthUserRole } from '../../auth/constants/auth-role.constants';
import type {
  BookingCalendarEventType,
  BookingCalendarSortField,
  BookingDomainEventName,
  BookingHistoryAction,
  BookingOrderItemStatus,
  BookingOrderRpcActionResult,
  BookingOrderStatus,
  BookingPaymentConfirmationAllowedStatus,
  BookingPaymentConfirmingStatus,
  BookingPaymentExpirableStatus,
  BookingPaymentFailureAllowedStatus,
  BookingPaymentFailureStatus,
  BookingPaymentPayableStatus,
  BookingPaymentPendingBookingStatus,
  BookingPaymentRefundableStatus,
  BookingPaymentRetryableStatus,
  BookingPaymentSettledStatus,
  BookingPaymentStatus,
  BookingPaymentTerminalStatus,
  BookingRpcActionResult,
  BookingSortDirection,
  BookingSortField,
  BookingSource,
  BookingStatus,
  BookingWaitlistStatus,
  PrivateBookingHistoryAction,
  PrivateBookingRpcActionResult,
  PrivateBookingSortField,
} from '../constants/booking.constants';
import type {
  AppUserRow,
  BookingDomainEventRow,
  BookingHistoryRow,
  BookingOrderItemRow,
  BookingOrderRow,
  BookingRow,
  BookingWaitlistRow,
  CancelPilatesBookingAtomicRpcRow,
  CancelPrivateTrainerBookingAtomicRpcRow,
  ConfirmBookingOrderPaidAtomicRpcRow,
  CreateBookingOrderAtomicRpcRow,
  CreatePilatesBookingAtomicRpcRow,
  CreatePrivateTrainerBookingAtomicRpcRow,
  DatabaseJsonObject,
  ExpireBookingHoldsAtomicRpcRow,
  ExpireBookingOrderAtomicRpcRow,
  ExpirePrivateTrainerBookingHoldsAtomicRpcRow,
  PilatesClassRow,
  PilatesClassScheduleRow,
  PilatesScheduleAvailabilityRpcRow,
  PrivateTrainerBookingHistoryRow,
  PrivateTrainerBookingRow,
  ReschedulePilatesBookingAtomicRpcRow,
  ReschedulePrivateTrainerBookingAtomicRpcRow,
} from '../../../database/database.types';

export type BookingId = string;
export type BookingOrderId = string;
export type BookingOrderNumber = string;
export type BookingOrderItemId = string;
export type BookingNumber = string;
export type BookingWaitlistId = string;
export type BookingScheduleId = string;
export type BookingClassId = string;
export type BookingUserId = string;
export type BookingStaffProfileId = string;
export type PrivateBookingId = string;
export type PrivateBookingNumber = string;
export type BookingDomainEventId = string;
export type BookingIdempotencyKey = string;
export type BookingPaymentId = string;
export type BookingPaymentNumber = string;
export type BookingReceiptNumber = string;
export type BookingCurrencyCode = string;

export type BookingIsoDateTimeString = string;
export type BookingIsoDateString = string;
export type BookingTimeString = string;

export type BookingActorKind = 'customer' | 'admin' | 'system';

export interface BookingActorContext {
  readonly actor_kind: BookingActorKind;
  readonly actor_user_id: string | null;
  readonly actor_admin_id: string | null;
  readonly actor_role: AuthUserRole | 'system' | null;
}

export interface BookingCustomerActorContext extends BookingActorContext {
  readonly actor_kind: 'customer';
  readonly actor_user_id: string;
  readonly actor_admin_id: null;
  readonly actor_role: AuthUserRole;
}

export interface BookingAdminActorContext extends BookingActorContext {
  readonly actor_kind: 'admin';
  readonly actor_user_id: null;
  readonly actor_admin_id: string;
  readonly actor_role: AuthUserRole;
}

export interface BookingSystemActorContext extends BookingActorContext {
  readonly actor_kind: 'system';
  readonly actor_user_id: null;
  readonly actor_admin_id: null;
  readonly actor_role: 'system';
}

export interface BookingSafeUserSnapshot {
  readonly id: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly full_name: string | null;
  readonly role: AuthUserRole;
  readonly status: string;
  readonly is_guest: boolean;
  readonly avatar_path: string | null;
}

export interface BookingTrainerSnapshot {
  readonly staff_profile_id: string | null;
  readonly app_user_id: string | null;
  readonly display_name: string | null;
  readonly post_title: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly avatar_path: string | null;
}

export interface BookingClassSnapshot {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly level: string;
  readonly status: string;
  readonly duration_minutes: number;
  readonly capacity: number;
  readonly default_price_amount?: number | null;
  readonly currency?: BookingCurrencyCode | null;
  readonly cover_image_path: string | null;
}

export interface BookingScheduleSnapshot {
  readonly id: string;
  readonly class_id: string;
  readonly trainer_staff_profile_id: string;
  readonly studio: string;
  readonly class_date: BookingIsoDateString;
  readonly start_time: BookingTimeString;
  readonly end_time: BookingTimeString;
  readonly duration_minutes: number;
  readonly capacity: number;
  readonly price_amount?: number | null;
  readonly currency?: BookingCurrencyCode | null;
  readonly status: string;
  readonly cancellation_reason: string | null;
  readonly cancelled_at: BookingIsoDateTimeString | null;
  readonly completed_at: BookingIsoDateTimeString | null;
  readonly realtime_version: number;
}

export interface BookingAvailabilitySnapshot {
  readonly schedule_id: string;
  readonly capacity: number;
  readonly booked_count: number;
  readonly pending_hold_count: number;
  readonly available_seats: number;
  readonly waitlist_count: number;
  readonly waitlist_available: boolean;
  readonly schedule_realtime_version: number;
}

export type BookingPaymentTargetKind =
  | 'booking'
  | 'private_booking'
  | 'booking_order';

export type BookingPaymentMethodSnapshot = string;

export type BookingPaymentProviderSnapshot = string;

export type BookingPaymentLifecycleStatusSnapshot = string;

export interface BookingPriceSnapshot {
  readonly amount: number | null;
  readonly currency: BookingCurrencyCode | null;
  readonly source:
    | 'schedule_override'
    | 'class_default'
    | 'private_booking'
    | 'not_configured';
}

export interface BookingPaymentSummary {
  readonly id: BookingPaymentId;
  readonly payment_number: BookingPaymentNumber;
  readonly receipt_number: BookingReceiptNumber | null;
  readonly target_kind: BookingPaymentTargetKind;
  readonly booking_id: BookingId | null;
  readonly private_booking_id: PrivateBookingId | null;
  readonly booking_order_id: BookingOrderId | null;
  readonly amount: number;
  readonly discount_amount: number;
  readonly final_amount: number;
  readonly currency: BookingCurrencyCode;
  readonly payment_method: BookingPaymentMethodSnapshot;
  readonly payment_provider: BookingPaymentProviderSnapshot;
  readonly status: BookingPaymentLifecycleStatusSnapshot;
  readonly redirect_url: string | null;
  readonly paid_at: BookingIsoDateTimeString | null;
  readonly failed_at: BookingIsoDateTimeString | null;
  readonly cancelled_at: BookingIsoDateTimeString | null;
  readonly expired_at: BookingIsoDateTimeString | null;
  readonly refunded_at: BookingIsoDateTimeString | null;
  readonly refunded_amount: number;
  readonly expires_at: BookingIsoDateTimeString | null;
  readonly created_at: BookingIsoDateTimeString;
  readonly updated_at: BookingIsoDateTimeString;
}

export interface BookingPaymentStateSnapshot {
  readonly payment_required: boolean;
  readonly payment_status: BookingPaymentStatus;
  readonly seat_hold_expires_at: BookingIsoDateTimeString | null;
  readonly is_pending_payment: boolean;
  readonly is_payable: boolean;
  readonly is_retryable: boolean;
  readonly is_settled: boolean;
  readonly is_failed: boolean;
  readonly is_terminal: boolean;
  readonly is_refundable: boolean;
  readonly confirms_booking: boolean;
  readonly checkout_required: boolean;
  readonly hold_expires_at: BookingIsoDateTimeString | null;
  readonly latest_payment: BookingPaymentSummary | null;
}

export interface BookingPaymentStatusTransitionContext {
  readonly target_kind: BookingPaymentTargetKind;
  readonly booking_id: BookingId | null;
  readonly private_booking_id: PrivateBookingId | null;
  readonly booking_order_id: BookingOrderId | null;
  readonly from_booking_status: BookingStatus | null;
  readonly to_booking_status: BookingStatus | null;
  readonly from_payment_status: BookingPaymentStatus | null;
  readonly to_payment_status: BookingPaymentStatus;
  readonly payment_id: BookingPaymentId | null;
  readonly actor_admin_id: string | null;
  readonly reason: string | null;
  readonly metadata: DatabaseJsonObject;
}

export interface BookingPayableStateCheck {
  readonly booking_status: BookingPaymentPendingBookingStatus;
  readonly payment_status: BookingPaymentPayableStatus;
  readonly payment_required: true;
  readonly seat_hold_expires_at: BookingIsoDateTimeString | null;
}

export interface BookingPaymentConfirmationCheck {
  readonly booking_status: BookingPaymentConfirmationAllowedStatus;
  readonly payment_status: BookingPaymentConfirmingStatus;
}

export interface BookingPaymentFailureCheck {
  readonly booking_status: BookingPaymentFailureAllowedStatus;
  readonly payment_status: BookingPaymentFailureStatus;
}

export interface BookingPaymentExpiryCheck {
  readonly booking_status: BookingPaymentExpirableStatus;
  readonly payment_status: Extract<BookingPaymentTerminalStatus, 'expired'>;
}

export interface BookingPaymentRefundCheck {
  readonly payment_status: BookingPaymentRefundableStatus;
}

export interface BookingPaymentRetryCheck {
  readonly payment_status: BookingPaymentRetryableStatus;
}

export interface BookingPaymentSettlementCheck {
  readonly payment_status: BookingPaymentSettledStatus;
}

export interface BookingHistoryEntry {
  readonly id: string;
  readonly booking_id: string;
  readonly actor_user_id: string | null;
  readonly actor_admin_id: string | null;
  readonly actor_role: string | null;
  readonly action: BookingHistoryAction;
  readonly from_status: BookingStatus | null;
  readonly to_status: BookingStatus | null;
  readonly notes: string | null;
  readonly metadata: DatabaseJsonObject;
  readonly created_at: BookingIsoDateTimeString;
}

export interface PrivateBookingHistoryEntry {
  readonly id: string;
  readonly private_booking_id: string;
  readonly actor_user_id: string | null;
  readonly actor_admin_id: string | null;
  readonly actor_role: string | null;
  readonly action: PrivateBookingHistoryAction;
  readonly from_status: BookingStatus | null;
  readonly to_status: BookingStatus | null;
  readonly notes: string | null;
  readonly metadata: DatabaseJsonObject;
  readonly created_at: BookingIsoDateTimeString;
}

export interface BookingWaitlistEntry {
  readonly id: string;
  readonly schedule_id: string;
  readonly class_id: string;
  readonly user_id: string;
  readonly position: number;
  readonly status: BookingWaitlistStatus;
  readonly joined_at: BookingIsoDateTimeString;
  readonly promoted_at: BookingIsoDateTimeString | null;
  readonly expired_at: BookingIsoDateTimeString | null;
  readonly cancelled_at: BookingIsoDateTimeString | null;
  readonly promotion_expires_at: BookingIsoDateTimeString | null;
  readonly converted_booking_id: string | null;
  readonly cancellation_reason: string | null;
  readonly created_at: BookingIsoDateTimeString;
  readonly updated_at: BookingIsoDateTimeString;
  readonly realtime_version: number;
}

export interface BookingSafeBooking {
  readonly id: string;
  readonly booking_number: string;
  readonly user_id: string;
  readonly schedule_id: string;
  readonly class_id: string;
  readonly trainer_staff_profile_id: string | null;
  readonly booking_order_id: BookingOrderId | null;
  readonly status: BookingStatus;
  readonly source: BookingSource;
  readonly payment_status: BookingPaymentStatus;
  readonly payment_required: boolean;
  readonly seat_hold_expires_at: BookingIsoDateTimeString | null;
  readonly price?: BookingPriceSnapshot | null;
  readonly payment_state?: BookingPaymentStateSnapshot;
  readonly latest_payment?: BookingPaymentSummary | null;
  readonly confirmed_at: BookingIsoDateTimeString | null;
  readonly cancelled_at: BookingIsoDateTimeString | null;
  readonly completed_at: BookingIsoDateTimeString | null;
  readonly no_show_at: BookingIsoDateTimeString | null;
  readonly rescheduled_from_booking_id: string | null;
  readonly cancellation_reason: string | null;
  readonly admin_notes: string | null;
  readonly created_at: BookingIsoDateTimeString;
  readonly updated_at: BookingIsoDateTimeString;
  readonly realtime_version: number;
}

export interface PrivateBookingSafeBooking {
  readonly id: string;
  readonly booking_number: string;
  readonly user_id: string;
  readonly trainer_staff_profile_id: string;
  readonly session_date: BookingIsoDateString;
  readonly start_time: BookingTimeString;
  readonly end_time: BookingTimeString;
  readonly duration_minutes: number;
  readonly studio: string;
  readonly price_amount?: number;
  readonly currency?: BookingCurrencyCode;
  readonly price?: BookingPriceSnapshot | null;
  readonly status: BookingStatus;
  readonly source: BookingSource;
  readonly payment_status: BookingPaymentStatus;
  readonly payment_required: boolean;
  readonly seat_hold_expires_at: BookingIsoDateTimeString | null;
  readonly payment_state?: BookingPaymentStateSnapshot;
  readonly latest_payment?: BookingPaymentSummary | null;
  readonly confirmed_at: BookingIsoDateTimeString | null;
  readonly cancelled_at: BookingIsoDateTimeString | null;
  readonly completed_at: BookingIsoDateTimeString | null;
  readonly no_show_at: BookingIsoDateTimeString | null;
  readonly rescheduled_at: BookingIsoDateTimeString | null;
  readonly rescheduled_from_private_booking_id: string | null;
  readonly rescheduled_to_private_booking_id: string | null;
  readonly cancellation_reason: string | null;
  readonly admin_notes: string | null;
  readonly created_at: BookingIsoDateTimeString;
  readonly updated_at: BookingIsoDateTimeString;
  readonly realtime_version: number;
}

export interface PrivateBookingListItem extends PrivateBookingSafeBooking {
  readonly customer: BookingSafeUserSnapshot | null;
  readonly trainer: BookingTrainerSnapshot | null;
}

export interface PrivateBookingDetail extends PrivateBookingListItem {
  readonly history: readonly PrivateBookingHistoryEntry[];
}

export interface BookingListItem extends BookingSafeBooking {
  readonly customer: BookingSafeUserSnapshot | null;
  readonly class: BookingClassSnapshot | null;
  readonly schedule: BookingScheduleSnapshot | null;
  readonly trainer: BookingTrainerSnapshot | null;
}

export interface BookingDetail extends BookingListItem {
  readonly history: readonly BookingHistoryEntry[];
  readonly availability: BookingAvailabilitySnapshot | null;
}

export interface BookingWaitlistListItem extends BookingWaitlistEntry {
  readonly customer: BookingSafeUserSnapshot | null;
  readonly class: BookingClassSnapshot | null;
  readonly schedule: BookingScheduleSnapshot | null;
  readonly trainer: BookingTrainerSnapshot | null;
}

export interface BookingOrderItemSummary {
  readonly id: BookingOrderItemId;
  readonly booking_order_id: BookingOrderId;
  readonly booking_id: BookingId;
  readonly schedule_id: BookingScheduleId;
  readonly class_id: BookingClassId;
  readonly trainer_staff_profile_id: BookingStaffProfileId | null;
  readonly price_amount: number;
  readonly currency: BookingCurrencyCode;
  readonly status: BookingOrderItemStatus;
  readonly created_at: BookingIsoDateTimeString;
  readonly booking?: BookingListItem | null;
  readonly class?: BookingClassSnapshot | null;
  readonly schedule?: BookingScheduleSnapshot | null;
  readonly trainer?: BookingTrainerSnapshot | null;
}

export interface BookingOrderSummary {
  readonly id: BookingOrderId;
  readonly order_number: BookingOrderNumber;
  readonly customer_user_id: BookingUserId;
  readonly status: BookingOrderStatus;
  readonly payment_status: BookingPaymentStatus;
  readonly payment_required: boolean;
  readonly total_amount: number;
  readonly currency: BookingCurrencyCode;
  readonly booking_count: number;
  readonly checkout_required: boolean;
  readonly idempotency_key: BookingIdempotencyKey | null;
  readonly created_by_user_id: string | null;
  readonly created_by_admin_id: string | null;
  readonly created_by_staff_profile_id: BookingStaffProfileId | null;
  readonly created_by_role: string | null;
  readonly admin_notes: string | null;
  readonly metadata: DatabaseJsonObject;
  readonly expires_at: BookingIsoDateTimeString;
  readonly paid_at: BookingIsoDateTimeString | null;
  readonly expired_at: BookingIsoDateTimeString | null;
  readonly cancelled_at: BookingIsoDateTimeString | null;
  readonly refunded_at: BookingIsoDateTimeString | null;
  readonly created_at: BookingIsoDateTimeString;
  readonly updated_at: BookingIsoDateTimeString;
  readonly realtime_version: number;
  readonly payment_state?: BookingPaymentStateSnapshot | null;
  readonly latest_payment?: BookingPaymentSummary | null;
  readonly customer?: BookingSafeUserSnapshot | null;
}

export interface BookingOrderDetail extends BookingOrderSummary {
  readonly items: readonly BookingOrderItemSummary[];
}

export interface BookingCreateResult {
  readonly result: Extract<
    BookingRpcActionResult,
    'existing_booking' | 'booked' | 'waitlisted'
  >;
  readonly booking: BookingListItem | null;
  readonly waitlist: BookingWaitlistListItem | null;
  readonly payment_state?: BookingPaymentStateSnapshot | null;
  readonly checkout_required?: boolean;
  readonly availability: BookingAvailabilitySnapshot;
}

export interface BookingBulkCreateResult {
  readonly result: BookingOrderRpcActionResult;
  readonly booking_order: BookingOrderSummary;
  readonly items: readonly BookingOrderItemSummary[];
  readonly checkout_required: boolean;
}

export interface BookingOrderLookupResult {
  readonly booking_order: BookingOrderDetail;
}

export interface BookingCancelResult {
  readonly result: Extract<
    BookingRpcActionResult,
    'cancelled' | 'cancelled_and_promoted'
  >;
  readonly cancelled_booking: BookingListItem;
  readonly promoted_booking: BookingListItem | null;
  readonly promoted_waitlist: BookingWaitlistListItem | null;
  readonly availability: BookingAvailabilitySnapshot;
}

export interface BookingRescheduleResult {
  readonly result: Extract<
    BookingRpcActionResult,
    'rescheduled' | 'target_waitlisted'
  >;
  readonly old_booking: BookingListItem;
  readonly new_booking: BookingListItem | null;
  readonly waitlist: BookingWaitlistListItem | null;
  readonly availability: BookingAvailabilitySnapshot;
}

export interface PrivateBookingCreateResult {
  readonly result: Extract<
    PrivateBookingRpcActionResult,
    'existing_private_booking' | 'private_booked'
  >;
  readonly private_booking: PrivateBookingListItem;
  readonly payment_state?: BookingPaymentStateSnapshot | null;
  readonly checkout_required?: boolean;
}

export interface PrivateBookingCancelResult {
  readonly result: Extract<PrivateBookingRpcActionResult, 'private_cancelled'>;
  readonly private_booking: PrivateBookingListItem;
}

export interface PrivateBookingRescheduleResult {
  readonly result: Extract<
    PrivateBookingRpcActionResult,
    'private_rescheduled'
  >;
  readonly old_private_booking: PrivateBookingListItem;
  readonly new_private_booking: PrivateBookingListItem;
}

export interface PrivateBookingListResult {
  readonly private_bookings: readonly PrivateBookingListItem[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export interface BookingListResult {
  readonly bookings: readonly BookingListItem[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export interface BookingOrderListResult {
  readonly booking_orders: readonly BookingOrderSummary[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export interface BookingWaitlistListResult {
  readonly waitlist: readonly BookingWaitlistListItem[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export interface BookingAvailabilityResult {
  readonly availability: BookingAvailabilitySnapshot;
}

export interface PrivateBookingAvailabilitySlot {
  readonly trainer_staff_profile_id: string;
  readonly session_date: BookingIsoDateString;
  readonly start_time: BookingTimeString;
  readonly end_time: BookingTimeString;
  readonly duration_minutes: number;
  readonly available: boolean;
  readonly unavailable_reason: string | null;
}

export interface PrivateBookingAvailabilityResult {
  readonly trainer_staff_profile_id: string;
  readonly from_date: BookingIsoDateString;
  readonly to_date: BookingIsoDateString;
  readonly duration_minutes: number;
  readonly slots: readonly PrivateBookingAvailabilitySlot[];
}

export interface BookingCalendarFilters {
  readonly from_date: BookingIsoDateString;
  readonly to_date: BookingIsoDateString;
  readonly trainer_staff_profile_id: string | null;
  readonly class_id: string | null;
  readonly user_id: string | null;
  readonly include_class_schedules: boolean;
  readonly include_class_bookings: boolean;
  readonly include_waitlist: boolean;
  readonly include_private_bookings: boolean;
  readonly sort_by: BookingCalendarSortField;
  readonly sort_direction: BookingSortDirection;
}

export interface BookingCalendarEvent {
  readonly id: string;
  readonly event_type: BookingCalendarEventType;
  readonly title: string;
  readonly status: string;
  readonly starts_at: BookingIsoDateTimeString;
  readonly ends_at: BookingIsoDateTimeString;
  readonly date: BookingIsoDateString;
  readonly start_time: BookingTimeString;
  readonly end_time: BookingTimeString;
  readonly trainer_staff_profile_id: string | null;
  readonly user_id: string | null;
  readonly class_id: string | null;
  readonly schedule_id: string | null;
  readonly booking_id: string | null;
  readonly waitlist_id: string | null;
  readonly private_booking_id: string | null;
  readonly source: DatabaseJsonObject;
}

export interface BookingCalendarResult {
  readonly events: readonly BookingCalendarEvent[];
  readonly from_date: BookingIsoDateString;
  readonly to_date: BookingIsoDateString;
  readonly total: number;
}

export interface BookingCreatePayload {
  readonly user_id: string;
  readonly schedule_id: string;
  readonly payment_required: boolean;
  readonly idempotency_key: string | null;
  readonly created_by_admin_id: string | null;
  readonly source: BookingSource;
}

export interface BookingBulkCreatePayload {
  readonly customer_user_id: BookingUserId;
  readonly schedule_ids: readonly BookingScheduleId[];
  readonly idempotency_key: BookingIdempotencyKey | null;
  readonly created_by_user_id: string | null;
  readonly created_by_admin_id: string | null;
  readonly created_by_staff_profile_id: BookingStaffProfileId | null;
  readonly created_by_role: AuthUserRole;
  readonly source: BookingSource;
  readonly admin_notes: string | null;
  readonly metadata: DatabaseJsonObject;
}

export interface BookingOrderLookupPayload {
  readonly booking_order_id: BookingOrderId;
  readonly customer_user_id: BookingUserId | null;
}

export interface BookingCancelPayload {
  readonly booking_id: string;
  readonly actor_user_id: string | null;
  readonly actor_admin_id: string | null;
  readonly reason: string | null;
}

export interface BookingReschedulePayload {
  readonly booking_id: string;
  readonly target_schedule_id: string;
  readonly actor_user_id: string | null;
  readonly actor_admin_id: string | null;
  readonly join_waitlist_if_full: boolean;
  readonly reason: string | null;
}

export interface BookingAvailabilityPayload {
  readonly schedule_id: string;
}

export interface PrivateBookingCreatePayload {
  readonly user_id: string;
  readonly trainer_staff_profile_id: string;
  readonly session_date: BookingIsoDateString;
  readonly start_time: BookingTimeString;
  readonly duration_minutes: number;
  readonly studio: string;
  readonly payment_required: boolean;
  readonly idempotency_key: string | null;
  readonly created_by_admin_id: string | null;
  readonly source: BookingSource;
}

export interface PrivateBookingCancelPayload {
  readonly private_booking_id: string;
  readonly actor_user_id: string | null;
  readonly actor_admin_id: string | null;
  readonly reason: string | null;
}

export interface PrivateBookingReschedulePayload {
  readonly private_booking_id: string;
  readonly target_session_date: BookingIsoDateString;
  readonly target_start_time: BookingTimeString;
  readonly target_duration_minutes: number;
  readonly studio: string | null;
  readonly actor_user_id: string | null;
  readonly actor_admin_id: string | null;
  readonly reason: string | null;
  readonly idempotency_key: string | null;
  readonly payment_required: boolean;
}

export interface PrivateBookingAvailabilityPayload {
  readonly trainer_staff_profile_id: string;
  readonly from_date: BookingIsoDateString;
  readonly to_date: BookingIsoDateString;
  readonly duration_minutes: number;
  readonly studio: string | null;
}

export interface BookingPaymentUpdateBasePayload {
  readonly payment_id: BookingPaymentId;
  readonly actor_admin_id: string | null;
  readonly reason: string | null;
  readonly metadata: DatabaseJsonObject;
}

export interface BookingPaymentConfirmPayload extends BookingPaymentUpdateBasePayload {
  readonly booking_id: BookingId;
  readonly payment_status: Extract<BookingPaymentStatus, 'paid'>;
}

export interface BookingPaymentFailPayload extends BookingPaymentUpdateBasePayload {
  readonly booking_id: BookingId;
  readonly payment_status: Extract<BookingPaymentStatus, 'failed'>;
  readonly failure_code: string | null;
  readonly failure_message: string | null;
}

export interface BookingPaymentExpirePayload extends BookingPaymentUpdateBasePayload {
  readonly booking_id: BookingId;
  readonly payment_status: Extract<BookingPaymentStatus, 'expired'>;
}

export interface BookingPaymentRefundPayload extends BookingPaymentUpdateBasePayload {
  readonly booking_id: BookingId;
  readonly payment_status: Extract<BookingPaymentStatus, 'refunded'>;
  readonly refunded_amount: number;
}

export interface BookingOrderPaymentConfirmPayload extends BookingPaymentUpdateBasePayload {
  readonly booking_order_id: BookingOrderId;
  readonly payment_status: Extract<BookingPaymentStatus, 'paid'>;
}

export interface BookingOrderPaymentFailPayload extends BookingPaymentUpdateBasePayload {
  readonly booking_order_id: BookingOrderId;
  readonly payment_status: Extract<BookingPaymentStatus, 'failed'>;
  readonly failure_code: string | null;
  readonly failure_message: string | null;
}

export interface BookingOrderPaymentExpirePayload extends BookingPaymentUpdateBasePayload {
  readonly booking_order_id: BookingOrderId;
  readonly payment_status: Extract<BookingPaymentStatus, 'expired'>;
}

export interface BookingOrderPaymentRefundPayload extends BookingPaymentUpdateBasePayload {
  readonly booking_order_id: BookingOrderId;
  readonly payment_status: Extract<BookingPaymentStatus, 'refunded'>;
  readonly refunded_amount: number;
}

export interface PrivateBookingPaymentConfirmPayload extends BookingPaymentUpdateBasePayload {
  readonly private_booking_id: PrivateBookingId;
  readonly payment_status: Extract<BookingPaymentStatus, 'paid'>;
}

export interface PrivateBookingPaymentFailPayload extends BookingPaymentUpdateBasePayload {
  readonly private_booking_id: PrivateBookingId;
  readonly payment_status: Extract<BookingPaymentStatus, 'failed'>;
  readonly failure_code: string | null;
  readonly failure_message: string | null;
}

export interface PrivateBookingPaymentExpirePayload extends BookingPaymentUpdateBasePayload {
  readonly private_booking_id: PrivateBookingId;
  readonly payment_status: Extract<BookingPaymentStatus, 'expired'>;
}

export interface PrivateBookingPaymentRefundPayload extends BookingPaymentUpdateBasePayload {
  readonly private_booking_id: PrivateBookingId;
  readonly payment_status: Extract<BookingPaymentStatus, 'refunded'>;
  readonly refunded_amount: number;
}

export interface BookingCustomerListFilters {
  readonly user_id: string;
  readonly booking_order_id: BookingOrderId | null;
  readonly status: BookingStatus | null;
  readonly from_date: BookingIsoDateString | null;
  readonly to_date: BookingIsoDateString | null;
  readonly limit: number;
  readonly offset: number;
  readonly sort_by: BookingSortField;
  readonly sort_direction: BookingSortDirection;
}

export interface BookingAdminListFilters {
  readonly search: string | null;
  readonly status: BookingStatus | null;
  readonly payment_status: BookingPaymentStatus | null;
  readonly schedule_id: string | null;
  readonly class_id: string | null;
  readonly trainer_staff_profile_id: string | null;
  readonly user_id: string | null;
  readonly booking_order_id: BookingOrderId | null;
  readonly from_date: BookingIsoDateString | null;
  readonly to_date: BookingIsoDateString | null;
  readonly limit: number;
  readonly offset: number;
  readonly sort_by: BookingSortField;
  readonly sort_direction: BookingSortDirection;
}

export interface PrivateBookingCustomerListFilters {
  readonly user_id: string;
  readonly status: BookingStatus | null;
  readonly trainer_staff_profile_id: string | null;
  readonly from_date: BookingIsoDateString | null;
  readonly to_date: BookingIsoDateString | null;
  readonly limit: number;
  readonly offset: number;
  readonly sort_by: PrivateBookingSortField;
  readonly sort_direction: BookingSortDirection;
}

export interface PrivateBookingAdminListFilters {
  readonly search: string | null;
  readonly status: BookingStatus | null;
  readonly payment_status: BookingPaymentStatus | null;
  readonly trainer_staff_profile_id: string | null;
  readonly user_id: string | null;
  readonly from_date: BookingIsoDateString | null;
  readonly to_date: BookingIsoDateString | null;
  readonly limit: number;
  readonly offset: number;
  readonly sort_by: PrivateBookingSortField;
  readonly sort_direction: BookingSortDirection;
}

export interface BookingWaitlistFilters {
  readonly user_id: string | null;
  readonly schedule_id: string | null;
  readonly status: BookingWaitlistStatus | null;
  readonly limit: number;
  readonly offset: number;
}

export interface BookingAdminWaitlistFilters {
  readonly schedule_id: string;
  readonly status: BookingWaitlistStatus | null;
  readonly limit: number;
  readonly offset: number;
}

export type BookingManagementScopeKind = 'full' | 'trainer_scoped';

export interface BookingManagementScope {
  readonly scope_kind: BookingManagementScopeKind;
  readonly actor_user_id: string;
  readonly actor_role: AuthUserRole;
  readonly trainer_staff_profile_id: BookingStaffProfileId | null;
}

export interface BookingFullManagementScope extends BookingManagementScope {
  readonly scope_kind: 'full';
  readonly trainer_staff_profile_id: null;
}

export interface BookingTrainerScopedManagementScope extends BookingManagementScope {
  readonly scope_kind: 'trainer_scoped';
  readonly trainer_staff_profile_id: BookingStaffProfileId;
}

export type ResolvedBookingManagementScope =
  | BookingFullManagementScope
  | BookingTrainerScopedManagementScope;

export interface BookingScheduleScopeSnapshot {
  readonly schedule_id: BookingScheduleId;
  readonly trainer_staff_profile_id: BookingStaffProfileId | null;
}

export interface BookingScopeCheckTarget {
  readonly booking_id: BookingId | null;
  readonly schedule_id: BookingScheduleId | null;
  readonly trainer_staff_profile_id: BookingStaffProfileId | null;
}

export interface BookingWaitlistScopeCheckTarget {
  readonly waitlist_id: BookingWaitlistId | null;
  readonly schedule_id: BookingScheduleId | null;
  readonly trainer_staff_profile_id: BookingStaffProfileId | null;
}

export interface BookingOverridePayload {
  readonly booking_id: string;
  readonly target_status: BookingStatus;
  readonly actor_admin_id: string;
  readonly reason: string;
}

export interface BookingWaitlistCancelPayload {
  readonly waitlist_id: string;
  readonly actor_user_id: string | null;
  readonly actor_admin_id: string | null;
  readonly reason: string | null;
}

export interface BookingDomainEventPayload {
  readonly event_type: BookingDomainEventName;
  readonly schedule_id: string | null;
  readonly booking_id: string | null;
  readonly waitlist_id: string | null;
  readonly private_booking_id?: string | null;
  readonly booking_order_id?: BookingOrderId | null;
  readonly payment_id?: BookingPaymentId | null;
  readonly payload: DatabaseJsonObject;
}

export interface BookingRealtimeEventEnvelope {
  readonly event_type: BookingDomainEventName;
  readonly schedule_id: string | null;
  readonly booking_id: string | null;
  readonly waitlist_id: string | null;
  readonly private_booking_id?: string | null;
  readonly booking_order_id?: BookingOrderId | null;
  readonly payment_id?: BookingPaymentId | null;
  readonly payload: DatabaseJsonObject;
  readonly created_at: BookingIsoDateTimeString;
}

export interface BookingAvailabilityChangedPayload {
  readonly schedule_id: string;
  readonly capacity: number;
  readonly booked_count: number;
  readonly pending_hold_count: number;
  readonly available_seats: number;
  readonly waitlist_count: number;
  readonly waitlist_available: boolean;
  readonly schedule_realtime_version: number;
}

export interface BookingCreatedEventPayload {
  readonly booking_id: string;
  readonly booking_number: string;
  readonly user_id: string;
  readonly schedule_id: string;
  readonly class_id: string;
  readonly status: BookingStatus;
  readonly payment_status: BookingPaymentStatus;
  readonly payment_required: boolean;
  readonly seat_hold_expires_at: BookingIsoDateTimeString | null;
}

export interface BookingCancelledEventPayload {
  readonly booking_id: string;
  readonly user_id: string;
  readonly schedule_id: string;
  readonly class_id: string;
  readonly reason: string | null;
}

export interface BookingRescheduledEventPayload {
  readonly old_booking_id: string;
  readonly new_booking_id: string;
  readonly old_schedule_id: string;
  readonly new_schedule_id: string;
  readonly user_id: string;
}

export interface BookingExpiredEventPayload {
  readonly booking_id: string;
  readonly user_id: string;
  readonly schedule_id: string;
  readonly class_id: string;
}
export interface BookingOrderCreatedEventPayload {
  readonly booking_order_id: BookingOrderId;
  readonly order_number: BookingOrderNumber;
  readonly customer_user_id: BookingUserId;
  readonly booking_count: number;
  readonly total_amount: number;
  readonly currency: BookingCurrencyCode;
}

export interface BookingOrderItemCreatedEventPayload {
  readonly booking_order_id: BookingOrderId;
  readonly booking_id: BookingId;
  readonly schedule_id: BookingScheduleId;
  readonly status: BookingStatus;
  readonly payment_status: BookingPaymentStatus;
}

export interface BookingOrderPaidEventPayload {
  readonly booking_order_id: BookingOrderId;
  readonly payment_id: BookingPaymentId | null;
  readonly confirmed_booking_count: number;
}

export interface BookingOrderItemConfirmedEventPayload {
  readonly booking_order_id: BookingOrderId;
  readonly booking_id: BookingId;
  readonly payment_id: BookingPaymentId | null;
}

export interface BookingOrderExpiredEventPayload {
  readonly booking_order_id: BookingOrderId;
  readonly payment_id: BookingPaymentId | null;
  readonly expired_booking_count: number;
}

export interface BookingOrderItemExpiredEventPayload {
  readonly booking_order_id: BookingOrderId;
  readonly booking_id: BookingId;
  readonly payment_id: BookingPaymentId | null;
}

export interface BookingWaitlistJoinedEventPayload {
  readonly waitlist_id: string;
  readonly user_id: string;
  readonly schedule_id: string;
  readonly class_id: string;
  readonly position: number;
}

export interface BookingWaitlistPromotedEventPayload {
  readonly waitlist_id: string;
  readonly booking_id: string;
  readonly user_id: string;
  readonly schedule_id: string;
  readonly class_id: string;
}

export interface PrivateBookingCreatedEventPayload {
  readonly private_booking_id: string;
  readonly booking_number: string;
  readonly user_id: string;
  readonly trainer_staff_profile_id: string;
  readonly session_date: BookingIsoDateString;
  readonly start_time: BookingTimeString;
  readonly end_time: BookingTimeString;
  readonly status: BookingStatus;
  readonly payment_status: BookingPaymentStatus;
  readonly payment_required: boolean;
  readonly seat_hold_expires_at: BookingIsoDateTimeString | null;
}

export interface PrivateBookingCancelledEventPayload {
  readonly private_booking_id: string;
  readonly user_id: string;
  readonly trainer_staff_profile_id: string;
  readonly session_date: BookingIsoDateString;
  readonly reason: string | null;
}

export interface PrivateBookingRescheduledEventPayload {
  readonly old_private_booking_id: string;
  readonly new_private_booking_id: string;
  readonly user_id: string;
  readonly trainer_staff_profile_id: string;
  readonly old_session_date: BookingIsoDateString;
  readonly new_session_date: BookingIsoDateString;
}

export interface PrivateBookingExpiredEventPayload {
  readonly private_booking_id: string;
  readonly user_id: string;
  readonly trainer_staff_profile_id: string;
  readonly session_date: BookingIsoDateString;
}

export interface PrivateBookingCompletedEventPayload {
  readonly private_booking_id: string;
  readonly user_id: string;
  readonly trainer_staff_profile_id: string;
  readonly session_date: BookingIsoDateString;
}

export interface PrivateBookingNoShowEventPayload {
  readonly private_booking_id: string;
  readonly user_id: string;
  readonly trainer_staff_profile_id: string;
  readonly session_date: BookingIsoDateString;
}

export interface BookingHydratedPaymentRow {
  readonly id: BookingPaymentId;
  readonly payment_number: BookingPaymentNumber;
  readonly receipt_number: BookingReceiptNumber | null;
  readonly target_type: BookingPaymentTargetKind;
  readonly booking_id: BookingId | null;
  readonly private_booking_id: PrivateBookingId | null;
  readonly booking_order_id: BookingOrderId | null;
  readonly amount: number;
  readonly discount_amount: number;
  readonly final_amount: number;
  readonly currency: string;
  readonly payment_method: string;
  readonly payment_provider: string;
  readonly status: string;
  readonly redirect_url: string | null;
  readonly paid_at: BookingIsoDateTimeString | null;
  readonly failed_at: BookingIsoDateTimeString | null;
  readonly cancelled_at: BookingIsoDateTimeString | null;
  readonly expired_at: BookingIsoDateTimeString | null;
  readonly refunded_at: BookingIsoDateTimeString | null;
  readonly refunded_amount: number;
  readonly expires_at: BookingIsoDateTimeString | null;
  readonly created_at: BookingIsoDateTimeString;
  readonly updated_at: BookingIsoDateTimeString;
}

export type BookingHydratedRow = BookingRow & {
  readonly app_users?: AppUserRow | null;
  readonly pilates_classes?: PilatesClassRow | null;
  readonly pilates_class_schedules?: PilatesClassScheduleRow | null;
  readonly booking_orders?: BookingOrderRow | null;
  readonly booking_order_items?: readonly BookingOrderItemRow[] | null;
  readonly payments?: readonly BookingHydratedPaymentRow[] | null;
  readonly staff_profiles?: {
    readonly id: string;
    readonly app_user_id: string;
    readonly display_name: string;
    readonly post_title: string;
    readonly app_users?: AppUserRow | null;
  } | null;
};

export type BookingWaitlistHydratedRow = BookingWaitlistRow & {
  readonly app_users?: AppUserRow | null;
  readonly pilates_classes?: PilatesClassRow | null;
  readonly pilates_class_schedules?: PilatesClassScheduleRow | null;
  readonly staff_profiles?: {
    readonly id: string;
    readonly app_user_id: string;
    readonly display_name: string;
    readonly post_title: string;
    readonly app_users?: AppUserRow | null;
  } | null;
};

export type PrivateBookingHydratedRow = PrivateTrainerBookingRow & {
  readonly app_users?: AppUserRow | null;
  readonly payments?: readonly BookingHydratedPaymentRow[] | null;
  readonly staff_profiles?: {
    readonly id: string;
    readonly app_user_id: string;
    readonly display_name: string;
    readonly post_title: string;
    readonly app_users?: AppUserRow | null;
  } | null;
};
export type BookingOrderItemHydratedRow = BookingOrderItemRow & {
  readonly bookings?: BookingHydratedRow | null;
  readonly pilates_classes?: PilatesClassRow | null;
  readonly pilates_class_schedules?: PilatesClassScheduleRow | null;
  readonly staff_profiles?: {
    readonly id: string;
    readonly app_user_id: string;
    readonly display_name: string;
    readonly post_title: string;
    readonly app_users?: AppUserRow | null;
  } | null;
};

export type BookingOrderHydratedRow = BookingOrderRow & {
  readonly app_users?: AppUserRow | null;
  readonly booking_order_items?: readonly BookingOrderItemHydratedRow[] | null;
  readonly payments?: readonly BookingHydratedPaymentRow[] | null;
  readonly staff_profiles?: {
    readonly id: string;
    readonly app_user_id: string;
    readonly display_name: string;
    readonly post_title: string;
    readonly app_users?: AppUserRow | null;
  } | null;
};

export type BookingHistoryHydratedRow = BookingHistoryRow;

export type PrivateBookingHistoryHydratedRow = PrivateTrainerBookingHistoryRow;

export type BookingAvailabilityRpcRow = PilatesScheduleAvailabilityRpcRow;

export type BookingCreateAtomicRpcRow = CreatePilatesBookingAtomicRpcRow;

export type BookingCancelAtomicRpcRow = CancelPilatesBookingAtomicRpcRow;

export type BookingRescheduleAtomicRpcRow =
  ReschedulePilatesBookingAtomicRpcRow;

export type BookingExpireHoldsRpcRow = ExpireBookingHoldsAtomicRpcRow;
export type BookingOrderCreateAtomicRpcRow = CreateBookingOrderAtomicRpcRow;

export type BookingOrderConfirmPaidAtomicRpcRow =
  ConfirmBookingOrderPaidAtomicRpcRow;

export type BookingOrderExpireAtomicRpcRow = ExpireBookingOrderAtomicRpcRow;

export type PrivateBookingCreateAtomicRpcRow =
  CreatePrivateTrainerBookingAtomicRpcRow;

export type PrivateBookingCancelAtomicRpcRow =
  CancelPrivateTrainerBookingAtomicRpcRow;

export type PrivateBookingRescheduleAtomicRpcRow =
  ReschedulePrivateTrainerBookingAtomicRpcRow;

export type PrivateBookingExpireHoldsRpcRow =
  ExpirePrivateTrainerBookingHoldsAtomicRpcRow;

export type BookingDomainEventRecord = BookingDomainEventRow;
export type BookingOrderRecord = BookingOrderRow;

export type BookingOrderItemRecord = BookingOrderItemRow;

export type PrivateBookingRecord = PrivateTrainerBookingRow;

export type PrivateBookingHistoryRecord = PrivateTrainerBookingHistoryRow;

export interface BookingRepositoryCreateAtomicResult {
  readonly rpc: BookingCreateAtomicRpcRow;
}

export interface BookingRepositoryCancelAtomicResult {
  readonly rpc: BookingCancelAtomicRpcRow;
}

export interface BookingRepositoryRescheduleAtomicResult {
  readonly rpc: BookingRescheduleAtomicRpcRow;
}

export interface BookingRepositoryExpireHoldsResult {
  readonly expired: readonly BookingExpireHoldsRpcRow[];
}
export interface BookingRepositoryCreateOrderAtomicResult {
  readonly rpc: BookingOrderCreateAtomicRpcRow;
}

export interface BookingRepositoryConfirmOrderPaidResult {
  readonly rpc: BookingOrderConfirmPaidAtomicRpcRow;
}

export interface BookingRepositoryExpireOrderResult {
  readonly rpc: BookingOrderExpireAtomicRpcRow;
}

export interface PrivateBookingRepositoryCreateAtomicResult {
  readonly rpc: PrivateBookingCreateAtomicRpcRow;
}

export interface PrivateBookingRepositoryCancelAtomicResult {
  readonly rpc: PrivateBookingCancelAtomicRpcRow;
}

export interface PrivateBookingRepositoryRescheduleAtomicResult {
  readonly rpc: PrivateBookingRescheduleAtomicRpcRow;
}

export interface PrivateBookingRepositoryExpireHoldsResult {
  readonly expired: readonly PrivateBookingExpireHoldsRpcRow[];
}

export interface BookingRepositoryBookingLookup {
  readonly booking: BookingHydratedRow | null;
  readonly history: readonly BookingHistoryRow[];
}

export interface BookingRepositoryWaitlistLookup {
  readonly waitlist: BookingWaitlistHydratedRow | null;
}

export interface BookingRepositoryListLookup {
  readonly rows: readonly BookingHydratedRow[];
  readonly total: number;
}

export interface BookingRepositoryWaitlistListLookup {
  readonly rows: readonly BookingWaitlistHydratedRow[];
  readonly total: number;
}

export interface BookingRepositoryAvailabilityLookup {
  readonly availability: BookingAvailabilityRpcRow | null;
}
export interface BookingRepositoryOrderLookup {
  readonly booking_order: BookingOrderHydratedRow | null;
}

export interface BookingRepositoryOrderItemListLookup {
  readonly rows: readonly BookingOrderItemHydratedRow[];
  readonly total: number;
}

export interface BookingRepositoryOrderListLookup {
  readonly rows: readonly BookingOrderHydratedRow[];
  readonly total: number;
}

export interface BookingRepositoryPayableBookingLookup {
  readonly booking: BookingHydratedRow | null;
  readonly price: BookingPriceSnapshot | null;
  readonly latest_payment: BookingHydratedPaymentRow | null;
}

export interface PrivateBookingRepositoryPayableBookingLookup {
  readonly private_booking: PrivateBookingHydratedRow | null;
  readonly price: BookingPriceSnapshot | null;
  readonly latest_payment: BookingHydratedPaymentRow | null;
}
export interface BookingRepositoryPayableOrderLookup {
  readonly booking_order: BookingOrderHydratedRow | null;
  readonly latest_payment: BookingHydratedPaymentRow | null;
}

export interface BookingRepositoryPaymentStateLookup {
  readonly booking: BookingHydratedRow | null;
  readonly latest_payment: BookingHydratedPaymentRow | null;
}

export interface PrivateBookingRepositoryPaymentStateLookup {
  readonly private_booking: PrivateBookingHydratedRow | null;
  readonly latest_payment: BookingHydratedPaymentRow | null;
}
export interface BookingOrderRepositoryPaymentStateLookup {
  readonly booking_order: BookingOrderHydratedRow | null;
  readonly latest_payment: BookingHydratedPaymentRow | null;
}

export interface BookingRepositoryPaymentStateUpdateResult {
  readonly booking: BookingHydratedRow;
  readonly payment_state: BookingPaymentStateSnapshot;
}

export interface PrivateBookingRepositoryPaymentStateUpdateResult {
  readonly private_booking: PrivateBookingHydratedRow;
  readonly payment_state: BookingPaymentStateSnapshot;
}

export interface BookingOrderRepositoryPaymentStateUpdateResult {
  readonly booking_order: BookingOrderHydratedRow;
  readonly payment_state: BookingPaymentStateSnapshot;
}

export interface PrivateBookingRepositoryLookup {
  readonly private_booking: PrivateBookingHydratedRow | null;
  readonly history: readonly PrivateTrainerBookingHistoryRow[];
}

export interface PrivateBookingRepositoryListLookup {
  readonly rows: readonly PrivateBookingHydratedRow[];
  readonly total: number;
}

export interface PrivateBookingConflictLookupInput {
  readonly trainer_staff_profile_id: string;
  readonly session_date: BookingIsoDateString;
  readonly start_time: BookingTimeString;
  readonly end_time: BookingTimeString;
  readonly ignore_private_booking_id?: string | null;
}
