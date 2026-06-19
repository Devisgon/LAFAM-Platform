// apps/api/src/modules/analytics/types/analytics.types.ts
/**
 * LAFAM Analytics module types.
 *
 * Role:
 * - Defines Admin Dashboard analytics service, repository, and response contracts.
 * - Keeps dashboard read models separate from Booking, Payment, Wallet, Auth,
 *   Staff, and Pilates domain mutation models.
 * - Provides stable contracts for dashboard cards, weekly revenue chart,
 *   operational booking feeds, top Pilates classes, optional wallet summary,
 *   and optional calendar events.
 *
 * Important:
 * - This file contains TypeScript contracts only.
 * - Do not place runtime constants here.
 * - Do not place validation rules here.
 * - Do not place database queries here.
 * - Do not place metric calculation logic here.
 * - Analytics must remain read-only.
 * - Revenue metrics must be calculated from payment records.
 * - Booking metrics must be calculated from booking records.
 * - User metrics must be calculated from app_users records.
 * - Top services are represented internally as Pilates classes until the Salon
 *   module exists.
 */

import type {
  AppUserRow,
  BookingRow,
  PaymentRow,
  PilatesClassRow,
  PilatesClassScheduleRow,
  PrivateTrainerBookingRow,
  StaffProfileRow,
  WalletAccountRow,
  WalletLedgerEntryRow,
} from '../../../database/database.types';
import type {
  AnalyticsRevenueGranularity,
  ANALYTICS_DEFAULT_REVENUE_GRANULARITY,
} from '../constants/analytics.constants';
import type { AuthUserRole } from '../../auth/constants/auth-role.constants';
import type { AuthUserStatus } from '../../auth/constants/auth.constants';
import type {
  BookingPaymentStatus,
  BookingStatus,
} from '../../bookings/constants/booking.constants';
import type {
  PilatesClassLevel,
  PilatesClassScheduleStatus,
  PilatesClassStatus,
} from '../../classes/constants/pilates-class.constants';
import type {
  PaymentCurrency,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  PaymentTargetType,
  WalletAccountStatus,
  WalletLedgerEntryStatus,
  WalletLedgerEntryType,
} from '../../payments/constants/payment.constants';

/* -------------------------------------------------------------------------- */
/* Shared primitive aliases                                                    */
/* -------------------------------------------------------------------------- */

export type AnalyticsUserId = string;
export type AnalyticsBookingId = string;
export type AnalyticsPrivateBookingId = string;
export type AnalyticsScheduleId = string;
export type AnalyticsClassId = string;
export type AnalyticsStaffProfileId = string;
export type AnalyticsPaymentId = string;
export type AnalyticsWalletAccountId = string;
export type AnalyticsWalletLedgerEntryId = string;

export type AnalyticsIsoDate = string;
export type AnalyticsIsoTimestamp = string;
export type AnalyticsTimeString = string;

export type AnalyticsMoneyAmount = number;
export type AnalyticsCount = number;
export type AnalyticsPercentage = number;

export type AnalyticsCurrency = PaymentCurrency;

export type AnalyticsDashboardRevenueGranularity =
  typeof ANALYTICS_DEFAULT_REVENUE_GRANULARITY;

/* -------------------------------------------------------------------------- */
/* Database record aliases                                                     */
/* -------------------------------------------------------------------------- */

export type AnalyticsAppUserRecord = AppUserRow;
export type AnalyticsBookingRecord = BookingRow;
export type AnalyticsPrivateBookingRecord = PrivateTrainerBookingRow;
export type AnalyticsPaymentRecord = PaymentRow;
export type AnalyticsPilatesClassRecord = PilatesClassRow;
export type AnalyticsPilatesScheduleRecord = PilatesClassScheduleRow;
export type AnalyticsStaffProfileRecord = StaffProfileRow;
export type AnalyticsWalletAccountRecord = WalletAccountRow;
export type AnalyticsWalletLedgerEntryRecord = WalletLedgerEntryRow;

/* -------------------------------------------------------------------------- */
/* Query contracts                                                             */
/* -------------------------------------------------------------------------- */

export interface AnalyticsDateRange {
  readonly from_date: AnalyticsIsoDate;
  readonly to_date: AnalyticsIsoDate;
}

export interface AnalyticsDateTimeRange {
  readonly from_timestamp: AnalyticsIsoTimestamp;
  readonly to_timestamp: AnalyticsIsoTimestamp;
}

export interface AnalyticsDashboardQuery extends AnalyticsDateRange {
  readonly upcoming_days: number;
  readonly recent_limit: number;
  readonly top_services_limit: number;
  readonly include_wallet_summary: boolean;
  readonly include_calendar_events: boolean;
}

export interface AnalyticsRepositoryRangeInput {
  readonly fromTimestamp: AnalyticsIsoTimestamp;
  readonly toTimestamp: AnalyticsIsoTimestamp;
}

export interface AnalyticsRepositoryDateRangeInput {
  readonly fromDate: AnalyticsIsoDate;
  readonly toDate: AnalyticsIsoDate;
}

export interface AnalyticsRepositoryLimitInput {
  readonly limit: number;
}

export interface AnalyticsUpcomingWindowInput {
  readonly fromDate: AnalyticsIsoDate;
  readonly toDate: AnalyticsIsoDate;
  readonly limit: number;
}

export type AnalyticsTopClassesInput = AnalyticsRepositoryRangeInput &
  AnalyticsRepositoryLimitInput;

export type AnalyticsWalletMovementInput = AnalyticsRepositoryRangeInput;

/* -------------------------------------------------------------------------- */
/* User metric contracts                                                       */
/* -------------------------------------------------------------------------- */

export interface AnalyticsUserMetricFilter {
  readonly role: AuthUserRole;
  readonly statuses: readonly AuthUserStatus[];
  readonly is_guest: boolean;
  readonly exclude_deleted: boolean;
}

export interface AnalyticsCustomerCountResult {
  readonly total: AnalyticsCount;
}

/* -------------------------------------------------------------------------- */
/* Payment and revenue contracts                                               */
/* -------------------------------------------------------------------------- */

export interface AnalyticsPaymentMetricFilter {
  readonly statuses: readonly PaymentStatus[];
  readonly currency: AnalyticsCurrency;
}

export interface AnalyticsRevenuePaymentRecord {
  readonly id: AnalyticsPaymentId;
  readonly target_type: PaymentTargetType;
  readonly booking_id: AnalyticsBookingId | null;
  readonly private_booking_id: AnalyticsPrivateBookingId | null;
  readonly final_amount: AnalyticsMoneyAmount;
  readonly refunded_amount: AnalyticsMoneyAmount;
  readonly currency: AnalyticsCurrency;
  readonly status: PaymentStatus;
  readonly payment_method: PaymentMethod;
  readonly payment_provider: PaymentProvider;
  readonly paid_at: AnalyticsIsoTimestamp | null;
  readonly failed_at: AnalyticsIsoTimestamp | null;
  readonly refunded_at: AnalyticsIsoTimestamp | null;
  readonly created_at: AnalyticsIsoTimestamp;
}

export interface AnalyticsRevenueWeekPoint {
  readonly week_start: AnalyticsIsoDate;
  readonly week_end: AnalyticsIsoDate;
  readonly gross_revenue: AnalyticsMoneyAmount;
  readonly refund_amount: AnalyticsMoneyAmount;
  readonly net_revenue: AnalyticsMoneyAmount;
  readonly paid_payment_count: AnalyticsCount;
  readonly refund_count: AnalyticsCount;
  readonly currency: AnalyticsCurrency;
}

export interface AnalyticsPaymentSummary {
  readonly paid_count: AnalyticsCount;
  readonly failed_count: AnalyticsCount;
  readonly refunded_count: AnalyticsCount;
  readonly refund_amount: AnalyticsMoneyAmount;
  readonly currency: AnalyticsCurrency;
}

export interface AnalyticsRevenueSummary {
  readonly gross_revenue: AnalyticsMoneyAmount;
  readonly refund_amount: AnalyticsMoneyAmount;
  readonly net_revenue: AnalyticsMoneyAmount;
  readonly currency: AnalyticsCurrency;
}

/* -------------------------------------------------------------------------- */
/* Booking feed contracts                                                      */
/* -------------------------------------------------------------------------- */

export type AnalyticsBookingType = 'class_booking' | 'private_trainer_booking';

export interface AnalyticsBookingCustomerSnapshot {
  readonly id: AnalyticsUserId;
  readonly email: string | null;
  readonly phone: string | null;
  readonly full_name: string | null;
}

export interface AnalyticsBookingTrainerSnapshot {
  readonly id: AnalyticsStaffProfileId | null;
  readonly app_user_id: AnalyticsUserId | null;
  readonly display_name: string | null;
  readonly post_title: string | null;
}

export interface AnalyticsBookingClassSnapshot {
  readonly id: AnalyticsClassId | null;
  readonly title: string | null;
  readonly level: PilatesClassLevel | null;
  readonly status: PilatesClassStatus | null;
}

export interface AnalyticsBookingScheduleSnapshot {
  readonly id: AnalyticsScheduleId | null;
  readonly class_date: AnalyticsIsoDate | null;
  readonly session_date: AnalyticsIsoDate | null;
  readonly start_time: AnalyticsTimeString | null;
  readonly end_time: AnalyticsTimeString | null;
  readonly studio: string | null;
  readonly status: PilatesClassScheduleStatus | null;
}

export interface AnalyticsBookingListItem {
  readonly id: string;
  readonly booking_number: string;
  readonly booking_type: AnalyticsBookingType;
  readonly user_id: AnalyticsUserId;
  readonly customer: AnalyticsBookingCustomerSnapshot;
  readonly class: AnalyticsBookingClassSnapshot | null;
  readonly schedule: AnalyticsBookingScheduleSnapshot;
  readonly trainer: AnalyticsBookingTrainerSnapshot;
  readonly status: BookingStatus;
  readonly payment_status: BookingPaymentStatus;
  readonly created_at: AnalyticsIsoTimestamp;
  readonly confirmed_at: AnalyticsIsoTimestamp | null;
  readonly cancelled_at: AnalyticsIsoTimestamp | null;
}

export interface AnalyticsBookingCountResult {
  readonly class_bookings: AnalyticsCount;
  readonly private_bookings: AnalyticsCount;
  readonly total: AnalyticsCount;
}

export type AnalyticsCancelledBookingCountResult = AnalyticsBookingCountResult;

/* -------------------------------------------------------------------------- */
/* Top Pilates class contracts                                                 */
/* -------------------------------------------------------------------------- */

export interface AnalyticsTopClassRevenueRecord {
  readonly class_id: AnalyticsClassId;
  readonly payment_id: AnalyticsPaymentId;
  readonly final_amount: AnalyticsMoneyAmount;
  readonly refunded_amount: AnalyticsMoneyAmount;
  readonly currency: AnalyticsCurrency;
}

export interface AnalyticsTopClassBookingRecord {
  readonly class_id: AnalyticsClassId;
  readonly booking_id: AnalyticsBookingId;
}

export interface AnalyticsTopClassItem {
  readonly class_id: AnalyticsClassId;
  readonly title: string;
  readonly level: PilatesClassLevel | null;
  readonly booking_count: AnalyticsCount;
  readonly gross_revenue: AnalyticsMoneyAmount;
  readonly refund_amount: AnalyticsMoneyAmount;
  readonly net_revenue: AnalyticsMoneyAmount;
  readonly currency: AnalyticsCurrency;
}

/**
 * Frontend dashboard still labels this section as "Top Services".
 * Backend keeps the domain-accurate name as top classes because Phase 1 is
 * Pilates-only.
 */
export type AnalyticsTopServiceItem = AnalyticsTopClassItem;

/* -------------------------------------------------------------------------- */
/* Wallet contracts                                                            */
/* -------------------------------------------------------------------------- */

export interface AnalyticsWalletAccountBalanceRecord {
  readonly id: AnalyticsWalletAccountId;
  readonly user_id: AnalyticsUserId;
  readonly available_balance: AnalyticsMoneyAmount;
  readonly currency: AnalyticsCurrency;
  readonly status: WalletAccountStatus;
}

export interface AnalyticsWalletLedgerMovementRecord {
  readonly id: AnalyticsWalletLedgerEntryId;
  readonly wallet_account_id: AnalyticsWalletAccountId;
  readonly user_id: AnalyticsUserId;
  readonly payment_id: AnalyticsPaymentId | null;
  readonly entry_type: WalletLedgerEntryType;
  readonly entry_status: WalletLedgerEntryStatus;
  readonly amount: AnalyticsMoneyAmount;
  readonly currency: AnalyticsCurrency;
  readonly created_at: AnalyticsIsoTimestamp;
}

export interface AnalyticsWalletSummary {
  readonly total_wallet_balance: AnalyticsMoneyAmount;
  readonly top_up_amount: AnalyticsMoneyAmount;
  readonly booking_debit_amount: AnalyticsMoneyAmount;
  readonly private_booking_debit_amount: AnalyticsMoneyAmount;
  readonly refund_credit_amount: AnalyticsMoneyAmount;
  readonly currency: AnalyticsCurrency;
}

/* -------------------------------------------------------------------------- */
/* Calendar contracts                                                          */
/* -------------------------------------------------------------------------- */

export type AnalyticsCalendarEventType =
  | 'pilates_schedule'
  | 'pilates_booking'
  | 'waitlist_entry'
  | 'private_trainer_booking';

export interface AnalyticsCalendarEvent {
  readonly id: string;
  readonly event_type: AnalyticsCalendarEventType;
  readonly title: string;
  readonly status: string;
  readonly start_at: AnalyticsIsoTimestamp;
  readonly end_at: AnalyticsIsoTimestamp;
  readonly customer_name: string | null;
  readonly trainer_name: string | null;
  readonly class_title: string | null;
  readonly studio: string | null;
}

/* -------------------------------------------------------------------------- */
/* Dashboard response contracts                                                */
/* -------------------------------------------------------------------------- */

export interface AnalyticsDashboardRange {
  readonly from_date: AnalyticsIsoDate;
  readonly to_date: AnalyticsIsoDate;
  readonly revenue_granularity: AnalyticsRevenueGranularity;
}

export interface AnalyticsSummaryMetrics {
  readonly total_revenue: AnalyticsMoneyAmount;
  readonly total_bookings: AnalyticsCount;
  readonly new_customers: AnalyticsCount;
  readonly cancelled_bookings: AnalyticsCount;
  readonly active_users: AnalyticsCount;
  readonly currency: AnalyticsCurrency;
}

export interface AnalyticsDashboardData {
  readonly range: AnalyticsDashboardRange;
  readonly summary: AnalyticsSummaryMetrics;
  readonly revenue_overview: readonly AnalyticsRevenueWeekPoint[];
  readonly payment_summary: AnalyticsPaymentSummary;
  readonly upcoming_bookings: readonly AnalyticsBookingListItem[];
  readonly recent_bookings: readonly AnalyticsBookingListItem[];
  readonly top_services: readonly AnalyticsTopServiceItem[];
  readonly wallet_summary: AnalyticsWalletSummary | null;
  readonly calendar_events: readonly AnalyticsCalendarEvent[] | null;
  readonly generated_at: AnalyticsIsoTimestamp;
}

export interface AnalyticsDashboardResponse {
  readonly dashboard: AnalyticsDashboardData;
}

/* -------------------------------------------------------------------------- */
/* Service calculation contracts                                               */
/* -------------------------------------------------------------------------- */

export interface AnalyticsDashboardCalculationInput {
  readonly query: AnalyticsDashboardQuery;
  readonly range: AnalyticsDateRange;
  readonly timestampRange: AnalyticsDateTimeRange;
  readonly generatedAt: AnalyticsIsoTimestamp;
}

export interface AnalyticsRevenueCalculationInput {
  readonly payments: readonly AnalyticsRevenuePaymentRecord[];
  readonly range: AnalyticsDateRange;
  readonly currency: AnalyticsCurrency;
}

export interface AnalyticsBookingFeedMergeInput {
  readonly classBookings: readonly AnalyticsBookingListItem[];
  readonly privateBookings: readonly AnalyticsBookingListItem[];
  readonly limit: number;
  readonly sortDirection: 'asc' | 'desc';
}

export interface AnalyticsTopClassesCalculationInput {
  readonly bookingRecords: readonly AnalyticsTopClassBookingRecord[];
  readonly revenueRecords: readonly AnalyticsTopClassRevenueRecord[];
  readonly classRecords: readonly AnalyticsPilatesClassRecord[];
  readonly limit: number;
  readonly currency: AnalyticsCurrency;
}

export interface AnalyticsWalletSummaryCalculationInput {
  readonly balances: readonly AnalyticsWalletAccountBalanceRecord[];
  readonly movements: readonly AnalyticsWalletLedgerMovementRecord[];
  readonly currency: AnalyticsCurrency;
}
