// apps/api/src/modules/auth/application/auth-profile.service.ts
/**
 * LAFAM Auth profile service.
 *
 * Role:
 * - Owns protected self-profile operations.
 * - Returns the current authenticated user profile.
 * - Updates safe self-service profile fields.
 * - Changes password after verifying the current password.
 * - Soft-deletes the current user account and revokes active sessions.
 *
 * Important:
 * - AuthGuard must resolve and attach Auth context before this service is used.
 * - ActiveSessionGuard must reject revoked/expired/deleted/deactivated sessions before controller access.
 * - Guest users cannot use customer profile mutation, password change, or delete-account flows.
 * - Passwords and tokens must never be logged or written to audit metadata.
 */

import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import {
  AUTH_ERROR_DETAIL_KEYS,
  AUTH_ERROR_REASON_PASSWORD_CONFIRMATION_MISMATCH,
  AUTH_ERROR_REASON_PASSWORD_POLICY_FAILED,
} from '../constants/auth-error.constants';
import {
  AUTH_AUDIT_EVENT_ACCOUNT_DELETED,
  AUTH_AUDIT_EVENT_PASSWORD_CHANGED,
  AUTH_AUDIT_EVENT_PROFILE_UPDATED,
  AUTH_SESSION_REVOCATION_REASON_ACCOUNT_DELETED,
  AUTH_SESSION_REVOCATION_REASON_PASSWORD_CHANGED,
} from '../constants/auth.constants';
import type { ChangePasswordDto } from '../dto/change-password.dto';
import type { UpdateProfileDto } from '../dto/update-profile.dto';
import { AuthAuditRepository } from '../repositories/auth-audit.repository';
import { AuthSessionRepository } from '../repositories/auth-session.repository';
import { AuthUserRepository } from '../repositories/auth-user.repository';
import { SupabaseAuthRepository } from '../repositories/supabase-auth.repository';
import type { AuthInternalContext } from '../types/auth-context.types';
import type {
  AuthChangePasswordResponse,
  AuthCurrentUserResponse,
  AuthDeleteAccountResponse,
  AuthUpdateProfileResponse,
} from '../types/auth-response.types';
import type {
  AuthSafeUserResponse,
  AuthUserInternalProfile,
} from '../types/auth-user.types';
import {
  getAuthPasswordPolicyFailureCodes,
  validateAuthPasswordAndConfirmation,
} from '../utils/password-policy.util';

export interface AuthProfileServiceRequestMetadata {
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

const EMPTY_REQUEST_METADATA: AuthProfileServiceRequestMetadata = {
  ipAddress: null,
  userAgent: null,
};

function mapInternalProfileToSafeUserResponse(
  profile: AuthUserInternalProfile,
): AuthSafeUserResponse {
  return {
    id: profile.id,
    email: profile.email,
    phone: profile.phone,
    full_name: profile.fullName,
    role: profile.role,
    status: profile.status,
    is_guest: profile.isGuest,
    avatar_path: profile.avatarPath,
    timezone: profile.timezone,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
  };
}

function assertNotGuestProfile(auth: AuthInternalContext): void {
  if (!auth.profile.isGuest) {
    return;
  }

  throw AppError.guestCannotAccessResource(
    'Guest users must create an account before using this profile action.',
  );
}

function assertUserHasEmail(
  auth: AuthInternalContext,
): asserts auth is AuthInternalContext & {
  readonly profile: AuthUserInternalProfile & { readonly email: string };
} {
  if (auth.profile.email) {
    return;
  }

  throw AppError.invalidCredentials(
    'A verified email account is required for this action.',
  );
}

function assertPasswordAllowed(
  dto: Pick<ChangePasswordDto, 'password' | 'confirm_password'>,
  auth: AuthInternalContext,
): void {
  const result = validateAuthPasswordAndConfirmation(
    dto.password,
    dto.confirm_password,
    {
      email: auth.profile.email,
      fullName: auth.profile.fullName,
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
    'The password does not meet security requirements.',
    {
      [AUTH_ERROR_DETAIL_KEYS.reason]: AUTH_ERROR_REASON_PASSWORD_POLICY_FAILED,
      failures: result.failures,
    },
  );
}

function buildUpdateProfileInput(
  auth: AuthInternalContext,
  dto: UpdateProfileDto,
): {
  readonly userId: string;
  readonly profile: {
    readonly phone?: string | null;
    readonly fullName?: string | null;
    readonly timezone?: string | null;
  };
} {
  return {
    userId: auth.profile.id,
    profile: {
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      ...(dto.full_name !== undefined ? { fullName: dto.full_name } : {}),
      ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
    },
  };
}

@Injectable()
export class AuthProfileService {
  constructor(
    private readonly supabaseAuthRepository: SupabaseAuthRepository,
    private readonly authUserRepository: AuthUserRepository,
    private readonly authSessionRepository: AuthSessionRepository,
    private readonly authAuditRepository: AuthAuditRepository,
  ) {}

  getCurrentUser(auth: AuthInternalContext): AuthCurrentUserResponse {
    return {
      user: mapInternalProfileToSafeUserResponse(auth.profile),
    };
  }

  async updateProfile(
    auth: AuthInternalContext,
    dto: UpdateProfileDto,
    request: AuthProfileServiceRequestMetadata = EMPTY_REQUEST_METADATA,
  ): Promise<AuthUpdateProfileResponse> {
    assertNotGuestProfile(auth);

    const updatedProfile = await this.authUserRepository.updateProfileById(
      buildUpdateProfileInput(auth, dto),
    );

    await this.authAuditRepository.createEvent({
      actorUserId: auth.profile.id,
      targetUserId: auth.profile.id,
      eventType: AUTH_AUDIT_EVENT_PROFILE_UPDATED,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      metadata: {
        updated_fields: {
          phone: dto.phone !== undefined,
          full_name: dto.full_name !== undefined,
          timezone: dto.timezone !== undefined,
        },
      },
    });

    return {
      user: mapInternalProfileToSafeUserResponse(updatedProfile),
    };
  }

  async changePassword(
    auth: AuthInternalContext,
    dto: ChangePasswordDto,
    request: AuthProfileServiceRequestMetadata = EMPTY_REQUEST_METADATA,
  ): Promise<AuthChangePasswordResponse> {
    assertNotGuestProfile(auth);
    assertUserHasEmail(auth);
    assertPasswordAllowed(dto, auth);

    await this.verifyCurrentPassword(auth, dto.current_password);

    await this.supabaseAuthRepository.updateAuthUserPassword({
      authUserId: auth.profile.authUserId,
      password: dto.password,
    });

    const changedAt = new Date().toISOString();

    await this.authSessionRepository.revokeAllForUser({
      userId: auth.profile.id,
      revokedAt: changedAt,
      revokedReason: AUTH_SESSION_REVOCATION_REASON_PASSWORD_CHANGED,
    });

    await this.authAuditRepository.createEvent({
      actorUserId: auth.profile.id,
      targetUserId: auth.profile.id,
      eventType: AUTH_AUDIT_EVENT_PASSWORD_CHANGED,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      metadata: {
        changed_at: changedAt,
      },
    });

    return {
      password_changed: true,
      sessions_revoked: true,
    };
  }

  async deleteAccount(
    auth: AuthInternalContext,
    request: AuthProfileServiceRequestMetadata = EMPTY_REQUEST_METADATA,
  ): Promise<AuthDeleteAccountResponse> {
    assertNotGuestProfile(auth);

    const deletedAt = new Date().toISOString();

    await this.authUserRepository.softDeleteById({
      userId: auth.profile.id,
      deletedAt,
    });

    await this.authSessionRepository.revokeAllForUser({
      userId: auth.profile.id,
      revokedAt: deletedAt,
      revokedReason: AUTH_SESSION_REVOCATION_REASON_ACCOUNT_DELETED,
    });

    await this.authAuditRepository.createEvent({
      actorUserId: auth.profile.id,
      targetUserId: auth.profile.id,
      eventType: AUTH_AUDIT_EVENT_ACCOUNT_DELETED,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      metadata: {
        deleted_at: deletedAt,
      },
    });

    return {
      account_deleted: true,
      user_id: auth.profile.id,
    };
  }

  private async verifyCurrentPassword(
    auth: AuthInternalContext & {
      readonly profile: AuthUserInternalProfile & { readonly email: string };
    },
    currentPassword: string,
  ): Promise<void> {
    try {
      await this.supabaseAuthRepository.signInWithPassword({
        email: auth.profile.email,
        password: currentPassword,
      });
    } catch {
      throw AppError.invalidCredentials('The current password is incorrect.');
    }
  }
}
