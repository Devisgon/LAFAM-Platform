// apps/api/src/modules/customers/application/customer-admin.service.ts
/**
 * LAFAM Customer admin service.
 *
 * Role:
 * - Owns Customer Module business rules for admin-managed customer records.
 * - Coordinates Supabase Auth customer user creation with app_users/customer_profiles creation.
 * - Converts repository results into safe admin API response objects.
 *
 * Important:
 * - Admin-created customers are created as active/verified users and do not require email OTP verification.
 * - Customer creation requires full name, email, phone, Civil ID, password, and password confirmation.
 * - Email changes are not supported in this phase.
 * - Password changes are handled by Auth password reset flows.
 * - Customer status changes must use dedicated deactivate/reactivate endpoints.
 * - Passwords, OTPs, access tokens, refresh tokens, and Civil ID values must never be logged.
 * - Civil ID may be returned in admin customer responses, but must never be written to audit metadata.
 */

import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import type { DatabaseJsonObject } from '../../../database/database.types';
import {
  AUTH_ERROR_REASON_PASSWORD_CONFIRMATION_MISMATCH,
  AUTH_ERROR_REASON_PASSWORD_POLICY_FAILED,
} from '../../auth/constants/auth-error.constants';
import {
  AUTH_AUDIT_EVENT_CUSTOMER_PROFILE_CREATED,
  AUTH_AUDIT_EVENT_CUSTOMER_PROFILE_DELETED,
  AUTH_AUDIT_EVENT_CUSTOMER_PROFILE_UPDATED,
  AUTH_AUDIT_EVENT_USER_CREATED_BY_ADMIN,
  AUTH_AUDIT_EVENT_USER_DEACTIVATED,
  AUTH_AUDIT_EVENT_USER_REACTIVATED,
} from '../../auth/constants/auth.constants';
import { AuthAuditRepository } from '../../auth/repositories/auth-audit.repository';
import { AuthUserRepository } from '../../auth/repositories/auth-user.repository';
import { SupabaseAuthRepository } from '../../auth/repositories/supabase-auth.repository';
import type { AuthInternalContext } from '../../auth/types/auth-context.types';
import { normalizeAuthCivilIdNormalized } from '../../auth/utils/auth-normalization.util';
import {
  getAuthPasswordPolicyFailureCodes,
  validateAuthPasswordAndConfirmation,
} from '../../auth/utils/password-policy.util';
import {
  CUSTOMER_APP_ROLE,
  CUSTOMER_AUDIT_METADATA_APP_USER_ID_KEY,
  CUSTOMER_AUDIT_METADATA_CREATED_BY_ADMIN_ID_KEY,
  CUSTOMER_AUDIT_METADATA_CUSTOMER_PROFILE_ID_KEY,
  CUSTOMER_AUDIT_METADATA_UPDATED_BY_ADMIN_ID_KEY,
  CUSTOMER_AUTH_METADATA_CREATED_BY_ADMIN_ID_KEY,
  CUSTOMER_AUTH_METADATA_SOURCE_ADMIN_CUSTOMER_CREATE,
  CUSTOMER_AUTH_METADATA_SOURCE_KEY,
  CUSTOMER_CIVIL_ID_NORMALIZED_LENGTH,
  CUSTOMER_CREATE_AUTH_STATUS,
  CUSTOMER_LIST_DEFAULT_LIMIT,
  CUSTOMER_LIST_DEFAULT_OFFSET,
  CUSTOMER_LOOKUP_FIELD_CIVIL_ID,
  CUSTOMER_LOOKUP_FIELD_PHONE,
  isCustomerAdminManagementRole,
  isCustomerAuthStatus,
  type CustomerAuthStatus,
} from '../constants/customer.constants';
import type { CreateCustomerDto } from '../dto/create-customer.dto';
import type { ListCustomersQueryDto } from '../dto/list-customers-query.dto';
import type { LookupCustomerQueryDto } from '../dto/lookup-customer-query.dto';
import type { UpdateCustomerDto } from '../dto/update-customer.dto';
import { CustomerRepository } from '../repositories/customer.repository';
import type {
  CustomerDeleteResult,
  CustomerListQuery,
  CustomerListResult,
  CustomerLookupMatch,
  CustomerLookupResult,
  CustomerMutationResult,
  CustomerProfileWithUser,
  SafeCustomerProfile,
} from '../types/customer.types';

function resolveAdminActorId(auth: AuthInternalContext): string {
  if (!isCustomerAdminManagementRole(auth.profile.role)) {
    throw AppError.adminAccessRequired(
      'Admin access is required to manage customers.',
    );
  }

  return auth.profile.id;
}

function resolveRequiredCivilIdNormalized(civilId: string): string {
  const civilIdNormalized = normalizeAuthCivilIdNormalized(civilId);

  if (
    !civilIdNormalized ||
    civilIdNormalized.length !== CUSTOMER_CIVIL_ID_NORMALIZED_LENGTH
  ) {
    throw AppError.validationFailed(
      'civil_id must contain exactly 12 digits and may include spaces or hyphens.',
      {
        field: 'civil_id',
      },
    );
  }

  return civilIdNormalized;
}

function buildPasswordFailureDetails(
  failures: readonly unknown[],
  failureCodes: readonly string[],
): DatabaseJsonObject {
  return {
    reason: failureCodes.includes(
      AUTH_ERROR_REASON_PASSWORD_CONFIRMATION_MISMATCH,
    )
      ? AUTH_ERROR_REASON_PASSWORD_CONFIRMATION_MISMATCH
      : AUTH_ERROR_REASON_PASSWORD_POLICY_FAILED,
    failures: failures as DatabaseJsonObject['failures'],
  };
}

function assertCustomerPasswordAllowed(dto: CreateCustomerDto): void {
  const result = validateAuthPasswordAndConfirmation(
    dto.password,
    dto.confirm_password,
    {
      email: dto.email,
      fullName: dto.full_name,
    },
  );

  if (result.valid) {
    return;
  }

  const failureCodes = getAuthPasswordPolicyFailureCodes(result);

  if (failureCodes.includes(AUTH_ERROR_REASON_PASSWORD_CONFIRMATION_MISMATCH)) {
    throw AppError.passwordConfirmationMismatch(
      'Password confirmation does not match.',
    );
  }

  throw AppError.passwordPolicyFailed(
    'The customer password does not meet security requirements.',
    buildPasswordFailureDetails(result.failures, failureCodes),
  );
}

function resolveRequiredCustomerString(input: {
  readonly value: string | null;
  readonly publicMessage: string;
  readonly details: Record<string, unknown>;
}): string {
  if (input.value) {
    return input.value;
  }

  throw AppError.customerNotFound(input.publicMessage, input.details);
}

function resolveCustomerAuthStatus(value: string): CustomerAuthStatus {
  if (isCustomerAuthStatus(value)) {
    return value;
  }

  throw AppError.customerNotFound(
    'The stored customer auth status is invalid.',
  );
}

function assertHydratedCustomerIsCustomer(
  customer: CustomerProfileWithUser,
): void {
  if (
    customer.app_user.role !== CUSTOMER_APP_ROLE ||
    customer.app_user.is_guest !== false
  ) {
    throw AppError.customerNotFound('The requested customer was not found.', {
      customer_profile_id: customer.profile.id,
      app_user_id: customer.app_user.id,
    });
  }
}

function mapCustomerToSafeResponse(
  customer: CustomerProfileWithUser,
): SafeCustomerProfile {
  assertHydratedCustomerIsCustomer(customer);

  return {
    id: customer.profile.id,
    app_user_id: customer.app_user.id,
    auth_user_id: resolveRequiredCustomerString({
      value: customer.app_user.auth_user_id,
      publicMessage: 'The related customer auth identity was not found.',
      details: {
        customer_profile_id: customer.profile.id,
        app_user_id: customer.app_user.id,
      },
    }),
    email: resolveRequiredCustomerString({
      value: customer.app_user.email,
      publicMessage: 'The related customer email was not found.',
      details: {
        customer_profile_id: customer.profile.id,
        app_user_id: customer.app_user.id,
      },
    }),
    phone: resolveRequiredCustomerString({
      value: customer.app_user.phone,
      publicMessage: 'The related customer phone number was not found.',
      details: {
        customer_profile_id: customer.profile.id,
        app_user_id: customer.app_user.id,
      },
    }),
    full_name: resolveRequiredCustomerString({
      value: customer.app_user.full_name,
      publicMessage: 'The related customer full name was not found.',
      details: {
        customer_profile_id: customer.profile.id,
        app_user_id: customer.app_user.id,
      },
    }),
    civil_id: customer.profile.civil_id,
    role: CUSTOMER_APP_ROLE,
    auth_status: resolveCustomerAuthStatus(customer.app_user.status),
    is_guest: false,
    avatar_path: customer.app_user.avatar_path,
    timezone: customer.app_user.timezone,
    created_by_admin_id: customer.profile.created_by_admin_id,
    updated_by_admin_id: customer.profile.updated_by_admin_id,
    created_at: customer.profile.created_at,
    updated_at: customer.profile.updated_at,
    deactivated_at: customer.app_user.deactivated_at,
    deleted_at: customer.profile.deleted_at ?? customer.app_user.deleted_at,
  };
}

function buildCustomerListQuery(dto: ListCustomersQueryDto): CustomerListQuery {
  return {
    ...(dto.search !== undefined ? { search: dto.search } : {}),
    ...(dto.auth_status !== undefined ? { auth_status: dto.auth_status } : {}),
    include_deleted: dto.include_deleted ?? false,
    limit: dto.limit ?? CUSTOMER_LIST_DEFAULT_LIMIT,
    offset: dto.offset ?? CUSTOMER_LIST_DEFAULT_OFFSET,
  };
}

function hasObjectKeys(value: Record<string, unknown>): boolean {
  return Object.keys(value).length > 0;
}

function buildCustomerAuditMetadata(input: {
  readonly customerProfileId: string;
  readonly appUserId: string;
  readonly adminUserId: string;
  readonly adminMetadataKey:
    | typeof CUSTOMER_AUDIT_METADATA_CREATED_BY_ADMIN_ID_KEY
    | typeof CUSTOMER_AUDIT_METADATA_UPDATED_BY_ADMIN_ID_KEY;
}): DatabaseJsonObject {
  return {
    [CUSTOMER_AUDIT_METADATA_CUSTOMER_PROFILE_ID_KEY]: input.customerProfileId,
    [CUSTOMER_AUDIT_METADATA_APP_USER_ID_KEY]: input.appUserId,
    [input.adminMetadataKey]: input.adminUserId,
  };
}

@Injectable()
export class CustomerAdminService {
  constructor(
    private readonly customerRepository: CustomerRepository,
    private readonly authUserRepository: AuthUserRepository,
    private readonly supabaseAuthRepository: SupabaseAuthRepository,
    private readonly authAuditRepository: AuthAuditRepository,
  ) {}

  async listCustomers(
    auth: AuthInternalContext,
    dto: ListCustomersQueryDto,
  ): Promise<CustomerListResult> {
    resolveAdminActorId(auth);

    const result = await this.customerRepository.listCustomers(
      buildCustomerListQuery(dto),
    );

    return {
      customers: result.customers.map(mapCustomerToSafeResponse),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    };
  }

  async getCustomerById(
    auth: AuthInternalContext,
    customerId: string,
  ): Promise<CustomerMutationResult> {
    resolveAdminActorId(auth);

    const customer = await this.customerRepository.getById({
      customerProfileId: customerId,
    });

    return {
      customer: mapCustomerToSafeResponse(customer),
    };
  }

  async lookupCustomer(
    auth: AuthInternalContext,
    dto: LookupCustomerQueryDto,
  ): Promise<CustomerLookupResult> {
    resolveAdminActorId(auth);

    const hasPhone = Boolean(dto.phone);
    const hasCivilId = Boolean(dto.civil_id);

    if (!hasPhone && !hasCivilId) {
      throw AppError.customerLookupQueryRequired(undefined, {
        fields: [CUSTOMER_LOOKUP_FIELD_PHONE, CUSTOMER_LOOKUP_FIELD_CIVIL_ID],
      });
    }

    if (dto.phone && dto.civil_id) {
      return this.lookupCustomerByPhoneAndCivilId({
        phone: dto.phone,
        civilId: dto.civil_id,
      });
    }

    if (dto.phone) {
      const customer = await this.customerRepository.findByPhone({
        phone: dto.phone,
      });

      return {
        customer: customer ? mapCustomerToSafeResponse(customer) : null,
        matched_by: customer ? CUSTOMER_LOOKUP_FIELD_PHONE : null,
      };
    }

    const civilIdNormalized = resolveRequiredCivilIdNormalized(dto.civil_id!);

    const customer = await this.customerRepository.findByCivilIdNormalized({
      civilIdNormalized,
    });

    return {
      customer: customer ? mapCustomerToSafeResponse(customer) : null,
      matched_by: customer ? CUSTOMER_LOOKUP_FIELD_CIVIL_ID : null,
    };
  }

  async createCustomer(
    auth: AuthInternalContext,
    dto: CreateCustomerDto,
  ): Promise<CustomerMutationResult> {
    const adminUserId = resolveAdminActorId(auth);
    const civilIdNormalized = resolveRequiredCivilIdNormalized(dto.civil_id);

    assertCustomerPasswordAllowed(dto);

    await this.assertCustomerCreateIdentityAvailable({
      email: dto.email,
      phone: dto.phone,
      civilIdNormalized,
    });

    const authUserResult =
      await this.supabaseAuthRepository.createCustomerAuthUserWithPassword({
        email: dto.email,
        password: dto.password,
        fullName: dto.full_name,
        phone: dto.phone,
        timezone: dto.timezone ?? null,
        createdByAdminId: adminUserId,
      });

    try {
      const customer = await this.customerRepository.createCustomer({
        app_user: {
          auth_user_id: authUserResult.user.id,
          email: dto.email,
          phone: dto.phone,
          full_name: dto.full_name,
          role: CUSTOMER_APP_ROLE,
          status: CUSTOMER_CREATE_AUTH_STATUS,
          is_guest: false,
          timezone: dto.timezone ?? null,
          metadata: {
            [CUSTOMER_AUTH_METADATA_SOURCE_KEY]:
              CUSTOMER_AUTH_METADATA_SOURCE_ADMIN_CUSTOMER_CREATE,
            [CUSTOMER_AUTH_METADATA_CREATED_BY_ADMIN_ID_KEY]: adminUserId,
          },
        },
        customer_profile: {
          civil_id: dto.civil_id,
          civil_id_normalized: civilIdNormalized,
          created_by_admin_id: adminUserId,
          updated_by_admin_id: adminUserId,
        },
      });

      await this.authAuditRepository.createEvent({
        actorUserId: adminUserId,
        targetUserId: customer.app_user.id,
        eventType: AUTH_AUDIT_EVENT_USER_CREATED_BY_ADMIN,
        metadata: buildCustomerAuditMetadata({
          customerProfileId: customer.profile.id,
          appUserId: customer.app_user.id,
          adminUserId,
          adminMetadataKey: CUSTOMER_AUDIT_METADATA_CREATED_BY_ADMIN_ID_KEY,
        }),
      });

      await this.authAuditRepository.createEvent({
        actorUserId: adminUserId,
        targetUserId: customer.app_user.id,
        eventType: AUTH_AUDIT_EVENT_CUSTOMER_PROFILE_CREATED,
        metadata: buildCustomerAuditMetadata({
          customerProfileId: customer.profile.id,
          appUserId: customer.app_user.id,
          adminUserId,
          adminMetadataKey: CUSTOMER_AUDIT_METADATA_CREATED_BY_ADMIN_ID_KEY,
        }),
      });

      return {
        customer: mapCustomerToSafeResponse(customer),
      };
    } catch (error) {
      await this.cleanupCreatedAuthUser(authUserResult.user.id);

      if (error instanceof AppError) {
        throw error;
      }

      throw AppError.customerCreateFailed(error);
    }
  }

  async updateCustomer(
    auth: AuthInternalContext,
    customerId: string,
    dto: UpdateCustomerDto,
  ): Promise<CustomerMutationResult> {
    const adminUserId = resolveAdminActorId(auth);

    const currentCustomer = await this.customerRepository.getById({
      customerProfileId: customerId,
    });

    const profileUpdate: {
      civil_id?: string;
      civil_id_normalized?: string;
    } = {};

    const appUserUpdate: {
      full_name?: string;
      phone?: string;
      timezone?: string | null;
    } = {};

    if (dto.full_name !== undefined) {
      appUserUpdate.full_name = dto.full_name;
    }

    if (dto.phone !== undefined) {
      await this.assertCustomerPhoneAvailableForUpdate({
        phone: dto.phone,
        currentAppUserId: currentCustomer.app_user.id,
      });

      appUserUpdate.phone = dto.phone;
    }

    if (dto.civil_id !== undefined) {
      const civilIdNormalized = resolveRequiredCivilIdNormalized(dto.civil_id);

      await this.assertCustomerCivilIdAvailableForUpdate({
        civilIdNormalized,
        currentCustomerProfileId: currentCustomer.profile.id,
      });

      profileUpdate.civil_id = dto.civil_id;
      profileUpdate.civil_id_normalized = civilIdNormalized;
    }

    if (dto.timezone !== undefined) {
      appUserUpdate.timezone = dto.timezone;
    }

    if (!hasObjectKeys(profileUpdate) && !hasObjectKeys(appUserUpdate)) {
      throw AppError.customerEmptyUpdate(
        'At least one customer field must be provided for update.',
      );
    }

    const customer = await this.customerRepository.updateCustomer({
      customer_profile_id: customerId,
      updated_by_admin_id: adminUserId,
      profile_update: profileUpdate,
      app_user_update: hasObjectKeys(appUserUpdate) ? appUserUpdate : undefined,
    });

    await this.authAuditRepository.createEvent({
      actorUserId: adminUserId,
      targetUserId: customer.app_user.id,
      eventType: AUTH_AUDIT_EVENT_CUSTOMER_PROFILE_UPDATED,
      metadata: buildCustomerAuditMetadata({
        customerProfileId: customer.profile.id,
        appUserId: customer.app_user.id,
        adminUserId,
        adminMetadataKey: CUSTOMER_AUDIT_METADATA_UPDATED_BY_ADMIN_ID_KEY,
      }),
    });

    return {
      customer: mapCustomerToSafeResponse(customer),
    };
  }

  async deactivateCustomer(
    auth: AuthInternalContext,
    customerId: string,
  ): Promise<CustomerMutationResult> {
    const adminUserId = resolveAdminActorId(auth);

    const customer = await this.customerRepository.deactivateCustomer({
      customer_profile_id: customerId,
      updated_by_admin_id: adminUserId,
      deactivated_at: new Date().toISOString(),
    });

    await this.authAuditRepository.createEvent({
      actorUserId: adminUserId,
      targetUserId: customer.app_user.id,
      eventType: AUTH_AUDIT_EVENT_USER_DEACTIVATED,
      metadata: buildCustomerAuditMetadata({
        customerProfileId: customer.profile.id,
        appUserId: customer.app_user.id,
        adminUserId,
        adminMetadataKey: CUSTOMER_AUDIT_METADATA_UPDATED_BY_ADMIN_ID_KEY,
      }),
    });

    return {
      customer: mapCustomerToSafeResponse(customer),
    };
  }

  async reactivateCustomer(
    auth: AuthInternalContext,
    customerId: string,
  ): Promise<CustomerMutationResult> {
    const adminUserId = resolveAdminActorId(auth);

    const customer = await this.customerRepository.reactivateCustomer({
      customer_profile_id: customerId,
      updated_by_admin_id: adminUserId,
    });

    await this.authAuditRepository.createEvent({
      actorUserId: adminUserId,
      targetUserId: customer.app_user.id,
      eventType: AUTH_AUDIT_EVENT_USER_REACTIVATED,
      metadata: buildCustomerAuditMetadata({
        customerProfileId: customer.profile.id,
        appUserId: customer.app_user.id,
        adminUserId,
        adminMetadataKey: CUSTOMER_AUDIT_METADATA_UPDATED_BY_ADMIN_ID_KEY,
      }),
    });

    return {
      customer: mapCustomerToSafeResponse(customer),
    };
  }

  async deleteCustomer(
    auth: AuthInternalContext,
    customerId: string,
  ): Promise<CustomerDeleteResult> {
    const adminUserId = resolveAdminActorId(auth);

    const customer = await this.customerRepository.getById({
      customerProfileId: customerId,
    });

    await this.customerRepository.softDeleteCustomer({
      customer_profile_id: customerId,
      updated_by_admin_id: adminUserId,
      deleted_at: new Date().toISOString(),
    });

    await this.authAuditRepository.createEvent({
      actorUserId: adminUserId,
      targetUserId: customer.app_user.id,
      eventType: AUTH_AUDIT_EVENT_CUSTOMER_PROFILE_DELETED,
      metadata: buildCustomerAuditMetadata({
        customerProfileId: customer.profile.id,
        appUserId: customer.app_user.id,
        adminUserId,
        adminMetadataKey: CUSTOMER_AUDIT_METADATA_UPDATED_BY_ADMIN_ID_KEY,
      }),
    });

    return {
      deleted: true,
      customer_id: customerId,
    };
  }

  private async lookupCustomerByPhoneAndCivilId(input: {
    readonly phone: string;
    readonly civilId: string;
  }): Promise<CustomerLookupResult> {
    const civilIdNormalized = resolveRequiredCivilIdNormalized(input.civilId);

    const phoneCustomer = await this.customerRepository.findByPhone({
      phone: input.phone,
    });

    const civilIdCustomer =
      await this.customerRepository.findByCivilIdNormalized({
        civilIdNormalized,
      });

    if (!phoneCustomer && !civilIdCustomer) {
      return {
        customer: null,
        matched_by: null,
      };
    }

    if (!phoneCustomer || !civilIdCustomer) {
      throw AppError.customerLookupConflict(undefined, {
        fields: [CUSTOMER_LOOKUP_FIELD_PHONE, CUSTOMER_LOOKUP_FIELD_CIVIL_ID],
      });
    }

    if (phoneCustomer.profile.id !== civilIdCustomer.profile.id) {
      throw AppError.customerLookupConflict(undefined, {
        fields: [CUSTOMER_LOOKUP_FIELD_PHONE, CUSTOMER_LOOKUP_FIELD_CIVIL_ID],
      });
    }

    return {
      customer: mapCustomerToSafeResponse(phoneCustomer),
      matched_by: 'phone_and_civil_id' satisfies CustomerLookupMatch,
    };
  }

  private async assertCustomerCreateIdentityAvailable(input: {
    readonly email: string;
    readonly phone: string;
    readonly civilIdNormalized: string;
  }): Promise<void> {
    const existingEmailUser = await this.authUserRepository.findByEmail({
      email: input.email,
    });

    if (existingEmailUser) {
      throw AppError.customerEmailAlreadyExists(undefined, {
        field: 'email',
      });
    }

    const existingPhoneUser = await this.authUserRepository.findByPhone({
      phone: input.phone,
    });

    if (existingPhoneUser) {
      throw AppError.customerPhoneAlreadyExists(undefined, {
        field: 'phone',
      });
    }

    const existingCivilIdCustomer =
      await this.customerRepository.findByCivilIdNormalized({
        civilIdNormalized: input.civilIdNormalized,
        includeDeleted: true,
      });

    if (existingCivilIdCustomer) {
      throw AppError.customerCivilIdAlreadyExists(undefined, {
        field: 'civil_id',
      });
    }
  }

  private async assertCustomerPhoneAvailableForUpdate(input: {
    readonly phone: string;
    readonly currentAppUserId: string;
  }): Promise<void> {
    const existingPhoneUser = await this.authUserRepository.findByPhone({
      phone: input.phone,
      excludeUserId: input.currentAppUserId,
    });

    if (existingPhoneUser) {
      throw AppError.customerPhoneAlreadyExists(undefined, {
        field: 'phone',
      });
    }
  }

  private async assertCustomerCivilIdAvailableForUpdate(input: {
    readonly civilIdNormalized: string;
    readonly currentCustomerProfileId: string;
  }): Promise<void> {
    const existingCivilIdCustomer =
      await this.customerRepository.findByCivilIdNormalized({
        civilIdNormalized: input.civilIdNormalized,
        includeDeleted: true,
        excludeCustomerProfileId: input.currentCustomerProfileId,
      });

    if (existingCivilIdCustomer) {
      throw AppError.customerCivilIdAlreadyExists(undefined, {
        field: 'civil_id',
      });
    }
  }

  private async cleanupCreatedAuthUser(authUserId: string): Promise<void> {
    try {
      await this.supabaseAuthRepository.deleteAuthUser({
        authUserId,
        shouldSoftDelete: false,
      });
    } catch {
      // Best-effort rollback only. The original customer creation error must remain authoritative.
    }
  }
}
