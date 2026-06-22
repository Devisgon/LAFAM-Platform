// apps/api/src/modules/auth/types/auth-session.types.ts
/**
 * LAFAM Auth session types.
 *
 * Role:
 * - Defines internal session shapes used by repositories, services, guards, and session controllers.
 * - Keeps session state aligned with the approved auth_sessions migration.
 * - Separates raw token handling from API-safe session response objects.
 *
 * Important:
 * - Never expose access_token_hash or refresh_token_hash in API responses.
 * - Never store or log raw access tokens or raw refresh tokens.
 * - Session revocation is enforced at the LAFAM application layer because provider JWTs may remain valid until expiry.
 */

import type { AuthSessionRow } from '../../../database/database.types';
import type {
  AuthSessionRevocationReason,
  AuthSessionType,
} from '../constants/auth.constants';

export interface AuthSessionDeviceMetadata {
  readonly deviceId: string | null;
  readonly deviceName: string | null;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

export interface AuthSessionInternal {
  readonly id: string;
  readonly userId: string;
  readonly supabaseAuthUserId: string;
  readonly accessTokenHash: string;
  readonly refreshTokenHash: string;
  readonly sessionType: AuthSessionType;
  readonly deviceId: string | null;
  readonly deviceName: string | null;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly createdAt: string;
  readonly lastSeenAt: string | null;
  readonly expiresAt: string | null;
  readonly revokedAt: string | null;
  readonly revokedReason: string | null;
  readonly convertedAt: string | null;
}

export interface AuthResolvedSession {
  readonly id: string;
  readonly userId: string;
  readonly supabaseAuthUserId: string;
  readonly sessionType: AuthSessionType;
  readonly expiresAt: string | null;
  readonly revokedAt: string | null;
  readonly revokedReason: string | null;
  readonly convertedAt: string | null;
}

export interface AuthSafeSessionResponse {
  readonly id: string;
  readonly type: AuthSessionType;
  readonly device_id: string | null;
  readonly device_name: string | null;
  readonly ip_address: string | null;
  readonly user_agent: string | null;
  readonly created_at: string;
  readonly last_seen_at: string | null;
  readonly expires_at: string | null;
  readonly revoked_at: string | null;
  readonly revoked_reason: string | null;
  readonly converted_at: string | null;
}

export interface AuthActiveSessionResponse {
  readonly id: string;
  readonly type: AuthSessionType;
  readonly device_id: string | null;
  readonly device_name: string | null;
  readonly ip_address: string | null;
  readonly user_agent: string | null;
  readonly created_at: string;
  readonly last_seen_at: string | null;
  readonly expires_at: string | null;
  readonly is_current: boolean;
}

export interface AuthSessionListResult {
  readonly sessions: readonly AuthActiveSessionResponse[];
  readonly total: number;
}

export interface CreateAuthSessionInput {
  readonly userId: string;
  readonly supabaseAuthUserId: string;
  readonly accessTokenHash: string;
  readonly refreshTokenHash: string;
  readonly sessionType: AuthSessionType;
  readonly deviceId?: string | null;
  readonly deviceName?: string | null;
  readonly ipAddress?: string | null;
  readonly userAgent?: string | null;
  readonly expiresAt?: string | null;
}

export interface UpdateAuthSessionTokenHashesInput {
  readonly sessionId: string;
  readonly previousRefreshTokenHash: string;
  readonly accessTokenHash: string;
  readonly refreshTokenHash: string;
  readonly expiresAt?: string | null;
  readonly lastSeenAt: string;
}

export interface UpdateAuthSessionLastSeenInput {
  readonly sessionId: string;
  readonly lastSeenAt: string;
}

export interface RevokeAuthSessionInput {
  readonly sessionId: string;
  readonly revokedAt: string;
  readonly revokedReason: AuthSessionRevocationReason;
}

export interface RevokeAllAuthSessionsInput {
  readonly userId: string;
  readonly revokedAt: string;
  readonly revokedReason: AuthSessionRevocationReason;
  readonly excludeSessionId?: string;
}

export interface MarkGuestSessionConvertedInput {
  readonly sessionId: string;
  readonly convertedAt: string;
}

export interface FindAuthSessionByAccessTokenHashInput {
  readonly accessTokenHash: string;
}

export interface FindAuthSessionByRefreshTokenHashInput {
  readonly refreshTokenHash: string;
}

export interface AuthSessionTokenPair {
  readonly accessToken: string;
  readonly refreshToken: string;
}

export interface AuthSessionHashPair {
  readonly accessTokenHash: string;
  readonly refreshTokenHash: string;
}

export interface AuthSessionExpiryState {
  readonly isExpired: boolean;
  readonly expiresAt: string | null;
}

export function mapAuthSessionRowToInternal(
  row: AuthSessionRow,
): AuthSessionInternal {
  return {
    id: row.id,
    userId: row.user_id,
    supabaseAuthUserId: row.supabase_auth_user_id,
    accessTokenHash: row.access_token_hash,
    refreshTokenHash: row.refresh_token_hash,
    sessionType: row.session_type,
    deviceId: row.device_id,
    deviceName: row.device_name,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    revokedReason: row.revoked_reason,
    convertedAt: row.converted_at,
  };
}

export function mapAuthSessionRowToResolvedSession(
  row: AuthSessionRow,
): AuthResolvedSession {
  return {
    id: row.id,
    userId: row.user_id,
    supabaseAuthUserId: row.supabase_auth_user_id,
    sessionType: row.session_type,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    revokedReason: row.revoked_reason,
    convertedAt: row.converted_at,
  };
}

export function mapAuthSessionRowToSafeSessionResponse(
  row: AuthSessionRow,
): AuthSafeSessionResponse {
  return {
    id: row.id,
    type: row.session_type,
    device_id: row.device_id,
    device_name: row.device_name,
    ip_address: row.ip_address,
    user_agent: row.user_agent,
    created_at: row.created_at,
    last_seen_at: row.last_seen_at,
    expires_at: row.expires_at,
    revoked_at: row.revoked_at,
    revoked_reason: row.revoked_reason,
    converted_at: row.converted_at,
  };
}

export function mapAuthSessionRowToActiveSessionResponse(
  row: AuthSessionRow,
  currentSessionId: string,
): AuthActiveSessionResponse {
  return {
    id: row.id,
    type: row.session_type,
    device_id: row.device_id,
    device_name: row.device_name,
    ip_address: row.ip_address,
    user_agent: row.user_agent,
    created_at: row.created_at,
    last_seen_at: row.last_seen_at,
    expires_at: row.expires_at,
    is_current: row.id === currentSessionId,
  };
}
