// apps/api/src/modules/auth/constants/auth.constants.ts
/**
 * LAFAM Auth shared constants.
 *
 * Role:
 * - Defines Auth statuses, session types, token metadata, audit event names, and field limits.
 * - Keeps Auth services, repositories, guards, DTOs, and Swagger aligned with the approved migration.
 *
 * Important:
 * - Keep role constants in auth-role.constants.ts.
 * - Keep permission constants in auth-permission.constants.ts.
 * - Do not place secrets or environment-derived values in this file.
 */

export const AUTH_USER_STATUSES = [
  'guest_active',
  'pending_email_verification',
  'active',
  'deactivated',
  'deleted',
] as const;

export type AuthUserStatus = (typeof AUTH_USER_STATUSES)[number];

export const AUTH_USER_STATUS_GUEST_ACTIVE =
  'guest_active' satisfies AuthUserStatus;
export const AUTH_USER_STATUS_PENDING_EMAIL_VERIFICATION =
  'pending_email_verification' satisfies AuthUserStatus;
export const AUTH_USER_STATUS_ACTIVE = 'active' satisfies AuthUserStatus;
export const AUTH_USER_STATUS_DEACTIVATED =
  'deactivated' satisfies AuthUserStatus;
export const AUTH_USER_STATUS_DELETED = 'deleted' satisfies AuthUserStatus;

export const AUTH_ACCESS_ALLOWED_USER_STATUSES = [
  AUTH_USER_STATUS_GUEST_ACTIVE,
  AUTH_USER_STATUS_ACTIVE,
] as const satisfies readonly AuthUserStatus[];

export const AUTH_ACCESS_BLOCKED_USER_STATUSES = [
  AUTH_USER_STATUS_PENDING_EMAIL_VERIFICATION,
  AUTH_USER_STATUS_DEACTIVATED,
  AUTH_USER_STATUS_DELETED,
] as const satisfies readonly AuthUserStatus[];

export type AuthAccessAllowedUserStatus =
  (typeof AUTH_ACCESS_ALLOWED_USER_STATUSES)[number];

export type AuthAccessBlockedUserStatus =
  (typeof AUTH_ACCESS_BLOCKED_USER_STATUSES)[number];

export const AUTH_SESSION_TYPES = [
  'guest',
  'authenticated',
  'admin',
  'staff',
] as const;

export type AuthSessionType = (typeof AUTH_SESSION_TYPES)[number];

export const AUTH_SESSION_TYPE_GUEST = 'guest' satisfies AuthSessionType;
export const AUTH_SESSION_TYPE_AUTHENTICATED =
  'authenticated' satisfies AuthSessionType;
export const AUTH_SESSION_TYPE_ADMIN = 'admin' satisfies AuthSessionType;
export const AUTH_SESSION_TYPE_STAFF = 'staff' satisfies AuthSessionType;

export const AUTH_TOKEN_TYPE = 'bearer';
export const AUTH_BEARER_PREFIX = 'Bearer ';
export const AUTH_AUTHORIZATION_HEADER = 'authorization';

export const AUTH_TOKEN_HASH_ALGORITHM = 'sha256';
export const AUTH_RESET_TOKEN_BYTE_LENGTH = 32;
export const AUTH_RESET_TOKEN_ENCODING = 'base64url';

export const AUTH_SUPABASE_EMAIL_OTP_TYPE = 'email';
export const AUTH_SUPABASE_PASSWORD_RECOVERY_OTP_TYPE = 'recovery';

export const AUTH_DEFAULT_TIMEZONE = 'Asia/Kuwait';
export const AUTH_DEFAULT_METADATA = {} as const;

export const AUTH_FIELD_LIMITS = {
  emailMaxLength: 254,
  phoneMaxLength: 32,
  fullNameMaxLength: 120,
  passwordMinLength: 8,
  passwordMaxLength: 128,
  otpMinLength: 4,
  otpMaxLength: 10,
  resetTokenMaxLength: 256,
  deviceIdMaxLength: 128,
  deviceNameMaxLength: 160,
  userAgentMaxLength: 512,
  ipAddressMaxLength: 64,
  timezoneMaxLength: 64,
  avatarPathMaxLength: 512,
} as const;

export const AUTH_SESSION_REVOCATION_REASONS = [
  'logout',
  'logout_all',
  'admin_revoked',
  'password_changed',
  'account_deleted',
  'user_deactivated',
  'guest_session_ended',
  'guest_session_expired',
  'guest_converted',
] as const;

export type AuthSessionRevocationReason =
  (typeof AUTH_SESSION_REVOCATION_REASONS)[number];

export const AUTH_SESSION_REVOCATION_REASON_LOGOUT =
  'logout' satisfies AuthSessionRevocationReason;
export const AUTH_SESSION_REVOCATION_REASON_LOGOUT_ALL =
  'logout_all' satisfies AuthSessionRevocationReason;
export const AUTH_SESSION_REVOCATION_REASON_ADMIN_REVOKED =
  'admin_revoked' satisfies AuthSessionRevocationReason;
export const AUTH_SESSION_REVOCATION_REASON_PASSWORD_CHANGED =
  'password_changed' satisfies AuthSessionRevocationReason;
export const AUTH_SESSION_REVOCATION_REASON_ACCOUNT_DELETED =
  'account_deleted' satisfies AuthSessionRevocationReason;
export const AUTH_SESSION_REVOCATION_REASON_USER_DEACTIVATED =
  'user_deactivated' satisfies AuthSessionRevocationReason;
export const AUTH_SESSION_REVOCATION_REASON_GUEST_SESSION_ENDED =
  'guest_session_ended' satisfies AuthSessionRevocationReason;
export const AUTH_SESSION_REVOCATION_REASON_GUEST_SESSION_EXPIRED =
  'guest_session_expired' satisfies AuthSessionRevocationReason;
export const AUTH_SESSION_REVOCATION_REASON_GUEST_CONVERTED =
  'guest_converted' satisfies AuthSessionRevocationReason;

export const AUTH_AUDIT_EVENT_TYPES = [
  'SIGN_UP_REQUESTED',
  'EMAIL_VERIFIED',
  'VERIFICATION_OTP_RESENT',
  'LOGIN_SUCCEEDED',
  'LOGIN_FAILED',
  'TOKEN_REFRESHED',
  'LOGOUT',
  'LOGOUT_ALL',
  'SESSION_REVOKED',
  'PASSWORD_RESET_REQUESTED',
  'PASSWORD_RESET_OTP_VERIFIED',
  'PASSWORD_RESET_COMPLETED',
  'PASSWORD_CHANGED',
  'PROFILE_UPDATED',
  'AVATAR_UPLOADED',
  'ACCOUNT_DELETED',
  'USER_DEACTIVATED',
  'USER_REACTIVATED',
  'USER_HARD_DELETED',
  'AUTH_CONTEXT_RESOLVED',
  'GUEST_SESSION_CREATED',
  'GUEST_SESSION_ENDED',
  'GUEST_SESSION_EXPIRED',
  'GUEST_CONVERSION_STARTED',
  'GUEST_CONVERSION_COMPLETED',
  'GUEST_CONVERSION_FAILED',
] as const;

export type AuthAuditEventType = (typeof AUTH_AUDIT_EVENT_TYPES)[number];

export const AUTH_AUDIT_EVENT_SIGN_UP_REQUESTED =
  'SIGN_UP_REQUESTED' satisfies AuthAuditEventType;
export const AUTH_AUDIT_EVENT_EMAIL_VERIFIED =
  'EMAIL_VERIFIED' satisfies AuthAuditEventType;
export const AUTH_AUDIT_EVENT_VERIFICATION_OTP_RESENT =
  'VERIFICATION_OTP_RESENT' satisfies AuthAuditEventType;
export const AUTH_AUDIT_EVENT_LOGIN_SUCCEEDED =
  'LOGIN_SUCCEEDED' satisfies AuthAuditEventType;
export const AUTH_AUDIT_EVENT_LOGIN_FAILED =
  'LOGIN_FAILED' satisfies AuthAuditEventType;
export const AUTH_AUDIT_EVENT_TOKEN_REFRESHED =
  'TOKEN_REFRESHED' satisfies AuthAuditEventType;
export const AUTH_AUDIT_EVENT_LOGOUT = 'LOGOUT' satisfies AuthAuditEventType;
export const AUTH_AUDIT_EVENT_LOGOUT_ALL =
  'LOGOUT_ALL' satisfies AuthAuditEventType;
export const AUTH_AUDIT_EVENT_SESSION_REVOKED =
  'SESSION_REVOKED' satisfies AuthAuditEventType;
export const AUTH_AUDIT_EVENT_PASSWORD_RESET_REQUESTED =
  'PASSWORD_RESET_REQUESTED' satisfies AuthAuditEventType;
export const AUTH_AUDIT_EVENT_PASSWORD_RESET_OTP_VERIFIED =
  'PASSWORD_RESET_OTP_VERIFIED' satisfies AuthAuditEventType;
export const AUTH_AUDIT_EVENT_PASSWORD_RESET_COMPLETED =
  'PASSWORD_RESET_COMPLETED' satisfies AuthAuditEventType;
export const AUTH_AUDIT_EVENT_PASSWORD_CHANGED =
  'PASSWORD_CHANGED' satisfies AuthAuditEventType;
export const AUTH_AUDIT_EVENT_PROFILE_UPDATED =
  'PROFILE_UPDATED' satisfies AuthAuditEventType;
export const AUTH_AUDIT_EVENT_AVATAR_UPLOADED =
  'AVATAR_UPLOADED' satisfies AuthAuditEventType;
export const AUTH_AUDIT_EVENT_ACCOUNT_DELETED =
  'ACCOUNT_DELETED' satisfies AuthAuditEventType;
export const AUTH_AUDIT_EVENT_USER_DEACTIVATED =
  'USER_DEACTIVATED' satisfies AuthAuditEventType;
export const AUTH_AUDIT_EVENT_USER_REACTIVATED =
  'USER_REACTIVATED' satisfies AuthAuditEventType;
export const AUTH_AUDIT_EVENT_USER_HARD_DELETED =
  'USER_HARD_DELETED' satisfies AuthAuditEventType;
export const AUTH_AUDIT_EVENT_AUTH_CONTEXT_RESOLVED =
  'AUTH_CONTEXT_RESOLVED' satisfies AuthAuditEventType;
export const AUTH_AUDIT_EVENT_GUEST_SESSION_CREATED =
  'GUEST_SESSION_CREATED' satisfies AuthAuditEventType;
export const AUTH_AUDIT_EVENT_GUEST_SESSION_ENDED =
  'GUEST_SESSION_ENDED' satisfies AuthAuditEventType;
export const AUTH_AUDIT_EVENT_GUEST_SESSION_EXPIRED =
  'GUEST_SESSION_EXPIRED' satisfies AuthAuditEventType;
export const AUTH_AUDIT_EVENT_GUEST_CONVERSION_STARTED =
  'GUEST_CONVERSION_STARTED' satisfies AuthAuditEventType;
export const AUTH_AUDIT_EVENT_GUEST_CONVERSION_COMPLETED =
  'GUEST_CONVERSION_COMPLETED' satisfies AuthAuditEventType;
export const AUTH_AUDIT_EVENT_GUEST_CONVERSION_FAILED =
  'GUEST_CONVERSION_FAILED' satisfies AuthAuditEventType;

const AUTH_USER_STATUS_SET = new Set<AuthUserStatus>(AUTH_USER_STATUSES);
const AUTH_ACCESS_ALLOWED_USER_STATUS_SET = new Set<AuthUserStatus>(
  AUTH_ACCESS_ALLOWED_USER_STATUSES,
);
const AUTH_SESSION_TYPE_SET = new Set<AuthSessionType>(AUTH_SESSION_TYPES);
const AUTH_SESSION_REVOCATION_REASON_SET = new Set<AuthSessionRevocationReason>(
  AUTH_SESSION_REVOCATION_REASONS,
);
const AUTH_AUDIT_EVENT_TYPE_SET = new Set<AuthAuditEventType>(
  AUTH_AUDIT_EVENT_TYPES,
);

export function isAuthUserStatus(value: string): value is AuthUserStatus {
  return AUTH_USER_STATUS_SET.has(value as AuthUserStatus);
}

export function isAuthAccessAllowedUserStatus(
  value: AuthUserStatus,
): value is AuthAccessAllowedUserStatus {
  return AUTH_ACCESS_ALLOWED_USER_STATUS_SET.has(value);
}

export function isAuthSessionType(value: string): value is AuthSessionType {
  return AUTH_SESSION_TYPE_SET.has(value as AuthSessionType);
}

export function isAuthSessionRevocationReason(
  value: string,
): value is AuthSessionRevocationReason {
  return AUTH_SESSION_REVOCATION_REASON_SET.has(
    value as AuthSessionRevocationReason,
  );
}

export function isAuthAuditEventType(
  value: string,
): value is AuthAuditEventType {
  return AUTH_AUDIT_EVENT_TYPE_SET.has(value as AuthAuditEventType);
}
