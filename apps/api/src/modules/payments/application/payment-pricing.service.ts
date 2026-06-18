// apps/api/src/modules/payments/application/payment-pricing.service.ts
/**
 * LAFAM Payment pricing service.
 *
 * Role:
 * - Resolves trusted backend-owned payment amounts.
 * - Resolves payable booking targets.
 * - Resolves payable private trainer booking targets.
 * - Validates wallet top-up amount boundaries.
 * - Applies basic promo-code discounts server-side.
 * - Returns a normalized price snapshot for checkout/payment intent creation.
 *
 * Important:
 * - Frontend amount is never trusted.
 * - Booking prices come from the booked schedule/class snapshot.
 * - Private booking prices come from the private booking row.
 * - Wallet top-up amount is customer-provided but strictly bounded.
 * - Promo code discount is recalculated by the backend.
 * - Wallet top-ups cannot use promo codes because that would create discounted stored balance.
 */

import { Inject, Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { SUPABASE_ADMIN_CLIENT } from '../../../database/database.constants';
import type {
  BookingRow,
  DatabaseJsonObject,
  LAFAMSupabaseClient,
  PilatesClassRow,
  PilatesClassScheduleRow,
  PrivateTrainerBookingRow,
} from '../../../database/database.types';
import {
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
  PAYMENT_TARGET_TYPE_PRIVATE_BOOKING,
  PAYMENT_TARGET_TYPE_WALLET_TOP_UP,
  PROMO_CODE_PERCENTAGE_MAX,
  PROMO_DISCOUNT_TYPE_FIXED_AMOUNT,
  PROMO_DISCOUNT_TYPE_PERCENTAGE,
  WALLET_TOP_UP_AMOUNT_MAX,
  WALLET_TOP_UP_AMOUNT_MIN,
  isPaymentCurrency,
  type PaymentCurrency,
  type PaymentTargetType,
} from '../constants/payment.constants';
import { PaymentSecurityPolicy } from '../domain/payment-security.policy';
import { PaymentRepository } from '../repositories/payment.repository';
import type {
  PaymentPriceResolutionInput,
  PaymentPriceResolutionResult,
  PaymentResolvedTargetReference,
  PromoCodeRecord,
} from '../types/payment.types';

interface PaymentTargetAmountResolution {
  readonly target: PaymentResolvedTargetReference;
  readonly amount: number;
  readonly currency: PaymentCurrency;
}

interface PromoDiscountResolution {
  readonly promo_code_id: string | null;
  readonly promo_code: string | null;
  readonly discount_amount: number;
  readonly discount_metadata: DatabaseJsonObject;
}

interface BookingTargetPricingContext {
  readonly booking: BookingRow;
  readonly schedule: PilatesClassScheduleRow;
  readonly pilates_class: PilatesClassRow;
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

function parseIsoTime(value: string | null): number | null {
  if (!hasText(value)) {
    return null;
  }

  const parsed = Date.parse(value);

  return Number.isFinite(parsed) ? parsed : null;
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

function calculateFixedPromoDiscount(
  amount: number,
  promoCode: PromoCodeRecord,
): number {
  return Math.min(amount, promoCode.discount_value);
}

function calculatePercentagePromoDiscount(
  amount: number,
  promoCode: PromoCodeRecord,
): number {
  if (
    promoCode.discount_value <= 0 ||
    promoCode.discount_value > PROMO_CODE_PERCENTAGE_MAX
  ) {
    throw AppError.promoCodeInvalid(
      'Promo code percentage discount is invalid.',
      {
        promo_code_id: promoCode.id,
        code: promoCode.code,
        discount_value: promoCode.discount_value,
      },
    );
  }

  const percentageDiscount = roundPaymentAmount(
    (amount * promoCode.discount_value) / 100,
  );

  if (typeof promoCode.max_discount_amount === 'number') {
    return Math.min(percentageDiscount, promoCode.max_discount_amount);
  }

  return percentageDiscount;
}

function calculatePromoDiscount(
  amount: number,
  promoCode: PromoCodeRecord,
): number {
  if (promoCode.discount_type === PROMO_DISCOUNT_TYPE_FIXED_AMOUNT) {
    return calculateFixedPromoDiscount(amount, promoCode);
  }

  if (promoCode.discount_type === PROMO_DISCOUNT_TYPE_PERCENTAGE) {
    return calculatePercentagePromoDiscount(amount, promoCode);
  }

  throw AppError.promoCodeInvalid('Promo code discount type is unsupported.', {
    promo_code_id: promoCode.id,
    code: promoCode.code,
    discount_type: promoCode.discount_type,
  });
}

@Injectable()
export class PaymentPricingService {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly adminClient: LAFAMSupabaseClient,
    private readonly paymentRepository: PaymentRepository,
  ) {}

  async resolveCheckoutPricing(
    input: PaymentPriceResolutionInput,
  ): Promise<PaymentPriceResolutionResult> {
    return this.resolvePrice(input);
  }

  async resolvePrice(
    input: PaymentPriceResolutionInput,
  ): Promise<PaymentPriceResolutionResult> {
    const targetAmount = await this.resolveTargetAmount(input);

    assertRequestedCurrencyMatches(input.currency, targetAmount.currency);

    const promoDiscount = await this.resolvePromoDiscount({
      user_id: input.user_id,
      target_type: input.target_type,
      promo_code: input.promo_code,
      amount: targetAmount.amount,
    });

    const finalAmount = roundPaymentAmount(
      targetAmount.amount - promoDiscount.discount_amount,
    );

    PaymentSecurityPolicy.assertAmountIntegrity({
      amount: targetAmount.amount,
      discount_amount: promoDiscount.discount_amount,
      final_amount: finalAmount,
    });

    return {
      target: targetAmount.target,
      amount: targetAmount.amount,
      discount_amount: promoDiscount.discount_amount,
      final_amount: finalAmount,
      currency: targetAmount.currency,
      promo_code_id: promoDiscount.promo_code_id,
      promo_code: promoDiscount.promo_code,
      discount_metadata: promoDiscount.discount_metadata,
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

    if (hasText(input.private_booking_id)) {
      throw AppError.paymentTargetInvalid(
        'private_booking_id is not allowed for booking payment.',
        {
          target_type: input.target_type,
          booking_id: input.booking_id,
          private_booking_id: input.private_booking_id,
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

    if (hasText(input.booking_id)) {
      throw AppError.paymentTargetInvalid(
        'booking_id is not allowed for private booking payment.',
        {
          target_type: input.target_type,
          booking_id: input.booking_id,
          private_booking_id: input.private_booking_id,
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
      },
      amount,
      currency,
    };
  }

  private resolveWalletTopUpTargetAmount(
    input: PaymentPriceResolutionInput,
  ): PaymentTargetAmountResolution {
    if (hasText(input.booking_id) || hasText(input.private_booking_id)) {
      throw AppError.paymentTargetInvalid(
        'Booking identifiers are not allowed for wallet top-up payment.',
        {
          target_type: input.target_type,
          booking_id: input.booking_id ?? null,
          private_booking_id: input.private_booking_id ?? null,
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

  private async resolvePromoDiscount(input: {
    readonly user_id: string;
    readonly target_type: PaymentTargetType;
    readonly promo_code?: string | null;
    readonly amount: number;
  }): Promise<PromoDiscountResolution> {
    const normalizedPromoCode = normalizeOptionalPromoCode(input.promo_code);

    if (normalizedPromoCode === null) {
      return {
        promo_code_id: null,
        promo_code: null,
        discount_amount: 0,
        discount_metadata: {},
      };
    }

    if (input.target_type === PAYMENT_TARGET_TYPE_WALLET_TOP_UP) {
      throw AppError.promoCodeInvalid(
        'Promo codes cannot be used for wallet top-ups.',
        {
          promo_code: normalizedPromoCode,
          target_type: input.target_type,
        },
      );
    }

    const promoCode =
      await this.paymentRepository.findActivePromoCodeByCode(
        normalizedPromoCode,
      );

    if (!promoCode) {
      throw AppError.promoCodeInvalid('Promo code was not found.', {
        promo_code: normalizedPromoCode,
      });
    }

    await this.assertPromoCodeUsable({
      promo_code: promoCode,
      user_id: input.user_id,
    });

    const discountAmount = roundPaymentAmount(
      calculatePromoDiscount(input.amount, promoCode),
    );

    if (discountAmount <= 0) {
      throw AppError.promoCodeInvalid(
        'Promo code does not produce a valid discount.',
        {
          promo_code_id: promoCode.id,
          code: promoCode.code,
          discount_amount: discountAmount,
        },
      );
    }

    const boundedDiscountAmount = Math.min(discountAmount, input.amount);
    const finalAmount = roundPaymentAmount(
      input.amount - boundedDiscountAmount,
    );

    if (finalAmount < PAYMENT_AMOUNT_MIN) {
      throw AppError.promoCodeInvalid(
        'Promo code discount cannot reduce payment below the minimum payable amount.',
        {
          promo_code_id: promoCode.id,
          code: promoCode.code,
          amount: input.amount,
          discount_amount: boundedDiscountAmount,
          final_amount: finalAmount,
          minimum_payable_amount: PAYMENT_AMOUNT_MIN,
        },
      );
    }

    return {
      promo_code_id: promoCode.id,
      promo_code: promoCode.code,
      discount_amount: boundedDiscountAmount,
      discount_metadata: {
        promo_code_id: promoCode.id,
        code: promoCode.code,
        discount_type: promoCode.discount_type,
        discount_value: promoCode.discount_value,
        max_discount_amount: promoCode.max_discount_amount,
        calculated_discount_amount: boundedDiscountAmount,
      },
    };
  }

  private async assertPromoCodeUsable(input: {
    readonly promo_code: PromoCodeRecord;
    readonly user_id: string;
  }): Promise<void> {
    const promoCode = input.promo_code;

    if (promoCode.deleted_at !== null) {
      throw AppError.promoCodeInvalid('Promo code was deleted.', {
        promo_code_id: promoCode.id,
        code: promoCode.code,
      });
    }

    const startsAtMs = parseIsoTime(promoCode.starts_at);

    if (startsAtMs !== null && startsAtMs > Date.now()) {
      throw AppError.promoCodeInvalid('Promo code is not active yet.', {
        promo_code_id: promoCode.id,
        code: promoCode.code,
        starts_at: promoCode.starts_at,
      });
    }

    const endsAtMs = parseIsoTime(promoCode.ends_at);

    if (endsAtMs !== null && endsAtMs < Date.now()) {
      throw AppError.promoCodeExpired('Promo code has expired.', {
        promo_code_id: promoCode.id,
        code: promoCode.code,
        ends_at: promoCode.ends_at,
      });
    }

    if (
      typeof promoCode.max_redemptions === 'number' &&
      promoCode.redemption_count >= promoCode.max_redemptions
    ) {
      throw AppError.promoCodeInvalid(
        'Promo code redemption limit has been reached.',
        {
          promo_code_id: promoCode.id,
          code: promoCode.code,
          redemption_count: promoCode.redemption_count,
          max_redemptions: promoCode.max_redemptions,
        },
      );
    }

    if (
      typeof promoCode.per_user_limit === 'number' &&
      promoCode.per_user_limit > 0
    ) {
      const userRedemptionCount = await this.countPromoRedemptionsForUser({
        promo_code_id: promoCode.id,
        user_id: input.user_id,
      });

      if (userRedemptionCount >= promoCode.per_user_limit) {
        throw AppError.promoCodeInvalid(
          'Promo code user redemption limit has been reached.',
          {
            promo_code_id: promoCode.id,
            code: promoCode.code,
            user_id: input.user_id,
            user_redemption_count: userRedemptionCount,
            per_user_limit: promoCode.per_user_limit,
          },
        );
      }
    }
  }

  private async countPromoRedemptionsForUser(input: {
    readonly promo_code_id: string;
    readonly user_id: string;
  }): Promise<number> {
    const { count, error } = await this.adminClient
      .from('payment_discounts')
      .select('id, payments!inner(user_id)', {
        count: 'exact',
        head: true,
      })
      .eq('promo_code_id', input.promo_code_id)
      .eq('payments.user_id', input.user_id);

    if (error) {
      throw AppError.databaseOperationFailed(error);
    }

    return typeof count === 'number' && Number.isFinite(count) ? count : 0;
  }
}
