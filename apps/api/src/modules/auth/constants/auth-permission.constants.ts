// apps/api/src/modules/auth/constants/auth-permission.constants.ts
/**
 * LAFAM Auth permission constants.
 *
 * Role:
 * - Defines stable permission strings returned by /auth/context.
 * - Maps Auth roles to permission sets.
 * - Keeps guest/customer/staff/trainer/admin access decisions consistent across guards, services, and frontend bootstrapping.
 *
 * Important:
 * - Permissions are application-level authorization hints.
 * - Frontend permission rendering is usability only.
 * - Backend guards/services remain the final authority.
 * - Staff and trainer currently share the same operational permission set for selected admin surfaces.
 * - Stylists are intentionally kept separate from the staff/trainer operational expansion.
 */

import {
  AUTH_ADMIN_ROLE,
  AUTH_CUSTOMER_ROLE,
  AUTH_GUEST_ROLE,
  AUTH_STAFF_ROLE,
  AUTH_STYLIST_ROLE,
  AUTH_SUPER_ADMIN_ROLE,
  AUTH_TRAINER_ROLE,
  type AuthUserRole,
} from './auth-role.constants';

export const AUTH_PERMISSIONS = [
  'public:read_home',
  'public:read_classes',
  'public:read_class_details',
  'public:read_trainers',
  'public:read_offers',

  'guest:create_session',
  'guest:read_public_catalog',
  'guest:read_availability',
  'guest:convert_to_customer',
  'guest:end_session',

  'auth:read_context',

  'session:logout',
  'session:logout_all',
  'session:read_active',
  'session:revoke',

  'profile:read',
  'profile:update',
  'profile:delete_account',

  'avatar:read',
  'avatar:upload',

  'password:change',

  'booking:create_confirmed',
  'booking:create_bulk',
  'booking:view_history',
  'booking:cancel',
  'booking:reschedule',

  'payment:create',

  'wallet:read',

  'staff:access_dashboard',

  'admin:access_dashboard',
  'admin:analytics:read',

  'admin:users:read',
  'admin:users:deactivate',
  'admin:users:reactivate',

  'admin:staff:read',

  'admin:customers:read',
  'admin:customers:lookup',
  'admin:customers:create',
  'admin:customers:update',
  'admin:customers:deactivate',
  'admin:customers:reactivate',
  'admin:customers:delete',
  'admin:customers:manage',

  'admin:pilates:classes:read',
  'admin:pilates:classes:create',
  'admin:pilates:classes:update',
  'admin:pilates:classes:delete',
  'admin:pilates:classes:manage',

  'admin:pilates:schedules:read',
  'admin:pilates:schedules:create',
  'admin:pilates:schedules:update',
  'admin:pilates:schedules:cancel',
  'admin:pilates:schedules:complete',
  'admin:pilates:schedules:delete',
  'admin:pilates:schedules:manage',

  'admin:bookings:read',
  'admin:bookings:create',
  'admin:bookings:bulk_create',
  'admin:bookings:update',
  'admin:bookings:cancel',
  'admin:bookings:reschedule',
  'admin:bookings:override',
  'admin:bookings:waitlist',
  'admin:bookings:calendar',
  'admin:bookings:manage',
  'admin:bookings:manage_scoped',

  'super_admin:users:hard_delete',
] as const;

export type AuthPermission = (typeof AUTH_PERMISSIONS)[number];

export const AUTH_PUBLIC_READ_PERMISSIONS = [
  'public:read_home',
  'public:read_classes',
  'public:read_class_details',
  'public:read_trainers',
  'public:read_offers',
] as const satisfies readonly AuthPermission[];

export const AUTH_GUEST_PERMISSIONS = [
  ...AUTH_PUBLIC_READ_PERMISSIONS,
  'guest:create_session',
  'guest:read_public_catalog',
  'guest:read_availability',
  'guest:convert_to_customer',
  'guest:end_session',
  'auth:read_context',
] as const satisfies readonly AuthPermission[];

export const AUTH_SESSION_PERMISSIONS = [
  'session:logout',
  'session:logout_all',
  'session:read_active',
  'session:revoke',
] as const satisfies readonly AuthPermission[];

export const AUTH_PROFILE_PERMISSIONS = [
  'profile:read',
  'profile:update',
  'profile:delete_account',
  'avatar:read',
  'avatar:upload',
  'password:change',
] as const satisfies readonly AuthPermission[];

export const AUTH_CUSTOMER_BOOKING_PERMISSIONS = [
  'booking:create_confirmed',
  'booking:create_bulk',
  'booking:view_history',
  'booking:cancel',
  'booking:reschedule',
  'payment:create',
  'wallet:read',
] as const satisfies readonly AuthPermission[];

export const AUTH_CUSTOMER_PERMISSIONS = [
  ...AUTH_PUBLIC_READ_PERMISSIONS,
  'auth:read_context',
  ...AUTH_SESSION_PERMISSIONS,
  ...AUTH_PROFILE_PERMISSIONS,
  ...AUTH_CUSTOMER_BOOKING_PERMISSIONS,
] as const satisfies readonly AuthPermission[];

export const AUTH_STAFF_BASE_PERMISSIONS = [
  ...AUTH_PUBLIC_READ_PERMISSIONS,
  'auth:read_context',
  ...AUTH_SESSION_PERMISSIONS,
  ...AUTH_PROFILE_PERMISSIONS,
  'staff:access_dashboard',
] as const satisfies readonly AuthPermission[];

export const AUTH_ADMIN_CUSTOMER_PERMISSIONS = [
  'admin:customers:read',
  'admin:customers:lookup',
  'admin:customers:create',
  'admin:customers:update',
  'admin:customers:deactivate',
  'admin:customers:reactivate',
  'admin:customers:delete',
  'admin:customers:manage',
] as const satisfies readonly AuthPermission[];
export const AUTH_ADMIN_BOOKING_PERMISSIONS = [
  'admin:bookings:read',
  'admin:bookings:create',
  'admin:bookings:bulk_create',
  'admin:bookings:update',
  'admin:bookings:cancel',
  'admin:bookings:reschedule',
  'admin:bookings:override',
  'admin:bookings:waitlist',
  'admin:bookings:calendar',
  'admin:bookings:manage',
] as const satisfies readonly AuthPermission[];
export const AUTH_ADMIN_ANALYTICS_PERMISSIONS = [
  'admin:analytics:read',
] as const satisfies readonly AuthPermission[];

export const AUTH_ADMIN_STAFF_READ_PERMISSIONS = [
  'admin:staff:read',
] as const satisfies readonly AuthPermission[];

export const AUTH_ADMIN_PILATES_CLASS_PERMISSIONS = [
  'admin:pilates:classes:read',
  'admin:pilates:classes:create',
  'admin:pilates:classes:update',
  'admin:pilates:classes:delete',
  'admin:pilates:classes:manage',
] as const satisfies readonly AuthPermission[];

export const AUTH_ADMIN_PILATES_SCHEDULE_PERMISSIONS = [
  'admin:pilates:schedules:read',
  'admin:pilates:schedules:create',
  'admin:pilates:schedules:update',
  'admin:pilates:schedules:cancel',
  'admin:pilates:schedules:complete',
  'admin:pilates:schedules:delete',
  'admin:pilates:schedules:manage',
] as const satisfies readonly AuthPermission[];

export const AUTH_ADMIN_PILATES_PERMISSIONS = [
  ...AUTH_ADMIN_PILATES_CLASS_PERMISSIONS,
  ...AUTH_ADMIN_PILATES_SCHEDULE_PERMISSIONS,
] as const satisfies readonly AuthPermission[];

export const AUTH_TRAINER_SCOPED_BOOKING_PERMISSIONS = [
  'admin:bookings:read',
  'admin:bookings:create',
  'booking:create_confirmed',
  'admin:bookings:bulk_create',
  'admin:bookings:update',
  'admin:bookings:cancel',
  'admin:bookings:reschedule',
  'admin:bookings:override',
  'admin:bookings:waitlist',
  'admin:bookings:calendar',
  'admin:bookings:manage_scoped',
] as const satisfies readonly AuthPermission[];

export const AUTH_STYLIST_PERMISSIONS = [
  ...AUTH_STAFF_BASE_PERMISSIONS,
  ...AUTH_ADMIN_CUSTOMER_PERMISSIONS,
  ...AUTH_ADMIN_BOOKING_PERMISSIONS,
] as const satisfies readonly AuthPermission[];

export const AUTH_STAFF_AND_TRAINER_PERMISSIONS = [
  ...AUTH_STAFF_BASE_PERMISSIONS,
  ...AUTH_ADMIN_CUSTOMER_PERMISSIONS,
  ...AUTH_ADMIN_BOOKING_PERMISSIONS,
  ...AUTH_ADMIN_ANALYTICS_PERMISSIONS,
  ...AUTH_ADMIN_STAFF_READ_PERMISSIONS,
  ...AUTH_ADMIN_PILATES_PERMISSIONS,
] as const satisfies readonly AuthPermission[];

export const AUTH_STAFF_PERMISSIONS =
  AUTH_STAFF_AND_TRAINER_PERMISSIONS satisfies readonly AuthPermission[];

export const AUTH_TRAINER_PERMISSIONS =
  AUTH_STAFF_AND_TRAINER_PERMISSIONS satisfies readonly AuthPermission[];

export const AUTH_ADMIN_PERMISSIONS = [
  ...AUTH_STAFF_BASE_PERMISSIONS,
  'admin:access_dashboard',
  'admin:users:read',
  'admin:users:deactivate',
  'admin:users:reactivate',
  ...AUTH_ADMIN_CUSTOMER_PERMISSIONS,
  ...AUTH_ADMIN_BOOKING_PERMISSIONS,
  ...AUTH_ADMIN_ANALYTICS_PERMISSIONS,
  ...AUTH_ADMIN_STAFF_READ_PERMISSIONS,
  ...AUTH_ADMIN_PILATES_PERMISSIONS,
] as const satisfies readonly AuthPermission[];

export const AUTH_SUPER_ADMIN_PERMISSIONS = [
  ...AUTH_ADMIN_PERMISSIONS,
  'super_admin:users:hard_delete',
] as const satisfies readonly AuthPermission[];

export const AUTH_GUEST_DENIED_PERMISSIONS = [
  'booking:create_confirmed',
  'booking:create_bulk',
  'booking:view_history',
  'booking:cancel',
  'booking:reschedule',
  'payment:create',
  'wallet:read',
  'profile:update',
  'profile:delete_account',
  'avatar:upload',
  'password:change',
  'staff:access_dashboard',
  'admin:access_dashboard',
  'admin:analytics:read',
  'admin:users:read',
  'admin:users:deactivate',
  'admin:users:reactivate',
  'admin:staff:read',
  'admin:customers:read',
  'admin:customers:lookup',
  'admin:customers:create',
  'admin:customers:update',
  'admin:customers:deactivate',
  'admin:customers:reactivate',
  'admin:customers:delete',
  'admin:customers:manage',
  'admin:pilates:classes:read',
  'admin:pilates:classes:create',
  'admin:pilates:classes:update',
  'admin:pilates:classes:delete',
  'admin:pilates:classes:manage',
  'admin:pilates:schedules:read',
  'admin:pilates:schedules:create',
  'admin:pilates:schedules:update',
  'admin:pilates:schedules:cancel',
  'admin:pilates:schedules:complete',
  'admin:pilates:schedules:delete',
  'admin:pilates:schedules:manage',
  'admin:bookings:read',
  'admin:bookings:create',
  'admin:bookings:bulk_create',
  'admin:bookings:update',
  'admin:bookings:cancel',
  'admin:bookings:reschedule',
  'admin:bookings:override',
  'admin:bookings:waitlist',
  'admin:bookings:calendar',
  'admin:bookings:manage',
  'admin:bookings:manage_scoped',
  'super_admin:users:hard_delete',
] as const satisfies readonly AuthPermission[];

export const AUTH_ROLE_PERMISSIONS = {
  [AUTH_GUEST_ROLE]: AUTH_GUEST_PERMISSIONS,
  [AUTH_CUSTOMER_ROLE]: AUTH_CUSTOMER_PERMISSIONS,
  [AUTH_TRAINER_ROLE]: AUTH_TRAINER_PERMISSIONS,
  [AUTH_STYLIST_ROLE]: AUTH_STYLIST_PERMISSIONS,
  [AUTH_STAFF_ROLE]: AUTH_STAFF_PERMISSIONS,
  [AUTH_ADMIN_ROLE]: AUTH_ADMIN_PERMISSIONS,
  [AUTH_SUPER_ADMIN_ROLE]: AUTH_SUPER_ADMIN_PERMISSIONS,
} as const satisfies Record<AuthUserRole, readonly AuthPermission[]>;

export const AUTH_ADMIN_ACCESS_PERMISSIONS = [
  'admin:access_dashboard',
] as const satisfies readonly AuthPermission[];

export const AUTH_STAFF_ACCESS_PERMISSIONS = [
  'staff:access_dashboard',
] as const satisfies readonly AuthPermission[];

export const AUTH_BOOKING_WRITE_PERMISSIONS = [
  'booking:create_confirmed',
  'booking:cancel',
  'booking:reschedule',
] as const satisfies readonly AuthPermission[];
export const AUTH_ADMIN_BOOKING_WRITE_PERMISSIONS = [
  'admin:bookings:create',
  'admin:bookings:bulk_create',
  'admin:bookings:update',
  'admin:bookings:cancel',
  'admin:bookings:reschedule',
  'admin:bookings:override',
] as const satisfies readonly AuthPermission[];

export const AUTH_TRAINER_SCOPED_BOOKING_WRITE_PERMISSIONS = [
  'admin:bookings:bulk_create',
  'admin:bookings:manage_scoped',
] as const satisfies readonly AuthPermission[];

export const AUTH_PAYMENT_PERMISSIONS = [
  'payment:create',
] as const satisfies readonly AuthPermission[];

export const AUTH_WALLET_PERMISSIONS = [
  'wallet:read',
] as const satisfies readonly AuthPermission[];

const AUTH_PERMISSION_SET = new Set<AuthPermission>(AUTH_PERMISSIONS);

export function isAuthPermission(value: string): value is AuthPermission {
  return AUTH_PERMISSION_SET.has(value as AuthPermission);
}

export function getAuthPermissionsForRole(
  role: AuthUserRole,
): readonly AuthPermission[] {
  return AUTH_ROLE_PERMISSIONS[role];
}

export function roleHasAuthPermission(
  role: AuthUserRole,
  permission: AuthPermission,
): boolean {
  return getAuthPermissionsForRole(role).includes(permission);
}

export function roleHasEveryAuthPermission(
  role: AuthUserRole,
  permissions: readonly AuthPermission[],
): boolean {
  const rolePermissions = getAuthPermissionsForRole(role);

  return permissions.every((permission) =>
    rolePermissions.includes(permission),
  );
}

export function roleHasSomeAuthPermission(
  role: AuthUserRole,
  permissions: readonly AuthPermission[],
): boolean {
  const rolePermissions = getAuthPermissionsForRole(role);

  return permissions.some((permission) => rolePermissions.includes(permission));
}
