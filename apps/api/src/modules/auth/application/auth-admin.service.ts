// apps/api/src/modules/auth/application/auth-admin.service.ts
/**
 * LAFAM Auth admin service.
 *
 * Role:
 * - Owns protected admin user-management operations.
 * - Lists app users for admin screens.
 * - Deactivates users and revokes affected sessions.
 * - Reactivates deactivated users.
 * - Hard-deletes provider identities through the Supabase admin boundary.
 *
 * Important:
 * - Controllers/guards must restrict these APIs to admin/super_admin routes.
 * - Hard delete is super_admin-only and is enforced again here.
 * - Admins cannot deactivate or hard-delete their own account.
 * - Raw tokens, provider secrets, passwords, and OTPs must never be logged.
 */

import { Inject, Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { SUPABASE_ADMIN_CLIENT } from '../../../database/database.constants';
import type {
  AppUserRow,
  AppUserUpdate,
  LAFAMSupabaseClient,
} from '../../../database/database.types';
import {
  AUTH_ADMIN_ROLE,
  AUTH_SUPER_ADMIN_ROLE,
} from '../constants/auth-role.constants';
import {
  AUTH_AUDIT_EVENT_USER_DEACTIVATED,
  AUTH_AUDIT_EVENT_USER_HARD_DELETED,
  AUTH_AUDIT_EVENT_USER_REACTIVATED,
  AUTH_SESSION_REVOCATION_REASON_ACCOUNT_DELETED,
  AUTH_SESSION_REVOCATION_REASON_USER_DEACTIVATED,
  AUTH_USER_STATUS_ACTIVE,
  AUTH_USER_STATUS_DEACTIVATED,
  AUTH_USER_STATUS_DELETED,
  type AuthUserStatus,
} from '../constants/auth.constants';
import { AuthAuditRepository } from '../repositories/auth-audit.repository';
import { AuthSessionRepository } from '../repositories/auth-session.repository';
import { SupabaseAuthRepository } from '../repositories/supabase-auth.repository';
import type { AuthInternalContext } from '../types/auth-context.types';
import type {
  AuthAdminHardDeleteUserResponse,
  AuthAdminUserListResponse,
  AuthAdminUserMutationResponse,
} from '../types/auth-response.types';
import type {
  AuthAdminUserResponse,
  AuthUserListFilters,
} from '../types/auth-user.types';
import { mapAppUserRowToAdminUserResponse } from '../types/auth-user.types';

export interface AuthAdminServiceRequestMetadata {
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

export interface AdminUserMutationInput {
  readonly userId: string;
}

const EMPTY_REQUEST_METADATA: AuthAdminServiceRequestMetadata = {
  ipAddress: null,
  userAgent: null,
};

const DEFAULT_LIST_USERS_LIMIT = 50;
const MAX_LIST_USERS_LIMIT = 200;

function isDatabaseError(value: unknown): value is {
  readonly code?: string;
  readonly message?: string;
} {
  return typeof value === 'object' && value !== null;
}

function mapDatabaseError(error: unknown): AppError {
  if (isDatabaseError(error)) {
    return AppError.supabaseUnavailable(error);
  }

  return AppError.supabaseUnavailable(error);
}

function normalizeListLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit <= 0) {
    return DEFAULT_LIST_USERS_LIMIT;
  }

  return Math.min(limit, MAX_LIST_USERS_LIMIT);
}

function normalizeListOffset(offset: number): number {
  if (!Number.isInteger(offset) || offset < 0) {
    return 0;
  }

  return offset;
}

function normalizeSearchValue(search: string | undefined): string | null {
  const normalizedSearch = search?.trim();

  if (!normalizedSearch) {
    return null;
  }

  const sanitizedSearch = normalizedSearch.replace(/[%_,]/gu, '').trim();

  return sanitizedSearch.length > 0 ? sanitizedSearch : null;
}

function assertAppUserRow(
  row: AppUserRow | null,
  details?: Record<string, unknown>,
): AppUserRow {
  if (!row) {
    throw AppError.userNotFound('The requested user was not found.', details);
  }

  return row;
}

function assertActorCanMutateTarget(input: {
  readonly actor: AuthInternalContext;
  readonly target: AppUserRow;
  readonly action: 'deactivate' | 'reactivate' | 'hard_delete';
}): void {
  if (input.actor.profile.id === input.target.id) {
    throw AppError.cannotDeleteSelf(
      'You cannot perform this user-management action on your own account.',
    );
  }

  if (
    input.target.role === AUTH_SUPER_ADMIN_ROLE &&
    input.actor.profile.role !== AUTH_SUPER_ADMIN_ROLE
  ) {
    throw AppError.superAdminRequired(
      'Super admin access is required to manage this user.',
    );
  }

  if (
    input.action === 'hard_delete' &&
    input.actor.profile.role !== AUTH_SUPER_ADMIN_ROLE
  ) {
    throw AppError.superAdminRequired(
      'Super admin access is required to hard delete users.',
    );
  }

  if (
    input.actor.profile.role !== AUTH_ADMIN_ROLE &&
    input.actor.profile.role !== AUTH_SUPER_ADMIN_ROLE
  ) {
    throw AppError.adminAccessRequired('Admin access is required.');
  }
}

function assertCanDeactivateUser(target: AppUserRow): void {
  if (target.status === AUTH_USER_STATUS_DELETED) {
    throw AppError.accountDeleted('This account has already been deleted.');
  }

  if (target.status === AUTH_USER_STATUS_DEACTIVATED) {
    throw AppError.userAlreadyDeactivated('This user is already deactivated.', {
      user_id: target.id,
    });
  }
}

function assertCanReactivateUser(target: AppUserRow): void {
  if (target.status === AUTH_USER_STATUS_DELETED) {
    throw AppError.accountDeleted('Deleted accounts cannot be reactivated.');
  }

  if (target.status === AUTH_USER_STATUS_ACTIVE) {
    throw AppError.userAlreadyActive('This user is already active.', {
      user_id: target.id,
    });
  }
}

@Injectable()
export class AuthAdminService {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly adminClient: LAFAMSupabaseClient,
    private readonly supabaseAuthRepository: SupabaseAuthRepository,
    private readonly authSessionRepository: AuthSessionRepository,
    private readonly authAuditRepository: AuthAuditRepository,
  ) {}

  async listUsers(
    filters: AuthUserListFilters,
  ): Promise<AuthAdminUserListResponse> {
    const limit = normalizeListLimit(filters.limit);
    const offset = normalizeListOffset(filters.offset);
    const search = normalizeSearchValue(filters.search);

    let query = this.adminClient
      .from('app_users')
      .select('*', { count: 'exact' });

    if (filters.role) {
      query = query.eq('role', filters.role);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (typeof filters.isGuest === 'boolean') {
      query = query.eq('is_guest', filters.isGuest);
    }

    if (search) {
      query = query.or(
        `email.ilike.%${search}%,phone.ilike.%${search}%,full_name.ilike.%${search}%`,
      );
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw mapDatabaseError(error);
    }

    const users: AuthAdminUserResponse[] = (data ?? []).map(
      mapAppUserRowToAdminUserResponse,
    );

    return {
      users,
      total: count ?? users.length,
      limit,
      offset,
    };
  }

  async deactivateUser(
    auth: AuthInternalContext,
    input: AdminUserMutationInput,
    request: AuthAdminServiceRequestMetadata = EMPTY_REQUEST_METADATA,
  ): Promise<AuthAdminUserMutationResponse> {
    const target = await this.getAppUserById(input.userId);

    assertActorCanMutateTarget({
      actor: auth,
      target,
      action: 'deactivate',
    });
    assertCanDeactivateUser(target);

    const deactivatedAt = new Date().toISOString();

    const user = await this.updateAppUserStatus({
      userId: target.id,
      status: AUTH_USER_STATUS_DEACTIVATED,
      deactivatedAt,
      deletedAt: null,
    });

    await this.authSessionRepository.revokeAllForUser({
      userId: target.id,
      revokedAt: deactivatedAt,
      revokedReason: AUTH_SESSION_REVOCATION_REASON_USER_DEACTIVATED,
    });

    await this.authAuditRepository.createEvent({
      actorUserId: auth.profile.id,
      targetUserId: target.id,
      eventType: AUTH_AUDIT_EVENT_USER_DEACTIVATED,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      metadata: {
        target_user_id: target.id,
        deactivated_at: deactivatedAt,
      },
    });

    return {
      user,
    };
  }

  async reactivateUser(
    auth: AuthInternalContext,
    input: AdminUserMutationInput,
    request: AuthAdminServiceRequestMetadata = EMPTY_REQUEST_METADATA,
  ): Promise<AuthAdminUserMutationResponse> {
    const target = await this.getAppUserById(input.userId);

    assertActorCanMutateTarget({
      actor: auth,
      target,
      action: 'reactivate',
    });
    assertCanReactivateUser(target);

    const user = await this.updateAppUserStatus({
      userId: target.id,
      status: AUTH_USER_STATUS_ACTIVE,
      deactivatedAt: null,
      deletedAt: null,
    });

    await this.authAuditRepository.createEvent({
      actorUserId: auth.profile.id,
      targetUserId: target.id,
      eventType: AUTH_AUDIT_EVENT_USER_REACTIVATED,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      metadata: {
        target_user_id: target.id,
        reactivated_at: new Date().toISOString(),
      },
    });

    return {
      user,
    };
  }

  async hardDeleteUser(
    auth: AuthInternalContext,
    input: AdminUserMutationInput,
    request: AuthAdminServiceRequestMetadata = EMPTY_REQUEST_METADATA,
  ): Promise<AuthAdminHardDeleteUserResponse> {
    const target = await this.getAppUserById(input.userId);

    assertActorCanMutateTarget({
      actor: auth,
      target,
      action: 'hard_delete',
    });

    const deletedAt = new Date().toISOString();

    await this.authSessionRepository.revokeAllForUser({
      userId: target.id,
      revokedAt: deletedAt,
      revokedReason: AUTH_SESSION_REVOCATION_REASON_ACCOUNT_DELETED,
    });

    await this.markAppUserDeleted({
      userId: target.id,
      deletedAt,
    });

    await this.authAuditRepository.createEvent({
      actorUserId: auth.profile.id,
      targetUserId: target.id,
      eventType: AUTH_AUDIT_EVENT_USER_HARD_DELETED,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      metadata: {
        target_user_id: target.id,
        target_auth_user_id: target.auth_user_id,
        deleted_at: deletedAt,
      },
    });

    await this.supabaseAuthRepository.deleteAuthUser({
      authUserId: target.auth_user_id,
      shouldSoftDelete: false,
    });

    return {
      hard_deleted: true,
      user_id: target.id,
    };
  }

  private async getAppUserById(userId: string): Promise<AppUserRow> {
    const { data, error } = await this.adminClient
      .from('app_users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return assertAppUserRow(data, {
      user_id: userId,
    });
  }

  private async updateAppUserStatus(input: {
    readonly userId: string;
    readonly status: AuthUserStatus;
    readonly deactivatedAt: string | null;
    readonly deletedAt: string | null;
  }): Promise<AuthAdminUserResponse> {
    const updatePayload: AppUserUpdate = {
      status: input.status,
      deactivated_at: input.deactivatedAt,
      deleted_at: input.deletedAt,
    };

    const { data, error } = await this.adminClient
      .from('app_users')
      .update(updatePayload)
      .eq('id', input.userId)
      .select('*')
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return mapAppUserRowToAdminUserResponse(
      assertAppUserRow(data, {
        user_id: input.userId,
      }),
    );
  }

  private async markAppUserDeleted(input: {
    readonly userId: string;
    readonly deletedAt: string;
  }): Promise<void> {
    const updatePayload: AppUserUpdate = {
      status: AUTH_USER_STATUS_DELETED,
      deleted_at: input.deletedAt,
      deactivated_at: null,
    };

    const { data, error } = await this.adminClient
      .from('app_users')
      .update(updatePayload)
      .eq('id', input.userId)
      .select('id')
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    assertAppUserRow(data as AppUserRow | null, {
      user_id: input.userId,
    });
  }
}
