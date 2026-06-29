// apps/api/src/modules/customers/constants/customer.constants.ts
/**
 * LAFAM Customer Module constants.
 *
 * Role:
 * - Defines Customer Module route prefixes, validation limits, customer auth-status filters,
 *   admin/staff/trainer management roles, pagination defaults, metadata keys, and safe lookup fields.
 * - Keeps customer DTOs, repositories, services, controllers, and Swagger aligned.
 *
 * Important:
 * - This file contains constants only.
 * - Do not place database queries here.
 * - Do not place service logic here.
 * - Do not place secrets or environment-derived values here.
 * - Customer email, phone, role, status, and login identity live in app_users/Supabase Auth.
 * - Customer Civil ID lives only in customer_profiles and must not be logged.
 */

import {
  AUTH_FIELD_LIMITS,
  AUTH_USER_STATUS_ACTIVE,
  AUTH_USER_STATUS_DEACTIVATED,
  AUTH_USER_STATUS_DELETED,
  AUTH_USER_STATUS_INVITED,
  AUTH_USER_STATUS_PENDING_EMAIL_VERIFICATION,
  type AuthUserStatus,
} from '../../auth/constants/auth.constants';
import {
  AUTH_ADMIN_ROLE,
  AUTH_CUSTOMER_ROLE,
  AUTH_STAFF_ROLE,
  AUTH_SUPER_ADMIN_ROLE,
  AUTH_TRAINER_ROLE,
  type AuthUserRole,
} from '../../auth/constants/auth-role.constants';
import type { DatabaseCustomerInvitationStatus } from '../../../database/database.types';

export const CUSTOMER_MODULE_NAME = 'customers' as const;

export const CUSTOMER_INVITATION_ROUTE_SEGMENT = 'invitations' as const;
export const CUSTOMER_INVITATION_ACCEPT_ROUTE_SEGMENT = 'accept' as const;
export const CUSTOMER_INVITATION_RESEND_ROUTE_SEGMENT = 'resend' as const;
export const CUSTOMER_INVITATION_REVOKE_ROUTE_SEGMENT = 'revoke' as const;

export const CUSTOMER_INVITATION_PUBLIC_ROUTE_PREFIX =
  'customers/invitations' as const;

export const CUSTOMER_INVITATION_ID_PARAM = 'invitationId' as const;

export type CustomerAppRole = Extract<AuthUserRole, 'customer'>;

export const CUSTOMER_APP_ROLE = AUTH_CUSTOMER_ROLE satisfies CustomerAppRole;

export type CustomerAdminManagementRole = Extract<
  AuthUserRole,
  'admin' | 'super_admin' | 'staff' | 'trainer'
>;

export const CUSTOMER_ADMIN_MANAGEMENT_ROLES = [
  AUTH_ADMIN_ROLE,
  AUTH_SUPER_ADMIN_ROLE,
  AUTH_STAFF_ROLE,
  AUTH_TRAINER_ROLE,
] as const satisfies readonly CustomerAdminManagementRole[];

export const CUSTOMER_AUTH_STATUSES = [
  AUTH_USER_STATUS_PENDING_EMAIL_VERIFICATION,
  AUTH_USER_STATUS_INVITED,
  AUTH_USER_STATUS_ACTIVE,
  AUTH_USER_STATUS_DEACTIVATED,
  AUTH_USER_STATUS_DELETED,
] as const;

export type CustomerAuthStatus = Extract<
  AuthUserStatus,
  (typeof CUSTOMER_AUTH_STATUSES)[number]
>;

export const CUSTOMER_AUTH_STATUS_PENDING_EMAIL_VERIFICATION =
  AUTH_USER_STATUS_PENDING_EMAIL_VERIFICATION satisfies CustomerAuthStatus;
export const CUSTOMER_AUTH_STATUS_INVITED =
  AUTH_USER_STATUS_INVITED satisfies CustomerAuthStatus;
export const CUSTOMER_AUTH_STATUS_ACTIVE =
  AUTH_USER_STATUS_ACTIVE satisfies CustomerAuthStatus;
export const CUSTOMER_AUTH_STATUS_DEACTIVATED =
  AUTH_USER_STATUS_DEACTIVATED satisfies CustomerAuthStatus;
export const CUSTOMER_AUTH_STATUS_DELETED =
  AUTH_USER_STATUS_DELETED satisfies CustomerAuthStatus;

export const CUSTOMER_LIST_FILTERABLE_AUTH_STATUSES = [
  CUSTOMER_AUTH_STATUS_PENDING_EMAIL_VERIFICATION,
  CUSTOMER_AUTH_STATUS_INVITED,
  CUSTOMER_AUTH_STATUS_ACTIVE,
  CUSTOMER_AUTH_STATUS_DEACTIVATED,
  CUSTOMER_AUTH_STATUS_DELETED,
] as const satisfies readonly CustomerAuthStatus[];

export const CUSTOMER_CREATE_AUTH_STATUS =
  CUSTOMER_AUTH_STATUS_ACTIVE satisfies CustomerAuthStatus;

export const CUSTOMER_INVITE_AUTH_STATUS =
  CUSTOMER_AUTH_STATUS_INVITED satisfies CustomerAuthStatus;

export const CUSTOMER_SIGN_UP_AUTH_STATUS =
  CUSTOMER_AUTH_STATUS_PENDING_EMAIL_VERIFICATION satisfies CustomerAuthStatus;

export const CUSTOMER_CONVERSION_AUTH_STATUS =
  CUSTOMER_AUTH_STATUS_PENDING_EMAIL_VERIFICATION satisfies CustomerAuthStatus;

export const CUSTOMER_INVITATION_STATUS_PENDING =
  'pending' satisfies DatabaseCustomerInvitationStatus;
export const CUSTOMER_INVITATION_STATUS_ACCEPTED =
  'accepted' satisfies DatabaseCustomerInvitationStatus;
export const CUSTOMER_INVITATION_STATUS_EXPIRED =
  'expired' satisfies DatabaseCustomerInvitationStatus;
export const CUSTOMER_INVITATION_STATUS_REVOKED =
  'revoked' satisfies DatabaseCustomerInvitationStatus;

export const CUSTOMER_INVITATION_STATUSES = [
  CUSTOMER_INVITATION_STATUS_PENDING,
  CUSTOMER_INVITATION_STATUS_ACCEPTED,
  CUSTOMER_INVITATION_STATUS_EXPIRED,
  CUSTOMER_INVITATION_STATUS_REVOKED,
] as const satisfies readonly DatabaseCustomerInvitationStatus[];

export type CustomerInvitationStatus =
  (typeof CUSTOMER_INVITATION_STATUSES)[number];

export const CUSTOMER_FULL_NAME_MIN_LENGTH = 1;
export const CUSTOMER_FULL_NAME_MAX_LENGTH =
  AUTH_FIELD_LIMITS.fullNameMaxLength;

export const CUSTOMER_EMAIL_MAX_LENGTH = AUTH_FIELD_LIMITS.emailMaxLength;

export const CUSTOMER_PHONE_MAX_LENGTH = AUTH_FIELD_LIMITS.phoneMaxLength;

export const CUSTOMER_CIVIL_ID_MAX_LENGTH = AUTH_FIELD_LIMITS.civilIdMaxLength;
export const CUSTOMER_CIVIL_ID_NORMALIZED_LENGTH =
  AUTH_FIELD_LIMITS.civilIdNormalizedLength;

export const CUSTOMER_PASSWORD_MIN_LENGTH = AUTH_FIELD_LIMITS.passwordMinLength;
export const CUSTOMER_PASSWORD_MAX_LENGTH = AUTH_FIELD_LIMITS.passwordMaxLength;

export const CUSTOMER_INVITE_TOKEN_BYTE_LENGTH = 32;
export const CUSTOMER_INVITE_TOKEN_MIN_LENGTH = 32;
export const CUSTOMER_INVITE_TOKEN_MAX_LENGTH = 256;
export const CUSTOMER_INVITE_TOKEN_HASH_LENGTH = 64;

export const CUSTOMER_INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/u;
export const CUSTOMER_INVITE_TOKEN_HASH_PATTERN = /^[a-f0-9]{64}$/u;

export const CUSTOMER_TIMEZONE_MAX_LENGTH = AUTH_FIELD_LIMITS.timezoneMaxLength;

export const CUSTOMER_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
export const CUSTOMER_PHONE_PATTERN = /^\+?[1-9]\d{6,15}$/u;
export const CUSTOMER_CIVIL_ID_PATTERN = /^[0-9 -]+$/u;
export const CUSTOMER_CIVIL_ID_NORMALIZED_PATTERN = /^\d{12}$/u;
export const CUSTOMER_TIMEZONE_PATTERN =
  /^[A-Za-z]+(?:[/_-][A-Za-z0-9+_-]+)+$/u;

export const CUSTOMER_LIST_DEFAULT_LIMIT = 50;
export const CUSTOMER_LIST_MAX_LIMIT = 100;
export const CUSTOMER_LIST_DEFAULT_OFFSET = 0;

export const CUSTOMER_LOOKUP_FIELDS = ['phone', 'civil_id'] as const;

export type CustomerLookupField = (typeof CUSTOMER_LOOKUP_FIELDS)[number];

export const CUSTOMER_LOOKUP_FIELD_PHONE =
  'phone' satisfies CustomerLookupField;
export const CUSTOMER_LOOKUP_FIELD_CIVIL_ID =
  'civil_id' satisfies CustomerLookupField;

export const CUSTOMER_AUTH_METADATA_SOURCE_KEY = 'source' as const;
export const CUSTOMER_AUTH_METADATA_CREATED_BY_ADMIN_ID_KEY =
  'created_by_admin_id' as const;

export const CUSTOMER_AUTH_METADATA_SOURCE_ADMIN_CUSTOMER_CREATE =
  'lafam_admin_customer_create' as const;

export const CUSTOMER_AUTH_METADATA_SOURCE_ADMIN_CUSTOMER_INVITE =
  'lafam_admin_customer_invite' as const;

export const CUSTOMER_AUDIT_METADATA_CUSTOMER_PROFILE_ID_KEY =
  'customer_profile_id' as const;

export const CUSTOMER_AUDIT_METADATA_CUSTOMER_INVITATION_ID_KEY =
  'customer_invitation_id' as const;

export const CUSTOMER_AUDIT_METADATA_APP_USER_ID_KEY = 'app_user_id' as const;
export const CUSTOMER_AUDIT_METADATA_CREATED_BY_ADMIN_ID_KEY =
  'created_by_admin_id' as const;
export const CUSTOMER_AUDIT_METADATA_UPDATED_BY_ADMIN_ID_KEY =
  'updated_by_admin_id' as const;

const CUSTOMER_ADMIN_MANAGEMENT_ROLE_SET = new Set<CustomerAdminManagementRole>(
  CUSTOMER_ADMIN_MANAGEMENT_ROLES,
);

const CUSTOMER_INVITATION_STATUS_SET = new Set<CustomerInvitationStatus>(
  CUSTOMER_INVITATION_STATUSES,
);

const CUSTOMER_LOOKUP_FIELD_SET = new Set<CustomerLookupField>(
  CUSTOMER_LOOKUP_FIELDS,
);

export function isCustomerAdminManagementRole(
  value: AuthUserRole,
): value is CustomerAdminManagementRole {
  return CUSTOMER_ADMIN_MANAGEMENT_ROLE_SET.has(
    value as CustomerAdminManagementRole,
  );
}

export function isCustomerInvitationStatus(
  value: string,
): value is CustomerInvitationStatus {
  return CUSTOMER_INVITATION_STATUS_SET.has(value as CustomerInvitationStatus);
}

export function isCustomerLookupField(
  value: string,
): value is CustomerLookupField {
  return CUSTOMER_LOOKUP_FIELD_SET.has(value as CustomerLookupField);
}
