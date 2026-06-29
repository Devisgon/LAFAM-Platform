// apps/api/src/modules/bookings/application/booking-customer.service.ts
/**
 * LAFAM customer booking service.
 *
 * Role:
 * - Owns customer-facing Booking Module business flows.
 * - Creates Pilates class bookings through atomic PostgreSQL booking RPC.
 * - Creates bulk Pilates booking orders through atomic PostgreSQL booking-order RPC.
 * - Creates private trainer bookings through atomic PostgreSQL private booking RPC.
 * - Lists the authenticated customer's class bookings and private bookings.
 * - Reads customer booking and booking-order details.
 * - Cancels customer bookings.
 * - Reschedules customer bookings.
 * - Lists and cancels customer waitlist entries.
 *
 * Important:
 * - This service does not calculate Pilates class seat capacity in TypeScript.
 * - This service does not insert bookings directly.
 * - This service does not trust user_id from request query/body.
 * - Customer ownership always comes from the authenticated user context.
 * - Guest users are blocked by guards/RPC rules and cannot create real bookings.
 * - Class booking RPC functions remain the class booking concurrency authority.
 * - Bulk booking order RPC functions remain the all-or-nothing concurrency authority.
 * - Private booking RPC functions remain the private trainer conflict authority.
 * - Customer booking creation is payment-required. Frontend cannot create free bookings.
 */

import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import type {
  AppUserRow,
  DatabaseJsonObject,
  PilatesClassRow,
  PilatesClassScheduleRow,
} from '../../../database/database.types';
import { AUTH_CUSTOMER_ROLE } from '../../auth/constants/auth-role.constants';
import { EmailNotificationService } from '../../notifications/application/email-notification.service';
import {
  EMAIL_NOTIFICATION_ENTITY_TYPE_BOOKING,
  EMAIL_NOTIFICATION_ENTITY_TYPE_BOOKING_ORDER,
  EMAIL_NOTIFICATION_ENTITY_TYPE_PRIVATE_BOOKING,
  EMAIL_NOTIFICATION_ENTITY_TYPE_WAITLIST,
  EMAIL_NOTIFICATION_EVENT_BOOKING_CANCELLED_BY_CUSTOMER,
  EMAIL_NOTIFICATION_EVENT_BOOKING_CREATED_PENDING_PAYMENT,
  EMAIL_NOTIFICATION_EVENT_BOOKING_RESCHEDULED_BY_CUSTOMER,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_CANCELLED_BY_CUSTOMER,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_CREATED_PENDING_PAYMENT,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_RESCHEDULED_BY_CUSTOMER,
  EMAIL_NOTIFICATION_EVENT_WAITLIST_CANCELLED_BY_CUSTOMER,
  EMAIL_NOTIFICATION_EVENT_WAITLIST_JOINED,
  EMAIL_NOTIFICATION_EVENT_WAITLIST_PROMOTED_TO_BOOKING,
  EMAIL_NOTIFICATION_EVENT_WAITLIST_PROMOTION_PAYMENT_REQUIRED,
  EMAIL_RECIPIENT_ROLE_CUSTOMER,
} from '../../notifications/constants/notification.constants';
import {
  createBookingEmailIdempotencyKey,
  createEntityEmailIdempotencyKey,
  createPrivateBookingEmailIdempotencyKey,
} from '../../notifications/domain/email-idempotency.policy';
import type {
  EmailNotificationEvent,
  EmailRecipient,
} from '../../notifications/types/notification.types';
import {
  BOOKING_DEFAULT_PAYMENT_REQUIRED,
  BOOKING_ORDER_RPC_ACTION_CREATED_ORDER,
  BOOKING_ORDER_RPC_ACTION_EXISTING_ORDER,
  BOOKING_PAYMENT_CONFIRMING_STATUSES,
  BOOKING_PAYMENT_FAILURE_STATUSES,
  BOOKING_PAYMENT_PAYABLE_STATUSES,
  BOOKING_PAYMENT_REFUNDABLE_STATUSES,
  BOOKING_PAYMENT_RETRYABLE_STATUSES,
  BOOKING_PAYMENT_SETTLED_STATUSES,
  BOOKING_PAYMENT_TERMINAL_STATUSES,
  BOOKING_RPC_ACTION_BOOKED,
  BOOKING_RPC_ACTION_CANCELLED,
  BOOKING_RPC_ACTION_CANCELLED_AND_PROMOTED,
  BOOKING_RPC_ACTION_EXISTING_BOOKING,
  BOOKING_RPC_ACTION_RESCHEDULED,
  BOOKING_RPC_ACTION_TARGET_WAITLISTED,
  BOOKING_RPC_ACTION_WAITLISTED,
  BOOKING_SOURCE_CUSTOMER_WEB,
  BOOKING_STATUS_PENDING_PAYMENT,
  PRIVATE_BOOKING_DEFAULT_DURATION_MINUTES,
  PRIVATE_BOOKING_DEFAULT_PAYMENT_REQUIRED,
  PRIVATE_BOOKING_DEFAULT_STUDIO,
  WAITLIST_STATUS_WAITING,
  type BookingPaymentStatus,
} from '../constants/booking.constants';
import { assertBookingCanBeCancelled } from '../domain/booking-lifecycle.policy';
import {
  BookingOrderLifecyclePolicy,
  type BookingOrderLifecycleRecord,
} from '../domain/booking-order-lifecycle.policy';
import { PrivateBookingLifecyclePolicy } from '../domain/private-booking-lifecycle.policy';
import {
  assertWaitlistBelongsToUser,
  assertWaitlistCanBeCancelled,
  assertWaitlistEntryExists,
} from '../domain/waitlist-fifo.policy';
import type { CancelBookingDto } from '../dto/cancel-booking.dto';
import type { CreateBookingDto } from '../dto/create-booking.dto';
import type { CreateBulkBookingDto } from '../dto/create-bulk-booking.dto';
import type { CreatePrivateBookingDto } from '../dto/create-private-booking.dto';
import type { ListBookingsQueryDto } from '../dto/list-bookings-query.dto';
import type { ListPrivateBookingsQueryDto } from '../dto/list-private-bookings-query.dto';
import type { RescheduleBookingDto } from '../dto/reschedule-booking.dto';
import type { ReschedulePrivateBookingDto } from '../dto/reschedule-private-booking.dto';
import { BookingRepository } from '../repositories/booking.repository';
import { BookingAvailabilityService } from './booking-availability.service';
import type {
  BookingAvailabilitySnapshot,
  BookingBulkCreateResult,
  BookingCancelAtomicRpcRow,
  BookingCancelResult,
  BookingClassSnapshot,
  BookingCreateAtomicRpcRow,
  BookingCreateResult,
  BookingCustomerListFilters,
  BookingDetail,
  BookingHistoryEntry,
  BookingHydratedPaymentRow,
  BookingHydratedRow,
  BookingListItem,
  BookingListResult,
  BookingOrderDetail,
  BookingOrderHydratedRow,
  BookingOrderItemHydratedRow,
  BookingOrderItemSummary,
  BookingOrderSummary,
  BookingPaymentStateSnapshot,
  BookingPaymentSummary,
  BookingPriceSnapshot,
  BookingRescheduleAtomicRpcRow,
  BookingRescheduleResult,
  BookingSafeBooking,
  BookingSafeUserSnapshot,
  BookingScheduleSnapshot,
  BookingTrainerSnapshot,
  BookingWaitlistEntry,
  BookingWaitlistHydratedRow,
  BookingWaitlistListItem,
  BookingWaitlistListResult,
  PrivateBookingCancelResult,
  PrivateBookingCreateResult,
  PrivateBookingCustomerListFilters,
  PrivateBookingDetail,
  PrivateBookingHistoryEntry,
  PrivateBookingHydratedRow,
  PrivateBookingListItem,
  PrivateBookingListResult,
  PrivateBookingRescheduleResult,
  PrivateBookingSafeBooking,
} from '../types/booking.types';

type BookingHydratedStaffProfile = NonNullable<
  BookingHydratedRow['staff_profiles']
>;

type BookingOrderHydratedStaffProfile = NonNullable<
  BookingOrderHydratedRow['staff_profiles']
>;

type BookingOrderItemHydratedStaffProfile = NonNullable<
  BookingOrderItemHydratedRow['staff_profiles']
>;

type PrivateBookingHydratedStaffProfile = NonNullable<
  PrivateBookingHydratedRow['staff_profiles']
>;

const EMPTY_DATABASE_METADATA: DatabaseJsonObject = {};

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

function isPaymentStatusIncluded<TStatus extends string>(
  statuses: readonly TStatus[],
  value: string,
): value is TStatus {
  return statuses.includes(value as TStatus);
}

function hasSeatHoldExpired(seatHoldExpiresAt: string | null): boolean {
  if (!seatHoldExpiresAt) {
    return false;
  }

  return new Date(seatHoldExpiresAt).getTime() <= Date.now();
}

function toPaymentSummary(
  payment: BookingHydratedPaymentRow | null,
  targetKind: BookingPaymentSummary['target_kind'],
): BookingPaymentSummary | null {
  if (!payment) {
    return null;
  }

  return {
    id: payment.id,
    payment_number: payment.payment_number,
    receipt_number: payment.receipt_number,
    target_kind: targetKind,
    booking_id: payment.booking_id,
    private_booking_id: payment.private_booking_id,
    booking_order_id: payment.booking_order_id,
    amount: payment.amount,
    discount_amount: payment.discount_amount,
    final_amount: payment.final_amount,
    currency: payment.currency,
    payment_method: payment.payment_method,
    payment_provider: payment.payment_provider,
    status: payment.status,
    redirect_url: payment.redirect_url,
    paid_at: payment.paid_at,
    failed_at: payment.failed_at,
    cancelled_at: payment.cancelled_at,
    expired_at: payment.expired_at,
    refunded_at: payment.refunded_at,
    refunded_amount: payment.refunded_amount,
    expires_at: payment.expires_at,
    created_at: payment.created_at,
    updated_at: payment.updated_at,
  };
}

function buildPaymentStateSnapshot(input: {
  readonly booking_status: string;
  readonly payment_required: boolean;
  readonly payment_status: BookingPaymentStatus;
  readonly seat_hold_expires_at: string | null;
  readonly latest_payment: BookingPaymentSummary | null;
}): BookingPaymentStateSnapshot {
  const holdExpired = hasSeatHoldExpired(input.seat_hold_expires_at);
  const isPendingBooking =
    input.booking_status === BOOKING_STATUS_PENDING_PAYMENT;

  const isPayable =
    input.payment_required &&
    isPendingBooking &&
    !holdExpired &&
    isPaymentStatusIncluded(
      BOOKING_PAYMENT_PAYABLE_STATUSES,
      input.payment_status,
    );

  const isRetryable =
    input.payment_required &&
    isPendingBooking &&
    !holdExpired &&
    isPaymentStatusIncluded(
      BOOKING_PAYMENT_RETRYABLE_STATUSES,
      input.payment_status,
    );

  const isSettled = isPaymentStatusIncluded(
    BOOKING_PAYMENT_SETTLED_STATUSES,
    input.payment_status,
  );

  const isFailed = isPaymentStatusIncluded(
    BOOKING_PAYMENT_FAILURE_STATUSES,
    input.payment_status,
  );

  const isTerminal = isPaymentStatusIncluded(
    BOOKING_PAYMENT_TERMINAL_STATUSES,
    input.payment_status,
  );

  const isRefundable = isPaymentStatusIncluded(
    BOOKING_PAYMENT_REFUNDABLE_STATUSES,
    input.payment_status,
  );

  const confirmsBooking = isPaymentStatusIncluded(
    BOOKING_PAYMENT_CONFIRMING_STATUSES,
    input.payment_status,
  );

  return {
    payment_required: input.payment_required,
    payment_status: input.payment_status,
    seat_hold_expires_at: input.seat_hold_expires_at,
    is_pending_payment: input.payment_required && isPendingBooking,
    is_payable: isPayable,
    is_retryable: isRetryable,
    is_settled: isSettled,
    is_failed: isFailed,
    is_terminal: isTerminal,
    is_refundable: isRefundable,
    confirms_booking: confirmsBooking,
    checkout_required: isPayable,
    hold_expires_at: input.seat_hold_expires_at,
    latest_payment: input.latest_payment,
  };
}

function resolveClassBookingPriceSnapshot(
  row: BookingHydratedRow,
): BookingPriceSnapshot {
  const schedule = row.pilates_class_schedules ?? null;
  const pilatesClass = row.pilates_classes ?? null;

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
  row: PrivateBookingHydratedRow,
): BookingPriceSnapshot {
  if (typeof row.price_amount === 'number' && row.price_amount >= 0) {
    return {
      amount: row.price_amount,
      currency: row.currency,
      source: 'private_booking',
    };
  }

  return {
    amount: null,
    currency: row.currency,
    source: 'not_configured',
  };
}

function normalizeOptionalEmailString(
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function normalizeOptionalTemplateString(
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function createCustomerEmailRecipientFromSnapshot(
  customer: BookingSafeUserSnapshot | null | undefined,
): EmailRecipient | null {
  if (!customer) {
    return null;
  }

  const email = normalizeOptionalEmailString(customer.email);

  if (!email) {
    return null;
  }

  return {
    role: EMAIL_RECIPIENT_ROLE_CUSTOMER,
    email,
    name: customer.full_name,
    appUserId: customer.id,
  };
}

function formatMoneyAmount(
  amount: number | null | undefined,
  currency: string | null | undefined,
): string | null {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return null;
  }

  const normalizedCurrency = normalizeOptionalTemplateString(currency);

  if (!normalizedCurrency) {
    return amount.toFixed(3);
  }

  return `${amount.toFixed(3)} ${normalizedCurrency}`;
}

function addOptionalTemplateString(
  target: DatabaseJsonObject,
  key: string,
  value: string | null | undefined,
): void {
  const normalizedValue = normalizeOptionalTemplateString(value);

  if (normalizedValue) {
    target[key] = normalizedValue;
  }
}

function addOptionalTemplateNumber(
  target: DatabaseJsonObject,
  key: string,
  value: number | null | undefined,
): void {
  if (typeof value === 'number' && Number.isFinite(value)) {
    target[key] = value;
  }
}

function createBaseCustomerTemplateData(
  customer: BookingSafeUserSnapshot | null | undefined,
): DatabaseJsonObject {
  const templateData: DatabaseJsonObject = {};

  addOptionalTemplateString(templateData, 'recipientName', customer?.full_name);
  addOptionalTemplateString(templateData, 'customerName', customer?.full_name);

  return templateData;
}

function buildBookingEmailTemplateData(
  booking: BookingListItem,
): DatabaseJsonObject {
  const templateData = createBaseCustomerTemplateData(booking.customer);

  addOptionalTemplateString(
    templateData,
    'bookingNumber',
    booking.booking_number,
  );
  addOptionalTemplateString(templateData, 'classTitle', booking.class?.title);
  addOptionalTemplateString(
    templateData,
    'trainerName',
    booking.trainer?.display_name,
  );
  addOptionalTemplateString(
    templateData,
    'sessionDate',
    booking.schedule?.class_date,
  );
  addOptionalTemplateString(
    templateData,
    'startTime',
    booking.schedule?.start_time,
  );
  addOptionalTemplateString(
    templateData,
    'endTime',
    booking.schedule?.end_time,
  );
  addOptionalTemplateString(
    templateData,
    'expiresAt',
    booking.payment_state?.hold_expires_at ?? booking.seat_hold_expires_at,
  );

  const amountLabel = formatMoneyAmount(
    booking.latest_payment?.final_amount ?? booking.price?.amount,
    booking.latest_payment?.currency ?? booking.price?.currency,
  );

  addOptionalTemplateString(templateData, 'amountLabel', amountLabel);

  return templateData;
}

function buildBookingRescheduledEmailTemplateData(input: {
  readonly oldBooking: BookingListItem;
  readonly newBooking: BookingListItem;
}): DatabaseJsonObject {
  const templateData = buildBookingEmailTemplateData(input.newBooking);

  addOptionalTemplateString(
    templateData,
    'oldSessionDate',
    input.oldBooking.schedule?.class_date,
  );
  addOptionalTemplateString(
    templateData,
    'oldStartTime',
    input.oldBooking.schedule?.start_time,
  );
  addOptionalTemplateString(
    templateData,
    'newSessionDate',
    input.newBooking.schedule?.class_date,
  );
  addOptionalTemplateString(
    templateData,
    'newStartTime',
    input.newBooking.schedule?.start_time,
  );

  return templateData;
}

function buildBookingOrderEmailTemplateData(
  bookingOrder: BookingOrderSummary,
): DatabaseJsonObject {
  const templateData = createBaseCustomerTemplateData(bookingOrder.customer);

  addOptionalTemplateString(
    templateData,
    'orderNumber',
    bookingOrder.order_number,
  );
  addOptionalTemplateString(templateData, 'expiresAt', bookingOrder.expires_at);
  addOptionalTemplateString(
    templateData,
    'amountLabel',
    formatMoneyAmount(bookingOrder.total_amount, bookingOrder.currency),
  );

  return templateData;
}

function buildPrivateBookingEmailTemplateData(
  privateBooking: PrivateBookingListItem,
): DatabaseJsonObject {
  const templateData = createBaseCustomerTemplateData(privateBooking.customer);

  addOptionalTemplateString(
    templateData,
    'bookingNumber',
    privateBooking.booking_number,
  );
  addOptionalTemplateString(
    templateData,
    'sessionTitle',
    'Private trainer session',
  );
  addOptionalTemplateString(
    templateData,
    'trainerName',
    privateBooking.trainer?.display_name,
  );
  addOptionalTemplateString(
    templateData,
    'sessionDate',
    privateBooking.session_date,
  );
  addOptionalTemplateString(
    templateData,
    'startTime',
    privateBooking.start_time,
  );
  addOptionalTemplateString(templateData, 'endTime', privateBooking.end_time);
  addOptionalTemplateString(
    templateData,
    'expiresAt',
    privateBooking.payment_state?.hold_expires_at ??
      privateBooking.seat_hold_expires_at,
  );

  const amountLabel = formatMoneyAmount(
    privateBooking.latest_payment?.final_amount ?? privateBooking.price_amount,
    privateBooking.latest_payment?.currency ?? privateBooking.currency,
  );

  addOptionalTemplateString(templateData, 'amountLabel', amountLabel);

  return templateData;
}

function buildPrivateBookingRescheduledEmailTemplateData(input: {
  readonly oldPrivateBooking: PrivateBookingListItem;
  readonly newPrivateBooking: PrivateBookingListItem;
}): DatabaseJsonObject {
  const templateData = buildPrivateBookingEmailTemplateData(
    input.newPrivateBooking,
  );

  addOptionalTemplateString(
    templateData,
    'oldSessionDate',
    input.oldPrivateBooking.session_date,
  );
  addOptionalTemplateString(
    templateData,
    'oldStartTime',
    input.oldPrivateBooking.start_time,
  );
  addOptionalTemplateString(
    templateData,
    'newSessionDate',
    input.newPrivateBooking.session_date,
  );
  addOptionalTemplateString(
    templateData,
    'newStartTime',
    input.newPrivateBooking.start_time,
  );

  return templateData;
}

function buildWaitlistEmailTemplateData(
  waitlist: BookingWaitlistListItem,
): DatabaseJsonObject {
  const templateData = createBaseCustomerTemplateData(waitlist.customer);

  addOptionalTemplateString(templateData, 'classTitle', waitlist.class?.title);
  addOptionalTemplateString(
    templateData,
    'sessionDate',
    waitlist.schedule?.class_date,
  );
  addOptionalTemplateString(
    templateData,
    'startTime',
    waitlist.schedule?.start_time,
  );
  addOptionalTemplateString(
    templateData,
    'endTime',
    waitlist.schedule?.end_time,
  );
  addOptionalTemplateNumber(
    templateData,
    'waitlistPosition',
    waitlist.position,
  );
  addOptionalTemplateString(
    templateData,
    'expiresAt',
    waitlist.promotion_expires_at,
  );

  return templateData;
}

function buildBookingEmailMetadata(
  booking: BookingListItem,
): DatabaseJsonObject {
  return {
    booking_id: booking.id,
    booking_number: booking.booking_number,
    customer_user_id: booking.user_id,
    schedule_id: booking.schedule_id,
    class_id: booking.class_id,
    booking_order_id: booking.booking_order_id,
  };
}

function buildBookingOrderEmailMetadata(
  bookingOrder: BookingOrderSummary,
): DatabaseJsonObject {
  return {
    booking_order_id: bookingOrder.id,
    order_number: bookingOrder.order_number,
    customer_user_id: bookingOrder.customer_user_id,
    booking_count: bookingOrder.booking_count,
  };
}

function buildPrivateBookingEmailMetadata(
  privateBooking: PrivateBookingListItem,
): DatabaseJsonObject {
  return {
    private_booking_id: privateBooking.id,
    booking_number: privateBooking.booking_number,
    customer_user_id: privateBooking.user_id,
    trainer_staff_profile_id: privateBooking.trainer_staff_profile_id,
  };
}

function buildWaitlistEmailMetadata(
  waitlist: BookingWaitlistListItem,
): DatabaseJsonObject {
  return {
    waitlist_id: waitlist.id,
    customer_user_id: waitlist.user_id,
    schedule_id: waitlist.schedule_id,
    class_id: waitlist.class_id,
  };
}

@Injectable()
export class BookingCustomerService {
  constructor(
    private readonly bookingRepository: BookingRepository,
    private readonly bookingAvailabilityService: BookingAvailabilityService,
    private readonly emailNotificationService: EmailNotificationService,
  ) {}

  async createBooking(
    userId: string,
    dto: CreateBookingDto,
  ): Promise<BookingCreateResult> {
    const rpcResult = await this.bookingRepository.createBookingAtomic({
      user_id: userId,
      schedule_id: dto.schedule_id,
      payment_required: BOOKING_DEFAULT_PAYMENT_REQUIRED,
      idempotency_key: dto.idempotency_key ?? null,
      created_by_admin_id: null,
      source: BOOKING_SOURCE_CUSTOMER_WEB,
    });

    const actionResult = this.resolveCreateActionResult(
      rpcResult.rpc.action_result,
    );
    const availability = this.toAvailabilitySnapshot(rpcResult.rpc);

    if (
      actionResult === BOOKING_RPC_ACTION_EXISTING_BOOKING ||
      actionResult === BOOKING_RPC_ACTION_BOOKED
    ) {
      const bookingId = this.requireReturnedId(
        rpcResult.rpc.booking_id,
        'create_pilates_booking_atomic did not return booking_id.',
      );
      const booking = await this.getRequiredCustomerBookingListItem(
        userId,
        bookingId,
      );

      await this.notifyBookingCreatedPendingPayment(booking);

      return {
        result: actionResult,
        booking,
        waitlist: null,
        payment_state: booking.payment_state ?? null,
        checkout_required: booking.payment_state?.checkout_required ?? false,
        availability,
      };
    }

    const waitlistId = this.requireReturnedId(
      rpcResult.rpc.waitlist_id,
      'create_pilates_booking_atomic did not return waitlist_id.',
    );
    const waitlist = await this.getRequiredCustomerWaitlistItem(
      userId,
      waitlistId,
    );

    await this.notifyWaitlistJoined(waitlist);

    return {
      result: actionResult,
      booking: null,
      waitlist,
      payment_state: null,
      checkout_required: false,
      availability,
    };
  }

  async createBulkBooking(
    userId: string,
    dto: CreateBulkBookingDto,
  ): Promise<BookingBulkCreateResult> {
    await this.bookingAvailabilityService.assertBulkSchedulesHaveAvailableSeats(
      {
        schedule_ids: dto.schedule_ids,
      },
    );

    const rpcResult = await this.bookingRepository.createBookingOrderAtomic({
      customer_user_id: userId,
      schedule_ids: dto.schedule_ids,
      idempotency_key: dto.idempotency_key ?? null,
      created_by_user_id: userId,
      created_by_admin_id: null,
      created_by_staff_profile_id: null,
      created_by_role: AUTH_CUSTOMER_ROLE,
      source: BOOKING_SOURCE_CUSTOMER_WEB,
      admin_notes: null,
      metadata: EMPTY_DATABASE_METADATA,
    });

    BookingOrderLifecyclePolicy.assertRpcCreateResultIsConsistent(
      rpcResult.rpc,
    );

    const actionResult = this.resolveBookingOrderCreateActionResult(
      rpcResult.rpc.action_result,
    );
    const bookingOrderId = this.requireReturnedId(
      rpcResult.rpc.booking_order_id,
      'create_booking_order_atomic did not return booking_order_id.',
    );
    const bookingOrderRow = await this.getRequiredCustomerBookingOrderRow(
      userId,
      bookingOrderId,
    );
    const bookingOrder = this.toBookingOrderSummary(bookingOrderRow);
    const bookingOrderItems = (bookingOrderRow.booking_order_items ?? []).map(
      (item) => this.toBookingOrderItemSummary(item),
    );

    await this.notifyBookingOrderCreatedPendingPayment(bookingOrder);

    return {
      result: actionResult,
      booking_order: bookingOrder,
      items: bookingOrderItems,
      checkout_required: bookingOrder.checkout_required,
    };
  }

  async createPrivateBooking(
    userId: string,
    dto: CreatePrivateBookingDto,
  ): Promise<PrivateBookingCreateResult> {
    PrivateBookingLifecyclePolicy.assertCustomerUserIdAvailable(userId);

    const sessionDate = PrivateBookingLifecyclePolicy.normalizeIsoDate(
      dto.session_date,
      'session_date',
    );
    const startTime = PrivateBookingLifecyclePolicy.normalizeTimeValue(
      dto.start_time,
      'start_time',
    );
    const durationMinutes =
      dto.duration_minutes ?? PRIVATE_BOOKING_DEFAULT_DURATION_MINUTES;

    PrivateBookingLifecyclePolicy.assertSessionDateIsNotInPast(sessionDate);
    PrivateBookingLifecyclePolicy.assertPrivateBookingDuration(durationMinutes);
    PrivateBookingLifecyclePolicy.calculateEndTime(startTime, durationMinutes);

    const rpcResult = await this.bookingRepository.createPrivateBookingAtomic({
      user_id: userId,
      trainer_staff_profile_id: dto.trainer_staff_profile_id,
      session_date: sessionDate,
      start_time: startTime,
      duration_minutes: durationMinutes,
      studio: dto.studio ?? PRIVATE_BOOKING_DEFAULT_STUDIO,
      payment_required: PRIVATE_BOOKING_DEFAULT_PAYMENT_REQUIRED,
      idempotency_key: dto.idempotency_key ?? null,
      created_by_admin_id: null,
      source: BOOKING_SOURCE_CUSTOMER_WEB,
    });

    const actionResult = this.resolvePrivateCreateActionResult(
      rpcResult.rpc.action_result,
    );
    const privateBookingId = this.requireReturnedPrivateBookingId(
      rpcResult.rpc.private_booking_id,
      'create_private_trainer_booking_atomic did not return private_booking_id.',
    );
    const privateBooking = await this.getRequiredCustomerPrivateBookingListItem(
      userId,
      privateBookingId,
    );
    await this.notifyPrivateBookingCreatedPendingPayment(privateBooking);
    return {
      result: actionResult,
      private_booking: privateBooking,
      payment_state: privateBooking.payment_state ?? null,
      checkout_required:
        privateBooking.payment_state?.checkout_required ?? false,
    };
  }

  async listBookings(
    userId: string,
    dto: ListBookingsQueryDto,
  ): Promise<BookingListResult> {
    const filters = this.buildCustomerBookingFilters(userId, dto);
    const result = await this.bookingRepository.listCustomerBookings(filters);

    return {
      bookings: result.rows.map((row) => this.toBookingListItem(row)),
      total: result.total,
      limit: filters.limit,
      offset: filters.offset,
    };
  }

  async listPrivateBookings(
    userId: string,
    dto: ListPrivateBookingsQueryDto,
  ): Promise<PrivateBookingListResult> {
    PrivateBookingLifecyclePolicy.assertCustomerUserIdAvailable(userId);

    const filters = this.buildCustomerPrivateBookingFilters(userId, dto);
    const result =
      await this.bookingRepository.listCustomerPrivateBookings(filters);

    return {
      private_bookings: result.rows.map((row) =>
        this.toPrivateBookingListItem(row),
      ),
      total: result.total,
      limit: filters.limit,
      offset: filters.offset,
    };
  }

  async getBookingById(
    userId: string,
    bookingId: string,
  ): Promise<BookingDetail> {
    const lookup = await this.bookingRepository.findBookingByIdForUser({
      booking_id: bookingId,
      user_id: userId,
      include_deleted: false,
    });

    if (!lookup.booking) {
      throw AppError.bookingNotFound();
    }

    const availability =
      await this.bookingAvailabilityService.getAvailabilitySnapshot({
        schedule_id: lookup.booking.schedule_id,
      });

    return this.toBookingDetail(
      lookup.booking,
      lookup.history.map((history) => ({
        id: history.id,
        booking_id: history.booking_id,
        actor_user_id: history.actor_user_id,
        actor_admin_id: history.actor_admin_id,
        actor_role: history.actor_role,
        action: history.action,
        from_status: history.from_status,
        to_status: history.to_status,
        notes: history.notes,
        metadata: history.metadata,
        created_at: history.created_at,
      })),
      availability,
    );
  }

  async getBookingOrderById(
    userId: string,
    bookingOrderId: string,
  ): Promise<BookingOrderDetail> {
    const bookingOrderRow = await this.getRequiredCustomerBookingOrderRow(
      userId,
      bookingOrderId,
    );

    return this.toBookingOrderDetail(bookingOrderRow);
  }

  async getPrivateBookingById(
    userId: string,
    privateBookingId: string,
  ): Promise<PrivateBookingDetail> {
    PrivateBookingLifecyclePolicy.assertCustomerUserIdAvailable(userId);

    const lookup = await this.bookingRepository.findPrivateBookingByIdForUser({
      private_booking_id: privateBookingId,
      user_id: userId,
      include_deleted: false,
    });

    if (!lookup.private_booking) {
      throw AppError.privateBookingNotFound();
    }

    return this.toPrivateBookingDetail(
      lookup.private_booking,
      lookup.history.map((history) => ({
        id: history.id,
        private_booking_id: history.private_booking_id,
        actor_user_id: history.actor_user_id,
        actor_admin_id: history.actor_admin_id,
        actor_role: history.actor_role,
        action: history.action,
        from_status: history.from_status,
        to_status: history.to_status,
        notes: history.notes,
        metadata: history.metadata,
        created_at: history.created_at,
      })),
    );
  }

  async cancelBooking(
    userId: string,
    bookingId: string,
    dto: CancelBookingDto,
  ): Promise<BookingCancelResult> {
    const existingLookup = await this.bookingRepository.findBookingByIdForUser({
      booking_id: bookingId,
      user_id: userId,
      include_deleted: false,
    });

    if (!existingLookup.booking) {
      throw AppError.bookingNotFound();
    }

    assertBookingCanBeCancelled(existingLookup.booking);

    const rpcResult = await this.bookingRepository.cancelBookingAtomic({
      booking_id: bookingId,
      actor_user_id: userId,
      actor_admin_id: null,
      reason: dto.reason ?? null,
    });

    const actionResult = this.resolveCancelActionResult(
      rpcResult.rpc.action_result,
    );
    const availability = this.toAvailabilitySnapshot(rpcResult.rpc);

    const cancelledBooking = await this.getRequiredCustomerBookingListItem(
      userId,
      rpcResult.rpc.cancelled_booking_id,
    );

    const promotedBooking = rpcResult.rpc.promoted_booking_id
      ? await this.getRequiredBookingListItem(rpcResult.rpc.promoted_booking_id)
      : null;

    const promotedWaitlist = rpcResult.rpc.promoted_waitlist_id
      ? await this.getRequiredWaitlistItem(rpcResult.rpc.promoted_waitlist_id)
      : null;
    await this.notifyBookingCancelledByCustomer(cancelledBooking);

    if (promotedBooking) {
      await this.notifyWaitlistPromotion({
        promotedBooking,
        promotedWaitlist,
      });
    }
    return {
      result: actionResult,
      cancelled_booking: cancelledBooking,
      promoted_booking: promotedBooking,
      promoted_waitlist: promotedWaitlist,
      availability,
    };
  }

  async cancelPrivateBooking(
    userId: string,
    privateBookingId: string,
    dto: CancelBookingDto,
  ): Promise<PrivateBookingCancelResult> {
    PrivateBookingLifecyclePolicy.assertCustomerUserIdAvailable(userId);

    const existingLookup =
      await this.bookingRepository.findPrivateBookingByIdForUser({
        private_booking_id: privateBookingId,
        user_id: userId,
        include_deleted: false,
      });

    if (!existingLookup.private_booking) {
      throw AppError.privateBookingNotFound();
    }

    PrivateBookingLifecyclePolicy.assertPrivateBookingCanBeCancelled(
      existingLookup.private_booking,
    );

    const rpcResult = await this.bookingRepository.cancelPrivateBookingAtomic({
      private_booking_id: privateBookingId,
      actor_user_id: userId,
      actor_admin_id: null,
      reason: dto.reason ?? null,
    });

    const actionResult = this.resolvePrivateCancelActionResult(
      rpcResult.rpc.action_result,
    );
    const cancelledPrivateBooking =
      await this.getRequiredCustomerPrivateBookingListItem(
        userId,
        rpcResult.rpc.private_booking_id,
      );
    await this.notifyPrivateBookingCancelledByCustomer(cancelledPrivateBooking);
    return {
      result: actionResult,
      private_booking: cancelledPrivateBooking,
    };
  }

  async rescheduleBooking(
    userId: string,
    bookingId: string,
    dto: RescheduleBookingDto,
  ): Promise<BookingRescheduleResult> {
    const existingLookup = await this.bookingRepository.findBookingByIdForUser({
      booking_id: bookingId,
      user_id: userId,
      include_deleted: false,
    });

    if (!existingLookup.booking) {
      throw AppError.bookingNotFound();
    }

    const rpcResult = await this.bookingRepository.rescheduleBookingAtomic({
      booking_id: bookingId,
      target_schedule_id: dto.target_schedule_id,
      actor_user_id: userId,
      actor_admin_id: null,
      join_waitlist_if_full: dto.join_waitlist_if_full ?? false,
      reason: dto.reason ?? null,
    });

    const actionResult = this.resolveRescheduleActionResult(
      rpcResult.rpc.action_result,
    );
    const availability = this.toAvailabilitySnapshot(rpcResult.rpc);

    const oldBooking = await this.getRequiredCustomerBookingListItem(
      userId,
      rpcResult.rpc.old_booking_id,
    );

    if (actionResult === BOOKING_RPC_ACTION_TARGET_WAITLISTED) {
      const waitlistId = this.requireReturnedId(
        rpcResult.rpc.waitlist_id,
        'reschedule_pilates_booking_atomic did not return waitlist_id.',
      );
      const waitlist = await this.getRequiredCustomerWaitlistItem(
        userId,
        waitlistId,
      );

      await this.notifyWaitlistJoined(waitlist);

      return {
        result: actionResult,
        old_booking: oldBooking,
        new_booking: null,
        waitlist,
        availability,
      };
    }

    const newBookingId = this.requireReturnedId(
      rpcResult.rpc.new_booking_id,
      'reschedule_pilates_booking_atomic did not return new_booking_id.',
    );
    const newBooking = await this.getRequiredCustomerBookingListItem(
      userId,
      newBookingId,
    );
    await this.notifyBookingRescheduledByCustomer({
      oldBooking,
      newBooking,
    });
    return {
      result: actionResult,
      old_booking: oldBooking,
      new_booking: newBooking,
      waitlist: null,
      availability,
    };
  }

  async reschedulePrivateBooking(
    userId: string,
    privateBookingId: string,
    dto: ReschedulePrivateBookingDto,
  ): Promise<PrivateBookingRescheduleResult> {
    PrivateBookingLifecyclePolicy.assertCustomerUserIdAvailable(userId);

    const existingLookup =
      await this.bookingRepository.findPrivateBookingByIdForUser({
        private_booking_id: privateBookingId,
        user_id: userId,
        include_deleted: false,
      });

    if (!existingLookup.private_booking) {
      throw AppError.privateBookingNotFound();
    }

    PrivateBookingLifecyclePolicy.assertPrivateBookingCanBeRescheduled(
      existingLookup.private_booking,
    );

    const targetSessionDate = PrivateBookingLifecyclePolicy.normalizeIsoDate(
      dto.target_session_date,
      'target_session_date',
    );
    const targetStartTime = PrivateBookingLifecyclePolicy.normalizeTimeValue(
      dto.target_start_time,
      'target_start_time',
    );
    const targetDurationMinutes =
      dto.target_duration_minutes ??
      existingLookup.private_booking.duration_minutes;

    PrivateBookingLifecyclePolicy.assertTargetSessionDateIsNotInPast(
      targetSessionDate,
    );
    PrivateBookingLifecyclePolicy.assertPrivateBookingDuration(
      targetDurationMinutes,
    );
    PrivateBookingLifecyclePolicy.calculateEndTime(
      targetStartTime,
      targetDurationMinutes,
    );

    const rpcResult =
      await this.bookingRepository.reschedulePrivateBookingAtomic({
        private_booking_id: privateBookingId,
        target_session_date: targetSessionDate,
        target_start_time: targetStartTime,
        target_duration_minutes: targetDurationMinutes,
        studio: dto.studio ?? null,
        actor_user_id: userId,
        actor_admin_id: null,
        reason: dto.reason ?? null,
        idempotency_key: dto.idempotency_key ?? null,
        payment_required: PRIVATE_BOOKING_DEFAULT_PAYMENT_REQUIRED,
      });

    const actionResult = this.resolvePrivateRescheduleActionResult(
      rpcResult.rpc.action_result,
    );
    const oldPrivateBooking =
      await this.getRequiredCustomerPrivateBookingListItem(
        userId,
        rpcResult.rpc.old_private_booking_id,
      );
    const newPrivateBookingId = this.requireReturnedPrivateBookingId(
      rpcResult.rpc.new_private_booking_id,
      'reschedule_private_trainer_booking_atomic did not return new_private_booking_id.',
    );
    const newPrivateBooking =
      await this.getRequiredCustomerPrivateBookingListItem(
        userId,
        newPrivateBookingId,
      );
    await this.notifyPrivateBookingRescheduledByCustomer({
      oldPrivateBooking,
      newPrivateBooking,
    });
    return {
      result: actionResult,
      old_private_booking: oldPrivateBooking,
      new_private_booking: newPrivateBooking,
    };
  }

  async listWaitlist(userId: string): Promise<BookingWaitlistListResult> {
    const result = await this.bookingRepository.listCustomerWaitlist({
      user_id: userId,
      schedule_id: null,
      status: WAITLIST_STATUS_WAITING,
      limit: 20,
      offset: 0,
    });

    return {
      waitlist: result.rows.map((row) => this.toWaitlistListItem(row)),
      total: result.total,
      limit: 20,
      offset: 0,
    };
  }

  async cancelWaitlistEntry(
    userId: string,
    waitlistId: string,
    dto: CancelBookingDto,
  ): Promise<BookingWaitlistListItem> {
    const lookup = await this.bookingRepository.findWaitlistByIdForUser({
      waitlist_id: waitlistId,
      user_id: userId,
    });

    assertWaitlistEntryExists(lookup.waitlist);
    assertWaitlistBelongsToUser(lookup.waitlist, userId);
    assertWaitlistCanBeCancelled(lookup.waitlist);

    await this.bookingRepository.cancelWaitlistEntry({
      waitlist_id: waitlistId,
      reason: dto.reason ?? null,
    });

    const cancelledWaitlist = await this.getRequiredCustomerWaitlistItem(
      userId,
      waitlistId,
    );

    await this.notifyWaitlistCancelledByCustomer(cancelledWaitlist);

    return cancelledWaitlist;
  }
  private async createCustomerEmailNotificationBestEffort(input: {
    readonly eventType: EmailNotificationEvent;
    readonly recipient: EmailRecipient | null;
    readonly templateData: DatabaseJsonObject;
    readonly entityType:
      | typeof EMAIL_NOTIFICATION_ENTITY_TYPE_BOOKING
      | typeof EMAIL_NOTIFICATION_ENTITY_TYPE_BOOKING_ORDER
      | typeof EMAIL_NOTIFICATION_ENTITY_TYPE_WAITLIST
      | typeof EMAIL_NOTIFICATION_ENTITY_TYPE_PRIVATE_BOOKING;
    readonly entityId: string;
    readonly idempotencyKey: string | null;
    readonly metadata: DatabaseJsonObject;
  }): Promise<void> {
    if (!input.recipient) {
      return;
    }

    try {
      await this.emailNotificationService.createFromTemplate({
        eventType: input.eventType,
        recipient: input.recipient,
        templateData: input.templateData,
        entity: {
          entityType: input.entityType,
          entityId: input.entityId,
        },
        idempotencyKey: input.idempotencyKey,
        metadata: input.metadata,
      });
    } catch {
      // Best-effort notification side effect. The booking mutation remains authoritative.
    }
  }

  private async notifyBookingCreatedPendingPayment(
    booking: BookingListItem,
  ): Promise<void> {
    const recipient = createCustomerEmailRecipientFromSnapshot(
      booking.customer,
    );

    await this.createCustomerEmailNotificationBestEffort({
      eventType: EMAIL_NOTIFICATION_EVENT_BOOKING_CREATED_PENDING_PAYMENT,
      recipient,
      templateData: buildBookingEmailTemplateData(booking),
      entityType: EMAIL_NOTIFICATION_ENTITY_TYPE_BOOKING,
      entityId: booking.id,
      idempotencyKey: recipient
        ? createBookingEmailIdempotencyKey({
            eventType: EMAIL_NOTIFICATION_EVENT_BOOKING_CREATED_PENDING_PAYMENT,
            bookingId: booking.id,
            recipient,
          })
        : null,
      metadata: buildBookingEmailMetadata(booking),
    });
  }

  private async notifyBookingOrderCreatedPendingPayment(
    bookingOrder: BookingOrderSummary,
  ): Promise<void> {
    const recipient = createCustomerEmailRecipientFromSnapshot(
      bookingOrder.customer,
    );

    await this.createCustomerEmailNotificationBestEffort({
      eventType: EMAIL_NOTIFICATION_EVENT_BOOKING_CREATED_PENDING_PAYMENT,
      recipient,
      templateData: buildBookingOrderEmailTemplateData(bookingOrder),
      entityType: EMAIL_NOTIFICATION_ENTITY_TYPE_BOOKING_ORDER,
      entityId: bookingOrder.id,
      idempotencyKey: recipient
        ? createEntityEmailIdempotencyKey({
            eventType: EMAIL_NOTIFICATION_EVENT_BOOKING_CREATED_PENDING_PAYMENT,
            recipientRole: EMAIL_RECIPIENT_ROLE_CUSTOMER,
            recipientEmail: recipient.email,
            recipientAppUserId: recipient.appUserId ?? null,
            entityType: EMAIL_NOTIFICATION_ENTITY_TYPE_BOOKING_ORDER,
            entityId: bookingOrder.id,
          })
        : null,
      metadata: buildBookingOrderEmailMetadata(bookingOrder),
    });
  }

  private async notifyWaitlistJoined(
    waitlist: BookingWaitlistListItem,
  ): Promise<void> {
    const recipient = createCustomerEmailRecipientFromSnapshot(
      waitlist.customer,
    );

    await this.createCustomerEmailNotificationBestEffort({
      eventType: EMAIL_NOTIFICATION_EVENT_WAITLIST_JOINED,
      recipient,
      templateData: buildWaitlistEmailTemplateData(waitlist),
      entityType: EMAIL_NOTIFICATION_ENTITY_TYPE_WAITLIST,
      entityId: waitlist.id,
      idempotencyKey: recipient
        ? createEntityEmailIdempotencyKey({
            eventType: EMAIL_NOTIFICATION_EVENT_WAITLIST_JOINED,
            recipientRole: EMAIL_RECIPIENT_ROLE_CUSTOMER,
            recipientEmail: recipient.email,
            recipientAppUserId: recipient.appUserId ?? null,
            entityType: EMAIL_NOTIFICATION_ENTITY_TYPE_WAITLIST,
            entityId: waitlist.id,
          })
        : null,
      metadata: buildWaitlistEmailMetadata(waitlist),
    });
  }

  private async notifyWaitlistCancelledByCustomer(
    waitlist: BookingWaitlistListItem,
  ): Promise<void> {
    const recipient = createCustomerEmailRecipientFromSnapshot(
      waitlist.customer,
    );

    await this.createCustomerEmailNotificationBestEffort({
      eventType: EMAIL_NOTIFICATION_EVENT_WAITLIST_CANCELLED_BY_CUSTOMER,
      recipient,
      templateData: buildWaitlistEmailTemplateData(waitlist),
      entityType: EMAIL_NOTIFICATION_ENTITY_TYPE_WAITLIST,
      entityId: waitlist.id,
      idempotencyKey: recipient
        ? createEntityEmailIdempotencyKey({
            eventType: EMAIL_NOTIFICATION_EVENT_WAITLIST_CANCELLED_BY_CUSTOMER,
            recipientRole: EMAIL_RECIPIENT_ROLE_CUSTOMER,
            recipientEmail: recipient.email,
            recipientAppUserId: recipient.appUserId ?? null,
            entityType: EMAIL_NOTIFICATION_ENTITY_TYPE_WAITLIST,
            entityId: waitlist.id,
          })
        : null,
      metadata: buildWaitlistEmailMetadata(waitlist),
    });
  }

  private async notifyBookingCancelledByCustomer(
    booking: BookingListItem,
  ): Promise<void> {
    const recipient = createCustomerEmailRecipientFromSnapshot(
      booking.customer,
    );

    await this.createCustomerEmailNotificationBestEffort({
      eventType: EMAIL_NOTIFICATION_EVENT_BOOKING_CANCELLED_BY_CUSTOMER,
      recipient,
      templateData: buildBookingEmailTemplateData(booking),
      entityType: EMAIL_NOTIFICATION_ENTITY_TYPE_BOOKING,
      entityId: booking.id,
      idempotencyKey: recipient
        ? createBookingEmailIdempotencyKey({
            eventType: EMAIL_NOTIFICATION_EVENT_BOOKING_CANCELLED_BY_CUSTOMER,
            bookingId: booking.id,
            recipient,
          })
        : null,
      metadata: buildBookingEmailMetadata(booking),
    });
  }

  private async notifyBookingRescheduledByCustomer(input: {
    readonly oldBooking: BookingListItem;
    readonly newBooking: BookingListItem;
  }): Promise<void> {
    const recipient = createCustomerEmailRecipientFromSnapshot(
      input.newBooking.customer,
    );

    await this.createCustomerEmailNotificationBestEffort({
      eventType: EMAIL_NOTIFICATION_EVENT_BOOKING_RESCHEDULED_BY_CUSTOMER,
      recipient,
      templateData: buildBookingRescheduledEmailTemplateData(input),
      entityType: EMAIL_NOTIFICATION_ENTITY_TYPE_BOOKING,
      entityId: input.newBooking.id,
      idempotencyKey: recipient
        ? createBookingEmailIdempotencyKey({
            eventType: EMAIL_NOTIFICATION_EVENT_BOOKING_RESCHEDULED_BY_CUSTOMER,
            bookingId: input.newBooking.id,
            recipient,
            scope: `from:${input.oldBooking.id}`,
          })
        : null,
      metadata: {
        ...buildBookingEmailMetadata(input.newBooking),
        previous_booking_id: input.oldBooking.id,
      },
    });
  }

  private async notifyWaitlistPromotion(input: {
    readonly promotedBooking: BookingListItem;
    readonly promotedWaitlist: BookingWaitlistListItem | null;
  }): Promise<void> {
    const recipient = createCustomerEmailRecipientFromSnapshot(
      input.promotedBooking.customer,
    );
    const eventType =
      input.promotedBooking.payment_state?.checkout_required === true
        ? EMAIL_NOTIFICATION_EVENT_WAITLIST_PROMOTION_PAYMENT_REQUIRED
        : EMAIL_NOTIFICATION_EVENT_WAITLIST_PROMOTED_TO_BOOKING;

    await this.createCustomerEmailNotificationBestEffort({
      eventType,
      recipient,
      templateData: buildBookingEmailTemplateData(input.promotedBooking),
      entityType: EMAIL_NOTIFICATION_ENTITY_TYPE_BOOKING,
      entityId: input.promotedBooking.id,
      idempotencyKey: recipient
        ? createBookingEmailIdempotencyKey({
            eventType,
            bookingId: input.promotedBooking.id,
            recipient,
            scope: input.promotedWaitlist
              ? `waitlist:${input.promotedWaitlist.id}`
              : null,
          })
        : null,
      metadata: {
        ...buildBookingEmailMetadata(input.promotedBooking),
        ...(input.promotedWaitlist
          ? {
              promoted_waitlist_id: input.promotedWaitlist.id,
            }
          : {}),
      },
    });
  }

  private async notifyPrivateBookingCreatedPendingPayment(
    privateBooking: PrivateBookingListItem,
  ): Promise<void> {
    const recipient = createCustomerEmailRecipientFromSnapshot(
      privateBooking.customer,
    );

    await this.createCustomerEmailNotificationBestEffort({
      eventType:
        EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_CREATED_PENDING_PAYMENT,
      recipient,
      templateData: buildPrivateBookingEmailTemplateData(privateBooking),
      entityType: EMAIL_NOTIFICATION_ENTITY_TYPE_PRIVATE_BOOKING,
      entityId: privateBooking.id,
      idempotencyKey: recipient
        ? createPrivateBookingEmailIdempotencyKey({
            eventType:
              EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_CREATED_PENDING_PAYMENT,
            privateBookingId: privateBooking.id,
            recipient,
          })
        : null,
      metadata: buildPrivateBookingEmailMetadata(privateBooking),
    });
  }

  private async notifyPrivateBookingCancelledByCustomer(
    privateBooking: PrivateBookingListItem,
  ): Promise<void> {
    const recipient = createCustomerEmailRecipientFromSnapshot(
      privateBooking.customer,
    );

    await this.createCustomerEmailNotificationBestEffort({
      eventType: EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_CANCELLED_BY_CUSTOMER,
      recipient,
      templateData: buildPrivateBookingEmailTemplateData(privateBooking),
      entityType: EMAIL_NOTIFICATION_ENTITY_TYPE_PRIVATE_BOOKING,
      entityId: privateBooking.id,
      idempotencyKey: recipient
        ? createPrivateBookingEmailIdempotencyKey({
            eventType:
              EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_CANCELLED_BY_CUSTOMER,
            privateBookingId: privateBooking.id,
            recipient,
          })
        : null,
      metadata: buildPrivateBookingEmailMetadata(privateBooking),
    });
  }

  private async notifyPrivateBookingRescheduledByCustomer(input: {
    readonly oldPrivateBooking: PrivateBookingListItem;
    readonly newPrivateBooking: PrivateBookingListItem;
  }): Promise<void> {
    const recipient = createCustomerEmailRecipientFromSnapshot(
      input.newPrivateBooking.customer,
    );

    await this.createCustomerEmailNotificationBestEffort({
      eventType:
        EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_RESCHEDULED_BY_CUSTOMER,
      recipient,
      templateData: buildPrivateBookingRescheduledEmailTemplateData(input),
      entityType: EMAIL_NOTIFICATION_ENTITY_TYPE_PRIVATE_BOOKING,
      entityId: input.newPrivateBooking.id,
      idempotencyKey: recipient
        ? createPrivateBookingEmailIdempotencyKey({
            eventType:
              EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_RESCHEDULED_BY_CUSTOMER,
            privateBookingId: input.newPrivateBooking.id,
            recipient,
            scope: `from:${input.oldPrivateBooking.id}`,
          })
        : null,
      metadata: {
        ...buildPrivateBookingEmailMetadata(input.newPrivateBooking),
        previous_private_booking_id: input.oldPrivateBooking.id,
      },
    });
  }

  private async getRequiredCustomerBookingListItem(
    userId: string,
    bookingId: string,
  ): Promise<BookingListItem> {
    const lookup = await this.bookingRepository.findBookingByIdForUser({
      booking_id: bookingId,
      user_id: userId,
      include_deleted: false,
    });

    if (!lookup.booking) {
      throw AppError.bookingNotFound();
    }

    return this.toBookingListItem(lookup.booking);
  }

  private async getRequiredBookingListItem(
    bookingId: string,
  ): Promise<BookingListItem> {
    const lookup = await this.bookingRepository.findBookingById({
      booking_id: bookingId,
      include_deleted: false,
    });

    if (!lookup.booking) {
      throw AppError.bookingNotFound();
    }

    return this.toBookingListItem(lookup.booking);
  }

  private async getRequiredCustomerBookingOrderRow(
    userId: string,
    bookingOrderId: string,
  ): Promise<BookingOrderHydratedRow> {
    const lookup = await this.bookingRepository.findBookingOrderByIdForUser({
      booking_order_id: bookingOrderId,
      user_id: userId,
    });

    if (!lookup.booking_order) {
      throw AppError.bookingOrderNotFound();
    }

    return lookup.booking_order;
  }

  private async getRequiredCustomerPrivateBookingListItem(
    userId: string,
    privateBookingId: string,
  ): Promise<PrivateBookingListItem> {
    const lookup = await this.bookingRepository.findPrivateBookingByIdForUser({
      private_booking_id: privateBookingId,
      user_id: userId,
      include_deleted: false,
    });

    if (!lookup.private_booking) {
      throw AppError.privateBookingNotFound();
    }

    return this.toPrivateBookingListItem(lookup.private_booking);
  }

  private async getRequiredCustomerWaitlistItem(
    userId: string,
    waitlistId: string,
  ): Promise<BookingWaitlistListItem> {
    const lookup = await this.bookingRepository.findWaitlistByIdForUser({
      waitlist_id: waitlistId,
      user_id: userId,
    });

    if (!lookup.waitlist) {
      throw AppError.bookingWaitlistNotFound();
    }

    return this.toWaitlistListItem(lookup.waitlist);
  }

  private async getRequiredWaitlistItem(
    waitlistId: string,
  ): Promise<BookingWaitlistListItem> {
    const lookup = await this.bookingRepository.findWaitlistById({
      waitlist_id: waitlistId,
    });

    if (!lookup.waitlist) {
      throw AppError.bookingWaitlistNotFound();
    }

    return this.toWaitlistListItem(lookup.waitlist);
  }

  private buildCustomerBookingFilters(
    userId: string,
    dto: ListBookingsQueryDto,
  ): BookingCustomerListFilters {
    return {
      status: dto.status ?? null,
      user_id: userId,
      booking_order_id: null,
      from_date: dto.from_date ?? null,
      to_date: dto.to_date ?? null,
      limit: dto.limit,
      offset: dto.offset,
      sort_by: dto.sort_by,
      sort_direction: dto.sort_direction,
    };
  }

  private buildCustomerPrivateBookingFilters(
    userId: string,
    dto: ListPrivateBookingsQueryDto,
  ): PrivateBookingCustomerListFilters {
    return {
      user_id: userId,
      status: dto.status ?? null,
      trainer_staff_profile_id: dto.trainer_staff_profile_id ?? null,
      from_date: dto.from_date ?? null,
      to_date: dto.to_date ?? null,
      limit: dto.limit,
      offset: dto.offset,
      sort_by: dto.sort_by,
      sort_direction: dto.sort_direction,
    };
  }

  private toBookingDetail(
    row: BookingHydratedRow,
    history: readonly BookingHistoryEntry[],
    availability: BookingAvailabilitySnapshot | null,
  ): BookingDetail {
    return {
      ...this.toBookingListItem(row),
      history,
      availability,
    };
  }

  private toBookingOrderDetail(
    row: BookingOrderHydratedRow,
  ): BookingOrderDetail {
    return {
      ...this.toBookingOrderSummary(row),
    } as BookingOrderDetail;
  }

  private toPrivateBookingDetail(
    row: PrivateBookingHydratedRow,
    history: readonly PrivateBookingHistoryEntry[],
  ): PrivateBookingDetail {
    return {
      ...this.toPrivateBookingListItem(row),
      history,
    };
  }

  private toBookingListItem(row: BookingHydratedRow): BookingListItem {
    return {
      ...this.toSafeBooking(row),
      customer: this.toSafeUserSnapshot(row.app_users ?? null),
      class: this.toClassSnapshot(row.pilates_classes ?? null),
      schedule: this.toScheduleSnapshot(row.pilates_class_schedules ?? null),
      trainer: this.toTrainerSnapshot(row.staff_profiles ?? null),
    };
  }

  private toBookingOrderSummary(
    row: BookingOrderHydratedRow,
  ): BookingOrderSummary {
    const latestPayment = toPaymentSummary(
      getLatestHydratedPayment(row.payments),
      'booking_order',
    );
    const lifecycleRecord = this.toBookingOrderLifecycleRecord(row);
    const paymentState = buildPaymentStateSnapshot({
      booking_status: row.status,
      payment_required: row.payment_required,
      payment_status: row.payment_status,
      seat_hold_expires_at: row.expires_at,
      latest_payment: latestPayment,
    });

    return {
      id: row.id,
      order_number: row.order_number,
      customer_user_id: row.customer_user_id,
      status: row.status,
      payment_status: row.payment_status,
      payment_required: row.payment_required,
      total_amount: row.total_amount,
      currency: row.currency,
      booking_count: row.booking_count,
      idempotency_key: row.idempotency_key,
      created_by_user_id: row.created_by_user_id,
      created_by_admin_id: row.created_by_admin_id,
      created_by_staff_profile_id: row.created_by_staff_profile_id,
      created_by_role: row.created_by_role,
      admin_notes: row.admin_notes,
      metadata: row.metadata,
      expires_at: row.expires_at,
      paid_at: row.paid_at,
      expired_at: row.expired_at,
      cancelled_at: row.cancelled_at,
      refunded_at: row.refunded_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      realtime_version: row.realtime_version,
      customer: this.toSafeUserSnapshot(row.app_users ?? null),
      created_by_staff: this.toBookingOrderStaffSnapshot(
        row.staff_profiles ?? null,
      ),
      items: (row.booking_order_items ?? []).map((item) =>
        this.toBookingOrderItemSummary(item),
      ),
      latest_payment: latestPayment,
      payment_state: paymentState,
      checkout_required:
        BookingOrderLifecyclePolicy.resolveCheckoutRequired(lifecycleRecord),
    } as BookingOrderSummary;
  }

  private toBookingOrderItemSummary(
    row: BookingOrderItemHydratedRow,
  ): BookingOrderItemSummary {
    return {
      id: row.id,
      booking_order_id: row.booking_order_id,
      booking_id: row.booking_id,
      schedule_id: row.schedule_id,
      class_id: row.class_id,
      trainer_staff_profile_id: row.trainer_staff_profile_id,
      price_amount: row.price_amount,
      currency: row.currency,
      status: row.status,
      booking: row.bookings ? this.toSafeBooking(row.bookings) : null,
      class: this.toClassSnapshot(row.pilates_classes ?? null),
      schedule: this.toScheduleSnapshot(row.pilates_class_schedules ?? null),
      trainer: this.toBookingOrderItemTrainerSnapshot(
        row.staff_profiles ?? null,
      ),
      created_at: row.created_at,
    } as BookingOrderItemSummary;
  }

  private toPrivateBookingListItem(
    row: PrivateBookingHydratedRow,
  ): PrivateBookingListItem {
    return {
      ...this.toSafePrivateBooking(row),
      customer: this.toSafeUserSnapshot(row.app_users ?? null),
      trainer: this.toPrivateTrainerSnapshot(row.staff_profiles ?? null),
    };
  }

  private toSafeBooking(row: BookingHydratedRow): BookingSafeBooking {
    const latestPayment = toPaymentSummary(
      getLatestHydratedPayment(row.payments),
      'booking',
    );
    const paymentState = buildPaymentStateSnapshot({
      booking_status: row.status,
      payment_required: row.payment_required,
      payment_status: row.payment_status,
      seat_hold_expires_at: row.seat_hold_expires_at,
      latest_payment: latestPayment,
    });

    return {
      id: row.id,
      booking_number: row.booking_number,
      user_id: row.user_id,
      schedule_id: row.schedule_id,
      class_id: row.class_id,
      trainer_staff_profile_id: row.trainer_staff_profile_id,
      booking_order_id: row.booking_order_id,
      status: row.status,
      source: row.source,
      payment_status: row.payment_status,
      payment_required: row.payment_required,
      seat_hold_expires_at: row.seat_hold_expires_at,
      price: resolveClassBookingPriceSnapshot(row),
      payment_state: paymentState,
      latest_payment: latestPayment,
      confirmed_at: row.confirmed_at,
      cancelled_at: row.cancelled_at,
      completed_at: row.completed_at,
      no_show_at: row.no_show_at,
      rescheduled_from_booking_id: row.rescheduled_from_booking_id,
      cancellation_reason: row.cancellation_reason,
      admin_notes: row.admin_notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      realtime_version: row.realtime_version,
    };
  }

  private toSafePrivateBooking(
    row: PrivateBookingHydratedRow,
  ): PrivateBookingSafeBooking {
    const latestPayment = toPaymentSummary(
      getLatestHydratedPayment(row.payments),
      'private_booking',
    );
    const paymentState = buildPaymentStateSnapshot({
      booking_status: row.status,
      payment_required: row.payment_required,
      payment_status: row.payment_status,
      seat_hold_expires_at: row.seat_hold_expires_at,
      latest_payment: latestPayment,
    });

    return {
      id: row.id,
      booking_number: row.booking_number,
      user_id: row.user_id,
      trainer_staff_profile_id: row.trainer_staff_profile_id,
      session_date: row.session_date,
      start_time: row.start_time,
      end_time: row.end_time,
      duration_minutes: row.duration_minutes,
      studio: row.studio,
      price_amount: row.price_amount,
      currency: row.currency,
      price: resolvePrivateBookingPriceSnapshot(row),
      status: row.status,
      source: row.source,
      payment_status: row.payment_status,
      payment_required: row.payment_required,
      seat_hold_expires_at: row.seat_hold_expires_at,
      payment_state: paymentState,
      latest_payment: latestPayment,
      confirmed_at: row.confirmed_at,
      cancelled_at: row.cancelled_at,
      completed_at: row.completed_at,
      no_show_at: row.no_show_at,
      rescheduled_at: row.rescheduled_at,
      rescheduled_from_private_booking_id:
        row.rescheduled_from_private_booking_id,
      rescheduled_to_private_booking_id: row.rescheduled_to_private_booking_id,
      cancellation_reason: row.cancellation_reason,
      admin_notes: row.admin_notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      realtime_version: row.realtime_version,
    };
  }

  private toWaitlistListItem(
    row: BookingWaitlistHydratedRow,
  ): BookingWaitlistListItem {
    return {
      ...this.toWaitlistEntry(row),
      customer: this.toSafeUserSnapshot(row.app_users ?? null),
      class: this.toClassSnapshot(row.pilates_classes ?? null),
      schedule: this.toScheduleSnapshot(row.pilates_class_schedules ?? null),
      trainer: null,
    };
  }

  private toWaitlistEntry(
    row: BookingWaitlistHydratedRow,
  ): BookingWaitlistEntry {
    return {
      id: row.id,
      schedule_id: row.schedule_id,
      class_id: row.class_id,
      user_id: row.user_id,
      position: row.position,
      status: row.status,
      joined_at: row.joined_at,
      promoted_at: row.promoted_at,
      expired_at: row.expired_at,
      cancelled_at: row.cancelled_at,
      promotion_expires_at: row.promotion_expires_at,
      converted_booking_id: row.converted_booking_id,
      cancellation_reason: row.cancellation_reason,
      created_at: row.created_at,
      updated_at: row.updated_at,
      realtime_version: row.realtime_version,
    };
  }

  private toSafeUserSnapshot(
    row: AppUserRow | null,
  ): BookingSafeUserSnapshot | null {
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      email: row.email,
      phone: row.phone,
      full_name: row.full_name,
      role: row.role,
      status: row.status,
      is_guest: row.is_guest,
      avatar_path: row.avatar_path,
    };
  }

  private toClassSnapshot(
    row: PilatesClassRow | null,
  ): BookingClassSnapshot | null {
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      title: row.title,
      description: row.description,
      level: row.level,
      status: row.status,
      duration_minutes: row.default_duration_minutes,
      capacity: row.default_capacity,
      default_price_amount: row.default_price_amount,
      currency: row.currency,
      cover_image_path: row.image_path,
    };
  }

  private toScheduleSnapshot(
    row: PilatesClassScheduleRow | null,
  ): BookingScheduleSnapshot | null {
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      class_id: row.class_id,
      trainer_staff_profile_id: row.trainer_staff_profile_id,
      studio: row.studio,
      class_date: row.class_date,
      start_time: row.start_time,
      end_time: row.end_time,
      duration_minutes: row.duration_minutes,
      capacity: row.capacity,
      price_amount: row.price_amount,
      currency: row.currency,
      status: row.status,
      cancellation_reason: row.cancellation_reason,
      cancelled_at: row.cancelled_at,
      completed_at: row.completed_at,
      realtime_version: row.realtime_version,
    };
  }

  private toTrainerSnapshot(
    row: BookingHydratedStaffProfile | null,
  ): BookingTrainerSnapshot | null {
    if (!row) {
      return null;
    }

    return {
      staff_profile_id: row.id,
      app_user_id: row.app_user_id,
      display_name: row.display_name,
      post_title: row.post_title,
      email: row.app_users?.email ?? null,
      phone: row.app_users?.phone ?? null,
      avatar_path: row.app_users?.avatar_path ?? null,
    };
  }

  private toBookingOrderStaffSnapshot(
    row: BookingOrderHydratedStaffProfile | null,
  ): BookingTrainerSnapshot | null {
    if (!row) {
      return null;
    }

    return {
      staff_profile_id: row.id,
      app_user_id: row.app_user_id,
      display_name: row.display_name,
      post_title: row.post_title,
      email: row.app_users?.email ?? null,
      phone: row.app_users?.phone ?? null,
      avatar_path: row.app_users?.avatar_path ?? null,
    };
  }

  private toBookingOrderItemTrainerSnapshot(
    row: BookingOrderItemHydratedStaffProfile | null,
  ): BookingTrainerSnapshot | null {
    if (!row) {
      return null;
    }

    return {
      staff_profile_id: row.id,
      app_user_id: row.app_user_id,
      display_name: row.display_name,
      post_title: row.post_title,
      email: row.app_users?.email ?? null,
      phone: row.app_users?.phone ?? null,
      avatar_path: row.app_users?.avatar_path ?? null,
    };
  }

  private toPrivateTrainerSnapshot(
    row: PrivateBookingHydratedStaffProfile | null,
  ): BookingTrainerSnapshot | null {
    if (!row) {
      return null;
    }

    return {
      staff_profile_id: row.id,
      app_user_id: row.app_user_id,
      display_name: row.display_name,
      post_title: row.post_title,
      email: row.app_users?.email ?? null,
      phone: row.app_users?.phone ?? null,
      avatar_path: row.app_users?.avatar_path ?? null,
    };
  }

  private toAvailabilitySnapshot(
    row:
      | BookingCreateAtomicRpcRow
      | BookingCancelAtomicRpcRow
      | BookingRescheduleAtomicRpcRow,
  ): BookingAvailabilitySnapshot {
    return {
      schedule_id: this.resolveAvailabilityScheduleId(row),
      capacity: row.capacity,
      booked_count: row.booked_count,
      pending_hold_count: row.pending_hold_count,
      available_seats: row.available_seats,
      waitlist_count: row.waitlist_count,
      waitlist_available: row.available_seats <= 0,
      schedule_realtime_version: row.schedule_realtime_version,
    };
  }

  private toBookingOrderLifecycleRecord(
    row: BookingOrderHydratedRow,
  ): BookingOrderLifecycleRecord {
    return {
      id: row.id,
      order_number: row.order_number,
      customer_user_id: row.customer_user_id,
      status: row.status,
      payment_status: row.payment_status,
      payment_required: row.payment_required,
      total_amount: row.total_amount,
      currency: row.currency,
      booking_count: row.booking_count,
      expires_at: row.expires_at,
      paid_at: row.paid_at,
      expired_at: row.expired_at,
      cancelled_at: row.cancelled_at,
      refunded_at: row.refunded_at,
    };
  }

  private resolveBookingOrderScheduleIds(
    row: BookingOrderHydratedRow,
    fallbackScheduleIds: readonly string[],
  ): readonly string[] {
    const itemScheduleIds = (row.booking_order_items ?? [])
      .map((item) => item.schedule_id)
      .filter((scheduleId) => scheduleId.length > 0);

    if (itemScheduleIds.length > 0) {
      return [...new Set(itemScheduleIds)];
    }

    return fallbackScheduleIds;
  }

  private resolveAvailabilityScheduleId(
    row:
      | BookingCreateAtomicRpcRow
      | BookingCancelAtomicRpcRow
      | BookingRescheduleAtomicRpcRow,
  ): string {
    if ('old_booking_id' in row) {
      return row.new_booking_id ?? row.waitlist_id ?? row.old_booking_id;
    }

    if ('cancelled_booking_id' in row) {
      return (
        row.promoted_booking_id ??
        row.promoted_waitlist_id ??
        row.cancelled_booking_id
      );
    }

    return row.booking_id ?? row.waitlist_id ?? '';
  }

  private resolveCreateActionResult(
    value: string,
  ): BookingCreateResult['result'] {
    if (
      value === BOOKING_RPC_ACTION_EXISTING_BOOKING ||
      value === BOOKING_RPC_ACTION_BOOKED ||
      value === BOOKING_RPC_ACTION_WAITLISTED
    ) {
      return value;
    }

    throw AppError.bookingDatabaseTransactionFailed(
      new Error(`Unexpected create booking RPC action result: ${value}`),
    );
  }

  private resolveBookingOrderCreateActionResult(
    value: string,
  ): BookingBulkCreateResult['result'] {
    if (
      value === BOOKING_ORDER_RPC_ACTION_CREATED_ORDER ||
      value === BOOKING_ORDER_RPC_ACTION_EXISTING_ORDER
    ) {
      return value;
    }

    throw AppError.bookingDatabaseTransactionFailed(
      new Error(`Unexpected create booking order RPC action result: ${value}`),
    );
  }

  private resolveCancelActionResult(
    value: string,
  ): BookingCancelResult['result'] {
    if (
      value === BOOKING_RPC_ACTION_CANCELLED ||
      value === BOOKING_RPC_ACTION_CANCELLED_AND_PROMOTED
    ) {
      return value;
    }

    throw AppError.bookingDatabaseTransactionFailed(
      new Error(`Unexpected cancel booking RPC action result: ${value}`),
    );
  }

  private resolveRescheduleActionResult(
    value: string,
  ): BookingRescheduleResult['result'] {
    if (
      value === BOOKING_RPC_ACTION_RESCHEDULED ||
      value === BOOKING_RPC_ACTION_TARGET_WAITLISTED
    ) {
      return value;
    }

    throw AppError.bookingDatabaseTransactionFailed(
      new Error(`Unexpected reschedule booking RPC action result: ${value}`),
    );
  }

  private resolvePrivateCreateActionResult(
    value: string,
  ): PrivateBookingCreateResult['result'] {
    if (value === 'existing_private_booking' || value === 'private_booked') {
      return value;
    }

    throw AppError.privateBookingDatabaseTransactionFailed(
      new Error(
        `Unexpected create private booking RPC action result: ${value}`,
      ),
    );
  }

  private resolvePrivateCancelActionResult(
    value: string,
  ): PrivateBookingCancelResult['result'] {
    if (value === 'private_cancelled') {
      return value;
    }

    throw AppError.privateBookingDatabaseTransactionFailed(
      new Error(
        `Unexpected cancel private booking RPC action result: ${value}`,
      ),
    );
  }

  private resolvePrivateRescheduleActionResult(
    value: string,
  ): PrivateBookingRescheduleResult['result'] {
    if (value === 'private_rescheduled') {
      return value;
    }

    throw AppError.privateBookingDatabaseTransactionFailed(
      new Error(
        `Unexpected reschedule private booking RPC action result: ${value}`,
      ),
    );
  }

  private requireReturnedId(value: string | null, message: string): string {
    if (value) {
      return value;
    }

    throw AppError.bookingDatabaseTransactionFailed(new Error(message));
  }

  private requireReturnedPrivateBookingId(
    value: string | null,
    message: string,
  ): string {
    if (value) {
      return value;
    }

    throw AppError.privateBookingDatabaseTransactionFailed(new Error(message));
  }
}
