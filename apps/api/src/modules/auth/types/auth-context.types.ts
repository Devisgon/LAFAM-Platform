// apps/api/src/modules/auth/types/auth-context.types.ts
/**
 * LAFAM Auth context types.
 *
 * Role:
 * - Defines the resolved Auth context returned by /auth/context.
 * - Defines the internal request context used by guards, services, and controllers.
 * - Keeps role, permission, session, and frontend access flags consistent.
 *
 * Important:
 * - Frontend access flags are usability helpers only.
 * - Backend guards and services remain the final authorization authority.
 * - Guest context must stay distinct from unauthenticated public access.
 */

import type { AuthPermission } from '../constants/auth-permission.constants';
import type { AuthUserRole } from '../constants/auth-role.constants';
import type {
  AuthSessionType,
  AuthUserStatus,
} from '../constants/auth.constants';
import type { AuthResolvedSession } from './auth-session.types';
import type {
  AuthResolvedUser,
  AuthUserInternalProfile,
} from './auth-user.types';

export interface AuthRequestMetadata {
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

export interface AuthContextSessionResponse {
  readonly id: string;
  readonly type: AuthSessionType;
  readonly expires_at: string | null;
}

export interface AuthContextUserResponse {
  readonly id: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly full_name: string | null;
  readonly role: AuthUserRole;
  readonly status: AuthUserStatus;
  readonly is_guest: boolean;
  readonly avatar_path: string | null;
  readonly timezone: string | null;
}

export interface AuthContextAccessFlags {
  readonly can_access_admin_dashboard: boolean;
  readonly can_access_staff_dashboard: boolean;
  readonly can_create_booking: boolean;
  readonly can_view_booking_history: boolean;
  readonly can_checkout: boolean;
  readonly can_access_wallet: boolean;
  readonly can_manage_users: boolean;
  readonly can_hard_delete_users: boolean;
  readonly requires_email_verification: boolean;
  readonly requires_guest_conversion: boolean;
}

export interface AuthContextData {
  readonly is_authenticated: true;
  readonly is_guest: boolean;
  readonly user: AuthContextUserResponse;
  readonly session: AuthContextSessionResponse;
  readonly permissions: readonly AuthPermission[];
  readonly access: AuthContextAccessFlags;
}

export interface AuthInternalContext {
  readonly user: AuthResolvedUser;
  readonly profile: AuthUserInternalProfile;
  readonly session: AuthResolvedSession;
  readonly permissions: readonly AuthPermission[];
  readonly request: AuthRequestMetadata;
}

export interface ResolveAuthContextInput {
  readonly user: AuthResolvedUser;
  readonly profile: AuthUserInternalProfile;
  readonly session: AuthResolvedSession;
  readonly request: AuthRequestMetadata;
}

export interface BuildAuthContextAccessInput {
  readonly role: AuthUserRole;
  readonly status: AuthUserStatus;
  readonly isGuest: boolean;
  readonly permissions: readonly AuthPermission[];
}

export interface AuthContextAccessDecision {
  readonly role: AuthUserRole;
  readonly status: AuthUserStatus;
  readonly isGuest: boolean;
  readonly permissions: readonly AuthPermission[];
  readonly access: AuthContextAccessFlags;
}

export interface AuthenticatedRequestContext {
  readonly auth: AuthInternalContext;
}

export function mapAuthInternalContextToContextData(
  context: AuthInternalContext,
): AuthContextData {
  return {
    is_authenticated: true,
    is_guest: context.profile.isGuest,
    user: {
      id: context.profile.id,
      email: context.profile.email,
      phone: context.profile.phone,
      full_name: context.profile.fullName,
      role: context.profile.role,
      status: context.profile.status,
      is_guest: context.profile.isGuest,
      avatar_path: context.profile.avatarPath,
      timezone: context.profile.timezone,
    },
    session: {
      id: context.session.id,
      type: context.session.sessionType,
      expires_at: context.session.expiresAt,
    },
    permissions: context.permissions,
    access: buildAuthContextAccessFlags({
      role: context.profile.role,
      status: context.profile.status,
      isGuest: context.profile.isGuest,
      permissions: context.permissions,
    }),
  };
}

export function buildAuthContextAccessFlags(
  input: BuildAuthContextAccessInput,
): AuthContextAccessFlags {
  const permissionSet = new Set<AuthPermission>(input.permissions);

  const isPendingEmailVerification =
    input.status === 'pending_email_verification';

  return {
    can_access_admin_dashboard: permissionSet.has('admin:access_dashboard'),
    can_access_staff_dashboard: permissionSet.has('staff:access_dashboard'),
    can_create_booking:
      !input.isGuest &&
      !isPendingEmailVerification &&
      permissionSet.has('booking:create_confirmed'),
    can_view_booking_history:
      !input.isGuest && permissionSet.has('booking:view_history'),
    can_checkout:
      !input.isGuest &&
      !isPendingEmailVerification &&
      permissionSet.has('payment:create'),
    can_access_wallet: !input.isGuest && permissionSet.has('wallet:read'),
    can_manage_users: permissionSet.has('admin:users:read'),
    can_hard_delete_users: permissionSet.has('super_admin:users:hard_delete'),
    requires_email_verification: isPendingEmailVerification,
    requires_guest_conversion: input.isGuest,
  };
}
