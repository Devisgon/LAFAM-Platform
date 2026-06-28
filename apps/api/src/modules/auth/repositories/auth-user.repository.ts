// apps/api/src/modules/auth/repositories/auth-user.repository.ts
/**
 * LAFAM Auth user repository.
 *
 * Role:
 * - Owns all app_users table access for the Auth module.
 * - Keeps Supabase table queries out of services and controllers.
 * - Maps database rows into stable Auth user domain types.
 *
 * Important:
 * - This repository uses the server-side Supabase admin client only.
 * - RLS is enabled with no public policies, so backend-owned access is required.
 * - Do not expose raw database errors directly to API clients.
 */

import { Inject, Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { SUPABASE_ADMIN_CLIENT } from '../../../database/database.constants';
import type {
  AppUserInsert,
  AppUserRow,
  AppUserUpdate,
  LAFAMSupabaseClient,
} from '../../../database/database.types';
import {
  AUTH_CUSTOMER_ROLE,
  AUTH_GUEST_ROLE,
} from '../constants/auth-role.constants';
import {
  AUTH_USER_STATUS_ACTIVE,
  AUTH_USER_STATUS_DEACTIVATED,
  AUTH_USER_STATUS_DELETED,
  AUTH_USER_STATUS_PENDING_EMAIL_VERIFICATION,
} from '../constants/auth.constants';
import type {
  AuthUserListFilters,
  AuthUserListResult,
  ConvertGuestAppUserInput,
  CreateAppUserInput,
  UpdateAppUserAvatarInput,
  UpdateAppUserProfileInput,
  UpdateAppUserStatusInput,
} from '../types/auth-user.types';
import {
  mapAppUserRowToAdminUserResponse,
  mapAppUserRowToInternalProfile,
  type AuthUserInternalProfile,
} from '../types/auth-user.types';

export interface FindAppUserByIdInput {
  readonly userId: string;
}

export interface FindAppUserByAuthUserIdInput {
  readonly authUserId: string;
}

export interface FindAppUserByEmailInput {
  readonly email: string;
}

export interface FindAppUserByPhoneInput {
  readonly phone: string;
  readonly excludeUserId?: string | null;
}

export interface ActivateAppUserByAuthUserIdInput {
  readonly authUserId: string;
  readonly email: string;
}

export interface UpdateAppUserProfileByIdInput {
  readonly userId: string;
  readonly profile: UpdateAppUserProfileInput;
}

export interface UpdateAppUserAvatarByIdInput {
  readonly userId: string;
  readonly avatar: UpdateAppUserAvatarInput;
}

export interface UpdateAppUserStatusByIdInput {
  readonly userId: string;
  readonly status: UpdateAppUserStatusInput;
}

export interface ConvertGuestAppUserByIdInput {
  readonly userId: string;
  readonly convertedAt: string;
  readonly customer: ConvertGuestAppUserInput;
}

export interface SoftDeleteAppUserByIdInput {
  readonly userId: string;
  readonly deletedAt: string;
}

export interface DeactivateAppUserByIdInput {
  readonly userId: string;
  readonly deactivatedAt: string;
}

export interface ReactivateAppUserByIdInput {
  readonly userId: string;
}

const POSTGRES_UNIQUE_VIOLATION_CODE = '23505';
const DEFAULT_LIST_USERS_LIMIT = 25;
const MAX_LIST_USERS_LIMIT = 100;

function isDatabaseError(value: unknown): value is {
  readonly code?: string;
  readonly message?: string;
  readonly details?: string | null;
  readonly hint?: string | null;
} {
  return typeof value === 'object' && value !== null;
}

function databaseErrorText(error: {
  readonly code?: string;
  readonly message?: string;
  readonly details?: string | null;
  readonly hint?: string | null;
}): string {
  return [error.code, error.message, error.details, error.hint]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase();
}

function mapDatabaseError(error: unknown): AppError {
  if (isDatabaseError(error) && error.code === POSTGRES_UNIQUE_VIOLATION_CODE) {
    const errorText = databaseErrorText(error);

    if (
      errorText.includes('app_users_non_guest_active_phone_uidx') ||
      errorText.includes('(phone)')
    ) {
      return AppError.customerPhoneAlreadyExists(undefined, {
        field: 'phone',
      });
    }

    return AppError.emailAlreadyRegistered(
      'An account with this email already exists.',
    );
  }

  return AppError.databaseOperationFailed(error);
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

function sanitizePostgrestSearchTerm(value: string): string {
  return value.replace(/[%,()]/gu, '').trim();
}

@Injectable()
export class AuthUserRepository {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly adminClient: LAFAMSupabaseClient,
  ) {}

  async createAppUser(
    input: CreateAppUserInput,
  ): Promise<AuthUserInternalProfile> {
    const insertPayload: AppUserInsert = {
      auth_user_id: input.authUserId,
      email: input.email,
      phone: input.phone ?? null,
      full_name: input.fullName ?? null,
      role: input.role,
      status: input.status,
      is_guest: input.isGuest ?? false,
      avatar_path: input.avatarPath ?? null,
      timezone: input.timezone ?? null,
      metadata: input.metadata ?? {},
      guest_expires_at: input.guestExpiresAt ?? null,
      converted_from_guest_at: input.convertedFromGuestAt ?? null,
    };

    const { data, error } = await this.adminClient
      .from('app_users')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      throw mapDatabaseError(error);
    }

    return mapAppUserRowToInternalProfile(assertAppUserRow(data));
  }

  async findById(
    input: FindAppUserByIdInput,
  ): Promise<AuthUserInternalProfile | null> {
    const { data, error } = await this.adminClient
      .from('app_users')
      .select('*')
      .eq('id', input.userId)
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data ? mapAppUserRowToInternalProfile(data) : null;
  }

  async getById(input: FindAppUserByIdInput): Promise<AuthUserInternalProfile> {
    const user = await this.findById(input);

    if (!user) {
      throw AppError.userNotFound('The requested user was not found.', {
        user_id: input.userId,
      });
    }

    return user;
  }

  async findByAuthUserId(
    input: FindAppUserByAuthUserIdInput,
  ): Promise<AuthUserInternalProfile | null> {
    const { data, error } = await this.adminClient
      .from('app_users')
      .select('*')
      .eq('auth_user_id', input.authUserId)
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data ? mapAppUserRowToInternalProfile(data) : null;
  }

  async getByAuthUserId(
    input: FindAppUserByAuthUserIdInput,
  ): Promise<AuthUserInternalProfile> {
    const user = await this.findByAuthUserId(input);

    if (!user) {
      throw AppError.userNotFound('The requested user was not found.', {
        auth_user_id: input.authUserId,
      });
    }

    return user;
  }

  async findByEmail(
    input: FindAppUserByEmailInput,
  ): Promise<AuthUserInternalProfile | null> {
    const { data, error } = await this.adminClient
      .from('app_users')
      .select('*')
      .eq('email', input.email)
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data ? mapAppUserRowToInternalProfile(data) : null;
  }

  async getByEmail(
    input: FindAppUserByEmailInput,
  ): Promise<AuthUserInternalProfile> {
    const user = await this.findByEmail(input);

    if (!user) {
      throw AppError.userNotFound('The requested user was not found.', {
        email: input.email,
      });
    }

    return user;
  }

  async findByPhone(
    input: FindAppUserByPhoneInput,
  ): Promise<AuthUserInternalProfile | null> {
    let query = this.adminClient
      .from('app_users')
      .select('*')
      .eq('phone', input.phone)
      .eq('is_guest', false)
      .neq('status', AUTH_USER_STATUS_DELETED)
      .is('deleted_at', null)
      .limit(1);

    if (input.excludeUserId) {
      query = query.neq('id', input.excludeUserId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data ? mapAppUserRowToInternalProfile(data) : null;
  }

  async activateByAuthUserId(
    input: ActivateAppUserByAuthUserIdInput,
  ): Promise<AuthUserInternalProfile> {
    const updatePayload: AppUserUpdate = {
      email: input.email,
      status: AUTH_USER_STATUS_ACTIVE,
      is_guest: false,
    };

    const { data, error } = await this.adminClient
      .from('app_users')
      .update(updatePayload)
      .eq('auth_user_id', input.authUserId)
      .select('*')
      .single();

    if (error) {
      throw mapDatabaseError(error);
    }

    return mapAppUserRowToInternalProfile(assertAppUserRow(data));
  }

  async updateProfileById(
    input: UpdateAppUserProfileByIdInput,
  ): Promise<AuthUserInternalProfile> {
    const updatePayload: AppUserUpdate = {
      ...(input.profile.phone !== undefined
        ? { phone: input.profile.phone }
        : {}),
      ...(input.profile.fullName !== undefined
        ? { full_name: input.profile.fullName }
        : {}),
      ...(input.profile.timezone !== undefined
        ? { timezone: input.profile.timezone }
        : {}),
      ...(input.profile.metadata !== undefined
        ? { metadata: input.profile.metadata }
        : {}),
    };

    const { data, error } = await this.adminClient
      .from('app_users')
      .update(updatePayload)
      .eq('id', input.userId)
      .select('*')
      .single();

    if (error) {
      throw mapDatabaseError(error);
    }

    return mapAppUserRowToInternalProfile(assertAppUserRow(data));
  }

  async updateAvatarById(
    input: UpdateAppUserAvatarByIdInput,
  ): Promise<AuthUserInternalProfile> {
    const updatePayload: AppUserUpdate = {
      avatar_path: input.avatar.avatarPath,
    };

    const { data, error } = await this.adminClient
      .from('app_users')
      .update(updatePayload)
      .eq('id', input.userId)
      .select('*')
      .single();

    if (error) {
      throw mapDatabaseError(error);
    }

    return mapAppUserRowToInternalProfile(assertAppUserRow(data));
  }

  async updateStatusById(
    input: UpdateAppUserStatusByIdInput,
  ): Promise<AuthUserInternalProfile> {
    const updatePayload: AppUserUpdate = {
      status: input.status.status,
      ...(input.status.deactivatedAt !== undefined
        ? { deactivated_at: input.status.deactivatedAt }
        : {}),
      ...(input.status.deletedAt !== undefined
        ? { deleted_at: input.status.deletedAt }
        : {}),
    };

    const { data, error } = await this.adminClient
      .from('app_users')
      .update(updatePayload)
      .eq('id', input.userId)
      .select('*')
      .single();

    if (error) {
      throw mapDatabaseError(error);
    }

    return mapAppUserRowToInternalProfile(assertAppUserRow(data));
  }

  async softDeleteById(
    input: SoftDeleteAppUserByIdInput,
  ): Promise<AuthUserInternalProfile> {
    return this.updateStatusById({
      userId: input.userId,
      status: {
        status: AUTH_USER_STATUS_DELETED,
        deletedAt: input.deletedAt,
      },
    });
  }

  async deactivateById(
    input: DeactivateAppUserByIdInput,
  ): Promise<AuthUserInternalProfile> {
    return this.updateStatusById({
      userId: input.userId,
      status: {
        status: AUTH_USER_STATUS_DEACTIVATED,
        deactivatedAt: input.deactivatedAt,
      },
    });
  }

  async reactivateById(
    input: ReactivateAppUserByIdInput,
  ): Promise<AuthUserInternalProfile> {
    return this.updateStatusById({
      userId: input.userId,
      status: {
        status: AUTH_USER_STATUS_ACTIVE,
        deactivatedAt: null,
        deletedAt: null,
      },
    });
  }

  async convertGuestToCustomerById(
    input: ConvertGuestAppUserByIdInput,
  ): Promise<AuthUserInternalProfile> {
    const updatePayload: AppUserUpdate = {
      email: input.customer.email,
      phone: input.customer.phone,
      full_name: input.customer.fullName,
      timezone: input.customer.timezone ?? null,
      role: AUTH_CUSTOMER_ROLE,
      status: AUTH_USER_STATUS_PENDING_EMAIL_VERIFICATION,
      is_guest: false,
      guest_expires_at: null,
      converted_from_guest_at: input.convertedAt,
    };

    const { data, error } = await this.adminClient
      .from('app_users')
      .update(updatePayload)
      .eq('id', input.userId)
      .eq('role', AUTH_GUEST_ROLE)
      .select('*')
      .single();

    if (error) {
      throw mapDatabaseError(error);
    }

    return mapAppUserRowToInternalProfile(assertAppUserRow(data));
  }

  async listUsers(filters: AuthUserListFilters): Promise<AuthUserListResult> {
    const limit = normalizeListLimit(filters.limit);
    const offset = normalizeListOffset(filters.offset);
    const searchTerm = filters.search
      ? sanitizePostgrestSearchTerm(filters.search)
      : null;

    let query = this.adminClient
      .from('app_users')
      .select('*', { count: 'exact' });

    if (filters.role) {
      query = query.eq('role', filters.role);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.isGuest !== undefined) {
      query = query.eq('is_guest', filters.isGuest);
    }

    if (searchTerm) {
      query = query.or(
        `email.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`,
      );
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw mapDatabaseError(error);
    }

    const users = (data ?? []).map((user) =>
      mapAppUserRowToAdminUserResponse(user),
    );

    return {
      users,
      total: count ?? users.length,
      limit,
      offset,
    };
  }
}
