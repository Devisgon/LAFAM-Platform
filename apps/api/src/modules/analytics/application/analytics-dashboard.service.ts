// apps/api/src/modules/analytics/application/analytics-dashboard.service.ts
/**
 * LAFAM Analytics dashboard service.
 *
 * Role:
 * - Owns Admin Dashboard Analytics calculation rules.
 * - Validates dashboard date-range business limits.
 * - Calculates summary cards, weekly revenue chart, payment summary,
 *   upcoming bookings, recent bookings, top Pilates classes, optional wallet
 *   summary, and optional calendar events.
 *
 * Important:
 * - This service is read-only.
 * - This service does not mutate bookings, payments, wallets, users, classes,
 *   schedules, or staff.
 * - Repository owns database reads.
 * - Service owns metric calculation and response shaping.
 * - Controller owns route exposure and authorization guards.
 * - Revenue is calculated from payment records.
 * - Booking counts are calculated from booking records.
 * - User metrics are calculated from app_users records.
 * - Calendar events reuse the existing BookingCalendarService.
 */

import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { BookingCalendarService } from '../../bookings/application/booking-calendar.service';
import type { ListAdminCalendarQueryDto } from '../../bookings/dto/list-admin-calendar-query.dto';
import {
  ANALYTICS_CALENDAR_INCLUDE_CLASS_BOOKINGS,
  ANALYTICS_CALENDAR_INCLUDE_CLASS_SCHEDULES,
  ANALYTICS_CALENDAR_INCLUDE_PRIVATE_BOOKINGS,
  ANALYTICS_CALENDAR_INCLUDE_WAITLIST,
  ANALYTICS_DATE_TIME_END_OF_DAY_TIME,
  ANALYTICS_DATE_TIME_START_OF_DAY_TIME,
  ANALYTICS_DEFAULT_CALENDAR_EVENT_LIMIT,
  ANALYTICS_DEFAULT_CURRENCY,
  ANALYTICS_DEFAULT_RECENT_LIMIT,
  ANALYTICS_DEFAULT_REVENUE_GRANULARITY,
  ANALYTICS_DEFAULT_TOP_SERVICES_LIMIT,
  ANALYTICS_DEFAULT_UPCOMING_DAYS,
  ANALYTICS_ISO_DATE_PATTERN,
  ANALYTICS_MAX_RANGE_DAYS,
  ANALYTICS_WALLET_BOOKING_DEBIT_ENTRY_TYPES,
  ANALYTICS_WALLET_PRIVATE_BOOKING_DEBIT_ENTRY_TYPES,
  ANALYTICS_WALLET_REFUND_CREDIT_ENTRY_TYPES,
  ANALYTICS_WALLET_TOP_UP_ENTRY_TYPES,
  ANALYTICS_WEEK_START_DAY,
} from '../constants/analytics.constants';
import type { AnalyticsDashboardQueryDto } from '../dto/analytics-dashboard-query.dto';
import { AnalyticsRepository } from '../repositories/analytics.repository';
import type {
  AnalyticsAppUserRecord,
  AnalyticsBookingClassSnapshot,
  AnalyticsBookingCustomerSnapshot,
  AnalyticsBookingFeedMergeInput,
  AnalyticsBookingListItem,
  AnalyticsBookingRecord,
  AnalyticsBookingScheduleSnapshot,
  AnalyticsBookingTrainerSnapshot,
  AnalyticsCalendarEvent,
  AnalyticsDashboardQuery,
  AnalyticsDashboardResponse,
  AnalyticsDateRange,
  AnalyticsDateTimeRange,
  AnalyticsIsoDate,
  AnalyticsMoneyAmount,
  AnalyticsPaymentSummary,
  AnalyticsPilatesClassRecord,
  AnalyticsPilatesScheduleRecord,
  AnalyticsPrivateBookingRecord,
  AnalyticsRevenuePaymentRecord,
  AnalyticsRevenueSummary,
  AnalyticsRevenueWeekPoint,
  AnalyticsStaffProfileRecord,
  AnalyticsTopServiceItem,
  AnalyticsWalletAccountBalanceRecord,
  AnalyticsWalletLedgerMovementRecord,
  AnalyticsWalletSummary,
} from '../types/analytics.types';

const ANALYTICS_MONEY_DECIMAL_FACTOR = 1000;

interface DashboardDateContext {
  readonly range: AnalyticsDateRange;
  readonly timestampRange: AnalyticsDateTimeRange;
}

interface BookingHydrationMaps {
  readonly usersById: ReadonlyMap<string, AnalyticsAppUserRecord>;
  readonly schedulesById: ReadonlyMap<string, AnalyticsPilatesScheduleRecord>;
  readonly classesById: ReadonlyMap<string, AnalyticsPilatesClassRecord>;
  readonly staffById: ReadonlyMap<string, AnalyticsStaffProfileRecord>;
}

interface MutableRevenueWeekBucket {
  readonly week_start: AnalyticsIsoDate;
  readonly week_end: AnalyticsIsoDate;
  gross_revenue: AnalyticsMoneyAmount;
  refund_amount: AnalyticsMoneyAmount;
  net_revenue: AnalyticsMoneyAmount;
  paid_payment_count: number;
  refund_count: number;
  readonly currency: typeof ANALYTICS_DEFAULT_CURRENCY;
}

interface TopClassAccumulator {
  readonly class_id: string;
  title: string;
  level: AnalyticsTopServiceItem['level'];
  booking_count: number;
  gross_revenue: number;
  refund_amount: number;
}

function normalizeMoney(amount: number): number {
  return (
    Math.round((amount + Number.EPSILON) * ANALYTICS_MONEY_DECIMAL_FACTOR) /
    ANALYTICS_MONEY_DECIMAL_FACTOR
  );
}

function sumMoney(values: readonly number[]): number {
  return normalizeMoney(
    values.reduce((total, value) => total + Number(value || 0), 0),
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getSourceString(source: unknown, key: string): string | null {
  if (!isPlainRecord(source)) {
    return null;
  }

  const value = source[key];

  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();

  return normalizedValue.length > 0 ? normalizedValue : null;
}

function hasStringValue(values: readonly string[], value: string): boolean {
  return values.some((item) => item === value);
}

function createRecordMap<TRecord extends { readonly id: string }>(
  records: readonly TRecord[],
): ReadonlyMap<string, TRecord> {
  return new Map(records.map((record) => [record.id, record]));
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

function normalizeTimeForTimestamp(timeValue: string | null): string | null {
  if (!timeValue) {
    return null;
  }

  const [hour, minute, second = '00'] = timeValue.split(':');

  if (!hour || !minute) {
    return null;
  }

  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second
    .slice(0, 2)
    .padStart(2, '0')}`;
}

function buildSortTimestamp(
  dateValue: string | null,
  timeValue: string | null,
): string | null {
  const normalizedTime = normalizeTimeForTimestamp(timeValue);

  if (!dateValue || !normalizedTime) {
    return null;
  }

  return `${dateValue}T${normalizedTime}.000Z`;
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, 'en', {
    sensitivity: 'base',
    numeric: true,
  });
}

function assertValidIsoDate(
  value: string,
  fieldName: string,
): AnalyticsIsoDate {
  if (!ANALYTICS_ISO_DATE_PATTERN.test(value)) {
    throw AppError.validationFailed(
      `${fieldName} must use YYYY-MM-DD format.`,
      {
        [fieldName]: value,
      },
    );
  }

  const parsedDate = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    throw AppError.validationFailed(`${fieldName} must be a valid date.`, {
      [fieldName]: value,
    });
  }

  const normalizedDate = parsedDate.toISOString().slice(0, 10);

  if (normalizedDate !== value) {
    throw AppError.validationFailed(
      `${fieldName} must be a real calendar date.`,
      {
        [fieldName]: value,
      },
    );
  }

  return value;
}

function parseIsoDate(value: AnalyticsIsoDate): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function formatIsoDate(date: Date): AnalyticsIsoDate {
  return date.toISOString().slice(0, 10);
}

function addDays(value: AnalyticsIsoDate, days: number): AnalyticsIsoDate {
  const date = parseIsoDate(value);
  date.setUTCDate(date.getUTCDate() + days);

  return formatIsoDate(date);
}

function differenceInDaysInclusive(
  fromDate: AnalyticsIsoDate,
  toDate: AnalyticsIsoDate,
): number {
  const fromTime = parseIsoDate(fromDate).getTime();
  const toTime = parseIsoDate(toDate).getTime();
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.floor((toTime - fromTime) / millisecondsPerDay) + 1;
}

function getTodayIsoDate(): AnalyticsIsoDate {
  return formatIsoDate(new Date());
}

function resolveWeekStart(value: AnalyticsIsoDate): AnalyticsIsoDate {
  const date = parseIsoDate(value);
  const currentDay = date.getUTCDay();
  const offset = (currentDay - ANALYTICS_WEEK_START_DAY + 7) % 7;

  date.setUTCDate(date.getUTCDate() - offset);

  return formatIsoDate(date);
}

function buildTimestampRange(
  range: AnalyticsDateRange,
): AnalyticsDateTimeRange {
  return {
    from_timestamp: `${range.from_date}T${ANALYTICS_DATE_TIME_START_OF_DAY_TIME}Z`,
    to_timestamp: `${range.to_date}T${ANALYTICS_DATE_TIME_END_OF_DAY_TIME}Z`,
  };
}

@Injectable()
export class AnalyticsDashboardService {
  constructor(
    private readonly analyticsRepository: AnalyticsRepository,
    private readonly bookingCalendarService: BookingCalendarService,
  ) {}

  async getDashboard(
    dto: AnalyticsDashboardQueryDto,
  ): Promise<AnalyticsDashboardResponse> {
    const query = this.normalizeDashboardQuery(dto);
    const dateContext = this.buildDateContext(query);
    const generatedAt = new Date().toISOString();
    const upcomingWindow = this.buildUpcomingWindow(query);

    const [
      newCustomers,
      activeCustomers,
      classBookingCount,
      privateBookingCount,
      cancelledClassBookingCount,
      cancelledPrivateBookingCount,
      paidPayments,
      refundedPayments,
      failedPayments,
      upcomingClassBookings,
      upcomingPrivateBookings,
      recentClassBookings,
      recentPrivateBookings,
      topClassBookingRecords,
      walletSummary,
      calendarEvents,
    ] = await Promise.all([
      this.analyticsRepository.countNewCustomers({
        fromTimestamp: dateContext.timestampRange.from_timestamp,
        toTimestamp: dateContext.timestampRange.to_timestamp,
      }),
      this.analyticsRepository.countActiveCustomers(),
      this.analyticsRepository.countClassBookings({
        fromTimestamp: dateContext.timestampRange.from_timestamp,
        toTimestamp: dateContext.timestampRange.to_timestamp,
      }),
      this.analyticsRepository.countPrivateBookings({
        fromTimestamp: dateContext.timestampRange.from_timestamp,
        toTimestamp: dateContext.timestampRange.to_timestamp,
      }),
      this.analyticsRepository.countCancelledClassBookings({
        fromTimestamp: dateContext.timestampRange.from_timestamp,
        toTimestamp: dateContext.timestampRange.to_timestamp,
      }),
      this.analyticsRepository.countCancelledPrivateBookings({
        fromTimestamp: dateContext.timestampRange.from_timestamp,
        toTimestamp: dateContext.timestampRange.to_timestamp,
      }),
      this.analyticsRepository.listPaidPaymentsInRange({
        fromTimestamp: dateContext.timestampRange.from_timestamp,
        toTimestamp: dateContext.timestampRange.to_timestamp,
      }),
      this.analyticsRepository.listRefundedPaymentsInRange({
        fromTimestamp: dateContext.timestampRange.from_timestamp,
        toTimestamp: dateContext.timestampRange.to_timestamp,
      }),
      this.analyticsRepository.listFailedPaymentsInRange({
        fromTimestamp: dateContext.timestampRange.from_timestamp,
        toTimestamp: dateContext.timestampRange.to_timestamp,
      }),
      this.analyticsRepository.listUpcomingClassBookingRecords(upcomingWindow),
      this.analyticsRepository.listUpcomingPrivateBookingRecords(
        upcomingWindow,
      ),
      this.analyticsRepository.listRecentClassBookingRecords({
        limit: query.recent_limit,
      }),
      this.analyticsRepository.listRecentPrivateBookingRecords({
        limit: query.recent_limit,
      }),
      this.analyticsRepository.listTopClassBookingRecords({
        fromTimestamp: dateContext.timestampRange.from_timestamp,
        toTimestamp: dateContext.timestampRange.to_timestamp,
        limit: query.top_services_limit,
      }),
      query.include_wallet_summary
        ? this.buildWalletSummary(dateContext.timestampRange)
        : Promise.resolve(null),
      query.include_calendar_events
        ? this.buildCalendarEvents(query)
        : Promise.resolve(null),
    ]);

    const revenueSummary = this.buildRevenueSummary(
      paidPayments,
      refundedPayments,
    );
    const paymentSummary = this.buildPaymentSummary(
      paidPayments,
      refundedPayments,
      failedPayments,
    );

    const [upcomingBookings, recentBookings, topServices] = await Promise.all([
      this.buildBookingFeed({
        classBookings: upcomingClassBookings,
        privateBookings: upcomingPrivateBookings,
        limit: query.recent_limit,
        sortDirection: 'asc',
      }),
      this.buildBookingFeed({
        classBookings: recentClassBookings,
        privateBookings: recentPrivateBookings,
        limit: query.recent_limit,
        sortDirection: 'desc',
      }),
      this.buildTopServices(
        topClassBookingRecords,
        paidPayments,
        refundedPayments,
        query.top_services_limit,
      ),
    ]);

    return {
      dashboard: {
        range: {
          from_date: dateContext.range.from_date,
          to_date: dateContext.range.to_date,
          revenue_granularity: ANALYTICS_DEFAULT_REVENUE_GRANULARITY,
        },
        summary: {
          total_revenue: revenueSummary.net_revenue,
          total_bookings: classBookingCount + privateBookingCount,
          new_customers: newCustomers.total,
          cancelled_bookings:
            cancelledClassBookingCount + cancelledPrivateBookingCount,
          active_users: activeCustomers.total,
          currency: ANALYTICS_DEFAULT_CURRENCY,
        },
        revenue_overview: this.buildWeeklyRevenueOverview(
          paidPayments,
          refundedPayments,
          dateContext.range,
        ),
        payment_summary: paymentSummary,
        upcoming_bookings: upcomingBookings,
        recent_bookings: recentBookings,
        top_services: topServices,
        wallet_summary: walletSummary,
        calendar_events: calendarEvents,
        generated_at: generatedAt,
      },
    };
  }

  private normalizeDashboardQuery(
    dto: AnalyticsDashboardQueryDto,
  ): AnalyticsDashboardQuery {
    return {
      from_date: dto.from_date,
      to_date: dto.to_date,
      upcoming_days: dto.upcoming_days ?? ANALYTICS_DEFAULT_UPCOMING_DAYS,
      recent_limit: dto.recent_limit ?? ANALYTICS_DEFAULT_RECENT_LIMIT,
      top_services_limit:
        dto.top_services_limit ?? ANALYTICS_DEFAULT_TOP_SERVICES_LIMIT,
      include_wallet_summary: dto.include_wallet_summary ?? false,
      include_calendar_events: dto.include_calendar_events ?? false,
    };
  }

  private buildDateContext(
    query: AnalyticsDashboardQuery,
  ): DashboardDateContext {
    const fromDate = assertValidIsoDate(query.from_date, 'from_date');
    const toDate = assertValidIsoDate(query.to_date, 'to_date');

    if (fromDate > toDate) {
      throw AppError.validationFailed('from_date cannot be after to_date.', {
        from_date: fromDate,
        to_date: toDate,
      });
    }

    const rangeDays = differenceInDaysInclusive(fromDate, toDate);

    if (rangeDays > ANALYTICS_MAX_RANGE_DAYS) {
      throw AppError.validationFailed(
        `Analytics date range must not exceed ${ANALYTICS_MAX_RANGE_DAYS} days.`,
        {
          from_date: fromDate,
          to_date: toDate,
          max_range_days: ANALYTICS_MAX_RANGE_DAYS,
          received_range_days: rangeDays,
        },
      );
    }

    const range = {
      from_date: fromDate,
      to_date: toDate,
    };

    return {
      range,
      timestampRange: buildTimestampRange(range),
    };
  }

  private buildUpcomingWindow(query: AnalyticsDashboardQuery): {
    readonly fromDate: AnalyticsIsoDate;
    readonly toDate: AnalyticsIsoDate;
    readonly limit: number;
  } {
    const fromDate = getTodayIsoDate();
    const toDate = addDays(fromDate, Math.max(query.upcoming_days - 1, 0));

    return {
      fromDate,
      toDate,
      limit: query.recent_limit,
    };
  }

  private buildRevenueSummary(
    paidPayments: readonly AnalyticsRevenuePaymentRecord[],
    refundedPayments: readonly AnalyticsRevenuePaymentRecord[],
  ): AnalyticsRevenueSummary {
    const grossRevenue = sumMoney(
      paidPayments.map((payment) => payment.final_amount),
    );
    const refundAmount = sumMoney(
      refundedPayments.map((payment) => payment.refunded_amount),
    );

    return {
      gross_revenue: grossRevenue,
      refund_amount: refundAmount,
      net_revenue: normalizeMoney(grossRevenue - refundAmount),
      currency: ANALYTICS_DEFAULT_CURRENCY,
    };
  }

  private buildPaymentSummary(
    paidPayments: readonly AnalyticsRevenuePaymentRecord[],
    refundedPayments: readonly AnalyticsRevenuePaymentRecord[],
    failedPayments: readonly AnalyticsRevenuePaymentRecord[],
  ): AnalyticsPaymentSummary {
    return {
      paid_count: paidPayments.length,
      failed_count: failedPayments.length,
      refunded_count: refundedPayments.length,
      refund_amount: sumMoney(
        refundedPayments.map((payment) => payment.refunded_amount),
      ),
      currency: ANALYTICS_DEFAULT_CURRENCY,
    };
  }

  private buildWeeklyRevenueOverview(
    paidPayments: readonly AnalyticsRevenuePaymentRecord[],
    refundedPayments: readonly AnalyticsRevenuePaymentRecord[],
    range: AnalyticsDateRange,
  ): AnalyticsRevenueWeekPoint[] {
    const buckets = new Map<string, MutableRevenueWeekBucket>();

    let weekStart = resolveWeekStart(range.from_date);
    const lastWeekStart = resolveWeekStart(range.to_date);

    while (weekStart <= lastWeekStart) {
      const weekEnd = addDays(weekStart, 6);

      buckets.set(weekStart, {
        week_start: weekStart,
        week_end: weekEnd,
        gross_revenue: 0,
        refund_amount: 0,
        net_revenue: 0,
        paid_payment_count: 0,
        refund_count: 0,
        currency: ANALYTICS_DEFAULT_CURRENCY,
      });

      weekStart = addDays(weekStart, 7);
    }

    for (const payment of paidPayments) {
      if (!payment.paid_at) {
        continue;
      }

      const paymentDate = payment.paid_at.slice(0, 10);
      const paymentWeekStart = resolveWeekStart(paymentDate);
      const bucket = buckets.get(paymentWeekStart);

      if (!bucket) {
        continue;
      }

      bucket.gross_revenue = normalizeMoney(
        bucket.gross_revenue + payment.final_amount,
      );
      bucket.paid_payment_count += 1;
    }

    for (const payment of refundedPayments) {
      if (!payment.refunded_at) {
        continue;
      }

      const refundDate = payment.refunded_at.slice(0, 10);
      const refundWeekStart = resolveWeekStart(refundDate);
      const bucket = buckets.get(refundWeekStart);

      if (!bucket) {
        continue;
      }

      bucket.refund_amount = normalizeMoney(
        bucket.refund_amount + payment.refunded_amount,
      );
      bucket.refund_count += 1;
    }

    return Array.from(buckets.values()).map((bucket) => ({
      week_start: bucket.week_start,
      week_end: bucket.week_end,
      gross_revenue: normalizeMoney(bucket.gross_revenue),
      refund_amount: normalizeMoney(bucket.refund_amount),
      net_revenue: normalizeMoney(bucket.gross_revenue - bucket.refund_amount),
      paid_payment_count: bucket.paid_payment_count,
      refund_count: bucket.refund_count,
      currency: ANALYTICS_DEFAULT_CURRENCY,
    }));
  }

  private async buildBookingFeed(input: {
    readonly classBookings: readonly AnalyticsBookingRecord[];
    readonly privateBookings: readonly AnalyticsPrivateBookingRecord[];
    readonly limit: number;
    readonly sortDirection: 'asc' | 'desc';
  }): Promise<readonly AnalyticsBookingListItem[]> {
    const [classItems, privateItems] = await Promise.all([
      this.buildClassBookingItems(input.classBookings),
      this.buildPrivateBookingItems(input.privateBookings),
    ]);

    return this.mergeBookingFeeds({
      classBookings: classItems,
      privateBookings: privateItems,
      limit: input.limit,
      sortDirection: input.sortDirection,
    });
  }

  private async buildClassBookingItems(
    bookings: readonly AnalyticsBookingRecord[],
  ): Promise<AnalyticsBookingListItem[]> {
    if (bookings.length === 0) {
      return [];
    }

    const userIds = uniqueStringValues(
      bookings.map((booking) => booking.user_id),
    );
    const scheduleIds = uniqueStringValues(
      bookings.map((booking) => booking.schedule_id),
    );
    const classIds = uniqueStringValues(
      bookings.map((booking) => booking.class_id),
    );
    const trainerIds = uniqueStringValues(
      bookings.map((booking) => booking.trainer_staff_profile_id),
    );

    const [users, schedules, classes, staff] = await Promise.all([
      this.analyticsRepository.listAppUsersByIds(userIds),
      this.analyticsRepository.listPilatesSchedulesByIds(scheduleIds),
      this.analyticsRepository.listPilatesClassesByIds(classIds),
      this.analyticsRepository.listStaffProfilesByIds(trainerIds),
    ]);

    const maps: BookingHydrationMaps = {
      usersById: createRecordMap(users),
      schedulesById: createRecordMap(schedules),
      classesById: createRecordMap(classes),
      staffById: createRecordMap(staff),
    };

    return bookings.map((booking) =>
      this.toClassBookingListItem(booking, maps),
    );
  }

  private async buildPrivateBookingItems(
    bookings: readonly AnalyticsPrivateBookingRecord[],
  ): Promise<AnalyticsBookingListItem[]> {
    if (bookings.length === 0) {
      return [];
    }

    const userIds = uniqueStringValues(
      bookings.map((booking) => booking.user_id),
    );
    const trainerIds = uniqueStringValues(
      bookings.map((booking) => booking.trainer_staff_profile_id),
    );

    const [users, staff] = await Promise.all([
      this.analyticsRepository.listAppUsersByIds(userIds),
      this.analyticsRepository.listStaffProfilesByIds(trainerIds),
    ]);

    const maps: BookingHydrationMaps = {
      usersById: createRecordMap(users),
      schedulesById: new Map(),
      classesById: new Map(),
      staffById: createRecordMap(staff),
    };

    return bookings.map((booking) =>
      this.toPrivateBookingListItem(booking, maps),
    );
  }

  private mergeBookingFeeds(
    input: AnalyticsBookingFeedMergeInput,
  ): AnalyticsBookingListItem[] {
    const directionMultiplier = input.sortDirection === 'asc' ? 1 : -1;

    return [...input.classBookings, ...input.privateBookings]
      .sort((left, right) => {
        const leftTimestamp = this.resolveBookingSortTimestamp(left);
        const rightTimestamp = this.resolveBookingSortTimestamp(right);

        const dateComparison = compareText(leftTimestamp, rightTimestamp);

        if (dateComparison !== 0) {
          return dateComparison * directionMultiplier;
        }

        return (
          compareText(left.created_at, right.created_at) * directionMultiplier
        );
      })
      .slice(0, input.limit);
  }

  private toClassBookingListItem(
    booking: AnalyticsBookingRecord,
    maps: BookingHydrationMaps,
  ): AnalyticsBookingListItem {
    const user = maps.usersById.get(booking.user_id);
    const schedule = maps.schedulesById.get(booking.schedule_id);
    const classRecord = maps.classesById.get(booking.class_id);
    const trainer = booking.trainer_staff_profile_id
      ? maps.staffById.get(booking.trainer_staff_profile_id)
      : undefined;

    return {
      id: booking.id,
      booking_number: booking.booking_number,
      booking_type: 'class_booking',
      user_id: booking.user_id,
      customer: this.toCustomerSnapshot(booking.user_id, user),
      class: this.toClassSnapshot(booking.class_id, classRecord),
      schedule: this.toClassScheduleSnapshot(booking.schedule_id, schedule),
      trainer: this.toTrainerSnapshot(
        booking.trainer_staff_profile_id,
        trainer,
      ),
      status: booking.status,
      payment_status: booking.payment_status,
      created_at: booking.created_at,
      confirmed_at: booking.confirmed_at,
      cancelled_at: booking.cancelled_at,
    };
  }

  private toPrivateBookingListItem(
    booking: AnalyticsPrivateBookingRecord,
    maps: BookingHydrationMaps,
  ): AnalyticsBookingListItem {
    const user = maps.usersById.get(booking.user_id);
    const trainer = maps.staffById.get(booking.trainer_staff_profile_id);

    return {
      id: booking.id,
      booking_number: booking.booking_number,
      booking_type: 'private_trainer_booking',
      user_id: booking.user_id,
      customer: this.toCustomerSnapshot(booking.user_id, user),
      class: null,
      schedule: {
        id: null,
        class_date: null,
        session_date: booking.session_date,
        start_time: booking.start_time,
        end_time: booking.end_time,
        studio: booking.studio,
        status: null,
      },
      trainer: this.toTrainerSnapshot(
        booking.trainer_staff_profile_id,
        trainer,
      ),
      status: booking.status,
      payment_status: booking.payment_status,
      created_at: booking.created_at,
      confirmed_at: booking.confirmed_at,
      cancelled_at: booking.cancelled_at,
    };
  }

  private toCustomerSnapshot(
    userId: string,
    user: AnalyticsAppUserRecord | undefined,
  ): AnalyticsBookingCustomerSnapshot {
    return {
      id: user?.id ?? userId,
      email: user?.email ?? null,
      phone: user?.phone ?? null,
      full_name: user?.full_name ?? null,
    };
  }

  private toTrainerSnapshot(
    trainerStaffProfileId: string | null,
    trainer: AnalyticsStaffProfileRecord | undefined,
  ): AnalyticsBookingTrainerSnapshot {
    return {
      id: trainer?.id ?? trainerStaffProfileId,
      app_user_id: trainer?.app_user_id ?? null,
      display_name: trainer?.display_name ?? null,
      post_title: trainer?.post_title ?? null,
    };
  }

  private toClassSnapshot(
    classId: string,
    classRecord: AnalyticsPilatesClassRecord | undefined,
  ): AnalyticsBookingClassSnapshot {
    return {
      id: classRecord?.id ?? classId,
      title: classRecord?.title ?? null,
      level: classRecord?.level ?? null,
      status: classRecord?.status ?? null,
    };
  }

  private toClassScheduleSnapshot(
    scheduleId: string,
    schedule: AnalyticsPilatesScheduleRecord | undefined,
  ): AnalyticsBookingScheduleSnapshot {
    return {
      id: schedule?.id ?? scheduleId,
      class_date: schedule?.class_date ?? null,
      session_date: null,
      start_time: schedule?.start_time ?? null,
      end_time: schedule?.end_time ?? null,
      studio: schedule?.studio ?? null,
      status: schedule?.status ?? null,
    };
  }

  private resolveBookingSortTimestamp(
    booking: AnalyticsBookingListItem,
  ): string {
    return (
      buildSortTimestamp(
        booking.schedule.class_date ?? booking.schedule.session_date,
        booking.schedule.start_time,
      ) ?? booking.created_at
    );
  }

  private async buildTopServices(
    bookingRecords: readonly import('../types/analytics.types').AnalyticsTopClassBookingRecord[],
    paidPayments: readonly AnalyticsRevenuePaymentRecord[],
    refundedPayments: readonly AnalyticsRevenuePaymentRecord[],
    limit: number,
  ): Promise<AnalyticsTopServiceItem[]> {
    if (bookingRecords.length === 0) {
      return [];
    }

    const classIds = uniqueStringValues(
      bookingRecords.map((record) => record.class_id),
    );
    const classRecords =
      await this.analyticsRepository.listPilatesClassesByIds(classIds);
    const classesById = createRecordMap(classRecords);

    const classIdByBookingId = new Map<string, string>();
    const accumulators = new Map<string, TopClassAccumulator>();

    for (const record of bookingRecords) {
      classIdByBookingId.set(record.booking_id, record.class_id);

      const classRecord = classesById.get(record.class_id);
      const existing = accumulators.get(record.class_id);

      if (existing) {
        existing.booking_count += 1;
        continue;
      }

      accumulators.set(record.class_id, {
        class_id: record.class_id,
        title: classRecord?.title ?? 'Pilates class',
        level: classRecord?.level ?? null,
        booking_count: 1,
        gross_revenue: 0,
        refund_amount: 0,
      });
    }

    for (const payment of paidPayments) {
      if (!payment.booking_id || !payment.paid_at) {
        continue;
      }

      const classId = classIdByBookingId.get(payment.booking_id);

      if (!classId) {
        continue;
      }

      const accumulator = accumulators.get(classId);

      if (!accumulator) {
        continue;
      }

      accumulator.gross_revenue = normalizeMoney(
        accumulator.gross_revenue + payment.final_amount,
      );
    }

    for (const payment of refundedPayments) {
      if (!payment.booking_id || !payment.refunded_at) {
        continue;
      }

      const classId = classIdByBookingId.get(payment.booking_id);

      if (!classId) {
        continue;
      }

      const accumulator = accumulators.get(classId);

      if (!accumulator) {
        continue;
      }

      accumulator.refund_amount = normalizeMoney(
        accumulator.refund_amount + payment.refunded_amount,
      );
    }

    return Array.from(accumulators.values())
      .map((item) => ({
        class_id: item.class_id,
        title: item.title,
        level: item.level,
        booking_count: item.booking_count,
        gross_revenue: normalizeMoney(item.gross_revenue),
        refund_amount: normalizeMoney(item.refund_amount),
        net_revenue: normalizeMoney(item.gross_revenue - item.refund_amount),
        currency: ANALYTICS_DEFAULT_CURRENCY,
      }))
      .sort((left, right) => {
        if (left.booking_count !== right.booking_count) {
          return right.booking_count - left.booking_count;
        }

        if (left.net_revenue !== right.net_revenue) {
          return right.net_revenue - left.net_revenue;
        }

        return compareText(left.title, right.title);
      })
      .slice(0, limit);
  }

  private async buildWalletSummary(
    timestampRange: AnalyticsDateTimeRange,
  ): Promise<AnalyticsWalletSummary> {
    const [balances, movements] = await Promise.all([
      this.analyticsRepository.listActiveWalletAccountBalances(),
      this.analyticsRepository.listWalletLedgerMovements({
        fromTimestamp: timestampRange.from_timestamp,
        toTimestamp: timestampRange.to_timestamp,
      }),
    ]);

    return this.calculateWalletSummary(balances, movements);
  }

  private calculateWalletSummary(
    balances: readonly AnalyticsWalletAccountBalanceRecord[],
    movements: readonly AnalyticsWalletLedgerMovementRecord[],
  ): AnalyticsWalletSummary {
    return {
      total_wallet_balance: sumMoney(
        balances.map((balance) => balance.available_balance),
      ),
      top_up_amount: this.sumWalletMovementAmount(
        movements,
        ANALYTICS_WALLET_TOP_UP_ENTRY_TYPES,
        false,
      ),
      booking_debit_amount: this.sumWalletMovementAmount(
        movements,
        ANALYTICS_WALLET_BOOKING_DEBIT_ENTRY_TYPES,
        true,
      ),
      private_booking_debit_amount: this.sumWalletMovementAmount(
        movements,
        ANALYTICS_WALLET_PRIVATE_BOOKING_DEBIT_ENTRY_TYPES,
        true,
      ),
      refund_credit_amount: this.sumWalletMovementAmount(
        movements,
        ANALYTICS_WALLET_REFUND_CREDIT_ENTRY_TYPES,
        false,
      ),
      currency: ANALYTICS_DEFAULT_CURRENCY,
    };
  }

  private sumWalletMovementAmount(
    movements: readonly AnalyticsWalletLedgerMovementRecord[],
    entryTypes: readonly string[],
    useAbsoluteValue: boolean,
  ): AnalyticsMoneyAmount {
    return sumMoney(
      movements
        .filter((movement) => hasStringValue(entryTypes, movement.entry_type))
        .map((movement) =>
          useAbsoluteValue ? Math.abs(movement.amount) : movement.amount,
        ),
    );
  }

  private async buildCalendarEvents(
    query: AnalyticsDashboardQuery,
  ): Promise<readonly AnalyticsCalendarEvent[]> {
    const today = getTodayIsoDate();
    const toDate = addDays(today, Math.max(query.upcoming_days - 1, 0));

    const calendarQuery: ListAdminCalendarQueryDto = {
      from_date: today,
      to_date: toDate,
      trainer_staff_profile_id: undefined,
      class_id: undefined,
      user_id: undefined,
      include_class_schedules: ANALYTICS_CALENDAR_INCLUDE_CLASS_SCHEDULES,
      include_class_bookings: ANALYTICS_CALENDAR_INCLUDE_CLASS_BOOKINGS,
      include_waitlist: ANALYTICS_CALENDAR_INCLUDE_WAITLIST,
      include_private_bookings: ANALYTICS_CALENDAR_INCLUDE_PRIVATE_BOOKINGS,
      sort_by: 'start_at',
      sort_direction: 'asc',
    };

    const result =
      await this.bookingCalendarService.listAdminCalendar(calendarQuery);

    return result.events
      .slice(0, ANALYTICS_DEFAULT_CALENDAR_EVENT_LIMIT)
      .map((event) => ({
        id: event.id,
        event_type: event.event_type,
        title: event.title,
        status: event.status,
        start_at: event.starts_at,
        end_at: event.ends_at,
        customer_name:
          getSourceString(event.source, 'customer_full_name') ??
          getSourceString(event.source, 'customer_name'),
        trainer_name:
          getSourceString(event.source, 'trainer_display_name') ??
          getSourceString(event.source, 'trainer_name'),
        class_title:
          getSourceString(event.source, 'class_title') ??
          getSourceString(event.source, 'title'),
        studio: getSourceString(event.source, 'studio'),
      }));
  }
}
