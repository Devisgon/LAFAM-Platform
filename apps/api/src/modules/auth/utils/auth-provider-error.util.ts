// apps/api/src/modules/auth/utils/auth-provider-error.util.ts
/**
 * LAFAM Auth provider error utilities.
 *
 * Role:
 * - Converts Supabase Auth/provider failures into frontend-safe AppError instances.
 * - Prevents raw provider messages from becoming the public API contract.
 * - Keeps Auth services clean and consistent when handling provider failures.
 *
 * Important:
 * - Do not expose raw Supabase error messages to clients.
 * - Do not log tokens, passwords, OTPs, reset tokens, or provider payloads from this utility.
 * - Provider error matching is defensive because provider error shapes can vary.
 */

import {
  AppError,
  type AppErrorDetails,
} from '../../../common/errors/app-error';
import {
  AUTH_ERROR_DETAIL_KEYS,
  AUTH_ERROR_REASON_EMAIL_ALREADY_REGISTERED,
  AUTH_ERROR_REASON_GUEST_CONVERSION_FAILED,
  AUTH_ERROR_REASON_INVALID_CREDENTIALS,
  AUTH_ERROR_REASON_PROVIDER_INVALID_RESPONSE,
  AUTH_ERROR_REASON_PROVIDER_UNAVAILABLE,
  AUTH_ERROR_REASON_REFRESH_TOKEN_INVALID,
  AUTH_ERROR_REASON_RESET_OTP_EXPIRED,
  AUTH_ERROR_REASON_RESET_OTP_INVALID,
  AUTH_ERROR_REASON_VERIFICATION_OTP_EXPIRED,
  AUTH_ERROR_REASON_VERIFICATION_OTP_INVALID,
  type AuthErrorReason,
} from '../constants/auth-error.constants';

export type AuthProviderErrorFlow =
  | 'sign_up'
  | 'verify_email_otp'
  | 'resend_verification_otp'
  | 'login'
  | 'refresh_token'
  | 'forgot_password'
  | 'verify_reset_otp'
  | 'reset_password'
  | 'change_password'
  | 'guest_session'
  | 'guest_conversion'
  | 'admin_user_operation'
  | 'unknown';

export interface AuthProviderErrorShape {
  readonly name?: string;
  readonly message?: string;
  readonly code?: string;
  readonly status?: number;
  readonly statusCode?: number;
}

export interface MapAuthProviderErrorInput {
  readonly error: unknown;
  readonly flow: AuthProviderErrorFlow;
}

export interface AuthProviderErrorSummary {
  readonly flow: AuthProviderErrorFlow;
  readonly provider: 'supabase';
  readonly code: string | null;
  readonly status: number | null;
  readonly reason: AuthErrorReason;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readStringProperty(
  value: Record<string, unknown>,
  propertyName: string,
): string | null {
  const propertyValue = value[propertyName];

  return typeof propertyValue === 'string' && propertyValue.trim().length > 0
    ? propertyValue.trim()
    : null;
}

function readNumberProperty(
  value: Record<string, unknown>,
  propertyName: string,
): number | null {
  const propertyValue = value[propertyName];

  return typeof propertyValue === 'number' && Number.isFinite(propertyValue)
    ? propertyValue
    : null;
}

export function normalizeAuthProviderError(
  error: unknown,
): AuthProviderErrorShape {
  if (!isObject(error)) {
    return {};
  }

  return {
    name: readStringProperty(error, 'name') ?? undefined,
    message: readStringProperty(error, 'message') ?? undefined,
    code: readStringProperty(error, 'code') ?? undefined,
    status:
      readNumberProperty(error, 'status') ??
      readNumberProperty(error, 'statusCode') ??
      undefined,
    statusCode: readNumberProperty(error, 'statusCode') ?? undefined,
  };
}

function getProviderErrorSearchText(error: AuthProviderErrorShape): string {
  return [error.name, error.code, error.message]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase();
}

function createProviderDetails(
  flow: AuthProviderErrorFlow,
  reason: AuthErrorReason,
  error: AuthProviderErrorShape,
): AppErrorDetails {
  return {
    [AUTH_ERROR_DETAIL_KEYS.reason]: reason,
    [AUTH_ERROR_DETAIL_KEYS.provider]: 'supabase',
    flow,
    provider_code: error.code ?? null,
    provider_status: error.status ?? error.statusCode ?? null,
  };
}

export function summarizeAuthProviderError(
  input: MapAuthProviderErrorInput,
  reason: AuthErrorReason,
): AuthProviderErrorSummary {
  const error = normalizeAuthProviderError(input.error);

  return {
    flow: input.flow,
    provider: 'supabase',
    code: error.code ?? null,
    status: error.status ?? error.statusCode ?? null,
    reason,
  };
}

export function isAuthProviderRateLimitError(
  error: AuthProviderErrorShape,
): boolean {
  const searchText = getProviderErrorSearchText(error);

  return (
    error.status === 429 ||
    error.statusCode === 429 ||
    searchText.includes('rate limit') ||
    searchText.includes('too many') ||
    searchText.includes('over email send rate limit')
  );
}

export function isAuthProviderUnavailableError(
  error: AuthProviderErrorShape,
): boolean {
  const searchText = getProviderErrorSearchText(error);

  return (
    error.status === 500 ||
    error.status === 502 ||
    error.status === 503 ||
    error.status === 504 ||
    error.statusCode === 500 ||
    error.statusCode === 502 ||
    error.statusCode === 503 ||
    error.statusCode === 504 ||
    searchText.includes('network') ||
    searchText.includes('fetch failed') ||
    searchText.includes('service unavailable') ||
    searchText.includes('temporarily unavailable')
  );
}

export function isAuthProviderEmailAlreadyRegisteredError(
  error: AuthProviderErrorShape,
): boolean {
  const searchText = getProviderErrorSearchText(error);

  return (
    searchText.includes('already registered') ||
    searchText.includes('already exists') ||
    searchText.includes('user already registered') ||
    searchText.includes('email address already')
  );
}

export function isAuthProviderInvalidCredentialsError(
  error: AuthProviderErrorShape,
): boolean {
  const searchText = getProviderErrorSearchText(error);

  return (
    error.status === 400 ||
    error.statusCode === 400 ||
    searchText.includes('invalid login credentials') ||
    searchText.includes('invalid credentials') ||
    searchText.includes('email not confirmed') ||
    searchText.includes('invalid grant')
  );
}

export function isAuthProviderEmailNotVerifiedError(
  error: AuthProviderErrorShape,
): boolean {
  const searchText = getProviderErrorSearchText(error);

  return (
    searchText.includes('email not confirmed') ||
    searchText.includes('email not verified') ||
    searchText.includes('email confirmation')
  );
}

export function isAuthProviderOtpExpiredError(
  error: AuthProviderErrorShape,
): boolean {
  const searchText = getProviderErrorSearchText(error);

  return (
    searchText.includes('expired') ||
    searchText.includes('otp expired') ||
    searchText.includes('token expired')
  );
}

export function isAuthProviderOtpInvalidError(
  error: AuthProviderErrorShape,
): boolean {
  const searchText = getProviderErrorSearchText(error);

  return (
    searchText.includes('invalid otp') ||
    searchText.includes('invalid token') ||
    searchText.includes('token is invalid') ||
    searchText.includes('otp is invalid')
  );
}

function mapCommonProviderError(
  input: MapAuthProviderErrorInput,
): AppError | null {
  const error = normalizeAuthProviderError(input.error);

  if (isAuthProviderRateLimitError(error)) {
    return AppError.rateLimited(
      'Too many authentication requests. Please try again later.',
    );
  }

  if (isAuthProviderUnavailableError(error)) {
    return AppError.supabaseUnavailable(input.error);
  }

  return null;
}

function mapSignUpProviderError(input: MapAuthProviderErrorInput): AppError {
  const commonError = mapCommonProviderError(input);

  if (commonError) {
    return commonError;
  }

  const error = normalizeAuthProviderError(input.error);

  if (isAuthProviderEmailAlreadyRegisteredError(error)) {
    return AppError.emailAlreadyRegistered(
      'An account with this email already exists.',
      createProviderDetails(
        input.flow,
        AUTH_ERROR_REASON_EMAIL_ALREADY_REGISTERED,
        error,
      ),
    );
  }

  return AppError.supabaseUnavailable(input.error);
}

function mapVerifyEmailOtpProviderError(
  input: MapAuthProviderErrorInput,
): AppError {
  const commonError = mapCommonProviderError(input);

  if (commonError) {
    return commonError;
  }

  const error = normalizeAuthProviderError(input.error);

  if (isAuthProviderOtpExpiredError(error)) {
    return AppError.verificationOtpExpired(
      'The verification code has expired.',
    );
  }

  return AppError.verificationOtpInvalid('The verification code is invalid.');
}

function mapLoginProviderError(input: MapAuthProviderErrorInput): AppError {
  const commonError = mapCommonProviderError(input);

  if (commonError) {
    return commonError;
  }

  const error = normalizeAuthProviderError(input.error);

  if (isAuthProviderEmailNotVerifiedError(error)) {
    return AppError.emailNotVerified(
      'Please verify your email before continuing.',
    );
  }

  if (isAuthProviderInvalidCredentialsError(error)) {
    return AppError.invalidCredentials('The provided credentials are invalid.');
  }

  return AppError.invalidCredentials('The provided credentials are invalid.');
}

function mapRefreshTokenProviderError(
  input: MapAuthProviderErrorInput,
): AppError {
  const commonError = mapCommonProviderError(input);

  if (commonError) {
    return commonError;
  }

  return AppError.invalidCredentials('The refresh token is invalid.');
}

function mapResetOtpProviderError(input: MapAuthProviderErrorInput): AppError {
  const commonError = mapCommonProviderError(input);

  if (commonError) {
    return commonError;
  }

  const error = normalizeAuthProviderError(input.error);

  if (isAuthProviderOtpExpiredError(error)) {
    return AppError.resetOtpExpired('The password reset code has expired.');
  }

  return AppError.resetOtpInvalid('The password reset code is invalid.');
}

function mapGuestConversionProviderError(
  input: MapAuthProviderErrorInput,
): AppError {
  const commonError = mapCommonProviderError(input);

  if (commonError) {
    return commonError;
  }

  const error = normalizeAuthProviderError(input.error);

  if (isAuthProviderEmailAlreadyRegisteredError(error)) {
    return AppError.emailAlreadyRegistered(
      'An account with this email already exists.',
      createProviderDetails(
        input.flow,
        AUTH_ERROR_REASON_EMAIL_ALREADY_REGISTERED,
        error,
      ),
    );
  }

  return AppError.guestConversionFailed(input.error);
}

export function mapAuthProviderErrorToAppError(
  input: MapAuthProviderErrorInput,
): AppError {
  switch (input.flow) {
    case 'sign_up':
      return mapSignUpProviderError(input);

    case 'verify_email_otp':
      return mapVerifyEmailOtpProviderError(input);

    case 'resend_verification_otp':
    case 'forgot_password':
      return (
        mapCommonProviderError(input) ??
        AppError.supabaseUnavailable(input.error)
      );

    case 'login':
      return mapLoginProviderError(input);

    case 'refresh_token':
      return mapRefreshTokenProviderError(input);

    case 'verify_reset_otp':
      return mapResetOtpProviderError(input);

    case 'guest_conversion':
      return mapGuestConversionProviderError(input);

    case 'reset_password':
    case 'change_password':
    case 'guest_session':
    case 'admin_user_operation':
    case 'unknown':
      return (
        mapCommonProviderError(input) ??
        AppError.supabaseUnavailable(input.error)
      );

    default:
      return AppError.supabaseUnavailable(input.error);
  }
}

export function createAuthProviderInvalidResponseError(
  flow: AuthProviderErrorFlow,
): AppError {
  return AppError.supabaseUnavailable(
    summarizeAuthProviderError(
      {
        error: null,
        flow,
      },
      AUTH_ERROR_REASON_PROVIDER_INVALID_RESPONSE,
    ),
  );
}

export function createAuthProviderRateLimitedError(
  flow: AuthProviderErrorFlow,
): AppError {
  return AppError.rateLimited(
    flow === 'guest_session'
      ? 'Too many guest sessions have been created from this network. Please try again later.'
      : 'Too many authentication requests. Please try again later.',
  );
}

export function createAuthProviderUnavailableError(
  flow: AuthProviderErrorFlow,
): AppError {
  return AppError.supabaseUnavailable(
    summarizeAuthProviderError(
      {
        error: null,
        flow,
      },
      AUTH_ERROR_REASON_PROVIDER_UNAVAILABLE,
    ),
  );
}

export function createRefreshTokenInvalidProviderError(): AppError {
  return AppError.invalidCredentials('The refresh token is invalid.');
}

export function createVerificationOtpInvalidProviderError(): AppError {
  return AppError.verificationOtpInvalid('The verification code is invalid.');
}

export function createVerificationOtpExpiredProviderError(): AppError {
  return AppError.verificationOtpExpired('The verification code has expired.');
}

export function createResetOtpInvalidProviderError(): AppError {
  return AppError.resetOtpInvalid('The password reset code is invalid.');
}

export function createResetOtpExpiredProviderError(): AppError {
  return AppError.resetOtpExpired('The password reset code has expired.');
}

export const AUTH_PROVIDER_SAFE_REASON_BY_FLOW = {
  sign_up: AUTH_ERROR_REASON_EMAIL_ALREADY_REGISTERED,
  verify_email_otp: AUTH_ERROR_REASON_VERIFICATION_OTP_INVALID,
  resend_verification_otp: AUTH_ERROR_REASON_PROVIDER_UNAVAILABLE,
  login: AUTH_ERROR_REASON_INVALID_CREDENTIALS,
  refresh_token: AUTH_ERROR_REASON_REFRESH_TOKEN_INVALID,
  forgot_password: AUTH_ERROR_REASON_PROVIDER_UNAVAILABLE,
  verify_reset_otp: AUTH_ERROR_REASON_RESET_OTP_INVALID,
  reset_password: AUTH_ERROR_REASON_PROVIDER_UNAVAILABLE,
  change_password: AUTH_ERROR_REASON_PROVIDER_UNAVAILABLE,
  guest_session: AUTH_ERROR_REASON_PROVIDER_UNAVAILABLE,
  guest_conversion: AUTH_ERROR_REASON_GUEST_CONVERSION_FAILED,
  admin_user_operation: AUTH_ERROR_REASON_PROVIDER_UNAVAILABLE,
  unknown: AUTH_ERROR_REASON_PROVIDER_UNAVAILABLE,
} as const satisfies Record<AuthProviderErrorFlow, AuthErrorReason>;

export const AUTH_PROVIDER_EXPIRED_OTP_REASON_BY_FLOW = {
  verify_email_otp: AUTH_ERROR_REASON_VERIFICATION_OTP_EXPIRED,
  verify_reset_otp: AUTH_ERROR_REASON_RESET_OTP_EXPIRED,
} as const;
