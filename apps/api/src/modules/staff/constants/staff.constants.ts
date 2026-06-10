// apps/api/src/modules/staff/constants/staff.constants.ts
/**
 * LAFAM Staff module constants.
 *
 * Role:
 * - Defines Staff Module statuses, allowed staff portal roles, validation limits,
 *   availability constraints, pagination defaults, metadata keys, and audit event names.
 * - Keeps DTOs, services, repositories, controllers, and Swagger aligned.
 *
 * Important:
 * - This file contains constants only.
 * - Do not place database queries here.
 * - Do not place service logic here.
 * - Do not place secrets or environment-derived values here.
 * - Security roles come from the Auth module role constants.
 */

import {
  AUTH_ADMIN_ROLE,
  AUTH_STAFF_ROLE,
  AUTH_SUPER_ADMIN_ROLE,
  AUTH_TRAINER_ROLE,
  type AuthUserRole,
} from '../../auth/constants/auth-role.constants';

export const STAFF_MODULE_NAME = 'staff' as const;

export const STAFF_ADMIN_ROUTE_PREFIX = 'admin/staff' as const;

export const STAFF_PROFILE_STATUSES = [
  'available',
  'unavailable',
  'on_leave',
  'deactivated',
  'deleted',
] as const;

export type StaffProfileStatus = (typeof STAFF_PROFILE_STATUSES)[number];

export const STAFF_PROFILE_STATUS_AVAILABLE =
  'available' satisfies StaffProfileStatus;
export const STAFF_PROFILE_STATUS_UNAVAILABLE =
  'unavailable' satisfies StaffProfileStatus;
export const STAFF_PROFILE_STATUS_ON_LEAVE =
  'on_leave' satisfies StaffProfileStatus;
export const STAFF_PROFILE_STATUS_DEACTIVATED =
  'deactivated' satisfies StaffProfileStatus;
export const STAFF_PROFILE_STATUS_DELETED =
  'deleted' satisfies StaffProfileStatus;

export const STAFF_PROFILE_ACTIVE_STATUSES = [
  STAFF_PROFILE_STATUS_AVAILABLE,
  STAFF_PROFILE_STATUS_UNAVAILABLE,
  STAFF_PROFILE_STATUS_ON_LEAVE,
] as const satisfies readonly StaffProfileStatus[];

export const STAFF_PROFILE_SYSTEM_STATUSES = [
  STAFF_PROFILE_STATUS_DEACTIVATED,
  STAFF_PROFILE_STATUS_DELETED,
] as const satisfies readonly StaffProfileStatus[];

export const STAFF_PROFILE_CREATE_ALLOWED_STATUSES = [
  STAFF_PROFILE_STATUS_AVAILABLE,
  STAFF_PROFILE_STATUS_UNAVAILABLE,
  STAFF_PROFILE_STATUS_ON_LEAVE,
] as const satisfies readonly StaffProfileStatus[];

export const STAFF_PROFILE_UPDATE_ALLOWED_STATUSES = [
  STAFF_PROFILE_STATUS_AVAILABLE,
  STAFF_PROFILE_STATUS_UNAVAILABLE,
  STAFF_PROFILE_STATUS_ON_LEAVE,
] as const satisfies readonly StaffProfileStatus[];

export type StaffProfileActiveStatus =
  (typeof STAFF_PROFILE_ACTIVE_STATUSES)[number];

export type StaffProfileSystemStatus =
  (typeof STAFF_PROFILE_SYSTEM_STATUSES)[number];

export type StaffProfileCreateAllowedStatus =
  (typeof STAFF_PROFILE_CREATE_ALLOWED_STATUSES)[number];

export type StaffProfileUpdateAllowedStatus =
  (typeof STAFF_PROFILE_UPDATE_ALLOWED_STATUSES)[number];

export type StaffPortalRole = Extract<AuthUserRole, 'trainer' | 'staff'>;

export const STAFF_PORTAL_ROLES = [
  AUTH_TRAINER_ROLE,
  AUTH_STAFF_ROLE,
] as const satisfies readonly StaffPortalRole[];

export const STAFF_PORTAL_ROLE_TRAINER =
  AUTH_TRAINER_ROLE satisfies StaffPortalRole;
export const STAFF_PORTAL_ROLE_STAFF =
  AUTH_STAFF_ROLE satisfies StaffPortalRole;

export type StaffAdminManagementRole = Extract<
  AuthUserRole,
  'admin' | 'super_admin'
>;

export const STAFF_ADMIN_MANAGEMENT_ROLES = [
  AUTH_ADMIN_ROLE,
  AUTH_SUPER_ADMIN_ROLE,
] as const satisfies readonly StaffAdminManagementRole[];

export const STAFF_HARD_DELETE_ALLOWED_ROLES = [
  AUTH_SUPER_ADMIN_ROLE,
] as const satisfies readonly StaffAdminManagementRole[];

export const STAFF_DISPLAY_NAME_MIN_LENGTH = 1;
export const STAFF_DISPLAY_NAME_MAX_LENGTH = 120;

export const STAFF_EMAIL_MAX_LENGTH = 254;

export const STAFF_PHONE_MAX_LENGTH = 32;

export const STAFF_ADDRESS_MAX_LENGTH = 500;

export const STAFF_POST_TITLE_MIN_LENGTH = 1;
export const STAFF_POST_TITLE_MAX_LENGTH = 100;

export const STAFF_BIO_MAX_LENGTH = 1000;

export const STAFF_SPECIALTY_MIN_LENGTH = 1;
export const STAFF_SPECIALTY_MAX_LENGTH = 80;
export const STAFF_SPECIALTIES_MAX_COUNT = 20;

export const STAFF_PASSWORD_MIN_LENGTH = 8;
export const STAFF_PASSWORD_MAX_LENGTH = 128;

export const STAFF_TIME_VALUE_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;

export const STAFF_DAY_OF_WEEK_VALUES = [0, 1, 2, 3, 4, 5, 6] as const;

export type StaffDayOfWeek = (typeof STAFF_DAY_OF_WEEK_VALUES)[number];

export const STAFF_DAY_OF_WEEK_SUNDAY = 0 satisfies StaffDayOfWeek;
export const STAFF_DAY_OF_WEEK_MONDAY = 1 satisfies StaffDayOfWeek;
export const STAFF_DAY_OF_WEEK_TUESDAY = 2 satisfies StaffDayOfWeek;
export const STAFF_DAY_OF_WEEK_WEDNESDAY = 3 satisfies StaffDayOfWeek;
export const STAFF_DAY_OF_WEEK_THURSDAY = 4 satisfies StaffDayOfWeek;
export const STAFF_DAY_OF_WEEK_FRIDAY = 5 satisfies StaffDayOfWeek;
export const STAFF_DAY_OF_WEEK_SATURDAY = 6 satisfies StaffDayOfWeek;

export const STAFF_DAY_OF_WEEK_LABELS = {
  [STAFF_DAY_OF_WEEK_SUNDAY]: 'Sunday',
  [STAFF_DAY_OF_WEEK_MONDAY]: 'Monday',
  [STAFF_DAY_OF_WEEK_TUESDAY]: 'Tuesday',
  [STAFF_DAY_OF_WEEK_WEDNESDAY]: 'Wednesday',
  [STAFF_DAY_OF_WEEK_THURSDAY]: 'Thursday',
  [STAFF_DAY_OF_WEEK_FRIDAY]: 'Friday',
  [STAFF_DAY_OF_WEEK_SATURDAY]: 'Saturday',
} as const satisfies Record<StaffDayOfWeek, string>;

export const STAFF_AVAILABILITY_MIN_RULES = 1;
export const STAFF_AVAILABILITY_MAX_RULES = 7;

export const STAFF_DEFAULT_AVAILABILITY_IS_AVAILABLE = true;

export const STAFF_LIST_DEFAULT_LIMIT = 50;
export const STAFF_LIST_MAX_LIMIT = 100;
export const STAFF_LIST_DEFAULT_OFFSET = 0;

export const STAFF_AUTH_METADATA_SOURCE_KEY = 'source' as const;
export const STAFF_AUTH_METADATA_CREATED_BY_ADMIN_ID_KEY =
  'created_by_admin_id' as const;
export const STAFF_AUTH_METADATA_PORTAL_ROLE_KEY = 'portal_role' as const;

export const STAFF_AUTH_METADATA_SOURCE_ADMIN_STAFF_CREATE =
  'lafam_admin_staff_create' as const;

export const STAFF_AUDIT_EVENT_STAFF_CREATED = 'staff.created' as const;
export const STAFF_AUDIT_EVENT_STAFF_UPDATED = 'staff.updated' as const;
export const STAFF_AUDIT_EVENT_STAFF_AVAILABILITY_UPDATED =
  'staff.availability_updated' as const;
export const STAFF_AUDIT_EVENT_STAFF_DEACTIVATED = 'staff.deactivated' as const;
export const STAFF_AUDIT_EVENT_STAFF_REACTIVATED = 'staff.reactivated' as const;
export const STAFF_AUDIT_EVENT_STAFF_DELETED = 'staff.deleted' as const;
export const STAFF_AUDIT_EVENT_STAFF_AUTH_USER_CREATION_FAILED =
  'staff.auth_user_creation_failed' as const;
export const STAFF_AUDIT_EVENT_STAFF_PROFILE_CREATION_FAILED =
  'staff.profile_creation_failed' as const;

export const STAFF_AUDIT_EVENTS = [
  STAFF_AUDIT_EVENT_STAFF_CREATED,
  STAFF_AUDIT_EVENT_STAFF_UPDATED,
  STAFF_AUDIT_EVENT_STAFF_AVAILABILITY_UPDATED,
  STAFF_AUDIT_EVENT_STAFF_DEACTIVATED,
  STAFF_AUDIT_EVENT_STAFF_REACTIVATED,
  STAFF_AUDIT_EVENT_STAFF_DELETED,
  STAFF_AUDIT_EVENT_STAFF_AUTH_USER_CREATION_FAILED,
  STAFF_AUDIT_EVENT_STAFF_PROFILE_CREATION_FAILED,
] as const;

export type StaffAuditEvent = (typeof STAFF_AUDIT_EVENTS)[number];

const STAFF_PROFILE_STATUS_SET = new Set<StaffProfileStatus>(
  STAFF_PROFILE_STATUSES,
);

const STAFF_PROFILE_CREATE_ALLOWED_STATUS_SET =
  new Set<StaffProfileCreateAllowedStatus>(
    STAFF_PROFILE_CREATE_ALLOWED_STATUSES,
  );

const STAFF_PROFILE_UPDATE_ALLOWED_STATUS_SET =
  new Set<StaffProfileUpdateAllowedStatus>(
    STAFF_PROFILE_UPDATE_ALLOWED_STATUSES,
  );

const STAFF_PORTAL_ROLE_SET = new Set<StaffPortalRole>(STAFF_PORTAL_ROLES);

const STAFF_ADMIN_MANAGEMENT_ROLE_SET = new Set<StaffAdminManagementRole>(
  STAFF_ADMIN_MANAGEMENT_ROLES,
);

const STAFF_DAY_OF_WEEK_VALUE_SET = new Set<number>(STAFF_DAY_OF_WEEK_VALUES);

export function isStaffProfileStatus(
  value: string,
): value is StaffProfileStatus {
  return STAFF_PROFILE_STATUS_SET.has(value as StaffProfileStatus);
}

export function isStaffProfileCreateAllowedStatus(
  value: string,
): value is StaffProfileCreateAllowedStatus {
  return STAFF_PROFILE_CREATE_ALLOWED_STATUS_SET.has(
    value as StaffProfileCreateAllowedStatus,
  );
}

export function isStaffProfileUpdateAllowedStatus(
  value: string,
): value is StaffProfileUpdateAllowedStatus {
  return STAFF_PROFILE_UPDATE_ALLOWED_STATUS_SET.has(
    value as StaffProfileUpdateAllowedStatus,
  );
}

export function isStaffPortalRole(value: string): value is StaffPortalRole {
  return STAFF_PORTAL_ROLE_SET.has(value as StaffPortalRole);
}

export function isStaffAdminManagementRole(
  value: AuthUserRole,
): value is StaffAdminManagementRole {
  return STAFF_ADMIN_MANAGEMENT_ROLE_SET.has(value as StaffAdminManagementRole);
}

export function isStaffDayOfWeek(value: number): value is StaffDayOfWeek {
  return STAFF_DAY_OF_WEEK_VALUE_SET.has(value);
}
