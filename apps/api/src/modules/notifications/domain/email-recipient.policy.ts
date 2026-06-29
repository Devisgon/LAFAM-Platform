// apps/api/src/modules/notifications/domain/email-recipient.policy.ts
/**
 * LAFAM email recipient policy.
 *
 * Role:
 * - Validates recipient email addresses.
 * - Normalizes recipient fields before outbox persistence.
 * - Blocks email events from being sent to the wrong recipient role.
 *
 * Important:
 * - This file does not send emails.
 * - This file does not render templates.
 * - This file must not accept Civil ID, passwords, OTPs, raw invite tokens,
 *   full invite URLs, cookies, provider secrets, or raw provider payloads.
 */

import { AppError } from '../../../common/errors/app-error';
import {
  ADMIN_ONLY_EMAIL_NOTIFICATION_EVENTS,
  BOOKING_EMAIL_NOTIFICATION_EVENTS,
  CUSTOMER_ACCOUNT_EMAIL_NOTIFICATION_EVENTS,
  EMAIL_NOTIFICATION_EVENT_BOOKING_CANCELLED_BY_ADMIN,
  EMAIL_NOTIFICATION_EVENT_BOOKING_CANCELLED_BY_CUSTOMER,
  EMAIL_NOTIFICATION_EVENT_BOOKING_RESCHEDULED_BY_ADMIN,
  EMAIL_NOTIFICATION_EVENT_BOOKING_RESCHEDULED_BY_CUSTOMER,
  EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_ACCEPTED,
  EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_EXPIRED,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_CANCELLED_BY_ADMIN,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_CANCELLED_BY_CUSTOMER,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_CONFIRMED_AFTER_PAYMENT,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_REMINDER_2_HOURS_BEFORE,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_REMINDER_24_HOURS_BEFORE,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_RESCHEDULED_BY_ADMIN,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_RESCHEDULED_BY_CUSTOMER,
  EMAIL_RECIPIENT_ROLE_ADMIN,
  EMAIL_RECIPIENT_ROLE_CUSTOMER,
  EMAIL_RECIPIENT_ROLE_STAFF,
  EMAIL_RECIPIENT_ROLE_SYSTEM,
  EMAIL_RECIPIENT_ROLE_TRAINER,
  EMAIL_RECIPIENT_ROLES,
  PAYMENT_EMAIL_NOTIFICATION_EVENTS,
  PRIVATE_BOOKING_EMAIL_NOTIFICATION_EVENTS,
  TRAINER_EMAIL_NOTIFICATION_EVENTS,
  WAITLIST_EMAIL_NOTIFICATION_EVENTS,
  WALLET_EMAIL_NOTIFICATION_EVENTS,
} from '../constants/notification.constants';
import type {
  EmailNotificationEvent,
  EmailRecipient,
  EmailRecipientRole,
} from '../types/notification.types';

const EMAIL_ADDRESS_MIN_LENGTH = 3;
const EMAIL_ADDRESS_MAX_LENGTH = 320;
const EMAIL_RECIPIENT_NAME_MAX_LENGTH = 150;

const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

function createEventSet(
  events: readonly EmailNotificationEvent[],
): ReadonlySet<EmailNotificationEvent> {
  return new Set(events);
}

function createEventSetExcluding(
  events: readonly EmailNotificationEvent[],
  excludedEvents: readonly EmailNotificationEvent[],
): ReadonlySet<EmailNotificationEvent> {
  const excludedEventSet = createEventSet(excludedEvents);

  return createEventSet(
    events.filter((eventType) => !excludedEventSet.has(eventType)),
  );
}

const PAYMENT_CUSTOMER_EMAIL_NOTIFICATION_EVENT_SET = createEventSetExcluding(
  PAYMENT_EMAIL_NOTIFICATION_EVENTS,
  ADMIN_ONLY_EMAIL_NOTIFICATION_EVENTS,
);

const CUSTOMER_EMAIL_NOTIFICATION_EVENT_SET = createEventSet([
  ...CUSTOMER_ACCOUNT_EMAIL_NOTIFICATION_EVENTS,
  ...BOOKING_EMAIL_NOTIFICATION_EVENTS,
  ...WAITLIST_EMAIL_NOTIFICATION_EVENTS,
  ...PAYMENT_CUSTOMER_EMAIL_NOTIFICATION_EVENT_SET,
  ...WALLET_EMAIL_NOTIFICATION_EVENTS,
  ...PRIVATE_BOOKING_EMAIL_NOTIFICATION_EVENTS,
]);

const TRAINER_SCHEDULE_IMPACT_EMAIL_NOTIFICATION_EVENT_SET = createEventSet([
  EMAIL_NOTIFICATION_EVENT_BOOKING_CANCELLED_BY_CUSTOMER,
  EMAIL_NOTIFICATION_EVENT_BOOKING_CANCELLED_BY_ADMIN,
  EMAIL_NOTIFICATION_EVENT_BOOKING_RESCHEDULED_BY_CUSTOMER,
  EMAIL_NOTIFICATION_EVENT_BOOKING_RESCHEDULED_BY_ADMIN,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_CONFIRMED_AFTER_PAYMENT,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_CANCELLED_BY_CUSTOMER,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_CANCELLED_BY_ADMIN,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_RESCHEDULED_BY_CUSTOMER,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_RESCHEDULED_BY_ADMIN,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_REMINDER_24_HOURS_BEFORE,
  EMAIL_NOTIFICATION_EVENT_PRIVATE_BOOKING_REMINDER_2_HOURS_BEFORE,
]);

const TRAINER_EMAIL_NOTIFICATION_EVENT_SET = createEventSet([
  ...TRAINER_EMAIL_NOTIFICATION_EVENTS,
  ...TRAINER_SCHEDULE_IMPACT_EMAIL_NOTIFICATION_EVENT_SET,
]);

const STAFF_EMAIL_NOTIFICATION_EVENT_SET = TRAINER_EMAIL_NOTIFICATION_EVENT_SET;

const ADMIN_EMAIL_NOTIFICATION_EVENT_SET = createEventSet([
  ...ADMIN_ONLY_EMAIL_NOTIFICATION_EVENTS,
  EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_ACCEPTED,
  EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_EXPIRED,
]);

const SYSTEM_EMAIL_NOTIFICATION_EVENT_SET = createEventSet([]);

const EMAIL_NOTIFICATION_EVENTS_BY_RECIPIENT_ROLE = {
  [EMAIL_RECIPIENT_ROLE_CUSTOMER]: CUSTOMER_EMAIL_NOTIFICATION_EVENT_SET,
  [EMAIL_RECIPIENT_ROLE_ADMIN]: ADMIN_EMAIL_NOTIFICATION_EVENT_SET,
  [EMAIL_RECIPIENT_ROLE_TRAINER]: TRAINER_EMAIL_NOTIFICATION_EVENT_SET,
  [EMAIL_RECIPIENT_ROLE_STAFF]: STAFF_EMAIL_NOTIFICATION_EVENT_SET,
  [EMAIL_RECIPIENT_ROLE_SYSTEM]: SYSTEM_EMAIL_NOTIFICATION_EVENT_SET,
} as const satisfies Record<
  EmailRecipientRole,
  ReadonlySet<EmailNotificationEvent>
>;

function normalizeOptionalString(
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

export function normalizeEmailAddress(email: string): string {
  return email.trim().toLowerCase();
}

export function isEmailAddressValid(email: string): boolean {
  const normalizedEmail = normalizeEmailAddress(email);

  return (
    normalizedEmail.length >= EMAIL_ADDRESS_MIN_LENGTH &&
    normalizedEmail.length <= EMAIL_ADDRESS_MAX_LENGTH &&
    EMAIL_ADDRESS_PATTERN.test(normalizedEmail)
  );
}

export function normalizeEmailRecipient(
  recipient: EmailRecipient,
): EmailRecipient {
  const normalizedName = normalizeOptionalString(recipient.name);
  const normalizedAppUserId = normalizeOptionalString(recipient.appUserId);

  return {
    role: recipient.role,
    email: normalizeEmailAddress(recipient.email),
    name: normalizedName,
    appUserId: normalizedAppUserId,
  };
}

export function isEmailRecipientRoleAllowedForEvent(
  eventType: EmailNotificationEvent,
  recipientRole: EmailRecipientRole,
): boolean {
  return EMAIL_NOTIFICATION_EVENTS_BY_RECIPIENT_ROLE[recipientRole].has(
    eventType,
  );
}

export function getAllowedEmailRecipientRolesForEvent(
  eventType: EmailNotificationEvent,
): readonly EmailRecipientRole[] {
  return EMAIL_RECIPIENT_ROLES.filter((recipientRole) =>
    isEmailRecipientRoleAllowedForEvent(eventType, recipientRole),
  );
}

export function assertEmailRecipientRoleAllowedForEvent(
  eventType: EmailNotificationEvent,
  recipientRole: EmailRecipientRole,
): void {
  if (isEmailRecipientRoleAllowedForEvent(eventType, recipientRole)) {
    return;
  }

  throw AppError.emailNotificationRecipientInvalid(
    `Email event ${eventType} cannot be sent to recipient role ${recipientRole}.`,
    {
      eventType,
      recipientRole,
      allowedRecipientRoles: getAllowedEmailRecipientRolesForEvent(eventType),
    },
  );
}

export function assertValidEmailRecipient(
  eventType: EmailNotificationEvent,
  recipient: EmailRecipient,
): EmailRecipient {
  const normalizedRecipient = normalizeEmailRecipient(recipient);

  if (normalizedRecipient.role === EMAIL_RECIPIENT_ROLE_SYSTEM) {
    throw AppError.emailNotificationRecipientInvalid(
      'System is not a valid outbound email recipient role.',
      {
        eventType,
        recipientRole: normalizedRecipient.role,
      },
    );
  }

  if (!isEmailAddressValid(normalizedRecipient.email)) {
    throw AppError.emailNotificationRecipientInvalid(
      'The email notification recipient email address is invalid.',
      {
        eventType,
        recipientRole: normalizedRecipient.role,
      },
    );
  }

  if (
    normalizedRecipient.name &&
    normalizedRecipient.name.length > EMAIL_RECIPIENT_NAME_MAX_LENGTH
  ) {
    throw AppError.emailNotificationRecipientInvalid(
      `The email notification recipient name must be ${EMAIL_RECIPIENT_NAME_MAX_LENGTH} characters or fewer.`,
      {
        eventType,
        recipientRole: normalizedRecipient.role,
      },
    );
  }

  assertEmailRecipientRoleAllowedForEvent(eventType, normalizedRecipient.role);

  return normalizedRecipient;
}
