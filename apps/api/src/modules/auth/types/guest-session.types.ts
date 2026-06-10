// apps/api/src/modules/auth/types/guest-session.types.ts
/**
 * LAFAM guest session types.
 *
 * Role:
 * - Defines guest-session-specific shapes used by guest services, repositories, guards, and context resolution.
 * - Keeps guest access separate from unauthenticated public access.
 * - Keeps guest-to-customer conversion explicit and impossible to escalate into privileged roles.
 *
 * Important:
 * - Guest is an authenticated anonymous Supabase user plus LAFAM role = guest.
 * - Guest conversion must always create a customer account state.
 * - Guest sessions must be revocable, expirable, auditable, and convertible.
 */

import type { AuthSafeSessionResponse } from './auth-session.types';
import type { AuthSafeUserResponse } from './auth-user.types';

export interface CreateGuestSessionInput {
  readonly deviceId: string | null;
  readonly deviceName: string | null;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly captchaToken: string | null;
}

export interface CreateGuestAppUserInput {
  readonly authUserId: string;
  readonly guestExpiresAt: string;
  readonly metadata?: {
    readonly provider?: 'supabase_anonymous';
    readonly created_from?: 'guest_session';
  };
}

export interface CreateGuestAuthSessionInput {
  readonly userId: string;
  readonly supabaseAuthUserId: string;
  readonly accessTokenHash: string;
  readonly refreshTokenHash: string;
  readonly deviceId: string | null;
  readonly deviceName: string | null;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly expiresAt: string;
}

export interface GuestSessionTokenResult {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number | null;
}

export interface GuestSessionCreationResult extends GuestSessionTokenResult {
  readonly user: AuthSafeUserResponse;
  readonly session: AuthSafeSessionResponse;
}

export interface EndGuestSessionInput {
  readonly userId: string;
  readonly sessionId: string;
  readonly endedAt: string;
}

export interface EndGuestSessionResult {
  readonly sessionId: string;
  readonly endedAt: string;
}

export interface ConvertGuestToCustomerInput {
  readonly guestUserId: string;
  readonly guestAuthUserId: string;
  readonly guestSessionId: string;
  readonly fullName: string;
  readonly email: string;
  readonly phone: string | null;
  readonly password: string;
  readonly timezone: string | null;
}

export interface ConvertedGuestUserUpdateInput {
  readonly userId: string;
  readonly email: string;
  readonly phone: string | null;
  readonly fullName: string;
  readonly timezone: string | null;
  readonly convertedFromGuestAt: string;
}

export interface GuestConversionStartedResult {
  readonly user: AuthSafeUserResponse;
  readonly emailVerificationRequired: true;
}

export interface GuestConversionCompletionInput {
  readonly authUserId: string;
  readonly email: string;
  readonly completedAt: string;
}

export interface GuestConversionCompletionResult {
  readonly user: AuthSafeUserResponse;
  readonly completedAt: string;
}

export interface GuestSessionExpiryInput {
  readonly userId: string;
  readonly sessionId: string;
  readonly expiredAt: string;
}

export interface GuestSessionRateLimitInput {
  readonly ipAddress: string | null;
  readonly windowStartedAt: string;
}

export interface GuestSessionRateLimitResult {
  readonly allowed: boolean;
  readonly currentCount: number;
  readonly maxAllowed: number;
}

export interface GuestAccessState {
  readonly isGuest: boolean;
  readonly isExpired: boolean;
  readonly isRevoked: boolean;
  readonly isConverted: boolean;
}

export interface GuestSessionRepositoryCreateResult {
  readonly user: AuthSafeUserResponse;
  readonly session: AuthSafeSessionResponse;
}

export interface GuestSessionPublicData {
  readonly id: string;
  readonly type: 'guest';
  readonly expires_at: string;
}

export interface GuestUserPublicData {
  readonly id: string;
  readonly role: 'guest';
  readonly status: 'guest_active';
  readonly is_guest: true;
  readonly guest_expires_at: string;
}
