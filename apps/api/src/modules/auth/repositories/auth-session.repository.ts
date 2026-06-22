// apps/api/src/modules/auth/repositories/auth-session.repository.ts
/**
 * LAFAM Auth session repository.
 *
 * Role:
 * - Owns all auth_sessions table access for the Auth module.
 * - Supports app-level session revocation, refresh-token lookup, active-session listing, and guest-session state.
 * - Keeps raw token hashes inside repository/service boundaries and out of API responses.
 *
 * Important:
 * - Never store raw access tokens or refresh tokens.
 * - Never expose token hashes in controller responses.
 * - Revoked sessions must be rejected by guards even if the provider JWT still validates.
 */

import { Inject, Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { SUPABASE_ADMIN_CLIENT } from '../../../database/database.constants';
import type {
  AuthSessionInsert,
  AuthSessionRow,
  AuthSessionUpdate,
  LAFAMSupabaseClient,
} from '../../../database/database.types';
import { AUTH_SESSION_TYPE_GUEST } from '../constants/auth.constants';
import type {
  AuthActiveSessionResponse,
  AuthResolvedSession,
  AuthSessionInternal,
  AuthSessionListResult,
  CreateAuthSessionInput,
  FindAuthSessionByAccessTokenHashInput,
  FindAuthSessionByRefreshTokenHashInput,
  MarkGuestSessionConvertedInput,
  RevokeAllAuthSessionsInput,
  RevokeAuthSessionInput,
  UpdateAuthSessionLastSeenInput,
  UpdateAuthSessionTokenHashesInput,
} from '../types/auth-session.types';
import {
  mapAuthSessionRowToActiveSessionResponse,
  mapAuthSessionRowToInternal,
  mapAuthSessionRowToResolvedSession,
} from '../types/auth-session.types';

export interface FindAuthSessionByIdInput {
  readonly sessionId: string;
}

export interface FindAuthSessionByIdForUserInput {
  readonly sessionId: string;
  readonly userId: string;
}

export interface ListActiveAuthSessionsByUserIdInput {
  readonly userId: string;
  readonly currentSessionId: string;
  readonly now?: string;
}

export interface CountGuestSessionsByIpSinceInput {
  readonly ipAddress: string | null;
  readonly windowStartedAt: string;
}

const POSTGRES_UNIQUE_VIOLATION_CODE = '23505';

function isDatabaseError(value: unknown): value is {
  readonly code?: string;
  readonly message?: string;
} {
  return typeof value === 'object' && value !== null;
}

function mapDatabaseError(error: unknown): AppError {
  if (isDatabaseError(error) && error.code === POSTGRES_UNIQUE_VIOLATION_CODE) {
    return AppError.conflict(
      'The session conflicts with an existing session record.',
    );
  }

  return AppError.databaseOperationFailed(error);
}

function assertAuthSessionRow(
  row: AuthSessionRow | null,
  details?: Record<string, unknown>,
): AuthSessionRow {
  if (!row) {
    throw AppError.sessionNotFound(
      'The requested session was not found.',
      details,
    );
  }

  return row;
}

@Injectable()
export class AuthSessionRepository {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly adminClient: LAFAMSupabaseClient,
  ) {}

  async createSession(
    input: CreateAuthSessionInput,
  ): Promise<AuthSessionInternal> {
    const insertPayload: AuthSessionInsert = {
      user_id: input.userId,
      supabase_auth_user_id: input.supabaseAuthUserId,
      access_token_hash: input.accessTokenHash,
      refresh_token_hash: input.refreshTokenHash,
      session_type: input.sessionType,
      device_id: input.deviceId ?? null,
      device_name: input.deviceName ?? null,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
      expires_at: input.expiresAt ?? null,
    };

    const { data, error } = await this.adminClient
      .from('auth_sessions')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      throw mapDatabaseError(error);
    }

    return mapAuthSessionRowToInternal(assertAuthSessionRow(data));
  }

  async findById(
    input: FindAuthSessionByIdInput,
  ): Promise<AuthSessionInternal | null> {
    const { data, error } = await this.adminClient
      .from('auth_sessions')
      .select('*')
      .eq('id', input.sessionId)
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data ? mapAuthSessionRowToInternal(data) : null;
  }

  async getById(input: FindAuthSessionByIdInput): Promise<AuthSessionInternal> {
    const session = await this.findById(input);

    if (!session) {
      throw AppError.sessionNotFound('The requested session was not found.', {
        session_id: input.sessionId,
      });
    }

    return session;
  }

  async findByIdForUser(
    input: FindAuthSessionByIdForUserInput,
  ): Promise<AuthSessionInternal | null> {
    const { data, error } = await this.adminClient
      .from('auth_sessions')
      .select('*')
      .eq('id', input.sessionId)
      .eq('user_id', input.userId)
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data ? mapAuthSessionRowToInternal(data) : null;
  }

  async getByIdForUser(
    input: FindAuthSessionByIdForUserInput,
  ): Promise<AuthSessionInternal> {
    const session = await this.findByIdForUser(input);

    if (!session) {
      throw AppError.sessionNotFound('The requested session was not found.', {
        session_id: input.sessionId,
        user_id: input.userId,
      });
    }

    return session;
  }

  async findByAccessTokenHash(
    input: FindAuthSessionByAccessTokenHashInput,
  ): Promise<AuthResolvedSession | null> {
    const { data, error } = await this.adminClient
      .from('auth_sessions')
      .select('*')
      .eq('access_token_hash', input.accessTokenHash)
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data ? mapAuthSessionRowToResolvedSession(data) : null;
  }

  async findByRefreshTokenHash(
    input: FindAuthSessionByRefreshTokenHashInput,
  ): Promise<AuthSessionInternal | null> {
    const { data, error } = await this.adminClient
      .from('auth_sessions')
      .select('*')
      .eq('refresh_token_hash', input.refreshTokenHash)
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data ? mapAuthSessionRowToInternal(data) : null;
  }

  async updateTokenHashes(
    input: UpdateAuthSessionTokenHashesInput,
  ): Promise<AuthSessionInternal | null> {
    const updatePayload: AuthSessionUpdate = {
      access_token_hash: input.accessTokenHash,
      refresh_token_hash: input.refreshTokenHash,
      last_seen_at: input.lastSeenAt,
      ...(input.expiresAt !== undefined ? { expires_at: input.expiresAt } : {}),
    };

    const { data, error } = await this.adminClient
      .from('auth_sessions')
      .update(updatePayload)
      .eq('id', input.sessionId)
      .eq('refresh_token_hash', input.previousRefreshTokenHash)
      .is('revoked_at', null)
      .is('converted_at', null)
      .select('*')
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data ? mapAuthSessionRowToInternal(data) : null;
  }

  async updateLastSeen(
    input: UpdateAuthSessionLastSeenInput,
  ): Promise<AuthSessionInternal> {
    const updatePayload: AuthSessionUpdate = {
      last_seen_at: input.lastSeenAt,
    };

    const { data, error } = await this.adminClient
      .from('auth_sessions')
      .update(updatePayload)
      .eq('id', input.sessionId)
      .is('revoked_at', null)
      .select('*')
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return mapAuthSessionRowToInternal(
      assertAuthSessionRow(data, {
        session_id: input.sessionId,
      }),
    );
  }

  async revokeById(
    input: RevokeAuthSessionInput,
  ): Promise<AuthSessionInternal> {
    const updatePayload: AuthSessionUpdate = {
      revoked_at: input.revokedAt,
      revoked_reason: input.revokedReason,
    };

    const { data, error } = await this.adminClient
      .from('auth_sessions')
      .update(updatePayload)
      .eq('id', input.sessionId)
      .is('revoked_at', null)
      .select('*')
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return mapAuthSessionRowToInternal(
      assertAuthSessionRow(data, {
        session_id: input.sessionId,
      }),
    );
  }

  async revokeByIdForUser(
    input: RevokeAuthSessionInput & { readonly userId: string },
  ): Promise<AuthSessionInternal> {
    const updatePayload: AuthSessionUpdate = {
      revoked_at: input.revokedAt,
      revoked_reason: input.revokedReason,
    };

    const { data, error } = await this.adminClient
      .from('auth_sessions')
      .update(updatePayload)
      .eq('id', input.sessionId)
      .eq('user_id', input.userId)
      .is('revoked_at', null)
      .select('*')
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return mapAuthSessionRowToInternal(
      assertAuthSessionRow(data, {
        session_id: input.sessionId,
        user_id: input.userId,
      }),
    );
  }

  async revokeAllForUser(input: RevokeAllAuthSessionsInput): Promise<number> {
    const updatePayload: AuthSessionUpdate = {
      revoked_at: input.revokedAt,
      revoked_reason: input.revokedReason,
    };

    let query = this.adminClient
      .from('auth_sessions')
      .update(updatePayload)
      .eq('user_id', input.userId)
      .is('revoked_at', null);

    if (input.excludeSessionId) {
      query = query.neq('id', input.excludeSessionId);
    }

    const { data, error } = await query.select('id');

    if (error) {
      throw mapDatabaseError(error);
    }

    return data?.length ?? 0;
  }

  async markGuestSessionConverted(
    input: MarkGuestSessionConvertedInput,
  ): Promise<AuthSessionInternal> {
    const updatePayload: AuthSessionUpdate = {
      converted_at: input.convertedAt,
    };

    const { data, error } = await this.adminClient
      .from('auth_sessions')
      .update(updatePayload)
      .eq('id', input.sessionId)
      .eq('session_type', AUTH_SESSION_TYPE_GUEST)
      .is('revoked_at', null)
      .is('converted_at', null)
      .select('*')
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return mapAuthSessionRowToInternal(
      assertAuthSessionRow(data, {
        session_id: input.sessionId,
      }),
    );
  }

  async listActiveByUserId(
    input: ListActiveAuthSessionsByUserIdInput,
  ): Promise<AuthSessionListResult> {
    const now = input.now ?? new Date().toISOString();

    const { data, error } = await this.adminClient
      .from('auth_sessions')
      .select('*')
      .eq('user_id', input.userId)
      .is('revoked_at', null)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('created_at', { ascending: false });

    if (error) {
      throw mapDatabaseError(error);
    }

    const sessions: AuthActiveSessionResponse[] = (data ?? []).map((row) =>
      mapAuthSessionRowToActiveSessionResponse(row, input.currentSessionId),
    );

    return {
      sessions,
      total: sessions.length,
    };
  }

  async countGuestSessionsByIpSince(
    input: CountGuestSessionsByIpSinceInput,
  ): Promise<number> {
    if (!input.ipAddress) {
      return 0;
    }

    const { count, error } = await this.adminClient
      .from('auth_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('session_type', AUTH_SESSION_TYPE_GUEST)
      .eq('ip_address', input.ipAddress)
      .gte('created_at', input.windowStartedAt);

    if (error) {
      throw mapDatabaseError(error);
    }

    return count ?? 0;
  }
}
