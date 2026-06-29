// apps/api/src/common/config/email.config.ts
/**
 * LAFAM API email configuration.
 *
 * Role:
 * - Exposes notification/email runtime configuration.
 * - Converts the validated environment into a focused email config object.
 * - Keeps Brevo provider credentials and customer-invite URL settings outside business logic.
 *
 * Important:
 * - This file does not validate raw environment values directly.
 * - Validation is owned by env.validation.ts.
 * - BREVO_API_KEY is server-only and must never be logged or returned in API responses.
 * - Raw invite tokens must never be logged.
 * - Email services should consume this config instead of reading process.env.
 */

import { validateEnvironment, type EnvironmentInput } from './env.validation';
import type { EmailProvider } from './environment.contract';

export interface EmailProviderConfig {
  readonly notificationsEnabled: boolean;
  readonly provider: EmailProvider;
  readonly outboxEnabled: boolean;
  readonly defaultLocale: string;
  readonly publicAppBaseUrl: string;
}

export interface CustomerInviteEmailConfig {
  readonly tokenTtlHours: number;
  readonly expiringSoonHours: number;
  readonly acceptPath: string;
  readonly acceptUrlBase: string;
}

export interface BrevoEmailConfig {
  readonly apiKey: string;
  readonly senderEmail: string;
  readonly senderName: string;
  readonly apiBaseUrl: string;
  readonly sendTransactionalEmailPath: string;
  readonly requestTimeoutMs: number;
}

export interface EmailConfig {
  readonly provider: EmailProviderConfig;
  readonly customerInvite: CustomerInviteEmailConfig;
  readonly brevo: BrevoEmailConfig;
}

const BREVO_API_BASE_URL = 'https://api.brevo.com/v3';
const BREVO_SEND_TRANSACTIONAL_EMAIL_PATH = '/smtp/email';
const BREVO_REQUEST_TIMEOUT_MS = 10_000;

const CUSTOMER_INVITE_ACCEPT_PATH = '/auth/customer-invite';

function removeTrailingSlashes(value: string): string {
  return value.replace(/\/+$/u, '');
}

function joinUrlPath(baseUrl: string, path: string): string {
  const normalizedBaseUrl = removeTrailingSlashes(baseUrl);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${normalizedBaseUrl}${normalizedPath}`;
}

export function createEmailConfig(
  environment: EnvironmentInput = process.env,
): EmailConfig {
  const validatedEnvironment = validateEnvironment(environment);
  const { email, brevo } = validatedEnvironment;

  const publicAppBaseUrl = removeTrailingSlashes(email.publicAppBaseUrl);

  return {
    provider: {
      notificationsEnabled: email.notificationsEnabled,
      provider: email.provider,
      outboxEnabled: email.outboxEnabled,
      defaultLocale: email.defaultLocale,
      publicAppBaseUrl,
    },
    customerInvite: {
      tokenTtlHours: email.customerInviteTokenTtlHours,
      expiringSoonHours: email.customerInviteExpiringSoonHours,
      acceptPath: CUSTOMER_INVITE_ACCEPT_PATH,
      acceptUrlBase: joinUrlPath(publicAppBaseUrl, CUSTOMER_INVITE_ACCEPT_PATH),
    },
    brevo: {
      apiKey: brevo.apiKey,
      senderEmail: brevo.senderEmail,
      senderName: brevo.senderName,
      apiBaseUrl: BREVO_API_BASE_URL,
      sendTransactionalEmailPath: BREVO_SEND_TRANSACTIONAL_EMAIL_PATH,
      requestTimeoutMs: BREVO_REQUEST_TIMEOUT_MS,
    },
  };
}

export const currentEmailConfig = createEmailConfig();
