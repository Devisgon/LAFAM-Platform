// apps/api/src/modules/notifications/application/email-template-renderer.service.ts
/**
 * LAFAM email template renderer service.
 *
 * Role:
 * - Converts approved notification events into branded email subject/html/text.
 * - Uses LAFAM theme-aligned inline styles for email-client compatibility.
 * - Keeps feature modules away from email copy/layout decisions.
 *
 * Important:
 * - This service does not send emails.
 * - This service does not write database records.
 * - This service only renders from safe, caller-provided template data.
 * - Do not render Civil ID, passwords, OTPs, cookies, provider secrets, or raw provider payloads.
 * - Invite links must be passed as a complete actionUrl only when creating the invite email.
 */

import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import type { DatabaseJsonObject } from '../../../database/database.types';
import {
  EMAIL_NOTIFICATION_EVENT_ACCOUNT_DEACTIVATED_BY_ADMIN,
  EMAIL_NOTIFICATION_EVENT_ACCOUNT_DELETED_OR_CLOSED,
  EMAIL_NOTIFICATION_EVENT_ACCOUNT_REACTIVATED_BY_ADMIN,
  EMAIL_NOTIFICATION_EVENT_ADMIN_CREATED_CUSTOMER_WITH_PASSWORD_WELCOME,
  EMAIL_NOTIFICATION_EVENT_BOOKING_CANCELLED_BY_ADMIN,
  EMAIL_NOTIFICATION_EVENT_BOOKING_CANCELLED_BY_CUSTOMER,
  EMAIL_NOTIFICATION_EVENT_BOOKING_COMPLETED,
  EMAIL_NOTIFICATION_EVENT_BOOKING_CONFIRMED_AFTER_PAYMENT,
  EMAIL_NOTIFICATION_EVENT_BOOKING_CREATED_PENDING_PAYMENT,
  EMAIL_NOTIFICATION_EVENT_BOOKING_EXPIRED_DUE_TO_UNPAID_PAYMENT,
  EMAIL_NOTIFICATION_EVENT_BOOKING_MARKED_NO_SHOW,
  EMAIL_NOTIFICATION_EVENT_BOOKING_RESCHEDULED_BY_ADMIN,
  EMAIL_NOTIFICATION_EVENT_BOOKING_RESCHEDULED_BY_CUSTOMER,
  EMAIL_NOTIFICATION_EVENT_CLASS_SPACE_AVAILABLE,
  EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_ACCEPTED,
  EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_CREATED,
  EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_EXPIRED,
  EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_EXPIRING_SOON,
  EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_RESENT,
  EMAIL_NOTIFICATION_EVENT_PAYMENT_CANCELLED,
  EMAIL_NOTIFICATION_EVENT_PAYMENT_CHECKOUT_CREATED_OPTIONAL,
  EMAIL_NOTIFICATION_EVENT_PAYMENT_DUPLICATE_CALLBACK_IGNORED_ADMIN_ONLY_IF_SUSPICIOUS,
  EMAIL_NOTIFICATION_EVENT_PAYMENT_EXPIRED,
  EMAIL_NOTIFICATION_EVENT_PAYMENT_FAILED,
  EMAIL_NOTIFICATION_EVENT_PAYMENT_REFUND_FAILED_OR_MANUAL_REVIEW_REQUIRED,
  EMAIL_NOTIFICATION_EVENT_PAYMENT_REFUNDED,
  EMAIL_NOTIFICATION_EVENT_PAYMENT_SUCCESS_RECEIPT,
  EMAIL_NOTIFICATION_EVENT_PASSWORD_CHANGED,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_CANCELLED_BY_ADMIN,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_CANCELLED_BY_CUSTOMER,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_CONFIRMED_AFTER_PAYMENT,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_CREATED_PENDING_PAYMENT,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_EXPIRED_DUE_TO_UNPAID_PAYMENT,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_REFUNDED,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_REMINDER_2_HOURS_BEFORE,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_REMINDER_24_HOURS_BEFORE,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_RESCHEDULED_BY_ADMIN,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_RESCHEDULED_BY_CUSTOMER,
  EMAIL_NOTIFICATION_EVENT_TRAINER_ACCOUNT_CREATED_WITH_PASSWORD,
  EMAIL_NOTIFICATION_EVENT_TRAINER_ASSIGNED_TO_CLASS,
  EMAIL_NOTIFICATION_EVENT_TRAINER_AVAILABILITY_UPDATED,
  EMAIL_NOTIFICATION_EVENT_TRAINER_BOOKING_CANCELLED,
  EMAIL_NOTIFICATION_EVENT_TRAINER_DAILY_SCHEDULE_SUMMARY,
  EMAIL_NOTIFICATION_EVENT_TRAINER_REMOVED_FROM_CLASS,
  EMAIL_NOTIFICATION_EVENT_TRAINER_SCHEDULE_CHANGED,
  EMAIL_NOTIFICATION_EVENT_WAITLIST_CANCELLED_BY_CUSTOMER,
  EMAIL_NOTIFICATION_EVENT_WAITLIST_JOINED,
  EMAIL_NOTIFICATION_EVENT_WAITLIST_PROMOTED_TO_BOOKING,
  EMAIL_NOTIFICATION_EVENT_WAITLIST_PROMOTION_EXPIRED,
  EMAIL_NOTIFICATION_EVENT_WAITLIST_PROMOTION_EXPIRING_SOON,
  EMAIL_NOTIFICATION_EVENT_WAITLIST_PROMOTION_PAYMENT_REQUIRED,
  EMAIL_NOTIFICATION_EVENT_WAITLIST_REMOVED_BY_ADMIN,
  EMAIL_NOTIFICATION_EVENT_WALLET_ADMIN_ADJUSTMENT_CREDIT,
  EMAIL_NOTIFICATION_EVENT_WALLET_ADMIN_ADJUSTMENT_DEBIT,
  EMAIL_NOTIFICATION_EVENT_WALLET_BOOKING_DEBIT_SUCCESS,
  EMAIL_NOTIFICATION_EVENT_WALLET_LOW_BALANCE_OPTIONAL,
  EMAIL_NOTIFICATION_EVENT_WALLET_REFUND_CREDIT_SUCCESS,
  EMAIL_NOTIFICATION_EVENT_WALLET_TOP_UP_EXPIRED,
  EMAIL_NOTIFICATION_EVENT_WALLET_TOP_UP_FAILED,
  EMAIL_NOTIFICATION_EVENT_WALLET_TOP_UP_SUCCESS,
} from '../constants/notification.constants';
import type {
  EmailNotificationEvent,
  EmailNotificationTemplateInput,
  RenderedEmailTemplate,
} from '../types/notification.types';

type TemplateTextFactory = (context: TemplateRenderContext) => string;
type TemplateLinesFactory = (
  context: TemplateRenderContext,
) => readonly string[];

interface TemplateRenderContext {
  readonly eventType: EmailNotificationEvent;
  readonly templateData: DatabaseJsonObject;
  readonly locale: string;
  readonly recipientName: string;
}

interface EmailTemplateDefinition {
  readonly subject: string | TemplateTextFactory;
  readonly eyebrow: string;
  readonly title: string | TemplateTextFactory;
  readonly intro: string | TemplateTextFactory;
  readonly bodyLines: readonly string[] | TemplateLinesFactory;
  readonly ctaLabel?: string | TemplateTextFactory;
  readonly footerNote?: string | TemplateTextFactory;
}

interface DetailRow {
  readonly label: string;
  readonly value: string;
}

const BRAND_NAME = 'LAFAM';

const THEME = {
  white: '#ffffff',
  slate50: '#f8fafc',
  slate100: '#f1f5f9',
  slate600: '#64748b',
  slate900: '#0f172a',
  brand100: '#f7e5e5',
  brand200: '#f4dddd',
  brand300: '#edcdce',
  brand400: '#d8abab',
  red500: '#ef4444',
  amber500: '#f59e0b',
  green500: '#10b981',
  sky400: '#38bdf8',
} as const;

const SAFE_DETAIL_FIELDS = [
  ['Booking number', 'bookingNumber'],
  ['Order number', 'orderNumber'],
  ['Class', 'classTitle'],
  ['Session', 'sessionTitle'],
  ['Trainer', 'trainerName'],
  ['Date', 'sessionDate'],
  ['Start time', 'startTime'],
  ['End time', 'endTime'],
  ['Old date', 'oldSessionDate'],
  ['Old start time', 'oldStartTime'],
  ['New date', 'newSessionDate'],
  ['New start time', 'newStartTime'],
  ['Payment number', 'paymentNumber'],
  ['Receipt number', 'receiptNumber'],
  ['Amount', 'amountLabel'],
  ['Wallet balance', 'walletBalanceLabel'],
  ['Waitlist position', 'waitlistPosition'],
  ['Expires at', 'expiresAt'],
  ['Invite expires at', 'inviteExpiresAt'],
] as const;

function getTemplateString(
  data: DatabaseJsonObject,
  key: string,
): string | null {
  const value = data[key];

  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function getTemplateNumber(
  data: DatabaseJsonObject,
  key: string,
): number | null {
  const value = data[key];

  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function resolveRecipientName(input: EmailNotificationTemplateInput): string {
  return (
    getTemplateString(input.templateData, 'recipientName') ??
    getTemplateString(input.templateData, 'customerName') ??
    getTemplateString(input.templateData, 'trainerName') ??
    input.recipient.name ??
    'there'
  );
}

function resolveActionUrl(data: DatabaseJsonObject): string | null {
  return (
    getTemplateString(data, 'actionUrl') ??
    getTemplateString(data, 'paymentUrl') ??
    getTemplateString(data, 'inviteUrl') ??
    null
  );
}

function resolveAmountLabel(data: DatabaseJsonObject): string | null {
  const explicitAmountLabel = getTemplateString(data, 'amountLabel');

  if (explicitAmountLabel) {
    return explicitAmountLabel;
  }

  const amount = getTemplateNumber(data, 'amount');
  const currency = getTemplateString(data, 'currency');

  if (amount === null || !currency) {
    return null;
  }

  return `${amount.toFixed(3)} ${currency.toUpperCase()}`;
}

function resolveWalletBalanceLabel(data: DatabaseJsonObject): string | null {
  const explicitBalanceLabel = getTemplateString(data, 'walletBalanceLabel');

  if (explicitBalanceLabel) {
    return explicitBalanceLabel;
  }

  const walletBalance = getTemplateNumber(data, 'walletBalance');
  const currency = getTemplateString(data, 'currency');

  if (walletBalance === null || !currency) {
    return null;
  }

  return `${walletBalance.toFixed(3)} ${currency.toUpperCase()}`;
}

function getDisplayValue(data: DatabaseJsonObject, key: string): string | null {
  if (key === 'amountLabel') {
    return resolveAmountLabel(data);
  }

  if (key === 'walletBalanceLabel') {
    return resolveWalletBalanceLabel(data);
  }

  const stringValue = getTemplateString(data, key);

  if (stringValue) {
    return stringValue;
  }

  const numberValue = getTemplateNumber(data, key);

  if (numberValue !== null) {
    return String(numberValue);
  }

  return null;
}

function buildDetailRows(data: DatabaseJsonObject): readonly DetailRow[] {
  return SAFE_DETAIL_FIELDS.flatMap(([label, key]) => {
    const value = getDisplayValue(data, key);

    return value ? [{ label, value }] : [];
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#039;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

function resolveText(
  value: string | TemplateTextFactory,
  context: TemplateRenderContext,
): string {
  return typeof value === 'function' ? value(context) : value;
}

function resolveLines(
  value: readonly string[] | TemplateLinesFactory,
  context: TemplateRenderContext,
): readonly string[] {
  return typeof value === 'function' ? value(context) : value;
}

function createBookingLine(context: TemplateRenderContext): string {
  const classTitle =
    getTemplateString(context.templateData, 'classTitle') ?? 'your class';
  const sessionDate =
    getTemplateString(context.templateData, 'sessionDate') ??
    'the scheduled date';
  const startTime =
    getTemplateString(context.templateData, 'startTime') ??
    'the scheduled time';

  return `Booking details: ${classTitle} on ${sessionDate} at ${startTime}.`;
}

function createPrivateBookingLine(context: TemplateRenderContext): string {
  const trainerName =
    getTemplateString(context.templateData, 'trainerName') ?? 'your trainer';
  const sessionDate =
    getTemplateString(context.templateData, 'sessionDate') ??
    'the scheduled date';
  const startTime =
    getTemplateString(context.templateData, 'startTime') ??
    'the scheduled time';

  return `Private session details: ${trainerName} on ${sessionDate} at ${startTime}.`;
}

function createPaymentLine(context: TemplateRenderContext): string {
  const amountLabel = resolveAmountLabel(context.templateData);

  return amountLabel
    ? `Payment amount: ${amountLabel}.`
    : 'Payment details are available in your account.';
}

function createWalletLine(context: TemplateRenderContext): string {
  const balanceLabel = resolveWalletBalanceLabel(context.templateData);

  return balanceLabel
    ? `Current wallet balance: ${balanceLabel}.`
    : 'Your wallet transaction has been updated.';
}

const EMAIL_TEMPLATE_DEFINITIONS: Record<
  EmailNotificationEvent,
  EmailTemplateDefinition
> = {
  [EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_CREATED]: {
    subject: `Set up your ${BRAND_NAME} account`,
    eyebrow: 'Customer invitation',
    title: `You have been invited to ${BRAND_NAME}`,
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your customer account has been created.`,
    bodyLines: [
      'Use the button below to set your password and access the app.',
      'This invite link is time-limited. Do not share it with anyone.',
    ],
    ctaLabel: 'Set password',
  },
  [EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_RESENT]: {
    subject: `Your ${BRAND_NAME} invite link`,
    eyebrow: 'Customer invitation',
    title: 'Your invite link has been resent',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, here is your latest account setup link.`,
    bodyLines: [
      'Use the button below to set your password and access your account.',
      'Only the latest invite link should be used.',
    ],
    ctaLabel: 'Set password',
  },
  [EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_EXPIRING_SOON]: {
    subject: `Your ${BRAND_NAME} invite is expiring soon`,
    eyebrow: 'Customer invitation',
    title: 'Your invite is expiring soon',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your account invitation is still pending.`,
    bodyLines: [
      'Set your password before the invite expires.',
      'After expiry, you will need a new invite from the admin team.',
    ],
    ctaLabel: 'Set password',
  },
  [EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_EXPIRED]: {
    subject: `Your ${BRAND_NAME} invite has expired`,
    eyebrow: 'Customer invitation',
    title: 'Your invite has expired',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your account invitation has expired.`,
    bodyLines: [
      'The expired link can no longer be used.',
      'Please contact the admin team if you still need account access.',
    ],
  },
  [EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_ACCEPTED]: {
    subject: `Your ${BRAND_NAME} account is ready`,
    eyebrow: 'Account setup',
    title: 'Your account setup is complete',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your password has been set successfully.`,
    bodyLines: [
      'You can now sign in and access your account.',
      'If you did not complete this setup, contact the admin team immediately.',
    ],
    ctaLabel: 'Open app',
  },
  [EMAIL_NOTIFICATION_EVENT_ADMIN_CREATED_CUSTOMER_WITH_PASSWORD_WELCOME]: {
    subject: `Welcome to ${BRAND_NAME}`,
    eyebrow: 'Account created',
    title: 'Your customer account has been created',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your account has been created by the admin team.`,
    bodyLines: [
      'You can now sign in using the credentials provided to you through the approved channel.',
      'For security, passwords are never included in email.',
    ],
    ctaLabel: 'Open app',
  },
  [EMAIL_NOTIFICATION_EVENT_PASSWORD_CHANGED]: {
    subject: `${BRAND_NAME} password changed`,
    eyebrow: 'Security notice',
    title: 'Your password was changed',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, this is a confirmation that your account password was changed.`,
    bodyLines: [
      'If you made this change, no further action is needed.',
      'If you did not make this change, contact the admin team immediately.',
    ],
  },
  [EMAIL_NOTIFICATION_EVENT_ACCOUNT_DEACTIVATED_BY_ADMIN]: {
    subject: `${BRAND_NAME} account deactivated`,
    eyebrow: 'Account status',
    title: 'Your account has been deactivated',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your account access has been deactivated by the admin team.`,
    bodyLines: [
      'You will not be able to access protected app features while the account is deactivated.',
      'Contact the admin team if you believe this was done incorrectly.',
    ],
  },
  [EMAIL_NOTIFICATION_EVENT_ACCOUNT_REACTIVATED_BY_ADMIN]: {
    subject: `${BRAND_NAME} account reactivated`,
    eyebrow: 'Account status',
    title: 'Your account has been reactivated',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your account access has been restored.`,
    bodyLines: ['You can now sign in and continue using the app.'],
    ctaLabel: 'Open app',
  },
  [EMAIL_NOTIFICATION_EVENT_ACCOUNT_DELETED_OR_CLOSED]: {
    subject: `${BRAND_NAME} account closed`,
    eyebrow: 'Account status',
    title: 'Your account has been closed',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your account has been closed by the admin team.`,
    bodyLines: [
      'You will no longer be able to access this account.',
      'Contact the admin team if you need help.',
    ],
  },
  [EMAIL_NOTIFICATION_EVENT_BOOKING_CREATED_PENDING_PAYMENT]: {
    subject: 'Booking created — payment pending',
    eyebrow: 'Booking',
    title: 'Your booking is waiting for payment',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your booking has been created and is pending payment.`,
    bodyLines: (context) => [
      createBookingLine(context),
      'Complete payment before the hold expires to confirm your booking.',
    ],
    ctaLabel: 'Complete payment',
  },
  [EMAIL_NOTIFICATION_EVENT_BOOKING_CONFIRMED_AFTER_PAYMENT]: {
    subject: 'Booking confirmed',
    eyebrow: 'Booking',
    title: 'Your booking is confirmed',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your payment was successful and your booking is confirmed.`,
    bodyLines: (context) => [
      createBookingLine(context),
      createPaymentLine(context),
    ],
    ctaLabel: 'View booking',
  },
  [EMAIL_NOTIFICATION_EVENT_BOOKING_CANCELLED_BY_CUSTOMER]: {
    subject: 'Booking cancelled',
    eyebrow: 'Booking',
    title: 'Your booking has been cancelled',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your booking cancellation has been recorded.`,
    bodyLines: (context) => [createBookingLine(context)],
  },
  [EMAIL_NOTIFICATION_EVENT_BOOKING_CANCELLED_BY_ADMIN]: {
    subject: 'Booking cancelled by admin',
    eyebrow: 'Booking',
    title: 'Your booking was cancelled',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your booking was cancelled by the admin team.`,
    bodyLines: (context) => [
      createBookingLine(context),
      'Any payment or refund update will be handled separately where applicable.',
    ],
  },
  [EMAIL_NOTIFICATION_EVENT_BOOKING_RESCHEDULED_BY_CUSTOMER]: {
    subject: 'Booking rescheduled',
    eyebrow: 'Booking',
    title: 'Your booking has been rescheduled',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your booking reschedule has been recorded.`,
    bodyLines: ['The updated booking details are shown below.'],
    ctaLabel: 'View booking',
  },
  [EMAIL_NOTIFICATION_EVENT_BOOKING_RESCHEDULED_BY_ADMIN]: {
    subject: 'Booking rescheduled by admin',
    eyebrow: 'Booking',
    title: 'Your booking was rescheduled',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your booking was rescheduled by the admin team.`,
    bodyLines: ['The updated booking details are shown below.'],
    ctaLabel: 'View booking',
  },
  [EMAIL_NOTIFICATION_EVENT_BOOKING_COMPLETED]: {
    subject: 'Booking completed',
    eyebrow: 'Booking',
    title: 'Your booking is completed',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your booking has been marked as completed.`,
    bodyLines: (context) => [createBookingLine(context)],
  },
  [EMAIL_NOTIFICATION_EVENT_BOOKING_MARKED_NO_SHOW]: {
    subject: 'Booking marked as no-show',
    eyebrow: 'Booking',
    title: 'Your booking was marked as no-show',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your booking has been marked as no-show.`,
    bodyLines: (context) => [
      createBookingLine(context),
      'Contact the admin team if you believe this status is incorrect.',
    ],
  },
  [EMAIL_NOTIFICATION_EVENT_BOOKING_EXPIRED_DUE_TO_UNPAID_PAYMENT]: {
    subject: 'Booking expired',
    eyebrow: 'Booking',
    title: 'Your booking hold has expired',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your booking expired because payment was not completed in time.`,
    bodyLines: [
      'The seat has been released.',
      'You can create a new booking if availability still exists.',
    ],
    ctaLabel: 'Browse classes',
  },
  [EMAIL_NOTIFICATION_EVENT_WAITLIST_JOINED]: {
    subject: 'You joined the waitlist',
    eyebrow: 'Waitlist',
    title: 'You are on the waitlist',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, you have joined the waitlist.`,
    bodyLines: (context) => [
      createBookingLine(context),
      'We will notify you if a space becomes available.',
    ],
  },
  [EMAIL_NOTIFICATION_EVENT_WAITLIST_CANCELLED_BY_CUSTOMER]: {
    subject: 'Waitlist cancelled',
    eyebrow: 'Waitlist',
    title: 'You left the waitlist',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your waitlist entry has been cancelled.`,
    bodyLines: ['No further action is needed.'],
  },
  [EMAIL_NOTIFICATION_EVENT_WAITLIST_REMOVED_BY_ADMIN]: {
    subject: 'Removed from waitlist',
    eyebrow: 'Waitlist',
    title: 'Your waitlist entry was removed',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your waitlist entry was removed by the admin team.`,
    bodyLines: ['Contact the admin team if you need help.'],
  },
  [EMAIL_NOTIFICATION_EVENT_WAITLIST_PROMOTED_TO_BOOKING]: {
    subject: 'Waitlist promoted to booking',
    eyebrow: 'Waitlist',
    title: 'A spot is available for you',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your waitlist entry has been promoted.`,
    bodyLines: (context) => [
      createBookingLine(context),
      'Check your booking details in the app.',
    ],
    ctaLabel: 'View booking',
  },
  [EMAIL_NOTIFICATION_EVENT_WAITLIST_PROMOTION_PAYMENT_REQUIRED]: {
    subject: 'Payment required for promoted booking',
    eyebrow: 'Waitlist',
    title: 'Complete payment to confirm your spot',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, a space is available and payment is required.`,
    bodyLines: [
      'Complete payment before the promotion expires.',
      'If payment is not completed in time, the space may be released.',
    ],
    ctaLabel: 'Complete payment',
  },
  [EMAIL_NOTIFICATION_EVENT_WAITLIST_PROMOTION_EXPIRING_SOON]: {
    subject: 'Waitlist promotion expiring soon',
    eyebrow: 'Waitlist',
    title: 'Your available spot is expiring soon',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your promoted waitlist spot is still pending.`,
    bodyLines: [
      'Complete the required action before the promotion expires.',
      'The space may be released if no action is taken.',
    ],
    ctaLabel: 'Open app',
  },
  [EMAIL_NOTIFICATION_EVENT_WAITLIST_PROMOTION_EXPIRED]: {
    subject: 'Waitlist promotion expired',
    eyebrow: 'Waitlist',
    title: 'Your promoted spot has expired',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your promoted waitlist spot has expired.`,
    bodyLines: [
      'The space has been released.',
      'You can join the waitlist again if the option is still available.',
    ],
  },
  [EMAIL_NOTIFICATION_EVENT_CLASS_SPACE_AVAILABLE]: {
    subject: 'Class space available',
    eyebrow: 'Waitlist',
    title: 'A class space is available',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, a space may be available for a class you waitlisted.`,
    bodyLines: [
      'Open the app to review the latest availability.',
      'Spaces are limited and may change quickly.',
    ],
    ctaLabel: 'Open app',
  },
  [EMAIL_NOTIFICATION_EVENT_PAYMENT_CHECKOUT_CREATED_OPTIONAL]: {
    subject: 'Payment checkout created',
    eyebrow: 'Payment',
    title: 'Your payment checkout is ready',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your payment checkout has been created.`,
    bodyLines: (context) => [
      createPaymentLine(context),
      'Complete the payment before the checkout expires.',
    ],
    ctaLabel: 'Complete payment',
  },
  [EMAIL_NOTIFICATION_EVENT_PAYMENT_SUCCESS_RECEIPT]: {
    subject: 'Payment receipt',
    eyebrow: 'Payment',
    title: 'Your payment was successful',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your payment has been received successfully.`,
    bodyLines: (context) => [createPaymentLine(context)],
    ctaLabel: 'View receipt',
  },
  [EMAIL_NOTIFICATION_EVENT_PAYMENT_FAILED]: {
    subject: 'Payment failed',
    eyebrow: 'Payment',
    title: 'Your payment could not be completed',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your payment attempt failed.`,
    bodyLines: [
      'No successful payment was recorded for this attempt.',
      'You can try again from the app if the booking or checkout is still available.',
    ],
    ctaLabel: 'Open app',
  },
  [EMAIL_NOTIFICATION_EVENT_PAYMENT_CANCELLED]: {
    subject: 'Payment cancelled',
    eyebrow: 'Payment',
    title: 'Your payment was cancelled',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your payment was cancelled.`,
    bodyLines: [
      'No successful payment was recorded for this attempt.',
      'Open the app if you need to create a new payment.',
    ],
    ctaLabel: 'Open app',
  },
  [EMAIL_NOTIFICATION_EVENT_PAYMENT_EXPIRED]: {
    subject: 'Payment expired',
    eyebrow: 'Payment',
    title: 'Your payment session expired',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your payment session expired before completion.`,
    bodyLines: [
      'No payment was captured.',
      'Related booking holds may also expire if payment is not completed in time.',
    ],
    ctaLabel: 'Open app',
  },
  [EMAIL_NOTIFICATION_EVENT_PAYMENT_REFUNDED]: {
    subject: 'Payment refunded',
    eyebrow: 'Payment',
    title: 'Your payment has been refunded',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, a refund has been processed for your payment.`,
    bodyLines: (context) => [createPaymentLine(context)],
  },
  [EMAIL_NOTIFICATION_EVENT_PAYMENT_REFUND_FAILED_OR_MANUAL_REVIEW_REQUIRED]: {
    subject: 'Refund requires review',
    eyebrow: 'Payment operations',
    title: 'A refund requires manual review',
    intro: 'A refund could not be completed automatically.',
    bodyLines: [
      'Review the payment and provider status from the admin dashboard.',
      'Do not share provider internals with the customer unless needed.',
    ],
  },
  [EMAIL_NOTIFICATION_EVENT_PAYMENT_DUPLICATE_CALLBACK_IGNORED_ADMIN_ONLY_IF_SUSPICIOUS]:
    {
      subject: 'Duplicate payment callback ignored',
      eyebrow: 'Payment operations',
      title: 'A duplicate payment callback was ignored',
      intro: 'The backend ignored a duplicate payment callback.',
      bodyLines: [
        'Review the payment only if the event looks suspicious.',
        'No customer email should be sent for this event.',
      ],
    },
  [EMAIL_NOTIFICATION_EVENT_WALLET_TOP_UP_SUCCESS]: {
    subject: 'Wallet top-up successful',
    eyebrow: 'Wallet',
    title: 'Your wallet has been topped up',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your wallet top-up was successful.`,
    bodyLines: (context) => [createWalletLine(context)],
  },
  [EMAIL_NOTIFICATION_EVENT_WALLET_TOP_UP_FAILED]: {
    subject: 'Wallet top-up failed',
    eyebrow: 'Wallet',
    title: 'Your wallet top-up failed',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your wallet top-up could not be completed.`,
    bodyLines: ['No wallet credit was added for this attempt.'],
  },
  [EMAIL_NOTIFICATION_EVENT_WALLET_TOP_UP_EXPIRED]: {
    subject: 'Wallet top-up expired',
    eyebrow: 'Wallet',
    title: 'Your wallet top-up expired',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your wallet top-up expired before payment was completed.`,
    bodyLines: ['No wallet credit was added.'],
  },
  [EMAIL_NOTIFICATION_EVENT_WALLET_BOOKING_DEBIT_SUCCESS]: {
    subject: 'Wallet payment successful',
    eyebrow: 'Wallet',
    title: 'Wallet payment completed',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your wallet was used successfully for a booking payment.`,
    bodyLines: (context) => [createWalletLine(context)],
  },
  [EMAIL_NOTIFICATION_EVENT_WALLET_REFUND_CREDIT_SUCCESS]: {
    subject: 'Refund credited to wallet',
    eyebrow: 'Wallet',
    title: 'Refund credited to your wallet',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your refund has been credited to your wallet.`,
    bodyLines: (context) => [createWalletLine(context)],
  },
  [EMAIL_NOTIFICATION_EVENT_WALLET_ADMIN_ADJUSTMENT_CREDIT]: {
    subject: 'Wallet credit adjustment',
    eyebrow: 'Wallet',
    title: 'Your wallet received an adjustment credit',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, the admin team added a credit adjustment to your wallet.`,
    bodyLines: (context) => [createWalletLine(context)],
  },
  [EMAIL_NOTIFICATION_EVENT_WALLET_ADMIN_ADJUSTMENT_DEBIT]: {
    subject: 'Wallet debit adjustment',
    eyebrow: 'Wallet',
    title: 'Your wallet received an adjustment debit',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, the admin team applied a debit adjustment to your wallet.`,
    bodyLines: (context) => [createWalletLine(context)],
  },
  [EMAIL_NOTIFICATION_EVENT_WALLET_LOW_BALANCE_OPTIONAL]: {
    subject: 'Wallet balance reminder',
    eyebrow: 'Wallet',
    title: 'Your wallet balance is low',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your wallet balance is below the configured reminder threshold.`,
    bodyLines: (context) => [createWalletLine(context)],
  },
  [EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_CREATED_PENDING_PAYMENT]: {
    subject: 'Private booking created — payment pending',
    eyebrow: 'Private booking',
    title: 'Your private session is waiting for payment',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your private session booking has been created and is pending payment.`,
    bodyLines: (context) => [
      createPrivateBookingLine(context),
      'Complete payment before the hold expires to confirm the session.',
    ],
    ctaLabel: 'Complete payment',
  },
  [EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_CONFIRMED_AFTER_PAYMENT]: {
    subject: 'Private booking confirmed',
    eyebrow: 'Private booking',
    title: 'Your private session is confirmed',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your private session has been confirmed.`,
    bodyLines: (context) => [
      createPrivateBookingLine(context),
      createPaymentLine(context),
    ],
    ctaLabel: 'View booking',
  },
  [EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_CANCELLED_BY_CUSTOMER]: {
    subject: 'Private booking cancelled',
    eyebrow: 'Private booking',
    title: 'Private session cancelled',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, the private session cancellation has been recorded.`,
    bodyLines: (context) => [createPrivateBookingLine(context)],
  },
  [EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_CANCELLED_BY_ADMIN]: {
    subject: 'Private booking cancelled by admin',
    eyebrow: 'Private booking',
    title: 'Private session cancelled',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, the private session was cancelled by the admin team.`,
    bodyLines: (context) => [createPrivateBookingLine(context)],
  },
  [EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_RESCHEDULED_BY_CUSTOMER]: {
    subject: 'Private booking rescheduled',
    eyebrow: 'Private booking',
    title: 'Private session rescheduled',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, the private session reschedule has been recorded.`,
    bodyLines: ['The updated private session details are shown below.'],
    ctaLabel: 'View booking',
  },
  [EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_RESCHEDULED_BY_ADMIN]: {
    subject: 'Private booking rescheduled by admin',
    eyebrow: 'Private booking',
    title: 'Private session rescheduled',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, the private session was rescheduled by the admin team.`,
    bodyLines: ['The updated private session details are shown below.'],
    ctaLabel: 'View booking',
  },
  [EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_REMINDER_24_HOURS_BEFORE]: {
    subject: 'Private session reminder — 24 hours',
    eyebrow: 'Private booking',
    title: 'Your private session is tomorrow',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, this is a reminder for your private session.`,
    bodyLines: (context) => [createPrivateBookingLine(context)],
  },
  [EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_REMINDER_2_HOURS_BEFORE]: {
    subject: 'Private session reminder — 2 hours',
    eyebrow: 'Private booking',
    title: 'Your private session starts soon',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your private session starts soon.`,
    bodyLines: (context) => [createPrivateBookingLine(context)],
  },
  [EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_REFUNDED]: {
    subject: 'Private booking refunded',
    eyebrow: 'Private booking',
    title: 'Your private booking payment was refunded',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, a refund has been processed for your private booking.`,
    bodyLines: (context) => [createPaymentLine(context)],
  },
  [EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_EXPIRED_DUE_TO_UNPAID_PAYMENT]: {
    subject: 'Private booking expired',
    eyebrow: 'Private booking',
    title: 'Your private session hold expired',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your private session hold expired because payment was not completed in time.`,
    bodyLines: ['The session slot has been released.'],
  },
  [EMAIL_NOTIFICATION_EVENT_TRAINER_ACCOUNT_CREATED_WITH_PASSWORD]: {
    subject: `Welcome to ${BRAND_NAME}`,
    eyebrow: 'Trainer account',
    title: 'Your staff account has been created',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your staff account has been created.`,
    bodyLines: [
      'You can sign in using the credentials provided to you through the approved channel.',
      'For security, passwords are never included in email.',
    ],
    ctaLabel: 'Open app',
  },
  [EMAIL_NOTIFICATION_EVENT_TRAINER_AVAILABILITY_UPDATED]: {
    subject: 'Availability updated',
    eyebrow: 'Trainer schedule',
    title: 'Your availability was updated',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, your availability has been updated by the admin team.`,
    bodyLines: ['Review your latest availability in the app.'],
  },
  [EMAIL_NOTIFICATION_EVENT_TRAINER_ASSIGNED_TO_CLASS]: {
    subject: 'Assigned to class',
    eyebrow: 'Trainer schedule',
    title: 'You have been assigned to a class',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, you have been assigned to a class schedule.`,
    bodyLines: (context) => [createBookingLine(context)],
  },
  [EMAIL_NOTIFICATION_EVENT_TRAINER_REMOVED_FROM_CLASS]: {
    subject: 'Removed from class',
    eyebrow: 'Trainer schedule',
    title: 'You have been removed from a class',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, you have been removed from a class schedule.`,
    bodyLines: (context) => [createBookingLine(context)],
  },
  [EMAIL_NOTIFICATION_EVENT_TRAINER_SCHEDULE_CHANGED]: {
    subject: 'Schedule changed',
    eyebrow: 'Trainer schedule',
    title: 'Your schedule has changed',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, a schedule assigned to you has changed.`,
    bodyLines: ['Review the updated schedule details below.'],
  },
  [EMAIL_NOTIFICATION_EVENT_TRAINER_BOOKING_CANCELLED]: {
    subject: 'Booking cancelled',
    eyebrow: 'Trainer schedule',
    title: 'A booking assigned to you was cancelled',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, a confirmed booking assigned to you was cancelled.`,
    bodyLines: ['Review the booking details below.'],
  },
  [EMAIL_NOTIFICATION_EVENT_TRAINER_DAILY_SCHEDULE_SUMMARY]: {
    subject: 'Daily schedule summary',
    eyebrow: 'Trainer schedule',
    title: 'Your schedule for today',
    intro: ({ recipientName }) =>
      `Hi ${recipientName}, here is your daily schedule summary.`,
    bodyLines: [
      'Review your confirmed classes and private sessions before the day starts.',
    ],
    ctaLabel: 'Open schedule',
  },
};

function renderDetailRows(rows: readonly DetailRow[]): string {
  if (rows.length === 0) {
    return '';
  }

  const renderedRows = rows
    .map(
      (row) => `
        <tr>
          <td style="padding: 10px 0; color: ${THEME.slate600}; font-size: 13px; border-bottom: 1px solid ${THEME.slate100};">
            ${escapeHtml(row.label)}
          </td>
          <td style="padding: 10px 0; color: ${THEME.slate900}; font-size: 13px; font-weight: 700; text-align: right; border-bottom: 1px solid ${THEME.slate100};">
            ${escapeHtml(row.value)}
          </td>
        </tr>`,
    )
    .join('');

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 20px 0 0; border-collapse: collapse;">
      ${renderedRows}
    </table>`;
}

function renderCtaButton(
  label: string | null,
  actionUrl: string | null,
): string {
  if (!label || !actionUrl) {
    return '';
  }

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 26px 0 0;">
      <tr>
        <td style="border-radius: 14px; background: ${THEME.brand300};">
          <a href="${escapeAttribute(actionUrl)}" style="display: inline-block; padding: 13px 20px; color: ${THEME.slate900}; font-size: 14px; font-weight: 800; text-decoration: none; border-radius: 14px;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>`;
}

function renderHtmlEmail(input: {
  readonly context: TemplateRenderContext;
  readonly definition: EmailTemplateDefinition;
  readonly subject: string;
  readonly title: string;
  readonly intro: string;
  readonly bodyLines: readonly string[];
  readonly ctaLabel: string | null;
  readonly actionUrl: string | null;
  readonly footerNote: string | null;
  readonly detailRows: readonly DetailRow[];
}): string {
  const bodyParagraphs = input.bodyLines
    .map(
      (line) => `
        <p style="margin: 12px 0 0; color: ${THEME.slate600}; font-size: 14px; line-height: 1.7;">
          ${escapeHtml(line)}
        </p>`,
    )
    .join('');

  return `<!doctype html>
<html lang="${escapeAttribute(input.context.locale)}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(input.subject)}</title>
  </head>
  <body style="margin: 0; padding: 0; background: ${THEME.slate50}; font-family: Poppins, Arial, sans-serif; color: ${THEME.slate900};">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${THEME.slate50}; padding: 32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 620px; background: ${THEME.white}; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 35px rgba(15, 23, 42, 0.06);">
            <tr>
              <td style="background: ${THEME.brand100}; padding: 28px 32px;">
                <div style="color: ${THEME.slate900}; font-size: 22px; line-height: 1.2; font-weight: 900; letter-spacing: 0.02em;">
                  ${BRAND_NAME}
                </div>
                <div style="margin-top: 10px; color: ${THEME.slate600}; font-size: 12px; line-height: 1.4; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;">
                  ${escapeHtml(input.definition.eyebrow)}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding: 32px;">
                <h1 style="margin: 0; color: ${THEME.slate900}; font-size: 24px; line-height: 1.3; font-weight: 900;">
                  ${escapeHtml(input.title)}
                </h1>
                <p style="margin: 16px 0 0; color: ${THEME.slate900}; font-size: 15px; line-height: 1.7; font-weight: 600;">
                  ${escapeHtml(input.intro)}
                </p>
                ${bodyParagraphs}
                ${renderDetailRows(input.detailRows)}
                ${renderCtaButton(input.ctaLabel, input.actionUrl)}
                ${
                  input.footerNote
                    ? `<p style="margin: 24px 0 0; color: ${THEME.slate600}; font-size: 12px; line-height: 1.6;">${escapeHtml(input.footerNote)}</p>`
                    : ''
                }
              </td>
            </tr>
            <tr>
              <td style="background: ${THEME.slate100}; padding: 20px 32px;">
                <p style="margin: 0; color: ${THEME.slate600}; font-size: 12px; line-height: 1.6;">
                  This is an automated ${BRAND_NAME} notification. Do not reply to this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderTextEmail(input: {
  readonly definition: EmailTemplateDefinition;
  readonly title: string;
  readonly intro: string;
  readonly bodyLines: readonly string[];
  readonly ctaLabel: string | null;
  readonly actionUrl: string | null;
  readonly footerNote: string | null;
  readonly detailRows: readonly DetailRow[];
}): string {
  const detailLines =
    input.detailRows.length > 0
      ? [
          '',
          'Details:',
          ...input.detailRows.map((row) => `${row.label}: ${row.value}`),
        ]
      : [];

  const actionLines =
    input.ctaLabel && input.actionUrl
      ? ['', `${input.ctaLabel}: ${input.actionUrl}`]
      : [];

  const footerLines = input.footerNote ? ['', input.footerNote] : [];

  return [
    BRAND_NAME,
    input.definition.eyebrow,
    '',
    input.title,
    '',
    input.intro,
    ...input.bodyLines.map((line) => `\n${line}`),
    ...detailLines,
    ...actionLines,
    ...footerLines,
    '',
    `This is an automated ${BRAND_NAME} notification. Do not reply to this email.`,
  ].join('\n');
}

@Injectable()
export class EmailTemplateRendererService {
  render(input: EmailNotificationTemplateInput): RenderedEmailTemplate {
    const definition = EMAIL_TEMPLATE_DEFINITIONS[input.eventType];

    if (!definition) {
      throw AppError.emailNotificationTemplateNotFound(
        `No email template is configured for event ${input.eventType}.`,
        {
          eventType: input.eventType,
        },
      );
    }

    const context: TemplateRenderContext = {
      eventType: input.eventType,
      templateData: input.templateData,
      locale: input.locale,
      recipientName: resolveRecipientName(input),
    };

    const subject = resolveText(definition.subject, context);
    const title = resolveText(definition.title, context);
    const intro = resolveText(definition.intro, context);
    const bodyLines = resolveLines(definition.bodyLines, context);
    const ctaLabel = definition.ctaLabel
      ? resolveText(definition.ctaLabel, context)
      : null;
    const footerNote = definition.footerNote
      ? resolveText(definition.footerNote, context)
      : null;
    const actionUrl = resolveActionUrl(input.templateData);
    const detailRows = buildDetailRows(input.templateData);

    return {
      eventType: input.eventType,
      locale: input.locale,
      subject,
      htmlContent: renderHtmlEmail({
        context,
        definition,
        subject,
        title,
        intro,
        bodyLines,
        ctaLabel,
        actionUrl,
        footerNote,
        detailRows,
      }),
      textContent: renderTextEmail({
        definition,
        title,
        intro,
        bodyLines,
        ctaLabel,
        actionUrl,
        footerNote,
        detailRows,
      }),
    };
  }
}
