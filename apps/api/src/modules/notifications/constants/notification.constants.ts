// apps/api/src/modules/notifications/constants/notification.constants.ts
/**
 * LAFAM notification constants.
 *
 * Role:
 * - Defines approved email notification event keys.
 * - Defines notification statuses, delivery-attempt statuses, recipient roles, and provider names.
 * - Keeps feature modules from using loose email-event strings.
 *
 * Important:
 * - These constants must stay aligned with the email_notification_event enum in Supabase.
 * - Do not add an event here unless the database enum and notification renderer support it.
 * - Do not put email body copy in this file.
 * - Do not put secrets, tokens, OTPs, Civil ID values, or provider payloads in notification metadata.
 */

import type {
  DatabaseEmailDeliveryAttemptStatus,
  DatabaseEmailNotificationEvent,
  DatabaseEmailNotificationStatus,
  DatabaseEmailRecipientRole,
} from '../../../database/database.types';

export const EMAIL_PROVIDER_BREVO = 'brevo';

export const EMAIL_NOTIFICATION_STATUS_PENDING =
  'pending' satisfies DatabaseEmailNotificationStatus;
export const EMAIL_NOTIFICATION_STATUS_SENDING =
  'sending' satisfies DatabaseEmailNotificationStatus;
export const EMAIL_NOTIFICATION_STATUS_SENT =
  'sent' satisfies DatabaseEmailNotificationStatus;
export const EMAIL_NOTIFICATION_STATUS_FAILED =
  'failed' satisfies DatabaseEmailNotificationStatus;
export const EMAIL_NOTIFICATION_STATUS_SKIPPED =
  'skipped' satisfies DatabaseEmailNotificationStatus;
export const EMAIL_NOTIFICATION_STATUS_CANCELLED =
  'cancelled' satisfies DatabaseEmailNotificationStatus;

export const EMAIL_NOTIFICATION_STATUSES = [
  EMAIL_NOTIFICATION_STATUS_PENDING,
  EMAIL_NOTIFICATION_STATUS_SENDING,
  EMAIL_NOTIFICATION_STATUS_SENT,
  EMAIL_NOTIFICATION_STATUS_FAILED,
  EMAIL_NOTIFICATION_STATUS_SKIPPED,
  EMAIL_NOTIFICATION_STATUS_CANCELLED,
] as const satisfies readonly DatabaseEmailNotificationStatus[];

export const EMAIL_DELIVERY_ATTEMPT_STATUS_SUCCEEDED =
  'succeeded' satisfies DatabaseEmailDeliveryAttemptStatus;
export const EMAIL_DELIVERY_ATTEMPT_STATUS_FAILED =
  'failed' satisfies DatabaseEmailDeliveryAttemptStatus;
export const EMAIL_DELIVERY_ATTEMPT_STATUS_SKIPPED =
  'skipped' satisfies DatabaseEmailDeliveryAttemptStatus;

export const EMAIL_DELIVERY_ATTEMPT_STATUSES = [
  EMAIL_DELIVERY_ATTEMPT_STATUS_SUCCEEDED,
  EMAIL_DELIVERY_ATTEMPT_STATUS_FAILED,
  EMAIL_DELIVERY_ATTEMPT_STATUS_SKIPPED,
] as const satisfies readonly DatabaseEmailDeliveryAttemptStatus[];

export const EMAIL_RECIPIENT_ROLE_CUSTOMER =
  'customer' satisfies DatabaseEmailRecipientRole;
export const EMAIL_RECIPIENT_ROLE_ADMIN =
  'admin' satisfies DatabaseEmailRecipientRole;
export const EMAIL_RECIPIENT_ROLE_TRAINER =
  'trainer' satisfies DatabaseEmailRecipientRole;
export const EMAIL_RECIPIENT_ROLE_STAFF =
  'staff' satisfies DatabaseEmailRecipientRole;
export const EMAIL_RECIPIENT_ROLE_SYSTEM =
  'system' satisfies DatabaseEmailRecipientRole;

export const EMAIL_RECIPIENT_ROLES = [
  EMAIL_RECIPIENT_ROLE_CUSTOMER,
  EMAIL_RECIPIENT_ROLE_ADMIN,
  EMAIL_RECIPIENT_ROLE_TRAINER,
  EMAIL_RECIPIENT_ROLE_STAFF,
  EMAIL_RECIPIENT_ROLE_SYSTEM,
] as const satisfies readonly DatabaseEmailRecipientRole[];

export const EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_CREATED =
  'customer_invite_created' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_RESENT =
  'customer_invite_resent' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_EXPIRING_SOON =
  'customer_invite_expiring_soon' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_EXPIRED =
  'customer_invite_expired' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_ACCEPTED =
  'customer_invite_accepted' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_ADMIN_CREATED_CUSTOMER_WITH_PASSWORD_WELCOME =
  'admin_created_customer_with_password_welcome' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_PASSWORD_CHANGED =
  'password_changed' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_ACCOUNT_DEACTIVATED_BY_ADMIN =
  'account_deactivated_by_admin' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_ACCOUNT_REACTIVATED_BY_ADMIN =
  'account_reactivated_by_admin' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_ACCOUNT_DELETED_OR_CLOSED =
  'account_deleted_or_closed' satisfies DatabaseEmailNotificationEvent;

export const EMAIL_NOTIFICATION_EVENT_BOOKING_CREATED_PENDING_PAYMENT =
  'booking_created_pending_payment' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_BOOKING_CONFIRMED_AFTER_PAYMENT =
  'booking_confirmed_after_payment' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_BOOKING_CANCELLED_BY_CUSTOMER =
  'booking_cancelled_by_customer' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_BOOKING_CANCELLED_BY_ADMIN =
  'booking_cancelled_by_admin' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_BOOKING_RESCHEDULED_BY_CUSTOMER =
  'booking_rescheduled_by_customer' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_BOOKING_RESCHEDULED_BY_ADMIN =
  'booking_rescheduled_by_admin' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_BOOKING_COMPLETED =
  'booking_completed' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_BOOKING_MARKED_NO_SHOW =
  'booking_marked_no_show' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_BOOKING_EXPIRED_DUE_TO_UNPAID_PAYMENT =
  'booking_expired_due_to_unpaid_payment' satisfies DatabaseEmailNotificationEvent;

export const EMAIL_NOTIFICATION_EVENT_WAITLIST_JOINED =
  'waitlist_joined' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_WAITLIST_CANCELLED_BY_CUSTOMER =
  'waitlist_cancelled_by_customer' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_WAITLIST_REMOVED_BY_ADMIN =
  'waitlist_removed_by_admin' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_WAITLIST_PROMOTED_TO_BOOKING =
  'waitlist_promoted_to_booking' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_WAITLIST_PROMOTION_PAYMENT_REQUIRED =
  'waitlist_promotion_payment_required' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_WAITLIST_PROMOTION_EXPIRING_SOON =
  'waitlist_promotion_expiring_soon' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_WAITLIST_PROMOTION_EXPIRED =
  'waitlist_promotion_expired' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_CLASS_SPACE_AVAILABLE =
  'class_space_available' satisfies DatabaseEmailNotificationEvent;

export const EMAIL_NOTIFICATION_EVENT_PAYMENT_CHECKOUT_CREATED_OPTIONAL =
  'payment_checkout_created_optional' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_PAYMENT_SUCCESS_RECEIPT =
  'payment_success_receipt' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_PAYMENT_FAILED =
  'payment_failed' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_PAYMENT_CANCELLED =
  'payment_cancelled' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_PAYMENT_EXPIRED =
  'payment_expired' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_PAYMENT_REFUNDED =
  'payment_refunded' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_PAYMENT_REFUND_FAILED_OR_MANUAL_REVIEW_REQUIRED =
  'payment_refund_failed_or_manual_review_required' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_PAYMENT_DUPLICATE_CALLBACK_IGNORED_ADMIN_ONLY_IF_SUSPICIOUS =
  'payment_duplicate_callback_ignored_admin_only_if_suspicious' satisfies DatabaseEmailNotificationEvent;

export const EMAIL_NOTIFICATION_EVENT_WALLET_TOP_UP_SUCCESS =
  'wallet_top_up_success' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_WALLET_TOP_UP_FAILED =
  'wallet_top_up_failed' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_WALLET_TOP_UP_EXPIRED =
  'wallet_top_up_expired' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_WALLET_BOOKING_DEBIT_SUCCESS =
  'wallet_booking_debit_success' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_WALLET_REFUND_CREDIT_SUCCESS =
  'wallet_refund_credit_success' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_WALLET_ADMIN_ADJUSTMENT_CREDIT =
  'wallet_admin_adjustment_credit' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_WALLET_ADMIN_ADJUSTMENT_DEBIT =
  'wallet_admin_adjustment_debit' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_WALLET_LOW_BALANCE_OPTIONAL =
  'wallet_low_balance_optional' satisfies DatabaseEmailNotificationEvent;

export const EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_CREATED_PENDING_PAYMENT =
  'private_booking_created_pending_payment' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_CONFIRMED_AFTER_PAYMENT =
  'private_booking_confirmed_after_payment' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_CANCELLED_BY_CUSTOMER =
  'private_booking_cancelled_by_customer' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_CANCELLED_BY_ADMIN =
  'private_booking_cancelled_by_admin' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_RESCHEDULED_BY_CUSTOMER =
  'private_booking_rescheduled_by_customer' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_RESCHEDULED_BY_ADMIN =
  'private_booking_rescheduled_by_admin' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_REMINDER_24_HOURS_BEFORE =
  'private_booking_reminder_24_hours_before' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_REMINDER_2_HOURS_BEFORE =
  'private_booking_reminder_2_hours_before' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_REFUNDED =
  'private_booking_refunded' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_EXPIRED_DUE_TO_UNPAID_PAYMENT =
  'private_booking_expired_due_to_unpaid_payment' satisfies DatabaseEmailNotificationEvent;

export const EMAIL_NOTIFICATION_EVENT_TRAINER_ACCOUNT_CREATED_WITH_PASSWORD =
  'trainer_account_created_with_password' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_TRAINER_AVAILABILITY_UPDATED =
  'trainer_availability_updated' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_TRAINER_ASSIGNED_TO_CLASS =
  'trainer_assigned_to_class' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_TRAINER_REMOVED_FROM_CLASS =
  'trainer_removed_from_class' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_TRAINER_SCHEDULE_CHANGED =
  'trainer_schedule_changed' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_TRAINER_BOOKING_CANCELLED =
  'trainer_booking_cancelled' satisfies DatabaseEmailNotificationEvent;
export const EMAIL_NOTIFICATION_EVENT_TRAINER_DAILY_SCHEDULE_SUMMARY =
  'trainer_daily_schedule_summary' satisfies DatabaseEmailNotificationEvent;

export const CUSTOMER_ACCOUNT_EMAIL_NOTIFICATION_EVENTS = [
  EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_CREATED,
  EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_RESENT,
  EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_EXPIRING_SOON,
  EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_EXPIRED,
  EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_ACCEPTED,
  EMAIL_NOTIFICATION_EVENT_ADMIN_CREATED_CUSTOMER_WITH_PASSWORD_WELCOME,
  EMAIL_NOTIFICATION_EVENT_PASSWORD_CHANGED,
  EMAIL_NOTIFICATION_EVENT_ACCOUNT_DEACTIVATED_BY_ADMIN,
  EMAIL_NOTIFICATION_EVENT_ACCOUNT_REACTIVATED_BY_ADMIN,
  EMAIL_NOTIFICATION_EVENT_ACCOUNT_DELETED_OR_CLOSED,
] as const satisfies readonly DatabaseEmailNotificationEvent[];

export const BOOKING_EMAIL_NOTIFICATION_EVENTS = [
  EMAIL_NOTIFICATION_EVENT_BOOKING_CREATED_PENDING_PAYMENT,
  EMAIL_NOTIFICATION_EVENT_BOOKING_CONFIRMED_AFTER_PAYMENT,
  EMAIL_NOTIFICATION_EVENT_BOOKING_CANCELLED_BY_CUSTOMER,
  EMAIL_NOTIFICATION_EVENT_BOOKING_CANCELLED_BY_ADMIN,
  EMAIL_NOTIFICATION_EVENT_BOOKING_RESCHEDULED_BY_CUSTOMER,
  EMAIL_NOTIFICATION_EVENT_BOOKING_RESCHEDULED_BY_ADMIN,
  EMAIL_NOTIFICATION_EVENT_BOOKING_COMPLETED,
  EMAIL_NOTIFICATION_EVENT_BOOKING_MARKED_NO_SHOW,
  EMAIL_NOTIFICATION_EVENT_BOOKING_EXPIRED_DUE_TO_UNPAID_PAYMENT,
] as const satisfies readonly DatabaseEmailNotificationEvent[];

export const WAITLIST_EMAIL_NOTIFICATION_EVENTS = [
  EMAIL_NOTIFICATION_EVENT_WAITLIST_JOINED,
  EMAIL_NOTIFICATION_EVENT_WAITLIST_CANCELLED_BY_CUSTOMER,
  EMAIL_NOTIFICATION_EVENT_WAITLIST_REMOVED_BY_ADMIN,
  EMAIL_NOTIFICATION_EVENT_WAITLIST_PROMOTED_TO_BOOKING,
  EMAIL_NOTIFICATION_EVENT_WAITLIST_PROMOTION_PAYMENT_REQUIRED,
  EMAIL_NOTIFICATION_EVENT_WAITLIST_PROMOTION_EXPIRING_SOON,
  EMAIL_NOTIFICATION_EVENT_WAITLIST_PROMOTION_EXPIRED,
  EMAIL_NOTIFICATION_EVENT_CLASS_SPACE_AVAILABLE,
] as const satisfies readonly DatabaseEmailNotificationEvent[];

export const PAYMENT_EMAIL_NOTIFICATION_EVENTS = [
  EMAIL_NOTIFICATION_EVENT_PAYMENT_CHECKOUT_CREATED_OPTIONAL,
  EMAIL_NOTIFICATION_EVENT_PAYMENT_SUCCESS_RECEIPT,
  EMAIL_NOTIFICATION_EVENT_PAYMENT_FAILED,
  EMAIL_NOTIFICATION_EVENT_PAYMENT_CANCELLED,
  EMAIL_NOTIFICATION_EVENT_PAYMENT_EXPIRED,
  EMAIL_NOTIFICATION_EVENT_PAYMENT_REFUNDED,
  EMAIL_NOTIFICATION_EVENT_PAYMENT_REFUND_FAILED_OR_MANUAL_REVIEW_REQUIRED,
  EMAIL_NOTIFICATION_EVENT_PAYMENT_DUPLICATE_CALLBACK_IGNORED_ADMIN_ONLY_IF_SUSPICIOUS,
] as const satisfies readonly DatabaseEmailNotificationEvent[];

export const WALLET_EMAIL_NOTIFICATION_EVENTS = [
  EMAIL_NOTIFICATION_EVENT_WALLET_TOP_UP_SUCCESS,
  EMAIL_NOTIFICATION_EVENT_WALLET_TOP_UP_FAILED,
  EMAIL_NOTIFICATION_EVENT_WALLET_TOP_UP_EXPIRED,
  EMAIL_NOTIFICATION_EVENT_WALLET_BOOKING_DEBIT_SUCCESS,
  EMAIL_NOTIFICATION_EVENT_WALLET_REFUND_CREDIT_SUCCESS,
  EMAIL_NOTIFICATION_EVENT_WALLET_ADMIN_ADJUSTMENT_CREDIT,
  EMAIL_NOTIFICATION_EVENT_WALLET_ADMIN_ADJUSTMENT_DEBIT,
  EMAIL_NOTIFICATION_EVENT_WALLET_LOW_BALANCE_OPTIONAL,
] as const satisfies readonly DatabaseEmailNotificationEvent[];

export const PRIVATE_BOOKING_EMAIL_NOTIFICATION_EVENTS = [
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_CREATED_PENDING_PAYMENT,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_CONFIRMED_AFTER_PAYMENT,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_CANCELLED_BY_CUSTOMER,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_CANCELLED_BY_ADMIN,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_RESCHEDULED_BY_CUSTOMER,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_RESCHEDULED_BY_ADMIN,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_REMINDER_24_HOURS_BEFORE,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_REMINDER_2_HOURS_BEFORE,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_REFUNDED,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_EXPIRED_DUE_TO_UNPAID_PAYMENT,
] as const satisfies readonly DatabaseEmailNotificationEvent[];

export const TRAINER_EMAIL_NOTIFICATION_EVENTS = [
  EMAIL_NOTIFICATION_EVENT_TRAINER_ACCOUNT_CREATED_WITH_PASSWORD,
  EMAIL_NOTIFICATION_EVENT_TRAINER_AVAILABILITY_UPDATED,
  EMAIL_NOTIFICATION_EVENT_TRAINER_ASSIGNED_TO_CLASS,
  EMAIL_NOTIFICATION_EVENT_TRAINER_REMOVED_FROM_CLASS,
  EMAIL_NOTIFICATION_EVENT_TRAINER_SCHEDULE_CHANGED,
  EMAIL_NOTIFICATION_EVENT_TRAINER_BOOKING_CANCELLED,
  EMAIL_NOTIFICATION_EVENT_TRAINER_DAILY_SCHEDULE_SUMMARY,
] as const satisfies readonly DatabaseEmailNotificationEvent[];

export const EMAIL_NOTIFICATION_EVENTS = [
  ...CUSTOMER_ACCOUNT_EMAIL_NOTIFICATION_EVENTS,
  ...BOOKING_EMAIL_NOTIFICATION_EVENTS,
  ...WAITLIST_EMAIL_NOTIFICATION_EVENTS,
  ...PAYMENT_EMAIL_NOTIFICATION_EVENTS,
  ...WALLET_EMAIL_NOTIFICATION_EVENTS,
  ...PRIVATE_BOOKING_EMAIL_NOTIFICATION_EVENTS,
  ...TRAINER_EMAIL_NOTIFICATION_EVENTS,
] as const satisfies readonly DatabaseEmailNotificationEvent[];

export const ADMIN_ONLY_EMAIL_NOTIFICATION_EVENTS = [
  EMAIL_NOTIFICATION_EVENT_PAYMENT_DUPLICATE_CALLBACK_IGNORED_ADMIN_ONLY_IF_SUSPICIOUS,
  EMAIL_NOTIFICATION_EVENT_PAYMENT_REFUND_FAILED_OR_MANUAL_REVIEW_REQUIRED,
] as const satisfies readonly DatabaseEmailNotificationEvent[];

export const OPTIONAL_EMAIL_NOTIFICATION_EVENTS = [
  EMAIL_NOTIFICATION_EVENT_PAYMENT_CHECKOUT_CREATED_OPTIONAL,
  EMAIL_NOTIFICATION_EVENT_WALLET_LOW_BALANCE_OPTIONAL,
] as const satisfies readonly DatabaseEmailNotificationEvent[];

export const SCHEDULED_EMAIL_NOTIFICATION_EVENTS = [
  EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_EXPIRING_SOON,
  EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_EXPIRED,
  EMAIL_NOTIFICATION_EVENT_WAITLIST_PROMOTION_EXPIRING_SOON,
  EMAIL_NOTIFICATION_EVENT_WAITLIST_PROMOTION_EXPIRED,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_REMINDER_24_HOURS_BEFORE,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_REMINDER_2_HOURS_BEFORE,
  EMAIL_NOTIFICATION_EVENT_TRAINER_DAILY_SCHEDULE_SUMMARY,
  EMAIL_NOTIFICATION_EVENT_WALLET_LOW_BALANCE_OPTIONAL,
] as const satisfies readonly DatabaseEmailNotificationEvent[];

export const EMAIL_NOTIFICATION_DEFAULT_MAX_ATTEMPTS = 3;
export const EMAIL_NOTIFICATION_MIN_MAX_ATTEMPTS = 1;
export const EMAIL_NOTIFICATION_MAX_MAX_ATTEMPTS = 20;

export const EMAIL_NOTIFICATION_SUBJECT_MAX_LENGTH = 255;
export const EMAIL_NOTIFICATION_HTML_CONTENT_MAX_LENGTH = 200_000;
export const EMAIL_NOTIFICATION_TEXT_CONTENT_MAX_LENGTH = 50_000;
export const EMAIL_NOTIFICATION_FAILURE_MESSAGE_MAX_LENGTH = 1_000;

export const EMAIL_NOTIFICATION_IDEMPOTENCY_KEY_MAX_LENGTH = 200;
export const EMAIL_NOTIFICATION_ENTITY_TYPE_MAX_LENGTH = 100;

export const EMAIL_NOTIFICATION_LOCK_OWNER = 'lafam-api';

export const EMAIL_NOTIFICATION_ENTITY_TYPE_APP_USER = 'app_user';
export const EMAIL_NOTIFICATION_ENTITY_TYPE_CUSTOMER_INVITATION =
  'customer_invitation';
export const EMAIL_NOTIFICATION_ENTITY_TYPE_BOOKING = 'booking';
export const EMAIL_NOTIFICATION_ENTITY_TYPE_BOOKING_ORDER = 'booking_order';
export const EMAIL_NOTIFICATION_ENTITY_TYPE_WAITLIST = 'booking_waitlist';
export const EMAIL_NOTIFICATION_ENTITY_TYPE_PRIVATE_BOOKING =
  'private_trainer_booking';
export const EMAIL_NOTIFICATION_ENTITY_TYPE_PAYMENT = 'payment';
export const EMAIL_NOTIFICATION_ENTITY_TYPE_WALLET_LEDGER_ENTRY =
  'wallet_ledger_entry';
export const EMAIL_NOTIFICATION_ENTITY_TYPE_STAFF_PROFILE = 'staff_profile';
export const EMAIL_NOTIFICATION_ENTITY_TYPE_PILATES_CLASS_SCHEDULE =
  'pilates_class_schedule';

export const EMAIL_NOTIFICATION_SAFE_METADATA_FORBIDDEN_KEYS = [
  'civil_id',
  'civilId',
  'civilID',
  'password',
  'confirm_password',
  'confirmPassword',
  'token',
  'raw_token',
  'rawToken',
  'invite_token',
  'inviteToken',
  'otp',
  'cookie',
  'authorization',
  'api_key',
  'apiKey',
  'secret',
  'provider_payload',
  'providerPayload',
] as const;
