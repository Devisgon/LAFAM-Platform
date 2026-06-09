// apps/api/src/common/config/env.validation.ts
/**
 * LAFAM API environment validation.
 *
 * Role:
 * - Reads raw environment values.
 * - Validates required API runtime configuration.
 * - Converts string values into safe typed values.
 * - Returns one validated environment object for config files to consume.
 *
 * Important:
 * - This file is framework-independent.
 * - It does not depend on @nestjs/config.
 * - It does not log environment values.
 * - Sensitive values must never be printed in validation errors.
 */

import {
  NODE_ENV_VALUES,
  type EnvironmentVariableName,
  type NodeEnvironment,
  type RawEnvironment,
  type ValidatedEnvironment,
} from './environment.contract';

export type EnvironmentInput = NodeJS.ProcessEnv | RawEnvironment;

const DEFAULT_NODE_ENV: NodeEnvironment = 'development';
const DEFAULT_PORT = 4000;
const DEFAULT_API_GLOBAL_PREFIX = 'api';
const DEFAULT_SENTRY_ENVIRONMENT = 'development';
const DEFAULT_SENTRY_TRACES_SAMPLE_RATE = 0.1;
const DEFAULT_JWT_CLOCK_TOLERANCE_SECONDS = 30;
const DEFAULT_REQUEST_BODY_LIMIT = '1mb';

const DEFAULT_AUTH_RESET_TOKEN_TTL_MINUTES = 15;
const DEFAULT_AUTH_MAX_RESET_OTP_ATTEMPTS = 5;
const DEFAULT_AUTH_AVATAR_BUCKET = 'avatars';
const DEFAULT_AUTH_AVATAR_MAX_SIZE_BYTES = 2_097_152;
const DEFAULT_AUTH_AVATAR_SIGNED_URL_TTL_SECONDS = 3600;
const DEFAULT_AUTH_GUEST_SESSION_TTL_HOURS = 24;
const DEFAULT_AUTH_GUEST_MAX_SESSIONS_PER_IP_PER_HOUR = 20;
const DEFAULT_AUTH_GUEST_REQUIRE_CAPTCHA = false;
const DEFAULT_AUTH_GUEST_CLEANUP_ENABLED = true;

const MIN_AUTH_ACCESS_TOKEN_HASH_PEPPER_LENGTH = 32;
const MIN_AUTH_AVATAR_MAX_SIZE_BYTES = 1024;
const MAX_AUTH_AVATAR_MAX_SIZE_BYTES = 10_485_760;

const NODE_ENV_VALUE_SET = new Set<string>(NODE_ENV_VALUES);

function readOptionalString(
  environment: EnvironmentInput,
  name: EnvironmentVariableName,
): string | undefined {
  const value = environment[name];

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function readRequiredString(
  environment: EnvironmentInput,
  name: EnvironmentVariableName,
  errors: string[],
): string {
  const value = readOptionalString(environment, name);

  if (!value) {
    errors.push(`${name} is required.`);
    return '';
  }

  return value;
}

function parseNodeEnvironment(
  value: string,
  errors: string[],
): NodeEnvironment {
  if (NODE_ENV_VALUE_SET.has(value)) {
    return value as NodeEnvironment;
  }

  errors.push(`NODE_ENV must be one of: ${NODE_ENV_VALUES.join(', ')}.`);

  return DEFAULT_NODE_ENV;
}

function parsePort(value: string, errors: string[]): number {
  const parsedPort = Number(value);

  if (!Number.isInteger(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
    errors.push('PORT must be a number between 1 and 65535.');
    return DEFAULT_PORT;
  }

  return parsedPort;
}

function normalizeApiGlobalPrefix(value: string, errors: string[]): string {
  const normalizedValue = value.trim().replace(/^\/+|\/+$/g, '');

  if (!normalizedValue) {
    errors.push('API_GLOBAL_PREFIX cannot be empty.');
    return DEFAULT_API_GLOBAL_PREFIX;
  }

  if (!/^[a-zA-Z0-9][a-zA-Z0-9/_-]*$/.test(normalizedValue)) {
    errors.push(
      'API_GLOBAL_PREFIX may only contain letters, numbers, forward slashes, underscores, and hyphens.',
    );

    return DEFAULT_API_GLOBAL_PREFIX;
  }

  return normalizedValue;
}

function validateHttpUrl(
  value: string,
  name: EnvironmentVariableName,
  errors: string[],
): string {
  try {
    const parsedUrl = new URL(value);

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      errors.push(`${name} must use http or https.`);
      return value;
    }

    return value;
  } catch {
    errors.push(`${name} must be a valid URL.`);
    return value;
  }
}

function validateOriginList(value: string, errors: string[]): string {
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (origins.length === 0) {
    errors.push('WEB_ORIGIN must contain at least one valid origin.');
    return '';
  }

  const normalizedOrigins = origins.map((origin) => {
    try {
      const parsedUrl = new URL(origin);

      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        errors.push('WEB_ORIGIN entries must use http or https.');
        return origin;
      }

      if (parsedUrl.pathname !== '/' || parsedUrl.search || parsedUrl.hash) {
        errors.push(
          'WEB_ORIGIN entries must be origins only, for example http://localhost:3000.',
        );

        return origin;
      }

      return parsedUrl.origin;
    } catch {
      errors.push(`WEB_ORIGIN contains an invalid origin: ${origin}.`);
      return origin;
    }
  });

  return normalizedOrigins.join(',');
}

function parseNumberInRange(
  value: string,
  name: EnvironmentVariableName,
  min: number,
  max: number,
  fallback: number,
  errors: string[],
): number {
  const parsedValue = Number(value);

  if (Number.isNaN(parsedValue) || parsedValue < min || parsedValue > max) {
    errors.push(`${name} must be a number between ${min} and ${max}.`);
    return fallback;
  }

  return parsedValue;
}

function parseIntegerInRange(
  value: string,
  name: EnvironmentVariableName,
  min: number,
  max: number,
  fallback: number,
  errors: string[],
): number {
  const parsedValue = Number(value);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue < min ||
    parsedValue > max
  ) {
    errors.push(`${name} must be an integer between ${min} and ${max}.`);
    return fallback;
  }

  return parsedValue;
}

function parseBoolean(
  value: string,
  name: EnvironmentVariableName,
  fallback: boolean,
  errors: string[],
): boolean {
  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === 'true') {
    return true;
  }

  if (normalizedValue === 'false') {
    return false;
  }

  errors.push(`${name} must be either true or false.`);

  return fallback;
}

function validateRequestBodyLimit(value: string, errors: string[]): string {
  const normalizedValue = value.toLowerCase();

  if (!/^\d+$|^\d+(b|kb|mb)$/u.test(normalizedValue)) {
    errors.push(
      'REQUEST_BODY_LIMIT must be a plain byte number or a value like 100kb or 1mb.',
    );

    return DEFAULT_REQUEST_BODY_LIMIT;
  }

  return normalizedValue;
}

function validateEmail(
  value: string,
  name: EnvironmentVariableName,
  errors: string[],
): string {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)) {
    errors.push(`${name} must be a valid email address.`);
  }

  return value;
}

function validateAuthAccessTokenHashPepper(
  value: string,
  errors: string[],
): string {
  if (value.length < MIN_AUTH_ACCESS_TOKEN_HASH_PEPPER_LENGTH) {
    errors.push(
      `AUTH_ACCESS_TOKEN_HASH_PEPPER must be at least ${MIN_AUTH_ACCESS_TOKEN_HASH_PEPPER_LENGTH} characters long.`,
    );
  }

  return value;
}

function validateAuthAvatarBucket(value: string, errors: string[]): string {
  const normalizedValue = value.trim();

  if (!/^[a-z0-9][a-z0-9_-]{1,62}$/u.test(normalizedValue)) {
    errors.push(
      'AUTH_AVATAR_BUCKET must be 2 to 63 characters and may only contain lowercase letters, numbers, underscores, and hyphens.',
    );

    return DEFAULT_AUTH_AVATAR_BUCKET;
  }

  return normalizedValue;
}

function throwIfEnvironmentInvalid(errors: string[]): void {
  if (errors.length === 0) {
    return;
  }

  throw new Error(
    [
      'Invalid LAFAM API environment configuration:',
      ...errors.map((error) => `- ${error}`),
    ].join('\n'),
  );
}

export function validateEnvironment(
  environment: EnvironmentInput = process.env,
): ValidatedEnvironment {
  const errors: string[] = [];

  const nodeEnv = parseNodeEnvironment(
    readRequiredString(environment, 'NODE_ENV', errors),
    errors,
  );

  const port = parsePort(
    readRequiredString(environment, 'PORT', errors),
    errors,
  );

  const apiGlobalPrefix = normalizeApiGlobalPrefix(
    readRequiredString(environment, 'API_GLOBAL_PREFIX', errors),
    errors,
  );

  const webOrigin = validateOriginList(
    readRequiredString(environment, 'WEB_ORIGIN', errors),
    errors,
  );

  const supabaseUrl = validateHttpUrl(
    readRequiredString(environment, 'SUPABASE_URL', errors),
    'SUPABASE_URL',
    errors,
  );

  const supabasePublishableKey = readRequiredString(
    environment,
    'SUPABASE_PUBLISHABLE_KEY',
    errors,
  );

  const supabaseSecretKey = readRequiredString(
    environment,
    'SUPABASE_SECRET_KEY',
    errors,
  );

  const sentryDsn = readOptionalString(environment, 'SENTRY_DSN');

  if (sentryDsn) {
    validateHttpUrl(sentryDsn, 'SENTRY_DSN', errors);
  }

  const sentryEnvironment =
    readOptionalString(environment, 'SENTRY_ENVIRONMENT') ??
    DEFAULT_SENTRY_ENVIRONMENT;

  const sentryTracesSampleRate = parseNumberInRange(
    readOptionalString(environment, 'SENTRY_TRACES_SAMPLE_RATE') ??
      String(DEFAULT_SENTRY_TRACES_SAMPLE_RATE),
    'SENTRY_TRACES_SAMPLE_RATE',
    0,
    1,
    DEFAULT_SENTRY_TRACES_SAMPLE_RATE,
    errors,
  );

  const brevoApiKey = readOptionalString(environment, 'BREVO_API_KEY') ?? '';
  const brevoSenderEmail =
    readOptionalString(environment, 'BREVO_SENDER_EMAIL') ?? '';
  const brevoSenderName = readRequiredString(
    environment,
    'BREVO_SENDER_NAME',
    errors,
  );

  if (
    (brevoApiKey && !brevoSenderEmail) ||
    (!brevoApiKey && brevoSenderEmail)
  ) {
    errors.push(
      'BREVO_API_KEY and BREVO_SENDER_EMAIL must be configured together.',
    );
  }

  if (brevoSenderEmail) {
    validateEmail(brevoSenderEmail, 'BREVO_SENDER_EMAIL', errors);
  }

  const jwtClockToleranceSeconds = parseIntegerInRange(
    readOptionalString(environment, 'JWT_CLOCK_TOLERANCE_SECONDS') ??
      String(DEFAULT_JWT_CLOCK_TOLERANCE_SECONDS),
    'JWT_CLOCK_TOLERANCE_SECONDS',
    0,
    300,
    DEFAULT_JWT_CLOCK_TOLERANCE_SECONDS,
    errors,
  );

  const requestBodyLimit = validateRequestBodyLimit(
    readOptionalString(environment, 'REQUEST_BODY_LIMIT') ??
      DEFAULT_REQUEST_BODY_LIMIT,
    errors,
  );

  const accessTokenHashPepper = validateAuthAccessTokenHashPepper(
    readRequiredString(environment, 'AUTH_ACCESS_TOKEN_HASH_PEPPER', errors),
    errors,
  );

  const resetTokenTtlMinutes = parseIntegerInRange(
    readRequiredString(environment, 'AUTH_RESET_TOKEN_TTL_MINUTES', errors),
    'AUTH_RESET_TOKEN_TTL_MINUTES',
    1,
    1440,
    DEFAULT_AUTH_RESET_TOKEN_TTL_MINUTES,
    errors,
  );

  const maxResetOtpAttempts = parseIntegerInRange(
    readRequiredString(environment, 'AUTH_MAX_RESET_OTP_ATTEMPTS', errors),
    'AUTH_MAX_RESET_OTP_ATTEMPTS',
    1,
    20,
    DEFAULT_AUTH_MAX_RESET_OTP_ATTEMPTS,
    errors,
  );

  const avatarBucket = validateAuthAvatarBucket(
    readRequiredString(environment, 'AUTH_AVATAR_BUCKET', errors),
    errors,
  );

  const avatarMaxSizeBytes = parseIntegerInRange(
    readRequiredString(environment, 'AUTH_AVATAR_MAX_SIZE_BYTES', errors),
    'AUTH_AVATAR_MAX_SIZE_BYTES',
    MIN_AUTH_AVATAR_MAX_SIZE_BYTES,
    MAX_AUTH_AVATAR_MAX_SIZE_BYTES,
    DEFAULT_AUTH_AVATAR_MAX_SIZE_BYTES,
    errors,
  );

  const avatarSignedUrlTtlSeconds = parseIntegerInRange(
    readRequiredString(
      environment,
      'AUTH_AVATAR_SIGNED_URL_TTL_SECONDS',
      errors,
    ),
    'AUTH_AVATAR_SIGNED_URL_TTL_SECONDS',
    60,
    86_400,
    DEFAULT_AUTH_AVATAR_SIGNED_URL_TTL_SECONDS,
    errors,
  );

  const guestSessionTtlHours = parseIntegerInRange(
    readRequiredString(environment, 'AUTH_GUEST_SESSION_TTL_HOURS', errors),
    'AUTH_GUEST_SESSION_TTL_HOURS',
    1,
    168,
    DEFAULT_AUTH_GUEST_SESSION_TTL_HOURS,
    errors,
  );

  const guestMaxSessionsPerIpPerHour = parseIntegerInRange(
    readRequiredString(
      environment,
      'AUTH_GUEST_MAX_SESSIONS_PER_IP_PER_HOUR',
      errors,
    ),
    'AUTH_GUEST_MAX_SESSIONS_PER_IP_PER_HOUR',
    1,
    1000,
    DEFAULT_AUTH_GUEST_MAX_SESSIONS_PER_IP_PER_HOUR,
    errors,
  );

  const guestRequireCaptcha = parseBoolean(
    readRequiredString(environment, 'AUTH_GUEST_REQUIRE_CAPTCHA', errors),
    'AUTH_GUEST_REQUIRE_CAPTCHA',
    DEFAULT_AUTH_GUEST_REQUIRE_CAPTCHA,
    errors,
  );

  const guestCleanupEnabled = parseBoolean(
    readRequiredString(environment, 'AUTH_GUEST_CLEANUP_ENABLED', errors),
    'AUTH_GUEST_CLEANUP_ENABLED',
    DEFAULT_AUTH_GUEST_CLEANUP_ENABLED,
    errors,
  );

  throwIfEnvironmentInvalid(errors);

  return {
    app: {
      nodeEnv,
      port,
      apiGlobalPrefix,
      webOrigin,
    },
    supabase: {
      url: supabaseUrl,
      publishableKey: supabasePublishableKey,
      secretKey: supabaseSecretKey,
    },
    sentry: {
      dsn: sentryDsn ?? '',
      environment: sentryEnvironment,
      tracesSampleRate: sentryTracesSampleRate,
    },
    brevo: {
      apiKey: brevoApiKey,
      senderEmail: brevoSenderEmail,
      senderName: brevoSenderName,
    },
    security: {
      jwtClockToleranceSeconds,
      requestBodyLimit,
    },
    auth: {
      accessTokenHashPepper,
      resetTokenTtlMinutes,
      maxResetOtpAttempts,
      avatarBucket,
      avatarMaxSizeBytes,
      avatarSignedUrlTtlSeconds,
      guestSessionTtlHours,
      guestMaxSessionsPerIpPerHour,
      guestRequireCaptcha,
      guestCleanupEnabled,
    },
  };
}
