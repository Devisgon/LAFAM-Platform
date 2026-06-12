// apps/api/src/modules/auth/repositories/guest-session.repository.ts
/**
 * LAFAM guest session repository.
 *
 * Role:
 * - Owns guest-specific app_users and auth_sessions database operations.
 * - Supports guest user creation, guest session creation, guest conversion, guest expiry, and guest revocation.
 * - Keeps guest database mutation logic out of services/controllers.
 *
 * Important:
 * - Guest is an authenticated anonymous Supabase user plus LAFAM role = guest.
 * - Guest conversion must always produce customer role only.
 * - This repository stores token hashes only. It never stores raw access or refresh tokens.
 */

import { Inject, Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { SUPABASE_ADMIN_CLIENT } from '../../../database/database.constants';
import type {
  AppUserInsert,
  AppUserRow,
  AppUserUpdate,
  AuthSessionInsert,
  AuthSessionRow,
  AuthSessionUpdate,
  LAFAMSupabaseClient,
} from '../../../database/database.types';
import {
  AUTH_CUSTOMER_ROLE,
  AUTH_GUEST_ROLE,
} from '../constants/auth-role.constants';
import {
  AUTH_SESSION_REVOCATION_REASON_GUEST_CONVERTED,
  AUTH_SESSION_REVOCATION_REASON_GUEST_SESSION_ENDED,
  AUTH_SESSION_REVOCATION_REASON_GUEST_SESSION_EXPIRED,
  AUTH_SESSION_TYPE_GUEST,
  AUTH_USER_STATUS_DELETED,
  AUTH_USER_STATUS_GUEST_ACTIVE,
  AUTH_USER_STATUS_PENDING_EMAIL_VERIFICATION,
} from '../constants/auth.constants';
import {
  mapAuthSessionRowToSafeSessionResponse,
  type AuthSafeSessionResponse,
} from '../types/auth-session.types';
import {
  mapAppUserRowToInternalProfile,
  mapAppUserRowToSafeUserResponse,
  type AuthSafeUserResponse,
  type AuthUserInternalProfile,
} from '../types/auth-user.types';
import type {
  ConvertedGuestUserUpdateInput,
  CreateGuestAppUserInput,
  CreateGuestAuthSessionInput,
  EndGuestSessionInput,
  EndGuestSessionResult,
  GuestSessionExpiryInput,
  GuestSessionRepositoryCreateResult,
} from '../types/guest-session.types';

export interface FindGuestUserByIdInput {
  readonly userId: string;
}

export interface FindGuestSessionByIdInput {
  readonly sessionId: string;
}

export interface FindGuestSessionByUserIdInput {
  readonly userId: string;
}

export type ConvertGuestUserByIdInput = ConvertedGuestUserUpdateInput;

export interface MarkGuestSessionConvertedByIdInput {
  readonly sessionId: string;
  readonly convertedAt: string;
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
      'The guest session conflicts with an existing record.',
    );
  }

  return AppError.databaseOperationFailed(error);
}

function assertAppUserRow(
  row: AppUserRow | null,
  details?: Record<string, unknown>,
): AppUserRow {
  if (!row) {
    throw AppError.userNotFound(
      'The requested guest user was not found.',
      details,
    );
  }

  return row;
}

function assertAuthSessionRow(
  row: AuthSessionRow | null,
  details?: Record<string, unknown>,
): AuthSessionRow {
  if (!row) {
    throw AppError.sessionNotFound(
      'The requested guest session was not found.',
      details,
    );
  }

  return row;
}

@Injectable()
export class GuestSessionRepository {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly adminClient: LAFAMSupabaseClient,
  ) {}

  async createGuestAppUser(
    input: CreateGuestAppUserInput,
  ): Promise<AuthSafeUserResponse> {
    const insertPayload: AppUserInsert = {
      auth_user_id: input.authUserId,
      email: null,
      phone: null,
      full_name: null,
      role: AUTH_GUEST_ROLE,
      status: AUTH_USER_STATUS_GUEST_ACTIVE,
      is_guest: true,
      metadata: input.metadata ?? {
        provider: 'supabase_anonymous',
        created_from: 'guest_session',
      },
      guest_expires_at: input.guestExpiresAt,
    };

    const { data, error } = await this.adminClient
      .from('app_users')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      throw mapDatabaseError(error);
    }

    return mapAppUserRowToSafeUserResponse(assertAppUserRow(data));
  }

  async createGuestAuthSession(
    input: CreateGuestAuthSessionInput,
  ): Promise<AuthSafeSessionResponse> {
    const insertPayload: AuthSessionInsert = {
      user_id: input.userId,
      supabase_auth_user_id: input.supabaseAuthUserId,
      access_token_hash: input.accessTokenHash,
      refresh_token_hash: input.refreshTokenHash,
      session_type: AUTH_SESSION_TYPE_GUEST,
      device_id: input.deviceId,
      device_name: input.deviceName,
      ip_address: input.ipAddress,
      user_agent: input.userAgent,
      expires_at: input.expiresAt,
    };

    const { data, error } = await this.adminClient
      .from('auth_sessions')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      throw mapDatabaseError(error);
    }

    return mapAuthSessionRowToSafeSessionResponse(assertAuthSessionRow(data));
  }

  async createGuestUserAndSession(input: {
    readonly user: CreateGuestAppUserInput;
    readonly session: Omit<CreateGuestAuthSessionInput, 'userId'>;
  }): Promise<GuestSessionRepositoryCreateResult> {
    const user = await this.createGuestAppUser(input.user);

    const session = await this.createGuestAuthSession({
      ...input.session,
      userId: user.id,
    });

    return {
      user,
      session,
    };
  }

  async findGuestUserById(
    input: FindGuestUserByIdInput,
  ): Promise<AuthUserInternalProfile | null> {
    const { data, error } = await this.adminClient
      .from('app_users')
      .select('*')
      .eq('id', input.userId)
      .eq('role', AUTH_GUEST_ROLE)
      .eq('is_guest', true)
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data ? mapAppUserRowToInternalProfile(data) : null;
  }

  async getGuestUserById(
    input: FindGuestUserByIdInput,
  ): Promise<AuthUserInternalProfile> {
    const user = await this.findGuestUserById(input);

    if (!user) {
      throw AppError.guestSessionRequired(
        'A valid guest user is required for this action.',
      );
    }

    return user;
  }

  async findGuestSessionById(
    input: FindGuestSessionByIdInput,
  ): Promise<AuthSafeSessionResponse | null> {
    const { data, error } = await this.adminClient
      .from('auth_sessions')
      .select('*')
      .eq('id', input.sessionId)
      .eq('session_type', AUTH_SESSION_TYPE_GUEST)
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data ? mapAuthSessionRowToSafeSessionResponse(data) : null;
  }

  async getGuestSessionById(
    input: FindGuestSessionByIdInput,
  ): Promise<AuthSafeSessionResponse> {
    const session = await this.findGuestSessionById(input);

    if (!session) {
      throw AppError.guestSessionRequired(
        'A valid guest session is required for this action.',
      );
    }

    return session;
  }

  async findActiveGuestSessionByUserId(
    input: FindGuestSessionByUserIdInput,
  ): Promise<AuthSafeSessionResponse | null> {
    const { data, error } = await this.adminClient
      .from('auth_sessions')
      .select('*')
      .eq('user_id', input.userId)
      .eq('session_type', AUTH_SESSION_TYPE_GUEST)
      .is('revoked_at', null)
      .is('converted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data ? mapAuthSessionRowToSafeSessionResponse(data) : null;
  }

  async endGuestSession(
    input: EndGuestSessionInput,
  ): Promise<EndGuestSessionResult> {
    const updatePayload: AuthSessionUpdate = {
      revoked_at: input.endedAt,
      revoked_reason: AUTH_SESSION_REVOCATION_REASON_GUEST_SESSION_ENDED,
    };

    const { data, error } = await this.adminClient
      .from('auth_sessions')
      .update(updatePayload)
      .eq('id', input.sessionId)
      .eq('user_id', input.userId)
      .eq('session_type', AUTH_SESSION_TYPE_GUEST)
      .is('revoked_at', null)
      .select('*')
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    const session = assertAuthSessionRow(data, {
      session_id: input.sessionId,
      user_id: input.userId,
    });

    return {
      sessionId: session.id,
      endedAt: input.endedAt,
    };
  }

  async markGuestSessionConverted(
    input: MarkGuestSessionConvertedByIdInput,
  ): Promise<AuthSafeSessionResponse> {
    const updatePayload: AuthSessionUpdate = {
      converted_at: input.convertedAt,
      revoked_at: input.convertedAt,
      revoked_reason: AUTH_SESSION_REVOCATION_REASON_GUEST_CONVERTED,
    };

    const { data, error } = await this.adminClient
      .from('auth_sessions')
      .update(updatePayload)
      .eq('id', input.sessionId)
      .eq('session_type', AUTH_SESSION_TYPE_GUEST)
      .is('converted_at', null)
      .select('*')
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return mapAuthSessionRowToSafeSessionResponse(
      assertAuthSessionRow(data, {
        session_id: input.sessionId,
      }),
    );
  }

  async convertGuestUserToCustomerById(
    input: ConvertGuestUserByIdInput,
  ): Promise<AuthSafeUserResponse> {
    const updatePayload: AppUserUpdate = {
      email: input.email,
      phone: input.phone,
      full_name: input.fullName,
      timezone: input.timezone,
      role: AUTH_CUSTOMER_ROLE,
      status: AUTH_USER_STATUS_PENDING_EMAIL_VERIFICATION,
      is_guest: false,
      guest_expires_at: null,
      converted_from_guest_at: input.convertedFromGuestAt,
    };

    const { data, error } = await this.adminClient
      .from('app_users')
      .update(updatePayload)
      .eq('id', input.userId)
      .eq('role', AUTH_GUEST_ROLE)
      .eq('status', AUTH_USER_STATUS_GUEST_ACTIVE)
      .eq('is_guest', true)
      .select('*')
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return mapAppUserRowToSafeUserResponse(
      assertAppUserRow(data, {
        user_id: input.userId,
      }),
    );
  }

  async expireGuestUserAndSession(
    input: GuestSessionExpiryInput,
  ): Promise<void> {
    const sessionUpdatePayload: AuthSessionUpdate = {
      revoked_at: input.expiredAt,
      revoked_reason: AUTH_SESSION_REVOCATION_REASON_GUEST_SESSION_EXPIRED,
    };

    const userUpdatePayload: AppUserUpdate = {
      status: AUTH_USER_STATUS_DELETED,
      deleted_at: input.expiredAt,
    };

    const { error: sessionError } = await this.adminClient
      .from('auth_sessions')
      .update(sessionUpdatePayload)
      .eq('id', input.sessionId)
      .eq('user_id', input.userId)
      .eq('session_type', AUTH_SESSION_TYPE_GUEST)
      .is('revoked_at', null);

    if (sessionError) {
      throw mapDatabaseError(sessionError);
    }

    const { error: userError } = await this.adminClient
      .from('app_users')
      .update(userUpdatePayload)
      .eq('id', input.userId)
      .eq('role', AUTH_GUEST_ROLE)
      .eq('is_guest', true);

    if (userError) {
      throw mapDatabaseError(userError);
    }
  }
}
