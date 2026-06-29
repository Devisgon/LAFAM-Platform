// apps/api/src/modules/notifications/application/brevo-email-provider.service.ts
/**
 * LAFAM Brevo email provider service.
 *
 * Role:
 * - Sends already-rendered transactional emails through Brevo.
 * - Converts Brevo provider responses into safe internal result objects.
 * - Keeps Brevo API details inside the notifications module.
 *
 * Important:
 * - This service does not render templates.
 * - This service does not write email outbox records.
 * - This service must never return or persist BREVO_API_KEY.
 * - This service must never persist raw provider payloads or raw provider
 *   responses.
 */

import { Injectable } from '@nestjs/common';

import {
  currentEmailConfig,
  type BrevoEmailConfig,
} from '../../../common/config/email.config';
import { AppError } from '../../../common/errors/app-error';
import type { DatabaseJsonObject } from '../../../database/database.types';
import { EMAIL_PROVIDER_BREVO } from '../constants/notification.constants';
import type {
  BrevoEmailAddress,
  BrevoSendEmailInput,
  BrevoSendEmailResult,
  BrevoSendTransactionalEmailFailureResponse,
  BrevoSendTransactionalEmailPayload,
  BrevoSendTransactionalEmailSuccessResponse,
} from '../types/notification.types';

const BREVO_REQUEST_ID_HEADER_NAMES = [
  'x-request-id',
  'x-brevo-request-id',
  'x-sib-request-id',
  'cf-ray',
] as const;

const BREVO_RESPONSE_TEXT_MAX_LENGTH = 1_000;

interface BrevoProviderErrorCause {
  readonly provider: typeof EMAIL_PROVIDER_BREVO;
  readonly operation: 'send_transactional_email';
  readonly notification_id: string;
  readonly event_type: string;
  readonly provider_status_code?: number | null;
  readonly provider_request_id?: string | null;
  readonly brevo_error_code?: string | null;
  readonly brevo_error_message?: string | null;
}

function removeTrailingSlashes(value: string): string {
  return value.replace(/\/+$/u, '');
}

function normalizePath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

function createBrevoSendEmailUrl(config: BrevoEmailConfig): string {
  return `${removeTrailingSlashes(config.apiBaseUrl)}${normalizePath(
    config.sendTransactionalEmailPath,
  )}`;
}

function normalizeOptionalString(
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function createBrevoEmailAddress(
  email: string,
  name?: string | null,
): BrevoEmailAddress {
  const normalizedName = normalizeOptionalString(name);

  if (!normalizedName) {
    return {
      email,
    };
  }

  return {
    email,
    name: normalizedName,
  };
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

  const trimmedValue = propertyValue.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function parseBrevoSuccessResponse(
  value: unknown,
): BrevoSendTransactionalEmailSuccessResponse {
  if (!isRecord(value)) {
    return {};
  }

  const messageId = getStringProperty(value, 'messageId');

  return messageId ? { messageId } : {};
}

function parseBrevoFailureResponse(
  value: unknown,
): BrevoSendTransactionalEmailFailureResponse {
  if (!isRecord(value)) {
    return {};
  }

  const code = getStringProperty(value, 'code');
  const message = getStringProperty(value, 'message');

  return {
    ...(code ? { code } : {}),
    ...(message ? { message } : {}),
  };
}

async function readBrevoResponseBody(response: Response): Promise<unknown> {
  const responseText = await response.text();

  if (!responseText) {
    return null;
  }

  try {
    const parsedBody: unknown = JSON.parse(responseText);

    return parsedBody;
  } catch {
    return responseText.slice(0, BREVO_RESPONSE_TEXT_MAX_LENGTH);
  }
}

function getProviderRequestId(response: Response): string | null {
  for (const headerName of BREVO_REQUEST_ID_HEADER_NAMES) {
    const headerValue = normalizeOptionalString(
      response.headers.get(headerName),
    );

    if (headerValue) {
      return headerValue;
    }
  }

  return null;
}

function createSafeSuccessMetadata(input: {
  readonly notificationId: string;
  readonly eventType: string;
  readonly providerStatusCode: number;
  readonly providerRequestId: string | null;
  readonly providerMessageId: string | null;
}): DatabaseJsonObject {
  return {
    provider: EMAIL_PROVIDER_BREVO,
    operation: 'send_transactional_email',
    notification_id: input.notificationId,
    event_type: input.eventType,
    provider_status_code: input.providerStatusCode,
    provider_request_id: input.providerRequestId,
    provider_message_id: input.providerMessageId,
    delivered_to_provider: true,
  };
}

function createSafeFailureMetadata(input: {
  readonly notificationId: string;
  readonly eventType: string;
  readonly providerStatusCode: number | null;
  readonly providerRequestId: string | null;
  readonly brevoErrorCode: string | null;
  readonly brevoErrorMessage: string | null;
}): DatabaseJsonObject {
  return {
    provider: EMAIL_PROVIDER_BREVO,
    operation: 'send_transactional_email',
    notification_id: input.notificationId,
    event_type: input.eventType,
    provider_status_code: input.providerStatusCode,
    provider_request_id: input.providerRequestId,
    brevo_error_code: input.brevoErrorCode,
    brevo_error_message: input.brevoErrorMessage,
    delivered_to_provider: false,
  };
}

function createBrevoPayload(
  input: BrevoSendEmailInput,
  config: BrevoEmailConfig,
): BrevoSendTransactionalEmailPayload {
  return {
    sender: createBrevoEmailAddress(config.senderEmail, config.senderName),
    to: [createBrevoEmailAddress(input.recipient.email, input.recipient.name)],
    subject: input.subject,
    htmlContent: input.htmlContent,
    textContent: input.textContent,
    tags: [EMAIL_PROVIDER_BREVO, input.eventType],
  };
}

function assertBrevoConfigured(
  config: BrevoEmailConfig,
  input: BrevoSendEmailInput,
): void {
  if (
    normalizeOptionalString(config.apiKey) &&
    normalizeOptionalString(config.senderEmail)
  ) {
    return;
  }

  throw AppError.emailProviderUnavailable({
    provider: EMAIL_PROVIDER_BREVO,
    operation: 'send_transactional_email',
    notification_id: input.notificationId,
    event_type: input.eventType,
    reason:
      'Brevo API key and sender email must be configured before dispatching email.',
  });
}

@Injectable()
export class BrevoEmailProviderService {
  async sendEmail(input: BrevoSendEmailInput): Promise<BrevoSendEmailResult> {
    const config = currentEmailConfig.brevo;

    assertBrevoConfigured(config, input);

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, config.requestTimeoutMs);

    const url = createBrevoSendEmailUrl(config);
    const payload = createBrevoPayload(input, config);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'api-key': config.apiKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const responseBody = await readBrevoResponseBody(response);
      const providerRequestId = getProviderRequestId(response);

      if (!response.ok) {
        const failureResponse = parseBrevoFailureResponse(responseBody);
        const failureMetadata = createSafeFailureMetadata({
          notificationId: input.notificationId,
          eventType: input.eventType,
          providerStatusCode: response.status,
          providerRequestId,
          brevoErrorCode: failureResponse.code ?? null,
          brevoErrorMessage: failureResponse.message ?? null,
        });

        throw AppError.emailNotificationDispatchFailed({
          provider: EMAIL_PROVIDER_BREVO,
          operation: 'send_transactional_email',
          notification_id: input.notificationId,
          event_type: input.eventType,
          provider_status_code: response.status,
          provider_request_id: providerRequestId,
          brevo_error_code: failureResponse.code ?? null,
          brevo_error_message: failureResponse.message ?? null,
          safe_response_metadata: failureMetadata,
        } satisfies BrevoProviderErrorCause & {
          readonly safe_response_metadata: DatabaseJsonObject;
        });
      }

      const successResponse = parseBrevoSuccessResponse(responseBody);
      const providerMessageId = successResponse.messageId ?? null;

      return {
        provider: EMAIL_PROVIDER_BREVO,
        providerMessageId,
        providerRequestId,
        providerStatusCode: response.status,
        safeResponseMetadata: createSafeSuccessMetadata({
          notificationId: input.notificationId,
          eventType: input.eventType,
          providerStatusCode: response.status,
          providerRequestId,
          providerMessageId,
        }),
      };
    } catch (error: unknown) {
      if (error instanceof AppError) {
        throw error;
      }

      throw AppError.emailProviderUnavailable({
        provider: EMAIL_PROVIDER_BREVO,
        operation: 'send_transactional_email',
        notification_id: input.notificationId,
        event_type: input.eventType,
        cause_name: error instanceof Error ? error.name : null,
        cause_message: error instanceof Error ? error.message : null,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
