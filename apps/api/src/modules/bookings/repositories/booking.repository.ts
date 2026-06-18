// apps/api/src/modules/bookings/repositories/booking.repository.ts
/**
 * LAFAM Booking repository.
 *
 * Role:
 * - Owns Booking Module database access.
 * - Calls atomic PostgreSQL RPC functions for class bookings, private bookings,
 *   cancellation, rescheduling, availability, and hold expiry.
 * - Reads bookings, private trainer bookings, waitlist entries, history,
 *   availability, calendar rows, and domain events.
 * - Keeps raw Supabase queries out of Booking services and controllers.
 *
 * Important:
 * - This repository does not perform authorization.
 * - This repository does not own lifecycle decisions.
 * - This repository does not calculate seat allocation in TypeScript.
 * - Seat allocation and private booking conflict safety must stay inside atomic PostgreSQL functions.
 * - Services must remain the business-rule authority.
 * - Database/provider errors are converted into frontend-safe AppError instances.
 */

import { Inject, Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { SUPABASE_ADMIN_CLIENT } from '../../../database/database.constants';
import type {
  AppUserRow,
  BookingDomainEventInsert,
  BookingDomainEventRow,
  BookingHistoryInsert,
  BookingHistoryRow,
  BookingUpdate,
  BookingWaitlistRow,
  BookingWaitlistUpdate,
  LAFAMSupabaseClient,
  PilatesClassRow,
  PilatesClassScheduleRow,
} from '../../../database/database.types';
import {
  BOOKING_ADMIN_DEFAULT_LIMIT,
  BOOKING_ADMIN_MAX_LIMIT,
  BOOKING_DEFAULT_LIMIT,
  BOOKING_HISTORY_ACTION_ADMIN_OVERRIDE,
  BOOKING_MAX_LIMIT,
  BOOKING_PAYMENT_PAYABLE_STATUSES,
  BOOKING_PAYMENT_STATUS_EXPIRED,
  BOOKING_STATUS_CANCELLED,
  BOOKING_STATUS_COMPLETED,
  BOOKING_STATUS_CONFIRMED,
  BOOKING_STATUS_DELETED,
  BOOKING_STATUS_EXPIRED,
  BOOKING_STATUS_NO_SHOW,
  PRIVATE_BOOKING_ADMIN_DEFAULT_LIMIT,
  PRIVATE_BOOKING_ADMIN_MAX_LIMIT,
  PRIVATE_BOOKING_DEFAULT_LIMIT,
  PRIVATE_BOOKING_PAYMENT_PAYABLE_STATUSES,
  PRIVATE_BOOKING_MAX_LIMIT,
  WAITLIST_STATUS_CANCELLED,
  WAITLIST_STATUS_REMOVED,
  type BookingSortField,
  type BookingStatus,
  type PrivateBookingSortField,
} from '../constants/booking.constants';
import type {
  BookingAdminListFilters,
  BookingAdminWaitlistFilters,
  BookingAvailabilityPayload,
  BookingCalendarFilters,
  BookingCancelAtomicRpcRow,
  BookingCancelPayload,
  BookingCreateAtomicRpcRow,
  BookingCreatePayload,
  BookingCustomerListFilters,
  BookingDomainEventPayload,
  BookingDomainEventRecord,
  BookingHydratedPaymentRow,
  BookingHydratedRow,
  BookingPriceSnapshot,
  BookingRepositoryAvailabilityLookup,
  BookingRepositoryBookingLookup,
  BookingRepositoryCancelAtomicResult,
  BookingRepositoryCreateAtomicResult,
  BookingRepositoryExpireHoldsResult,
  BookingRepositoryListLookup,
  BookingRepositoryPayableBookingLookup,
  BookingRepositoryPaymentStateLookup,
  BookingRepositoryRescheduleAtomicResult,
  BookingRepositoryWaitlistListLookup,
  BookingRepositoryWaitlistLookup,
  BookingRescheduleAtomicRpcRow,
  BookingReschedulePayload,
  BookingWaitlistFilters,
  BookingWaitlistHydratedRow,
  PrivateBookingCancelAtomicRpcRow,
  PrivateBookingCancelPayload,
  PrivateBookingConflictLookupInput,
  PrivateBookingCreateAtomicRpcRow,
  PrivateBookingCreatePayload,
  PrivateBookingHistoryRecord,
  PrivateBookingHydratedRow,
  PrivateBookingRepositoryCancelAtomicResult,
  PrivateBookingRepositoryCreateAtomicResult,
  PrivateBookingRepositoryExpireHoldsResult,
  PrivateBookingRepositoryListLookup,
  PrivateBookingRepositoryLookup,
  PrivateBookingRepositoryPayableBookingLookup,
  PrivateBookingRepositoryPaymentStateLookup,
  PrivateBookingRepositoryRescheduleAtomicResult,
  PrivateBookingRescheduleAtomicRpcRow,
  PrivateBookingReschedulePayload,
} from '../types/booking.types';

const POSTGRES_UNIQUE_VIOLATION_CODE = '23505';
const POSTGRES_FOREIGN_KEY_VIOLATION_CODE = '23503';
const POSTGRES_CHECK_VIOLATION_CODE = '23514';
const POSTGRES_RAISE_EXCEPTION_CODE = 'P0001';

const BOOKING_RELATIONS_SELECT = `
  *,
  app_users!bookings_user_id_fkey (
    id,
    email,
    phone,
    full_name,
    role,
    status,
    is_guest,
    avatar_path
  ),
  pilates_classes!bookings_class_id_fkey (
    id,
    title,
    description,
    level,
    status,
    default_duration_minutes,
    default_capacity,
    default_price_amount,
    currency,
    image_path
  ),
  pilates_class_schedules!bookings_schedule_id_fkey (
    id,
    class_id,
    trainer_staff_profile_id,
    studio,
    class_date,
    start_time,
    end_time,
    duration_minutes,
    capacity,
    price_amount,
    currency,
    status,
    cancellation_reason,
    cancelled_at,
    completed_at,
    realtime_version
  ),
  staff_profiles!bookings_trainer_staff_profile_id_fkey (
    id,
    app_user_id,
    display_name,
    post_title,
    app_users!staff_profiles_app_user_id_fkey (
      id,
      email,
      phone,
      full_name,
      role,
      status,
      is_guest,
      avatar_path
    )
  ),
  payments!payments_booking_id_fkey (
    id,
    payment_number,
    receipt_number,
    booking_id,
    private_booking_id,
    amount,
    discount_amount,
    final_amount,
    currency,
    payment_method,
    payment_provider,
    status,
    redirect_url,
    paid_at,
    failed_at,
    cancelled_at,
    expired_at,
    refunded_at,
    refunded_amount,
    expires_at,
    created_at,
    updated_at
  )
`;

const WAITLIST_RELATIONS_SELECT = `
  *,
  app_users!booking_waitlist_user_id_fkey (
    id,
    email,
    phone,
    full_name,
    role,
    status,
    is_guest,
    avatar_path
  ),
  pilates_classes!booking_waitlist_class_id_fkey (
    id,
    title,
    description,
    level,
    status,
    default_duration_minutes,
    default_capacity,
    default_price_amount,
    currency,
    image_path
  ),
  pilates_class_schedules!booking_waitlist_schedule_id_fkey (
    id,
    class_id,
    trainer_staff_profile_id,
    studio,
    class_date,
    start_time,
    end_time,
    duration_minutes,
    capacity,
    price_amount,
    currency,
    status,
    cancellation_reason,
    cancelled_at,
    completed_at,
    realtime_version
  )
`;

const PRIVATE_BOOKING_RELATIONS_SELECT = `
  *,
  app_users!private_trainer_bookings_user_id_fkey (
    id,
    email,
    phone,
    full_name,
    role,
    status,
    is_guest,
    avatar_path
  ),
  staff_profiles!private_trainer_bookings_trainer_staff_profile_id_fkey (
    id,
    app_user_id,
    display_name,
    post_title,
    app_users!staff_profiles_app_user_id_fkey (
      id,
      email,
      phone,
      full_name,
      role,
      status,
      is_guest,
      avatar_path
    )
  ),
  payments!payments_private_booking_id_fkey (
    id,
    payment_number,
    receipt_number,
    booking_id,
    private_booking_id,
    amount,
    discount_amount,
    final_amount,
    currency,
    payment_method,
    payment_provider,
    status,
    redirect_url,
    paid_at,
    failed_at,
    cancelled_at,
    expired_at,
    refunded_at,
    refunded_amount,
    expires_at,
    created_at,
    updated_at
  )
`;

const CALENDAR_SCHEDULE_RELATIONS_SELECT = `
  *,
  pilates_classes!pilates_class_schedules_class_id_fkey (
    id,
    title,
    description,
    level,
    status,
    default_duration_minutes,
    default_capacity,
    default_price_amount,
    currency,
    image_path
  ),
  staff_profiles!pilates_class_schedules_trainer_staff_profile_id_fkey (
    id,
    app_user_id,
    display_name,
    post_title,
    app_users!staff_profiles_app_user_id_fkey (
      id,
      email,
      phone,
      full_name,
      role,
      status,
      is_guest,
      avatar_path
    )
  )
`;

interface ProviderDatabaseError {
  readonly code?: string;
  readonly message?: string;
  readonly details?: string | null;
  readonly hint?: string | null;
}

interface BookingSortResolution {
  readonly column: string;
  readonly foreignTable?: string;
}

export interface FindBookingByIdInput {
  readonly booking_id: string;
  readonly include_deleted?: boolean;
}

export interface FindBookingByIdForUserInput {
  readonly booking_id: string;
  readonly user_id: string;
  readonly include_deleted?: boolean;
}

export interface FindPrivateBookingByIdInput {
  readonly private_booking_id: string;
  readonly include_deleted?: boolean;
}

export interface FindPrivateBookingByIdForUserInput {
  readonly private_booking_id: string;
  readonly user_id: string;
  readonly include_deleted?: boolean;
}

export interface FindWaitlistByIdInput {
  readonly waitlist_id: string;
}

export interface FindWaitlistByIdForUserInput {
  readonly waitlist_id: string;
  readonly user_id: string;
}

export interface CancelWaitlistEntryInput {
  readonly waitlist_id: string;
  readonly reason: string | null;
}

export interface RemoveWaitlistEntryInput {
  readonly waitlist_id: string;
  readonly reason: string | null;
}

export interface OverrideBookingStatusInput {
  readonly booking_id: string;
  readonly target_status: BookingStatus;
  readonly actor_admin_id: string;
  readonly reason: string;
  readonly admin_notes: string | null;
  readonly changed_at: string;
}

export interface ListPendingDomainEventsInput {
  readonly limit?: number;
}

export interface MarkDomainEventPublishedInput {
  readonly event_id: string;
  readonly published_at: string;
}

export interface BookingTrainerTimeWindowLookupInput {
  readonly trainer_staff_profile_id: string;
  readonly session_date: string;
  readonly start_time: string;
  readonly end_time: string;
}

export interface BookingTrainerClassScheduleConflictLookupInput extends BookingTrainerTimeWindowLookupInput {
  readonly ignore_schedule_id?: string | null;
}

export type BookingCalendarPilatesScheduleHydratedRow =
  PilatesClassScheduleRow & {
    readonly pilates_classes?: PilatesClassRow | null;
    readonly staff_profiles?: {
      readonly id: string;
      readonly app_user_id: string;
      readonly display_name: string;
      readonly post_title: string;
      readonly app_users?: AppUserRow | null;
    } | null;
  };

function isProviderDatabaseError(
  error: unknown,
): error is ProviderDatabaseError {
  return typeof error === 'object' && error !== null;
}

function getDatabaseErrorMessage(error: unknown): string {
  if (!isProviderDatabaseError(error)) {
    return '';
  }

  return [error.message, error.details, error.hint]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
}

function databaseMessageIncludes(error: unknown, text: string): boolean {
  return getDatabaseErrorMessage(error).includes(text.toLowerCase());
}

function mapBookingRpcError(error: unknown): AppError {
  if (!isProviderDatabaseError(error)) {
    return AppError.bookingDatabaseTransactionFailed(error);
  }

  if (error.code === POSTGRES_RAISE_EXCEPTION_CODE) {
    if (databaseMessageIncludes(error, 'schedule was not found')) {
      return AppError.bookingScheduleNotFound();
    }

    if (databaseMessageIncludes(error, 'booking was not found')) {
      return AppError.bookingNotFound();
    }

    if (databaseMessageIncludes(error, 'waitlist entry')) {
      return AppError.bookingWaitlistNotFound();
    }

    if (databaseMessageIncludes(error, 'guest users cannot create bookings')) {
      return AppError.bookingAccessDenied(
        'Guest users cannot create bookings.',
      );
    }

    if (databaseMessageIncludes(error, 'only active users')) {
      return AppError.bookingAccessDenied(
        'Only active users can create bookings.',
      );
    }

    if (databaseMessageIncludes(error, 'schedule is not bookable')) {
      return AppError.bookingScheduleNotBookable();
    }

    if (databaseMessageIncludes(error, 'class is not active')) {
      return AppError.bookingClassNotActive();
    }

    if (
      databaseMessageIncludes(error, 'past pilates schedule') ||
      databaseMessageIncludes(error, 'past schedule')
    ) {
      return AppError.bookingScheduleInPast();
    }

    if (databaseMessageIncludes(error, 'active booking')) {
      return AppError.bookingDuplicateActiveBooking();
    }

    if (databaseMessageIncludes(error, 'active waitlist')) {
      return AppError.bookingDuplicateWaitlistEntry();
    }

    if (databaseMessageIncludes(error, 'does not belong')) {
      return AppError.bookingAccessDenied();
    }

    if (databaseMessageIncludes(error, 'schedule is full')) {
      return AppError.bookingCapacityFull();
    }

    if (
      databaseMessageIncludes(error, 'only active bookings') ||
      databaseMessageIncludes(error, 'only confirmed bookings') ||
      databaseMessageIncludes(error, 'target schedule must be different')
    ) {
      return AppError.bookingInvalidStatusTransition(
        error.message ?? 'Booking lifecycle transition is invalid.',
      );
    }
  }

  if (error.code === POSTGRES_UNIQUE_VIOLATION_CODE) {
    if (databaseMessageIncludes(error, 'bookings_active_user_schedule')) {
      return AppError.bookingDuplicateActiveBooking();
    }

    if (databaseMessageIncludes(error, 'booking_waitlist_active')) {
      return AppError.bookingDuplicateWaitlistEntry();
    }

    return AppError.bookingConflictRetryRequired();
  }

  if (error.code === POSTGRES_FOREIGN_KEY_VIOLATION_CODE) {
    return AppError.bookingScheduleNotFound(
      'A related booking, schedule, class, staff, or user record was not found.',
    );
  }

  if (error.code === POSTGRES_CHECK_VIOLATION_CODE) {
    return AppError.bookingInvalidStatusTransition(
      'The booking state violates database lifecycle rules.',
    );
  }

  return AppError.bookingDatabaseTransactionFailed(error);
}

function mapPrivateBookingRpcError(error: unknown): AppError {
  if (!isProviderDatabaseError(error)) {
    return AppError.privateBookingDatabaseTransactionFailed(error);
  }

  if (error.code === POSTGRES_RAISE_EXCEPTION_CODE) {
    if (
      databaseMessageIncludes(error, 'private trainer booking was not found')
    ) {
      return AppError.privateBookingNotFound();
    }

    if (databaseMessageIncludes(error, 'private booking id is required')) {
      return AppError.privateBookingNotFound(
        'Private trainer booking id is required.',
      );
    }

    if (databaseMessageIncludes(error, 'does not belong')) {
      return AppError.privateBookingAccessDenied();
    }

    if (
      databaseMessageIncludes(error, 'guest users cannot create private') ||
      databaseMessageIncludes(error, 'only active users can create private')
    ) {
      return AppError.privateBookingAccessDenied(
        error.message ?? 'You are not allowed to create private bookings.',
      );
    }

    if (
      databaseMessageIncludes(error, 'trainer profile was not found') ||
      databaseMessageIncludes(error, 'trainer app user was not found')
    ) {
      return AppError.trainerPrivateSlotUnavailable(
        'The selected trainer is not available for private bookings.',
      );
    }

    if (
      databaseMessageIncludes(error, 'trainer is not available') ||
      databaseMessageIncludes(error, 'trainer account is not active') ||
      databaseMessageIncludes(error, 'not assignable as a trainer') ||
      databaseMessageIncludes(error, 'does not have availability')
    ) {
      return AppError.trainerPrivateSlotUnavailable(
        error.message ??
          'The selected trainer is not available for this private session time slot.',
      );
    }

    if (
      databaseMessageIncludes(error, 'already has a pilates class') ||
      databaseMessageIncludes(error, 'already has a private booking')
    ) {
      return AppError.privateBookingConflict(
        error.message ??
          'The private trainer booking conflicts with the current trainer schedule.',
      );
    }

    if (
      databaseMessageIncludes(error, 'only active private trainer bookings') ||
      databaseMessageIncludes(error, 'duration') ||
      databaseMessageIncludes(error, 'cross midnight') ||
      databaseMessageIncludes(error, 'past private trainer session')
    ) {
      return AppError.privateBookingInvalidStatus(
        error.message ?? 'Private trainer booking lifecycle transition failed.',
      );
    }
  }

  if (error.code === POSTGRES_UNIQUE_VIOLATION_CODE) {
    return AppError.privateBookingConflict();
  }

  if (error.code === POSTGRES_FOREIGN_KEY_VIOLATION_CODE) {
    return AppError.privateBookingNotFound(
      'A related private booking, trainer, or user record was not found.',
    );
  }

  if (error.code === POSTGRES_CHECK_VIOLATION_CODE) {
    return AppError.privateBookingInvalidStatus(
      'The private booking state violates database lifecycle rules.',
    );
  }

  return AppError.privateBookingDatabaseTransactionFailed(error);
}

function mapDatabaseError(error: unknown): AppError {
  if (!isProviderDatabaseError(error)) {
    return AppError.databaseOperationFailed(error);
  }

  if (error.code === POSTGRES_UNIQUE_VIOLATION_CODE) {
    return AppError.bookingConflictRetryRequired();
  }

  if (error.code === POSTGRES_FOREIGN_KEY_VIOLATION_CODE) {
    return AppError.bookingScheduleNotFound(
      'A related booking, schedule, class, staff, or user record was not found.',
    );
  }

  if (error.code === POSTGRES_CHECK_VIOLATION_CODE) {
    return AppError.bookingInvalidStatusTransition(
      'The requested booking state violates database lifecycle rules.',
    );
  }

  return AppError.databaseOperationFailed(error);
}

function resolveLimit(
  limit: number | null | undefined,
  defaultLimit: number,
  maxLimit: number,
): number {
  if (!Number.isInteger(limit) || typeof limit !== 'number' || limit <= 0) {
    return defaultLimit;
  }

  return Math.min(limit, maxLimit);
}

function resolveOffset(offset: number | null | undefined): number {
  if (!Number.isInteger(offset) || typeof offset !== 'number' || offset < 0) {
    return 0;
  }

  return offset;
}

function resolveRangeEnd(offset: number, limit: number): number {
  return offset + limit - 1;
}

function resolveTotal(count: number | null, fallback: number): number {
  return typeof count === 'number' ? count : fallback;
}

function sanitizePostgrestSearchTerm(search: string): string {
  return search.replace(/[%,()]/g, ' ').trim();
}

function getRequiredRpcRow<TRow>(
  rows: readonly TRow[] | null,
  operation: string,
): TRow {
  const row = rows?.[0];

  if (!row) {
    throw AppError.bookingDatabaseTransactionFailed(
      new Error(`${operation} did not return a result row.`),
    );
  }

  return row;
}

function getRequiredPrivateRpcRow<TRow>(
  rows: readonly TRow[] | null,
  operation: string,
): TRow {
  const row = rows?.[0];

  if (!row) {
    throw AppError.privateBookingDatabaseTransactionFailed(
      new Error(`${operation} did not return a result row.`),
    );
  }

  return row;
}

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

function resolveClassBookingPriceSnapshot(
  booking: BookingHydratedRow | null,
): BookingPriceSnapshot | null {
  if (!booking) {
    return null;
  }

  const schedule = booking.pilates_class_schedules ?? null;
  const pilatesClass = booking.pilates_classes ?? null;

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
  privateBooking: PrivateBookingHydratedRow | null,
): BookingPriceSnapshot | null {
  if (!privateBooking) {
    return null;
  }

  if (
    typeof privateBooking.price_amount === 'number' &&
    privateBooking.price_amount >= 0
  ) {
    return {
      amount: privateBooking.price_amount,
      currency: privateBooking.currency ?? null,
      source: 'private_booking',
    };
  }

  return {
    amount: null,
    currency: privateBooking.currency ?? null,
    source: 'not_configured',
  };
}

function resolveBookingSort(sortBy: BookingSortField): BookingSortResolution {
  if (sortBy === 'schedule_date') {
    return {
      column: 'class_date',
      foreignTable: 'pilates_class_schedules',
    };
  }

  if (sortBy === 'start_time') {
    return {
      column: 'start_time',
      foreignTable: 'pilates_class_schedules',
    };
  }

  if (sortBy === 'status') {
    return {
      column: 'status',
    };
  }

  return {
    column: 'created_at',
  };
}

function resolvePrivateBookingSort(
  sortBy: PrivateBookingSortField,
): BookingSortResolution {
  if (sortBy === 'session_date') {
    return {
      column: 'session_date',
    };
  }

  if (sortBy === 'start_time') {
    return {
      column: 'start_time',
    };
  }

  if (sortBy === 'status') {
    return {
      column: 'status',
    };
  }

  return {
    column: 'created_at',
  };
}

function buildBookingOverrideUpdate(
  input: OverrideBookingStatusInput,
): BookingUpdate {
  const update: BookingUpdate = {
    status: input.target_status,
    admin_notes: input.admin_notes,
  };

  if (input.target_status === BOOKING_STATUS_CONFIRMED) {
    update.confirmed_at = input.changed_at;
    update.cancelled_at = null;
    update.completed_at = null;
    update.no_show_at = null;
  }

  if (input.target_status === BOOKING_STATUS_CANCELLED) {
    update.cancelled_at = input.changed_at;
    update.cancelled_by_admin_id = input.actor_admin_id;
    update.cancellation_reason = input.reason;
    update.seat_hold_expires_at = null;
  }

  if (input.target_status === BOOKING_STATUS_COMPLETED) {
    update.completed_at = input.changed_at;
    update.cancelled_at = null;
    update.no_show_at = null;
  }

  if (input.target_status === BOOKING_STATUS_NO_SHOW) {
    update.no_show_at = input.changed_at;
    update.cancelled_at = null;
    update.completed_at = null;
  }

  if (input.target_status === BOOKING_STATUS_EXPIRED) {
    update.payment_status = BOOKING_PAYMENT_STATUS_EXPIRED;
    update.seat_hold_expires_at = null;
  }

  if (input.target_status === BOOKING_STATUS_DELETED) {
    update.deleted_at = input.changed_at;
  }

  return update;
}

@Injectable()
export class BookingRepository {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly adminClient: LAFAMSupabaseClient,
  ) {}

  async getAvailability(
    input: BookingAvailabilityPayload,
  ): Promise<BookingRepositoryAvailabilityLookup> {
    const { data, error } = await this.adminClient.rpc(
      'get_pilates_schedule_availability',
      {
        p_schedule_id: input.schedule_id,
      },
    );

    if (error) {
      throw mapBookingRpcError(error);
    }

    return {
      availability: data?.[0] ?? null,
    };
  }

  async createBookingAtomic(
    input: BookingCreatePayload,
  ): Promise<BookingRepositoryCreateAtomicResult> {
    const { data, error } = await this.adminClient.rpc(
      'create_pilates_booking_atomic',
      {
        p_user_id: input.user_id,
        p_schedule_id: input.schedule_id,
        p_payment_required: input.payment_required,
        p_idempotency_key: input.idempotency_key,
        p_created_by_admin_id: input.created_by_admin_id,
        p_source: input.source,
      },
    );

    if (error) {
      throw mapBookingRpcError(error);
    }

    return {
      rpc: getRequiredRpcRow<BookingCreateAtomicRpcRow>(
        data,
        'create_pilates_booking_atomic',
      ),
    };
  }

  async cancelBookingAtomic(
    input: BookingCancelPayload,
  ): Promise<BookingRepositoryCancelAtomicResult> {
    const { data, error } = await this.adminClient.rpc(
      'cancel_pilates_booking_atomic',
      {
        p_booking_id: input.booking_id,
        p_actor_user_id: input.actor_user_id,
        p_actor_admin_id: input.actor_admin_id,
        p_reason: input.reason,
      },
    );

    if (error) {
      throw mapBookingRpcError(error);
    }

    return {
      rpc: getRequiredRpcRow<BookingCancelAtomicRpcRow>(
        data,
        'cancel_pilates_booking_atomic',
      ),
    };
  }

  async rescheduleBookingAtomic(
    input: BookingReschedulePayload,
  ): Promise<BookingRepositoryRescheduleAtomicResult> {
    const { data, error } = await this.adminClient.rpc(
      'reschedule_pilates_booking_atomic',
      {
        p_booking_id: input.booking_id,
        p_target_schedule_id: input.target_schedule_id,
        p_actor_user_id: input.actor_user_id,
        p_actor_admin_id: input.actor_admin_id,
        p_join_waitlist_if_full: input.join_waitlist_if_full,
        p_reason: input.reason,
      },
    );

    if (error) {
      throw mapBookingRpcError(error);
    }

    return {
      rpc: getRequiredRpcRow<BookingRescheduleAtomicRpcRow>(
        data,
        'reschedule_pilates_booking_atomic',
      ),
    };
  }

  async expireBookingHolds(): Promise<BookingRepositoryExpireHoldsResult> {
    const { data, error } = await this.adminClient.rpc(
      'expire_booking_holds_atomic',
      {},
    );

    if (error) {
      throw mapBookingRpcError(error);
    }

    return {
      expired: data ?? [],
    };
  }

  async createPrivateBookingAtomic(
    input: PrivateBookingCreatePayload,
  ): Promise<PrivateBookingRepositoryCreateAtomicResult> {
    const { data, error } = await this.adminClient.rpc(
      'create_private_trainer_booking_atomic',
      {
        p_user_id: input.user_id,
        p_trainer_staff_profile_id: input.trainer_staff_profile_id,
        p_session_date: input.session_date,
        p_start_time: input.start_time,
        p_duration_minutes: input.duration_minutes,
        p_studio: input.studio,
        p_payment_required: input.payment_required,
        p_idempotency_key: input.idempotency_key,
        p_created_by_admin_id: input.created_by_admin_id,
        p_source: input.source,
      },
    );

    if (error) {
      throw mapPrivateBookingRpcError(error);
    }

    return {
      rpc: getRequiredPrivateRpcRow<PrivateBookingCreateAtomicRpcRow>(
        data,
        'create_private_trainer_booking_atomic',
      ),
    };
  }

  async cancelPrivateBookingAtomic(
    input: PrivateBookingCancelPayload,
  ): Promise<PrivateBookingRepositoryCancelAtomicResult> {
    const { data, error } = await this.adminClient.rpc(
      'cancel_private_trainer_booking_atomic',
      {
        p_private_booking_id: input.private_booking_id,
        p_actor_user_id: input.actor_user_id,
        p_actor_admin_id: input.actor_admin_id,
        p_reason: input.reason,
      },
    );

    if (error) {
      throw mapPrivateBookingRpcError(error);
    }

    return {
      rpc: getRequiredPrivateRpcRow<PrivateBookingCancelAtomicRpcRow>(
        data,
        'cancel_private_trainer_booking_atomic',
      ),
    };
  }

  async reschedulePrivateBookingAtomic(
    input: PrivateBookingReschedulePayload,
  ): Promise<PrivateBookingRepositoryRescheduleAtomicResult> {
    const { data, error } = await this.adminClient.rpc(
      'reschedule_private_trainer_booking_atomic',
      {
        p_private_booking_id: input.private_booking_id,
        p_target_session_date: input.target_session_date,
        p_target_start_time: input.target_start_time,
        p_target_duration_minutes: input.target_duration_minutes,
        p_studio: input.studio,
        p_actor_user_id: input.actor_user_id,
        p_actor_admin_id: input.actor_admin_id,
        p_reason: input.reason,
        p_idempotency_key: input.idempotency_key,
        p_payment_required: input.payment_required,
      },
    );

    if (error) {
      throw mapPrivateBookingRpcError(error);
    }

    return {
      rpc: getRequiredPrivateRpcRow<PrivateBookingRescheduleAtomicRpcRow>(
        data,
        'reschedule_private_trainer_booking_atomic',
      ),
    };
  }

  async expirePrivateBookingHolds(): Promise<PrivateBookingRepositoryExpireHoldsResult> {
    const { data, error } = await this.adminClient.rpc(
      'expire_private_trainer_booking_holds_atomic',
      {},
    );

    if (error) {
      throw mapPrivateBookingRpcError(error);
    }

    return {
      expired: data ?? [],
    };
  }

  async isStaffAvailableForPrivateTime(
    input: BookingTrainerTimeWindowLookupInput,
  ): Promise<boolean> {
    const { data, error } = await this.adminClient.rpc(
      'is_staff_available_for_time',
      {
        p_staff_profile_id: input.trainer_staff_profile_id,
        p_session_date: input.session_date,
        p_start_time: input.start_time,
        p_end_time: input.end_time,
      },
    );

    if (error) {
      throw mapPrivateBookingRpcError(error);
    }

    return data === true;
  }

  async hasTrainerClassScheduleConflict(
    input: BookingTrainerClassScheduleConflictLookupInput,
  ): Promise<boolean> {
    const { data, error } = await this.adminClient.rpc(
      'has_trainer_class_schedule_conflict',
      {
        p_trainer_staff_profile_id: input.trainer_staff_profile_id,
        p_session_date: input.session_date,
        p_start_time: input.start_time,
        p_end_time: input.end_time,
        p_ignore_schedule_id: input.ignore_schedule_id ?? null,
      },
    );

    if (error) {
      throw mapPrivateBookingRpcError(error);
    }

    return data === true;
  }

  async hasTrainerPrivateBookingConflict(
    input: PrivateBookingConflictLookupInput,
  ): Promise<boolean> {
    const { data, error } = await this.adminClient.rpc(
      'has_trainer_private_booking_conflict',
      {
        p_trainer_staff_profile_id: input.trainer_staff_profile_id,
        p_session_date: input.session_date,
        p_start_time: input.start_time,
        p_end_time: input.end_time,
        p_ignore_private_booking_id: input.ignore_private_booking_id ?? null,
      },
    );

    if (error) {
      throw mapPrivateBookingRpcError(error);
    }

    return data === true;
  }

  async findBookingById(
    input: FindBookingByIdInput,
  ): Promise<BookingRepositoryBookingLookup> {
    let query = this.adminClient
      .from('bookings')
      .select(BOOKING_RELATIONS_SELECT)
      .eq('id', input.booking_id);

    if (!input.include_deleted) {
      query = query.is('deleted_at', null);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    const booking = data as unknown as BookingHydratedRow | null;

    return {
      booking,
      history: booking ? await this.listBookingHistory(booking.id) : [],
    };
  }

  async findBookingByIdForUser(
    input: FindBookingByIdForUserInput,
  ): Promise<BookingRepositoryBookingLookup> {
    let query = this.adminClient
      .from('bookings')
      .select(BOOKING_RELATIONS_SELECT)
      .eq('id', input.booking_id)
      .eq('user_id', input.user_id);

    if (!input.include_deleted) {
      query = query.is('deleted_at', null);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    const booking = data as unknown as BookingHydratedRow | null;

    return {
      booking,
      history: booking ? await this.listBookingHistory(booking.id) : [],
    };
  }

  async findPrivateBookingById(
    input: FindPrivateBookingByIdInput,
  ): Promise<PrivateBookingRepositoryLookup> {
    let query = this.adminClient
      .from('private_trainer_bookings')
      .select(PRIVATE_BOOKING_RELATIONS_SELECT)
      .eq('id', input.private_booking_id);

    if (!input.include_deleted) {
      query = query.is('deleted_at', null);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw mapPrivateBookingRpcError(error);
    }

    const privateBooking = data as unknown as PrivateBookingHydratedRow | null;

    return {
      private_booking: privateBooking,
      history: privateBooking
        ? await this.listPrivateBookingHistory(privateBooking.id)
        : [],
    };
  }

  async findPrivateBookingByIdForUser(
    input: FindPrivateBookingByIdForUserInput,
  ): Promise<PrivateBookingRepositoryLookup> {
    let query = this.adminClient
      .from('private_trainer_bookings')
      .select(PRIVATE_BOOKING_RELATIONS_SELECT)
      .eq('id', input.private_booking_id)
      .eq('user_id', input.user_id);

    if (!input.include_deleted) {
      query = query.is('deleted_at', null);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw mapPrivateBookingRpcError(error);
    }

    const privateBooking = data as unknown as PrivateBookingHydratedRow | null;

    return {
      private_booking: privateBooking,
      history: privateBooking
        ? await this.listPrivateBookingHistory(privateBooking.id)
        : [],
    };
  }

  async findPayableBookingForUser(
    input: FindBookingByIdForUserInput,
  ): Promise<BookingRepositoryPayableBookingLookup> {
    const lookup = await this.findBookingByIdForUser(input);
    const booking = lookup.booking;

    if (!booking) {
      return {
        booking: null,
        price: null,
        latest_payment: null,
      };
    }

    if (
      !BOOKING_PAYMENT_PAYABLE_STATUSES.includes(
        booking.payment_status as (typeof BOOKING_PAYMENT_PAYABLE_STATUSES)[number],
      )
    ) {
      return {
        booking,
        price: resolveClassBookingPriceSnapshot(booking),
        latest_payment: getLatestHydratedPayment(booking.payments),
      };
    }

    return {
      booking,
      price: resolveClassBookingPriceSnapshot(booking),
      latest_payment: getLatestHydratedPayment(booking.payments),
    };
  }

  async findPrivatePayableBookingForUser(
    input: FindPrivateBookingByIdForUserInput,
  ): Promise<PrivateBookingRepositoryPayableBookingLookup> {
    const lookup = await this.findPrivateBookingByIdForUser(input);
    const privateBooking = lookup.private_booking;

    if (!privateBooking) {
      return {
        private_booking: null,
        price: null,
        latest_payment: null,
      };
    }

    if (
      !PRIVATE_BOOKING_PAYMENT_PAYABLE_STATUSES.includes(
        privateBooking.payment_status as (typeof PRIVATE_BOOKING_PAYMENT_PAYABLE_STATUSES)[number],
      )
    ) {
      return {
        private_booking: privateBooking,
        price: resolvePrivateBookingPriceSnapshot(privateBooking),
        latest_payment: getLatestHydratedPayment(privateBooking.payments),
      };
    }

    return {
      private_booking: privateBooking,
      price: resolvePrivateBookingPriceSnapshot(privateBooking),
      latest_payment: getLatestHydratedPayment(privateBooking.payments),
    };
  }

  async findBookingPaymentState(
    input: FindBookingByIdInput,
  ): Promise<BookingRepositoryPaymentStateLookup> {
    const lookup = await this.findBookingById(input);
    const booking = lookup.booking;

    return {
      booking,
      latest_payment: booking
        ? getLatestHydratedPayment(booking.payments)
        : null,
    };
  }

  async findPrivateBookingPaymentState(
    input: FindPrivateBookingByIdInput,
  ): Promise<PrivateBookingRepositoryPaymentStateLookup> {
    const lookup = await this.findPrivateBookingById(input);
    const privateBooking = lookup.private_booking;

    return {
      private_booking: privateBooking,
      latest_payment: privateBooking
        ? getLatestHydratedPayment(privateBooking.payments)
        : null,
    };
  }

  async listCustomerBookings(
    filters: BookingCustomerListFilters,
  ): Promise<BookingRepositoryListLookup> {
    if (!filters.user_id) {
      throw AppError.bookingAccessDenied(
        'Customer booking listing requires a user id.',
      );
    }

    const limit = resolveLimit(
      filters.limit,
      BOOKING_DEFAULT_LIMIT,
      BOOKING_MAX_LIMIT,
    );
    const offset = resolveOffset(filters.offset);
    const scheduleIds = await this.resolveScheduleIdsByDateRange(
      filters.from_date,
      filters.to_date,
    );

    if (scheduleIds !== null && scheduleIds.length === 0) {
      return {
        rows: [],
        total: 0,
      };
    }

    let query = this.adminClient
      .from('bookings')
      .select(BOOKING_RELATIONS_SELECT, { count: 'exact' })
      .eq('user_id', filters.user_id)
      .is('deleted_at', null);

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (scheduleIds !== null) {
      query = query.in('schedule_id', [...scheduleIds]);
    }

    const sort = resolveBookingSort(filters.sort_by);
    const { data, error, count } = await query
      .order(sort.column, {
        ascending: filters.sort_direction === 'asc',
        ...(sort.foreignTable ? { foreignTable: sort.foreignTable } : {}),
      })
      .range(offset, resolveRangeEnd(offset, limit));

    if (error) {
      throw mapDatabaseError(error);
    }

    const rows = (data ?? []) as unknown as BookingHydratedRow[];

    return {
      rows,
      total: resolveTotal(count, rows.length),
    };
  }

  async listAdminBookings(
    filters: BookingAdminListFilters,
  ): Promise<BookingRepositoryListLookup> {
    const limit = resolveLimit(
      filters.limit,
      BOOKING_ADMIN_DEFAULT_LIMIT,
      BOOKING_ADMIN_MAX_LIMIT,
    );
    const offset = resolveOffset(filters.offset);
    const scheduleIds = await this.resolveScheduleIdsByDateRange(
      filters.from_date,
      filters.to_date,
    );

    if (scheduleIds !== null && scheduleIds.length === 0) {
      return {
        rows: [],
        total: 0,
      };
    }

    let query = this.adminClient
      .from('bookings')
      .select(BOOKING_RELATIONS_SELECT, { count: 'exact' })
      .is('deleted_at', null);

    if (filters.search) {
      const searchTerm = sanitizePostgrestSearchTerm(filters.search);

      if (searchTerm.length > 0) {
        query = query.or(
          [
            `booking_number.ilike.%${searchTerm}%`,
            `cancellation_reason.ilike.%${searchTerm}%`,
            `admin_notes.ilike.%${searchTerm}%`,
          ].join(','),
        );
      }
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.payment_status) {
      query = query.eq('payment_status', filters.payment_status);
    }

    if (filters.schedule_id) {
      query = query.eq('schedule_id', filters.schedule_id);
    }

    if (filters.class_id) {
      query = query.eq('class_id', filters.class_id);
    }

    if (filters.trainer_staff_profile_id) {
      query = query.eq(
        'trainer_staff_profile_id',
        filters.trainer_staff_profile_id,
      );
    }

    if (filters.user_id) {
      query = query.eq('user_id', filters.user_id);
    }

    if (scheduleIds !== null) {
      query = query.in('schedule_id', [...scheduleIds]);
    }

    const sort = resolveBookingSort(filters.sort_by);
    const { data, error, count } = await query
      .order(sort.column, {
        ascending: filters.sort_direction === 'asc',
        ...(sort.foreignTable ? { foreignTable: sort.foreignTable } : {}),
      })
      .range(offset, resolveRangeEnd(offset, limit));

    if (error) {
      throw mapDatabaseError(error);
    }

    const rows = (data ?? []) as unknown as BookingHydratedRow[];

    return {
      rows,
      total: resolveTotal(count, rows.length),
    };
  }

  async listCustomerPrivateBookings(
    filters: import('../types/booking.types').PrivateBookingCustomerListFilters,
  ): Promise<PrivateBookingRepositoryListLookup> {
    if (!filters.user_id) {
      throw AppError.privateBookingAccessDenied(
        'Customer private booking listing requires a user id.',
      );
    }

    const limit = resolveLimit(
      filters.limit,
      PRIVATE_BOOKING_DEFAULT_LIMIT,
      PRIVATE_BOOKING_MAX_LIMIT,
    );
    const offset = resolveOffset(filters.offset);

    let query = this.adminClient
      .from('private_trainer_bookings')
      .select(PRIVATE_BOOKING_RELATIONS_SELECT, { count: 'exact' })
      .eq('user_id', filters.user_id)
      .is('deleted_at', null);

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.trainer_staff_profile_id) {
      query = query.eq(
        'trainer_staff_profile_id',
        filters.trainer_staff_profile_id,
      );
    }

    if (filters.from_date) {
      query = query.gte('session_date', filters.from_date);
    }

    if (filters.to_date) {
      query = query.lte('session_date', filters.to_date);
    }

    const sort = resolvePrivateBookingSort(filters.sort_by);
    const { data, error, count } = await query
      .order(sort.column, {
        ascending: filters.sort_direction === 'asc',
      })
      .range(offset, resolveRangeEnd(offset, limit));

    if (error) {
      throw mapPrivateBookingRpcError(error);
    }

    const rows = (data ?? []) as unknown as PrivateBookingHydratedRow[];

    return {
      rows,
      total: resolveTotal(count, rows.length),
    };
  }

  async listAdminPrivateBookings(
    filters: import('../types/booking.types').PrivateBookingAdminListFilters,
  ): Promise<PrivateBookingRepositoryListLookup> {
    const limit = resolveLimit(
      filters.limit,
      PRIVATE_BOOKING_ADMIN_DEFAULT_LIMIT,
      PRIVATE_BOOKING_ADMIN_MAX_LIMIT,
    );
    const offset = resolveOffset(filters.offset);

    let query = this.adminClient
      .from('private_trainer_bookings')
      .select(PRIVATE_BOOKING_RELATIONS_SELECT, { count: 'exact' })
      .is('deleted_at', null);

    if (filters.search) {
      const searchTerm = sanitizePostgrestSearchTerm(filters.search);

      if (searchTerm.length > 0) {
        query = query.or(
          [
            `booking_number.ilike.%${searchTerm}%`,
            `cancellation_reason.ilike.%${searchTerm}%`,
            `admin_notes.ilike.%${searchTerm}%`,
          ].join(','),
        );
      }
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.payment_status) {
      query = query.eq('payment_status', filters.payment_status);
    }

    if (filters.trainer_staff_profile_id) {
      query = query.eq(
        'trainer_staff_profile_id',
        filters.trainer_staff_profile_id,
      );
    }

    if (filters.user_id) {
      query = query.eq('user_id', filters.user_id);
    }

    if (filters.from_date) {
      query = query.gte('session_date', filters.from_date);
    }

    if (filters.to_date) {
      query = query.lte('session_date', filters.to_date);
    }

    const sort = resolvePrivateBookingSort(filters.sort_by);
    const { data, error, count } = await query
      .order(sort.column, {
        ascending: filters.sort_direction === 'asc',
      })
      .range(offset, resolveRangeEnd(offset, limit));

    if (error) {
      throw mapPrivateBookingRpcError(error);
    }

    const rows = (data ?? []) as unknown as PrivateBookingHydratedRow[];

    return {
      rows,
      total: resolveTotal(count, rows.length),
    };
  }

  async listBookingHistory(
    bookingId: string,
  ): Promise<readonly BookingHistoryRow[]> {
    const { data, error } = await this.adminClient
      .from('booking_history')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true });

    if (error) {
      throw mapDatabaseError(error);
    }

    return data ?? [];
  }

  async listPrivateBookingHistory(
    privateBookingId: string,
  ): Promise<readonly PrivateBookingHistoryRecord[]> {
    const { data, error } = await this.adminClient
      .from('private_trainer_booking_history')
      .select('*')
      .eq('private_booking_id', privateBookingId)
      .order('created_at', { ascending: true });

    if (error) {
      throw mapPrivateBookingRpcError(error);
    }

    return data ?? [];
  }

  async findWaitlistById(
    input: FindWaitlistByIdInput,
  ): Promise<BookingRepositoryWaitlistLookup> {
    const { data, error } = await this.adminClient
      .from('booking_waitlist')
      .select(WAITLIST_RELATIONS_SELECT)
      .eq('id', input.waitlist_id)
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return {
      waitlist: data as unknown as BookingWaitlistHydratedRow | null,
    };
  }

  async findWaitlistByIdForUser(
    input: FindWaitlistByIdForUserInput,
  ): Promise<BookingRepositoryWaitlistLookup> {
    const { data, error } = await this.adminClient
      .from('booking_waitlist')
      .select(WAITLIST_RELATIONS_SELECT)
      .eq('id', input.waitlist_id)
      .eq('user_id', input.user_id)
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return {
      waitlist: data as unknown as BookingWaitlistHydratedRow | null,
    };
  }

  async listCustomerWaitlist(
    filters: BookingWaitlistFilters,
  ): Promise<BookingRepositoryWaitlistListLookup> {
    if (!filters.user_id) {
      throw AppError.bookingAccessDenied(
        'Customer waitlist listing requires a user id.',
      );
    }

    const limit = resolveLimit(
      filters.limit,
      BOOKING_DEFAULT_LIMIT,
      BOOKING_MAX_LIMIT,
    );
    const offset = resolveOffset(filters.offset);

    let query = this.adminClient
      .from('booking_waitlist')
      .select(WAITLIST_RELATIONS_SELECT, { count: 'exact' })
      .eq('user_id', filters.user_id);

    if (filters.schedule_id) {
      query = query.eq('schedule_id', filters.schedule_id);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error, count } = await query
      .order('joined_at', { ascending: false })
      .range(offset, resolveRangeEnd(offset, limit));

    if (error) {
      throw mapDatabaseError(error);
    }

    const rows = (data ?? []) as unknown as BookingWaitlistHydratedRow[];

    return {
      rows,
      total: resolveTotal(count, rows.length),
    };
  }

  async listAdminScheduleWaitlist(
    filters: BookingAdminWaitlistFilters,
  ): Promise<BookingRepositoryWaitlistListLookup> {
    const limit = resolveLimit(
      filters.limit,
      BOOKING_ADMIN_DEFAULT_LIMIT,
      BOOKING_ADMIN_MAX_LIMIT,
    );
    const offset = resolveOffset(filters.offset);

    let query = this.adminClient
      .from('booking_waitlist')
      .select(WAITLIST_RELATIONS_SELECT, { count: 'exact' })
      .eq('schedule_id', filters.schedule_id);

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error, count } = await query
      .order('position', { ascending: true })
      .order('joined_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, resolveRangeEnd(offset, limit));

    if (error) {
      throw mapDatabaseError(error);
    }

    const rows = (data ?? []) as unknown as BookingWaitlistHydratedRow[];

    return {
      rows,
      total: resolveTotal(count, rows.length),
    };
  }

  async cancelWaitlistEntry(
    input: CancelWaitlistEntryInput,
  ): Promise<BookingWaitlistRow> {
    const update: BookingWaitlistUpdate = {
      status: WAITLIST_STATUS_CANCELLED,
      cancelled_at: new Date().toISOString(),
      cancellation_reason: input.reason,
    };

    const { data, error } = await this.adminClient
      .from('booking_waitlist')
      .update(update)
      .eq('id', input.waitlist_id)
      .select('*')
      .single();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data;
  }

  async removeWaitlistEntry(
    input: RemoveWaitlistEntryInput,
  ): Promise<BookingWaitlistRow> {
    const update: BookingWaitlistUpdate = {
      status: WAITLIST_STATUS_REMOVED,
      cancellation_reason: input.reason,
    };

    const { data, error } = await this.adminClient
      .from('booking_waitlist')
      .update(update)
      .eq('id', input.waitlist_id)
      .select('*')
      .single();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data;
  }

  async overrideBookingStatus(
    input: OverrideBookingStatusInput,
  ): Promise<BookingHydratedRow> {
    const existingLookup = await this.findBookingById({
      booking_id: input.booking_id,
      include_deleted: false,
    });

    if (!existingLookup.booking) {
      throw AppError.bookingNotFound();
    }

    const previousStatus = existingLookup.booking.status;
    const update = buildBookingOverrideUpdate(input);

    const { data, error } = await this.adminClient
      .from('bookings')
      .update(update)
      .eq('id', input.booking_id)
      .is('deleted_at', null)
      .select(BOOKING_RELATIONS_SELECT)
      .single();

    if (error) {
      throw mapDatabaseError(error);
    }

    await this.insertBookingHistory({
      booking_id: input.booking_id,
      actor_admin_id: input.actor_admin_id,
      actor_user_id: null,
      actor_role: 'admin',
      action: BOOKING_HISTORY_ACTION_ADMIN_OVERRIDE,
      from_status: previousStatus,
      to_status: input.target_status,
      notes: input.reason,
      metadata: {
        admin_notes: input.admin_notes,
      },
    });

    return data as unknown as BookingHydratedRow;
  }

  async listCalendarClassSchedules(
    filters: BookingCalendarFilters,
  ): Promise<readonly BookingCalendarPilatesScheduleHydratedRow[]> {
    if (!filters.include_class_schedules) {
      return [];
    }

    let query = this.adminClient
      .from('pilates_class_schedules')
      .select(CALENDAR_SCHEDULE_RELATIONS_SELECT)
      .is('deleted_at', null)
      .gte('class_date', filters.from_date)
      .lte('class_date', filters.to_date);

    if (filters.trainer_staff_profile_id) {
      query = query.eq(
        'trainer_staff_profile_id',
        filters.trainer_staff_profile_id,
      );
    }

    if (filters.class_id) {
      query = query.eq('class_id', filters.class_id);
    }

    const { data, error } = await query
      .order('class_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      throw mapDatabaseError(error);
    }

    return (data ??
      []) as unknown as BookingCalendarPilatesScheduleHydratedRow[];
  }

  async listCalendarClassBookings(
    filters: BookingCalendarFilters,
  ): Promise<readonly BookingHydratedRow[]> {
    if (!filters.include_class_bookings) {
      return [];
    }

    const scheduleIds = await this.resolveScheduleIdsByCalendarFilters(filters);

    if (scheduleIds.length === 0) {
      return [];
    }

    let query = this.adminClient
      .from('bookings')
      .select(BOOKING_RELATIONS_SELECT)
      .is('deleted_at', null)
      .in('schedule_id', [...scheduleIds]);

    if (filters.user_id) {
      query = query.eq('user_id', filters.user_id);
    }

    if (filters.class_id) {
      query = query.eq('class_id', filters.class_id);
    }

    if (filters.trainer_staff_profile_id) {
      query = query.eq(
        'trainer_staff_profile_id',
        filters.trainer_staff_profile_id,
      );
    }

    const { data, error } = await query.order('created_at', {
      ascending: true,
    });

    if (error) {
      throw mapDatabaseError(error);
    }

    return (data ?? []) as unknown as BookingHydratedRow[];
  }

  async listCalendarWaitlist(
    filters: BookingCalendarFilters,
  ): Promise<readonly BookingWaitlistHydratedRow[]> {
    if (!filters.include_waitlist) {
      return [];
    }

    const scheduleIds = await this.resolveScheduleIdsByCalendarFilters(filters);

    if (scheduleIds.length === 0) {
      return [];
    }

    let query = this.adminClient
      .from('booking_waitlist')
      .select(WAITLIST_RELATIONS_SELECT)
      .in('schedule_id', [...scheduleIds]);

    if (filters.user_id) {
      query = query.eq('user_id', filters.user_id);
    }

    if (filters.class_id) {
      query = query.eq('class_id', filters.class_id);
    }

    const { data, error } = await query
      .order('joined_at', { ascending: true })
      .order('position', { ascending: true });

    if (error) {
      throw mapDatabaseError(error);
    }

    return (data ?? []) as unknown as BookingWaitlistHydratedRow[];
  }

  async listCalendarPrivateBookings(
    filters: BookingCalendarFilters,
  ): Promise<readonly PrivateBookingHydratedRow[]> {
    if (!filters.include_private_bookings) {
      return [];
    }

    let query = this.adminClient
      .from('private_trainer_bookings')
      .select(PRIVATE_BOOKING_RELATIONS_SELECT)
      .is('deleted_at', null)
      .gte('session_date', filters.from_date)
      .lte('session_date', filters.to_date);

    if (filters.trainer_staff_profile_id) {
      query = query.eq(
        'trainer_staff_profile_id',
        filters.trainer_staff_profile_id,
      );
    }

    if (filters.user_id) {
      query = query.eq('user_id', filters.user_id);
    }

    const { data, error } = await query
      .order('session_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      throw mapPrivateBookingRpcError(error);
    }

    return (data ?? []) as unknown as PrivateBookingHydratedRow[];
  }

  async createDomainEvent(
    input: BookingDomainEventPayload,
  ): Promise<BookingDomainEventRecord> {
    const insertPayload: BookingDomainEventInsert = {
      event_type: input.event_type,
      schedule_id: input.schedule_id,
      booking_id: input.booking_id,
      waitlist_id: input.waitlist_id,
      private_booking_id: input.private_booking_id ?? null,
      payload: input.payload,
    };

    const { data, error } = await this.adminClient
      .from('booking_domain_events')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data;
  }

  async listPendingDomainEvents(
    input: ListPendingDomainEventsInput = {},
  ): Promise<readonly BookingDomainEventRow[]> {
    const limit = resolveLimit(input.limit, 50, 100);

    const { data, error } = await this.adminClient
      .from('booking_domain_events')
      .select('*')
      .is('published_at', null)
      .order('created_at', { ascending: true })
      .range(0, resolveRangeEnd(0, limit));

    if (error) {
      throw mapDatabaseError(error);
    }

    return data ?? [];
  }

  async markDomainEventPublished(
    input: MarkDomainEventPublishedInput,
  ): Promise<BookingDomainEventRow> {
    const { data, error } = await this.adminClient
      .from('booking_domain_events')
      .update({
        published_at: input.published_at,
      })
      .eq('id', input.event_id)
      .select('*')
      .single();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data;
  }

  private async insertBookingHistory(
    payload: BookingHistoryInsert,
  ): Promise<BookingHistoryRow> {
    const { data, error } = await this.adminClient
      .from('booking_history')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data;
  }

  private async resolveScheduleIdsByDateRange(
    fromDate: string | null,
    toDate: string | null,
  ): Promise<readonly string[] | null> {
    if (!fromDate && !toDate) {
      return null;
    }

    let query = this.adminClient
      .from('pilates_class_schedules')
      .select('id')
      .is('deleted_at', null);

    if (fromDate) {
      query = query.gte('class_date', fromDate);
    }

    if (toDate) {
      query = query.lte('class_date', toDate);
    }

    const { data, error } = await query;

    if (error) {
      throw mapDatabaseError(error);
    }

    return (data ?? []).map((row) => row.id);
  }

  private async resolveScheduleIdsByCalendarFilters(
    filters: BookingCalendarFilters,
  ): Promise<readonly string[]> {
    let query = this.adminClient
      .from('pilates_class_schedules')
      .select('id')
      .is('deleted_at', null)
      .gte('class_date', filters.from_date)
      .lte('class_date', filters.to_date);

    if (filters.class_id) {
      query = query.eq('class_id', filters.class_id);
    }

    if (filters.trainer_staff_profile_id) {
      query = query.eq(
        'trainer_staff_profile_id',
        filters.trainer_staff_profile_id,
      );
    }

    const { data, error } = await query;

    if (error) {
      throw mapDatabaseError(error);
    }

    return (data ?? []).map((row) => row.id);
  }
}
