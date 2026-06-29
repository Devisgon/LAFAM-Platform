// apps/api/src/modules/notifications/application/email-notification.service.ts
/**
 * LAFAM email notification service.
 *
 * Role:
 * - Provides the application-level API for creating email notification outbox records.
 * - Validates recipient routing before persistence.
 * - Renders templates when feature modules provide event/template data.
 * - Enforces safe metadata rules before anything is written to the database.
 *
 * Important:
 * - This service does not send emails.
 * - This service does not call Brevo directly.
 * - This service does not store raw invite tokens, passwords, OTPs, Civil ID,
 *   cookies, provider secrets, or raw provider payloads.
 * - Feature modules should call this service instead of repositories directly.
 */

import { Injectable } from '@nestjs/common';

import { currentEmailConfig } from '../../../common/config/email.config';
import { AppError } from '../../../common/errors/app-error';
import type {
  DatabaseJson,
  DatabaseJsonObject,
} from '../../../database/database.types';
import {
  EMAIL_NOTIFICATION_HTML_CONTENT_MAX_LENGTH,
  EMAIL_NOTIFICATION_IDEMPOTENCY_KEY_MAX_LENGTH,
  EMAIL_NOTIFICATION_SAFE_METADATA_FORBIDDEN_KEYS,
  EMAIL_NOTIFICATION_STATUS_PENDING,
  EMAIL_NOTIFICATION_STATUS_SKIPPED,
  EMAIL_NOTIFICATION_SUBJECT_MAX_LENGTH,
  EMAIL_NOTIFICATION_TEXT_CONTENT_MAX_LENGTH,
  EMAIL_PROVIDER_BREVO,
} from '../constants/notification.constants';
import {
  createEmailIdempotencyKey,
  isEmailIdempotencyKeyValid,
} from '../domain/email-idempotency.policy';
import { assertValidEmailRecipient } from '../domain/email-recipient.policy';
import { EmailNotificationRepository } from '../repositories/email-notification.repository';
import type {
  CreateEmailNotificationInput,
  EmailNotificationEntityReference,
  EmailNotificationEvent,
  EmailNotificationStatus,
  EmailOutboxCreateResult,
  EmailProviderName,
  EmailRecipient,
} from '../types/notification.types';
import { EmailTemplateRendererService } from './email-template-renderer.service';

export interface CreateTemplatedEmailNotificationInput {
  readonly eventType: EmailNotificationEvent;
  readonly recipient: EmailRecipient;
  readonly templateData: DatabaseJsonObject;
  readonly locale?: string | null;
  readonly provider?: EmailProviderName;
  readonly entity?: EmailNotificationEntityReference | null;
  readonly idempotencyKey?: string | null;
  readonly scheduledFor?: string | null;
  readonly maxAttempts?: number;
  readonly metadata?: DatabaseJsonObject;
}

const FORBIDDEN_METADATA_KEY_SET = new Set(
  EMAIL_NOTIFICATION_SAFE_METADATA_FORBIDDEN_KEYS.map((key) =>
    key.toLowerCase(),
  ),
);

const DEFAULT_DISABLED_METADATA: DatabaseJsonObject = {
  notification_dispatch_disabled: true,
  notification_dispatch_disabled_reason: 'EMAIL_NOTIFICATIONS_ENABLED=false',
};

function normalizeOptionalString(
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function normalizeLocale(value: string | null | undefined): string {
  return (
    normalizeOptionalString(value) ?? currentEmailConfig.provider.defaultLocale
  );
}

function normalizeScheduledFor(
  value: string | null | undefined,
): string | null {
  return normalizeOptionalString(value);
}

function normalizeProvider(
  value: EmailProviderName | undefined,
): EmailProviderName {
  return value ?? EMAIL_PROVIDER_BREVO;
}

function isDatabaseJsonObject(
  value: DatabaseJson | undefined,
): value is DatabaseJsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeJsonValue(
  value: DatabaseJson | undefined,
): DatabaseJson | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeJsonValue(item))
      .filter((item): item is DatabaseJson => typeof item !== 'undefined');
  }

  if (isDatabaseJsonObject(value)) {
    return sanitizeJsonObject(value);
  }

  return value;
}

function sanitizeJsonObject(value: DatabaseJsonObject): DatabaseJsonObject {
  const sanitizedValue: DatabaseJsonObject = {};

  for (const [key, item] of Object.entries(value)) {
    const sanitizedItem = sanitizeJsonValue(item);

    if (typeof sanitizedItem !== 'undefined') {
      sanitizedValue[key] = sanitizedItem;
    }
  }

  return sanitizedValue;
}

function collectForbiddenMetadataKeysFromValue(
  value: DatabaseJson | undefined,
  path: string,
): readonly string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectForbiddenMetadataKeysFromValue(item, `${path}[${index}]`),
    );
  }

  if (!isDatabaseJsonObject(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, item]) => {
    const currentPath = `${path}.${key}`;
    const matchedKeys = FORBIDDEN_METADATA_KEY_SET.has(key.toLowerCase())
      ? [currentPath]
      : [];

    return [
      ...matchedKeys,
      ...collectForbiddenMetadataKeysFromValue(item, currentPath),
    ];
  });
}

function assertSafeEmailMetadata(
  metadata: DatabaseJsonObject,
): DatabaseJsonObject {
  const sanitizedMetadata = sanitizeJsonObject(metadata);
  const forbiddenKeys = collectForbiddenMetadataKeysFromValue(
    sanitizedMetadata,
    'metadata',
  );

  if (forbiddenKeys.length > 0) {
    throw AppError.validationFailed(
      'Email notification metadata contains forbidden sensitive fields.',
      {
        forbiddenKeys,
      },
    );
  }

  return sanitizedMetadata;
}

function mergeMetadata(
  baseMetadata: DatabaseJsonObject,
  extraMetadata: DatabaseJsonObject,
): DatabaseJsonObject {
  return assertSafeEmailMetadata({
    ...baseMetadata,
    ...extraMetadata,
  });
}

function assertContentLength(input: {
  readonly fieldName: string;
  readonly value: string;
  readonly maxLength: number;
}): void {
  if (input.value.length <= input.maxLength) {
    return;
  }

  throw AppError.validationFailed(
    `Email notification ${input.fieldName} is too long.`,
    {
      fieldName: input.fieldName,
      maxLength: input.maxLength,
      actualLength: input.value.length,
    },
  );
}

function assertValidEmailContent(input: CreateEmailNotificationInput): void {
  const subject = normalizeOptionalString(input.content.subject);
  const htmlContent = normalizeOptionalString(input.content.htmlContent);
  const textContent = normalizeOptionalString(input.content.textContent);

  if (!subject || !htmlContent || !textContent) {
    throw AppError.validationFailed(
      'Email notification subject, HTML content, and text content are required.',
      {
        eventType: input.eventType,
      },
    );
  }

  assertContentLength({
    fieldName: 'subject',
    value: subject,
    maxLength: EMAIL_NOTIFICATION_SUBJECT_MAX_LENGTH,
  });
  assertContentLength({
    fieldName: 'htmlContent',
    value: htmlContent,
    maxLength: EMAIL_NOTIFICATION_HTML_CONTENT_MAX_LENGTH,
  });
  assertContentLength({
    fieldName: 'textContent',
    value: textContent,
    maxLength: EMAIL_NOTIFICATION_TEXT_CONTENT_MAX_LENGTH,
  });
}

function normalizeIdempotencyKey(
  idempotencyKey: string | null | undefined,
): string | null {
  const normalizedIdempotencyKey = normalizeOptionalString(idempotencyKey);

  if (!normalizedIdempotencyKey) {
    return null;
  }

  if (isEmailIdempotencyKeyValid(normalizedIdempotencyKey)) {
    return normalizedIdempotencyKey;
  }

  throw AppError.validationFailed(
    `Email notification idempotency key must be ${EMAIL_NOTIFICATION_IDEMPOTENCY_KEY_MAX_LENGTH} characters or fewer.`,
    {
      maxLength: EMAIL_NOTIFICATION_IDEMPOTENCY_KEY_MAX_LENGTH,
    },
  );
}

function resolveIdempotencyKey(input: {
  readonly eventType: EmailNotificationEvent;
  readonly recipient: EmailRecipient;
  readonly entity?: EmailNotificationEntityReference | null;
  readonly idempotencyKey?: string | null;
}): string | null {
  const explicitIdempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);

  if (explicitIdempotencyKey) {
    return explicitIdempotencyKey;
  }

  if (!input.entity) {
    return null;
  }

  return createEmailIdempotencyKey({
    eventType: input.eventType,
    recipient: input.recipient,
    entity: input.entity,
  });
}

function resolveInitialNotificationStatus(): EmailNotificationStatus {
  return currentEmailConfig.provider.notificationsEnabled
    ? EMAIL_NOTIFICATION_STATUS_PENDING
    : EMAIL_NOTIFICATION_STATUS_SKIPPED;
}

function resolveMetadata(input: {
  readonly metadata?: DatabaseJsonObject;
}): DatabaseJsonObject {
  const safeMetadata = assertSafeEmailMetadata(input.metadata ?? {});

  if (currentEmailConfig.provider.notificationsEnabled) {
    return safeMetadata;
  }

  return mergeMetadata(safeMetadata, DEFAULT_DISABLED_METADATA);
}

@Injectable()
export class EmailNotificationService {
  constructor(
    private readonly emailNotificationRepository: EmailNotificationRepository,
    private readonly emailTemplateRendererService: EmailTemplateRendererService,
  ) {}

  async createFromTemplate(
    input: CreateTemplatedEmailNotificationInput,
  ): Promise<EmailOutboxCreateResult | null> {
    const normalizedRecipient = assertValidEmailRecipient(
      input.eventType,
      input.recipient,
    );

    const renderedTemplate = this.emailTemplateRendererService.render({
      eventType: input.eventType,
      recipient: normalizedRecipient,
      templateData: input.templateData,
      locale: normalizeLocale(input.locale),
    });

    return this.create({
      eventType: input.eventType,
      recipient: normalizedRecipient,
      content: {
        subject: renderedTemplate.subject,
        htmlContent: renderedTemplate.htmlContent,
        textContent: renderedTemplate.textContent,
      },
      provider: input.provider,
      entity: input.entity ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      scheduledFor: input.scheduledFor ?? null,
      maxAttempts: input.maxAttempts,
      metadata: input.metadata ?? {},
    });
  }

  async create(
    input: CreateEmailNotificationInput,
  ): Promise<EmailOutboxCreateResult | null> {
    if (!currentEmailConfig.provider.outboxEnabled) {
      return null;
    }

    const normalizedRecipient = assertValidEmailRecipient(
      input.eventType,
      input.recipient,
    );

    assertValidEmailContent(input);

    const idempotencyKey = resolveIdempotencyKey({
      eventType: input.eventType,
      recipient: normalizedRecipient,
      entity: input.entity ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
    });

    return this.emailNotificationRepository.create({
      eventType: input.eventType,
      recipientRole: normalizedRecipient.role,
      recipientAppUserId: normalizedRecipient.appUserId ?? null,
      recipientEmail: normalizedRecipient.email,
      recipientName: normalizedRecipient.name ?? null,
      subject: input.content.subject.trim(),
      htmlContent: input.content.htmlContent.trim(),
      textContent: input.content.textContent.trim(),
      status: resolveInitialNotificationStatus(),
      provider: normalizeProvider(input.provider),
      entityType: input.entity?.entityType ?? null,
      entityId: input.entity?.entityId ?? null,
      idempotencyKey,
      scheduledFor: normalizeScheduledFor(input.scheduledFor),
      maxAttempts: input.maxAttempts,
      metadata: resolveMetadata({
        metadata: input.metadata,
      }),
    });
  }
}
