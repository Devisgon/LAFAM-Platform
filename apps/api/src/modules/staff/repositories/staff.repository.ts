// apps/api/src/modules/staff/repositories/staff.repository.ts
/**
 * LAFAM Staff repository.
 *
 * Role:
 * - Owns Staff Module database access.
 * - Handles staff_profiles, staff_availability_rules, and related app_users rows.
 * - Keeps raw Supabase queries out of Staff services and controllers.
 *
 * Important:
 * - This repository does not create Supabase Auth users.
 * - This repository does not receive, store, log, or return passwords.
 * - Staff Auth user creation stays in SupabaseAuthRepository.
 * - Business validation stays in DTOs/services.
 * - Authorization stays in guards/services.
 * - Database/provider errors are converted into frontend-safe AppError instances.
 */

import { Inject, Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { SUPABASE_ADMIN_CLIENT } from '../../../database/database.constants';
import type {
  AppUserInsert,
  AppUserRow,
  AppUserUpdate,
  LAFAMSupabaseClient,
  StaffAvailabilityRuleInsert,
  StaffAvailabilityRuleRow,
  StaffProfileInsert,
  StaffProfileRow,
  StaffProfileUpdate,
} from '../../../database/database.types';
import { AUTH_TRAINER_ROLE } from '../../auth/constants/auth-role.constants';
import {
  STAFF_DEFAULT_AVAILABILITY_IS_AVAILABLE,
  STAFF_LIST_DEFAULT_LIMIT,
  STAFF_LIST_DEFAULT_OFFSET,
  STAFF_LIST_MAX_LIMIT,
  STAFF_PORTAL_ROLES,
  STAFF_PROFILE_STATUS_AVAILABLE,
  STAFF_PROFILE_STATUS_DEACTIVATED,
  STAFF_PROFILE_STATUS_DELETED,
} from '../constants/staff.constants';
import type {
  StaffAvailabilityReplacementRepositoryInput,
  StaffAvailabilityRuleInput,
  StaffCreateRepositoryInput,
  StaffDeactivateRepositoryInput,
  StaffListQuery,
  StaffProfileWithUser,
  StaffReactivateRepositoryInput,
  StaffSoftDeleteRepositoryInput,
  StaffUpdateRepositoryInput,
} from '../types/staff.types';

const POSTGRES_UNIQUE_VIOLATION_CODE = '23505';
const POSTGRES_FOREIGN_KEY_VIOLATION_CODE = '23503';
const POSTGRES_CHECK_VIOLATION_CODE = '23514';
const POSTGRES_NOT_NULL_VIOLATION_CODE = '23502';

interface DatabaseErrorShape {
  readonly code?: string;
  readonly message?: string;
  readonly details?: string | null;
  readonly hint?: string | null;
}

export interface FindStaffByIdInput {
  readonly staffProfileId: string;
  readonly includeDeleted?: boolean;
}

export interface FindStaffByAppUserIdInput {
  readonly appUserId: string;
  readonly includeDeleted?: boolean;
}

export interface FindStaffByAuthUserIdInput {
  readonly authUserId: string;
  readonly includeDeleted?: boolean;
}

export interface FindStaffByEmailInput {
  readonly email: string;
  readonly includeDeleted?: boolean;
}

export interface FindActiveStaffProfileByAppUserIdInput {
  readonly appUserId: string;
}

export interface FindActiveTrainerStaffProfileByAppUserIdInput {
  readonly appUserId: string;
}

export interface StaffEmailExistsInput {
  readonly email: string;
}

export interface DeleteAppUserByAuthUserIdForRollbackInput {
  readonly authUserId: string;
}

export interface StaffRepositoryListResult {
  readonly staff: readonly StaffProfileWithUser[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

function isDatabaseError(value: unknown): value is DatabaseErrorShape {
  return typeof value === 'object' && value !== null;
}

function mapDatabaseError(error: unknown): AppError {
  if (!isDatabaseError(error)) {
    return AppError.databaseOperationFailed(error);
  }

  if (error.code === POSTGRES_UNIQUE_VIOLATION_CODE) {
    return AppError.conflict(
      'The staff record conflicts with an existing record.',
    );
  }

  if (error.code === POSTGRES_FOREIGN_KEY_VIOLATION_CODE) {
    return AppError.staffNotFound(
      'The related staff or user record was not found.',
    );
  }

  if (
    error.code === POSTGRES_CHECK_VIOLATION_CODE ||
    error.code === POSTGRES_NOT_NULL_VIOLATION_CODE
  ) {
    return AppError.invalidRequest('The staff database payload is invalid.');
  }

  return AppError.databaseOperationFailed(error);
}

function mapAppUserInsertError(error: unknown): AppError {
  if (isDatabaseError(error) && error.code === POSTGRES_UNIQUE_VIOLATION_CODE) {
    return AppError.staffEmailAlreadyExists();
  }

  return mapDatabaseError(error);
}

function mapAvailabilityDatabaseError(error: unknown): AppError {
  if (
    isDatabaseError(error) &&
    (error.code === POSTGRES_CHECK_VIOLATION_CODE ||
      error.code === POSTGRES_NOT_NULL_VIOLATION_CODE)
  ) {
    return AppError.staffAvailabilityInvalid();
  }

  return mapDatabaseError(error);
}

function assertAppUserRow(
  row: AppUserRow | null,
  details?: Record<string, unknown>,
): AppUserRow {
  if (!row) {
    throw AppError.userNotFound(
      'The related staff user was not found.',
      details,
    );
  }

  return row;
}

function assertStaffProfileRow(
  row: StaffProfileRow | null,
  details?: Record<string, unknown>,
): StaffProfileRow {
  if (!row) {
    throw AppError.staffNotFound(
      'The requested staff member was not found.',
      details,
    );
  }

  return row;
}

function normalizeListLimit(value: number): number {
  if (!Number.isFinite(value)) {
    return STAFF_LIST_DEFAULT_LIMIT;
  }

  if (value < 1) {
    return STAFF_LIST_DEFAULT_LIMIT;
  }

  return Math.min(Math.floor(value), STAFF_LIST_MAX_LIMIT);
}

function normalizeListOffset(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return STAFF_LIST_DEFAULT_OFFSET;
  }

  return Math.floor(value);
}

function sanitizePostgrestSearchTerm(value: string): string {
  return value.replace(/[%,()]/gu, '').trim();
}

function hasObjectKeys(value: Record<string, unknown>): boolean {
  return Object.keys(value).length > 0;
}

function isActiveAppUser(appUser: AppUserRow): boolean {
  return (
    appUser.status === 'active' &&
    appUser.deactivated_at === null &&
    appUser.deleted_at === null
  );
}

function toAvailabilityInsert(
  staffProfileId: string,
  rule: StaffAvailabilityRuleInput,
): StaffAvailabilityRuleInsert {
  return {
    staff_profile_id: staffProfileId,
    day_of_week: rule.day_of_week,
    start_time: rule.start_time,
    end_time: rule.end_time,
    is_available: rule.is_available ?? STAFF_DEFAULT_AVAILABILITY_IS_AVAILABLE,
  };
}

@Injectable()
export class StaffRepository {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly adminClient: LAFAMSupabaseClient,
  ) {}

  private async hydrateStaffProfiles(
    profiles: readonly StaffProfileRow[],
  ): Promise<readonly StaffProfileWithUser[]> {
    if (profiles.length === 0) {
      return [];
    }

    const appUserIds = [
      ...new Set(profiles.map((profile) => profile.app_user_id)),
    ];
    const staffProfileIds = profiles.map((profile) => profile.id);

    const { data: appUsers, error: appUsersError } = await this.adminClient
      .from('app_users')
      .select('*')
      .in('id', appUserIds);

    if (appUsersError) {
      throw mapDatabaseError(appUsersError);
    }

    const { data: availabilityRules, error: availabilityError } =
      await this.adminClient
        .from('staff_availability_rules')
        .select('*')
        .in('staff_profile_id', staffProfileIds)
        .order('day_of_week', { ascending: true });

    if (availabilityError) {
      throw mapDatabaseError(availabilityError);
    }

    const appUserById = new Map<string, AppUserRow>(
      (appUsers ?? []).map((appUser) => [appUser.id, appUser]),
    );

    const availabilityByStaffProfileId = new Map<
      string,
      StaffAvailabilityRuleRow[]
    >();

    for (const availabilityRule of availabilityRules ?? []) {
      const existingRules =
        availabilityByStaffProfileId.get(availabilityRule.staff_profile_id) ??
        [];

      existingRules.push(availabilityRule);
      availabilityByStaffProfileId.set(
        availabilityRule.staff_profile_id,
        existingRules,
      );
    }

    return profiles.map((profile) => {
      const appUser = appUserById.get(profile.app_user_id);

      if (!appUser) {
        throw AppError.userNotFound('The related staff user was not found.', {
          app_user_id: profile.app_user_id,
          staff_profile_id: profile.id,
        });
      }

      return {
        profile,
        app_user: appUser,
        availability: availabilityByStaffProfileId.get(profile.id) ?? [],
      };
    });
  }

  private async hydrateStaffProfile(
    profile: StaffProfileRow,
  ): Promise<StaffProfileWithUser> {
    const hydratedProfiles = await this.hydrateStaffProfiles([profile]);
    const hydratedProfile = hydratedProfiles[0];

    if (!hydratedProfile) {
      throw AppError.staffNotFound(
        'The requested staff member was not found.',
        {
          staff_profile_id: profile.id,
        },
      );
    }

    return hydratedProfile;
  }

  private applyActiveStaffProfileFilter<
    TQuery extends {
      is(column: string, value: null): TQuery;
      neq(column: string, value: string): TQuery;
    },
  >(query: TQuery, includeDeleted: boolean | undefined): TQuery {
    if (includeDeleted === true) {
      return query;
    }

    return query
      .is('deleted_at', null)
      .neq('status', STAFF_PROFILE_STATUS_DELETED);
  }

  private async deleteStaffProfileByIdForRollback(
    staffProfileId: string,
  ): Promise<void> {
    const { error } = await this.adminClient
      .from('staff_profiles')
      .delete()
      .eq('id', staffProfileId);

    if (error) {
      throw mapDatabaseError(error);
    }
  }

  private async deleteAppUserByIdForRollback(appUserId: string): Promise<void> {
    const { error } = await this.adminClient
      .from('app_users')
      .delete()
      .eq('id', appUserId);

    if (error) {
      throw mapDatabaseError(error);
    }
  }

  private async cleanupCreatedStaffRows(
    appUserId: string,
    staffProfileId?: string,
  ): Promise<void> {
    try {
      if (staffProfileId) {
        await this.deleteStaffProfileByIdForRollback(staffProfileId);
      }

      await this.deleteAppUserByIdForRollback(appUserId);
    } catch (cleanupError: unknown) {
      void cleanupError;
    }
  }

  private async findMatchingAppUserIdsForList(
    input: StaffListQuery,
  ): Promise<readonly string[] | null> {
    const searchTerm = input.search
      ? sanitizePostgrestSearchTerm(input.search)
      : null;

    const hasAppUserFilter = Boolean(
      input.portal_role || input.auth_status || searchTerm,
    );

    if (!hasAppUserFilter) {
      return null;
    }

    let query = this.adminClient
      .from('app_users')
      .select('id')
      .in(
        'role',
        input.portal_role ? [input.portal_role] : [...STAFF_PORTAL_ROLES],
      );

    if (input.auth_status) {
      query = query.eq('status', input.auth_status);
    } else if (input.include_deleted !== true) {
      query = query.neq('status', STAFF_PROFILE_STATUS_DELETED);
    }

    if (searchTerm) {
      query = query.or(
        `email.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`,
      );
    }

    const { data, error } = await query;

    if (error) {
      throw mapDatabaseError(error);
    }

    return (data ?? []).map((row) => row.id);
  }

  async emailExists(input: StaffEmailExistsInput): Promise<boolean> {
    const { data, error } = await this.adminClient
      .from('app_users')
      .select('id')
      .eq('email', input.email)
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data !== null;
  }

  async findById(
    input: FindStaffByIdInput,
  ): Promise<StaffProfileWithUser | null> {
    let query = this.adminClient
      .from('staff_profiles')
      .select('*')
      .eq('id', input.staffProfileId);

    query = this.applyActiveStaffProfileFilter(query, input.includeDeleted);

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data ? this.hydrateStaffProfile(data) : null;
  }

  async getById(input: FindStaffByIdInput): Promise<StaffProfileWithUser> {
    const staff = await this.findById(input);

    if (!staff) {
      throw AppError.staffNotFound(
        'The requested staff member was not found.',
        {
          staff_profile_id: input.staffProfileId,
        },
      );
    }

    return staff;
  }

  async findByAppUserId(
    input: FindStaffByAppUserIdInput,
  ): Promise<StaffProfileWithUser | null> {
    let query = this.adminClient
      .from('staff_profiles')
      .select('*')
      .eq('app_user_id', input.appUserId);

    query = this.applyActiveStaffProfileFilter(query, input.includeDeleted);

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data ? this.hydrateStaffProfile(data) : null;
  }

  async findActiveStaffProfileByAppUserId(
    input: FindActiveStaffProfileByAppUserIdInput,
  ): Promise<StaffProfileWithUser | null> {
    const { data, error } = await this.adminClient
      .from('staff_profiles')
      .select('*')
      .eq('app_user_id', input.appUserId)
      .eq('status', STAFF_PROFILE_STATUS_AVAILABLE)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    if (!data) {
      return null;
    }

    const staff = await this.hydrateStaffProfile(data);

    if (!isActiveAppUser(staff.app_user)) {
      return null;
    }

    return staff;
  }

  async getActiveStaffProfileByAppUserId(
    input: FindActiveStaffProfileByAppUserIdInput,
  ): Promise<StaffProfileWithUser> {
    const staff = await this.findActiveStaffProfileByAppUserId(input);

    if (!staff) {
      throw AppError.staffNotFound(
        'The active staff profile for this user was not found.',
        {
          app_user_id: input.appUserId,
        },
      );
    }

    return staff;
  }

  async findActiveTrainerStaffProfileByAppUserId(
    input: FindActiveTrainerStaffProfileByAppUserIdInput,
  ): Promise<StaffProfileWithUser | null> {
    const staff = await this.findActiveStaffProfileByAppUserId({
      appUserId: input.appUserId,
    });

    if (!staff) {
      return null;
    }

    if (staff.app_user.role !== AUTH_TRAINER_ROLE) {
      return null;
    }

    return staff;
  }

  async getActiveTrainerStaffProfileByAppUserId(
    input: FindActiveTrainerStaffProfileByAppUserIdInput,
  ): Promise<StaffProfileWithUser> {
    const trainer = await this.findActiveTrainerStaffProfileByAppUserId(input);

    if (!trainer) {
      throw AppError.trainerStaffProfileNotFound(
        'The active trainer staff profile for this user was not found.',
        {
          app_user_id: input.appUserId,
        },
      );
    }

    return trainer;
  }

  async findByAuthUserId(
    input: FindStaffByAuthUserIdInput,
  ): Promise<StaffProfileWithUser | null> {
    const { data: appUser, error: appUserError } = await this.adminClient
      .from('app_users')
      .select('*')
      .eq('auth_user_id', input.authUserId)
      .maybeSingle();

    if (appUserError) {
      throw mapDatabaseError(appUserError);
    }

    if (!appUser) {
      return null;
    }

    return this.findByAppUserId({
      appUserId: appUser.id,
      includeDeleted: input.includeDeleted,
    });
  }

  async findByEmail(
    input: FindStaffByEmailInput,
  ): Promise<StaffProfileWithUser | null> {
    const { data: appUser, error: appUserError } = await this.adminClient
      .from('app_users')
      .select('*')
      .eq('email', input.email)
      .maybeSingle();

    if (appUserError) {
      throw mapDatabaseError(appUserError);
    }

    if (!appUser) {
      return null;
    }

    return this.findByAppUserId({
      appUserId: appUser.id,
      includeDeleted: input.includeDeleted,
    });
  }

  async listStaff(input: StaffListQuery): Promise<StaffRepositoryListResult> {
    const limit = normalizeListLimit(input.limit);
    const offset = normalizeListOffset(input.offset);

    const matchingAppUserIds = await this.findMatchingAppUserIdsForList(input);

    if (matchingAppUserIds !== null && matchingAppUserIds.length === 0) {
      return {
        staff: [],
        total: 0,
        limit,
        offset,
      };
    }

    let query = this.adminClient
      .from('staff_profiles')
      .select('*', { count: 'exact' });

    query = this.applyActiveStaffProfileFilter(query, input.include_deleted);

    if (input.staff_status) {
      query = query.eq('status', input.staff_status);
    }

    if (matchingAppUserIds !== null) {
      query = query.in('app_user_id', [...matchingAppUserIds]);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw mapDatabaseError(error);
    }

    const profiles = data ?? [];
    const staff = await this.hydrateStaffProfiles(profiles);

    return {
      staff,
      total: count ?? staff.length,
      limit,
      offset,
    };
  }

  async createStaff(
    input: StaffCreateRepositoryInput,
  ): Promise<StaffProfileWithUser> {
    const appUserInsertPayload: AppUserInsert = {
      auth_user_id: input.app_user.auth_user_id,
      email: input.app_user.email,
      phone: input.app_user.phone,
      full_name: input.app_user.full_name,
      role: input.app_user.role,
      status: input.app_user.status,
      is_guest: input.app_user.is_guest,
      metadata: {
        source: input.app_user.metadata.source,
        created_by_admin_id: input.app_user.metadata.created_by_admin_id,
        portal_role: input.app_user.metadata.portal_role,
      },
    };

    const { data: appUserData, error: appUserError } = await this.adminClient
      .from('app_users')
      .insert(appUserInsertPayload)
      .select('*')
      .single();

    if (appUserError) {
      throw mapAppUserInsertError(appUserError);
    }

    const appUser = assertAppUserRow(appUserData);

    const staffProfileInsertPayload: StaffProfileInsert = {
      app_user_id: appUser.id,
      display_name: input.staff_profile.display_name,
      address: input.staff_profile.address,
      post_title: input.staff_profile.post_title,
      bio: input.staff_profile.bio,
      specialties: [...input.staff_profile.specialties],
      status: input.staff_profile.status,
      created_by_admin_id: input.staff_profile.created_by_admin_id,
      updated_by_admin_id: input.staff_profile.updated_by_admin_id,
    };

    const { data: staffProfileData, error: staffProfileError } =
      await this.adminClient
        .from('staff_profiles')
        .insert(staffProfileInsertPayload)
        .select('*')
        .single();

    if (staffProfileError) {
      await this.cleanupCreatedStaffRows(appUser.id);
      throw AppError.staffProfileCreationFailed(staffProfileError);
    }

    const staffProfile = assertStaffProfileRow(staffProfileData);

    const availabilityInsertPayload = input.availability.map((rule) =>
      toAvailabilityInsert(staffProfile.id, rule),
    );

    const { data: availabilityData, error: availabilityError } =
      await this.adminClient
        .from('staff_availability_rules')
        .insert(availabilityInsertPayload)
        .select('*');

    if (availabilityError) {
      await this.cleanupCreatedStaffRows(appUser.id, staffProfile.id);
      throw mapAvailabilityDatabaseError(availabilityError);
    }

    return {
      profile: staffProfile,
      app_user: appUser,
      availability: availabilityData ?? [],
    };
  }

  async updateStaff(
    input: StaffUpdateRepositoryInput,
  ): Promise<StaffProfileWithUser> {
    const currentStaff = await this.getById({
      staffProfileId: input.staff_profile_id,
    });

    if (input.app_user_update) {
      const appUserUpdatePayload: AppUserUpdate = {};

      if (input.app_user_update.phone !== undefined) {
        appUserUpdatePayload.phone = input.app_user_update.phone;
      }

      if (input.app_user_update.full_name !== undefined) {
        appUserUpdatePayload.full_name = input.app_user_update.full_name;
      }

      if (hasObjectKeys(appUserUpdatePayload)) {
        const { error: appUserUpdateError } = await this.adminClient
          .from('app_users')
          .update(appUserUpdatePayload)
          .eq('id', currentStaff.app_user.id);

        if (appUserUpdateError) {
          throw mapDatabaseError(appUserUpdateError);
        }
      }
    }

    const staffProfileUpdatePayload: StaffProfileUpdate = {
      ...input.profile_update,
      updated_by_admin_id: input.updated_by_admin_id,
    };

    if (hasObjectKeys(staffProfileUpdatePayload)) {
      const { data, error } = await this.adminClient
        .from('staff_profiles')
        .update(staffProfileUpdatePayload)
        .eq('id', input.staff_profile_id)
        .is('deleted_at', null)
        .neq('status', STAFF_PROFILE_STATUS_DELETED)
        .select('*')
        .maybeSingle();

      if (error) {
        throw mapDatabaseError(error);
      }

      assertStaffProfileRow(data, {
        staff_profile_id: input.staff_profile_id,
      });
    }

    return this.getById({
      staffProfileId: input.staff_profile_id,
    });
  }

  async replaceAvailability(
    input: StaffAvailabilityReplacementRepositoryInput,
  ): Promise<StaffProfileWithUser> {
    await this.getById({
      staffProfileId: input.staff_profile_id,
    });

    const { error: deleteError } = await this.adminClient
      .from('staff_availability_rules')
      .delete()
      .eq('staff_profile_id', input.staff_profile_id);

    if (deleteError) {
      throw mapDatabaseError(deleteError);
    }

    const availabilityInsertPayload = input.availability.map((rule) =>
      toAvailabilityInsert(input.staff_profile_id, rule),
    );

    const { error: insertError } = await this.adminClient
      .from('staff_availability_rules')
      .insert(availabilityInsertPayload);

    if (insertError) {
      throw mapAvailabilityDatabaseError(insertError);
    }

    return this.getById({
      staffProfileId: input.staff_profile_id,
    });
  }

  async deactivateStaff(
    input: StaffDeactivateRepositoryInput,
  ): Promise<StaffProfileWithUser> {
    const currentStaff = await this.getById({
      staffProfileId: input.staff_profile_id,
      includeDeleted: true,
    });

    if (
      currentStaff.profile.deleted_at !== null ||
      currentStaff.profile.status === STAFF_PROFILE_STATUS_DELETED
    ) {
      throw AppError.staffAlreadyDeleted();
    }

    if (currentStaff.profile.status === STAFF_PROFILE_STATUS_DEACTIVATED) {
      throw AppError.staffAlreadyDeactivated();
    }

    const staffProfileUpdatePayload: StaffProfileUpdate = {
      status: STAFF_PROFILE_STATUS_DEACTIVATED,
      deactivated_at: input.deactivated_at,
      updated_by_admin_id: input.updated_by_admin_id,
    };

    const appUserUpdatePayload: AppUserUpdate = {
      status: STAFF_PROFILE_STATUS_DEACTIVATED,
      deactivated_at: input.deactivated_at,
    };

    const { error: appUserUpdateError } = await this.adminClient
      .from('app_users')
      .update(appUserUpdatePayload)
      .eq('id', currentStaff.app_user.id);

    if (appUserUpdateError) {
      throw mapDatabaseError(appUserUpdateError);
    }

    const { data, error } = await this.adminClient
      .from('staff_profiles')
      .update(staffProfileUpdatePayload)
      .eq('id', input.staff_profile_id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    assertStaffProfileRow(data, {
      staff_profile_id: input.staff_profile_id,
    });

    return this.getById({
      staffProfileId: input.staff_profile_id,
      includeDeleted: true,
    });
  }

  async reactivateStaff(
    input: StaffReactivateRepositoryInput,
  ): Promise<StaffProfileWithUser> {
    const currentStaff = await this.getById({
      staffProfileId: input.staff_profile_id,
      includeDeleted: true,
    });

    if (
      currentStaff.profile.deleted_at !== null ||
      currentStaff.profile.status === STAFF_PROFILE_STATUS_DELETED
    ) {
      throw AppError.staffAlreadyDeleted();
    }

    if (currentStaff.profile.status !== STAFF_PROFILE_STATUS_DEACTIVATED) {
      throw AppError.staffAlreadyActive();
    }

    const staffProfileUpdatePayload: StaffProfileUpdate = {
      status: STAFF_PROFILE_STATUS_AVAILABLE,
      deactivated_at: null,
      deleted_at: null,
      updated_by_admin_id: input.updated_by_admin_id,
    };

    const appUserUpdatePayload: AppUserUpdate = {
      status: 'active',
      deactivated_at: null,
      deleted_at: null,
    };

    const { error: appUserUpdateError } = await this.adminClient
      .from('app_users')
      .update(appUserUpdatePayload)
      .eq('id', currentStaff.app_user.id);

    if (appUserUpdateError) {
      throw mapDatabaseError(appUserUpdateError);
    }

    const { data, error } = await this.adminClient
      .from('staff_profiles')
      .update(staffProfileUpdatePayload)
      .eq('id', input.staff_profile_id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    assertStaffProfileRow(data, {
      staff_profile_id: input.staff_profile_id,
    });

    return this.getById({
      staffProfileId: input.staff_profile_id,
    });
  }

  async softDeleteStaff(input: StaffSoftDeleteRepositoryInput): Promise<void> {
    const currentStaff = await this.getById({
      staffProfileId: input.staff_profile_id,
      includeDeleted: true,
    });

    if (
      currentStaff.profile.deleted_at !== null ||
      currentStaff.profile.status === STAFF_PROFILE_STATUS_DELETED
    ) {
      throw AppError.staffAlreadyDeleted();
    }

    const staffProfileUpdatePayload: StaffProfileUpdate = {
      status: STAFF_PROFILE_STATUS_DELETED,
      deactivated_at: null,
      deleted_at: input.deleted_at,
      updated_by_admin_id: input.updated_by_admin_id,
    };

    const appUserUpdatePayload: AppUserUpdate = {
      status: STAFF_PROFILE_STATUS_DELETED,
      deactivated_at: null,
      deleted_at: input.deleted_at,
    };

    const { error: staffProfileUpdateError } = await this.adminClient
      .from('staff_profiles')
      .update(staffProfileUpdatePayload)
      .eq('id', input.staff_profile_id);

    if (staffProfileUpdateError) {
      throw mapDatabaseError(staffProfileUpdateError);
    }

    const { error: appUserUpdateError } = await this.adminClient
      .from('app_users')
      .update(appUserUpdatePayload)
      .eq('id', currentStaff.app_user.id);

    if (appUserUpdateError) {
      throw mapDatabaseError(appUserUpdateError);
    }
  }

  async deleteAppUserByAuthUserIdForRollback(
    input: DeleteAppUserByAuthUserIdForRollbackInput,
  ): Promise<void> {
    const { error } = await this.adminClient
      .from('app_users')
      .delete()
      .eq('auth_user_id', input.authUserId);

    if (error) {
      throw mapDatabaseError(error);
    }
  }
}
