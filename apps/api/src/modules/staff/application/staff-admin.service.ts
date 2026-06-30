// apps/api/src/modules/staff/application/staff-admin.service.ts
// apps/api/src/modules/staff/application/staff-admin.service.ts
/**
 * LAFAM Staff admin service.
 *
 * Role:
 * - Owns Staff Module business rules for staff/trainer records.
 * - Allows admin and super-admin users to manage staff/trainer records.
 * - Allows staff and trainer users to read staff/trainer directory records.
 * - Coordinates Supabase Auth staff user creation with staff profile creation.
 * - Converts database/auth repository results into safe API response objects.
 *
 * Important:
 * - This service does not expose passwords.
 * - This service does not log passwords, OTPs, access tokens, or refresh tokens.
 * - Admin-created staff users are created as active/verified users and do not require email OTP verification.
 * - Staff profile data stays separate from Auth identity data.
 * - Staff deletion is soft-delete by default.
 * - Staff/trainer read responses include availability through the existing staff availability mapper.
 * - Staff and trainer users must not be allowed to create, update, deactivate, reactivate, delete,
 *   or replace availability through this service.
 */

import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import type { DatabaseJsonObject } from '../../../database/database.types';
import {
  AUTH_ERROR_DETAIL_KEYS,
  AUTH_ERROR_REASON_PASSWORD_CONFIRMATION_MISMATCH,
  AUTH_ERROR_REASON_PASSWORD_POLICY_FAILED,
} from '../../auth/constants/auth-error.constants';
import {
  AUTH_USER_STATUS_ACTIVE,
  AUTH_USER_STATUS_PENDING_EMAIL_VERIFICATION,
} from '../../auth/constants/auth.constants';
import { SupabaseAuthRepository } from '../../auth/repositories/supabase-auth.repository';
import { EmailNotificationService } from '../../notifications/application/email-notification.service';
import {
  EMAIL_NOTIFICATION_ENTITY_TYPE_STAFF_PROFILE,
  EMAIL_NOTIFICATION_EVENT_TRAINER_ACCOUNT_CREATED_WITH_PASSWORD,
  EMAIL_NOTIFICATION_EVENT_TRAINER_AVAILABILITY_UPDATED,
  EMAIL_RECIPIENT_ROLE_STAFF,
  EMAIL_RECIPIENT_ROLE_TRAINER,
} from '../../notifications/constants/notification.constants';
import { createEntityEmailIdempotencyKey } from '../../notifications/domain/email-idempotency.policy';
import type {
  EmailNotificationEvent,
  EmailRecipient,
} from '../../notifications/types/notification.types';
import type { AuthInternalContext } from '../../auth/types/auth-context.types';
import {
  getAuthPasswordPolicyFailureCodes,
  validateAuthPasswordAndConfirmation,
} from '../../auth/utils/password-policy.util';
import {
  STAFF_AUTH_METADATA_SOURCE_ADMIN_STAFF_CREATE,
  STAFF_DEFAULT_AVAILABILITY_IS_AVAILABLE,
  STAFF_LIST_DEFAULT_LIMIT,
  STAFF_LIST_DEFAULT_OFFSET,
  STAFF_PORTAL_ROLE_TRAINER,
  STAFF_PROFILE_STATUS_AVAILABLE,
  isStaffAdminManagementRole,
  isStaffDayOfWeek,
  isStaffPortalRole,
  type StaffDayOfWeek,
  type StaffPortalRole,
} from '../constants/staff.constants';
import type { CreateStaffDto } from '../dto/create-staff.dto';
import type { ListStaffQueryDto } from '../dto/list-staff-query.dto';
import type { UpdateStaffAvailabilityDto } from '../dto/update-staff-availability.dto';
import type { UpdateStaffDto } from '../dto/update-staff.dto';
import { StaffRepository } from '../repositories/staff.repository';
import type {
  SafeStaffAvailabilityRule,
  SafeStaffProfile,
  StaffAvailabilityRuleInput,
  StaffDeleteResult,
  StaffListQuery,
  StaffListResult,
  StaffMutationResult,
  StaffProfileWithUser,
} from '../types/staff.types';

function resolveAdminActorId(auth: AuthInternalContext): string {
  if (!isStaffAdminManagementRole(auth.profile.role)) {
    throw AppError.adminAccessRequired(
      'Admin access is required to manage staff.',
    );
  }

  return auth.profile.id;
}

function resolveStaffReadActorId(auth: AuthInternalContext): string {
  if (
    isStaffAdminManagementRole(auth.profile.role) ||
    isStaffPortalRole(auth.profile.role)
  ) {
    return auth.profile.id;
  }

  throw AppError.adminAccessRequired(
    'Staff directory read access is required to view staff records.',
  );
}

function resolveStaffPortalRole(value: string): StaffPortalRole {
  if (isStaffPortalRole(value)) {
    return value;
  }

  throw AppError.staffRoleNotAllowed(
    'The stored staff role is not allowed for Staff Module operations.',
    {
      role: value,
    },
  );
}

function resolveStaffDayOfWeek(value: number): StaffDayOfWeek {
  if (isStaffDayOfWeek(value)) {
    return value;
  }

  throw AppError.staffAvailabilityInvalid(
    'The stored staff availability day is invalid.',
    {
      day_of_week: value,
    },
  );
}

function assertStaffTimeWindowAllowed(
  startTime: string,
  endTime: string,
): void {
  if (startTime < endTime) {
    return;
  }

  throw AppError.staffAvailabilityInvalid(
    'end_time must be later than start_time.',
    {
      start_time: startTime,
      end_time: endTime,
    },
  );
}

function assertAvailabilityRulesAllowed(
  availability: readonly StaffAvailabilityRuleInput[],
): void {
  const daySet = new Set<StaffDayOfWeek>();

  for (const rule of availability) {
    if (!isStaffDayOfWeek(rule.day_of_week)) {
      throw AppError.staffAvailabilityInvalid(
        'day_of_week must be between 0 and 6.',
        {
          day_of_week: rule.day_of_week,
        },
      );
    }

    if (daySet.has(rule.day_of_week)) {
      throw AppError.staffAvailabilityInvalid(
        'availability must not contain duplicate day_of_week values.',
        {
          day_of_week: rule.day_of_week,
        },
      );
    }

    assertStaffTimeWindowAllowed(rule.start_time, rule.end_time);
    daySet.add(rule.day_of_week);
  }
}

function buildPasswordFailureDetails(
  failures: readonly unknown[],
  failureCodes: readonly string[],
): Record<string, unknown> {
  return {
    [AUTH_ERROR_DETAIL_KEYS.reason]: failureCodes.includes(
      AUTH_ERROR_REASON_PASSWORD_CONFIRMATION_MISMATCH,
    )
      ? AUTH_ERROR_REASON_PASSWORD_CONFIRMATION_MISMATCH
      : AUTH_ERROR_REASON_PASSWORD_POLICY_FAILED,
    failures,
  };
}

function assertStaffPasswordAllowed(dto: CreateStaffDto): void {
  const result = validateAuthPasswordAndConfirmation(
    dto.password,
    dto.confirm_password,
    {
      email: dto.email,
      fullName: dto.display_name,
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

  throw AppError.staffPasswordInvalid(
    'The staff password does not meet security requirements.',
    buildPasswordFailureDetails(result.failures, failureCodes),
  );
}

function buildAvailabilityFromCreateDto(
  dto: CreateStaffDto,
): readonly StaffAvailabilityRuleInput[] {
  return dto.working_days.map((dayOfWeek) => ({
    day_of_week: dayOfWeek,
    start_time: dto.start_time,
    end_time: dto.end_time,
    is_available: STAFF_DEFAULT_AVAILABILITY_IS_AVAILABLE,
  }));
}

function buildAvailabilityFromUpdateDto(
  dto: UpdateStaffAvailabilityDto,
): readonly StaffAvailabilityRuleInput[] {
  return dto.availability.map((rule) => ({
    day_of_week: rule.day_of_week,
    start_time: rule.start_time,
    end_time: rule.end_time,
    is_available: rule.is_available ?? STAFF_DEFAULT_AVAILABILITY_IS_AVAILABLE,
  }));
}

function mapAvailabilityRuleToSafeResponse(
  rule: StaffProfileWithUser['availability'][number],
): SafeStaffAvailabilityRule {
  return {
    id: rule.id,
    day_of_week: resolveStaffDayOfWeek(rule.day_of_week),
    start_time: rule.start_time,
    end_time: rule.end_time,
    is_available: rule.is_available,
    created_at: rule.created_at,
    updated_at: rule.updated_at,
  };
}

function resolveStaffEmail(value: string | null): string {
  if (value) {
    return value;
  }

  throw AppError.staffNotFound('The related staff user email was not found.');
}

function mapStaffToSafeResponse(staff: StaffProfileWithUser): SafeStaffProfile {
  return {
    id: staff.profile.id,
    app_user_id: staff.app_user.id,
    auth_user_id: staff.app_user.auth_user_id,
    email: resolveStaffEmail(staff.app_user.email),
    phone: staff.app_user.phone,
    display_name: staff.profile.display_name,
    portal_role: resolveStaffPortalRole(staff.app_user.role),
    post_title: staff.profile.post_title,
    address: staff.profile.address,
    bio: staff.profile.bio,
    specialties: staff.profile.specialties,
    staff_status: staff.profile.status,
    auth_status: staff.app_user.status,
    email_verification_required:
      staff.app_user.status === AUTH_USER_STATUS_PENDING_EMAIL_VERIFICATION,
    availability: staff.availability.map(mapAvailabilityRuleToSafeResponse),
    created_at: staff.profile.created_at,
    updated_at: staff.profile.updated_at,
    deactivated_at: staff.profile.deactivated_at,
    deleted_at: staff.profile.deleted_at,
  };
}

function buildStaffListQuery(dto: ListStaffQueryDto): StaffListQuery {
  return {
    ...(dto.search !== undefined ? { search: dto.search } : {}),
    ...(dto.portal_role !== undefined ? { portal_role: dto.portal_role } : {}),
    ...(dto.staff_status !== undefined
      ? { staff_status: dto.staff_status }
      : {}),
    ...(dto.auth_status !== undefined ? { auth_status: dto.auth_status } : {}),
    include_deleted: dto.include_deleted ?? false,
    limit: dto.limit ?? STAFF_LIST_DEFAULT_LIMIT,
    offset: dto.offset ?? STAFF_LIST_DEFAULT_OFFSET,
  };
}

function hasObjectKeys(value: Record<string, unknown>): boolean {
  return Object.keys(value).length > 0;
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function addOptionalTemplateString(
  target: DatabaseJsonObject,
  key: string,
  value: string | null | undefined,
): void {
  const normalizedValue = normalizeOptionalText(value);

  if (normalizedValue) {
    target[key] = normalizedValue;
  }
}

function resolveStaffEmailRecipientRole(
  staff: StaffProfileWithUser,
): typeof EMAIL_RECIPIENT_ROLE_TRAINER | typeof EMAIL_RECIPIENT_ROLE_STAFF {
  const portalRole = resolveStaffPortalRole(staff.app_user.role);

  return portalRole === STAFF_PORTAL_ROLE_TRAINER
    ? EMAIL_RECIPIENT_ROLE_TRAINER
    : EMAIL_RECIPIENT_ROLE_STAFF;
}

function createStaffEmailRecipient(
  staff: StaffProfileWithUser,
): EmailRecipient | null {
  const email = normalizeOptionalText(staff.app_user.email);

  if (!email) {
    return null;
  }

  return {
    role: resolveStaffEmailRecipientRole(staff),
    email,
    name: staff.profile.display_name,
    appUserId: staff.app_user.id,
  };
}

function buildStaffEmailTemplateData(
  staff: StaffProfileWithUser,
): DatabaseJsonObject {
  const templateData: DatabaseJsonObject = {};

  addOptionalTemplateString(
    templateData,
    'recipientName',
    staff.profile.display_name,
  );
  addOptionalTemplateString(
    templateData,
    'trainerName',
    staff.profile.display_name,
  );
  addOptionalTemplateString(
    templateData,
    'postTitle',
    staff.profile.post_title,
  );
  addOptionalTemplateString(templateData, 'portalRole', staff.app_user.role);

  return templateData;
}

function buildStaffEmailMetadata(input: {
  readonly staff: StaffProfileWithUser;
  readonly adminUserId?: string | null;
}): DatabaseJsonObject {
  return {
    staff_profile_id: input.staff.profile.id,
    app_user_id: input.staff.app_user.id,
    portal_role: input.staff.app_user.role,
    post_title: input.staff.profile.post_title,
    availability_rule_count: input.staff.availability.length,
    ...(input.adminUserId
      ? {
          updated_by_admin_id: input.adminUserId,
        }
      : {}),
  };
}

@Injectable()
export class StaffAdminService {
  constructor(
    private readonly staffRepository: StaffRepository,
    private readonly supabaseAuthRepository: SupabaseAuthRepository,
    private readonly emailNotificationService: EmailNotificationService,
  ) {}

  async listStaff(
    auth: AuthInternalContext,
    dto: ListStaffQueryDto,
  ): Promise<StaffListResult> {
    resolveStaffReadActorId(auth);

    const result = await this.staffRepository.listStaff(
      buildStaffListQuery(dto),
    );

    return {
      staff: result.staff.map(mapStaffToSafeResponse),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    };
  }

  async getStaffById(
    auth: AuthInternalContext,
    staffId: string,
  ): Promise<StaffMutationResult> {
    resolveStaffReadActorId(auth);

    const staff = await this.staffRepository.getById({
      staffProfileId: staffId,
    });

    return {
      staff: mapStaffToSafeResponse(staff),
    };
  }

  async createStaff(
    auth: AuthInternalContext,
    dto: CreateStaffDto,
  ): Promise<StaffMutationResult> {
    const adminUserId = resolveAdminActorId(auth);

    assertStaffPasswordAllowed(dto);

    const availability = buildAvailabilityFromCreateDto(dto);
    assertAvailabilityRulesAllowed(availability);

    const emailExists = await this.staffRepository.emailExists({
      email: dto.email,
    });

    if (emailExists) {
      throw AppError.staffEmailAlreadyExists(
        'A staff account with this email already exists.',
      );
    }

    const authUserResult =
      await this.supabaseAuthRepository.createStaffAuthUserWithPassword({
        email: dto.email,
        password: dto.password,
        displayName: dto.display_name,
        phone: dto.phone ?? null,
        portalRole: dto.portal_role,
        createdByAdminId: adminUserId,
      });

    try {
      const staff = await this.staffRepository.createStaff({
        app_user: {
          auth_user_id: authUserResult.user.id,
          email: dto.email,
          phone: dto.phone ?? null,
          full_name: dto.display_name,
          role: dto.portal_role,
          status: AUTH_USER_STATUS_ACTIVE,
          is_guest: false,
          metadata: {
            source: STAFF_AUTH_METADATA_SOURCE_ADMIN_STAFF_CREATE,
            created_by_admin_id: adminUserId,
            portal_role: dto.portal_role,
          },
        },
        staff_profile: {
          display_name: dto.display_name,
          address: dto.address ?? null,
          post_title: dto.post_title,
          bio: dto.bio ?? null,
          specialties: dto.specialties ?? [],
          status: dto.status ?? STAFF_PROFILE_STATUS_AVAILABLE,
          created_by_admin_id: adminUserId,
          updated_by_admin_id: adminUserId,
        },
        availability,
      });

      await this.notifyTrainerAccountCreatedWithPassword({
        staff,
        adminUserId,
      });

      return {
        staff: mapStaffToSafeResponse(staff),
      };
    } catch (error) {
      await this.cleanupCreatedAuthUser(authUserResult.user.id);
      throw error;
    }
  }

  async updateStaff(
    auth: AuthInternalContext,
    staffId: string,
    dto: UpdateStaffDto,
  ): Promise<StaffMutationResult> {
    const adminUserId = resolveAdminActorId(auth);

    const profileUpdate: Record<string, unknown> = {};
    const appUserUpdate: {
      phone?: string | null;
      full_name?: string | null;
    } = {};

    if (dto.display_name !== undefined) {
      profileUpdate.display_name = dto.display_name;
      appUserUpdate.full_name = dto.display_name;
    }

    if (dto.phone !== undefined) {
      appUserUpdate.phone = dto.phone;
    }

    if (dto.address !== undefined) {
      profileUpdate.address = dto.address;
    }

    if (dto.post_title !== undefined) {
      profileUpdate.post_title = dto.post_title;
    }

    if (dto.specialties !== undefined) {
      profileUpdate.specialties = dto.specialties;
    }

    if (dto.bio !== undefined) {
      profileUpdate.bio = dto.bio;
    }

    if (dto.status !== undefined) {
      profileUpdate.status = dto.status;
    }

    if (!hasObjectKeys(profileUpdate) && !hasObjectKeys(appUserUpdate)) {
      throw AppError.staffEmptyUpdate(
        'At least one staff field must be provided for update.',
      );
    }

    const staff = await this.staffRepository.updateStaff({
      staff_profile_id: staffId,
      updated_by_admin_id: adminUserId,
      profile_update: profileUpdate,
      app_user_update: hasObjectKeys(appUserUpdate) ? appUserUpdate : undefined,
    });

    return {
      staff: mapStaffToSafeResponse(staff),
    };
  }

  async replaceStaffAvailability(
    auth: AuthInternalContext,
    staffId: string,
    dto: UpdateStaffAvailabilityDto,
  ): Promise<StaffMutationResult> {
    resolveAdminActorId(auth);

    const availability = buildAvailabilityFromUpdateDto(dto);
    assertAvailabilityRulesAllowed(availability);

    const staff = await this.staffRepository.replaceAvailability({
      staff_profile_id: staffId,
      availability,
    });

    await this.notifyTrainerAvailabilityUpdated(staff);

    return {
      staff: mapStaffToSafeResponse(staff),
    };
  }

  async deactivateStaff(
    auth: AuthInternalContext,
    staffId: string,
  ): Promise<StaffMutationResult> {
    const adminUserId = resolveAdminActorId(auth);

    const staff = await this.staffRepository.deactivateStaff({
      staff_profile_id: staffId,
      updated_by_admin_id: adminUserId,
      deactivated_at: new Date().toISOString(),
    });

    return {
      staff: mapStaffToSafeResponse(staff),
    };
  }

  async reactivateStaff(
    auth: AuthInternalContext,
    staffId: string,
  ): Promise<StaffMutationResult> {
    const adminUserId = resolveAdminActorId(auth);

    const staff = await this.staffRepository.reactivateStaff({
      staff_profile_id: staffId,
      updated_by_admin_id: adminUserId,
    });

    return {
      staff: mapStaffToSafeResponse(staff),
    };
  }

  async deleteStaff(
    auth: AuthInternalContext,
    staffId: string,
  ): Promise<StaffDeleteResult> {
    const adminUserId = resolveAdminActorId(auth);

    await this.staffRepository.softDeleteStaff({
      staff_profile_id: staffId,
      updated_by_admin_id: adminUserId,
      deleted_at: new Date().toISOString(),
    });

    return {
      deleted: true,
      staff_id: staffId,
    };
  }

  private async createStaffEmailNotificationBestEffort(input: {
    readonly eventType: EmailNotificationEvent;
    readonly staff: StaffProfileWithUser;
    readonly adminUserId?: string | null;
    readonly scope?: string | null;
  }): Promise<void> {
    try {
      const recipient = createStaffEmailRecipient(input.staff);

      if (!recipient) {
        return;
      }

      await this.emailNotificationService.createFromTemplate({
        eventType: input.eventType,
        recipient,
        templateData: buildStaffEmailTemplateData(input.staff),
        entity: {
          entityType: EMAIL_NOTIFICATION_ENTITY_TYPE_STAFF_PROFILE,
          entityId: input.staff.profile.id,
        },
        idempotencyKey: createEntityEmailIdempotencyKey({
          eventType: input.eventType,
          recipientRole: recipient.role,
          recipientEmail: recipient.email,
          recipientAppUserId: recipient.appUserId ?? null,
          entityType: EMAIL_NOTIFICATION_ENTITY_TYPE_STAFF_PROFILE,
          entityId: input.staff.profile.id,
          scope: input.scope ?? null,
        }),
        metadata: buildStaffEmailMetadata({
          staff: input.staff,
          adminUserId: input.adminUserId ?? null,
        }),
      });
    } catch {
      // Best-effort notification side effect. The committed staff mutation remains authoritative.
    }
  }

  private async notifyTrainerAccountCreatedWithPassword(input: {
    readonly staff: StaffProfileWithUser;
    readonly adminUserId: string;
  }): Promise<void> {
    await this.createStaffEmailNotificationBestEffort({
      eventType: EMAIL_NOTIFICATION_EVENT_TRAINER_ACCOUNT_CREATED_WITH_PASSWORD,
      staff: input.staff,
      adminUserId: input.adminUserId,
    });
  }

  private async notifyTrainerAvailabilityUpdated(
    staff: StaffProfileWithUser,
  ): Promise<void> {
    await this.createStaffEmailNotificationBestEffort({
      eventType: EMAIL_NOTIFICATION_EVENT_TRAINER_AVAILABILITY_UPDATED,
      staff,
      scope: `updated:${staff.profile.updated_at}`,
    });
  }

  private async cleanupCreatedAuthUser(authUserId: string): Promise<void> {
    try {
      await this.supabaseAuthRepository.deleteAuthUser({
        authUserId,
        shouldSoftDelete: false,
      });
    } catch {
      // Best-effort rollback only. The original staff creation error must remain authoritative.
    }
  }
}
