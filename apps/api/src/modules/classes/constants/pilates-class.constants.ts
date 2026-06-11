// apps/api/src/modules/classes/constants/pilates-class.constants.ts
/**
 * LAFAM Pilates Classes module constants.
 *
 * Role:
 * - Defines Pilates class statuses, schedule statuses, levels, route prefixes,
 *   validation limits, pagination defaults, realtime event names, and role access.
 * - Keeps DTOs, services, repositories, controllers, and Swagger aligned.
 *
 * Important:
 * - This file contains constants and lightweight type guards only.
 * - Do not place database queries here.
 * - Do not place service logic here.
 * - Do not place environment-derived values here.
 * - Pilates flow must remain separate from the future Salon flow.
 */

import {
  AUTH_ADMIN_ROLE,
  AUTH_CUSTOMER_ROLE,
  AUTH_GUEST_ROLE,
  AUTH_SUPER_ADMIN_ROLE,
  AUTH_TRAINER_ROLE,
  type AuthUserRole,
} from '../../auth/constants/auth-role.constants';

export const PILATES_CLASSES_MODULE_NAME = 'classes' as const;

export const PILATES_ADMIN_CLASSES_ROUTE_PREFIX =
  'admin/pilates/classes' as const;

export const PILATES_ADMIN_SCHEDULES_ROUTE_PREFIX =
  'admin/pilates/schedules' as const;

export const PILATES_PUBLIC_CLASSES_ROUTE_PREFIX = 'pilates/classes' as const;

export const PILATES_PUBLIC_SCHEDULES_ROUTE_PREFIX =
  'pilates/schedules' as const;

export const PILATES_CLASS_STATUSES = [
  'draft',
  'active',
  'inactive',
  'deleted',
] as const;

export type PilatesClassStatus = (typeof PILATES_CLASS_STATUSES)[number];

export const PILATES_CLASS_STATUS_DRAFT = 'draft' satisfies PilatesClassStatus;

export const PILATES_CLASS_STATUS_ACTIVE =
  'active' satisfies PilatesClassStatus;

export const PILATES_CLASS_STATUS_INACTIVE =
  'inactive' satisfies PilatesClassStatus;

export const PILATES_CLASS_STATUS_DELETED =
  'deleted' satisfies PilatesClassStatus;

export const PILATES_CLASS_CREATE_ALLOWED_STATUSES = [
  PILATES_CLASS_STATUS_DRAFT,
  PILATES_CLASS_STATUS_ACTIVE,
  PILATES_CLASS_STATUS_INACTIVE,
] as const satisfies readonly PilatesClassStatus[];

export const PILATES_CLASS_UPDATE_ALLOWED_STATUSES = [
  PILATES_CLASS_STATUS_DRAFT,
  PILATES_CLASS_STATUS_ACTIVE,
  PILATES_CLASS_STATUS_INACTIVE,
] as const satisfies readonly PilatesClassStatus[];

export const PILATES_CLASS_PUBLIC_VISIBLE_STATUSES = [
  PILATES_CLASS_STATUS_ACTIVE,
] as const satisfies readonly PilatesClassStatus[];

export const PILATES_CLASS_SYSTEM_STATUSES = [
  PILATES_CLASS_STATUS_DELETED,
] as const satisfies readonly PilatesClassStatus[];

export type PilatesClassCreateAllowedStatus =
  (typeof PILATES_CLASS_CREATE_ALLOWED_STATUSES)[number];

export type PilatesClassUpdateAllowedStatus =
  (typeof PILATES_CLASS_UPDATE_ALLOWED_STATUSES)[number];

export type PilatesClassPublicVisibleStatus =
  (typeof PILATES_CLASS_PUBLIC_VISIBLE_STATUSES)[number];

export type PilatesClassSystemStatus =
  (typeof PILATES_CLASS_SYSTEM_STATUSES)[number];

export const PILATES_CLASS_SCHEDULE_STATUSES = [
  'scheduled',
  'cancelled',
  'completed',
  'deleted',
] as const;

export type PilatesClassScheduleStatus =
  (typeof PILATES_CLASS_SCHEDULE_STATUSES)[number];

export const PILATES_CLASS_SCHEDULE_STATUS_SCHEDULED =
  'scheduled' satisfies PilatesClassScheduleStatus;

export const PILATES_CLASS_SCHEDULE_STATUS_CANCELLED =
  'cancelled' satisfies PilatesClassScheduleStatus;

export const PILATES_CLASS_SCHEDULE_STATUS_COMPLETED =
  'completed' satisfies PilatesClassScheduleStatus;

export const PILATES_CLASS_SCHEDULE_STATUS_DELETED =
  'deleted' satisfies PilatesClassScheduleStatus;

export const PILATES_CLASS_SCHEDULE_CREATE_ALLOWED_STATUSES = [
  PILATES_CLASS_SCHEDULE_STATUS_SCHEDULED,
] as const satisfies readonly PilatesClassScheduleStatus[];

export const PILATES_CLASS_SCHEDULE_UPDATE_ALLOWED_STATUSES = [
  PILATES_CLASS_SCHEDULE_STATUS_SCHEDULED,
] as const satisfies readonly PilatesClassScheduleStatus[];

export const PILATES_CLASS_SCHEDULE_PUBLIC_VISIBLE_STATUSES = [
  PILATES_CLASS_SCHEDULE_STATUS_SCHEDULED,
] as const satisfies readonly PilatesClassScheduleStatus[];

export const PILATES_CLASS_SCHEDULE_TERMINAL_STATUSES = [
  PILATES_CLASS_SCHEDULE_STATUS_CANCELLED,
  PILATES_CLASS_SCHEDULE_STATUS_COMPLETED,
  PILATES_CLASS_SCHEDULE_STATUS_DELETED,
] as const satisfies readonly PilatesClassScheduleStatus[];

export type PilatesClassScheduleCreateAllowedStatus =
  (typeof PILATES_CLASS_SCHEDULE_CREATE_ALLOWED_STATUSES)[number];

export type PilatesClassScheduleUpdateAllowedStatus =
  (typeof PILATES_CLASS_SCHEDULE_UPDATE_ALLOWED_STATUSES)[number];

export type PilatesClassSchedulePublicVisibleStatus =
  (typeof PILATES_CLASS_SCHEDULE_PUBLIC_VISIBLE_STATUSES)[number];

export type PilatesClassScheduleTerminalStatus =
  (typeof PILATES_CLASS_SCHEDULE_TERMINAL_STATUSES)[number];

export const PILATES_CLASS_LEVELS = [
  'beginner',
  'intermediate',
  'advanced',
  'all_levels',
] as const;

export type PilatesClassLevel = (typeof PILATES_CLASS_LEVELS)[number];

export const PILATES_CLASS_LEVEL_BEGINNER =
  'beginner' satisfies PilatesClassLevel;

export const PILATES_CLASS_LEVEL_INTERMEDIATE =
  'intermediate' satisfies PilatesClassLevel;

export const PILATES_CLASS_LEVEL_ADVANCED =
  'advanced' satisfies PilatesClassLevel;

export const PILATES_CLASS_LEVEL_ALL_LEVELS =
  'all_levels' satisfies PilatesClassLevel;

export const PILATES_CLASS_DEFAULT_LEVEL =
  PILATES_CLASS_LEVEL_ALL_LEVELS satisfies PilatesClassLevel;

export type PilatesClassAdminManagementRole = Extract<
  AuthUserRole,
  'admin' | 'super_admin'
>;

export const PILATES_CLASS_ADMIN_MANAGEMENT_ROLES = [
  AUTH_ADMIN_ROLE,
  AUTH_SUPER_ADMIN_ROLE,
] as const satisfies readonly PilatesClassAdminManagementRole[];

export type PilatesClassTrainerRole = Extract<AuthUserRole, 'trainer'>;

export const PILATES_CLASS_TRAINER_ROLE =
  AUTH_TRAINER_ROLE satisfies PilatesClassTrainerRole;

export type PilatesClassPublicAccessRole = Extract<
  AuthUserRole,
  'guest' | 'customer' | 'trainer' | 'admin' | 'super_admin'
>;

export const PILATES_CLASS_PUBLIC_ACCESS_ROLES = [
  AUTH_GUEST_ROLE,
  AUTH_CUSTOMER_ROLE,
  AUTH_TRAINER_ROLE,
  AUTH_ADMIN_ROLE,
  AUTH_SUPER_ADMIN_ROLE,
] as const satisfies readonly PilatesClassPublicAccessRole[];

export const PILATES_CLASS_TITLE_MIN_LENGTH = 1;
export const PILATES_CLASS_TITLE_MAX_LENGTH = 160;

export const PILATES_CLASS_DESCRIPTION_MAX_LENGTH = 2000;

export const PILATES_CLASS_IMAGE_PATH_MAX_LENGTH = 1000;

export const PILATES_CLASS_IMAGE_BUCKET_ENV_KEY =
  'PILATES_CLASS_IMAGE_BUCKET' as const;

export const PILATES_CLASS_IMAGE_DEFAULT_BUCKET =
  'pilates-class-images' as const;

export const PILATES_CLASS_IMAGE_FIELD_NAME = 'image' as const;

export const PILATES_CLASS_IMAGE_REMOVE_FIELD_NAME = 'remove_image' as const;

export const PILATES_CLASS_IMAGE_STORAGE_ROOT = 'classes' as const;

export const PILATES_CLASS_IMAGE_FILE_BASENAME = 'cover' as const;

export const PILATES_CLASS_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;

export const PILATES_CLASS_IMAGE_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type PilatesClassImageMimeType =
  (typeof PILATES_CLASS_IMAGE_ALLOWED_MIME_TYPES)[number];

export const PILATES_CLASS_IMAGE_EXTENSION_BY_MIME_TYPE = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const satisfies Record<PilatesClassImageMimeType, string>;

export const PILATES_CLASS_DURATION_MIN_MINUTES = 15;
export const PILATES_CLASS_DURATION_MAX_MINUTES = 240;
export const PILATES_CLASS_DEFAULT_DURATION_MINUTES = 60;

export const PILATES_CLASS_CAPACITY_MIN = 1;
export const PILATES_CLASS_CAPACITY_MAX = 100;
export const PILATES_CLASS_DEFAULT_CAPACITY = 8;

export const PILATES_CLASS_STUDIO_MIN_LENGTH = 1;
export const PILATES_CLASS_STUDIO_MAX_LENGTH = 120;
export const PILATES_CLASS_DEFAULT_STUDIO = 'LAFAM Pilates Studio' as const;

export const PILATES_CLASS_CANCELLATION_REASON_MIN_LENGTH = 1;
export const PILATES_CLASS_CANCELLATION_REASON_MAX_LENGTH = 500;

export const PILATES_CLASS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export const PILATES_CLASS_TIME_VALUE_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;

export const PILATES_CLASS_LIST_DEFAULT_LIMIT = 50;
export const PILATES_CLASS_LIST_MAX_LIMIT = 100;
export const PILATES_CLASS_LIST_DEFAULT_OFFSET = 0;

export const PILATES_CLASS_PUBLIC_LIST_DEFAULT_LIMIT = 20;
export const PILATES_CLASS_PUBLIC_LIST_MAX_LIMIT = 100;

export const PILATES_CLASS_SCHEDULE_LIST_DEFAULT_LIMIT = 50;
export const PILATES_CLASS_SCHEDULE_LIST_MAX_LIMIT = 100;
export const PILATES_CLASS_SCHEDULE_LIST_DEFAULT_OFFSET = 0;

export const PILATES_CLASS_SCHEDULE_PUBLIC_LIST_DEFAULT_LIMIT = 20;
export const PILATES_CLASS_SCHEDULE_PUBLIC_LIST_MAX_LIMIT = 100;

export const PILATES_CLASS_TEMPORARY_BOOKED_COUNT = 0;
export const PILATES_CLASS_TEMPORARY_WAITLIST_COUNT = 0;
export const PILATES_CLASS_TEMPORARY_WAITLIST_AVAILABLE = false;

export const PILATES_CLASS_REALTIME_VERSION_INITIAL = 1;

export const PILATES_CLASS_EVENT_CLASS_CREATED =
  'pilates.class.created' as const;

export const PILATES_CLASS_EVENT_CLASS_UPDATED =
  'pilates.class.updated' as const;

export const PILATES_CLASS_EVENT_CLASS_DELETED =
  'pilates.class.deleted' as const;

export const PILATES_CLASS_EVENT_SCHEDULE_CREATED =
  'pilates.schedule.created' as const;

export const PILATES_CLASS_EVENT_SCHEDULE_UPDATED =
  'pilates.schedule.updated' as const;

export const PILATES_CLASS_EVENT_SCHEDULE_CANCELLED =
  'pilates.schedule.cancelled' as const;

export const PILATES_CLASS_EVENT_SCHEDULE_COMPLETED =
  'pilates.schedule.completed' as const;

export const PILATES_CLASS_EVENT_SCHEDULE_DELETED =
  'pilates.schedule.deleted' as const;

export const PILATES_CLASS_EVENT_SCHEDULE_AVAILABILITY_CHANGED =
  'pilates.schedule.availability_changed' as const;

export const PILATES_CLASS_EVENTS = [
  PILATES_CLASS_EVENT_CLASS_CREATED,
  PILATES_CLASS_EVENT_CLASS_UPDATED,
  PILATES_CLASS_EVENT_CLASS_DELETED,
  PILATES_CLASS_EVENT_SCHEDULE_CREATED,
  PILATES_CLASS_EVENT_SCHEDULE_UPDATED,
  PILATES_CLASS_EVENT_SCHEDULE_CANCELLED,
  PILATES_CLASS_EVENT_SCHEDULE_COMPLETED,
  PILATES_CLASS_EVENT_SCHEDULE_DELETED,
  PILATES_CLASS_EVENT_SCHEDULE_AVAILABILITY_CHANGED,
] as const;

export type PilatesClassEvent = (typeof PILATES_CLASS_EVENTS)[number];

export const PILATES_CLASS_SORT_FIELDS = [
  'title',
  'status',
  'level',
  'created_at',
  'updated_at',
] as const;

export type PilatesClassSortField = (typeof PILATES_CLASS_SORT_FIELDS)[number];

export const PILATES_CLASS_DEFAULT_SORT_FIELD =
  'created_at' satisfies PilatesClassSortField;

export const PILATES_CLASS_SCHEDULE_SORT_FIELDS = [
  'class_date',
  'start_time',
  'status',
  'created_at',
  'updated_at',
] as const;

export type PilatesClassScheduleSortField =
  (typeof PILATES_CLASS_SCHEDULE_SORT_FIELDS)[number];

export const PILATES_CLASS_SCHEDULE_DEFAULT_SORT_FIELD =
  'class_date' satisfies PilatesClassScheduleSortField;

export const PILATES_CLASS_SORT_DIRECTIONS = ['asc', 'desc'] as const;

export type PilatesClassSortDirection =
  (typeof PILATES_CLASS_SORT_DIRECTIONS)[number];

export const PILATES_CLASS_DEFAULT_SORT_DIRECTION =
  'desc' satisfies PilatesClassSortDirection;

export const PILATES_CLASS_SCHEDULE_DEFAULT_SORT_DIRECTION =
  'asc' satisfies PilatesClassSortDirection;

const PILATES_CLASS_STATUS_SET = new Set<PilatesClassStatus>(
  PILATES_CLASS_STATUSES,
);

const PILATES_CLASS_CREATE_ALLOWED_STATUS_SET =
  new Set<PilatesClassCreateAllowedStatus>(
    PILATES_CLASS_CREATE_ALLOWED_STATUSES,
  );

const PILATES_CLASS_UPDATE_ALLOWED_STATUS_SET =
  new Set<PilatesClassUpdateAllowedStatus>(
    PILATES_CLASS_UPDATE_ALLOWED_STATUSES,
  );

const PILATES_CLASS_PUBLIC_VISIBLE_STATUS_SET =
  new Set<PilatesClassPublicVisibleStatus>(
    PILATES_CLASS_PUBLIC_VISIBLE_STATUSES,
  );

const PILATES_CLASS_SCHEDULE_STATUS_SET = new Set<PilatesClassScheduleStatus>(
  PILATES_CLASS_SCHEDULE_STATUSES,
);

const PILATES_CLASS_SCHEDULE_CREATE_ALLOWED_STATUS_SET =
  new Set<PilatesClassScheduleCreateAllowedStatus>(
    PILATES_CLASS_SCHEDULE_CREATE_ALLOWED_STATUSES,
  );

const PILATES_CLASS_SCHEDULE_UPDATE_ALLOWED_STATUS_SET =
  new Set<PilatesClassScheduleUpdateAllowedStatus>(
    PILATES_CLASS_SCHEDULE_UPDATE_ALLOWED_STATUSES,
  );

const PILATES_CLASS_SCHEDULE_PUBLIC_VISIBLE_STATUS_SET =
  new Set<PilatesClassSchedulePublicVisibleStatus>(
    PILATES_CLASS_SCHEDULE_PUBLIC_VISIBLE_STATUSES,
  );

const PILATES_CLASS_SCHEDULE_TERMINAL_STATUS_SET =
  new Set<PilatesClassScheduleTerminalStatus>(
    PILATES_CLASS_SCHEDULE_TERMINAL_STATUSES,
  );

const PILATES_CLASS_LEVEL_SET = new Set<PilatesClassLevel>(
  PILATES_CLASS_LEVELS,
);

const PILATES_CLASS_ADMIN_MANAGEMENT_ROLE_SET =
  new Set<PilatesClassAdminManagementRole>(
    PILATES_CLASS_ADMIN_MANAGEMENT_ROLES,
  );

const PILATES_CLASS_PUBLIC_ACCESS_ROLE_SET =
  new Set<PilatesClassPublicAccessRole>(PILATES_CLASS_PUBLIC_ACCESS_ROLES);

const PILATES_CLASS_EVENT_SET = new Set<PilatesClassEvent>(
  PILATES_CLASS_EVENTS,
);

const PILATES_CLASS_SORT_FIELD_SET = new Set<PilatesClassSortField>(
  PILATES_CLASS_SORT_FIELDS,
);

const PILATES_CLASS_SCHEDULE_SORT_FIELD_SET =
  new Set<PilatesClassScheduleSortField>(PILATES_CLASS_SCHEDULE_SORT_FIELDS);

const PILATES_CLASS_SORT_DIRECTION_SET = new Set<PilatesClassSortDirection>(
  PILATES_CLASS_SORT_DIRECTIONS,
);
const PILATES_CLASS_IMAGE_MIME_TYPE_SET = new Set<PilatesClassImageMimeType>(
  PILATES_CLASS_IMAGE_ALLOWED_MIME_TYPES,
);
export function isPilatesClassStatus(
  value: string,
): value is PilatesClassStatus {
  return PILATES_CLASS_STATUS_SET.has(value as PilatesClassStatus);
}

export function isPilatesClassCreateAllowedStatus(
  value: string,
): value is PilatesClassCreateAllowedStatus {
  return PILATES_CLASS_CREATE_ALLOWED_STATUS_SET.has(
    value as PilatesClassCreateAllowedStatus,
  );
}

export function isPilatesClassUpdateAllowedStatus(
  value: string,
): value is PilatesClassUpdateAllowedStatus {
  return PILATES_CLASS_UPDATE_ALLOWED_STATUS_SET.has(
    value as PilatesClassUpdateAllowedStatus,
  );
}

export function isPilatesClassPublicVisibleStatus(
  value: string,
): value is PilatesClassPublicVisibleStatus {
  return PILATES_CLASS_PUBLIC_VISIBLE_STATUS_SET.has(
    value as PilatesClassPublicVisibleStatus,
  );
}

export function isPilatesClassScheduleStatus(
  value: string,
): value is PilatesClassScheduleStatus {
  return PILATES_CLASS_SCHEDULE_STATUS_SET.has(
    value as PilatesClassScheduleStatus,
  );
}

export function isPilatesClassScheduleCreateAllowedStatus(
  value: string,
): value is PilatesClassScheduleCreateAllowedStatus {
  return PILATES_CLASS_SCHEDULE_CREATE_ALLOWED_STATUS_SET.has(
    value as PilatesClassScheduleCreateAllowedStatus,
  );
}

export function isPilatesClassScheduleUpdateAllowedStatus(
  value: string,
): value is PilatesClassScheduleUpdateAllowedStatus {
  return PILATES_CLASS_SCHEDULE_UPDATE_ALLOWED_STATUS_SET.has(
    value as PilatesClassScheduleUpdateAllowedStatus,
  );
}

export function isPilatesClassSchedulePublicVisibleStatus(
  value: string,
): value is PilatesClassSchedulePublicVisibleStatus {
  return PILATES_CLASS_SCHEDULE_PUBLIC_VISIBLE_STATUS_SET.has(
    value as PilatesClassSchedulePublicVisibleStatus,
  );
}

export function isPilatesClassScheduleTerminalStatus(
  value: string,
): value is PilatesClassScheduleTerminalStatus {
  return PILATES_CLASS_SCHEDULE_TERMINAL_STATUS_SET.has(
    value as PilatesClassScheduleTerminalStatus,
  );
}

export function isPilatesClassLevel(value: string): value is PilatesClassLevel {
  return PILATES_CLASS_LEVEL_SET.has(value as PilatesClassLevel);
}

export function isPilatesClassAdminManagementRole(
  value: AuthUserRole,
): value is PilatesClassAdminManagementRole {
  return PILATES_CLASS_ADMIN_MANAGEMENT_ROLE_SET.has(
    value as PilatesClassAdminManagementRole,
  );
}

export function isPilatesClassPublicAccessRole(
  value: AuthUserRole,
): value is PilatesClassPublicAccessRole {
  return PILATES_CLASS_PUBLIC_ACCESS_ROLE_SET.has(
    value as PilatesClassPublicAccessRole,
  );
}

export function isPilatesClassEvent(value: string): value is PilatesClassEvent {
  return PILATES_CLASS_EVENT_SET.has(value as PilatesClassEvent);
}

export function isPilatesClassSortField(
  value: string,
): value is PilatesClassSortField {
  return PILATES_CLASS_SORT_FIELD_SET.has(value as PilatesClassSortField);
}

export function isPilatesClassScheduleSortField(
  value: string,
): value is PilatesClassScheduleSortField {
  return PILATES_CLASS_SCHEDULE_SORT_FIELD_SET.has(
    value as PilatesClassScheduleSortField,
  );
}

export function isPilatesClassSortDirection(
  value: string,
): value is PilatesClassSortDirection {
  return PILATES_CLASS_SORT_DIRECTION_SET.has(
    value as PilatesClassSortDirection,
  );
}
export function isPilatesClassImageMimeType(
  value: string,
): value is PilatesClassImageMimeType {
  return PILATES_CLASS_IMAGE_MIME_TYPE_SET.has(
    value as PilatesClassImageMimeType,
  );
}

export function resolvePilatesClassImageExtension(
  mimeType: PilatesClassImageMimeType,
): string {
  return PILATES_CLASS_IMAGE_EXTENSION_BY_MIME_TYPE[mimeType];
}
