// apps/api/src/modules/auth/types/auth-response.types.ts
/**
 * LAFAM Auth response types.
 *
 * Role:
 * - Defines data payload shapes returned by Auth services.
 * - Keeps controllers thin by giving them stable response data contracts.
 * - Keeps token, user, session, avatar, admin, reset, and guest response shapes consistent.
 *
 * Important:
 * - Controllers wrap these data payloads with createApiSuccessResponse.
 * - Never expose token hashes.
 * - Never expose raw provider metadata.
 * - Access tokens, refresh tokens, and reset tokens may be returned only where the Auth flow explicitly requires them.
 */

import type { AuthContextData } from './auth-context.types';
import type {
  AuthActiveSessionResponse,
  AuthSafeSessionResponse,
} from './auth-session.types';
import type {
  AuthAdminUserResponse,
  AuthSafeUserResponse,
  AuthUserListResult,
} from './auth-user.types';

export interface AuthTokenResponse {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly token_type: 'bearer';
  readonly expires_in: number | null;
}

export interface AuthSessionCreatedResponse extends AuthTokenResponse {
  readonly user: AuthSafeUserResponse;
  readonly session: AuthSafeSessionResponse;
}

export interface AuthSignUpResponse {
  readonly user: AuthSafeUserResponse;
  readonly email_verification_required: boolean;
}

export interface AuthEmailVerificationResponse {
  readonly user: AuthSafeUserResponse;
  readonly verified: true;
}

export interface AuthResendVerificationOtpResponse {
  readonly email: string;
  readonly sent: true;
}

export interface AuthLoginResponse extends AuthSessionCreatedResponse {
  readonly authenticated: true;
}

export interface AuthRefreshTokenResponse extends AuthTokenResponse {
  readonly session: AuthSafeSessionResponse;
}

export interface AuthLogoutResponse {
  readonly logged_out: true;
  readonly session_id: string;
}

export interface AuthLogoutAllResponse {
  readonly logged_out_all: true;
  readonly revoked_sessions: number;
}

export interface AuthSessionListResponse {
  readonly sessions: readonly AuthActiveSessionResponse[];
  readonly total: number;
}

export interface AuthRevokeSessionResponse {
  readonly revoked: true;
  readonly session_id: string;
}

export interface AuthForgotPasswordResponse {
  readonly email: string;
  readonly reset_otp_sent: true;
}

export interface AuthVerifyResetOtpResponse {
  readonly email: string;
  readonly reset_token: string;
  readonly reset_token_expires_at: string;
}

export interface AuthResetPasswordResponse {
  readonly password_reset: true;
}

export interface AuthChangePasswordResponse {
  readonly password_changed: true;
  readonly sessions_revoked: true;
}

export interface AuthCurrentUserResponse {
  readonly user: AuthSafeUserResponse;
}

export interface AuthUpdateProfileResponse {
  readonly user: AuthSafeUserResponse;
}

export interface AuthAvatarUploadResponse {
  readonly avatar_path: string;
  readonly avatar_url: string;
}

export interface AuthAvatarResponse {
  readonly avatar_path: string | null;
  readonly avatar_url: string | null;
}

export interface AuthDeleteAccountResponse {
  readonly account_deleted: true;
  readonly user_id: string;
}

export type AuthAdminUserListResponse = AuthUserListResult;

export interface AuthAdminUserMutationResponse {
  readonly user: AuthAdminUserResponse;
}

export interface AuthAdminHardDeleteUserResponse {
  readonly hard_deleted: true;
  readonly user_id: string;
}

export interface AuthGuestSessionResponse extends AuthSessionCreatedResponse {
  readonly guest: true;
}

export interface AuthGuestConversionResponse {
  readonly user: AuthSafeUserResponse;
  readonly email_verification_required: true;
  readonly guest_converted: true;
}

export interface AuthEndGuestSessionResponse {
  readonly guest_session_ended: true;
  readonly session_id: string;
}

export interface AuthContextResponse {
  readonly context: AuthContextData;
}

export interface AuthGenericMessageResponse {
  readonly message: string;
}

export type AuthPublicResponse =
  | AuthSignUpResponse
  | AuthEmailVerificationResponse
  | AuthResendVerificationOtpResponse
  | AuthLoginResponse
  | AuthRefreshTokenResponse
  | AuthForgotPasswordResponse
  | AuthVerifyResetOtpResponse
  | AuthResetPasswordResponse;

export type AuthProtectedResponse =
  | AuthLogoutResponse
  | AuthLogoutAllResponse
  | AuthSessionListResponse
  | AuthRevokeSessionResponse
  | AuthCurrentUserResponse
  | AuthUpdateProfileResponse
  | AuthAvatarUploadResponse
  | AuthAvatarResponse
  | AuthChangePasswordResponse
  | AuthDeleteAccountResponse
  | AuthContextResponse;

export type AuthGuestResponse =
  | AuthGuestSessionResponse
  | AuthGuestConversionResponse
  | AuthEndGuestSessionResponse;

export type AuthAdminResponse =
  | AuthAdminUserListResponse
  | AuthAdminUserMutationResponse
  | AuthAdminHardDeleteUserResponse;
