// apps/api/src/modules/notifications/application/email-dispatcher.service.ts
/**
 * LAFAM email dispatcher service.
 *
 * Role:
 * - Reads pending email notification outbox records.
 * - Locks one notification attempt at a time.
 * - Sends rendered emails through the configured provider.
 * - Records delivery attempts.
 * - Marks notifications as sent, retryable, failed, or skipped.
 *
 * Important:
 * - This service does not render templates.
 * - This service does not create feature notification intents.
 * - This service must never persist Brevo API keys, raw provider payloads,
 *   raw provider responses, invite tokens, passwords, OTPs, Civil ID, cookies,
 *   or secrets.
 */

import { Injectable } from '@nestjs/common';

import { currentEmailConfig } from '../../../common/config/email.config';
import { isAppError } from '../../../common/errors/app-error';
import type {
  DatabaseJsonObject,
  EmailNotificationRow,
} from '../../../database/database.types';
import {
  EMAIL_DELIVERY_ATTEMPT_STATUS_FAILED,
  EMAIL_NOTIFICATION_LOCK_OWNER,
  EMAIL_NOTIFICATION_STATUS_FAILED,
  EMAIL_NOTIFICATION_STATUS_PENDING,
  EMAIL_NOTIFICATION_STATUS_SENT,
  EMAIL_NOTIFICATION_STATUS_SENDING,
  EMAIL_NOTIFICATION_STATUS_SKIPPED,
  EMAIL_PROVIDER_BREVO,
} from '../constants/notification.constants';
import { EmailDeliveryAttemptRepository } from '../repositories/email-delivery-attempt.repository';
import { EmailNotificationRepository } from '../repositories/email-notification.repository';
import type {
  EmailDispatchCandidate,
  EmailNotificationStatus,
  EmailProviderName,
  EmailRecipient,
} from '../types/notification.types';
import { BrevoEmailProviderService } from './brevo-email-provider.service';

export interface DispatchDueEmailNotificationsInput {
  readonly scheduledBefore?: string | null;
  readonly limit?: number;
}

export interface ResetStaleEmailDispatchLocksInput {
  readonly lockedBefore?: string | null;
}

export interface EmailDispatchSingleResult {
  readonly notificationId: string;
  readonly status: EmailNotificationStatus;
  readonly attemptNumber: number;
  readonly provider: EmailProviderName | null;
  readonly providerMessageId: string | null;
  readonly providerRequestId: string | null;
  readonly providerStatusCode: number | null;
  readonly failureCode: string | null;
  readonly failureMessage: string | null;
  readonly retryAfter: string | null;
}

export interface EmailDispatchBatchResult {
  readonly scanned: number;
  readonly sent: number;
  readonly retried: number;
  readonly failed: number;
  readonly skipped: number;
  readonly ignored: number;
}

interface DispatchFailureContext {
  readonly failureCode: string;
  readonly failureMessage: string;
  readonly providerStatusCode: number | null;
  readonly providerRequestId: string | null;
  readonly safeResponseMetadata: DatabaseJsonObject;
}

const STALE_DISPATCH_LOCK_TIMEOUT_MS = 15 * 60 * 1_000;

const RETRY_DELAYS_MS = [
  5 * 60 * 1_000,
  15 * 60 * 1_000,
  30 * 60 * 1_000,
  60 * 60 * 1_000,
] as const;

function normalizeOptionalString(
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getStringProperty(
  value: Record<string, unknown>,
  key: string,
): string | null {
  const propertyValue = value[key];

  if (typeof propertyValue !== 'string') {
    return null;
  }

  return normalizeOptionalString(propertyValue);
}

function getNumberProperty(
  value: Record<string, unknown>,
  key: string,
): number | null {
  const propertyValue = value[key];

  if (typeof propertyValue !== 'number' || !Number.isFinite(propertyValue)) {
    return null;
  }

  return propertyValue;
}

function getErrorCauseRecord(error: unknown): Record<string, unknown> | null {
  if (!isAppError(error) || !isRecord(error.cause)) {
    return null;
  }

  return error.cause;
}

function getFailureCode(error: unknown): string {
  if (isAppError(error)) {
    return error.code;
  }

  if (error instanceof Error && error.name.trim()) {
    return error.name.trim();
  }

  return 'EMAIL_DISPATCH_FAILED';
}

function getFailureMessage(error: unknown): string {
  if (isAppError(error)) {
    return error.publicMessage;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return 'Email notification dispatch failed.';
}

function createFailureContext(
  notification: EmailNotificationRow,
  error: unknown,
): DispatchFailureContext {
  const cause = getErrorCauseRecord(error);
  const providerStatusCode = cause
    ? getNumberProperty(cause, 'provider_status_code')
    : null;
  const providerRequestId = cause
    ? getStringProperty(cause, 'provider_request_id')
    : null;
  const brevoErrorCode = cause
    ? getStringProperty(cause, 'brevo_error_code')
    : null;
  const brevoErrorMessage = cause
    ? getStringProperty(cause, 'brevo_error_message')
    : null;

  const failureCode = brevoErrorCode ?? getFailureCode(error);
  const failureMessage = brevoErrorMessage ?? getFailureMessage(error);

  return {
    failureCode,
    failureMessage,
    providerStatusCode,
    providerRequestId,
    safeResponseMetadata: {
      provider: EMAIL_PROVIDER_BREVO,
      operation: 'send_transactional_email',
      notification_id: notification.id,
      event_type: notification.event_type,
      provider_status_code: providerStatusCode,
      provider_request_id: providerRequestId,
      failure_code: failureCode,
      failure_message: failureMessage,
      delivered_to_provider: false,
    },
  };
}

function createRecipientFromNotification(
  notification: EmailNotificationRow,
): EmailRecipient {
  return {
    role: notification.recipient_role,
    email: notification.recipient_email,
    name: notification.recipient_name,
    appUserId: notification.recipient_app_user_id,
  };
}

function calculateRetryAfter(attemptNumber: number, now: Date): string {
  const delayIndex = Math.min(
    Math.max(attemptNumber - 1, 0),
    RETRY_DELAYS_MS.length - 1,
  );
  const retryDelayMs = RETRY_DELAYS_MS[delayIndex];

  return new Date(now.getTime() + retryDelayMs).toISOString();
}

function createIgnoredResult(
  notification: EmailNotificationRow,
): EmailDispatchSingleResult {
  return {
    notificationId: notification.id,
    status: notification.status,
    attemptNumber: notification.attempt_count,
    provider:
      notification.provider === EMAIL_PROVIDER_BREVO
        ? EMAIL_PROVIDER_BREVO
        : null,
    providerMessageId: notification.provider_message_id,
    providerRequestId: null,
    providerStatusCode: null,
    failureCode: notification.failure_code,
    failureMessage: notification.failure_message,
    retryAfter: null,
  };
}

function createSkippedResult(input: {
  readonly notification: EmailNotificationRow;
  readonly attemptNumber: number;
  readonly failureCode: string;
  readonly failureMessage: string;
}): EmailDispatchSingleResult {
  return {
    notificationId: input.notification.id,
    status: EMAIL_NOTIFICATION_STATUS_SKIPPED,
    attemptNumber: input.attemptNumber,
    provider: EMAIL_PROVIDER_BREVO,
    providerMessageId: input.notification.provider_message_id,
    providerRequestId: null,
    providerStatusCode: null,
    failureCode: input.failureCode,
    failureMessage: input.failureMessage,
    retryAfter: null,
  };
}

function createSentResult(input: {
  readonly notification: EmailNotificationRow;
  readonly attemptNumber: number;
  readonly providerMessageId: string | null;
  readonly providerRequestId: string | null;
  readonly providerStatusCode: number | null;
}): EmailDispatchSingleResult {
  return {
    notificationId: input.notification.id,
    status: EMAIL_NOTIFICATION_STATUS_SENT,
    attemptNumber: input.attemptNumber,
    provider: EMAIL_PROVIDER_BREVO,
    providerMessageId: input.providerMessageId,
    providerRequestId: input.providerRequestId,
    providerStatusCode: input.providerStatusCode,
    failureCode: null,
    failureMessage: null,
    retryAfter: null,
  };
}

function createRetryResult(input: {
  readonly notification: EmailNotificationRow;
  readonly attemptNumber: number;
  readonly failure: DispatchFailureContext;
  readonly retryAfter: string;
}): EmailDispatchSingleResult {
  return {
    notificationId: input.notification.id,
    status: EMAIL_NOTIFICATION_STATUS_PENDING,
    attemptNumber: input.attemptNumber,
    provider: EMAIL_PROVIDER_BREVO,
    providerMessageId: null,
    providerRequestId: input.failure.providerRequestId,
    providerStatusCode: input.failure.providerStatusCode,
    failureCode: input.failure.failureCode,
    failureMessage: input.failure.failureMessage,
    retryAfter: input.retryAfter,
  };
}

function createFailedResult(input: {
  readonly notification: EmailNotificationRow;
  readonly attemptNumber: number;
  readonly failure: DispatchFailureContext;
}): EmailDispatchSingleResult {
  return {
    notificationId: input.notification.id,
    status: EMAIL_NOTIFICATION_STATUS_FAILED,
    attemptNumber: input.attemptNumber,
    provider: EMAIL_PROVIDER_BREVO,
    providerMessageId: null,
    providerRequestId: input.failure.providerRequestId,
    providerStatusCode: input.failure.providerStatusCode,
    failureCode: input.failure.failureCode,
    failureMessage: input.failure.failureMessage,
    retryAfter: null,
  };
}

function isRetryAllowed(notification: EmailNotificationRow): boolean {
  return notification.attempt_count < notification.max_attempts;
}

function getScheduledBefore(value: string | null | undefined): string {
  return normalizeOptionalString(value) ?? new Date().toISOString();
}

function getLockedBefore(value: string | null | undefined): string {
  const explicitValue = normalizeOptionalString(value);

  if (explicitValue) {
    return explicitValue;
  }

  return new Date(Date.now() - STALE_DISPATCH_LOCK_TIMEOUT_MS).toISOString();
}

@Injectable()
export class EmailDispatcherService {
  constructor(
    private readonly emailNotificationRepository: EmailNotificationRepository,
    private readonly emailDeliveryAttemptRepository: EmailDeliveryAttemptRepository,
    private readonly brevoEmailProviderService: BrevoEmailProviderService,
  ) {}

  async dispatchDueNotifications(
    input: DispatchDueEmailNotificationsInput = {},
  ): Promise<EmailDispatchBatchResult> {
    const candidates =
      await this.emailNotificationRepository.listDispatchCandidates({
        scheduledBefore: getScheduledBefore(input.scheduledBefore),
        limit: input.limit,
      });

    let sent = 0;
    let retried = 0;
    let failed = 0;
    let skipped = 0;
    let ignored = 0;

    for (const candidate of candidates) {
      const result = await this.dispatchCandidate(candidate);

      if (result.status === EMAIL_NOTIFICATION_STATUS_SENT) {
        sent += 1;
      } else if (
        result.status === EMAIL_NOTIFICATION_STATUS_PENDING &&
        result.retryAfter
      ) {
        retried += 1;
      } else if (result.status === EMAIL_NOTIFICATION_STATUS_FAILED) {
        failed += 1;
      } else if (result.status === EMAIL_NOTIFICATION_STATUS_SKIPPED) {
        skipped += 1;
      } else {
        ignored += 1;
      }
    }

    return {
      scanned: candidates.length,
      sent,
      retried,
      failed,
      skipped,
      ignored,
    };
  }

  async dispatchNotificationById(
    notificationId: string,
  ): Promise<EmailDispatchSingleResult> {
    const notification =
      await this.emailNotificationRepository.getByIdOrThrow(notificationId);

    return this.dispatchCandidate({
      notification,
      nextAttemptNumber: notification.attempt_count + 1,
    });
  }

  async resetStaleSendingNotifications(
    input: ResetStaleEmailDispatchLocksInput = {},
  ): Promise<number> {
    return this.emailNotificationRepository.resetStaleSendingNotifications({
      lockedBefore: getLockedBefore(input.lockedBefore),
    });
  }

  private async dispatchCandidate(
    candidate: EmailDispatchCandidate,
  ): Promise<EmailDispatchSingleResult> {
    if (candidate.notification.status !== EMAIL_NOTIFICATION_STATUS_PENDING) {
      return createIgnoredResult(candidate.notification);
    }

    const lockedAt = new Date().toISOString();
    const sendingNotification =
      await this.emailNotificationRepository.markSending({
        notificationId: candidate.notification.id,
        lockedBy: EMAIL_NOTIFICATION_LOCK_OWNER,
        lockedAt,
      });

    if (sendingNotification.status !== EMAIL_NOTIFICATION_STATUS_SENDING) {
      return createIgnoredResult(sendingNotification);
    }

    if (!currentEmailConfig.provider.notificationsEnabled) {
      return this.skipSendingNotification({
        notification: sendingNotification,
        failureCode: 'EMAIL_NOTIFICATIONS_DISABLED',
        failureMessage:
          'Email notification dispatch is disabled by EMAIL_NOTIFICATIONS_ENABLED=false.',
      });
    }

    if (sendingNotification.provider !== EMAIL_PROVIDER_BREVO) {
      return this.skipSendingNotification({
        notification: sendingNotification,
        failureCode: 'EMAIL_PROVIDER_UNSUPPORTED',
        failureMessage: `Email provider ${sendingNotification.provider} is not supported.`,
      });
    }

    try {
      const sendResult = await this.brevoEmailProviderService.sendEmail({
        notificationId: sendingNotification.id,
        idempotencyKey: sendingNotification.idempotency_key,
        recipient: createRecipientFromNotification(sendingNotification),
        subject: sendingNotification.subject,
        htmlContent: sendingNotification.html_content,
        textContent: sendingNotification.text_content,
        eventType: sendingNotification.event_type,
        metadata: sendingNotification.metadata,
      });

      await this.emailDeliveryAttemptRepository.createSucceededAttempt({
        emailNotificationId: sendingNotification.id,
        attemptNumber: sendingNotification.attempt_count,
        providerMessageId: sendResult.providerMessageId,
        providerRequestId: sendResult.providerRequestId,
        providerStatusCode: sendResult.providerStatusCode,
        safeResponseMetadata: sendResult.safeResponseMetadata,
      });

      const sentNotification = await this.emailNotificationRepository.markSent({
        notificationId: sendingNotification.id,
        providerMessageId: sendResult.providerMessageId,
        sentAt: new Date().toISOString(),
      });

      return createSentResult({
        notification: sentNotification,
        attemptNumber: sendingNotification.attempt_count,
        providerMessageId: sendResult.providerMessageId,
        providerRequestId: sendResult.providerRequestId,
        providerStatusCode: sendResult.providerStatusCode,
      });
    } catch (error: unknown) {
      return this.handleDispatchFailure(sendingNotification, error);
    }
  }

  private async skipSendingNotification(input: {
    readonly notification: EmailNotificationRow;
    readonly failureCode: string;
    readonly failureMessage: string;
  }): Promise<EmailDispatchSingleResult> {
    await this.emailDeliveryAttemptRepository.createSkippedAttempt({
      emailNotificationId: input.notification.id,
      attemptNumber: input.notification.attempt_count,
      errorCode: input.failureCode,
      errorMessage: input.failureMessage,
      safeResponseMetadata: {
        provider: input.notification.provider,
        operation: 'send_transactional_email',
        notification_id: input.notification.id,
        event_type: input.notification.event_type,
        skipped: true,
        failure_code: input.failureCode,
        failure_message: input.failureMessage,
      },
    });

    const skippedNotification =
      await this.emailNotificationRepository.markSkipped({
        notificationId: input.notification.id,
        skippedAt: new Date().toISOString(),
        failureCode: input.failureCode,
        failureMessage: input.failureMessage,
      });

    return createSkippedResult({
      notification: skippedNotification,
      attemptNumber: input.notification.attempt_count,
      failureCode: input.failureCode,
      failureMessage: input.failureMessage,
    });
  }

  private async handleDispatchFailure(
    notification: EmailNotificationRow,
    error: unknown,
  ): Promise<EmailDispatchSingleResult> {
    const failure = createFailureContext(notification, error);

    await this.emailDeliveryAttemptRepository.create({
      emailNotificationId: notification.id,
      attemptNumber: notification.attempt_count,
      provider: EMAIL_PROVIDER_BREVO,
      status: EMAIL_DELIVERY_ATTEMPT_STATUS_FAILED,
      providerRequestId: failure.providerRequestId,
      providerStatusCode: failure.providerStatusCode,
      errorCode: failure.failureCode,
      errorMessage: failure.failureMessage,
      safeResponseMetadata: failure.safeResponseMetadata,
    });

    if (!isRetryAllowed(notification)) {
      const failedNotification =
        await this.emailNotificationRepository.markFailed({
          notificationId: notification.id,
          failedAt: new Date().toISOString(),
          failureCode: failure.failureCode,
          failureMessage: failure.failureMessage,
        });

      return createFailedResult({
        notification: failedNotification,
        attemptNumber: notification.attempt_count,
        failure,
      });
    }

    const now = new Date();
    const retryAfter = calculateRetryAfter(notification.attempt_count, now);

    const retryableNotification =
      await this.emailNotificationRepository.markRetryable({
        notificationId: notification.id,
        retryAfter,
        updatedAt: now.toISOString(),
        failureCode: failure.failureCode,
        failureMessage: failure.failureMessage,
      });

    return createRetryResult({
      notification: retryableNotification,
      attemptNumber: notification.attempt_count,
      failure,
      retryAfter,
    });
  }
}
