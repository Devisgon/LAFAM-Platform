// apps/api/src/modules/notifications/domain/email-idempotency.policy.ts
/**
 * LAFAM email idempotency policy.
 *
 * Role:
 * - Builds stable idempotency keys for email notification outbox records.
 * - Prevents duplicate emails for the same business event.
 * - Keeps idempotency logic centralized instead of scattering string-building
 *   across feature modules.
 *
 * Important:
 * - Idempotency keys must not contain raw invite tokens, passwords, OTPs,
 *   Civil ID values, cookies, provider secrets, or raw provider payloads.
 * - Keys may include safe identifiers such as event type, entity type,
 *   entity ID, recipient role, recipient app user ID, and normalized email.
 * - Long or variable data is hashed before being appended to the key.
 */

import { createHash } from 'node:crypto';

import {
  EMAIL_NOTIFICATION_IDEMPOTENCY_KEY_MAX_LENGTH,
  EMAIL_RECIPIENT_ROLE_CUSTOMER,
} from '../constants/notification.constants';
import type {
  EmailNotificationEntityReference,
  EmailNotificationEntityType,
  EmailNotificationEvent,
  EmailRecipient,
  EmailRecipientRole,
} from '../types/notification.types';
import { normalizeEmailAddress } from './email-recipient.policy';

const EMAIL_IDEMPOTENCY_PREFIX = 'email';
const EMAIL_IDEMPOTENCY_HASH_LENGTH = 24;
const EMAIL_IDEMPOTENCY_SEPARATOR = ':';

const SAFE_KEY_PART_PATTERN = /[^a-zA-Z0-9_-]+/gu;

export interface EmailIdempotencyKeyInput {
  readonly eventType: EmailNotificationEvent;
  readonly recipient: EmailRecipient;
  readonly entity?: EmailNotificationEntityReference | null;
  readonly scope?: string | null;
}

export interface EmailEntityIdempotencyKeyInput {
  readonly eventType: EmailNotificationEvent;
  readonly recipientRole: EmailRecipientRole;
  readonly recipientEmail: string;
  readonly recipientAppUserId?: string | null;
  readonly entityType: EmailNotificationEntityType;
  readonly entityId: string;
  readonly scope?: string | null;
}

function normalizeOptionalKeyPart(
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function normalizeKeyPart(value: string): string {
  const normalizedValue = value
    .trim()
    .replace(SAFE_KEY_PART_PATTERN, '_')
    .replace(/^_+|_+$/gu, '')
    .toLowerCase();

  return normalizedValue.length > 0 ? normalizedValue : 'unknown';
}

function hashKeyPayload(value: string): string {
  return createHash('sha256')
    .update(value)
    .digest('hex')
    .slice(0, EMAIL_IDEMPOTENCY_HASH_LENGTH);
}

function buildKey(parts: readonly string[], hashPayload: string): string {
  const normalizedParts = parts.map(normalizeKeyPart);
  const hash = hashKeyPayload(hashPayload);

  const key = [...normalizedParts, hash].join(EMAIL_IDEMPOTENCY_SEPARATOR);

  if (key.length <= EMAIL_NOTIFICATION_IDEMPOTENCY_KEY_MAX_LENGTH) {
    return key;
  }

  const compactParts = [
    EMAIL_IDEMPOTENCY_PREFIX,
    normalizeKeyPart(parts[1] ?? 'event'),
    hash,
  ];

  return compactParts.join(EMAIL_IDEMPOTENCY_SEPARATOR);
}

export function normalizeEmailIdempotencyScope(
  scope: string | null | undefined,
): string | null {
  return normalizeOptionalKeyPart(scope);
}

export function createEmailIdempotencyKey(
  input: EmailIdempotencyKeyInput,
): string {
  const normalizedRecipientEmail = normalizeEmailAddress(input.recipient.email);
  const recipientAppUserId =
    normalizeOptionalKeyPart(input.recipient.appUserId) ?? 'no_user';
  const scope = normalizeEmailIdempotencyScope(input.scope) ?? 'default';
  const entityType = input.entity?.entityType ?? 'no_entity';
  const entityId = input.entity?.entityId ?? 'no_entity_id';

  const hashPayload = JSON.stringify({
    eventType: input.eventType,
    recipientRole: input.recipient.role,
    recipientEmail: normalizedRecipientEmail,
    recipientAppUserId,
    entityType,
    entityId,
    scope,
  });

  return buildKey(
    [
      EMAIL_IDEMPOTENCY_PREFIX,
      input.eventType,
      entityType,
      entityId,
      input.recipient.role,
      recipientAppUserId,
      scope,
    ],
    hashPayload,
  );
}

export function createEntityEmailIdempotencyKey(
  input: EmailEntityIdempotencyKeyInput,
): string {
  return createEmailIdempotencyKey({
    eventType: input.eventType,
    recipient: {
      role: input.recipientRole,
      email: input.recipientEmail,
      appUserId: input.recipientAppUserId ?? null,
    },
    entity: {
      entityType: input.entityType,
      entityId: input.entityId,
    },
    scope: input.scope ?? null,
  });
}

export function createCustomerAccountEmailIdempotencyKey(input: {
  readonly eventType: EmailNotificationEvent;
  readonly customerAppUserId: string;
  readonly customerEmail: string;
  readonly scope?: string | null;
}): string {
  return createEntityEmailIdempotencyKey({
    eventType: input.eventType,
    recipientRole: EMAIL_RECIPIENT_ROLE_CUSTOMER,
    recipientEmail: input.customerEmail,
    recipientAppUserId: input.customerAppUserId,
    entityType: 'app_user',
    entityId: input.customerAppUserId,
    scope: input.scope ?? null,
  });
}

export function createCustomerInvitationEmailIdempotencyKey(input: {
  readonly eventType: EmailNotificationEvent;
  readonly customerInvitationId: string;
  readonly customerAppUserId: string;
  readonly customerEmail: string;
  readonly scope?: string | null;
}): string {
  return createEntityEmailIdempotencyKey({
    eventType: input.eventType,
    recipientRole: EMAIL_RECIPIENT_ROLE_CUSTOMER,
    recipientEmail: input.customerEmail,
    recipientAppUserId: input.customerAppUserId,
    entityType: 'customer_invitation',
    entityId: input.customerInvitationId,
    scope: input.scope ?? null,
  });
}

export function createBookingEmailIdempotencyKey(input: {
  readonly eventType: EmailNotificationEvent;
  readonly bookingId: string;
  readonly recipient: EmailRecipient;
  readonly scope?: string | null;
}): string {
  return createEmailIdempotencyKey({
    eventType: input.eventType,
    recipient: input.recipient,
    entity: {
      entityType: 'booking',
      entityId: input.bookingId,
    },
    scope: input.scope ?? null,
  });
}

export function createPrivateBookingEmailIdempotencyKey(input: {
  readonly eventType: EmailNotificationEvent;
  readonly privateBookingId: string;
  readonly recipient: EmailRecipient;
  readonly scope?: string | null;
}): string {
  return createEmailIdempotencyKey({
    eventType: input.eventType,
    recipient: input.recipient,
    entity: {
      entityType: 'private_trainer_booking',
      entityId: input.privateBookingId,
    },
    scope: input.scope ?? null,
  });
}

export function createPaymentEmailIdempotencyKey(input: {
  readonly eventType: EmailNotificationEvent;
  readonly paymentId: string;
  readonly recipient: EmailRecipient;
  readonly scope?: string | null;
}): string {
  return createEmailIdempotencyKey({
    eventType: input.eventType,
    recipient: input.recipient,
    entity: {
      entityType: 'payment',
      entityId: input.paymentId,
    },
    scope: input.scope ?? null,
  });
}

export function createWalletLedgerEmailIdempotencyKey(input: {
  readonly eventType: EmailNotificationEvent;
  readonly walletLedgerEntryId: string;
  readonly recipient: EmailRecipient;
  readonly scope?: string | null;
}): string {
  return createEmailIdempotencyKey({
    eventType: input.eventType,
    recipient: input.recipient,
    entity: {
      entityType: 'wallet_ledger_entry',
      entityId: input.walletLedgerEntryId,
    },
    scope: input.scope ?? null,
  });
}

export function isEmailIdempotencyKeyValid(
  idempotencyKey: string | null | undefined,
): boolean {
  if (typeof idempotencyKey !== 'string') {
    return false;
  }

  const trimmedKey = idempotencyKey.trim();

  return (
    trimmedKey.length > 0 &&
    trimmedKey.length <= EMAIL_NOTIFICATION_IDEMPOTENCY_KEY_MAX_LENGTH
  );
}
