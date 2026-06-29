// apps/api/src/modules/bookings/application/booking-admin.service.ts
/**
 * LAFAM admin booking service.
 *
 * Role:
 * - Owns admin/staff/trainer-facing Booking Module business flows.
 * - Lists and reads bookings across customers.
 * - Creates backend-owned bulk Pilates booking orders.
 * - Lists, reads, creates, cancels, and reschedules private trainer bookings.
 * - Cancels bookings through the atomic cancellation RPC.
 * - Reschedules bookings through the atomic reschedule RPC.
 * - Performs controlled admin status overrides.
 * - Lists and removes schedule waitlist entries.
 * - Enforces trainer schedule ownership for scoped booking management.
 *
 * Important:
 * - This service does not calculate seat capacity in TypeScript.
 * - This service does not insert Pilates class bookings directly.
 * - This service does not insert private trainer bookings directly.
 * - Booking RPC functions remain the concurrency authority.
 * - Booking-order RPC functions remain the all-or-nothing bulk booking authority.
 * - Private booking RPC functions remain the trainer conflict authority.
 * - Admin mutation flows must leave audit/history records.
 * - Controller role checks are not enough for trainers.
 * - Trainer scope must be enforced in this service.
 */

import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import type {
  AppUserRow,
  DatabaseJsonObject,
  PilatesClassRow,
  PilatesClassScheduleRow,
} from '../../../database/database.types';
import {
  AUTH_ADMIN_ROLE,
  AUTH_TRAINER_ROLE,
  type AuthUserRole,
} from '../../auth/constants/auth-role.constants';
import { StaffRepository } from '../../staff/repositories/staff.repository';
import { EmailNotificationService } from '../../notifications/application/email-notification.service';
import {
  EMAIL_NOTIFICATION_ENTITY_TYPE_BOOKING,
  EMAIL_NOTIFICATION_ENTITY_TYPE_BOOKING_ORDER,
  EMAIL_NOTIFICATION_ENTITY_TYPE_PRIVATE_BOOKING,
  EMAIL_NOTIFICATION_ENTITY_TYPE_WAITLIST,
  EMAIL_NOTIFICATION_EVENT_BOOKING_CANCELLED_BY_ADMIN,
  EMAIL_NOTIFICATION_EVENT_BOOKING_CREATED_PENDING_PAYMENT,
  EMAIL_NOTIFICATION_EVENT_BOOKING_RESCHEDULED_BY_ADMIN,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_CANCELLED_BY_ADMIN,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_CREATED_PENDING_PAYMENT,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_RESCHEDULED_BY_ADMIN,
  EMAIL_NOTIFICATION_EVENT_WAITLIST_JOINED,
  EMAIL_NOTIFICATION_EVENT_WAITLIST_PROMOTED_TO_BOOKING,
  EMAIL_NOTIFICATION_EVENT_WAITLIST_PROMOTION_PAYMENT_REQUIRED,
  EMAIL_NOTIFICATION_EVENT_WAITLIST_REMOVED_BY_ADMIN,
  EMAIL_RECIPIENT_ROLE_CUSTOMER,
  EMAIL_RECIPIENT_ROLE_TRAINER,
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
  BOOKING_ADMIN_DEFAULT_LIMIT,
  BOOKING_ADMIN_DEFAULT_OFFSET,
  BOOKING_ORDER_RPC_ACTION_CREATED_ORDER,
  BOOKING_ORDER_RPC_ACTION_EXISTING_ORDER,
  BOOKING_PAYMENT_CONFIRMING_STATUSES,
  BOOKING_PAYMENT_FAILURE_STATUSES,
  BOOKING_PAYMENT_PAYABLE_STATUSES,
  BOOKING_PAYMENT_REFUNDABLE_STATUSES,
  BOOKING_PAYMENT_RETRYABLE_STATUSES,
  BOOKING_PAYMENT_SETTLED_STATUSES,
  BOOKING_PAYMENT_TERMINAL_STATUSES,
  BOOKING_RPC_ACTION_CANCELLED,
  BOOKING_RPC_ACTION_CANCELLED_AND_PROMOTED,
  BOOKING_RPC_ACTION_RESCHEDULED,
  BOOKING_RPC_ACTION_TARGET_WAITLISTED,
  BOOKING_SOURCE_ADMIN_DASHBOARD,
  BOOKING_STATUS_CONFIRMED,
  BOOKING_STATUS_PENDING_PAYMENT,
  PRIVATE_BOOKING_DEFAULT_CURRENCY,
  PRIVATE_BOOKING_DEFAULT_DURATION_MINUTES,
  PRIVATE_BOOKING_DEFAULT_PAYMENT_REQUIRED,
  PRIVATE_BOOKING_DEFAULT_PRICE_AMOUNT,
  PRIVATE_BOOKING_DEFAULT_STUDIO,
  WAITLIST_STATUS_WAITING,
  type BookingPaymentStatus,
  type BookingWaitlistStatus,
} from '../constants/booking.constants';
import { BookingAccessPolicy } from '../domain/booking-access.policy';
import {
  assertAdminCanOverrideBookingStatus,
  assertBookingCanBeCancelled,
  assertBookingCanBeRescheduled,
} from '../domain/booking-lifecycle.policy';
import {
  BookingOrderLifecyclePolicy,
  type BookingOrderLifecycleRecord,
} from '../domain/booking-order-lifecycle.policy';
import { PrivateBookingLifecyclePolicy } from '../domain/private-booking-lifecycle.policy';
import {
  assertWaitlistCanBeRemoved,
  assertWaitlistEntryExists,
} from '../domain/waitlist-fifo.policy';
import type { AdminCancelBookingDto } from '../dto/admin-cancel-booking.dto';
import type { AdminOverrideBookingDto } from '../dto/admin-override-booking.dto';
import type { CreateAdminBulkBookingDto } from '../dto/create-admin-bulk-booking.dto';
import type { CreateAdminPrivateBookingDto } from '../dto/create-admin-private-booking.dto';
import type { ListAdminBookingsQueryDto } from '../dto/list-admin-bookings-query.dto';
import type { ListAdminPrivateBookingsQueryDto } from '../dto/list-private-bookings-query.dto';
import type { RescheduleBookingDto } from '../dto/reschedule-booking.dto';
import type { ReschedulePrivateBookingDto } from '../dto/reschedule-private-booking.dto';
import { BookingRepository } from '../repositories/booking.repository';
import { BookingAvailabilityService } from './booking-availability.service';
import type {
  BookingAdminListFilters,
  BookingAvailabilitySnapshot,
  BookingBulkCreateResult,
  BookingCancelAtomicRpcRow,
  BookingCancelResult,
  BookingClassSnapshot,
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
  PrivateBookingAdminListFilters,
  PrivateBookingCancelResult,
  PrivateBookingCreateResult,
  PrivateBookingDetail,
  PrivateBookingHistoryEntry,
  PrivateBookingHistoryRecord,
  PrivateBookingHydratedRow,
  PrivateBookingListItem,
  PrivateBookingListResult,
  PrivateBookingRescheduleResult,
  PrivateBookingSafeBooking,
  ResolvedBookingManagementScope,
} from '../types/booking.types';

export interface BookingAdminActorContext {
  readonly user_id: string;
  readonly role: AuthUserRole;
}

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

const LEGACY_ADMIN_ACTOR_CONTEXT: BookingAdminActorContext = {
  user_id: 'legacy-admin-context',
  role: AUTH_ADMIN_ROLE,
};

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

function createTrainerEmailRecipientFromSnapshot(
  trainer: BookingTrainerSnapshot | null | undefined,
): EmailRecipient | null {
  if (!trainer) {
    return null;
  }

  const email = normalizeOptionalEmailString(trainer.email);

  if (!email) {
    return null;
  }

  return {
    role: EMAIL_RECIPIENT_ROLE_TRAINER,
    email,
    name: trainer.display_name,
    appUserId: trainer.app_user_id,
  };
}

function createTrainerEmailRecipientsFromSnapshots(
  trainers: readonly (BookingTrainerSnapshot | null | undefined)[],
): readonly EmailRecipient[] {
  return dedupeEmailRecipients(
    trainers.flatMap((trainer) => {
      const recipient = createTrainerEmailRecipientFromSnapshot(trainer);

      return recipient ? [recipient] : [];
    }),
  );
}

function dedupeEmailRecipients(
  recipients: readonly EmailRecipient[],
): readonly EmailRecipient[] {
  const seen = new Set<string>();
  const uniqueRecipients: EmailRecipient[] = [];

  for (const recipient of recipients) {
    const key = [
      recipient.role,
      recipient.appUserId ?? '',
      recipient.email.toLowerCase(),
    ].join(':');

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueRecipients.push(recipient);
  }

  return uniqueRecipients;
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

function createBaseBookingTemplateData(input: {
  readonly recipient: EmailRecipient;
  readonly customer?: BookingSafeUserSnapshot | null;
  readonly trainer?: BookingTrainerSnapshot | null;
}): DatabaseJsonObject {
  const templateData: DatabaseJsonObject = {};

  addOptionalTemplateString(
    templateData,
    'recipientName',
    input.recipient.name,
  );
  addOptionalTemplateString(
    templateData,
    'customerName',
    input.customer?.full_name,
  );
  addOptionalTemplateString(
    templateData,
    'trainerName',
    input.trainer?.display_name,
  );

  return templateData;
}

function buildBookingEmailTemplateData(input: {
  readonly booking: BookingListItem;
  readonly recipient: EmailRecipient;
}): DatabaseJsonObject {
  const templateData = createBaseBookingTemplateData({
    recipient: input.recipient,
    customer: input.booking.customer,
    trainer: input.booking.trainer,
  });

  addOptionalTemplateString(
    templateData,
    'bookingNumber',
    input.booking.booking_number,
  );
  addOptionalTemplateString(
    templateData,
    'classTitle',
    input.booking.class?.title,
  );
  addOptionalTemplateString(
    templateData,
    'sessionDate',
    input.booking.schedule?.class_date,
  );
  addOptionalTemplateString(
    templateData,
    'startTime',
    input.booking.schedule?.start_time,
  );
  addOptionalTemplateString(
    templateData,
    'endTime',
    input.booking.schedule?.end_time,
  );
  addOptionalTemplateString(
    templateData,
    'expiresAt',
    input.booking.payment_state?.hold_expires_at ??
      input.booking.seat_hold_expires_at,
  );

  addOptionalTemplateString(
    templateData,
    'amountLabel',
    formatMoneyAmount(
      input.booking.latest_payment?.final_amount ?? input.booking.price?.amount,
      input.booking.latest_payment?.currency ?? input.booking.price?.currency,
    ),
  );

  return templateData;
}

function buildBookingRescheduledEmailTemplateData(input: {
  readonly oldBooking: BookingListItem;
  readonly newBooking: BookingListItem;
  readonly recipient: EmailRecipient;
}): DatabaseJsonObject {
  const templateData = buildBookingEmailTemplateData({
    booking: input.newBooking,
    recipient: input.recipient,
  });

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

function buildBookingOrderEmailTemplateData(input: {
  readonly bookingOrder: BookingOrderSummary;
  readonly recipient: EmailRecipient;
}): DatabaseJsonObject {
  const templateData = createBaseBookingTemplateData({
    recipient: input.recipient,
    customer: input.bookingOrder.customer,
  });

  addOptionalTemplateString(
    templateData,
    'orderNumber',
    input.bookingOrder.order_number,
  );
  addOptionalTemplateString(
    templateData,
    'expiresAt',
    input.bookingOrder.expires_at,
  );
  addOptionalTemplateString(
    templateData,
    'amountLabel',
    formatMoneyAmount(
      input.bookingOrder.total_amount,
      input.bookingOrder.currency,
    ),
  );

  return templateData;
}

function buildPrivateBookingEmailTemplateData(input: {
  readonly privateBooking: PrivateBookingListItem;
  readonly recipient: EmailRecipient;
}): DatabaseJsonObject {
  const templateData = createBaseBookingTemplateData({
    recipient: input.recipient,
    customer: input.privateBooking.customer,
    trainer: input.privateBooking.trainer,
  });

  addOptionalTemplateString(
    templateData,
    'bookingNumber',
    input.privateBooking.booking_number,
  );
  addOptionalTemplateString(
    templateData,
    'sessionTitle',
    'Private trainer session',
  );
  addOptionalTemplateString(
    templateData,
    'sessionDate',
    input.privateBooking.session_date,
  );
  addOptionalTemplateString(
    templateData,
    'startTime',
    input.privateBooking.start_time,
  );
  addOptionalTemplateString(
    templateData,
    'endTime',
    input.privateBooking.end_time,
  );
  addOptionalTemplateString(
    templateData,
    'expiresAt',
    input.privateBooking.payment_state?.hold_expires_at ??
      input.privateBooking.seat_hold_expires_at,
  );

  addOptionalTemplateString(
    templateData,
    'amountLabel',
    formatMoneyAmount(
      input.privateBooking.latest_payment?.final_amount ??
        input.privateBooking.price_amount,
      input.privateBooking.latest_payment?.currency ??
        input.privateBooking.currency,
    ),
  );

  return templateData;
}

function buildPrivateBookingRescheduledEmailTemplateData(input: {
  readonly oldPrivateBooking: PrivateBookingListItem;
  readonly newPrivateBooking: PrivateBookingListItem;
  readonly recipient: EmailRecipient;
}): DatabaseJsonObject {
  const templateData = buildPrivateBookingEmailTemplateData({
    privateBooking: input.newPrivateBooking,
    recipient: input.recipient,
  });

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

function buildWaitlistEmailTemplateData(input: {
  readonly waitlist: BookingWaitlistListItem;
  readonly recipient: EmailRecipient;
}): DatabaseJsonObject {
  const templateData = createBaseBookingTemplateData({
    recipient: input.recipient,
    customer: input.waitlist.customer,
  });

  addOptionalTemplateString(
    templateData,
    'classTitle',
    input.waitlist.class?.title,
  );
  addOptionalTemplateString(
    templateData,
    'sessionDate',
    input.waitlist.schedule?.class_date,
  );
  addOptionalTemplateString(
    templateData,
    'startTime',
    input.waitlist.schedule?.start_time,
  );
  addOptionalTemplateString(
    templateData,
    'endTime',
    input.waitlist.schedule?.end_time,
  );
  addOptionalTemplateNumber(
    templateData,
    'waitlistPosition',
    input.waitlist.position,
  );
  addOptionalTemplateString(
    templateData,
    'expiresAt',
    input.waitlist.promotion_expires_at,
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

function assertAdminOverrideDoesNotBypassPayment(
  booking: BookingHydratedRow,
  targetStatus: BookingHydratedRow['status'],
): void {
  if (targetStatus !== BOOKING_STATUS_CONFIRMED) {
    return;
  }

  if (!booking.payment_required) {
    return;
  }

  if (
    isPaymentStatusIncluded(
      BOOKING_PAYMENT_CONFIRMING_STATUSES,
      booking.payment_status,
    )
  ) {
    return;
  }

  throw AppError.invalidRequest(
    'Admin cannot confirm a payment-required booking before payment is settled.',
    {
      booking_id: booking.id,
      booking_number: booking.booking_number,
      current_status: booking.status,
      target_status: targetStatus,
      payment_required: booking.payment_required,
      payment_status: booking.payment_status,
    },
  );
}

@Injectable()
export class BookingAdminService {
  constructor(
    private readonly bookingRepository: BookingRepository,
    private readonly bookingAvailabilityService: BookingAvailabilityService,
    private readonly staffRepository: StaffRepository,
    private readonly emailNotificationService: EmailNotificationService,
  ) {}

  async listBookings(
    dto: ListAdminBookingsQueryDto,
    actor?: BookingAdminActorContext,
  ): Promise<BookingListResult> {
    const scope = await this.resolveManagementScope(actor);
    const filters = this.buildAdminBookingFilters(dto, scope);
    const result = await this.bookingRepository.listAdminBookings(filters);

    return {
      bookings: result.rows.map((row) => this.toBookingListItem(row)),
      total: result.total,
      limit: filters.limit,
      offset: filters.offset,
    };
  }

  async listPrivateBookings(
    dto: ListAdminPrivateBookingsQueryDto,
    actor?: BookingAdminActorContext,
  ): Promise<PrivateBookingListResult> {
    const scope = await this.resolveManagementScope(actor);
    BookingAccessPolicy.assertFullManagementScope(scope);

    const filters = this.buildAdminPrivateBookingFilters(dto);
    const result =
      await this.bookingRepository.listAdminPrivateBookings(filters);

    return {
      private_bookings: result.rows.map((row) =>
        this.toPrivateBookingListItem(row),
      ),
      total: result.total,
      limit: filters.limit,
      offset: filters.offset,
    };
  }

  async createBulkBooking(
    actor: BookingAdminActorContext,
    dto: CreateAdminBulkBookingDto,
  ): Promise<BookingBulkCreateResult> {
    BookingOrderLifecyclePolicy.assertScheduleSelectionIsValid(
      dto.schedule_ids,
    );

    const scope = await this.resolveManagementScope(actor);
    const scheduleScopes = await this.bookingRepository.findScheduleScopesByIds(
      {
        schedule_ids: dto.schedule_ids,
      },
    );

    BookingAccessPolicy.assertScheduleScopesWithinManagementScope({
      scope,
      requested_schedule_ids: dto.schedule_ids,
      schedule_scopes: scheduleScopes,
    });

    await this.bookingAvailabilityService.assertBulkSchedulesHaveAvailableSeats(
      {
        schedule_ids: dto.schedule_ids,
      },
    );

    const customerUserId = this.requireCustomerUserId(dto.customer_user_id);
    const createdByStaffProfileId =
      BookingAccessPolicy.isTrainerScopedManagementScope(scope)
        ? scope.trainer_staff_profile_id
        : null;

    const rpcResult = await this.bookingRepository.createBookingOrderAtomic({
      customer_user_id: customerUserId,
      schedule_ids: dto.schedule_ids,
      idempotency_key: dto.idempotency_key ?? null,
      created_by_user_id: actor.user_id,
      created_by_admin_id: BookingAccessPolicy.isFullManagementScope(scope)
        ? actor.user_id
        : null,
      created_by_staff_profile_id: createdByStaffProfileId,
      created_by_role: actor.role,
      source: BOOKING_SOURCE_ADMIN_DASHBOARD,
      admin_notes: dto.admin_notes ?? null,
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
    const bookingOrderRow =
      await this.getRequiredBookingOrderRow(bookingOrderId);
    const bookingOrder = this.toBookingOrderSummary(bookingOrderRow);
    const bookingOrderItems = (bookingOrderRow.booking_order_items ?? []).map(
      (item) => this.toBookingOrderItemSummary(item),
    );
    await this.notifyAdminCreatedBookingOrderPendingPayment(bookingOrder);

    return {
      result: actionResult,
      booking_order: bookingOrder,
      items: bookingOrderItems,
      checkout_required: bookingOrder.checkout_required,
    };
  }

  async createPrivateBooking(
    adminUserId: string,
    dto: CreateAdminPrivateBookingDto,
    actor?: BookingAdminActorContext,
  ): Promise<PrivateBookingCreateResult> {
    const scope = await this.resolveManagementScope(
      actor ?? {
        user_id: adminUserId,
        role: AUTH_ADMIN_ROLE,
      },
    );
    BookingAccessPolicy.assertFullManagementScope(scope);

    const customerUserId = this.requireCustomerUserId(dto.user_id);
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
      user_id: customerUserId,
      trainer_staff_profile_id: dto.trainer_staff_profile_id,
      session_date: sessionDate,
      start_time: startTime,
      duration_minutes: durationMinutes,
      studio: dto.studio ?? PRIVATE_BOOKING_DEFAULT_STUDIO,
      payment_required: PRIVATE_BOOKING_DEFAULT_PAYMENT_REQUIRED,
      idempotency_key: dto.idempotency_key ?? null,
      created_by_admin_id: adminUserId,
      source: BOOKING_SOURCE_ADMIN_DASHBOARD,
    });

    const actionResult = this.resolvePrivateCreateActionResult(
      rpcResult.rpc.action_result,
    );
    const privateBookingId = this.requireReturnedPrivateBookingId(
      rpcResult.rpc.private_booking_id,
      'create_private_trainer_booking_atomic did not return private_booking_id.',
    );

    if (actionResult === 'private_booked') {
      await this.bookingRepository.updatePrivateBookingPrice(
        privateBookingId,
        dto.price_amount ?? PRIVATE_BOOKING_DEFAULT_PRICE_AMOUNT,
        dto.currency ?? PRIVATE_BOOKING_DEFAULT_CURRENCY,
      );
    }

    const privateBooking =
      await this.getRequiredPrivateBookingListItem(privateBookingId);
    await this.notifyAdminCreatedPrivateBookingPendingPayment(privateBooking);
    return {
      result: actionResult,
      private_booking: privateBooking,
      payment_state: privateBooking.payment_state ?? null,
      checkout_required:
        privateBooking.payment_state?.checkout_required ?? false,
    };
  }

  async getBookingById(
    bookingId: string,
    actor?: BookingAdminActorContext,
  ): Promise<BookingDetail> {
    const scope = await this.resolveManagementScope(actor);
    const lookup = await this.bookingRepository.findBookingById({
      booking_id: bookingId,
      include_deleted: false,
    });

    if (!lookup.booking) {
      throw AppError.bookingNotFound();
    }

    this.assertBookingWithinManagementScope(scope, lookup.booking);

    const availability =
      await this.bookingAvailabilityService.getAvailabilitySnapshot({
        schedule_id: lookup.booking.schedule_id,
      });

    return this.toBookingDetail(
      lookup.booking,
      lookup.history.map((history) => this.toHistoryEntry(history)),
      availability,
    );
  }

  async getBookingOrderById(
    bookingOrderId: string,
    actor?: BookingAdminActorContext,
  ): Promise<BookingOrderDetail> {
    const scope = await this.resolveManagementScope(actor);
    const bookingOrder = await this.getRequiredBookingOrderRow(bookingOrderId);

    this.assertBookingOrderWithinManagementScope(scope, bookingOrder);

    return this.toBookingOrderDetail(bookingOrder);
  }

  async getPrivateBookingById(
    privateBookingId: string,
    actor?: BookingAdminActorContext,
  ): Promise<PrivateBookingDetail> {
    const scope = await this.resolveManagementScope(actor);
    BookingAccessPolicy.assertFullManagementScope(scope);

    const lookup = await this.bookingRepository.findPrivateBookingById({
      private_booking_id: privateBookingId,
      include_deleted: false,
    });

    if (!lookup.private_booking) {
      throw AppError.privateBookingNotFound();
    }

    return this.toPrivateBookingDetail(
      lookup.private_booking,
      lookup.history.map((history) => this.toPrivateHistoryEntry(history)),
    );
  }

  async cancelBooking(
    adminUserId: string,
    bookingId: string,
    dto: AdminCancelBookingDto,
    actor?: BookingAdminActorContext,
  ): Promise<BookingCancelResult> {
    const scope = await this.resolveManagementScope(
      actor ?? {
        user_id: adminUserId,
        role: AUTH_ADMIN_ROLE,
      },
    );
    const existingLookup = await this.bookingRepository.findBookingById({
      booking_id: bookingId,
      include_deleted: false,
    });

    if (!existingLookup.booking) {
      throw AppError.bookingNotFound();
    }

    this.assertBookingWithinManagementScope(scope, existingLookup.booking);
    assertBookingCanBeCancelled(existingLookup.booking);

    const rpcResult = await this.bookingRepository.cancelBookingAtomic({
      booking_id: bookingId,
      actor_user_id: null,
      actor_admin_id: adminUserId,
      reason: dto.reason,
    });

    const actionResult = this.resolveCancelActionResult(
      rpcResult.rpc.action_result,
    );
    const availability = this.toAvailabilitySnapshot(
      rpcResult.rpc,
      existingLookup.booking.schedule_id,
    );

    const cancelledBooking = await this.getRequiredBookingListItem(
      rpcResult.rpc.cancelled_booking_id,
    );

    const promotedBooking = rpcResult.rpc.promoted_booking_id
      ? await this.getRequiredBookingListItem(rpcResult.rpc.promoted_booking_id)
      : null;

    const promotedWaitlist = rpcResult.rpc.promoted_waitlist_id
      ? await this.getRequiredWaitlistItem(rpcResult.rpc.promoted_waitlist_id)
      : null;
    await this.notifyBookingCancelledByAdmin(cancelledBooking);

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
    adminUserId: string,
    privateBookingId: string,
    dto: AdminCancelBookingDto,
    actor?: BookingAdminActorContext,
  ): Promise<PrivateBookingCancelResult> {
    const scope = await this.resolveManagementScope(
      actor ?? {
        user_id: adminUserId,
        role: AUTH_ADMIN_ROLE,
      },
    );
    BookingAccessPolicy.assertFullManagementScope(scope);

    const existingLookup = await this.bookingRepository.findPrivateBookingById({
      private_booking_id: privateBookingId,
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
      actor_user_id: null,
      actor_admin_id: adminUserId,
      reason: dto.reason,
    });

    const actionResult = this.resolvePrivateCancelActionResult(
      rpcResult.rpc.action_result,
    );
    const privateBooking = await this.getRequiredPrivateBookingListItem(
      rpcResult.rpc.private_booking_id,
    );
    await this.notifyPrivateBookingCancelledByAdmin(privateBooking);
    return {
      result: actionResult,
      private_booking: privateBooking,
    };
  }

  async rescheduleBooking(
    adminUserId: string,
    bookingId: string,
    dto: RescheduleBookingDto,
    actor?: BookingAdminActorContext,
  ): Promise<BookingRescheduleResult> {
    const scope = await this.resolveManagementScope(
      actor ?? {
        user_id: adminUserId,
        role: AUTH_ADMIN_ROLE,
      },
    );
    const existingLookup = await this.bookingRepository.findBookingById({
      booking_id: bookingId,
      include_deleted: false,
    });

    if (!existingLookup.booking) {
      throw AppError.bookingNotFound();
    }

    this.assertBookingWithinManagementScope(scope, existingLookup.booking);
    await this.assertScheduleWithinManagementScope(
      scope,
      dto.target_schedule_id,
    );
    assertBookingCanBeRescheduled(existingLookup.booking);

    const rpcResult = await this.bookingRepository.rescheduleBookingAtomic({
      booking_id: bookingId,
      target_schedule_id: dto.target_schedule_id,
      actor_user_id: null,
      actor_admin_id: adminUserId,
      join_waitlist_if_full: dto.join_waitlist_if_full ?? false,
      reason: dto.reason ?? null,
    });

    const actionResult = this.resolveRescheduleActionResult(
      rpcResult.rpc.action_result,
    );
    const availability = this.toAvailabilitySnapshot(
      rpcResult.rpc,
      dto.target_schedule_id,
    );

    const oldBooking = await this.getRequiredBookingListItem(
      rpcResult.rpc.old_booking_id,
    );

    if (actionResult === BOOKING_RPC_ACTION_TARGET_WAITLISTED) {
      const waitlistId = this.requireReturnedId(
        rpcResult.rpc.waitlist_id,
        'reschedule_pilates_booking_atomic did not return waitlist_id.',
      );
      const waitlist = await this.getRequiredWaitlistItem(waitlistId);

      await this.notifyWaitlistJoinedByAdminReschedule(waitlist);

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
    const newBooking = await this.getRequiredBookingListItem(newBookingId);
    await this.notifyBookingRescheduledByAdmin({
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
    adminUserId: string,
    privateBookingId: string,
    dto: ReschedulePrivateBookingDto,
    actor?: BookingAdminActorContext,
  ): Promise<PrivateBookingRescheduleResult> {
    const scope = await this.resolveManagementScope(
      actor ?? {
        user_id: adminUserId,
        role: AUTH_ADMIN_ROLE,
      },
    );
    BookingAccessPolicy.assertFullManagementScope(scope);

    const existingLookup = await this.bookingRepository.findPrivateBookingById({
      private_booking_id: privateBookingId,
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
        actor_user_id: null,
        actor_admin_id: adminUserId,
        reason: dto.reason ?? null,
        idempotency_key: dto.idempotency_key ?? null,
        payment_required: PRIVATE_BOOKING_DEFAULT_PAYMENT_REQUIRED,
      });

    const actionResult = this.resolvePrivateRescheduleActionResult(
      rpcResult.rpc.action_result,
    );
    const oldPrivateBooking = await this.getRequiredPrivateBookingListItem(
      rpcResult.rpc.old_private_booking_id,
    );
    const newPrivateBookingId = this.requireReturnedPrivateBookingId(
      rpcResult.rpc.new_private_booking_id,
      'reschedule_private_trainer_booking_atomic did not return new_private_booking_id.',
    );
    const newPrivateBooking =
      await this.getRequiredPrivateBookingListItem(newPrivateBookingId);
    await this.notifyPrivateBookingRescheduledByAdmin({
      oldPrivateBooking,
      newPrivateBooking,
    });
    return {
      result: actionResult,
      old_private_booking: oldPrivateBooking,
      new_private_booking: newPrivateBooking,
    };
  }

  async overrideBookingStatus(
    adminUserId: string,
    bookingId: string,
    dto: AdminOverrideBookingDto,
    actor?: BookingAdminActorContext,
  ): Promise<BookingDetail> {
    const scope = await this.resolveManagementScope(
      actor ?? {
        user_id: adminUserId,
        role: AUTH_ADMIN_ROLE,
      },
    );
    const existingLookup = await this.bookingRepository.findBookingById({
      booking_id: bookingId,
      include_deleted: false,
    });

    if (!existingLookup.booking) {
      throw AppError.bookingNotFound();
    }

    this.assertBookingWithinManagementScope(scope, existingLookup.booking);

    assertAdminCanOverrideBookingStatus(
      existingLookup.booking,
      dto.target_status,
    );
    assertAdminOverrideDoesNotBypassPayment(
      existingLookup.booking,
      dto.target_status,
    );

    await this.bookingRepository.overrideBookingStatus({
      booking_id: bookingId,
      target_status: dto.target_status,
      actor_admin_id: adminUserId,
      reason: dto.reason,
      admin_notes: dto.admin_notes ?? null,
      changed_at: new Date().toISOString(),
    });

    return this.getBookingById(bookingId, actor);
  }

  async listScheduleWaitlist(
    scheduleId: string,
    status: BookingWaitlistStatus | null = WAITLIST_STATUS_WAITING,
    limit = BOOKING_ADMIN_DEFAULT_LIMIT,
    offset = BOOKING_ADMIN_DEFAULT_OFFSET,
    actor?: BookingAdminActorContext,
  ): Promise<BookingWaitlistListResult> {
    const scope = await this.resolveManagementScope(actor);

    await this.assertScheduleWithinManagementScope(scope, scheduleId);

    const result = await this.bookingRepository.listAdminScheduleWaitlist({
      schedule_id: scheduleId,
      status,
      limit,
      offset,
    });

    return {
      waitlist: result.rows.map((row) => this.toWaitlistListItem(row)),
      total: result.total,
      limit,
      offset,
    };
  }

  async removeWaitlistEntry(
    waitlistId: string,
    reason: string | null = null,
    actor?: BookingAdminActorContext,
  ): Promise<BookingWaitlistListItem> {
    const scope = await this.resolveManagementScope(actor);
    const lookup = await this.bookingRepository.findWaitlistById({
      waitlist_id: waitlistId,
    });

    assertWaitlistEntryExists(lookup.waitlist);
    this.assertWaitlistWithinManagementScope(scope, lookup.waitlist);
    assertWaitlistCanBeRemoved(lookup.waitlist);

    await this.bookingRepository.removeWaitlistEntry({
      waitlist_id: waitlistId,
      reason,
    });

    const removedWaitlist = await this.getRequiredWaitlistItem(waitlistId);

    await this.notifyWaitlistRemovedByAdmin(removedWaitlist);

    return removedWaitlist;
  }
  private async createEmailNotificationBestEffort(input: {
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
      // Best-effort notification side effect. The committed booking mutation remains authoritative.
    }
  }

  private async notifyBookingRecipients(input: {
    readonly eventType: EmailNotificationEvent;
    readonly booking: BookingListItem;
    readonly recipients: readonly EmailRecipient[];
    readonly scope?: string | null;
    readonly metadata?: DatabaseJsonObject;
  }): Promise<void> {
    for (const recipient of dedupeEmailRecipients(input.recipients)) {
      await this.createEmailNotificationBestEffort({
        eventType: input.eventType,
        recipient,
        templateData: buildBookingEmailTemplateData({
          booking: input.booking,
          recipient,
        }),
        entityType: EMAIL_NOTIFICATION_ENTITY_TYPE_BOOKING,
        entityId: input.booking.id,
        idempotencyKey: createBookingEmailIdempotencyKey({
          eventType: input.eventType,
          bookingId: input.booking.id,
          recipient,
          scope: input.scope ?? null,
        }),
        metadata: input.metadata ?? buildBookingEmailMetadata(input.booking),
      });
    }
  }

  private async notifyBookingRescheduleRecipients(input: {
    readonly eventType: EmailNotificationEvent;
    readonly oldBooking: BookingListItem;
    readonly newBooking: BookingListItem;
    readonly recipients: readonly EmailRecipient[];
  }): Promise<void> {
    for (const recipient of dedupeEmailRecipients(input.recipients)) {
      await this.createEmailNotificationBestEffort({
        eventType: input.eventType,
        recipient,
        templateData: buildBookingRescheduledEmailTemplateData({
          oldBooking: input.oldBooking,
          newBooking: input.newBooking,
          recipient,
        }),
        entityType: EMAIL_NOTIFICATION_ENTITY_TYPE_BOOKING,
        entityId: input.newBooking.id,
        idempotencyKey: createBookingEmailIdempotencyKey({
          eventType: input.eventType,
          bookingId: input.newBooking.id,
          recipient,
          scope: `from:${input.oldBooking.id}`,
        }),
        metadata: {
          ...buildBookingEmailMetadata(input.newBooking),
          previous_booking_id: input.oldBooking.id,
        },
      });
    }
  }

  private async notifyPrivateBookingRecipients(input: {
    readonly eventType: EmailNotificationEvent;
    readonly privateBooking: PrivateBookingListItem;
    readonly recipients: readonly EmailRecipient[];
    readonly scope?: string | null;
    readonly metadata?: DatabaseJsonObject;
  }): Promise<void> {
    for (const recipient of dedupeEmailRecipients(input.recipients)) {
      await this.createEmailNotificationBestEffort({
        eventType: input.eventType,
        recipient,
        templateData: buildPrivateBookingEmailTemplateData({
          privateBooking: input.privateBooking,
          recipient,
        }),
        entityType: EMAIL_NOTIFICATION_ENTITY_TYPE_PRIVATE_BOOKING,
        entityId: input.privateBooking.id,
        idempotencyKey: createPrivateBookingEmailIdempotencyKey({
          eventType: input.eventType,
          privateBookingId: input.privateBooking.id,
          recipient,
          scope: input.scope ?? null,
        }),
        metadata:
          input.metadata ??
          buildPrivateBookingEmailMetadata(input.privateBooking),
      });
    }
  }

  private async notifyPrivateBookingRescheduleRecipients(input: {
    readonly eventType: EmailNotificationEvent;
    readonly oldPrivateBooking: PrivateBookingListItem;
    readonly newPrivateBooking: PrivateBookingListItem;
    readonly recipients: readonly EmailRecipient[];
  }): Promise<void> {
    for (const recipient of dedupeEmailRecipients(input.recipients)) {
      await this.createEmailNotificationBestEffort({
        eventType: input.eventType,
        recipient,
        templateData: buildPrivateBookingRescheduledEmailTemplateData({
          oldPrivateBooking: input.oldPrivateBooking,
          newPrivateBooking: input.newPrivateBooking,
          recipient,
        }),
        entityType: EMAIL_NOTIFICATION_ENTITY_TYPE_PRIVATE_BOOKING,
        entityId: input.newPrivateBooking.id,
        idempotencyKey: createPrivateBookingEmailIdempotencyKey({
          eventType: input.eventType,
          privateBookingId: input.newPrivateBooking.id,
          recipient,
          scope: `from:${input.oldPrivateBooking.id}`,
        }),
        metadata: {
          ...buildPrivateBookingEmailMetadata(input.newPrivateBooking),
          previous_private_booking_id: input.oldPrivateBooking.id,
        },
      });
    }
  }

  private async notifyAdminCreatedBookingOrderPendingPayment(
    bookingOrder: BookingOrderSummary,
  ): Promise<void> {
    const recipient = createCustomerEmailRecipientFromSnapshot(
      bookingOrder.customer,
    );

    if (!recipient) {
      return;
    }

    await this.createEmailNotificationBestEffort({
      eventType: EMAIL_NOTIFICATION_EVENT_BOOKING_CREATED_PENDING_PAYMENT,
      recipient,
      templateData: buildBookingOrderEmailTemplateData({
        bookingOrder,
        recipient,
      }),
      entityType: EMAIL_NOTIFICATION_ENTITY_TYPE_BOOKING_ORDER,
      entityId: bookingOrder.id,
      idempotencyKey: createEntityEmailIdempotencyKey({
        eventType: EMAIL_NOTIFICATION_EVENT_BOOKING_CREATED_PENDING_PAYMENT,
        recipientRole: EMAIL_RECIPIENT_ROLE_CUSTOMER,
        recipientEmail: recipient.email,
        recipientAppUserId: recipient.appUserId ?? null,
        entityType: EMAIL_NOTIFICATION_ENTITY_TYPE_BOOKING_ORDER,
        entityId: bookingOrder.id,
      }),
      metadata: buildBookingOrderEmailMetadata(bookingOrder),
    });
  }

  private async notifyAdminCreatedPrivateBookingPendingPayment(
    privateBooking: PrivateBookingListItem,
  ): Promise<void> {
    const customerRecipient = createCustomerEmailRecipientFromSnapshot(
      privateBooking.customer,
    );

    await this.notifyPrivateBookingRecipients({
      eventType:
        EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_CREATED_PENDING_PAYMENT,
      privateBooking,
      recipients: customerRecipient ? [customerRecipient] : [],
    });
  }

  private async notifyBookingCancelledByAdmin(
    booking: BookingListItem,
  ): Promise<void> {
    const customerRecipient = createCustomerEmailRecipientFromSnapshot(
      booking.customer,
    );
    const trainerRecipient = createTrainerEmailRecipientFromSnapshot(
      booking.trainer,
    );

    await this.notifyBookingRecipients({
      eventType: EMAIL_NOTIFICATION_EVENT_BOOKING_CANCELLED_BY_ADMIN,
      booking,
      recipients: [
        ...(customerRecipient ? [customerRecipient] : []),
        ...(trainerRecipient ? [trainerRecipient] : []),
      ],
    });
  }

  private async notifyBookingRescheduledByAdmin(input: {
    readonly oldBooking: BookingListItem;
    readonly newBooking: BookingListItem;
  }): Promise<void> {
    const customerRecipient = createCustomerEmailRecipientFromSnapshot(
      input.newBooking.customer,
    );
    const trainerRecipients = createTrainerEmailRecipientsFromSnapshots([
      input.oldBooking.trainer,
      input.newBooking.trainer,
    ]);

    await this.notifyBookingRescheduleRecipients({
      eventType: EMAIL_NOTIFICATION_EVENT_BOOKING_RESCHEDULED_BY_ADMIN,
      oldBooking: input.oldBooking,
      newBooking: input.newBooking,
      recipients: [
        ...(customerRecipient ? [customerRecipient] : []),
        ...trainerRecipients,
      ],
    });
  }

  private async notifyWaitlistJoinedByAdminReschedule(
    waitlist: BookingWaitlistListItem,
  ): Promise<void> {
    const recipient = createCustomerEmailRecipientFromSnapshot(
      waitlist.customer,
    );

    if (!recipient) {
      return;
    }

    await this.createEmailNotificationBestEffort({
      eventType: EMAIL_NOTIFICATION_EVENT_WAITLIST_JOINED,
      recipient,
      templateData: buildWaitlistEmailTemplateData({
        waitlist,
        recipient,
      }),
      entityType: EMAIL_NOTIFICATION_ENTITY_TYPE_WAITLIST,
      entityId: waitlist.id,
      idempotencyKey: createEntityEmailIdempotencyKey({
        eventType: EMAIL_NOTIFICATION_EVENT_WAITLIST_JOINED,
        recipientRole: EMAIL_RECIPIENT_ROLE_CUSTOMER,
        recipientEmail: recipient.email,
        recipientAppUserId: recipient.appUserId ?? null,
        entityType: EMAIL_NOTIFICATION_ENTITY_TYPE_WAITLIST,
        entityId: waitlist.id,
      }),
      metadata: buildWaitlistEmailMetadata(waitlist),
    });
  }

  private async notifyWaitlistRemovedByAdmin(
    waitlist: BookingWaitlistListItem,
  ): Promise<void> {
    const recipient = createCustomerEmailRecipientFromSnapshot(
      waitlist.customer,
    );

    if (!recipient) {
      return;
    }

    await this.createEmailNotificationBestEffort({
      eventType: EMAIL_NOTIFICATION_EVENT_WAITLIST_REMOVED_BY_ADMIN,
      recipient,
      templateData: buildWaitlistEmailTemplateData({
        waitlist,
        recipient,
      }),
      entityType: EMAIL_NOTIFICATION_ENTITY_TYPE_WAITLIST,
      entityId: waitlist.id,
      idempotencyKey: createEntityEmailIdempotencyKey({
        eventType: EMAIL_NOTIFICATION_EVENT_WAITLIST_REMOVED_BY_ADMIN,
        recipientRole: EMAIL_RECIPIENT_ROLE_CUSTOMER,
        recipientEmail: recipient.email,
        recipientAppUserId: recipient.appUserId ?? null,
        entityType: EMAIL_NOTIFICATION_ENTITY_TYPE_WAITLIST,
        entityId: waitlist.id,
      }),
      metadata: buildWaitlistEmailMetadata(waitlist),
    });
  }

  private async notifyWaitlistPromotion(input: {
    readonly promotedBooking: BookingListItem;
    readonly promotedWaitlist: BookingWaitlistListItem | null;
  }): Promise<void> {
    const recipient = createCustomerEmailRecipientFromSnapshot(
      input.promotedBooking.customer,
    );

    if (!recipient) {
      return;
    }

    const eventType =
      input.promotedBooking.payment_state?.checkout_required === true
        ? EMAIL_NOTIFICATION_EVENT_WAITLIST_PROMOTION_PAYMENT_REQUIRED
        : EMAIL_NOTIFICATION_EVENT_WAITLIST_PROMOTED_TO_BOOKING;

    await this.createEmailNotificationBestEffort({
      eventType,
      recipient,
      templateData: buildBookingEmailTemplateData({
        booking: input.promotedBooking,
        recipient,
      }),
      entityType: EMAIL_NOTIFICATION_ENTITY_TYPE_BOOKING,
      entityId: input.promotedBooking.id,
      idempotencyKey: createBookingEmailIdempotencyKey({
        eventType,
        bookingId: input.promotedBooking.id,
        recipient,
        scope: input.promotedWaitlist
          ? `waitlist:${input.promotedWaitlist.id}`
          : null,
      }),
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

  private async notifyPrivateBookingCancelledByAdmin(
    privateBooking: PrivateBookingListItem,
  ): Promise<void> {
    const customerRecipient = createCustomerEmailRecipientFromSnapshot(
      privateBooking.customer,
    );
    const trainerRecipient = createTrainerEmailRecipientFromSnapshot(
      privateBooking.trainer,
    );

    await this.notifyPrivateBookingRecipients({
      eventType: EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_CANCELLED_BY_ADMIN,
      privateBooking,
      recipients: [
        ...(customerRecipient ? [customerRecipient] : []),
        ...(trainerRecipient ? [trainerRecipient] : []),
      ],
    });
  }

  private async notifyPrivateBookingRescheduledByAdmin(input: {
    readonly oldPrivateBooking: PrivateBookingListItem;
    readonly newPrivateBooking: PrivateBookingListItem;
  }): Promise<void> {
    const customerRecipient = createCustomerEmailRecipientFromSnapshot(
      input.newPrivateBooking.customer,
    );
    const trainerRecipients = createTrainerEmailRecipientsFromSnapshots([
      input.oldPrivateBooking.trainer,
      input.newPrivateBooking.trainer,
    ]);

    await this.notifyPrivateBookingRescheduleRecipients({
      eventType: EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_RESCHEDULED_BY_ADMIN,
      oldPrivateBooking: input.oldPrivateBooking,
      newPrivateBooking: input.newPrivateBooking,
      recipients: [
        ...(customerRecipient ? [customerRecipient] : []),
        ...trainerRecipients,
      ],
    });
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

  private async getRequiredBookingOrderRow(
    bookingOrderId: string,
  ): Promise<BookingOrderHydratedRow> {
    const lookup = await this.bookingRepository.findBookingOrderById({
      booking_order_id: bookingOrderId,
    });

    if (!lookup.booking_order) {
      throw AppError.bookingOrderNotFound();
    }

    return lookup.booking_order;
  }

  private async getRequiredPrivateBookingListItem(
    privateBookingId: string,
  ): Promise<PrivateBookingListItem> {
    const lookup = await this.bookingRepository.findPrivateBookingById({
      private_booking_id: privateBookingId,
      include_deleted: false,
    });

    if (!lookup.private_booking) {
      throw AppError.privateBookingNotFound();
    }

    return this.toPrivateBookingListItem(lookup.private_booking);
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

  private buildAdminBookingFilters(
    dto: ListAdminBookingsQueryDto,
    scope: ResolvedBookingManagementScope,
  ): BookingAdminListFilters {
    return {
      search: dto.search ?? null,
      status: dto.status ?? null,
      payment_status: dto.payment_status ?? null,
      schedule_id: dto.schedule_id ?? null,
      class_id: dto.class_id ?? null,
      trainer_staff_profile_id:
        BookingAccessPolicy.isTrainerScopedManagementScope(scope)
          ? scope.trainer_staff_profile_id
          : (dto.trainer_staff_profile_id ?? null),
      user_id: dto.user_id ?? null,
      booking_order_id: null,
      from_date: dto.from_date ?? null,
      to_date: dto.to_date ?? null,
      limit: dto.limit,
      offset: dto.offset,
      sort_by: dto.sort_by,
      sort_direction: dto.sort_direction,
    };
  }

  private buildAdminPrivateBookingFilters(
    dto: ListAdminPrivateBookingsQueryDto,
  ): PrivateBookingAdminListFilters {
    return {
      search: dto.search ?? null,
      status: dto.status ?? null,
      payment_status: dto.payment_status ?? null,
      trainer_staff_profile_id: dto.trainer_staff_profile_id ?? null,
      user_id: dto.user_id ?? null,
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
      items: (row.booking_order_items ?? []).map((item) =>
        this.toBookingOrderItemSummary(item),
      ),
    };
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
      checkout_required:
        BookingOrderLifecyclePolicy.resolveCheckoutRequired(lifecycleRecord),
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
      payment_state: paymentState,
      latest_payment: latestPayment,
      customer: this.toSafeUserSnapshot(row.app_users ?? null),
    };
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
      created_at: row.created_at,
      booking: row.bookings ? this.toBookingListItem(row.bookings) : null,
      class: this.toClassSnapshot(row.pilates_classes ?? null),
      schedule: this.toScheduleSnapshot(row.pilates_class_schedules ?? null),
      trainer: this.toBookingOrderItemTrainerSnapshot(
        row.staff_profiles ?? null,
      ),
    };
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

  private toHistoryEntry(row: BookingHistoryEntry): BookingHistoryEntry {
    return {
      id: row.id,
      booking_id: row.booking_id,
      actor_user_id: row.actor_user_id,
      actor_admin_id: row.actor_admin_id,
      actor_role: row.actor_role,
      action: row.action,
      from_status: row.from_status,
      to_status: row.to_status,
      notes: row.notes,
      metadata: row.metadata,
      created_at: row.created_at,
    };
  }

  private toPrivateHistoryEntry(
    row: PrivateBookingHistoryRecord,
  ): PrivateBookingHistoryEntry {
    return {
      id: row.id,
      private_booking_id: row.private_booking_id,
      actor_user_id: row.actor_user_id,
      actor_admin_id: row.actor_admin_id,
      actor_role: row.actor_role,
      action: row.action,
      from_status: row.from_status,
      to_status: row.to_status,
      notes: row.notes,
      metadata: row.metadata,
      created_at: row.created_at,
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
    row: BookingCancelAtomicRpcRow | BookingRescheduleAtomicRpcRow,
    scheduleId: string,
  ): BookingAvailabilitySnapshot {
    return {
      schedule_id: scheduleId,
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

  private async resolveManagementScope(
    actor?: BookingAdminActorContext,
  ): Promise<ResolvedBookingManagementScope> {
    const effectiveActor = actor ?? LEGACY_ADMIN_ACTOR_CONTEXT;

    if (effectiveActor.role === AUTH_TRAINER_ROLE) {
      const trainer =
        await this.staffRepository.getActiveTrainerStaffProfileByAppUserId({
          appUserId: effectiveActor.user_id,
        });

      return BookingAccessPolicy.resolveManagementScope({
        actor_user_id: effectiveActor.user_id,
        actor_role: effectiveActor.role,
        trainer_staff_profile_id: trainer.profile.id,
      });
    }

    return BookingAccessPolicy.resolveManagementScope({
      actor_user_id: effectiveActor.user_id,
      actor_role: effectiveActor.role,
      trainer_staff_profile_id: null,
    });
  }

  private assertBookingWithinManagementScope(
    scope: ResolvedBookingManagementScope,
    booking: BookingHydratedRow,
  ): void {
    BookingAccessPolicy.assertBookingTargetWithinManagementScope({
      scope,
      target: {
        booking_id: booking.id,
        schedule_id: booking.schedule_id,
        trainer_staff_profile_id: booking.trainer_staff_profile_id,
      },
    });
  }

  private assertBookingOrderWithinManagementScope(
    scope: ResolvedBookingManagementScope,
    bookingOrder: BookingOrderHydratedRow,
  ): void {
    if (BookingAccessPolicy.isFullManagementScope(scope)) {
      return;
    }

    const orderItems = bookingOrder.booking_order_items ?? [];

    BookingAccessPolicy.assertScheduleScopesWithinManagementScope({
      scope,
      requested_schedule_ids: orderItems.map((item) => item.schedule_id),
      schedule_scopes: orderItems.map((item) => ({
        schedule_id: item.schedule_id,
        trainer_staff_profile_id: item.trainer_staff_profile_id,
      })),
    });
  }

  private async assertScheduleWithinManagementScope(
    scope: ResolvedBookingManagementScope,
    scheduleId: string,
  ): Promise<void> {
    if (BookingAccessPolicy.isFullManagementScope(scope)) {
      return;
    }

    const scheduleScopes = await this.bookingRepository.findScheduleScopesByIds(
      {
        schedule_ids: [scheduleId],
      },
    );

    if (scheduleScopes.length === 0) {
      throw AppError.bookingScheduleNotFound(
        'The requested Pilates schedule was not found.',
        {
          schedule_id: scheduleId,
        },
      );
    }

    BookingAccessPolicy.assertCalendarScheduleWithinManagementScope(
      scope,
      scheduleScopes[0],
    );
  }

  private assertWaitlistWithinManagementScope(
    scope: ResolvedBookingManagementScope,
    waitlist: BookingWaitlistHydratedRow,
  ): void {
    BookingAccessPolicy.assertWaitlistTargetWithinManagementScope({
      scope,
      target: {
        waitlist_id: waitlist.id,
        schedule_id: waitlist.schedule_id,
        trainer_staff_profile_id:
          waitlist.pilates_class_schedules?.trainer_staff_profile_id ?? null,
      },
    });
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

  private requireCustomerUserId(value: string | undefined): string {
    PrivateBookingLifecyclePolicy.assertCustomerUserIdAvailable(value);

    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }

    throw AppError.invalidRequest(
      'customer_user_id is required for admin-created booking.',
    );
  }
}
