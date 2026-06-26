// apps/api/src/modules/bookings/domain/booking-order-lifecycle.policy.ts
/**
 * LAFAM booking-order lifecycle policy.
 *
 * Role:
 * - Owns pure booking-order lifecycle checks.
 * - Validates bulk schedule selection before service/repository work.
 * - Validates booking-order ownership for customer-facing order flows.
 * - Validates payable, paid, expired, cancelled, and refunded order states.
 * - Validates booking-order payment amount/currency consistency.
 * - Validates booking-order item state consistency.
 *
 * Important:
 * - This policy does not query the database.
 * - This policy does not call Supabase RPCs.
 * - This policy does not calculate booking capacity.
 * - This policy does not calculate trusted prices.
 * - This policy does not mutate bookings, payments, wallets, or orders.
 * - Repository/RPC logic remains the concurrency authority.
 */

import { AppError } from '../../../common/errors/app-error';
import {
  BOOKING_BULK_MAX_SCHEDULE_COUNT,
  BOOKING_BULK_MIN_SCHEDULE_COUNT,
  BOOKING_ORDER_ALLOWED_CURRENCIES,
  BOOKING_ORDER_ITEM_STATUS_CONFIRMED,
  BOOKING_ORDER_ITEM_STATUS_EXPIRED,
  BOOKING_ORDER_ITEM_STATUS_PENDING_PAYMENT,
  BOOKING_ORDER_PAYABLE_STATUSES,
  BOOKING_ORDER_STATUS_CANCELLED,
  BOOKING_ORDER_STATUS_EXPIRED,
  BOOKING_ORDER_STATUS_PAID,
  BOOKING_ORDER_STATUS_PENDING_PAYMENT,
  BOOKING_ORDER_STATUS_REFUNDED,
  BOOKING_ORDER_TERMINAL_STATUSES,
  BOOKING_PAYMENT_PAYABLE_STATUSES,
  type BookingOrderItemStatus,
  type BookingOrderStatus,
  type BookingPaymentStatus,
} from '../constants/booking.constants';

export interface BookingOrderLifecycleRecord {
  readonly id: string;
  readonly order_number: string;
  readonly customer_user_id: string;
  readonly status: BookingOrderStatus;
  readonly payment_status: BookingPaymentStatus;
  readonly payment_required: boolean;
  readonly total_amount: number;
  readonly currency: string;
  readonly booking_count: number;
  readonly expires_at: string;
  readonly paid_at: string | null;
  readonly expired_at: string | null;
  readonly cancelled_at: string | null;
  readonly refunded_at: string | null;
}

export interface BookingOrderItemLifecycleRecord {
  readonly id: string;
  readonly booking_order_id: string;
  readonly booking_id: string;
  readonly schedule_id: string;
  readonly price_amount: number;
  readonly currency: string;
  readonly status: BookingOrderItemStatus;
}

export interface BookingOrderPaymentLifecycleRecord {
  readonly id: string;
  readonly target_type: string;
  readonly booking_order_id: string | null;
  readonly final_amount: number;
  readonly currency: string;
  readonly status: string;
}

export interface BookingOrderRpcLifecycleResult {
  readonly action_result: string;
  readonly booking_order_id: string;
  readonly status: BookingOrderStatus;
  readonly payment_status: BookingPaymentStatus;
  readonly total_amount: number;
  readonly currency: string;
  readonly expires_at: string;
  readonly booking_count: number;
}

type BookingOrderStateDetails = Record<string, unknown> & {
  readonly booking_order_id: string;
  readonly order_number?: string;
  readonly current_status?: BookingOrderStatus;
  readonly current_payment_status?: BookingPaymentStatus;
  readonly payment_required?: boolean;
  readonly expires_at?: string;
  readonly checked_at?: string;
};

const BOOKING_ORDER_PAYMENT_TARGET_TYPE = 'booking_order' as const;
const PAYMENT_STATUS_PENDING = 'pending' as const;
const PAYMENT_STATUS_PAID = 'paid' as const;
const PAYMENT_STATUS_EXPIRED = 'expired' as const;
const PAYMENT_STATUS_REFUNDED = 'refunded' as const;
const PAYMENT_STATUS_CANCELLED = 'cancelled' as const;
const PAYMENT_STATUS_FAILED = 'failed' as const;
const PRICE_COMPARISON_PRECISION = 3;

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeComparableAmount(value: number): number {
  return Number(value.toFixed(PRICE_COMPARISON_PRECISION));
}

function assertFinitePositiveAmount(
  value: number,
  publicMessage: string,
  details: Record<string, unknown>,
): void {
  if (Number.isFinite(value) && value > 0) {
    return;
  }

  throw AppError.bookingOrderNotPayable(publicMessage, details);
}

function parseIsoTimestamp(
  value: string,
  publicMessage: string,
  details: Record<string, unknown>,
): number {
  const timestamp = Date.parse(value);

  if (!Number.isNaN(timestamp)) {
    return timestamp;
  }

  throw AppError.bookingInvalidStatusTransition(publicMessage, {
    ...details,
    timestamp: value,
  });
}

function toOrderDetails(
  order: BookingOrderLifecycleRecord,
): BookingOrderStateDetails {
  return {
    booking_order_id: order.id,
    order_number: order.order_number,
    current_status: order.status,
    current_payment_status: order.payment_status,
    payment_required: order.payment_required,
    expires_at: order.expires_at,
  };
}

function isAllowedCurrency(value: string): boolean {
  return BOOKING_ORDER_ALLOWED_CURRENCIES.includes(
    value as (typeof BOOKING_ORDER_ALLOWED_CURRENCIES)[number],
  );
}

function isPayableOrderStatus(status: BookingOrderStatus): boolean {
  return BOOKING_ORDER_PAYABLE_STATUSES.includes(
    status as (typeof BOOKING_ORDER_PAYABLE_STATUSES)[number],
  );
}

function isPayablePaymentStatus(status: BookingPaymentStatus): boolean {
  return BOOKING_PAYMENT_PAYABLE_STATUSES.includes(
    status as (typeof BOOKING_PAYMENT_PAYABLE_STATUSES)[number],
  );
}

function isTerminalOrderStatus(status: BookingOrderStatus): boolean {
  return BOOKING_ORDER_TERMINAL_STATUSES.includes(
    status as (typeof BOOKING_ORDER_TERMINAL_STATUSES)[number],
  );
}

export class BookingOrderLifecyclePolicy {
  static assertScheduleSelectionIsValid(scheduleIds: readonly string[]): void {
    if (scheduleIds.length < BOOKING_BULK_MIN_SCHEDULE_COUNT) {
      throw AppError.bulkBookingEmptySchedules(
        'At least one schedule must be selected for bulk booking.',
        {
          received_count: scheduleIds.length,
          minimum_count: BOOKING_BULK_MIN_SCHEDULE_COUNT,
        },
      );
    }

    if (scheduleIds.length > BOOKING_BULK_MAX_SCHEDULE_COUNT) {
      throw AppError.invalidRequest(
        `Bulk booking cannot include more than ${BOOKING_BULK_MAX_SCHEDULE_COUNT} schedules.`,
        {
          received_count: scheduleIds.length,
          maximum_count: BOOKING_BULK_MAX_SCHEDULE_COUNT,
        },
      );
    }

    const uniqueScheduleIds = new Set(scheduleIds);

    if (uniqueScheduleIds.size !== scheduleIds.length) {
      throw AppError.bulkBookingDuplicateSchedules(
        'Duplicate schedules are not allowed in one bulk booking request.',
        {
          received_count: scheduleIds.length,
          unique_count: uniqueScheduleIds.size,
        },
      );
    }
  }

  static assertScheduleSelectionMatchesLookup(
    requestedScheduleIds: readonly string[],
    foundScheduleIds: readonly string[],
  ): void {
    const foundScheduleIdSet = new Set(foundScheduleIds);
    const missingScheduleIds = requestedScheduleIds.filter(
      (scheduleId) => !foundScheduleIdSet.has(scheduleId),
    );

    if (missingScheduleIds.length === 0) {
      return;
    }

    throw AppError.bulkBookingScheduleUnavailable(
      'One or more selected schedules are not available for booking.',
      {
        missing_schedule_ids: missingScheduleIds,
        requested_count: requestedScheduleIds.length,
        found_count: foundScheduleIds.length,
      },
    );
  }

  static assertBookingOrderExists(
    order: BookingOrderLifecycleRecord | null | undefined,
    details?: Record<string, unknown>,
  ): asserts order is BookingOrderLifecycleRecord {
    if (order) {
      return;
    }

    throw AppError.bookingOrderNotFound(
      'The requested booking order was not found.',
      details,
    );
  }

  static assertCustomerOwnsBookingOrder(
    order: BookingOrderLifecycleRecord,
    customerUserId: string,
  ): void {
    if (order.customer_user_id === customerUserId) {
      return;
    }

    throw AppError.bookingOrderNotFound(
      'The requested booking order was not found.',
      {
        booking_order_id: order.id,
        customer_user_id: customerUserId,
      },
    );
  }

  static assertPaymentRequired(order: BookingOrderLifecycleRecord): void {
    if (order.payment_required === true) {
      return;
    }

    throw AppError.bookingPaymentRequired(
      'Booking orders must require payment.',
      toOrderDetails(order),
    );
  }

  static assertBookingOrderNotExpired(
    order: BookingOrderLifecycleRecord,
    now: Date = new Date(),
  ): void {
    const expiresAt = parseIsoTimestamp(
      order.expires_at,
      'Booking order expiry timestamp is invalid.',
      toOrderDetails(order),
    );

    if (expiresAt > now.getTime()) {
      return;
    }

    throw AppError.bookingOrderExpired('This booking order has expired.', {
      ...toOrderDetails(order),
      checked_at: now.toISOString(),
    });
  }

  static assertBookingOrderIsPayable(
    order: BookingOrderLifecycleRecord,
    now: Date = new Date(),
  ): void {
    this.assertPaymentRequired(order);

    if (order.status === BOOKING_ORDER_STATUS_PAID) {
      throw AppError.bookingOrderAlreadyPaid(
        'This booking order has already been paid.',
        toOrderDetails(order),
      );
    }

    if (!isPayableOrderStatus(order.status)) {
      throw AppError.bookingOrderNotPayable(
        'This booking order is not payable.',
        toOrderDetails(order),
      );
    }

    if (!isPayablePaymentStatus(order.payment_status)) {
      throw AppError.bookingOrderNotPayable(
        'This booking order payment state is not payable.',
        toOrderDetails(order),
      );
    }

    this.assertBookingOrderNotExpired(order, now);
  }

  static assertBookingOrderCanBeConfirmedPaid(
    order: BookingOrderLifecycleRecord,
  ): void {
    if (
      order.status === BOOKING_ORDER_STATUS_PAID &&
      order.payment_status === PAYMENT_STATUS_PAID
    ) {
      return;
    }

    if (
      order.status === BOOKING_ORDER_STATUS_PENDING_PAYMENT &&
      order.payment_status === PAYMENT_STATUS_PENDING
    ) {
      return;
    }

    throw AppError.bookingOrderNotPayable(
      'Only pending booking orders can be confirmed as paid.',
      toOrderDetails(order),
    );
  }

  static assertBookingOrderCanBeExpired(
    order: BookingOrderLifecycleRecord,
  ): void {
    if (
      order.status === BOOKING_ORDER_STATUS_EXPIRED &&
      order.payment_status === PAYMENT_STATUS_EXPIRED
    ) {
      return;
    }

    if (
      order.status === BOOKING_ORDER_STATUS_PENDING_PAYMENT &&
      order.payment_status === PAYMENT_STATUS_PENDING
    ) {
      return;
    }

    throw AppError.bookingOrderNotPayable(
      'Only pending booking orders can be expired.',
      toOrderDetails(order),
    );
  }

  static assertBookingOrderCanBeRefunded(
    order: BookingOrderLifecycleRecord,
  ): void {
    if (
      order.status === BOOKING_ORDER_STATUS_PAID &&
      order.payment_status === PAYMENT_STATUS_PAID &&
      hasText(order.paid_at)
    ) {
      return;
    }

    throw AppError.bookingOrderNotPayable(
      'Only paid booking orders can be refunded.',
      toOrderDetails(order),
    );
  }

  static assertBookingOrderAmountIsValid(
    order: BookingOrderLifecycleRecord,
  ): void {
    assertFinitePositiveAmount(
      order.total_amount,
      'Booking order total amount must be greater than zero.',
      {
        booking_order_id: order.id,
        total_amount: order.total_amount,
      },
    );

    if (isAllowedCurrency(order.currency)) {
      return;
    }

    throw AppError.bookingOrderNotPayable(
      'Booking order currency is not supported.',
      {
        booking_order_id: order.id,
        currency: order.currency,
        allowed_currencies: [...BOOKING_ORDER_ALLOWED_CURRENCIES],
      },
    );
  }

  static assertPaymentMatchesBookingOrder(
    order: BookingOrderLifecycleRecord,
    payment: BookingOrderPaymentLifecycleRecord,
  ): void {
    if (payment.target_type !== BOOKING_ORDER_PAYMENT_TARGET_TYPE) {
      throw AppError.bookingOrderPaymentMismatch(
        'Payment target type does not match booking order checkout.',
        {
          booking_order_id: order.id,
          payment_id: payment.id,
          target_type: payment.target_type,
        },
      );
    }

    if (payment.booking_order_id !== order.id) {
      throw AppError.bookingOrderPaymentMismatch(
        'Payment is not linked to this booking order.',
        {
          booking_order_id: order.id,
          payment_id: payment.id,
          payment_booking_order_id: payment.booking_order_id,
        },
      );
    }

    if (
      normalizeComparableAmount(payment.final_amount) !==
      normalizeComparableAmount(order.total_amount)
    ) {
      throw AppError.bookingOrderPaymentMismatch(
        'Payment amount does not match booking order total.',
        {
          booking_order_id: order.id,
          payment_id: payment.id,
          order_total_amount: order.total_amount,
          payment_final_amount: payment.final_amount,
        },
      );
    }

    if (payment.currency !== order.currency) {
      throw AppError.bookingOrderPaymentMismatch(
        'Payment currency does not match booking order currency.',
        {
          booking_order_id: order.id,
          payment_id: payment.id,
          order_currency: order.currency,
          payment_currency: payment.currency,
        },
      );
    }
  }

  static assertBookingOrderHasItems(
    order: BookingOrderLifecycleRecord,
    items: readonly BookingOrderItemLifecycleRecord[],
  ): void {
    if (items.length < BOOKING_BULK_MIN_SCHEDULE_COUNT) {
      throw AppError.bookingOrderNotPayable(
        'Booking order must contain at least one booking item.',
        {
          booking_order_id: order.id,
          item_count: items.length,
        },
      );
    }

    if (items.length === order.booking_count) {
      return;
    }

    throw AppError.bookingInvalidStatusTransition(
      'Booking order item count does not match the order booking count.',
      {
        booking_order_id: order.id,
        expected_count: order.booking_count,
        actual_count: items.length,
      },
    );
  }

  static assertBookingOrderItemsBelongToOrder(
    order: BookingOrderLifecycleRecord,
    items: readonly BookingOrderItemLifecycleRecord[],
  ): void {
    const mismatchedItems = items.filter(
      (item) => item.booking_order_id !== order.id,
    );

    if (mismatchedItems.length === 0) {
      return;
    }

    throw AppError.bookingInvalidStatusTransition(
      'Booking order contains items that do not belong to the order.',
      {
        booking_order_id: order.id,
        mismatched_item_ids: mismatchedItems.map((item) => item.id),
      },
    );
  }

  static assertBookingOrderItemsArePendingPayment(
    order: BookingOrderLifecycleRecord,
    items: readonly BookingOrderItemLifecycleRecord[],
  ): void {
    const invalidItems = items.filter(
      (item) => item.status !== BOOKING_ORDER_ITEM_STATUS_PENDING_PAYMENT,
    );

    if (invalidItems.length === 0) {
      return;
    }

    throw AppError.bookingInvalidStatusTransition(
      'All booking order items must be pending payment for this operation.',
      {
        booking_order_id: order.id,
        invalid_item_ids: invalidItems.map((item) => item.id),
        invalid_statuses: invalidItems.map((item) => item.status),
      },
    );
  }

  static assertBookingOrderItemsAreConfirmed(
    order: BookingOrderLifecycleRecord,
    items: readonly BookingOrderItemLifecycleRecord[],
  ): void {
    const invalidItems = items.filter(
      (item) => item.status !== BOOKING_ORDER_ITEM_STATUS_CONFIRMED,
    );

    if (invalidItems.length === 0) {
      return;
    }

    throw AppError.bookingInvalidStatusTransition(
      'All booking order items must be confirmed.',
      {
        booking_order_id: order.id,
        invalid_item_ids: invalidItems.map((item) => item.id),
        invalid_statuses: invalidItems.map((item) => item.status),
      },
    );
  }

  static assertBookingOrderItemsAreExpired(
    order: BookingOrderLifecycleRecord,
    items: readonly BookingOrderItemLifecycleRecord[],
  ): void {
    const invalidItems = items.filter(
      (item) => item.status !== BOOKING_ORDER_ITEM_STATUS_EXPIRED,
    );

    if (invalidItems.length === 0) {
      return;
    }

    throw AppError.bookingInvalidStatusTransition(
      'All booking order items must be expired.',
      {
        booking_order_id: order.id,
        invalid_item_ids: invalidItems.map((item) => item.id),
        invalid_statuses: invalidItems.map((item) => item.status),
      },
    );
  }

  static assertBookingOrderItemPricesAreValid(
    order: BookingOrderLifecycleRecord,
    items: readonly BookingOrderItemLifecycleRecord[],
  ): void {
    for (const item of items) {
      assertFinitePositiveAmount(
        item.price_amount,
        'Booking order item price must be greater than zero.',
        {
          booking_order_id: order.id,
          booking_order_item_id: item.id,
          price_amount: item.price_amount,
        },
      );

      if (item.currency !== order.currency) {
        throw AppError.bookingOrderPaymentMismatch(
          'Booking order item currency does not match order currency.',
          {
            booking_order_id: order.id,
            booking_order_item_id: item.id,
            order_currency: order.currency,
            item_currency: item.currency,
          },
        );
      }
    }

    const itemTotal = normalizeComparableAmount(
      items.reduce((total, item) => total + item.price_amount, 0),
    );

    const orderTotal = normalizeComparableAmount(order.total_amount);

    if (itemTotal === orderTotal) {
      return;
    }

    throw AppError.bookingOrderPaymentMismatch(
      'Booking order item total does not match order total.',
      {
        booking_order_id: order.id,
        order_total_amount: order.total_amount,
        item_total_amount: itemTotal,
      },
    );
  }

  static assertBookingOrderStateIsConsistent(
    order: BookingOrderLifecycleRecord,
  ): void {
    this.assertPaymentRequired(order);
    this.assertBookingOrderAmountIsValid(order);

    if (
      order.status === BOOKING_ORDER_STATUS_PENDING_PAYMENT &&
      order.payment_status !== PAYMENT_STATUS_PENDING
    ) {
      throw AppError.bookingInvalidStatusTransition(
        'Pending booking orders must have pending payment status.',
        toOrderDetails(order),
      );
    }

    if (
      order.status === BOOKING_ORDER_STATUS_PAID &&
      (order.payment_status !== PAYMENT_STATUS_PAID || !hasText(order.paid_at))
    ) {
      throw AppError.bookingInvalidStatusTransition(
        'Paid booking orders must have paid payment status and paid_at timestamp.',
        toOrderDetails(order),
      );
    }

    if (
      order.status === BOOKING_ORDER_STATUS_EXPIRED &&
      (order.payment_status !== PAYMENT_STATUS_EXPIRED ||
        !hasText(order.expired_at))
    ) {
      throw AppError.bookingInvalidStatusTransition(
        'Expired booking orders must have expired payment status and expired_at timestamp.',
        toOrderDetails(order),
      );
    }

    if (
      order.status === BOOKING_ORDER_STATUS_CANCELLED &&
      !hasText(order.cancelled_at)
    ) {
      throw AppError.bookingInvalidStatusTransition(
        'Cancelled booking orders must have a cancelled_at timestamp.',
        toOrderDetails(order),
      );
    }

    if (
      order.status === BOOKING_ORDER_STATUS_REFUNDED &&
      (order.payment_status !== PAYMENT_STATUS_REFUNDED ||
        !hasText(order.paid_at) ||
        !hasText(order.refunded_at))
    ) {
      throw AppError.bookingInvalidStatusTransition(
        'Refunded booking orders must have refunded payment status, paid_at, and refunded_at timestamps.',
        toOrderDetails(order),
      );
    }
  }

  static assertBookingOrderAndItemsAreConsistent(
    order: BookingOrderLifecycleRecord,
    items: readonly BookingOrderItemLifecycleRecord[],
  ): void {
    this.assertBookingOrderStateIsConsistent(order);
    this.assertBookingOrderHasItems(order, items);
    this.assertBookingOrderItemsBelongToOrder(order, items);
    this.assertBookingOrderItemPricesAreValid(order, items);

    if (order.status === BOOKING_ORDER_STATUS_PENDING_PAYMENT) {
      this.assertBookingOrderItemsArePendingPayment(order, items);
      return;
    }

    if (order.status === BOOKING_ORDER_STATUS_PAID) {
      this.assertBookingOrderItemsAreConfirmed(order, items);
      return;
    }

    if (order.status === BOOKING_ORDER_STATUS_EXPIRED) {
      this.assertBookingOrderItemsAreExpired(order, items);
      return;
    }

    if (isTerminalOrderStatus(order.status)) {
      return;
    }

    throw AppError.bookingInvalidStatusTransition(
      'Booking order status is not recognized as a valid lifecycle state.',
      toOrderDetails(order),
    );
  }

  static assertOrderCheckoutRequired(order: BookingOrderLifecycleRecord): void {
    if (
      order.payment_required &&
      order.status === BOOKING_ORDER_STATUS_PENDING_PAYMENT &&
      order.payment_status === PAYMENT_STATUS_PENDING
    ) {
      return;
    }

    throw AppError.bookingOrderNotPayable(
      'Booking order does not require checkout.',
      toOrderDetails(order),
    );
  }

  static assertRpcCreateResultIsConsistent(
    rpc: BookingOrderRpcLifecycleResult,
  ): void {
    if (
      rpc.action_result !== 'created_order' &&
      rpc.action_result !== 'existing_order'
    ) {
      throw AppError.bookingInvalidStatusTransition(
        'Booking order RPC returned an unknown action result.',
        {
          booking_order_id: rpc.booking_order_id,
          action_result: rpc.action_result,
        },
      );
    }

    assertFinitePositiveAmount(
      rpc.total_amount,
      'Booking order RPC returned an invalid total amount.',
      {
        booking_order_id: rpc.booking_order_id,
        total_amount: rpc.total_amount,
      },
    );

    if (!isAllowedCurrency(rpc.currency)) {
      throw AppError.bookingOrderNotPayable(
        'Booking order RPC returned an unsupported currency.',
        {
          booking_order_id: rpc.booking_order_id,
          currency: rpc.currency,
          allowed_currencies: [...BOOKING_ORDER_ALLOWED_CURRENCIES],
        },
      );
    }

    if (rpc.booking_count < BOOKING_BULK_MIN_SCHEDULE_COUNT) {
      throw AppError.bookingInvalidStatusTransition(
        'Booking order RPC returned an invalid booking count.',
        {
          booking_order_id: rpc.booking_order_id,
          booking_count: rpc.booking_count,
        },
      );
    }
  }

  static isBookingOrderTerminal(order: BookingOrderLifecycleRecord): boolean {
    return isTerminalOrderStatus(order.status);
  }

  static isBookingOrderPayable(order: BookingOrderLifecycleRecord): boolean {
    return (
      order.payment_required &&
      isPayableOrderStatus(order.status) &&
      isPayablePaymentStatus(order.payment_status)
    );
  }

  static isPaymentTerminal(
    payment: BookingOrderPaymentLifecycleRecord,
  ): boolean {
    return (
      payment.status === PAYMENT_STATUS_PAID ||
      payment.status === PAYMENT_STATUS_EXPIRED ||
      payment.status === PAYMENT_STATUS_REFUNDED ||
      payment.status === PAYMENT_STATUS_CANCELLED ||
      payment.status === PAYMENT_STATUS_FAILED
    );
  }

  static resolveCheckoutRequired(
    order: BookingOrderLifecycleRecord,
    now: Date = new Date(),
  ): boolean {
    if (!this.isBookingOrderPayable(order)) {
      return false;
    }

    const expiresAt = Date.parse(order.expires_at);

    if (Number.isNaN(expiresAt)) {
      return false;
    }

    return expiresAt > now.getTime();
  }
}
