// apps/api/src/common/config/environment.contract.ts
/**
 * LAFAM API environment contract.
 *
 * Role:
 * - Defines every environment variable the API is allowed to read.
 * - Defines the typed runtime environment shape used by config files.
 * - Marks which variables are sensitive and must never be logged.
 *
 * Important:
 * - This file does not read process.env.
 * - This file does not validate values.
 * - Validation belongs in env.validation.ts.
 */

export const NODE_ENV_VALUES = [
  'development',
  'test',
  'staging',
  'production',
] as const;

export type NodeEnvironment = (typeof NODE_ENV_VALUES)[number];

export type EnvironmentVariableName =
  | 'NODE_ENV'
  | 'PORT'
  | 'API_GLOBAL_PREFIX'
  | 'WEB_ORIGIN'
  | 'SUPABASE_URL'
  | 'SUPABASE_PUBLISHABLE_KEY'
  | 'SUPABASE_SECRET_KEY'
  | 'SENTRY_DSN'
  | 'SENTRY_ENVIRONMENT'
  | 'SENTRY_TRACES_SAMPLE_RATE'
  | 'BREVO_API_KEY'
  | 'BREVO_SENDER_EMAIL'
  | 'BREVO_SENDER_NAME'
  | 'JWT_CLOCK_TOLERANCE_SECONDS'
  | 'REQUEST_BODY_LIMIT';

export type RawEnvironment = Partial<
  Record<EnvironmentVariableName, string | undefined>
>;

export interface AppEnvironment {
  readonly nodeEnv: NodeEnvironment;
  readonly port: number;
  readonly apiGlobalPrefix: string;
  readonly webOrigin: string;
}

export interface SupabaseEnvironment {
  readonly url: string;
  readonly publishableKey: string;
  readonly secretKey: string;
}

export interface SentryEnvironment {
  readonly dsn: string;
  readonly environment: string;
  readonly tracesSampleRate: number;
}

export interface BrevoEnvironment {
  readonly apiKey: string;
  readonly senderEmail: string;
  readonly senderName: string;
}

export interface SecurityEnvironment {
  readonly jwtClockToleranceSeconds: number;
  readonly requestBodyLimit: string;
}

export interface ValidatedEnvironment {
  readonly app: AppEnvironment;
  readonly supabase: SupabaseEnvironment;
  readonly sentry: SentryEnvironment;
  readonly brevo: BrevoEnvironment;
  readonly security: SecurityEnvironment;
}

export const ENVIRONMENT_VARIABLE_NAMES = [
  'NODE_ENV',
  'PORT',
  'API_GLOBAL_PREFIX',
  'WEB_ORIGIN',
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'SENTRY_DSN',
  'SENTRY_ENVIRONMENT',
  'SENTRY_TRACES_SAMPLE_RATE',
  'BREVO_API_KEY',
  'BREVO_SENDER_EMAIL',
  'BREVO_SENDER_NAME',
  'JWT_CLOCK_TOLERANCE_SECONDS',
  'REQUEST_BODY_LIMIT',
] as const satisfies readonly EnvironmentVariableName[];

export const REQUIRED_ENVIRONMENT_VARIABLE_NAMES = [
  'NODE_ENV',
  'PORT',
  'API_GLOBAL_PREFIX',
  'WEB_ORIGIN',
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'SENTRY_ENVIRONMENT',
  'SENTRY_TRACES_SAMPLE_RATE',
  'BREVO_SENDER_NAME',
  'JWT_CLOCK_TOLERANCE_SECONDS',
  'REQUEST_BODY_LIMIT',
] as const satisfies readonly EnvironmentVariableName[];

export const OPTIONAL_ENVIRONMENT_VARIABLE_NAMES = [
  'SENTRY_DSN',
  'BREVO_API_KEY',
  'BREVO_SENDER_EMAIL',
] as const satisfies readonly EnvironmentVariableName[];

export const SENSITIVE_ENVIRONMENT_VARIABLE_NAMES = [
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'SENTRY_DSN',
  'BREVO_API_KEY',
] as const satisfies readonly EnvironmentVariableName[];

export type SensitiveEnvironmentVariableName =
  (typeof SENSITIVE_ENVIRONMENT_VARIABLE_NAMES)[number];

const SENSITIVE_ENVIRONMENT_VARIABLE_NAME_SET =
  new Set<EnvironmentVariableName>(SENSITIVE_ENVIRONMENT_VARIABLE_NAMES);

export function isSensitiveEnvironmentVariableName(
  value: EnvironmentVariableName,
): value is SensitiveEnvironmentVariableName {
  return SENSITIVE_ENVIRONMENT_VARIABLE_NAME_SET.has(value);
}
