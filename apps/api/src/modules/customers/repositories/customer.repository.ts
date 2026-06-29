// apps/api/src/modules/customers/repositories/customer.repository.ts
/**
 * LAFAM Customer repository.
 *
 * Role:
 * - Owns direct database access for admin-managed customer records.
 * - Persists customer identity across app_users and customer_profiles.
 * - Hydrates customer_profiles with their related app_users records.
 * - Supports direct customer creation and invited customer activation.
 * - Maps database/provider failures into frontend-safe AppError instances.
 *
 * Important:
 * - Email, phone, full name, role, auth status, timezone, and provider identity live in app_users.
 * - Civil ID lives in customer_profiles.
 * - Civil ID values must never be written to logs, audit metadata, email metadata, or error details.
 * - Raw invite tokens must never be stored here.
 * - All privileged customer mutations must go through the NestJS backend.
 */

import { Inject, Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { SUPABASE_ADMIN_CLIENT } from '../../../database/database.constants';
import type {
  AppUserInsert,
  AppUserRow,
  AppUserUpdate,
  CustomerProfileInsert,
  CustomerProfileRow,
  CustomerProfileUpdate,
  LAFAMSupabaseClient,
} from '../../../database/database.types';
import {
  CUSTOMER_APP_ROLE,
  CUSTOMER_AUTH_STATUS_ACTIVE,
  CUSTOMER_AUTH_STATUS_DEACTIVATED,
  CUSTOMER_AUTH_STATUS_DELETED,
  CUSTOMER_AUTH_STATUS_INVITED,
  CUSTOMER_LIST_DEFAULT_LIMIT,
  CUSTOMER_LIST_DEFAULT_OFFSET,
  CUSTOMER_LIST_MAX_LIMIT,
} from '../constants/customer.constants';
import type {
  CustomerCreateRepositoryInput,
  CustomerDeactivateRepositoryInput,
  CustomerListQuery,
  CustomerProfileCreateRepositoryInput,
  CustomerProfileWithUser,
  CustomerReactivateRepositoryInput,
  CustomerRepositoryListResult,
  CustomerSoftDeleteRepositoryInput,
  CustomerUpdateRepositoryInput,
  FindCustomerByAppUserIdInput,
  FindCustomerByCivilIdNormalizedInput,
  FindCustomerByEmailInput,
  FindCustomerByIdInput,
  FindCustomerByPhoneInput,
  LookupCustomerRepositoryInput,
} from '../types/customer.types';

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

export interface ActivateInvitedCustomerInput {
  readonly app_user_id: string;
}

function isDatabaseError(value: unknown): value is DatabaseErrorShape {
  return typeof value === 'object' && value !== null;
}

function databaseErrorText(error: DatabaseErrorShape): string {
  return [error.code, error.message, error.details, error.hint]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase();
}

function hasObjectKeys(value: Record<string, unknown>): boolean {
  return Object.keys(value).length > 0;
}

function normalizeListLimit(value: number): number {
  if (!Number.isFinite(value)) {
    return CUSTOMER_LIST_DEFAULT_LIMIT;
  }

  if (value < 1) {
    return CUSTOMER_LIST_DEFAULT_LIMIT;
  }

  return Math.min(Math.floor(value), CUSTOMER_LIST_MAX_LIMIT);
}

function normalizeListOffset(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return CUSTOMER_LIST_DEFAULT_OFFSET;
  }

  return Math.floor(value);
}

function sanitizePostgrestSearchTerm(value: string): string {
  return value.replace(/[%,()]/gu, '').trim();
}

function mapAppUserDatabaseError(error: unknown): AppError {
  if (!isDatabaseError(error)) {
    return AppError.databaseOperationFailed(error);
  }

  if (error.code === POSTGRES_UNIQUE_VIOLATION_CODE) {
    const errorText = databaseErrorText(error);

    if (
      errorText.includes('app_users_email_key') ||
      errorText.includes('(email)')
    ) {
      return AppError.customerEmailAlreadyExists(undefined, {
        field: 'email',
      });
    }

    if (
      errorText.includes('app_users_non_guest_active_phone_uidx') ||
      errorText.includes('(phone)')
    ) {
      return AppError.customerPhoneAlreadyExists(undefined, {
        field: 'phone',
      });
    }

    return AppError.conflict(
      'The customer user record conflicts with an existing user record.',
    );
  }

  if (
    error.code === POSTGRES_CHECK_VIOLATION_CODE ||
    error.code === POSTGRES_NOT_NULL_VIOLATION_CODE
  ) {
    return AppError.invalidRequest('The customer user payload is invalid.');
  }

  return AppError.databaseOperationFailed(error);
}

function mapCustomerProfileDatabaseError(error: unknown): AppError {
  if (!isDatabaseError(error)) {
    return AppError.customerProfileCreationFailed();
  }

  if (error.code === POSTGRES_UNIQUE_VIOLATION_CODE) {
    const errorText = databaseErrorText(error);

    if (
      errorText.includes('customer_profiles_civil_id_normalized_unique') ||
      errorText.includes('(civil_id_normalized)')
    ) {
      return AppError.customerCivilIdAlreadyExists(undefined, {
        field: 'civil_id',
      });
    }

    return AppError.conflict(
      'The customer profile conflicts with an existing customer profile.',
    );
  }

  if (error.code === POSTGRES_FOREIGN_KEY_VIOLATION_CODE) {
    return AppError.customerNotFound(
      'The related customer user record was not found.',
    );
  }

  if (
    error.code === POSTGRES_CHECK_VIOLATION_CODE ||
    error.code === POSTGRES_NOT_NULL_VIOLATION_CODE
  ) {
    return AppError.invalidRequest('The customer profile payload is invalid.', {
      field: 'civil_id',
    });
  }

  return AppError.customerProfileCreationFailed();
}

function mapReadDatabaseError(error: unknown): AppError {
  if (!isDatabaseError(error)) {
    return AppError.databaseOperationFailed(error);
  }

  if (error.code === POSTGRES_FOREIGN_KEY_VIOLATION_CODE) {
    return AppError.customerNotFound(
      'The related customer or user record was not found.',
    );
  }

  return AppError.databaseOperationFailed(error);
}

function assertCustomerProfileRow(
  row: CustomerProfileRow | null,
  details?: Record<string, unknown>,
): CustomerProfileRow {
  if (!row) {
    throw AppError.customerNotFound(
      'The requested customer was not found.',
      details,
    );
  }

  return row;
}

function assertAppUserRow(
  row: AppUserRow | null,
  details?: Record<string, unknown>,
): AppUserRow {
  if (!row) {
    throw AppError.customerNotFound(
      'The related customer user was not found.',
      details,
    );
  }

  return row;
}

@Injectable()
export class CustomerRepository {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly adminClient: LAFAMSupabaseClient,
  ) {}

  private applyActiveCustomerProfileFilter<
    TQuery extends {
      is(column: string, value: null): TQuery;
    },
  >(query: TQuery, includeDeleted: boolean | undefined): TQuery {
    if (includeDeleted === true) {
      return query;
    }

    return query.is('deleted_at', null);
  }

  private applyActiveCustomerAppUserFilter<
    TQuery extends {
      eq(column: string, value: string | boolean): TQuery;
      is(column: string, value: null): TQuery;
      neq(column: string, value: string): TQuery;
    },
  >(query: TQuery, includeDeleted: boolean | undefined): TQuery {
    let nextQuery = query.eq('role', CUSTOMER_APP_ROLE).eq('is_guest', false);

    if (includeDeleted === true) {
      return nextQuery;
    }

    nextQuery = nextQuery
      .neq('status', CUSTOMER_AUTH_STATUS_DELETED)
      .is('deleted_at', null);

    return nextQuery;
  }

  private async hydrateCustomerProfiles(
    profiles: readonly CustomerProfileRow[],
  ): Promise<readonly CustomerProfileWithUser[]> {
    if (profiles.length === 0) {
      return [];
    }

    const appUserIds = [
      ...new Set(profiles.map((profile) => profile.app_user_id)),
    ];

    const { data: appUsers, error } = await this.adminClient
      .from('app_users')
      .select('*')
      .in('id', appUserIds);

    if (error) {
      throw mapReadDatabaseError(error);
    }

    const appUserById = new Map<string, AppUserRow>(
      (appUsers ?? []).map((appUser) => [appUser.id, appUser]),
    );

    return profiles.map((profile) => {
      const appUser = appUserById.get(profile.app_user_id);

      if (!appUser) {
        throw AppError.customerNotFound(
          'The related customer user was not found.',
          {
            customer_profile_id: profile.id,
            app_user_id: profile.app_user_id,
          },
        );
      }

      return {
        profile,
        app_user: appUser,
      };
    });
  }

  private async hydrateCustomerProfile(
    profile: CustomerProfileRow,
  ): Promise<CustomerProfileWithUser> {
    const hydratedProfiles = await this.hydrateCustomerProfiles([profile]);
    const hydratedProfile = hydratedProfiles[0];

    if (!hydratedProfile) {
      throw AppError.customerNotFound('The requested customer was not found.', {
        customer_profile_id: profile.id,
      });
    }

    return hydratedProfile;
  }

  private async cleanupCreatedCustomerRows(appUserId: string): Promise<void> {
    try {
      await this.deleteAppUserByIdForRollback(appUserId);
    } catch (cleanupError: unknown) {
      void cleanupError;
    }
  }

  private async findMatchingAppUserIdsForList(
    input: Pick<
      CustomerListQuery,
      'search' | 'auth_status' | 'include_deleted'
    >,
  ): Promise<readonly string[] | null> {
    const searchTerm = input.search
      ? sanitizePostgrestSearchTerm(input.search)
      : null;

    const hasAppUserFilter = Boolean(input.auth_status || searchTerm);

    if (!hasAppUserFilter) {
      return null;
    }

    let query = this.adminClient
      .from('app_users')
      .select('id')
      .eq('role', CUSTOMER_APP_ROLE)
      .eq('is_guest', false);

    if (input.auth_status) {
      query = query.eq('status', input.auth_status);
    } else if (input.include_deleted !== true) {
      query = query
        .neq('status', CUSTOMER_AUTH_STATUS_DELETED)
        .is('deleted_at', null);
    }

    if (searchTerm && searchTerm.length > 0) {
      query = query.or(
        `email.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`,
      );
    }

    const { data, error } = await query;

    if (error) {
      throw mapReadDatabaseError(error);
    }

    return (data ?? []).map((row) => row.id);
  }

  async createProfile(
    input: CustomerProfileCreateRepositoryInput,
  ): Promise<CustomerProfileRow> {
    const profileInsertPayload: CustomerProfileInsert = {
      app_user_id: input.appUserId,
      civil_id: input.civilId,
      civil_id_normalized: input.civilIdNormalized,
      created_by_admin_id: input.createdByAdminId,
      updated_by_admin_id: input.updatedByAdminId,
    };

    const { data, error } = await this.adminClient
      .from('customer_profiles')
      .insert(profileInsertPayload)
      .select('*')
      .single();

    if (error) {
      throw mapCustomerProfileDatabaseError(error);
    }

    return assertCustomerProfileRow(data);
  }

  async findById(
    input: FindCustomerByIdInput,
  ): Promise<CustomerProfileWithUser | null> {
    let query = this.adminClient
      .from('customer_profiles')
      .select('*')
      .eq('id', input.customerProfileId);

    query = this.applyActiveCustomerProfileFilter(query, input.includeDeleted);

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw mapReadDatabaseError(error);
    }

    return data ? this.hydrateCustomerProfile(data) : null;
  }

  async getById(
    input: FindCustomerByIdInput,
  ): Promise<CustomerProfileWithUser> {
    const customer = await this.findById(input);

    if (!customer) {
      throw AppError.customerNotFound('The requested customer was not found.', {
        customer_profile_id: input.customerProfileId,
      });
    }

    return customer;
  }

  async findByAppUserId(
    input: FindCustomerByAppUserIdInput,
  ): Promise<CustomerProfileWithUser | null> {
    let query = this.adminClient
      .from('customer_profiles')
      .select('*')
      .eq('app_user_id', input.appUserId);

    query = this.applyActiveCustomerProfileFilter(query, input.includeDeleted);

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw mapReadDatabaseError(error);
    }

    return data ? this.hydrateCustomerProfile(data) : null;
  }

  async findByEmail(
    input: FindCustomerByEmailInput,
  ): Promise<CustomerProfileWithUser | null> {
    let query = this.adminClient
      .from('app_users')
      .select('*')
      .eq('email', input.email);

    query = this.applyActiveCustomerAppUserFilter(query, input.includeDeleted);

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      throw mapReadDatabaseError(error);
    }

    for (const appUser of data ?? []) {
      const customer = await this.findByAppUserId({
        appUserId: appUser.id,
        includeDeleted: input.includeDeleted,
      });

      if (!customer) {
        continue;
      }

      if (
        input.excludeCustomerProfileId &&
        customer.profile.id === input.excludeCustomerProfileId
      ) {
        continue;
      }

      return customer;
    }

    return null;
  }

  async findByPhone(
    input: FindCustomerByPhoneInput,
  ): Promise<CustomerProfileWithUser | null> {
    let query = this.adminClient
      .from('app_users')
      .select('*')
      .eq('phone', input.phone);

    query = this.applyActiveCustomerAppUserFilter(query, input.includeDeleted);

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      throw mapReadDatabaseError(error);
    }

    for (const appUser of data ?? []) {
      const customer = await this.findByAppUserId({
        appUserId: appUser.id,
        includeDeleted: input.includeDeleted,
      });

      if (!customer) {
        continue;
      }

      if (
        input.excludeCustomerProfileId &&
        customer.profile.id === input.excludeCustomerProfileId
      ) {
        continue;
      }

      return customer;
    }

    return null;
  }

  async findByCivilIdNormalized(
    input: FindCustomerByCivilIdNormalizedInput,
  ): Promise<CustomerProfileWithUser | null> {
    let query = this.adminClient
      .from('customer_profiles')
      .select('*')
      .eq('civil_id_normalized', input.civilIdNormalized);

    query = this.applyActiveCustomerProfileFilter(query, input.includeDeleted);

    if (input.excludeCustomerProfileId) {
      query = query.neq('id', input.excludeCustomerProfileId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw mapReadDatabaseError(error);
    }

    return data ? this.hydrateCustomerProfile(data) : null;
  }

  async lookupCustomer(
    input: LookupCustomerRepositoryInput,
  ): Promise<CustomerProfileWithUser | null> {
    if (input.civilIdNormalized) {
      const customer = await this.findByCivilIdNormalized({
        civilIdNormalized: input.civilIdNormalized,
        includeDeleted: input.includeDeleted,
      });

      if (!customer) {
        return null;
      }

      if (input.phone && customer.app_user.phone !== input.phone) {
        return null;
      }

      return customer;
    }

    if (input.phone) {
      return this.findByPhone({
        phone: input.phone,
        includeDeleted: input.includeDeleted,
      });
    }

    return null;
  }

  async listCustomers(
    input: CustomerListQuery,
  ): Promise<CustomerRepositoryListResult> {
    const limit = normalizeListLimit(input.limit);
    const offset = normalizeListOffset(input.offset);

    const matchingAppUserIds = await this.findMatchingAppUserIdsForList(input);

    if (matchingAppUserIds !== null && matchingAppUserIds.length === 0) {
      return {
        customers: [],
        total: 0,
        limit,
        offset,
      };
    }

    let query = this.adminClient
      .from('customer_profiles')
      .select('*', { count: 'exact' });

    query = this.applyActiveCustomerProfileFilter(query, input.include_deleted);

    if (matchingAppUserIds !== null) {
      query = query.in('app_user_id', [...matchingAppUserIds]);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw mapReadDatabaseError(error);
    }

    const profiles = data ?? [];
    const customers = await this.hydrateCustomerProfiles(profiles);

    return {
      customers,
      total: count ?? customers.length,
      limit,
      offset,
    };
  }

  async createCustomer(
    input: CustomerCreateRepositoryInput,
  ): Promise<CustomerProfileWithUser> {
    const appUserInsertPayload: AppUserInsert = {
      auth_user_id: input.app_user.auth_user_id,
      email: input.app_user.email,
      phone: input.app_user.phone,
      full_name: input.app_user.full_name,
      role: input.app_user.role,
      status: input.app_user.status,
      is_guest: input.app_user.is_guest,
      timezone: input.app_user.timezone,
      metadata: input.app_user.metadata,
    };

    const { data: appUserData, error: appUserError } = await this.adminClient
      .from('app_users')
      .insert(appUserInsertPayload)
      .select('*')
      .single();

    if (appUserError) {
      throw mapAppUserDatabaseError(appUserError);
    }

    const appUser = assertAppUserRow(appUserData);

    const profileInsertPayload: CustomerProfileInsert = {
      app_user_id: appUser.id,
      civil_id: input.customer_profile.civil_id,
      civil_id_normalized: input.customer_profile.civil_id_normalized,
      created_by_admin_id: input.customer_profile.created_by_admin_id,
      updated_by_admin_id: input.customer_profile.updated_by_admin_id,
    };

    const { data: profileData, error: profileError } = await this.adminClient
      .from('customer_profiles')
      .insert(profileInsertPayload)
      .select('*')
      .single();

    if (profileError) {
      await this.cleanupCreatedCustomerRows(appUser.id);
      throw mapCustomerProfileDatabaseError(profileError);
    }

    const profile = assertCustomerProfileRow(profileData);

    return {
      profile,
      app_user: appUser,
    };
  }

  async activateInvitedCustomer(
    input: ActivateInvitedCustomerInput,
  ): Promise<CustomerProfileWithUser> {
    const currentCustomer = await this.findByAppUserId({
      appUserId: input.app_user_id,
      includeDeleted: true,
    });

    if (!currentCustomer) {
      throw AppError.customerNotFound('The invited customer was not found.', {
        app_user_id: input.app_user_id,
      });
    }

    if (
      currentCustomer.profile.deleted_at !== null ||
      currentCustomer.app_user.status === CUSTOMER_AUTH_STATUS_DELETED ||
      currentCustomer.app_user.deleted_at !== null
    ) {
      throw AppError.customerAlreadyDeleted();
    }

    if (currentCustomer.app_user.status === CUSTOMER_AUTH_STATUS_ACTIVE) {
      throw AppError.customerInviteAlreadyAccepted(
        'This invitation has already been accepted.',
        {
          app_user_id: input.app_user_id,
        },
      );
    }

    if (currentCustomer.app_user.status !== CUSTOMER_AUTH_STATUS_INVITED) {
      throw AppError.customerInviteAcceptFailed(
        new Error('Customer account is not in invited status.'),
      );
    }

    const appUserUpdatePayload: AppUserUpdate = {
      status: CUSTOMER_AUTH_STATUS_ACTIVE,
      deactivated_at: null,
      deleted_at: null,
    };

    const { error } = await this.adminClient
      .from('app_users')
      .update(appUserUpdatePayload)
      .eq('id', input.app_user_id)
      .eq('status', CUSTOMER_AUTH_STATUS_INVITED);

    if (error) {
      throw mapAppUserDatabaseError(error);
    }

    return this.getById({
      customerProfileId: currentCustomer.profile.id,
    });
  }

  async updateCustomer(
    input: CustomerUpdateRepositoryInput,
  ): Promise<CustomerProfileWithUser> {
    const currentCustomer = await this.getById({
      customerProfileId: input.customer_profile_id,
      includeDeleted: true,
    });

    if (
      currentCustomer.profile.deleted_at !== null ||
      currentCustomer.app_user.status === CUSTOMER_AUTH_STATUS_DELETED ||
      currentCustomer.app_user.deleted_at !== null
    ) {
      throw AppError.customerAlreadyDeleted();
    }

    if (input.app_user_update) {
      const appUserUpdatePayload: AppUserUpdate = {};

      if (input.app_user_update.full_name !== undefined) {
        appUserUpdatePayload.full_name = input.app_user_update.full_name;
      }

      if (input.app_user_update.phone !== undefined) {
        appUserUpdatePayload.phone = input.app_user_update.phone;
      }

      if (input.app_user_update.timezone !== undefined) {
        appUserUpdatePayload.timezone = input.app_user_update.timezone;
      }

      if (hasObjectKeys(appUserUpdatePayload)) {
        const { error } = await this.adminClient
          .from('app_users')
          .update(appUserUpdatePayload)
          .eq('id', currentCustomer.app_user.id);

        if (error) {
          throw mapAppUserDatabaseError(error);
        }
      }
    }

    const profileUpdatePayload: CustomerProfileUpdate = {
      ...input.profile_update,
      updated_by_admin_id: input.updated_by_admin_id,
    };

    const { data, error } = await this.adminClient
      .from('customer_profiles')
      .update(profileUpdatePayload)
      .eq('id', input.customer_profile_id)
      .is('deleted_at', null)
      .select('*')
      .maybeSingle();

    if (error) {
      throw mapCustomerProfileDatabaseError(error);
    }

    assertCustomerProfileRow(data, {
      customer_profile_id: input.customer_profile_id,
    });

    return this.getById({
      customerProfileId: input.customer_profile_id,
    });
  }

  async deactivateCustomer(
    input: CustomerDeactivateRepositoryInput,
  ): Promise<CustomerProfileWithUser> {
    const currentCustomer = await this.getById({
      customerProfileId: input.customer_profile_id,
      includeDeleted: true,
    });

    if (
      currentCustomer.profile.deleted_at !== null ||
      currentCustomer.app_user.status === CUSTOMER_AUTH_STATUS_DELETED ||
      currentCustomer.app_user.deleted_at !== null
    ) {
      throw AppError.customerAlreadyDeleted();
    }

    if (currentCustomer.app_user.status === CUSTOMER_AUTH_STATUS_DEACTIVATED) {
      throw AppError.customerAlreadyDeactivated();
    }

    const appUserUpdatePayload: AppUserUpdate = {
      status: CUSTOMER_AUTH_STATUS_DEACTIVATED,
      deactivated_at: input.deactivated_at,
    };

    const { error: appUserUpdateError } = await this.adminClient
      .from('app_users')
      .update(appUserUpdatePayload)
      .eq('id', currentCustomer.app_user.id);

    if (appUserUpdateError) {
      throw mapAppUserDatabaseError(appUserUpdateError);
    }

    const profileUpdatePayload: CustomerProfileUpdate = {
      updated_by_admin_id: input.updated_by_admin_id,
    };

    const { error: profileUpdateError } = await this.adminClient
      .from('customer_profiles')
      .update(profileUpdatePayload)
      .eq('id', input.customer_profile_id);

    if (profileUpdateError) {
      throw mapCustomerProfileDatabaseError(profileUpdateError);
    }

    return this.getById({
      customerProfileId: input.customer_profile_id,
      includeDeleted: true,
    });
  }

  async reactivateCustomer(
    input: CustomerReactivateRepositoryInput,
  ): Promise<CustomerProfileWithUser> {
    const currentCustomer = await this.getById({
      customerProfileId: input.customer_profile_id,
      includeDeleted: true,
    });

    if (
      currentCustomer.profile.deleted_at !== null ||
      currentCustomer.app_user.status === CUSTOMER_AUTH_STATUS_DELETED ||
      currentCustomer.app_user.deleted_at !== null
    ) {
      throw AppError.customerAlreadyDeleted();
    }

    if (currentCustomer.app_user.status !== CUSTOMER_AUTH_STATUS_DEACTIVATED) {
      throw AppError.customerAlreadyActive();
    }

    const appUserUpdatePayload: AppUserUpdate = {
      status: CUSTOMER_AUTH_STATUS_ACTIVE,
      deactivated_at: null,
      deleted_at: null,
    };

    const { error: appUserUpdateError } = await this.adminClient
      .from('app_users')
      .update(appUserUpdatePayload)
      .eq('id', currentCustomer.app_user.id);

    if (appUserUpdateError) {
      throw mapAppUserDatabaseError(appUserUpdateError);
    }

    const profileUpdatePayload: CustomerProfileUpdate = {
      updated_by_admin_id: input.updated_by_admin_id,
      deleted_at: null,
    };

    const { error: profileUpdateError } = await this.adminClient
      .from('customer_profiles')
      .update(profileUpdatePayload)
      .eq('id', input.customer_profile_id);

    if (profileUpdateError) {
      throw mapCustomerProfileDatabaseError(profileUpdateError);
    }

    return this.getById({
      customerProfileId: input.customer_profile_id,
    });
  }

  async softDeleteCustomer(
    input: CustomerSoftDeleteRepositoryInput,
  ): Promise<void> {
    const currentCustomer = await this.getById({
      customerProfileId: input.customer_profile_id,
      includeDeleted: true,
    });

    if (
      currentCustomer.profile.deleted_at !== null ||
      currentCustomer.app_user.status === CUSTOMER_AUTH_STATUS_DELETED ||
      currentCustomer.app_user.deleted_at !== null
    ) {
      throw AppError.customerAlreadyDeleted();
    }

    const profileUpdatePayload: CustomerProfileUpdate = {
      deleted_at: input.deleted_at,
      updated_by_admin_id: input.updated_by_admin_id,
    };

    const { error: profileUpdateError } = await this.adminClient
      .from('customer_profiles')
      .update(profileUpdatePayload)
      .eq('id', input.customer_profile_id);

    if (profileUpdateError) {
      throw mapCustomerProfileDatabaseError(profileUpdateError);
    }

    const appUserUpdatePayload: AppUserUpdate = {
      status: CUSTOMER_AUTH_STATUS_DELETED,
      deactivated_at: null,
      deleted_at: input.deleted_at,
    };

    const { error: appUserUpdateError } = await this.adminClient
      .from('app_users')
      .update(appUserUpdatePayload)
      .eq('id', currentCustomer.app_user.id);

    if (appUserUpdateError) {
      throw mapAppUserDatabaseError(appUserUpdateError);
    }
  }

  async deleteCustomerProfileByIdForRollback(
    customerProfileId: string,
  ): Promise<void> {
    const { error } = await this.adminClient
      .from('customer_profiles')
      .delete()
      .eq('id', customerProfileId);

    if (error) {
      throw mapCustomerProfileDatabaseError(error);
    }
  }

  async deleteAppUserByIdForRollback(appUserId: string): Promise<void> {
    const { error } = await this.adminClient
      .from('app_users')
      .delete()
      .eq('id', appUserId);

    if (error) {
      throw mapAppUserDatabaseError(error);
    }
  }
}
