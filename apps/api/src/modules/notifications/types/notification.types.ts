// apps/api/src/modules/notifications/types/notification.types.ts
/**
 * LAFAM notification types.
 *
 * Role:
 * - Defines the application-level type contract for email notification creation,
 *   rendering, outbox persistence, provider dispatch, and delivery tracking.
 * - Keeps notification services/repositories strongly typed without leaking
 *   provider-specific details into feature modules.
 *
 * Important:
 * - This file contains types only.
 * - Feature modules should describe what happened; notification services decide
 *   recipient, template, safe payload, and provider dispatch.
 * - Metadata must never contain Civil ID, passwords, OTPs, raw invite tokens,
 *   full invite URLs, cookies, provider secrets, or raw provider payloads.
 */

import type {
  DatabaseEmailDeliveryAttemptStatus,
  DatabaseEmailNotificationEvent,
  DatabaseEmailNotificationStatus,
  DatabaseEmailRecipientRole,
  DatabaseJsonObject,
  EmailDeliveryAttemptInsert,
  EmailDeliveryAttemptRow,
  EmailNotificationInsert,
  EmailNotificationRow,
} from '../../../database/database.types';

export type EmailProviderName = 'brevo';

export type EmailNotificationEvent = DatabaseEmailNotificationEvent;

export type EmailNotificationStatus = DatabaseEmailNotificationStatus;

export type EmailDeliveryAttemptStatus = DatabaseEmailDeliveryAttemptStatus;

export type EmailRecipientRole = DatabaseEmailRecipientRole;

export type EmailNotificationEntityType =
  | 'app_user'
  | 'customer_invitation'
  | 'booking'
  | 'booking_order'
  | 'booking_waitlist'
  | 'private_trainer_booking'
  | 'payment'
  | 'wallet_ledger_entry'
  | 'staff_profile'
  | 'pilates_class_schedule';

export interface EmailRecipient {
  readonly role: EmailRecipientRole;
  readonly email: string;
  readonly name?: string | null;
  readonly appUserId?: string | null;
}

export interface EmailNotificationEntityReference {
  readonly entityType: EmailNotificationEntityType;
  readonly entityId: string;
}

export interface EmailNotificationContent {
  readonly subject: string;
  readonly htmlContent: string;
  readonly textContent: string;
}

export interface EmailNotificationTemplateInput {
  readonly eventType: EmailNotificationEvent;
  readonly recipient: EmailRecipient;
  readonly templateData: DatabaseJsonObject;
  readonly locale: string;
}

export interface RenderedEmailTemplate extends EmailNotificationContent {
  readonly eventType: EmailNotificationEvent;
  readonly locale: string;
}

export interface CreateEmailNotificationInput {
  readonly eventType: EmailNotificationEvent;
  readonly recipient: EmailRecipient;
  readonly content: EmailNotificationContent;
  readonly provider?: EmailProviderName;
  readonly entity?: EmailNotificationEntityReference | null;
  readonly idempotencyKey?: string | null;
  readonly scheduledFor?: string | null;
  readonly maxAttempts?: number;
  readonly metadata?: DatabaseJsonObject;
}

export interface CreateEmailNotificationRecordInput {
  readonly eventType: EmailNotificationEvent;
  readonly recipientRole: EmailRecipientRole;
  readonly recipientAppUserId?: string | null;
  readonly recipientEmail: string;
  readonly recipientName?: string | null;
  readonly subject: string;
  readonly htmlContent: string;
  readonly textContent: string;
  readonly status?: EmailNotificationStatus;
  readonly provider?: EmailProviderName;
  readonly entityType?: EmailNotificationEntityType | null;
  readonly entityId?: string | null;
  readonly idempotencyKey?: string | null;
  readonly scheduledFor?: string | null;
  readonly maxAttempts?: number;
  readonly metadata?: DatabaseJsonObject;
}

export interface EmailNotificationDispatchInput {
  readonly notification: EmailNotificationRow;
}

export interface EmailNotificationDispatchResult {
  readonly notificationId: string;
  readonly status: EmailNotificationStatus;
  readonly provider: EmailProviderName;
  readonly providerMessageId?: string | null;
  readonly providerRequestId?: string | null;
  readonly providerStatusCode?: number | null;
  readonly failureCode?: string | null;
  readonly failureMessage?: string | null;
  readonly safeResponseMetadata?: DatabaseJsonObject;
}

export interface EmailDeliveryAttemptInput {
  readonly emailNotificationId: string;
  readonly attemptNumber: number;
  readonly provider: EmailProviderName;
  readonly status: EmailDeliveryAttemptStatus;
  readonly providerMessageId?: string | null;
  readonly providerRequestId?: string | null;
  readonly providerStatusCode?: number | null;
  readonly errorCode?: string | null;
  readonly errorMessage?: string | null;
  readonly safeResponseMetadata?: DatabaseJsonObject;
}

export interface BrevoEmailAddress {
  readonly email: string;
  readonly name?: string;
}

export interface BrevoSendTransactionalEmailPayload {
  readonly sender: BrevoEmailAddress;
  readonly to: readonly BrevoEmailAddress[];
  readonly subject: string;
  readonly htmlContent: string;
  readonly textContent: string;
  readonly tags?: readonly string[];
  readonly headers?: Readonly<Record<string, string>>;
  readonly params?: DatabaseJsonObject;
}

export interface BrevoSendTransactionalEmailSuccessResponse {
  readonly messageId?: string;
}

export interface BrevoSendTransactionalEmailFailureResponse {
  readonly code?: string;
  readonly message?: string;
}

export interface BrevoSendEmailInput {
  readonly notificationId: string;
  readonly idempotencyKey?: string | null;
  readonly recipient: EmailRecipient;
  readonly subject: string;
  readonly htmlContent: string;
  readonly textContent: string;
  readonly eventType: EmailNotificationEvent;
  readonly metadata?: DatabaseJsonObject;
}

export interface BrevoSendEmailResult {
  readonly provider: 'brevo';
  readonly providerMessageId: string | null;
  readonly providerRequestId: string | null;
  readonly providerStatusCode: number;
  readonly safeResponseMetadata: DatabaseJsonObject;
}

export interface EmailOutboxCreateResult {
  readonly notification: EmailNotificationRow;
  readonly wasCreated: boolean;
}

export interface EmailDispatchCandidate {
  readonly notification: EmailNotificationRow;
  readonly nextAttemptNumber: number;
}

export interface EmailNotificationRepositoryCreateInput {
  readonly notification: EmailNotificationInsert;
}

export interface EmailDeliveryAttemptRepositoryCreateInput {
  readonly deliveryAttempt: EmailDeliveryAttemptInsert;
}

export interface EmailNotificationMarkSendingInput {
  readonly notificationId: string;
  readonly lockedBy: string;
  readonly lockedAt: string;
}

export interface EmailNotificationMarkSentInput {
  readonly notificationId: string;
  readonly providerMessageId?: string | null;
  readonly sentAt: string;
}

export interface EmailNotificationMarkFailedInput {
  readonly notificationId: string;
  readonly failureCode?: string | null;
  readonly failureMessage?: string | null;
  readonly failedAt: string;
}

export interface EmailNotificationMarkRetryableInput {
  readonly notificationId: string;
  readonly retryAfter: string;
  readonly updatedAt: string;
  readonly failureCode?: string | null;
  readonly failureMessage?: string | null;
}

export interface EmailNotificationMarkSkippedInput {
  readonly notificationId: string;
  readonly skippedAt: string;
  readonly failureCode?: string | null;
  readonly failureMessage?: string | null;
}

export interface EmailNotificationMarkCancelledInput {
  readonly notificationId: string;
  readonly cancelledAt: string;
  readonly failureCode?: string | null;
  readonly failureMessage?: string | null;
}

export interface EmailDeliveryAttemptCreateResult {
  readonly deliveryAttempt: EmailDeliveryAttemptRow;
}

export interface NotificationSafeMetadataValidationResult {
  readonly valid: boolean;
  readonly forbiddenKeys: readonly string[];
}

export type EmailNotificationRowWithAttempts = EmailNotificationRow & {
  readonly deliveryAttempts?: readonly EmailDeliveryAttemptRow[];
};
