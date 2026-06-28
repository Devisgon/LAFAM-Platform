// apps/api/src/modules/auth/types/auth-user.types.ts
/**
 * LAFAM Auth user types.
 *
 * Role:
 * - Defines internal Auth user shapes used by repositories, services, guards, and context resolution.
 * - Keeps application user state aligned with the approved app_users migration.
 * - Separates database rows from API-safe user response objects.
 *
 * Important:
 * - Do not expose Supabase provider metadata directly.
 * - Do not expose deleted/deactivated internal timestamps unless a privileged admin response explicitly needs them.
 * - Public signup and guest conversion must always produce customer users, never privileged roles.
 */

import type {
  AppUserRow,
  DatabaseJsonObject,
} from '../../../database/database.types';
import type { AuthPermission } from '../constants/auth-permission.constants';
import type { AuthUserRole } from '../constants/auth-role.constants';
import type { AuthUserStatus } from '../constants/auth.constants';

export interface AuthUserProfile {
  readonly id: string;
  readonly authUserId: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly fullName: string | null;
  readonly role: AuthUserRole;
  readonly status: AuthUserStatus;
  readonly isGuest: boolean;
  readonly avatarPath: string | null;
  readonly timezone: string | null;
  readonly metadata: DatabaseJsonObject;
  readonly guestExpiresAt: string | null;
  readonly convertedFromGuestAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AuthUserInternalProfile extends AuthUserProfile {
  readonly deactivatedAt: string | null;
  readonly deletedAt: string | null;
}

export interface AuthResolvedUser {
  readonly id: string;
  readonly authUserId: string;
  readonly email: string | null;
  readonly role: AuthUserRole;
  readonly status: AuthUserStatus;
  readonly isGuest: boolean;
  readonly permissions: readonly AuthPermission[];
}

export interface AuthCurrentUser {
  readonly user: AuthResolvedUser;
}

export interface AuthSafeUserResponse {
  readonly id: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly full_name: string | null;
  readonly role: AuthUserRole;
  readonly status: AuthUserStatus;
  readonly is_guest: boolean;
  readonly avatar_path: string | null;
  readonly timezone: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface AuthAdminUserResponse extends AuthSafeUserResponse {
  readonly auth_user_id: string;
  readonly customer_profile_id?: string | null;
  readonly guest_expires_at: string | null;
  readonly converted_from_guest_at: string | null;
  readonly deactivated_at: string | null;
  readonly deleted_at: string | null;
}

export interface CreateAppUserInput {
  readonly authUserId: string;
  readonly email: string | null;
  readonly phone?: string | null;
  readonly fullName?: string | null;
  readonly role: AuthUserRole;
  readonly status: AuthUserStatus;
  readonly isGuest?: boolean;
  readonly avatarPath?: string | null;
  readonly timezone?: string | null;
  readonly metadata?: DatabaseJsonObject;
  readonly guestExpiresAt?: string | null;
  readonly convertedFromGuestAt?: string | null;
}

export interface UpdateAppUserProfileInput {
  readonly phone?: string | null;
  readonly fullName?: string | null;
  readonly timezone?: string | null;
  readonly metadata?: DatabaseJsonObject;
}

export interface UpdateAppUserAvatarInput {
  readonly avatarPath: string | null;
}

export interface UpdateAppUserStatusInput {
  readonly status: AuthUserStatus;
  readonly deactivatedAt?: string | null;
  readonly deletedAt?: string | null;
}

export interface ConvertGuestAppUserInput {
  readonly email: string;
  readonly phone?: string | null;
  readonly fullName: string;
  readonly timezone?: string | null;
}

export interface AuthUserListFilters {
  readonly search?: string;
  readonly role?: AuthUserRole;
  readonly status?: AuthUserStatus;
  readonly isGuest?: boolean;
  readonly limit: number;
  readonly offset: number;
}

export interface AuthUserListResult {
  readonly users: readonly AuthAdminUserResponse[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export function mapAppUserRowToInternalProfile(
  row: AppUserRow,
): AuthUserInternalProfile {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    email: row.email,
    phone: row.phone,
    fullName: row.full_name,
    role: row.role,
    status: row.status,
    isGuest: row.is_guest,
    avatarPath: row.avatar_path,
    timezone: row.timezone,
    metadata: row.metadata,
    guestExpiresAt: row.guest_expires_at,
    convertedFromGuestAt: row.converted_from_guest_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deactivatedAt: row.deactivated_at,
    deletedAt: row.deleted_at,
  };
}

export function mapAppUserRowToSafeUserResponse(
  row: AppUserRow,
): AuthSafeUserResponse {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    full_name: row.full_name,
    role: row.role,
    status: row.status,
    is_guest: row.is_guest,
    avatar_path: row.avatar_path,
    timezone: row.timezone,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapAppUserRowToAdminUserResponse(
  row: AppUserRow,
  options?: {
    readonly customerProfileId?: string | null;
  },
): AuthAdminUserResponse {
  return {
    ...mapAppUserRowToSafeUserResponse(row),
    auth_user_id: row.auth_user_id,
    ...(options
      ? { customer_profile_id: options.customerProfileId ?? null }
      : {}),
    guest_expires_at: row.guest_expires_at,
    converted_from_guest_at: row.converted_from_guest_at,
    deactivated_at: row.deactivated_at,
    deleted_at: row.deleted_at,
  };
}
