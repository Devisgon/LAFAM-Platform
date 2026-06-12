// apps/api/src/modules/bookings/types/booking.types.ts
/**
 * LAFAM Booking module types.
 *
 * Role:
 * - Defines API-safe Booking Module contracts.
 * - Defines repository payload and result types.
 * - Defines availability, waitlist, history, and event contracts.
 * - Keeps controllers, services, repositories, and Swagger-facing response shapes aligned.
 *
 * Important:
 * - This file contains types only.
 * - Do not place validation decorators here.
 * - Do not place database queries here.
 * - Do not place business rules here.
 * - Booking is the source of truth for real Pilates schedule availability.
 * - WebSocket/SSE is not implemented yet; this file only defines event-ready payload contracts.
 */

import type { AuthUserRole } from '../../auth/constants/auth-role.constants';
import type {
  BookingDomainEventName,
  BookingHistoryAction,
  BookingPaymentStatus,
  BookingRpcActionResult,
  BookingSortDirection,
  BookingSortField,
  BookingSource,
  BookingStatus,
  BookingWaitlistStatus,
} from '../constants/booking.constants';
import type {
  AppUserRow,
  BookingDomainEventRow,
  BookingHistoryRow,
  BookingRow,
  BookingWaitlistRow,
  CancelPilatesBookingAtomicRpcRow,
  CreatePilatesBookingAtomicRpcRow,
  DatabaseJsonObject,
  ExpireBookingHoldsAtomicRpcRow,
  PilatesClassRow,
  PilatesClassScheduleRow,
  PilatesScheduleAvailabilityRpcRow,
  ReschedulePilatesBookingAtomicRpcRow,
} from '../../../database/database.types';

export type BookingId = string;
export type BookingNumber = string;
export type BookingWaitlistId = string;
export type BookingScheduleId = string;
export type BookingClassId = string;
export type BookingUserId = string;
export type BookingStaffProfileId = string;
export type BookingDomainEventId = string;
export type BookingIdempotencyKey = string;

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
  readonly status: BookingStatus;
  readonly source: BookingSource;
  readonly payment_status: BookingPaymentStatus;
  readonly payment_required: boolean;
  readonly seat_hold_expires_at: BookingIsoDateTimeString | null;
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

export interface BookingCreateResult {
  readonly result: Extract<
    BookingRpcActionResult,
    'existing_booking' | 'booked' | 'waitlisted'
  >;
  readonly booking: BookingListItem | null;
  readonly waitlist: BookingWaitlistListItem | null;
  readonly availability: BookingAvailabilitySnapshot;
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

export interface BookingListResult {
  readonly bookings: readonly BookingListItem[];
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

export interface BookingCreatePayload {
  readonly user_id: string;
  readonly schedule_id: string;
  readonly payment_required: boolean;
  readonly idempotency_key: string | null;
  readonly created_by_admin_id: string | null;
  readonly source: BookingSource;
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

export interface BookingCustomerListFilters {
  readonly user_id: string;
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
  readonly from_date: BookingIsoDateString | null;
  readonly to_date: BookingIsoDateString | null;
  readonly limit: number;
  readonly offset: number;
  readonly sort_by: BookingSortField;
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
  readonly payload: DatabaseJsonObject;
}

export interface BookingRealtimeEventEnvelope {
  readonly event_type: BookingDomainEventName;
  readonly schedule_id: string | null;
  readonly booking_id: string | null;
  readonly waitlist_id: string | null;
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

export type BookingHydratedRow = BookingRow & {
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

export type BookingHistoryHydratedRow = BookingHistoryRow;

export type BookingAvailabilityRpcRow = PilatesScheduleAvailabilityRpcRow;

export type BookingCreateAtomicRpcRow = CreatePilatesBookingAtomicRpcRow;

export type BookingCancelAtomicRpcRow = CancelPilatesBookingAtomicRpcRow;

export type BookingRescheduleAtomicRpcRow =
  ReschedulePilatesBookingAtomicRpcRow;

export type BookingExpireHoldsRpcRow = ExpireBookingHoldsAtomicRpcRow;

export type BookingDomainEventRecord = BookingDomainEventRow;

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
