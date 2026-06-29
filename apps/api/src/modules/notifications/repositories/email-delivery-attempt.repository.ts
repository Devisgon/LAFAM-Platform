// apps/api/src/modules/notifications/repositories/email-delivery-attempt.repository.ts
/**
 * LAFAM email delivery attempt repository.
 *
 * Role:
 * - Owns database access for email_delivery_attempts.
 * - Stores safe provider delivery-attempt summaries.
 * - Gives dispatcher/audit code a stable way to inspect delivery history.
 *
 * Important:
 * - This repository does not send emails.
 * - This repository does not render templates.
 * - This repository must not store Brevo API keys, raw provider payloads,
 *   raw invite tokens, passwords, OTPs, Civil ID, cookies, or secrets.
 */

import { Inject, Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { SUPABASE_ADMIN_CLIENT } from '../../../database/database.constants';
import type {
  DatabaseJsonObject,
  EmailDeliveryAttemptInsert,
  EmailDeliveryAttemptRow,
  LAFAMSupabaseClient,
} from '../../../database/database.types';
import {
  EMAIL_DELIVERY_ATTEMPT_STATUS_FAILED,
  EMAIL_DELIVERY_ATTEMPT_STATUS_SKIPPED,
  EMAIL_DELIVERY_ATTEMPT_STATUS_SUCCEEDED,
  EMAIL_NOTIFICATION_FAILURE_MESSAGE_MAX_LENGTH,
  EMAIL_PROVIDER_BREVO,
} from '../constants/notification.constants';
import type {
  EmailDeliveryAttemptCreateResult,
  EmailDeliveryAttemptInput,
} from '../types/notification.types';

const PROVIDER_MESSAGE_ID_MAX_LENGTH = 255;
const PROVIDER_REQUEST_ID_MAX_LENGTH = 255;
const ERROR_CODE_MAX_LENGTH = 100;
const MIN_PROVIDER_STATUS_CODE = 100;
const MAX_PROVIDER_STATUS_CODE = 599;

function normalizeNullableString(
  value: string | null | undefined,
  maxLength: number,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  return trimmedValue.slice(0, maxLength);
}

function normalizeProviderStatusCode(
  value: number | null | undefined,
): number | null {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < MIN_PROVIDER_STATUS_CODE ||
    value > MAX_PROVIDER_STATUS_CODE
  ) {
    return null;
  }

  return value;
}

function toEmailDeliveryAttemptInsert(
  input: EmailDeliveryAttemptInput,
): EmailDeliveryAttemptInsert {
  return {
    email_notification_id: input.emailNotificationId,
    attempt_number: input.attemptNumber,
    provider: input.provider || EMAIL_PROVIDER_BREVO,
    status: input.status,
    provider_message_id: normalizeNullableString(
      input.providerMessageId,
      PROVIDER_MESSAGE_ID_MAX_LENGTH,
    ),
    provider_request_id: normalizeNullableString(
      input.providerRequestId,
      PROVIDER_REQUEST_ID_MAX_LENGTH,
    ),
    provider_status_code: normalizeProviderStatusCode(input.providerStatusCode),
    error_code: normalizeNullableString(input.errorCode, ERROR_CODE_MAX_LENGTH),
    error_message: normalizeNullableString(
      input.errorMessage,
      EMAIL_NOTIFICATION_FAILURE_MESSAGE_MAX_LENGTH,
    ),
    safe_response_metadata: input.safeResponseMetadata ?? {},
  };
}

@Injectable()
export class EmailDeliveryAttemptRepository {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly adminClient: LAFAMSupabaseClient,
  ) {}

  async create(
    input: EmailDeliveryAttemptInput,
  ): Promise<EmailDeliveryAttemptCreateResult> {
    const insertPayload = toEmailDeliveryAttemptInsert(input);

    const { data, error } = await this.adminClient
      .from('email_delivery_attempts')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      throw AppError.databaseOperationFailed(error);
    }

    return {
      deliveryAttempt: data,
    };
  }

  async createSucceededAttempt(input: {
    readonly emailNotificationId: string;
    readonly attemptNumber: number;
    readonly providerMessageId?: string | null;
    readonly providerRequestId?: string | null;
    readonly providerStatusCode?: number | null;
    readonly safeResponseMetadata?: DatabaseJsonObject;
  }): Promise<EmailDeliveryAttemptCreateResult> {
    return this.create({
      emailNotificationId: input.emailNotificationId,
      attemptNumber: input.attemptNumber,
      provider: EMAIL_PROVIDER_BREVO,
      status: EMAIL_DELIVERY_ATTEMPT_STATUS_SUCCEEDED,
      providerMessageId: input.providerMessageId ?? null,
      providerRequestId: input.providerRequestId ?? null,
      providerStatusCode: input.providerStatusCode ?? null,
      safeResponseMetadata: input.safeResponseMetadata ?? {},
    });
  }

  async createFailedAttempt(input: {
    readonly emailNotificationId: string;
    readonly attemptNumber: number;
    readonly providerStatusCode?: number | null;
    readonly errorCode?: string | null;
    readonly errorMessage?: string | null;
    readonly safeResponseMetadata?: DatabaseJsonObject;
  }): Promise<EmailDeliveryAttemptCreateResult> {
    return this.create({
      emailNotificationId: input.emailNotificationId,
      attemptNumber: input.attemptNumber,
      provider: EMAIL_PROVIDER_BREVO,
      status: EMAIL_DELIVERY_ATTEMPT_STATUS_FAILED,
      providerStatusCode: input.providerStatusCode ?? null,
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
      safeResponseMetadata: input.safeResponseMetadata ?? {},
    });
  }

  async createSkippedAttempt(input: {
    readonly emailNotificationId: string;
    readonly attemptNumber: number;
    readonly errorCode?: string | null;
    readonly errorMessage?: string | null;
    readonly safeResponseMetadata?: DatabaseJsonObject;
  }): Promise<EmailDeliveryAttemptCreateResult> {
    return this.create({
      emailNotificationId: input.emailNotificationId,
      attemptNumber: input.attemptNumber,
      provider: EMAIL_PROVIDER_BREVO,
      status: EMAIL_DELIVERY_ATTEMPT_STATUS_SKIPPED,
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
      safeResponseMetadata: input.safeResponseMetadata ?? {},
    });
  }

  async listByNotificationId(
    emailNotificationId: string,
  ): Promise<readonly EmailDeliveryAttemptRow[]> {
    const { data, error } = await this.adminClient
      .from('email_delivery_attempts')
      .select('*')
      .eq('email_notification_id', emailNotificationId)
      .order('attempt_number', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      throw AppError.databaseOperationFailed(error);
    }

    return data ?? [];
  }

  async findLatestByNotificationId(
    emailNotificationId: string,
  ): Promise<EmailDeliveryAttemptRow | null> {
    const { data, error } = await this.adminClient
      .from('email_delivery_attempts')
      .select('*')
      .eq('email_notification_id', emailNotificationId)
      .order('attempt_number', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw AppError.databaseOperationFailed(error);
    }

    return data;
  }

  async getLatestAttemptNumber(emailNotificationId: string): Promise<number> {
    const latestAttempt =
      await this.findLatestByNotificationId(emailNotificationId);

    return latestAttempt?.attempt_number ?? 0;
  }
}
