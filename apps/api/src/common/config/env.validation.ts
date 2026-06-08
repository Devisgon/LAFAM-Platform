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
  };
}
