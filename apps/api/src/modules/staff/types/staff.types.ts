// apps/api/src/modules/staff/types/staff.types.ts
/**
 * LAFAM Staff module types.
 *
 * Role:
 * - Defines Staff Module service, repository, and response contracts.
 * - Keeps staff business data separate from Auth identity data.
 * - Provides stable types for controllers, services, repositories, and Swagger mapping.
 *
 * Important:
 * - This file contains types only.
 * - Do not place validation decorators here.
 * - Do not place database queries here.
 * - Do not place business logic here.
 * - Passwords must never appear in response types.
 */

import type {
  AppUserRow,
  DatabaseAppUserStatus,
  StaffAvailabilityRuleInsert,
  StaffAvailabilityRuleRow,
  StaffAvailabilityRuleUpdate,
  StaffProfileInsert,
  StaffProfileRow,
  StaffProfileUpdate,
} from '../../../database/database.types';
import type {
  StaffDayOfWeek,
  StaffPortalRole,
  StaffProfileCreateAllowedStatus,
  StaffProfileStatus,
  StaffProfileUpdateAllowedStatus,
} from '../constants/staff.constants';

export type StaffAuthStatus = DatabaseAppUserStatus;

export interface StaffAvailabilityRuleInput {
  readonly day_of_week: StaffDayOfWeek;
  readonly start_time: string;
  readonly end_time: string;
  readonly is_available?: boolean;
}

export interface StaffAvailabilityRuleReplacementInput {
  readonly availability: readonly StaffAvailabilityRuleInput[];
}

export interface StaffCreateInput {
  readonly display_name: string;
  readonly email: string;
  readonly phone?: string | null;
  readonly password: string;
  readonly confirm_password: string;
  readonly address?: string | null;
  readonly portal_role: StaffPortalRole;
  readonly post_title: string;
  readonly working_days: readonly StaffDayOfWeek[];
  readonly start_time: string;
  readonly end_time: string;
  readonly specialties?: readonly string[];
  readonly bio?: string | null;
  readonly status?: StaffProfileCreateAllowedStatus;
}

export interface StaffUpdateInput {
  readonly display_name?: string;
  readonly phone?: string | null;
  readonly address?: string | null;
  readonly post_title?: string;
  readonly specialties?: readonly string[];
  readonly bio?: string | null;
  readonly status?: StaffProfileUpdateAllowedStatus;
}

export interface StaffListQuery {
  readonly search?: string;
  readonly portal_role?: StaffPortalRole;
  readonly staff_status?: StaffProfileStatus;
  readonly auth_status?: StaffAuthStatus;
  readonly include_deleted?: boolean;
  readonly limit: number;
  readonly offset: number;
}

export interface StaffParam {
  readonly staff_id: string;
}

export interface StaffCreateRepositoryInput {
  readonly app_user: {
    readonly auth_user_id: string;
    readonly email: string;
    readonly phone: string | null;
    readonly full_name: string;
    readonly role: StaffPortalRole;
    readonly status: 'active';
    readonly is_guest: false;
    readonly metadata: {
      readonly source: string;
      readonly created_by_admin_id: string;
      readonly portal_role: StaffPortalRole;
    };
  };
  readonly staff_profile: {
    readonly display_name: string;
    readonly address: string | null;
    readonly post_title: string;
    readonly bio: string | null;
    readonly specialties: readonly string[];
    readonly status: StaffProfileCreateAllowedStatus;
    readonly created_by_admin_id: string;
    readonly updated_by_admin_id: string;
  };
  readonly availability: readonly StaffAvailabilityRuleInput[];
}

export interface StaffUpdateRepositoryInput {
  readonly staff_profile_id: string;
  readonly updated_by_admin_id: string;
  readonly profile_update: StaffProfileUpdate;
  readonly app_user_update?: {
    readonly phone?: string | null;
    readonly full_name?: string | null;
  };
}

export interface StaffAvailabilityReplacementRepositoryInput {
  readonly staff_profile_id: string;
  readonly availability: readonly StaffAvailabilityRuleInput[];
}

export interface StaffDeactivateRepositoryInput {
  readonly staff_profile_id: string;
  readonly updated_by_admin_id: string;
  readonly deactivated_at: string;
}

export interface StaffReactivateRepositoryInput {
  readonly staff_profile_id: string;
  readonly updated_by_admin_id: string;
}

export interface StaffSoftDeleteRepositoryInput {
  readonly staff_profile_id: string;
  readonly updated_by_admin_id: string;
  readonly deleted_at: string;
}

export interface StaffAuthUserCreateInput {
  readonly email: string;
  readonly password: string;
  readonly display_name: string;
  readonly phone: string | null;
  readonly portal_role: StaffPortalRole;
  readonly created_by_admin_id: string;
}

export interface StaffAuthUserCreateResult {
  readonly auth_user_id: string;
  readonly email: string;
  readonly email_verification_required: false;
}

export interface StaffProfileWithUser {
  readonly profile: StaffProfileRow;
  readonly app_user: AppUserRow;
  readonly availability: readonly StaffAvailabilityRuleRow[];
}

export interface StaffCreateDatabasePayload {
  readonly app_user_id: string;
  readonly staff_profile: StaffProfileInsert;
  readonly availability: readonly StaffAvailabilityRuleInsert[];
}

export interface StaffUpdateDatabasePayload {
  readonly staff_profile: StaffProfileUpdate;
  readonly availability?: readonly StaffAvailabilityRuleUpdate[];
}

export interface SafeStaffAvailabilityRule {
  readonly id: string;
  readonly day_of_week: StaffDayOfWeek;
  readonly start_time: string;
  readonly end_time: string;
  readonly is_available: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface SafeStaffProfile {
  readonly id: string;
  readonly app_user_id: string;
  readonly auth_user_id: string;
  readonly email: string;
  readonly phone: string | null;
  readonly display_name: string;
  readonly portal_role: StaffPortalRole;
  readonly post_title: string;
  readonly address: string | null;
  readonly bio: string | null;
  readonly specialties: readonly string[];
  readonly staff_status: StaffProfileStatus;
  readonly auth_status: StaffAuthStatus;
  readonly email_verification_required: boolean;
  readonly availability: readonly SafeStaffAvailabilityRule[];
  readonly created_at: string;
  readonly updated_at: string;
  readonly deactivated_at: string | null;
  readonly deleted_at: string | null;
}

export interface StaffListResult {
  readonly staff: readonly SafeStaffProfile[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export interface StaffMutationResult {
  readonly staff: SafeStaffProfile;
}

export interface StaffDeleteResult {
  readonly deleted: true;
  readonly staff_id: string;
}

export interface StaffAuthCleanupInput {
  readonly auth_user_id: string;
  readonly reason: string;
}

export interface StaffCreationRollbackState {
  readonly auth_user_id: string | null;
  readonly app_user_id: string | null;
  readonly staff_profile_id: string | null;
}
