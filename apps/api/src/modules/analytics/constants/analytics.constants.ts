// apps/api/src/modules/analytics/constants/analytics.constants.ts
/**
 * LAFAM Analytics module constants.
 *
 * Role:
 * - Defines Admin Analytics route prefixes, dashboard limits, supported
 *   dashboard metric groups, date-range limits, currency, revenue granularity,
 *   booking status groups, user status groups, payment status groups, wallet
 *   ledger groups, and default dashboard list sizes.
 * - Keeps Analytics DTOs, repositories, services, controllers, and Swagger
 *   aligned.
 *
 * Important:
 * - This file contains constants only.
 * - Do not place database queries here.
 * - Do not place aggregation logic here.
 * - Do not place service logic here.
 * - Do not place secrets or environment-derived values here.
 * - Analytics must remain read-only.
 * - Payment is the source of truth for revenue.
 * - Booking is the source of truth for booking counts and operational feeds.
 * - Auth app_users are the source of truth for customer/user metrics.
 * - Pilates class analytics must stay Pilates-only until the Salon module exists.
 */

import {
  AUTH_USER_STATUS_ACTIVE,
  AUTH_USER_STATUS_PENDING_EMAIL_VERIFICATION,
  type AuthUserStatus,
} from '../../auth/constants/auth.constants';
import {
  AUTH_ADMIN_ROLE,
  AUTH_CUSTOMER_ROLE,
  AUTH_SUPER_ADMIN_ROLE,
  type AuthUserRole,
} from '../../auth/constants/auth-role.constants';
import {
  BOOKING_STATUS_CANCELLED,
  BOOKING_STATUS_CONFIRMED,
  BOOKING_STATUS_EXPIRED,
  BOOKING_STATUS_PENDING_PAYMENT,
  BOOKING_STATUS_RESCHEDULED,
  type BookingStatus,
} from '../../bookings/constants/booking.constants';
import {
  PAYMENT_DEFAULT_CURRENCY,
  PAYMENT_STATUS_FAILED,
  PAYMENT_STATUS_PAID,
  PAYMENT_STATUS_REFUNDED,
  WALLET_ACCOUNT_STATUS_ACTIVE,
  WALLET_LEDGER_ENTRY_STATUS_POSTED,
  WALLET_LEDGER_ENTRY_TYPE_BOOKING_PAYMENT,
  WALLET_LEDGER_ENTRY_TYPE_PRIVATE_BOOKING_PAYMENT,
  WALLET_LEDGER_ENTRY_TYPE_REFUND_CREDIT,
  WALLET_LEDGER_ENTRY_TYPE_WALLET_TOP_UP,
  type PaymentCurrency,
  type PaymentStatus,
  type WalletAccountStatus,
  type WalletLedgerEntryStatus,
  type WalletLedgerEntryType,
} from '../../payments/constants/payment.constants';

/* -------------------------------------------------------------------------- */
/* Module and routes                                                           */
/* -------------------------------------------------------------------------- */

export const ANALYTICS_MODULE_NAME = 'analytics' as const;

export const ANALYTICS_ADMIN_ROUTE_PREFIX = 'admin/analytics' as const;

export const ANALYTICS_DASHBOARD_ROUTE = 'dashboard' as const;

/* -------------------------------------------------------------------------- */
/* Currency                                                                    */
/* -------------------------------------------------------------------------- */

export const ANALYTICS_DEFAULT_CURRENCY =
  PAYMENT_DEFAULT_CURRENCY satisfies PaymentCurrency;

export const ANALYTICS_SUPPORTED_CURRENCIES = [
  ANALYTICS_DEFAULT_CURRENCY,
] as const satisfies readonly PaymentCurrency[];

/* -------------------------------------------------------------------------- */
/* Revenue granularity                                                         */
/* -------------------------------------------------------------------------- */

export const ANALYTICS_REVENUE_GRANULARITY_WEEKLY = 'weekly' as const;

export const ANALYTICS_REVENUE_GRANULARITIES = [
  ANALYTICS_REVENUE_GRANULARITY_WEEKLY,
] as const;

export type AnalyticsRevenueGranularity =
  (typeof ANALYTICS_REVENUE_GRANULARITIES)[number];

export const ANALYTICS_DEFAULT_REVENUE_GRANULARITY =
  ANALYTICS_REVENUE_GRANULARITY_WEEKLY satisfies AnalyticsRevenueGranularity;

/**
 * ISO-style week start.
 * 1 = Monday.
 */
export const ANALYTICS_WEEK_START_DAY = 1;

/* -------------------------------------------------------------------------- */
/* Date and range limits                                                       */
/* -------------------------------------------------------------------------- */

export const ANALYTICS_ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const ANALYTICS_MAX_RANGE_DAYS = 370;

export const ANALYTICS_DATE_TIME_END_OF_DAY_TIME = '23:59:59.999';

export const ANALYTICS_DATE_TIME_START_OF_DAY_TIME = '00:00:00.000';

/* -------------------------------------------------------------------------- */
/* Dashboard list limits                                                       */
/* -------------------------------------------------------------------------- */

export const ANALYTICS_DEFAULT_UPCOMING_DAYS = 7;

export const ANALYTICS_MAX_UPCOMING_DAYS = 90;

export const ANALYTICS_DEFAULT_RECENT_LIMIT = 5;

export const ANALYTICS_MAX_RECENT_LIMIT = 20;

export const ANALYTICS_DEFAULT_TOP_SERVICES_LIMIT = 5;

export const ANALYTICS_MAX_TOP_SERVICES_LIMIT = 20;

export const ANALYTICS_DEFAULT_CALENDAR_EVENT_LIMIT = 20;

export const ANALYTICS_MAX_CALENDAR_EVENT_LIMIT = 50;

/* -------------------------------------------------------------------------- */
/* User metric filters                                                         */
/* -------------------------------------------------------------------------- */

export const ANALYTICS_ADMIN_ACCESS_ROLES = [
  AUTH_ADMIN_ROLE,
  AUTH_SUPER_ADMIN_ROLE,
] as const satisfies readonly AuthUserRole[];

export const ANALYTICS_CUSTOMER_ROLE =
  AUTH_CUSTOMER_ROLE satisfies AuthUserRole;

export const ANALYTICS_NEW_CUSTOMER_STATUSES = [
  AUTH_USER_STATUS_ACTIVE,
  AUTH_USER_STATUS_PENDING_EMAIL_VERIFICATION,
] as const satisfies readonly AuthUserStatus[];

export const ANALYTICS_ACTIVE_CUSTOMER_STATUSES = [
  AUTH_USER_STATUS_ACTIVE,
] as const satisfies readonly AuthUserStatus[];

/* -------------------------------------------------------------------------- */
/* Booking metric filters                                                      */
/* -------------------------------------------------------------------------- */

export const ANALYTICS_TOTAL_BOOKING_STATUSES = [
  BOOKING_STATUS_CONFIRMED,
  BOOKING_STATUS_CANCELLED,
] as const satisfies readonly BookingStatus[];

export const ANALYTICS_CONFIRMED_BOOKING_STATUSES = [
  BOOKING_STATUS_CONFIRMED,
] as const satisfies readonly BookingStatus[];

export const ANALYTICS_CANCELLED_BOOKING_STATUSES = [
  BOOKING_STATUS_CANCELLED,
] as const satisfies readonly BookingStatus[];

export const ANALYTICS_RECENT_BOOKING_STATUSES = [
  BOOKING_STATUS_PENDING_PAYMENT,
  BOOKING_STATUS_CONFIRMED,
  BOOKING_STATUS_CANCELLED,
  BOOKING_STATUS_EXPIRED,
  BOOKING_STATUS_RESCHEDULED,
] as const satisfies readonly BookingStatus[];

export const ANALYTICS_TOP_CLASS_BOOKING_STATUSES = [
  BOOKING_STATUS_CONFIRMED,
] as const satisfies readonly BookingStatus[];

export const ANALYTICS_EXCLUDED_BOOKING_STATUSES = [
  BOOKING_STATUS_EXPIRED,
  BOOKING_STATUS_RESCHEDULED,
] as const satisfies readonly BookingStatus[];

/* -------------------------------------------------------------------------- */
/* Payment metric filters                                                      */
/* -------------------------------------------------------------------------- */

export const ANALYTICS_REVENUE_PAYMENT_STATUSES = [
  PAYMENT_STATUS_PAID,
  PAYMENT_STATUS_REFUNDED,
] as const satisfies readonly PaymentStatus[];

export const ANALYTICS_PAID_PAYMENT_STATUSES = [
  PAYMENT_STATUS_PAID,
] as const satisfies readonly PaymentStatus[];

export const ANALYTICS_FAILED_PAYMENT_STATUSES = [
  PAYMENT_STATUS_FAILED,
] as const satisfies readonly PaymentStatus[];

export const ANALYTICS_REFUNDED_PAYMENT_STATUSES = [
  PAYMENT_STATUS_REFUNDED,
] as const satisfies readonly PaymentStatus[];

/* -------------------------------------------------------------------------- */
/* Wallet metric filters                                                       */
/* -------------------------------------------------------------------------- */

export const ANALYTICS_ACTIVE_WALLET_ACCOUNT_STATUSES = [
  WALLET_ACCOUNT_STATUS_ACTIVE,
] as const satisfies readonly WalletAccountStatus[];

export const ANALYTICS_POSTED_WALLET_LEDGER_STATUSES = [
  WALLET_LEDGER_ENTRY_STATUS_POSTED,
] as const satisfies readonly WalletLedgerEntryStatus[];

export const ANALYTICS_WALLET_TOP_UP_ENTRY_TYPES = [
  WALLET_LEDGER_ENTRY_TYPE_WALLET_TOP_UP,
] as const satisfies readonly WalletLedgerEntryType[];

export const ANALYTICS_WALLET_BOOKING_DEBIT_ENTRY_TYPES = [
  WALLET_LEDGER_ENTRY_TYPE_BOOKING_PAYMENT,
] as const satisfies readonly WalletLedgerEntryType[];

export const ANALYTICS_WALLET_PRIVATE_BOOKING_DEBIT_ENTRY_TYPES = [
  WALLET_LEDGER_ENTRY_TYPE_PRIVATE_BOOKING_PAYMENT,
] as const satisfies readonly WalletLedgerEntryType[];

export const ANALYTICS_WALLET_REFUND_CREDIT_ENTRY_TYPES = [
  WALLET_LEDGER_ENTRY_TYPE_REFUND_CREDIT,
] as const satisfies readonly WalletLedgerEntryType[];

export const ANALYTICS_WALLET_MOVEMENT_ENTRY_TYPES = [
  WALLET_LEDGER_ENTRY_TYPE_WALLET_TOP_UP,
  WALLET_LEDGER_ENTRY_TYPE_BOOKING_PAYMENT,
  WALLET_LEDGER_ENTRY_TYPE_PRIVATE_BOOKING_PAYMENT,
  WALLET_LEDGER_ENTRY_TYPE_REFUND_CREDIT,
] as const satisfies readonly WalletLedgerEntryType[];

/* -------------------------------------------------------------------------- */
/* Calendar defaults                                                           */
/* -------------------------------------------------------------------------- */

export const ANALYTICS_CALENDAR_INCLUDE_CLASS_SCHEDULES = true;

export const ANALYTICS_CALENDAR_INCLUDE_CLASS_BOOKINGS = false;

export const ANALYTICS_CALENDAR_INCLUDE_WAITLIST = false;

export const ANALYTICS_CALENDAR_INCLUDE_PRIVATE_BOOKINGS = true;

/* -------------------------------------------------------------------------- */
/* Response messages                                                           */
/* -------------------------------------------------------------------------- */

export const ANALYTICS_DASHBOARD_SUCCESS_MESSAGE =
  'Analytics dashboard retrieved successfully.' as const;
