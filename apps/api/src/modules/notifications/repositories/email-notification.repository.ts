// apps/api/src/modules/notifications/repositories/email-notification.repository.ts
/**
 * LAFAM email notification repository.
 *
 * Role:
 * - Owns database access for email_notifications.
 * - Creates outbox records.
 * - Reads dispatch candidates.
 * - Updates email notification delivery state.
 *
 * Important:
 * - This repository does not send emails.
 * - This repository does not render templates.
 * - This repository must not store raw invite tokens, passwords, OTPs, Civil ID,
 *   cookies, provider secrets, or raw provider payloads in metadata.
 * - Feature modules must not write email_notifications directly.
 */

import { Inject, Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { SUPABASE_ADMIN_CLIENT } from '../../../database/database.constants';
import type {
  EmailNotificationInsert,
  EmailNotificationRow,
  EmailNotificationUpdate,
  LAFAMSupabaseClient,
} from '../../../database/database.types';
import {
  EMAIL_NOTIFICATION_DEFAULT_MAX_ATTEMPTS,
  EMAIL_NOTIFICATION_FAILURE_MESSAGE_MAX_LENGTH,
  EMAIL_NOTIFICATION_LOCK_OWNER,
  EMAIL_NOTIFICATION_MAX_MAX_ATTEMPTS,
  EMAIL_NOTIFICATION_MIN_MAX_ATTEMPTS,
  EMAIL_NOTIFICATION_STATUS_CANCELLED,
  EMAIL_NOTIFICATION_STATUS_FAILED,
  EMAIL_NOTIFICATION_STATUS_PENDING,
  EMAIL_NOTIFICATION_STATUS_SENT,
  EMAIL_NOTIFICATION_STATUS_SENDING,
  EMAIL_NOTIFICATION_STATUS_SKIPPED,
  EMAIL_PROVIDER_BREVO,
} from '../constants/notification.constants';
import type {
  CreateEmailNotificationRecordInput,
  EmailDispatchCandidate,
  EmailNotificationMarkCancelledInput,
  EmailNotificationMarkFailedInput,
  EmailNotificationMarkRetryableInput,
  EmailNotificationMarkSendingInput,
  EmailNotificationMarkSentInput,
  EmailNotificationMarkSkippedInput,
  EmailOutboxCreateResult,
} from '../types/notification.types';

const POSTGRES_UNIQUE_VIOLATION_CODE = '23505';

const DEFAULT_DISPATCH_CANDIDATE_LIMIT = 50;
const MAX_DISPATCH_CANDIDATE_LIMIT = 200;

interface DatabaseErrorLike {
  readonly code?: string;
  readonly message?: string;
}

export interface ListEmailDispatchCandidatesInput {
  readonly scheduledBefore: string;
  readonly limit?: number;
}

function isDatabaseError(value: unknown): value is DatabaseErrorLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    ('code' in value || 'message' in value)
  );
}

function isUniqueViolationError(value: unknown): boolean {
  return (
    isDatabaseError(value) && value.code === POSTGRES_UNIQUE_VIOLATION_CODE
  );
}

function normalizeLimit(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
    return DEFAULT_DISPATCH_CANDIDATE_LIMIT;
  }

  return Math.min(Math.floor(value), MAX_DISPATCH_CANDIDATE_LIMIT);
}

function normalizeMaxAttempts(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return EMAIL_NOTIFICATION_DEFAULT_MAX_ATTEMPTS;
  }

  return Math.min(
    Math.max(Math.floor(value), EMAIL_NOTIFICATION_MIN_MAX_ATTEMPTS),
    EMAIL_NOTIFICATION_MAX_MAX_ATTEMPTS,
  );
}

function normalizeNullableString(
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function truncateFailureMessage(
  value: string | null | undefined,
): string | null {
  const normalizedValue = normalizeNullableString(value);

  if (!normalizedValue) {
    return null;
  }

  return normalizedValue.slice(
    0,
    EMAIL_NOTIFICATION_FAILURE_MESSAGE_MAX_LENGTH,
  );
}

function assertEmailNotificationRow(
  row: EmailNotificationRow | null,
  details?: Record<string, unknown>,
): EmailNotificationRow {
  if (!row) {
    throw AppError.emailNotificationNotFound(
      'The requested email notification was not found.',
      details,
    );
  }

  return row;
}

function toEmailNotificationInsert(
  input: CreateEmailNotificationRecordInput,
): EmailNotificationInsert {
  return {
    event_type: input.eventType,
    recipient_role: input.recipientRole,
    recipient_app_user_id: input.recipientAppUserId ?? null,
    recipient_email: input.recipientEmail,
    recipient_name: input.recipientName ?? null,
    subject: input.subject,
    html_content: input.htmlContent,
    text_content: input.textContent,
    status: input.status ?? EMAIL_NOTIFICATION_STATUS_PENDING,
    provider: input.provider ?? EMAIL_PROVIDER_BREVO,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    idempotency_key: input.idempotencyKey ?? null,
    scheduled_for: input.scheduledFor ?? new Date().toISOString(),
    max_attempts: normalizeMaxAttempts(input.maxAttempts),
    metadata: input.metadata ?? {},
  };
}

@Injectable()
export class EmailNotificationRepository {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly adminClient: LAFAMSupabaseClient,
  ) {}

  async create(
    input: CreateEmailNotificationRecordInput,
  ): Promise<EmailOutboxCreateResult> {
    if (input.idempotencyKey) {
      const existingNotification = await this.findByIdempotencyKey(
        input.idempotencyKey,
      );

      if (existingNotification) {
        return {
          notification: existingNotification,
          wasCreated: false,
        };
      }
    }

    const insertPayload = toEmailNotificationInsert(input);

    const { data, error } = await this.adminClient
      .from('email_notifications')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      if (input.idempotencyKey && isUniqueViolationError(error)) {
        const existingNotification = await this.findByIdempotencyKey(
          input.idempotencyKey,
        );

        if (existingNotification) {
          return {
            notification: existingNotification,
            wasCreated: false,
          };
        }
      }

      throw AppError.emailNotificationCreateFailed(error);
    }

    return {
      notification: data,
      wasCreated: true,
    };
  }

  async findById(notificationId: string): Promise<EmailNotificationRow | null> {
    const { data, error } = await this.adminClient
      .from('email_notifications')
      .select('*')
      .eq('id', notificationId)
      .maybeSingle();

    if (error) {
      throw AppError.databaseOperationFailed(error);
    }

    return data;
  }

  async getByIdOrThrow(notificationId: string): Promise<EmailNotificationRow> {
    const notification = await this.findById(notificationId);

    return assertEmailNotificationRow(notification, {
      notification_id: notificationId,
    });
  }

  async findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<EmailNotificationRow | null> {
    const normalizedIdempotencyKey = normalizeNullableString(idempotencyKey);

    if (!normalizedIdempotencyKey) {
      return null;
    }

    const { data, error } = await this.adminClient
      .from('email_notifications')
      .select('*')
      .eq('idempotency_key', normalizedIdempotencyKey)
      .maybeSingle();

    if (error) {
      throw AppError.databaseOperationFailed(error);
    }

    return data;
  }

  async listDispatchCandidates(
    input: ListEmailDispatchCandidatesInput,
  ): Promise<readonly EmailDispatchCandidate[]> {
    const limit = normalizeLimit(input.limit);

    const { data, error } = await this.adminClient
      .from('email_notifications')
      .select('*')
      .eq('status', EMAIL_NOTIFICATION_STATUS_PENDING)
      .lte('scheduled_for', input.scheduledBefore)
      .order('scheduled_for', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw AppError.databaseOperationFailed(error);
    }

    return (data ?? [])
      .filter(
        (notification) =>
          notification.attempt_count < notification.max_attempts,
      )
      .map((notification) => ({
        notification,
        nextAttemptNumber: notification.attempt_count + 1,
      }));
  }

  async markSending(
    input: EmailNotificationMarkSendingInput,
  ): Promise<EmailNotificationRow> {
    const currentNotification = await this.getByIdOrThrow(input.notificationId);

    if (currentNotification.status !== EMAIL_NOTIFICATION_STATUS_PENDING) {
      return currentNotification;
    }

    if (currentNotification.attempt_count >= currentNotification.max_attempts) {
      return this.markSkipped({
        notificationId: input.notificationId,
        skippedAt: input.lockedAt,
        failureCode: 'MAX_ATTEMPTS_REACHED',
        failureMessage: 'Email notification reached the maximum attempt count.',
      });
    }

    const updatePayload: EmailNotificationUpdate = {
      status: EMAIL_NOTIFICATION_STATUS_SENDING,
      locked_at: input.lockedAt,
      locked_by: input.lockedBy || EMAIL_NOTIFICATION_LOCK_OWNER,
      attempt_count: currentNotification.attempt_count + 1,
      updated_at: input.lockedAt,
    };

    const { data, error } = await this.adminClient
      .from('email_notifications')
      .update(updatePayload)
      .eq('id', input.notificationId)
      .eq('status', EMAIL_NOTIFICATION_STATUS_PENDING)
      .select('*')
      .maybeSingle();

    if (error) {
      throw AppError.databaseOperationFailed(error);
    }

    return assertEmailNotificationRow(data, {
      notification_id: input.notificationId,
    });
  }

  async markSent(
    input: EmailNotificationMarkSentInput,
  ): Promise<EmailNotificationRow> {
    const updatePayload: EmailNotificationUpdate = {
      status: EMAIL_NOTIFICATION_STATUS_SENT,
      sent_at: input.sentAt,
      failed_at: null,
      skipped_at: null,
      cancelled_at: null,
      locked_at: null,
      locked_by: null,
      provider_message_id: input.providerMessageId ?? null,
      failure_code: null,
      failure_message: null,
      updated_at: input.sentAt,
    };

    const { data, error } = await this.adminClient
      .from('email_notifications')
      .update(updatePayload)
      .eq('id', input.notificationId)
      .select('*')
      .maybeSingle();

    if (error) {
      throw AppError.databaseOperationFailed(error);
    }

    return assertEmailNotificationRow(data, {
      notification_id: input.notificationId,
    });
  }

  async markFailed(
    input: EmailNotificationMarkFailedInput,
  ): Promise<EmailNotificationRow> {
    const updatePayload: EmailNotificationUpdate = {
      status: EMAIL_NOTIFICATION_STATUS_FAILED,
      failed_at: input.failedAt,
      locked_at: null,
      locked_by: null,
      failure_code: normalizeNullableString(input.failureCode),
      failure_message: truncateFailureMessage(input.failureMessage),
      updated_at: input.failedAt,
    };

    const { data, error } = await this.adminClient
      .from('email_notifications')
      .update(updatePayload)
      .eq('id', input.notificationId)
      .select('*')
      .maybeSingle();

    if (error) {
      throw AppError.databaseOperationFailed(error);
    }

    return assertEmailNotificationRow(data, {
      notification_id: input.notificationId,
    });
  }

  async markRetryable(
    input: EmailNotificationMarkRetryableInput,
  ): Promise<EmailNotificationRow> {
    const updatePayload: EmailNotificationUpdate = {
      status: EMAIL_NOTIFICATION_STATUS_PENDING,
      failed_at: null,
      locked_at: null,
      locked_by: null,
      failure_code: normalizeNullableString(input.failureCode),
      failure_message: truncateFailureMessage(input.failureMessage),
      scheduled_for: input.retryAfter,
      updated_at: input.updatedAt,
    };

    const { data, error } = await this.adminClient
      .from('email_notifications')
      .update(updatePayload)
      .eq('id', input.notificationId)
      .select('*')
      .maybeSingle();

    if (error) {
      throw AppError.databaseOperationFailed(error);
    }

    return assertEmailNotificationRow(data, {
      notification_id: input.notificationId,
    });
  }

  async markSkipped(
    input: EmailNotificationMarkSkippedInput,
  ): Promise<EmailNotificationRow> {
    const updatePayload: EmailNotificationUpdate = {
      status: EMAIL_NOTIFICATION_STATUS_SKIPPED,
      skipped_at: input.skippedAt,
      locked_at: null,
      locked_by: null,
      failure_code: normalizeNullableString(input.failureCode),
      failure_message: truncateFailureMessage(input.failureMessage),
      updated_at: input.skippedAt,
    };

    const { data, error } = await this.adminClient
      .from('email_notifications')
      .update(updatePayload)
      .eq('id', input.notificationId)
      .select('*')
      .maybeSingle();

    if (error) {
      throw AppError.databaseOperationFailed(error);
    }

    return assertEmailNotificationRow(data, {
      notification_id: input.notificationId,
    });
  }

  async markCancelled(
    input: EmailNotificationMarkCancelledInput,
  ): Promise<EmailNotificationRow> {
    const updatePayload: EmailNotificationUpdate = {
      status: EMAIL_NOTIFICATION_STATUS_CANCELLED,
      cancelled_at: input.cancelledAt,
      locked_at: null,
      locked_by: null,
      failure_code: normalizeNullableString(input.failureCode),
      failure_message: truncateFailureMessage(input.failureMessage),
      updated_at: input.cancelledAt,
    };

    const { data, error } = await this.adminClient
      .from('email_notifications')
      .update(updatePayload)
      .eq('id', input.notificationId)
      .select('*')
      .maybeSingle();

    if (error) {
      throw AppError.databaseOperationFailed(error);
    }

    return assertEmailNotificationRow(data, {
      notification_id: input.notificationId,
    });
  }

  async resetStaleSendingNotifications(input: {
    readonly lockedBefore: string;
  }): Promise<number> {
    const updatePayload: EmailNotificationUpdate = {
      status: EMAIL_NOTIFICATION_STATUS_PENDING,
      locked_at: null,
      locked_by: null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.adminClient
      .from('email_notifications')
      .update(updatePayload)
      .eq('status', EMAIL_NOTIFICATION_STATUS_SENDING)
      .lt('locked_at', input.lockedBefore)
      .select('id');

    if (error) {
      throw AppError.databaseOperationFailed(error);
    }

    return data?.length ?? 0;
  }
}
