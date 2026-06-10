// apps/api/src/modules/auth/constants/auth-error.constants.ts
/**
 * LAFAM Auth error constants.
 *
 * Role:
 * - Defines frontend-safe Auth error reasons.
 * - Keeps provider-error mapping, services, guards, and DTO validation aligned.
 * - Avoids leaking raw Supabase/provider error messages into API responses.
 *
 * Important:
 * - These are reason constants, not thrown errors.
 * - Throw AppError from common/errors/app-error.ts for actual failures.
 * - Use these values inside safe details objects where the frontend needs a stable reason.
 */

export const AUTH_ERROR_DETAIL_KEYS = {
  reason: 'reason',
  field: 'field',
  provider: 'provider',
  sessionId: 'session_id',
  userId: 'user_id',
  maxSizeBytes: 'max_size_bytes',
  allowedMimeTypes: 'allowed_mime_types',
  remainingAttempts: 'remaining_attempts',
} as const;

export const AUTH_ERROR_REASONS = [
  'invalid_request',
  'invalid_email',
  'invalid_phone',
  'invalid_full_name',
  'invalid_timezone',
  'invalid_device_metadata',
  'email_already_registered',
  'email_not_verified',
  'verification_otp_invalid',
  'verification_otp_expired',
  'verification_otp_resend_failed',
  'login_failed',
  'invalid_credentials',
  'refresh_token_invalid',
  'reset_otp_invalid',
  'reset_otp_expired',
  'reset_otp_attempts_exceeded',
  'reset_token_invalid',
  'reset_token_expired',
  'reset_token_used',
  'password_policy_failed',
  'password_confirmation_mismatch',
  'current_password_invalid',
  'account_deactivated',
  'account_deleted',
  'session_missing',
  'session_not_found',
  'session_revoked',
  'session_expired',
  'session_converted',
  'authorization_denied',
  'admin_access_required',
  'super_admin_required',
  'user_not_found',
  'user_already_deactivated',
  'user_already_active',
  'cannot_delete_self',
  'avatar_invalid_file_type',
  'avatar_file_too_large',
  'avatar_upload_failed',
  'avatar_not_found',
  'guest_session_required',
  'guest_session_expired',
  'guest_session_revoked',
  'guest_session_rate_limited',
  'guest_conversion_required',
  'guest_conversion_failed',
  'guest_already_converted',
  'guest_cannot_access_resource',
  'guest_cannot_create_booking',
  'guest_cannot_access_booking_history',
  'provider_unavailable',
  'provider_rate_limited',
  'provider_invalid_response',
] as const;

export type AuthErrorReason = (typeof AUTH_ERROR_REASONS)[number];

export const AUTH_ERROR_REASON_INVALID_REQUEST =
  'invalid_request' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_INVALID_EMAIL =
  'invalid_email' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_INVALID_PHONE =
  'invalid_phone' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_INVALID_FULL_NAME =
  'invalid_full_name' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_INVALID_TIMEZONE =
  'invalid_timezone' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_INVALID_DEVICE_METADATA =
  'invalid_device_metadata' satisfies AuthErrorReason;

export const AUTH_ERROR_REASON_EMAIL_ALREADY_REGISTERED =
  'email_already_registered' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_EMAIL_NOT_VERIFIED =
  'email_not_verified' satisfies AuthErrorReason;

export const AUTH_ERROR_REASON_VERIFICATION_OTP_INVALID =
  'verification_otp_invalid' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_VERIFICATION_OTP_EXPIRED =
  'verification_otp_expired' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_VERIFICATION_OTP_RESEND_FAILED =
  'verification_otp_resend_failed' satisfies AuthErrorReason;

export const AUTH_ERROR_REASON_LOGIN_FAILED =
  'login_failed' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_INVALID_CREDENTIALS =
  'invalid_credentials' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_REFRESH_TOKEN_INVALID =
  'refresh_token_invalid' satisfies AuthErrorReason;

export const AUTH_ERROR_REASON_RESET_OTP_INVALID =
  'reset_otp_invalid' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_RESET_OTP_EXPIRED =
  'reset_otp_expired' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_RESET_OTP_ATTEMPTS_EXCEEDED =
  'reset_otp_attempts_exceeded' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_RESET_TOKEN_INVALID =
  'reset_token_invalid' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_RESET_TOKEN_EXPIRED =
  'reset_token_expired' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_RESET_TOKEN_USED =
  'reset_token_used' satisfies AuthErrorReason;

export const AUTH_ERROR_REASON_PASSWORD_POLICY_FAILED =
  'password_policy_failed' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_PASSWORD_CONFIRMATION_MISMATCH =
  'password_confirmation_mismatch' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_CURRENT_PASSWORD_INVALID =
  'current_password_invalid' satisfies AuthErrorReason;

export const AUTH_ERROR_REASON_ACCOUNT_DEACTIVATED =
  'account_deactivated' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_ACCOUNT_DELETED =
  'account_deleted' satisfies AuthErrorReason;

export const AUTH_ERROR_REASON_SESSION_MISSING =
  'session_missing' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_SESSION_NOT_FOUND =
  'session_not_found' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_SESSION_REVOKED =
  'session_revoked' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_SESSION_EXPIRED =
  'session_expired' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_SESSION_CONVERTED =
  'session_converted' satisfies AuthErrorReason;

export const AUTH_ERROR_REASON_AUTHORIZATION_DENIED =
  'authorization_denied' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_ADMIN_ACCESS_REQUIRED =
  'admin_access_required' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_SUPER_ADMIN_REQUIRED =
  'super_admin_required' satisfies AuthErrorReason;

export const AUTH_ERROR_REASON_USER_NOT_FOUND =
  'user_not_found' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_USER_ALREADY_DEACTIVATED =
  'user_already_deactivated' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_USER_ALREADY_ACTIVE =
  'user_already_active' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_CANNOT_DELETE_SELF =
  'cannot_delete_self' satisfies AuthErrorReason;

export const AUTH_ERROR_REASON_AVATAR_INVALID_FILE_TYPE =
  'avatar_invalid_file_type' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_AVATAR_FILE_TOO_LARGE =
  'avatar_file_too_large' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_AVATAR_UPLOAD_FAILED =
  'avatar_upload_failed' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_AVATAR_NOT_FOUND =
  'avatar_not_found' satisfies AuthErrorReason;

export const AUTH_ERROR_REASON_GUEST_SESSION_REQUIRED =
  'guest_session_required' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_GUEST_SESSION_EXPIRED =
  'guest_session_expired' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_GUEST_SESSION_REVOKED =
  'guest_session_revoked' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_GUEST_SESSION_RATE_LIMITED =
  'guest_session_rate_limited' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_GUEST_CONVERSION_REQUIRED =
  'guest_conversion_required' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_GUEST_CONVERSION_FAILED =
  'guest_conversion_failed' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_GUEST_ALREADY_CONVERTED =
  'guest_already_converted' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_GUEST_CANNOT_ACCESS_RESOURCE =
  'guest_cannot_access_resource' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_GUEST_CANNOT_CREATE_BOOKING =
  'guest_cannot_create_booking' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_GUEST_CANNOT_ACCESS_BOOKING_HISTORY =
  'guest_cannot_access_booking_history' satisfies AuthErrorReason;

export const AUTH_ERROR_REASON_PROVIDER_UNAVAILABLE =
  'provider_unavailable' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_PROVIDER_RATE_LIMITED =
  'provider_rate_limited' satisfies AuthErrorReason;
export const AUTH_ERROR_REASON_PROVIDER_INVALID_RESPONSE =
  'provider_invalid_response' satisfies AuthErrorReason;

export const AUTH_PROVIDER_ERROR_REASONS = [
  AUTH_ERROR_REASON_EMAIL_ALREADY_REGISTERED,
  AUTH_ERROR_REASON_INVALID_CREDENTIALS,
  AUTH_ERROR_REASON_EMAIL_NOT_VERIFIED,
  AUTH_ERROR_REASON_VERIFICATION_OTP_INVALID,
  AUTH_ERROR_REASON_VERIFICATION_OTP_EXPIRED,
  AUTH_ERROR_REASON_RESET_OTP_INVALID,
  AUTH_ERROR_REASON_RESET_OTP_EXPIRED,
  AUTH_ERROR_REASON_PROVIDER_UNAVAILABLE,
  AUTH_ERROR_REASON_PROVIDER_RATE_LIMITED,
  AUTH_ERROR_REASON_PROVIDER_INVALID_RESPONSE,
] as const satisfies readonly AuthErrorReason[];

export type AuthProviderErrorReason =
  (typeof AUTH_PROVIDER_ERROR_REASONS)[number];

export const AUTH_PASSWORD_ERROR_REASONS = [
  AUTH_ERROR_REASON_PASSWORD_POLICY_FAILED,
  AUTH_ERROR_REASON_PASSWORD_CONFIRMATION_MISMATCH,
  AUTH_ERROR_REASON_CURRENT_PASSWORD_INVALID,
] as const satisfies readonly AuthErrorReason[];

export type AuthPasswordErrorReason =
  (typeof AUTH_PASSWORD_ERROR_REASONS)[number];

export const AUTH_SESSION_ERROR_REASONS = [
  AUTH_ERROR_REASON_SESSION_MISSING,
  AUTH_ERROR_REASON_SESSION_NOT_FOUND,
  AUTH_ERROR_REASON_SESSION_REVOKED,
  AUTH_ERROR_REASON_SESSION_EXPIRED,
  AUTH_ERROR_REASON_SESSION_CONVERTED,
] as const satisfies readonly AuthErrorReason[];

export type AuthSessionErrorReason =
  (typeof AUTH_SESSION_ERROR_REASONS)[number];

export const AUTH_GUEST_ERROR_REASONS = [
  AUTH_ERROR_REASON_GUEST_SESSION_REQUIRED,
  AUTH_ERROR_REASON_GUEST_SESSION_EXPIRED,
  AUTH_ERROR_REASON_GUEST_SESSION_REVOKED,
  AUTH_ERROR_REASON_GUEST_SESSION_RATE_LIMITED,
  AUTH_ERROR_REASON_GUEST_CONVERSION_REQUIRED,
  AUTH_ERROR_REASON_GUEST_CONVERSION_FAILED,
  AUTH_ERROR_REASON_GUEST_ALREADY_CONVERTED,
  AUTH_ERROR_REASON_GUEST_CANNOT_ACCESS_RESOURCE,
  AUTH_ERROR_REASON_GUEST_CANNOT_CREATE_BOOKING,
  AUTH_ERROR_REASON_GUEST_CANNOT_ACCESS_BOOKING_HISTORY,
] as const satisfies readonly AuthErrorReason[];

export type AuthGuestErrorReason = (typeof AUTH_GUEST_ERROR_REASONS)[number];

const AUTH_ERROR_REASON_SET = new Set<AuthErrorReason>(AUTH_ERROR_REASONS);
const AUTH_PROVIDER_ERROR_REASON_SET = new Set<AuthErrorReason>(
  AUTH_PROVIDER_ERROR_REASONS,
);
const AUTH_PASSWORD_ERROR_REASON_SET = new Set<AuthErrorReason>(
  AUTH_PASSWORD_ERROR_REASONS,
);
const AUTH_SESSION_ERROR_REASON_SET = new Set<AuthErrorReason>(
  AUTH_SESSION_ERROR_REASONS,
);
const AUTH_GUEST_ERROR_REASON_SET = new Set<AuthErrorReason>(
  AUTH_GUEST_ERROR_REASONS,
);

export function isAuthErrorReason(value: string): value is AuthErrorReason {
  return AUTH_ERROR_REASON_SET.has(value as AuthErrorReason);
}

export function isAuthProviderErrorReason(
  value: AuthErrorReason,
): value is AuthProviderErrorReason {
  return AUTH_PROVIDER_ERROR_REASON_SET.has(value);
}

export function isAuthPasswordErrorReason(
  value: AuthErrorReason,
): value is AuthPasswordErrorReason {
  return AUTH_PASSWORD_ERROR_REASON_SET.has(value);
}

export function isAuthSessionErrorReason(
  value: AuthErrorReason,
): value is AuthSessionErrorReason {
  return AUTH_SESSION_ERROR_REASON_SET.has(value);
}

export function isAuthGuestErrorReason(
  value: AuthErrorReason,
): value is AuthGuestErrorReason {
  return AUTH_GUEST_ERROR_REASON_SET.has(value);
}
