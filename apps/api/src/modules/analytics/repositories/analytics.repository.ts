// apps/api/src/modules/analytics/repositories/analytics.repository.ts
/**
 * LAFAM Analytics repository.
 *
 * Role:
 * - Owns read-only database access for Admin Dashboard Analytics.
 * - Reads app users, bookings, private trainer bookings, Pilates schedules,
 *   Pilates classes, staff profiles, payments, wallet accounts, and wallet
 *   ledger entries.
 * - Keeps raw Supabase queries out of Analytics services and controllers.
 *
 * Important:
 * - This repository does not perform authorization.
 * - This repository does not calculate dashboard metrics.
 * - This repository does not mutate database state.
 * - This repository does not call payment, booking, wallet, or schedule mutation
 *   RPC functions.
 * - Services remain responsible for business calculations and response shaping.
 * - Database/provider errors are converted into frontend-safe AppError instances.
 */

import { Inject, Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { SUPABASE_ADMIN_CLIENT } from '../../../database/database.constants';
import type { LAFAMSupabaseClient } from '../../../database/database.types';
import {
  ANALYTICS_ACTIVE_CUSTOMER_STATUSES,
  ANALYTICS_ACTIVE_WALLET_ACCOUNT_STATUSES,
  ANALYTICS_CANCELLED_BOOKING_STATUSES,
  ANALYTICS_CONFIRMED_BOOKING_STATUSES,
  ANALYTICS_CUSTOMER_ROLE,
  ANALYTICS_DEFAULT_CURRENCY,
  ANALYTICS_FAILED_PAYMENT_STATUSES,
  ANALYTICS_NEW_CUSTOMER_STATUSES,
  ANALYTICS_PAID_PAYMENT_STATUSES,
  ANALYTICS_POSTED_WALLET_LEDGER_STATUSES,
  ANALYTICS_RECENT_BOOKING_STATUSES,
  ANALYTICS_REFUNDED_PAYMENT_STATUSES,
  ANALYTICS_TOP_CLASS_BOOKING_STATUSES,
  ANALYTICS_TOTAL_BOOKING_STATUSES,
  ANALYTICS_WALLET_MOVEMENT_ENTRY_TYPES,
} from '../constants/analytics.constants';
import { PILATES_CLASS_SCHEDULE_STATUS_SCHEDULED } from '../../classes/constants/pilates-class.constants';
import type {
  AnalyticsAppUserRecord,
  AnalyticsBookingRecord,
  AnalyticsCustomerCountResult,
  AnalyticsPaymentRecord,
  AnalyticsPilatesClassRecord,
  AnalyticsPilatesScheduleRecord,
  AnalyticsPrivateBookingRecord,
  AnalyticsRepositoryLimitInput,
  AnalyticsRepositoryRangeInput,
  AnalyticsRevenuePaymentRecord,
  AnalyticsStaffProfileRecord,
  AnalyticsTopClassBookingRecord,
  AnalyticsTopClassesInput,
  AnalyticsUpcomingWindowInput,
  AnalyticsWalletAccountBalanceRecord,
  AnalyticsWalletAccountRecord,
  AnalyticsWalletLedgerEntryRecord,
  AnalyticsWalletLedgerMovementRecord,
  AnalyticsWalletMovementInput,
} from '../types/analytics.types';
const ANALYTICS_REPOSITORY_PAGE_SIZE = 500;

const ANALYTICS_REPOSITORY_LOOKUP_CHUNK_SIZE = 100;

const ANALYTICS_REPOSITORY_MAX_UPCOMING_SCHEDULE_LOOKUP_ROWS = 1000;

function mapAnalyticsDatabaseError(error: unknown): AppError {
  return AppError.databaseOperationFailed(error);
}

function resolveTotal(count: number | null): number {
  return count ?? 0;
}

function toMutableArray<TValue extends string>(
  values: readonly TValue[],
): TValue[] {
  return [...values];
}

function uniqueStringValues(
  values: readonly (string | null | undefined)[],
): string[] {
  return Array.from(
    new Set(
      values.filter(
        (value): value is string =>
          typeof value === 'string' && value.trim().length > 0,
      ),
    ),
  );
}

function chunkStringValues(
  values: readonly string[],
  chunkSize: number,
): string[][] {
  const chunks: string[][] = [];

  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }

  return chunks;
}

function mapPaymentToRevenueRecord(
  payment: AnalyticsPaymentRecord,
): AnalyticsRevenuePaymentRecord {
  return {
    id: payment.id,
    target_type: payment.target_type,
    booking_id: payment.booking_id,
    private_booking_id: payment.private_booking_id,
    final_amount: Number(payment.final_amount),
    refunded_amount: Number(payment.refunded_amount),
    currency: ANALYTICS_DEFAULT_CURRENCY,
    status: payment.status,
    payment_method: payment.payment_method,
    payment_provider: payment.payment_provider,
    paid_at: payment.paid_at,
    failed_at: payment.failed_at,
    refunded_at: payment.refunded_at,
    created_at: payment.created_at,
  };
}

function mapWalletAccountToBalanceRecord(
  walletAccount: AnalyticsWalletAccountRecord,
): AnalyticsWalletAccountBalanceRecord {
  return {
    id: walletAccount.id,
    user_id: walletAccount.user_id,
    available_balance: Number(walletAccount.available_balance),
    currency: ANALYTICS_DEFAULT_CURRENCY,
    status: walletAccount.status,
  };
}

function mapWalletLedgerToMovementRecord(
  ledgerEntry: AnalyticsWalletLedgerEntryRecord,
): AnalyticsWalletLedgerMovementRecord {
  return {
    id: ledgerEntry.id,
    wallet_account_id: ledgerEntry.wallet_account_id,
    user_id: ledgerEntry.user_id,
    payment_id: ledgerEntry.payment_id,
    entry_type: ledgerEntry.entry_type,
    entry_status: ledgerEntry.entry_status,
    amount: Number(ledgerEntry.amount),
    currency: ANALYTICS_DEFAULT_CURRENCY,
    created_at: ledgerEntry.created_at,
  };
}

@Injectable()
export class AnalyticsRepository {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly adminClient: LAFAMSupabaseClient,
  ) {}

  async countNewCustomers(
    input: AnalyticsRepositoryRangeInput,
  ): Promise<AnalyticsCustomerCountResult> {
    const { error, count } = await this.adminClient
      .from('app_users')
      .select('id', { count: 'exact', head: true })
      .eq('role', ANALYTICS_CUSTOMER_ROLE)
      .eq('is_guest', false)
      .in('status', toMutableArray(ANALYTICS_NEW_CUSTOMER_STATUSES))
      .is('deleted_at', null)
      .gte('created_at', input.fromTimestamp)
      .lte('created_at', input.toTimestamp);

    if (error) {
      throw mapAnalyticsDatabaseError(error);
    }

    return {
      total: resolveTotal(count),
    };
  }

  async countActiveCustomers(): Promise<AnalyticsCustomerCountResult> {
    const { error, count } = await this.adminClient
      .from('app_users')
      .select('id', { count: 'exact', head: true })
      .eq('role', ANALYTICS_CUSTOMER_ROLE)
      .eq('is_guest', false)
      .in('status', toMutableArray(ANALYTICS_ACTIVE_CUSTOMER_STATUSES))
      .is('deleted_at', null);

    if (error) {
      throw mapAnalyticsDatabaseError(error);
    }

    return {
      total: resolveTotal(count),
    };
  }

  async countClassBookings(
    input: AnalyticsRepositoryRangeInput,
  ): Promise<number> {
    const { error, count } = await this.adminClient
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .in('status', toMutableArray(ANALYTICS_TOTAL_BOOKING_STATUSES))
      .is('deleted_at', null)
      .gte('created_at', input.fromTimestamp)
      .lte('created_at', input.toTimestamp);

    if (error) {
      throw mapAnalyticsDatabaseError(error);
    }

    return resolveTotal(count);
  }

  async countPrivateBookings(
    input: AnalyticsRepositoryRangeInput,
  ): Promise<number> {
    const { error, count } = await this.adminClient
      .from('private_trainer_bookings')
      .select('id', { count: 'exact', head: true })
      .in('status', toMutableArray(ANALYTICS_TOTAL_BOOKING_STATUSES))
      .is('deleted_at', null)
      .gte('created_at', input.fromTimestamp)
      .lte('created_at', input.toTimestamp);

    if (error) {
      throw mapAnalyticsDatabaseError(error);
    }

    return resolveTotal(count);
  }

  async countCancelledClassBookings(
    input: AnalyticsRepositoryRangeInput,
  ): Promise<number> {
    const { error, count } = await this.adminClient
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .in('status', toMutableArray(ANALYTICS_CANCELLED_BOOKING_STATUSES))
      .is('deleted_at', null)
      .not('cancelled_at', 'is', null)
      .gte('cancelled_at', input.fromTimestamp)
      .lte('cancelled_at', input.toTimestamp);

    if (error) {
      throw mapAnalyticsDatabaseError(error);
    }

    return resolveTotal(count);
  }

  async countCancelledPrivateBookings(
    input: AnalyticsRepositoryRangeInput,
  ): Promise<number> {
    const { error, count } = await this.adminClient
      .from('private_trainer_bookings')
      .select('id', { count: 'exact', head: true })
      .in('status', toMutableArray(ANALYTICS_CANCELLED_BOOKING_STATUSES))
      .is('deleted_at', null)
      .not('cancelled_at', 'is', null)
      .gte('cancelled_at', input.fromTimestamp)
      .lte('cancelled_at', input.toTimestamp);

    if (error) {
      throw mapAnalyticsDatabaseError(error);
    }

    return resolveTotal(count);
  }

  async listPaidPaymentsInRange(
    input: AnalyticsRepositoryRangeInput,
  ): Promise<AnalyticsRevenuePaymentRecord[]> {
    const records: AnalyticsRevenuePaymentRecord[] = [];
    let offset = 0;

    while (true) {
      const { data, error } = await this.adminClient
        .from('payments')
        .select('*')
        .eq('currency', ANALYTICS_DEFAULT_CURRENCY)
        .not('paid_at', 'is', null)
        .gte('paid_at', input.fromTimestamp)
        .lte('paid_at', input.toTimestamp)
        .in('status', toMutableArray(ANALYTICS_PAID_PAYMENT_STATUSES))
        .order('paid_at', { ascending: true })
        .range(offset, offset + ANALYTICS_REPOSITORY_PAGE_SIZE - 1);

      if (error) {
        throw mapAnalyticsDatabaseError(error);
      }

      const pageRecords = data ?? [];
      records.push(...pageRecords.map(mapPaymentToRevenueRecord));

      if (pageRecords.length < ANALYTICS_REPOSITORY_PAGE_SIZE) {
        break;
      }

      offset += ANALYTICS_REPOSITORY_PAGE_SIZE;
    }

    return records;
  }

  async listRefundedPaymentsInRange(
    input: AnalyticsRepositoryRangeInput,
  ): Promise<AnalyticsRevenuePaymentRecord[]> {
    const records: AnalyticsRevenuePaymentRecord[] = [];
    let offset = 0;

    while (true) {
      const { data, error } = await this.adminClient
        .from('payments')
        .select('*')
        .eq('currency', ANALYTICS_DEFAULT_CURRENCY)
        .not('refunded_at', 'is', null)
        .gte('refunded_at', input.fromTimestamp)
        .lte('refunded_at', input.toTimestamp)
        .in('status', toMutableArray(ANALYTICS_REFUNDED_PAYMENT_STATUSES))
        .order('refunded_at', { ascending: true })
        .range(offset, offset + ANALYTICS_REPOSITORY_PAGE_SIZE - 1);

      if (error) {
        throw mapAnalyticsDatabaseError(error);
      }

      const pageRecords = data ?? [];
      records.push(...pageRecords.map(mapPaymentToRevenueRecord));

      if (pageRecords.length < ANALYTICS_REPOSITORY_PAGE_SIZE) {
        break;
      }

      offset += ANALYTICS_REPOSITORY_PAGE_SIZE;
    }

    return records;
  }

  async listFailedPaymentsInRange(
    input: AnalyticsRepositoryRangeInput,
  ): Promise<AnalyticsRevenuePaymentRecord[]> {
    const records: AnalyticsRevenuePaymentRecord[] = [];
    let offset = 0;

    while (true) {
      const { data, error } = await this.adminClient
        .from('payments')
        .select('*')
        .eq('currency', ANALYTICS_DEFAULT_CURRENCY)
        .not('failed_at', 'is', null)
        .gte('failed_at', input.fromTimestamp)
        .lte('failed_at', input.toTimestamp)
        .in('status', toMutableArray(ANALYTICS_FAILED_PAYMENT_STATUSES))
        .order('failed_at', { ascending: true })
        .range(offset, offset + ANALYTICS_REPOSITORY_PAGE_SIZE - 1);

      if (error) {
        throw mapAnalyticsDatabaseError(error);
      }

      const pageRecords = data ?? [];
      records.push(...pageRecords.map(mapPaymentToRevenueRecord));

      if (pageRecords.length < ANALYTICS_REPOSITORY_PAGE_SIZE) {
        break;
      }

      offset += ANALYTICS_REPOSITORY_PAGE_SIZE;
    }

    return records;
  }

  async listUpcomingClassBookingRecords(
    input: AnalyticsUpcomingWindowInput,
  ): Promise<AnalyticsBookingRecord[]> {
    const schedules = await this.listUpcomingClassScheduleRecords(input);

    const scheduleIds = uniqueStringValues(
      schedules.map((schedule) => schedule.id),
    );

    if (scheduleIds.length === 0) {
      return [];
    }

    const records: AnalyticsBookingRecord[] = [];

    for (const scheduleIdChunk of chunkStringValues(
      scheduleIds,
      ANALYTICS_REPOSITORY_LOOKUP_CHUNK_SIZE,
    )) {
      const { data, error } = await this.adminClient
        .from('bookings')
        .select('*')
        .in('schedule_id', scheduleIdChunk)
        .in('status', toMutableArray(ANALYTICS_CONFIRMED_BOOKING_STATUSES))
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (error) {
        throw mapAnalyticsDatabaseError(error);
      }

      records.push(...(data ?? []));
    }

    return records;
  }

  async listUpcomingPrivateBookingRecords(
    input: AnalyticsUpcomingWindowInput,
  ): Promise<AnalyticsPrivateBookingRecord[]> {
    const { data, error } = await this.adminClient
      .from('private_trainer_bookings')
      .select('*')
      .in('status', toMutableArray(ANALYTICS_CONFIRMED_BOOKING_STATUSES))
      .is('deleted_at', null)
      .gte('session_date', input.fromDate)
      .lte('session_date', input.toDate)
      .order('session_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(input.limit);

    if (error) {
      throw mapAnalyticsDatabaseError(error);
    }

    return data ?? [];
  }

  async listRecentClassBookingRecords(
    input: AnalyticsRepositoryLimitInput,
  ): Promise<AnalyticsBookingRecord[]> {
    const { data, error } = await this.adminClient
      .from('bookings')
      .select('*')
      .in('status', toMutableArray(ANALYTICS_RECENT_BOOKING_STATUSES))
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(input.limit);

    if (error) {
      throw mapAnalyticsDatabaseError(error);
    }

    return data ?? [];
  }

  async listRecentPrivateBookingRecords(
    input: AnalyticsRepositoryLimitInput,
  ): Promise<AnalyticsPrivateBookingRecord[]> {
    const { data, error } = await this.adminClient
      .from('private_trainer_bookings')
      .select('*')
      .in('status', toMutableArray(ANALYTICS_RECENT_BOOKING_STATUSES))
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(input.limit);

    if (error) {
      throw mapAnalyticsDatabaseError(error);
    }

    return data ?? [];
  }

  async listTopClassBookingRecords(
    input: AnalyticsTopClassesInput,
  ): Promise<AnalyticsTopClassBookingRecord[]> {
    const records: AnalyticsTopClassBookingRecord[] = [];
    let offset = 0;

    while (true) {
      const { data, error } = await this.adminClient
        .from('bookings')
        .select('id, class_id')
        .in('status', toMutableArray(ANALYTICS_TOP_CLASS_BOOKING_STATUSES))
        .is('deleted_at', null)
        .gte('created_at', input.fromTimestamp)
        .lte('created_at', input.toTimestamp)
        .order('created_at', { ascending: true })
        .range(offset, offset + ANALYTICS_REPOSITORY_PAGE_SIZE - 1);

      if (error) {
        throw mapAnalyticsDatabaseError(error);
      }

      const pageRecords = data ?? [];

      records.push(
        ...pageRecords.map((booking) => ({
          booking_id: booking.id,
          class_id: booking.class_id,
        })),
      );

      if (pageRecords.length < ANALYTICS_REPOSITORY_PAGE_SIZE) {
        break;
      }

      offset += ANALYTICS_REPOSITORY_PAGE_SIZE;
    }

    return records;
  }

  async listPaymentsByBookingIds(
    bookingIds: readonly string[],
  ): Promise<AnalyticsRevenuePaymentRecord[]> {
    const uniqueBookingIds = uniqueStringValues(bookingIds);

    if (uniqueBookingIds.length === 0) {
      return [];
    }

    const records: AnalyticsRevenuePaymentRecord[] = [];

    for (const bookingIdChunk of chunkStringValues(
      uniqueBookingIds,
      ANALYTICS_REPOSITORY_LOOKUP_CHUNK_SIZE,
    )) {
      const { data, error } = await this.adminClient
        .from('payments')
        .select('*')
        .eq('currency', ANALYTICS_DEFAULT_CURRENCY)
        .in('booking_id', bookingIdChunk)
        .order('created_at', { ascending: true });

      if (error) {
        throw mapAnalyticsDatabaseError(error);
      }

      records.push(...(data ?? []).map(mapPaymentToRevenueRecord));
    }

    return records;
  }

  async listAppUsersByIds(
    userIds: readonly string[],
  ): Promise<AnalyticsAppUserRecord[]> {
    const uniqueUserIds = uniqueStringValues(userIds);

    if (uniqueUserIds.length === 0) {
      return [];
    }

    const records: AnalyticsAppUserRecord[] = [];

    for (const userIdChunk of chunkStringValues(
      uniqueUserIds,
      ANALYTICS_REPOSITORY_LOOKUP_CHUNK_SIZE,
    )) {
      const { data, error } = await this.adminClient
        .from('app_users')
        .select('*')
        .in('id', userIdChunk);

      if (error) {
        throw mapAnalyticsDatabaseError(error);
      }

      records.push(...(data ?? []));
    }

    return records;
  }

  async listPilatesSchedulesByIds(
    scheduleIds: readonly string[],
  ): Promise<AnalyticsPilatesScheduleRecord[]> {
    const uniqueScheduleIds = uniqueStringValues(scheduleIds);

    if (uniqueScheduleIds.length === 0) {
      return [];
    }

    const records: AnalyticsPilatesScheduleRecord[] = [];

    for (const scheduleIdChunk of chunkStringValues(
      uniqueScheduleIds,
      ANALYTICS_REPOSITORY_LOOKUP_CHUNK_SIZE,
    )) {
      const { data, error } = await this.adminClient
        .from('pilates_class_schedules')
        .select('*')
        .in('id', scheduleIdChunk);

      if (error) {
        throw mapAnalyticsDatabaseError(error);
      }

      records.push(...(data ?? []));
    }

    return records;
  }

  async listPilatesClassesByIds(
    classIds: readonly string[],
  ): Promise<AnalyticsPilatesClassRecord[]> {
    const uniqueClassIds = uniqueStringValues(classIds);

    if (uniqueClassIds.length === 0) {
      return [];
    }

    const records: AnalyticsPilatesClassRecord[] = [];

    for (const classIdChunk of chunkStringValues(
      uniqueClassIds,
      ANALYTICS_REPOSITORY_LOOKUP_CHUNK_SIZE,
    )) {
      const { data, error } = await this.adminClient
        .from('pilates_classes')
        .select('*')
        .in('id', classIdChunk);

      if (error) {
        throw mapAnalyticsDatabaseError(error);
      }

      records.push(...(data ?? []));
    }

    return records;
  }

  async listStaffProfilesByIds(
    staffProfileIds: readonly string[],
  ): Promise<AnalyticsStaffProfileRecord[]> {
    const uniqueStaffProfileIds = uniqueStringValues(staffProfileIds);

    if (uniqueStaffProfileIds.length === 0) {
      return [];
    }

    const records: AnalyticsStaffProfileRecord[] = [];

    for (const staffProfileIdChunk of chunkStringValues(
      uniqueStaffProfileIds,
      ANALYTICS_REPOSITORY_LOOKUP_CHUNK_SIZE,
    )) {
      const { data, error } = await this.adminClient
        .from('staff_profiles')
        .select('*')
        .in('id', staffProfileIdChunk);

      if (error) {
        throw mapAnalyticsDatabaseError(error);
      }

      records.push(...(data ?? []));
    }

    return records;
  }

  async listActiveWalletAccountBalances(): Promise<
    AnalyticsWalletAccountBalanceRecord[]
  > {
    const records: AnalyticsWalletAccountBalanceRecord[] = [];
    let offset = 0;

    while (true) {
      const { data, error } = await this.adminClient
        .from('wallet_accounts')
        .select('*')
        .eq('currency', ANALYTICS_DEFAULT_CURRENCY)
        .in('status', toMutableArray(ANALYTICS_ACTIVE_WALLET_ACCOUNT_STATUSES))
        .order('created_at', { ascending: true })
        .range(offset, offset + ANALYTICS_REPOSITORY_PAGE_SIZE - 1);

      if (error) {
        throw mapAnalyticsDatabaseError(error);
      }

      const pageRecords = data ?? [];
      records.push(...pageRecords.map(mapWalletAccountToBalanceRecord));

      if (pageRecords.length < ANALYTICS_REPOSITORY_PAGE_SIZE) {
        break;
      }

      offset += ANALYTICS_REPOSITORY_PAGE_SIZE;
    }

    return records;
  }

  async listWalletLedgerMovements(
    input: AnalyticsWalletMovementInput,
  ): Promise<AnalyticsWalletLedgerMovementRecord[]> {
    const records: AnalyticsWalletLedgerMovementRecord[] = [];
    let offset = 0;

    while (true) {
      const { data, error } = await this.adminClient
        .from('wallet_ledger_entries')
        .select('*')
        .in(
          'entry_status',
          toMutableArray(ANALYTICS_POSTED_WALLET_LEDGER_STATUSES),
        )
        .in('entry_type', toMutableArray(ANALYTICS_WALLET_MOVEMENT_ENTRY_TYPES))
        .gte('created_at', input.fromTimestamp)
        .lte('created_at', input.toTimestamp)
        .order('created_at', { ascending: true })
        .range(offset, offset + ANALYTICS_REPOSITORY_PAGE_SIZE - 1);

      if (error) {
        throw mapAnalyticsDatabaseError(error);
      }

      const pageRecords = data ?? [];
      records.push(...pageRecords.map(mapWalletLedgerToMovementRecord));

      if (pageRecords.length < ANALYTICS_REPOSITORY_PAGE_SIZE) {
        break;
      }

      offset += ANALYTICS_REPOSITORY_PAGE_SIZE;
    }

    return records;
  }

  private async listUpcomingClassScheduleRecords(
    input: AnalyticsUpcomingWindowInput,
  ): Promise<AnalyticsPilatesScheduleRecord[]> {
    const { data, error } = await this.adminClient
      .from('pilates_class_schedules')
      .select('*')
      .eq('status', PILATES_CLASS_SCHEDULE_STATUS_SCHEDULED)
      .is('deleted_at', null)
      .gte('class_date', input.fromDate)
      .lte('class_date', input.toDate)
      .order('class_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(ANALYTICS_REPOSITORY_MAX_UPCOMING_SCHEDULE_LOOKUP_ROWS);

    if (error) {
      throw mapAnalyticsDatabaseError(error);
    }

    return data ?? [];
  }
}
