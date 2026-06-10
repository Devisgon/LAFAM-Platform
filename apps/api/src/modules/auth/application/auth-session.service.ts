// apps/api/src/modules/auth/application/auth-session.service.ts
/**
 * LAFAM Auth session service.
 *
 * Role:
 * - Owns protected session operations.
 * - Logs out the current session.
 * - Logs out all user sessions.
 * - Lists active sessions.
 * - Revokes one user-owned session.
 *
 * Important:
 * - AuthGuard must resolve and attach Auth context before this service is used.
 * - ActiveSessionGuard must reject revoked/expired sessions before controller access.
 * - App-owned session revocation is the source of truth for protected API access.
 * - Supabase provider logout is best-effort because LAFAM still rejects revoked sessions at the app layer.
 */

import { Injectable } from '@nestjs/common';

import {
  AUTH_AUDIT_EVENT_LOGOUT,
  AUTH_AUDIT_EVENT_LOGOUT_ALL,
  AUTH_AUDIT_EVENT_SESSION_REVOKED,
  AUTH_SESSION_REVOCATION_REASON_ADMIN_REVOKED,
  AUTH_SESSION_REVOCATION_REASON_LOGOUT,
  AUTH_SESSION_REVOCATION_REASON_LOGOUT_ALL,
} from '../constants/auth.constants';
import { AuthAuditRepository } from '../repositories/auth-audit.repository';
import { AuthSessionRepository } from '../repositories/auth-session.repository';
import { SupabaseAuthRepository } from '../repositories/supabase-auth.repository';
import type { AuthInternalContext } from '../types/auth-context.types';
import type {
  AuthLogoutAllResponse,
  AuthLogoutResponse,
  AuthRevokeSessionResponse,
  AuthSessionListResponse,
} from '../types/auth-response.types';

export interface AuthSessionServiceRequestMetadata {
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

export interface AuthSessionProviderTokenInput {
  readonly accessToken?: string | null;
}

export interface RevokeSessionInput {
  readonly sessionId: string;
}

const EMPTY_REQUEST_METADATA: AuthSessionServiceRequestMetadata = {
  ipAddress: null,
  userAgent: null,
};

const EMPTY_PROVIDER_TOKEN_INPUT: AuthSessionProviderTokenInput = {
  accessToken: null,
};

@Injectable()
export class AuthSessionService {
  constructor(
    private readonly supabaseAuthRepository: SupabaseAuthRepository,
    private readonly authSessionRepository: AuthSessionRepository,
    private readonly authAuditRepository: AuthAuditRepository,
  ) {}

  async logout(
    auth: AuthInternalContext,
    providerToken: AuthSessionProviderTokenInput = EMPTY_PROVIDER_TOKEN_INPUT,
    request: AuthSessionServiceRequestMetadata = EMPTY_REQUEST_METADATA,
  ): Promise<AuthLogoutResponse> {
    const revokedAt = new Date().toISOString();

    const revokedSession = await this.authSessionRepository.revokeByIdForUser({
      sessionId: auth.session.id,
      userId: auth.profile.id,
      revokedAt,
      revokedReason: AUTH_SESSION_REVOCATION_REASON_LOGOUT,
    });

    await this.signOutProviderSessionIfPossible({
      accessToken: providerToken.accessToken ?? null,
      scope: 'local',
    });

    await this.authAuditRepository.createEvent({
      actorUserId: auth.profile.id,
      targetUserId: auth.profile.id,
      eventType: AUTH_AUDIT_EVENT_LOGOUT,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      metadata: {
        session_id: revokedSession.id,
        revoked_at: revokedAt,
      },
    });

    return {
      logged_out: true,
      session_id: revokedSession.id,
    };
  }

  async logoutAll(
    auth: AuthInternalContext,
    providerToken: AuthSessionProviderTokenInput = EMPTY_PROVIDER_TOKEN_INPUT,
    request: AuthSessionServiceRequestMetadata = EMPTY_REQUEST_METADATA,
  ): Promise<AuthLogoutAllResponse> {
    const revokedAt = new Date().toISOString();

    const revokedSessions = await this.authSessionRepository.revokeAllForUser({
      userId: auth.profile.id,
      revokedAt,
      revokedReason: AUTH_SESSION_REVOCATION_REASON_LOGOUT_ALL,
    });

    await this.signOutProviderSessionIfPossible({
      accessToken: providerToken.accessToken ?? null,
      scope: 'global',
    });

    await this.authAuditRepository.createEvent({
      actorUserId: auth.profile.id,
      targetUserId: auth.profile.id,
      eventType: AUTH_AUDIT_EVENT_LOGOUT_ALL,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      metadata: {
        session_id: auth.session.id,
        revoked_sessions: revokedSessions,
        revoked_at: revokedAt,
      },
    });

    return {
      logged_out_all: true,
      revoked_sessions: revokedSessions,
    };
  }

  async listActiveSessions(
    auth: AuthInternalContext,
  ): Promise<AuthSessionListResponse> {
    const result = await this.authSessionRepository.listActiveByUserId({
      userId: auth.profile.id,
      currentSessionId: auth.session.id,
    });

    return {
      sessions: result.sessions,
      total: result.total,
    };
  }

  async revokeSession(
    auth: AuthInternalContext,
    input: RevokeSessionInput,
    request: AuthSessionServiceRequestMetadata = EMPTY_REQUEST_METADATA,
  ): Promise<AuthRevokeSessionResponse> {
    const revokedAt = new Date().toISOString();

    const revokedSession = await this.authSessionRepository.revokeByIdForUser({
      sessionId: input.sessionId,
      userId: auth.profile.id,
      revokedAt,
      revokedReason: AUTH_SESSION_REVOCATION_REASON_ADMIN_REVOKED,
    });

    await this.authAuditRepository.createEvent({
      actorUserId: auth.profile.id,
      targetUserId: auth.profile.id,
      eventType: AUTH_AUDIT_EVENT_SESSION_REVOKED,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      metadata: {
        session_id: revokedSession.id,
        revoked_by_user_id: auth.profile.id,
        revoked_at: revokedAt,
      },
    });

    return {
      revoked: true,
      session_id: revokedSession.id,
    };
  }

  private async signOutProviderSessionIfPossible(input: {
    readonly accessToken: string | null;
    readonly scope: 'global' | 'local';
  }): Promise<void> {
    if (!input.accessToken) {
      return;
    }

    try {
      await this.supabaseAuthRepository.signOutWithAccessToken({
        accessToken: input.accessToken,
        scope: input.scope,
      });
    } catch (error) {
      void error;
    }
  }
}
