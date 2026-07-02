// apps/api/src/modules/payments/application/payment-pricing.service.ts
/**
 * LAFAM Payment pricing service.
 *
 * Role:
 * - Resolves trusted backend-owned payment amounts.
 * - Resolves payable booking targets.
 * - Resolves payable booking-order targets for bulk Pilates bookings.
 * - Resolves payable private trainer booking targets.
 * - Validates wallet top-up amount boundaries.
 * - Returns a normalized backend-owned subtotal snapshot for checkout/payment intent creation.
 * - Leaves promo-code discount calculation to PromoCodeCustomerService.
 *
 * Important:
 * - Frontend amount is never trusted.
 * - Booking prices come from the booked schedule/class snapshot.
 * - Booking-order prices come from backend-created booking_order_items.
 * - Private booking prices come from the private booking row.
 * - Wallet top-up amount is customer-provided but strictly bounded.
 * - Promo code discount is recalculated by the Promo Code module, not this service.
 * - Wallet top-ups cannot use promo codes because that would create discounted stored balance.
 */

import { Inject, Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { SUPABASE_ADMIN_CLIENT } from '../../../database/database.constants';
import type {
  BookingOrderItemRow,
  BookingOrderRow,
  BookingRow,
  LAFAMSupabaseClient,
  PilatesClassRow,
  PilatesClassScheduleRow,
  PrivateTrainerBookingRow,
} from '../../../database/database.types';
import {
  BOOKING_ORDER_ITEM_STATUS_PENDING_PAYMENT,
  BOOKING_ORDER_STATUS_PENDING_PAYMENT,
  BOOKING_PAYMENT_STATUS_FAILED,
  BOOKING_PAYMENT_STATUS_PAID,
  BOOKING_PAYMENT_STATUS_PENDING,
  BOOKING_STATUS_PENDING_PAYMENT,
} from '../../bookings/constants/booking.constants';
import {
  PILATES_CLASS_SCHEDULE_STATUS_SCHEDULED,
  PILATES_CLASS_STATUS_ACTIVE,
} from '../../classes/constants/pilates-class.constants';
import {
  PAYMENT_AMOUNT_DECIMAL_PLACES,
  PAYMENT_AMOUNT_MAX,
  PAYMENT_AMOUNT_MIN,
  PAYMENT_DEFAULT_CURRENCY,
  PAYMENT_TARGET_TYPE_BOOKING,
  PAYMENT_TARGET_TYPE_BOOKING_ORDER,
  PAYMENT_TARGET_TYPE_PRIVATE_BOOKING,
  PAYMENT_TARGET_TYPE_WALLET_TOP_UP,
  WALLET_TOP_UP_AMOUNT_MAX,
  WALLET_TOP_UP_AMOUNT_MIN,
  isPaymentCurrency,
  type PaymentCurrency,
} from '../constants/payment.constants';
import { PaymentSecurityPolicy } from '../domain/payment-security.policy';
import type {
  PaymentPriceResolutionInput,
  PaymentPriceResolutionResult,
  PaymentResolvedTargetReference,
} from '../types/payment.types';

interface PaymentTargetAmountResolution {
  readonly target: PaymentResolvedTargetReference;
  readonly amount: number;
  readonly currency: PaymentCurrency;
}

interface BookingTargetPricingContext {
  readonly booking: BookingRow;
  readonly schedule: PilatesClassScheduleRow;
  readonly pilates_class: PilatesClassRow;
}

interface BookingOrderTargetPricingContext {
  readonly booking_order: BookingOrderRow;
  readonly items: readonly BookingOrderItemRow[];
}

const PAYMENT_AMOUNT_SCALE = 10 ** PAYMENT_AMOUNT_DECIMAL_PLACES;

function roundPaymentAmount(value: number): number {
  return Math.round(value * PAYMENT_AMOUNT_SCALE) / PAYMENT_AMOUNT_SCALE;
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeOptionalPromoCode(
  promoCode: string | null | undefined,
): string | null {
  if (!hasText(promoCode)) {
    return null;
  }

  return promoCode.trim().toUpperCase();
}

function assertPromoCodeNotUsedForWalletTopUp(
  input: PaymentPriceResolutionInput,
): void {
  const normalizedPromoCode = normalizeOptionalPromoCode(input.promo_code);

  if (normalizedPromoCode === null) {
    return;
  }

  if (input.target_type !== PAYMENT_TARGET_TYPE_WALLET_TOP_UP) {
    return;
  }

  throw AppError.promoCodeInvalid(
    'Promo codes cannot be used for wallet top-ups.',
    {
      promo_code: normalizedPromoCode,
      target_type: input.target_type,
    },
  );
}

function normalizeCurrency(
  currency: string | null | undefined,
  details: Record<string, unknown>,
): PaymentCurrency {
  const normalizedCurrency = hasText(currency)
    ? currency.trim().toUpperCase()
    : PAYMENT_DEFAULT_CURRENCY;

  if (isPaymentCurrency(normalizedCurrency)) {
    return normalizedCurrency;
  }

  throw AppError.paymentCurrencyUnsupported('Payment currency must be KWD.', {
    ...details,
    currency: normalizedCurrency,
  });
}

function assertRequestedCurrencyMatches(
  requestedCurrency: PaymentCurrency | undefined,
  resolvedCurrency: PaymentCurrency,
): void {
  if (
    typeof requestedCurrency === 'undefined' ||
    requestedCurrency === resolvedCurrency
  ) {
    return;
  }

  throw AppError.paymentCurrencyUnsupported(
    'Requested payment currency does not match resolved target currency.',
    {
      requested_currency: requestedCurrency,
      resolved_currency: resolvedCurrency,
    },
  );
}

function assertAmountRange(
  amount: number,
  details: Record<string, unknown>,
): void {
  if (!Number.isFinite(amount)) {
    throw AppError.paymentAmountInvalid(
      'Payment amount must be a finite number.',
      {
        ...details,
        amount,
      },
    );
  }

  if (amount < PAYMENT_AMOUNT_MIN || amount > PAYMENT_AMOUNT_MAX) {
    throw AppError.paymentAmountInvalid(
      `Payment amount must be between ${PAYMENT_AMOUNT_MIN} and ${PAYMENT_AMOUNT_MAX}.`,
      {
        ...details,
        amount,
        min_amount: PAYMENT_AMOUNT_MIN,
        max_amount: PAYMENT_AMOUNT_MAX,
      },
    );
  }
}

function assertWalletTopUpAmountRange(amount: number): void {
  if (!Number.isFinite(amount)) {
    throw AppError.paymentAmountInvalid(
      'Wallet top-up amount must be a finite number.',
      {
        wallet_top_up_amount: amount,
      },
    );
  }

  if (amount < WALLET_TOP_UP_AMOUNT_MIN || amount > WALLET_TOP_UP_AMOUNT_MAX) {
    throw AppError.paymentAmountInvalid(
      `Wallet top-up amount must be between ${WALLET_TOP_UP_AMOUNT_MIN} and ${WALLET_TOP_UP_AMOUNT_MAX}.`,
      {
        wallet_top_up_amount: amount,
        min_amount: WALLET_TOP_UP_AMOUNT_MIN,
        max_amount: WALLET_TOP_UP_AMOUNT_MAX,
      },
    );
  }
}

function assertSeatHoldStillValid(
  expiresAt: string | null,
  details: Record<string, unknown>,
): void {
  if (!hasText(expiresAt)) {
    return;
  }

  const expiresAtMs = Date.parse(expiresAt);

  if (!Number.isFinite(expiresAtMs)) {
    throw AppError.paymentNotPayable(
      'Payment hold expiry timestamp is invalid.',
      {
        ...details,
        seat_hold_expires_at: expiresAt,
      },
    );
  }

  if (expiresAtMs >= Date.now()) {
    return;
  }

  throw AppError.paymentExpired('Payment hold has expired.', {
    ...details,
    seat_hold_expires_at: expiresAt,
  });
}

function sumBookingOrderItems(
  bookingOrder: BookingOrderRow,
  items: readonly BookingOrderItemRow[],
): number {
  if (items.length === 0) {
    throw AppError.paymentTargetInvalid(
      'Booking order payment target has no order items.',
      {
        booking_order_id: bookingOrder.id,
      },
    );
  }

  const totalAmount = items.reduce((sum, item) => {
    if (item.booking_order_id !== bookingOrder.id) {
      throw AppError.paymentTargetInvalid(
        'Booking order item does not belong to the requested booking order.',
        {
          booking_order_id: bookingOrder.id,
          item_id: item.id,
          item_booking_order_id: item.booking_order_id,
        },
      );
    }

    if (item.status !== BOOKING_ORDER_ITEM_STATUS_PENDING_PAYMENT) {
      throw AppError.paymentNotPayable(
        'Only pending-payment booking order items can be paid.',
        {
          booking_order_id: bookingOrder.id,
          item_id: item.id,
          item_status: item.status,
        },
      );
    }

    const itemCurrency = normalizeCurrency(item.currency, {
      booking_order_id: bookingOrder.id,
      item_id: item.id,
      schedule_id: item.schedule_id,
    });

    const orderCurrency = normalizeCurrency(bookingOrder.currency, {
      booking_order_id: bookingOrder.id,
    });

    if (itemCurrency !== orderCurrency) {
      throw AppError.paymentCurrencyUnsupported(
        'Booking order item currency does not match order currency.',
        {
          booking_order_id: bookingOrder.id,
          item_id: item.id,
          item_currency: itemCurrency,
          order_currency: orderCurrency,
        },
      );
    }

    assertAmountRange(item.price_amount, {
      booking_order_id: bookingOrder.id,
      item_id: item.id,
      schedule_id: item.schedule_id,
    });

    return sum + item.price_amount;
  }, 0);

  return roundPaymentAmount(totalAmount);
}

@Injectable()
export class PaymentPricingService {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly adminClient: LAFAMSupabaseClient,
  ) {}

  async resolveCheckoutPricing(
    input: PaymentPriceResolutionInput,
  ): Promise<PaymentPriceResolutionResult> {
    return this.resolvePrice(input);
  }

  async resolvePrice(
    input: PaymentPriceResolutionInput,
  ): Promise<PaymentPriceResolutionResult> {
    assertPromoCodeNotUsedForWalletTopUp(input);

    const targetAmount = await this.resolveTargetAmount(input);

    assertRequestedCurrencyMatches(input.currency, targetAmount.currency);

    const discountAmount = 0;
    const finalAmount = targetAmount.amount;

    PaymentSecurityPolicy.assertAmountIntegrity({
      amount: targetAmount.amount,
      discount_amount: discountAmount,
      final_amount: finalAmount,
    });

    return {
      target: targetAmount.target,
      amount: targetAmount.amount,
      discount_amount: discountAmount,
      final_amount: finalAmount,
      currency: targetAmount.currency,
      promo_code_id: null,
      promo_code: null,
      promo_code_redemption_id: null,
      discount_metadata: {},
    };
  }

  private async resolveTargetAmount(
    input: PaymentPriceResolutionInput,
  ): Promise<PaymentTargetAmountResolution> {
    if (input.target_type === PAYMENT_TARGET_TYPE_BOOKING) {
      return this.resolveBookingTargetAmount(input);
    }

    if (input.target_type === PAYMENT_TARGET_TYPE_PRIVATE_BOOKING) {
      return this.resolvePrivateBookingTargetAmount(input);
    }

    if (input.target_type === PAYMENT_TARGET_TYPE_BOOKING_ORDER) {
      return this.resolveBookingOrderTargetAmount(input);
    }

    if (input.target_type === PAYMENT_TARGET_TYPE_WALLET_TOP_UP) {
      return this.resolveWalletTopUpTargetAmount(input);
    }

    throw AppError.paymentTargetInvalid('Unsupported payment target type.', {
      target_type: input.target_type,
    });
  }

  private async resolveBookingTargetAmount(
    input: PaymentPriceResolutionInput,
  ): Promise<PaymentTargetAmountResolution> {
    if (!hasText(input.booking_id)) {
      throw AppError.paymentTargetInvalid(
        'booking_id is required for booking payment.',
        {
          target_type: input.target_type,
        },
      );
    }

    if (hasText(input.private_booking_id) || hasText(input.booking_order_id)) {
      throw AppError.paymentTargetInvalid(
        'Only booking_id is allowed for booking payment.',
        {
          target_type: input.target_type,
          booking_id: input.booking_id,
          private_booking_id: input.private_booking_id ?? null,
          booking_order_id: input.booking_order_id ?? null,
        },
      );
    }

    const context = await this.getBookingPricingContext(input.booking_id);

    this.assertBookingPayable(context.booking, input.user_id);
    this.assertSchedulePayable(context.schedule);
    this.assertClassPayable(context.pilates_class);

    const currency = normalizeCurrency(
      context.schedule.currency ?? context.pilates_class.currency,
      {
        target_type: input.target_type,
        booking_id: context.booking.id,
        schedule_id: context.schedule.id,
        class_id: context.pilates_class.id,
      },
    );

    const amount = roundPaymentAmount(
      context.schedule.price_amount ??
        context.pilates_class.default_price_amount,
    );

    assertAmountRange(amount, {
      target_type: input.target_type,
      booking_id: context.booking.id,
      schedule_id: context.schedule.id,
      class_id: context.pilates_class.id,
    });

    return {
      target: {
        target_type: PAYMENT_TARGET_TYPE_BOOKING,
        booking_id: context.booking.id,
        private_booking_id: null,
        booking_order_id: null,
      },
      amount,
      currency,
    };
  }

  private async resolvePrivateBookingTargetAmount(
    input: PaymentPriceResolutionInput,
  ): Promise<PaymentTargetAmountResolution> {
    if (!hasText(input.private_booking_id)) {
      throw AppError.paymentTargetInvalid(
        'private_booking_id is required for private booking payment.',
        {
          target_type: input.target_type,
        },
      );
    }

    if (hasText(input.booking_id) || hasText(input.booking_order_id)) {
      throw AppError.paymentTargetInvalid(
        'Only private_booking_id is allowed for private booking payment.',
        {
          target_type: input.target_type,
          booking_id: input.booking_id ?? null,
          private_booking_id: input.private_booking_id,
          booking_order_id: input.booking_order_id ?? null,
        },
      );
    }

    const privateBooking = await this.getPrivateBooking(
      input.private_booking_id,
    );

    this.assertPrivateBookingPayable(privateBooking, input.user_id);

    const currency = normalizeCurrency(privateBooking.currency, {
      target_type: input.target_type,
      private_booking_id: privateBooking.id,
    });

    const amount = roundPaymentAmount(privateBooking.price_amount);

    assertAmountRange(amount, {
      target_type: input.target_type,
      private_booking_id: privateBooking.id,
    });

    return {
      target: {
        target_type: PAYMENT_TARGET_TYPE_PRIVATE_BOOKING,
        booking_id: null,
        private_booking_id: privateBooking.id,
        booking_order_id: null,
      },
      amount,
      currency,
    };
  }

  private async resolveBookingOrderTargetAmount(
    input: PaymentPriceResolutionInput,
  ): Promise<PaymentTargetAmountResolution> {
    if (!hasText(input.booking_order_id)) {
      throw AppError.paymentTargetInvalid(
        'booking_order_id is required for booking order payment.',
        {
          target_type: input.target_type,
        },
      );
    }

    if (hasText(input.booking_id) || hasText(input.private_booking_id)) {
      throw AppError.paymentTargetInvalid(
        'Only booking_order_id is allowed for booking order payment.',
        {
          target_type: input.target_type,
          booking_id: input.booking_id ?? null,
          private_booking_id: input.private_booking_id ?? null,
          booking_order_id: input.booking_order_id,
        },
      );
    }

    const context = await this.getBookingOrderPricingContext(
      input.booking_order_id,
    );

    this.assertBookingOrderPayable(context.booking_order, input.user_id);

    const currency = normalizeCurrency(context.booking_order.currency, {
      target_type: input.target_type,
      booking_order_id: context.booking_order.id,
    });

    const amount = sumBookingOrderItems(context.booking_order, context.items);

    assertAmountRange(amount, {
      target_type: input.target_type,
      booking_order_id: context.booking_order.id,
    });

    const orderTotalAmount = roundPaymentAmount(
      context.booking_order.total_amount,
    );

    if (orderTotalAmount !== amount) {
      throw AppError.paymentAmountInvalid(
        'Booking order total does not match its order items.',
        {
          target_type: input.target_type,
          booking_order_id: context.booking_order.id,
          order_total_amount: orderTotalAmount,
          item_total_amount: amount,
        },
      );
    }

    return {
      target: {
        target_type: PAYMENT_TARGET_TYPE_BOOKING_ORDER,
        booking_id: null,
        private_booking_id: null,
        booking_order_id: context.booking_order.id,
      },
      amount,
      currency,
    };
  }

  private resolveWalletTopUpTargetAmount(
    input: PaymentPriceResolutionInput,
  ): PaymentTargetAmountResolution {
    if (
      hasText(input.booking_id) ||
      hasText(input.private_booking_id) ||
      hasText(input.booking_order_id)
    ) {
      throw AppError.paymentTargetInvalid(
        'Booking identifiers are not allowed for wallet top-up payment.',
        {
          target_type: input.target_type,
          booking_id: input.booking_id ?? null,
          private_booking_id: input.private_booking_id ?? null,
          booking_order_id: input.booking_order_id ?? null,
        },
      );
    }

    if (typeof input.wallet_top_up_amount !== 'number') {
      throw AppError.paymentAmountInvalid(
        'wallet_top_up_amount is required for wallet top-up payment.',
        {
          target_type: input.target_type,
        },
      );
    }

    const amount = roundPaymentAmount(input.wallet_top_up_amount);

    assertWalletTopUpAmountRange(amount);

    const currency = input.currency ?? PAYMENT_DEFAULT_CURRENCY;

    if (currency !== PAYMENT_DEFAULT_CURRENCY) {
      throw AppError.paymentCurrencyUnsupported(
        'Wallet top-up currency must be KWD.',
        {
          target_type: input.target_type,
          currency,
        },
      );
    }

    return {
      target: {
        target_type: PAYMENT_TARGET_TYPE_WALLET_TOP_UP,
        booking_id: null,
        private_booking_id: null,
        booking_order_id: null,
      },
      amount,
      currency,
    };
  }

  private async getBookingPricingContext(
    bookingId: string,
  ): Promise<BookingTargetPricingContext> {
    const booking = await this.getBooking(bookingId);
    const schedule = await this.getSchedule(booking.schedule_id);
    const pilatesClass = await this.getPilatesClass(booking.class_id);

    if (schedule.class_id !== pilatesClass.id) {
      throw AppError.paymentTargetInvalid(
        'Booking schedule does not belong to the booking class.',
        {
          booking_id: booking.id,
          schedule_id: schedule.id,
          booking_class_id: booking.class_id,
          schedule_class_id: schedule.class_id,
        },
      );
    }

    return {
      booking,
      schedule,
      pilates_class: pilatesClass,
    };
  }

  private async getBookingOrderPricingContext(
    bookingOrderId: string,
  ): Promise<BookingOrderTargetPricingContext> {
    const bookingOrder = await this.getBookingOrder(bookingOrderId);
    const items = await this.getBookingOrderItems(bookingOrderId);

    return {
      booking_order: bookingOrder,
      items,
    };
  }

  private async getBooking(bookingId: string): Promise<BookingRow> {
    const { data, error } = await this.adminClient
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle();

    if (error) {
      throw AppError.databaseOperationFailed(error);
    }

    if (!data) {
      throw AppError.paymentTargetInvalid(
        'Booking payment target was not found.',
        {
          booking_id: bookingId,
        },
      );
    }

    return data;
  }

  private async getBookingOrder(
    bookingOrderId: string,
  ): Promise<BookingOrderRow> {
    const { data, error } = await this.adminClient
      .from('booking_orders')
      .select('*')
      .eq('id', bookingOrderId)
      .maybeSingle();

    if (error) {
      throw AppError.databaseOperationFailed(error);
    }

    if (!data) {
      throw AppError.paymentTargetInvalid(
        'Booking order payment target was not found.',
        {
          booking_order_id: bookingOrderId,
        },
      );
    }

    return data;
  }

  private async getBookingOrderItems(
    bookingOrderId: string,
  ): Promise<readonly BookingOrderItemRow[]> {
    const { data, error } = await this.adminClient
      .from('booking_order_items')
      .select('*')
      .eq('booking_order_id', bookingOrderId)
      .order('created_at', {
        ascending: true,
      });

    if (error) {
      throw AppError.databaseOperationFailed(error);
    }

    return data ?? [];
  }

  private async getPrivateBooking(
    privateBookingId: string,
  ): Promise<PrivateTrainerBookingRow> {
    const { data, error } = await this.adminClient
      .from('private_trainer_bookings')
      .select('*')
      .eq('id', privateBookingId)
      .maybeSingle();

    if (error) {
      throw AppError.databaseOperationFailed(error);
    }

    if (!data) {
      throw AppError.paymentTargetInvalid(
        'Private booking payment target was not found.',
        {
          private_booking_id: privateBookingId,
        },
      );
    }

    return data;
  }

  private async getSchedule(
    scheduleId: string,
  ): Promise<PilatesClassScheduleRow> {
    const { data, error } = await this.adminClient
      .from('pilates_class_schedules')
      .select('*')
      .eq('id', scheduleId)
      .maybeSingle();

    if (error) {
      throw AppError.databaseOperationFailed(error);
    }

    if (!data) {
      throw AppError.paymentTargetInvalid(
        'Booking schedule payment source was not found.',
        {
          schedule_id: scheduleId,
        },
      );
    }

    return data;
  }

  private async getPilatesClass(classId: string): Promise<PilatesClassRow> {
    const { data, error } = await this.adminClient
      .from('pilates_classes')
      .select('*')
      .eq('id', classId)
      .maybeSingle();

    if (error) {
      throw AppError.databaseOperationFailed(error);
    }

    if (!data) {
      throw AppError.paymentTargetInvalid(
        'Pilates class payment source was not found.',
        {
          class_id: classId,
        },
      );
    }

    return data;
  }

  private assertBookingPayable(booking: BookingRow, userId: string): void {
    if (booking.user_id !== userId) {
      throw AppError.paymentAccessDenied(
        'You are not allowed to pay for this booking.',
        {
          booking_id: booking.id,
          user_id: userId,
        },
      );
    }

    if (booking.deleted_at !== null) {
      throw AppError.paymentNotPayable('Deleted bookings cannot be paid.', {
        booking_id: booking.id,
      });
    }

    if (!booking.payment_required) {
      throw AppError.paymentNotPayable(
        'This booking does not require payment.',
        {
          booking_id: booking.id,
          payment_required: booking.payment_required,
          payment_status: booking.payment_status,
        },
      );
    }

    if (booking.status !== BOOKING_STATUS_PENDING_PAYMENT) {
      throw AppError.paymentNotPayable(
        'Only pending-payment bookings can be paid.',
        {
          booking_id: booking.id,
          booking_status: booking.status,
          payment_status: booking.payment_status,
        },
      );
    }

    if (booking.payment_status === BOOKING_PAYMENT_STATUS_PAID) {
      throw AppError.paymentAlreadyPaid('This booking has already been paid.', {
        booking_id: booking.id,
        payment_status: booking.payment_status,
      });
    }

    if (
      booking.payment_status !== BOOKING_PAYMENT_STATUS_PENDING &&
      booking.payment_status !== BOOKING_PAYMENT_STATUS_FAILED
    ) {
      throw AppError.paymentNotPayable(
        'Booking payment status is not payable.',
        {
          booking_id: booking.id,
          payment_status: booking.payment_status,
        },
      );
    }

    assertSeatHoldStillValid(booking.seat_hold_expires_at, {
      booking_id: booking.id,
      target_type: PAYMENT_TARGET_TYPE_BOOKING,
    });
  }

  private assertBookingOrderPayable(
    bookingOrder: BookingOrderRow,
    userId: string,
  ): void {
    if (bookingOrder.customer_user_id !== userId) {
      throw AppError.paymentAccessDenied(
        'You are not allowed to pay for this booking order.',
        {
          booking_order_id: bookingOrder.id,
          user_id: userId,
        },
      );
    }

    if (!bookingOrder.payment_required) {
      throw AppError.paymentNotPayable(
        'This booking order does not require payment.',
        {
          booking_order_id: bookingOrder.id,
          payment_required: bookingOrder.payment_required,
          payment_status: bookingOrder.payment_status,
        },
      );
    }

    if (bookingOrder.status !== BOOKING_ORDER_STATUS_PENDING_PAYMENT) {
      throw AppError.paymentNotPayable(
        'Only pending-payment booking orders can be paid.',
        {
          booking_order_id: bookingOrder.id,
          booking_order_status: bookingOrder.status,
          payment_status: bookingOrder.payment_status,
        },
      );
    }

    if (bookingOrder.payment_status === BOOKING_PAYMENT_STATUS_PAID) {
      throw AppError.paymentAlreadyPaid(
        'This booking order has already been paid.',
        {
          booking_order_id: bookingOrder.id,
          payment_status: bookingOrder.payment_status,
        },
      );
    }

    if (
      bookingOrder.payment_status !== BOOKING_PAYMENT_STATUS_PENDING &&
      bookingOrder.payment_status !== BOOKING_PAYMENT_STATUS_FAILED
    ) {
      throw AppError.paymentNotPayable(
        'Booking order payment status is not payable.',
        {
          booking_order_id: bookingOrder.id,
          payment_status: bookingOrder.payment_status,
        },
      );
    }

    assertSeatHoldStillValid(bookingOrder.expires_at, {
      booking_order_id: bookingOrder.id,
      target_type: PAYMENT_TARGET_TYPE_BOOKING_ORDER,
    });
  }

  private assertPrivateBookingPayable(
    privateBooking: PrivateTrainerBookingRow,
    userId: string,
  ): void {
    if (privateBooking.user_id !== userId) {
      throw AppError.paymentAccessDenied(
        'You are not allowed to pay for this private booking.',
        {
          private_booking_id: privateBooking.id,
          user_id: userId,
        },
      );
    }

    if (privateBooking.deleted_at !== null) {
      throw AppError.paymentNotPayable(
        'Deleted private bookings cannot be paid.',
        {
          private_booking_id: privateBooking.id,
        },
      );
    }

    if (!privateBooking.payment_required) {
      throw AppError.paymentNotPayable(
        'This private booking does not require payment.',
        {
          private_booking_id: privateBooking.id,
          payment_required: privateBooking.payment_required,
          payment_status: privateBooking.payment_status,
        },
      );
    }

    if (privateBooking.status !== BOOKING_STATUS_PENDING_PAYMENT) {
      throw AppError.paymentNotPayable(
        'Only pending-payment private bookings can be paid.',
        {
          private_booking_id: privateBooking.id,
          booking_status: privateBooking.status,
          payment_status: privateBooking.payment_status,
        },
      );
    }

    if (privateBooking.payment_status === BOOKING_PAYMENT_STATUS_PAID) {
      throw AppError.paymentAlreadyPaid(
        'This private booking has already been paid.',
        {
          private_booking_id: privateBooking.id,
          payment_status: privateBooking.payment_status,
        },
      );
    }

    if (
      privateBooking.payment_status !== BOOKING_PAYMENT_STATUS_PENDING &&
      privateBooking.payment_status !== BOOKING_PAYMENT_STATUS_FAILED
    ) {
      throw AppError.paymentNotPayable(
        'Private booking payment status is not payable.',
        {
          private_booking_id: privateBooking.id,
          payment_status: privateBooking.payment_status,
        },
      );
    }

    assertSeatHoldStillValid(privateBooking.seat_hold_expires_at, {
      private_booking_id: privateBooking.id,
      target_type: PAYMENT_TARGET_TYPE_PRIVATE_BOOKING,
    });
  }

  private assertSchedulePayable(schedule: PilatesClassScheduleRow): void {
    if (schedule.deleted_at !== null) {
      throw AppError.paymentNotPayable(
        'Deleted Pilates schedules cannot be paid.',
        {
          schedule_id: schedule.id,
        },
      );
    }

    if (schedule.status !== PILATES_CLASS_SCHEDULE_STATUS_SCHEDULED) {
      throw AppError.paymentNotPayable(
        'Only scheduled Pilates classes can be paid.',
        {
          schedule_id: schedule.id,
          schedule_status: schedule.status,
        },
      );
    }
  }

  private assertClassPayable(pilatesClass: PilatesClassRow): void {
    if (pilatesClass.deleted_at !== null) {
      throw AppError.paymentNotPayable(
        'Deleted Pilates classes cannot be paid.',
        {
          class_id: pilatesClass.id,
        },
      );
    }

    if (pilatesClass.status !== PILATES_CLASS_STATUS_ACTIVE) {
      throw AppError.paymentNotPayable(
        'Only active Pilates classes can be paid.',
        {
          class_id: pilatesClass.id,
          class_status: pilatesClass.status,
        },
      );
    }
  }
}
