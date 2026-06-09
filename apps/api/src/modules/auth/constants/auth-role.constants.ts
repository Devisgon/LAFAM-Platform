// apps/api/src/modules/auth/constants/auth-role.constants.ts
/**
 * LAFAM Auth role constants.
 *
 * Role:
 * - Defines every application role supported by the Auth module.
 * - Keeps role checks consistent across DTOs, guards, services, repositories, and Swagger.
 *
 * Important:
 * - Public signup must only create customer accounts.
 * - Guest is an authenticated anonymous role, not public unauthenticated access.
 * - Privileged roles must be assigned only through controlled admin/internal flows.
 */

export const AUTH_USER_ROLES = [
  'guest',
  'customer',
  'admin',
  'trainer',
  'stylist',
  'staff',
  'super_admin',
] as const;

export type AuthUserRole = (typeof AUTH_USER_ROLES)[number];

export const AUTH_GUEST_ROLE = 'guest' satisfies AuthUserRole;
export const AUTH_CUSTOMER_ROLE = 'customer' satisfies AuthUserRole;
export const AUTH_ADMIN_ROLE = 'admin' satisfies AuthUserRole;
export const AUTH_TRAINER_ROLE = 'trainer' satisfies AuthUserRole;
export const AUTH_STYLIST_ROLE = 'stylist' satisfies AuthUserRole;
export const AUTH_STAFF_ROLE = 'staff' satisfies AuthUserRole;
export const AUTH_SUPER_ADMIN_ROLE = 'super_admin' satisfies AuthUserRole;

export const AUTH_PUBLIC_SIGN_UP_ROLE =
  AUTH_CUSTOMER_ROLE satisfies AuthUserRole;

export const AUTH_PRIVILEGED_ROLES = [
  AUTH_ADMIN_ROLE,
  AUTH_TRAINER_ROLE,
  AUTH_STYLIST_ROLE,
  AUTH_STAFF_ROLE,
  AUTH_SUPER_ADMIN_ROLE,
] as const satisfies readonly AuthUserRole[];

export type AuthPrivilegedRole = (typeof AUTH_PRIVILEGED_ROLES)[number];

export const AUTH_ADMIN_ACCESS_ROLES = [
  AUTH_ADMIN_ROLE,
  AUTH_SUPER_ADMIN_ROLE,
] as const satisfies readonly AuthUserRole[];

export type AuthAdminAccessRole = (typeof AUTH_ADMIN_ACCESS_ROLES)[number];

export const AUTH_STAFF_ACCESS_ROLES = [
  AUTH_ADMIN_ROLE,
  AUTH_TRAINER_ROLE,
  AUTH_STYLIST_ROLE,
  AUTH_STAFF_ROLE,
  AUTH_SUPER_ADMIN_ROLE,
] as const satisfies readonly AuthUserRole[];

export type AuthStaffAccessRole = (typeof AUTH_STAFF_ACCESS_ROLES)[number];

export const AUTH_CUSTOMER_ACCESS_ROLES = [
  AUTH_CUSTOMER_ROLE,
] as const satisfies readonly AuthUserRole[];

export type AuthCustomerAccessRole =
  (typeof AUTH_CUSTOMER_ACCESS_ROLES)[number];

export const AUTH_GUEST_ACCESS_ROLES = [
  AUTH_GUEST_ROLE,
] as const satisfies readonly AuthUserRole[];

export type AuthGuestAccessRole = (typeof AUTH_GUEST_ACCESS_ROLES)[number];

const AUTH_USER_ROLE_SET = new Set<AuthUserRole>(AUTH_USER_ROLES);
const AUTH_PRIVILEGED_ROLE_SET = new Set<AuthUserRole>(AUTH_PRIVILEGED_ROLES);
const AUTH_ADMIN_ACCESS_ROLE_SET = new Set<AuthUserRole>(
  AUTH_ADMIN_ACCESS_ROLES,
);
const AUTH_STAFF_ACCESS_ROLE_SET = new Set<AuthUserRole>(
  AUTH_STAFF_ACCESS_ROLES,
);
const AUTH_CUSTOMER_ACCESS_ROLE_SET = new Set<AuthUserRole>(
  AUTH_CUSTOMER_ACCESS_ROLES,
);
const AUTH_GUEST_ACCESS_ROLE_SET = new Set<AuthUserRole>(
  AUTH_GUEST_ACCESS_ROLES,
);

export function isAuthUserRole(value: string): value is AuthUserRole {
  return AUTH_USER_ROLE_SET.has(value as AuthUserRole);
}

export function isAuthPrivilegedRole(
  value: AuthUserRole,
): value is AuthPrivilegedRole {
  return AUTH_PRIVILEGED_ROLE_SET.has(value);
}

export function isAuthAdminAccessRole(
  value: AuthUserRole,
): value is AuthAdminAccessRole {
  return AUTH_ADMIN_ACCESS_ROLE_SET.has(value);
}

export function isAuthStaffAccessRole(
  value: AuthUserRole,
): value is AuthStaffAccessRole {
  return AUTH_STAFF_ACCESS_ROLE_SET.has(value);
}

export function isAuthCustomerAccessRole(
  value: AuthUserRole,
): value is AuthCustomerAccessRole {
  return AUTH_CUSTOMER_ACCESS_ROLE_SET.has(value);
}

export function isAuthGuestAccessRole(
  value: AuthUserRole,
): value is AuthGuestAccessRole {
  return AUTH_GUEST_ACCESS_ROLE_SET.has(value);
}
