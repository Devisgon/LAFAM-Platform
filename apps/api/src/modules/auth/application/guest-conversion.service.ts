// apps/api/src/modules/auth/application/guest-conversion.service.ts
/**
 * LAFAM guest conversion service.
 *
 * Role:
 * - Owns guest-to-customer conversion.
 * - Preserves the existing guest app user where possible.
 * - Starts email verification through Supabase anonymous-user conversion.
 * - Supports completion after email verification.
 *
 * Important:
 * - Guest conversion always produces a customer account state.
 * - Guest conversion must never allow role escalation.
 * - Raw access tokens, refresh tokens, passwords, and OTPs must never be logged.
 * - The controller must provide the current guest access/refresh tokens because Supabase
 *   requires the anonymous session to update the anonymous user into an email/password user.
 */

import { Injectable } from '@nestjs/common';

import { AppError, isAppError } from '../../../common/errors/app-error';
import {
  AUTH_ERROR_DETAIL_KEYS,
  AUTH_ERROR_REASON_PASSWORD_CONFIRMATION_MISMATCH,
  AUTH_ERROR_REASON_PASSWORD_POLICY_FAILED,
} from '../constants/auth-error.constants';
import { AUTH_GUEST_ROLE } from '../constants/auth-role.constants';
import {
  AUTH_AUDIT_EVENT_GUEST_CONVERSION_COMPLETED,
  AUTH_AUDIT_EVENT_GUEST_CONVERSION_FAILED,
  AUTH_AUDIT_EVENT_GUEST_CONVERSION_STARTED,
  AUTH_SESSION_TYPE_GUEST,
  AUTH_USER_STATUS_GUEST_ACTIVE,
} from '../constants/auth.constants';
import { AuthAuditRepository } from '../repositories/auth-audit.repository';
import { AuthUserRepository } from '../repositories/auth-user.repository';
import { GuestSessionRepository } from '../repositories/guest-session.repository';
import { SupabaseAuthRepository } from '../repositories/supabase-auth.repository';
import type { AuthInternalContext } from '../types/auth-context.types';
import type { AuthGuestConversionResponse } from '../types/auth-response.types';
import type { AuthSafeUserResponse } from '../types/auth-user.types';
import type {
  GuestConversionCompletionInput,
  GuestConversionCompletionResult,
} from '../types/guest-session.types';
import {
  getAuthPasswordPolicyFailureCodes,
  validateAuthPasswordAndConfirmation,
} from '../utils/password-policy.util';

export interface GuestConversionServiceRequestMetadata {
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

export interface GuestConversionTokenInput {
  readonly accessToken: string;
  readonly refreshToken: string;
}

export interface ConvertGuestToCustomerDtoLike {
  readonly full_name: string;
  readonly email: string;
  readonly phone?: string | null;
  readonly password: string;
  readonly confirm_password: string;
  readonly timezone?: string | null;
}

const EMPTY_REQUEST_METADATA: GuestConversionServiceRequestMetadata = {
  ipAddress: null,
  userAgent: null,
};

function isIsoDateExpired(value: string | null, now = new Date()): boolean {
  if (!value) {
    return true;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return true;
  }

  return parsedDate.getTime() <= now.getTime();
}

function assertContextIsConvertibleGuest(auth: AuthInternalContext): void {
  if (
    auth.profile.role !== AUTH_GUEST_ROLE ||
    auth.profile.status !== AUTH_USER_STATUS_GUEST_ACTIVE ||
    !auth.profile.isGuest ||
    auth.session.sessionType !== AUTH_SESSION_TYPE_GUEST
  ) {
    throw AppError.guestSessionRequired(
      'A valid guest session is required for guest conversion.',
    );
  }

  if (auth.session.revokedAt) {
    throw AppError.guestSessionRevoked('The guest session has been revoked.');
  }

  if (auth.session.convertedAt) {
    throw AppError.guestAlreadyConverted(
      'The guest session has already been converted.',
    );
  }

  if (
    isIsoDateExpired(auth.session.expiresAt) ||
    isIsoDateExpired(auth.profile.guestExpiresAt)
  ) {
    throw AppError.guestSessionExpired('The guest session has expired.');
  }
}

function assertPasswordAllowed(dto: ConvertGuestToCustomerDtoLike): void {
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
    'The password does not meet security requirements.',
    {
      [AUTH_ERROR_DETAIL_KEYS.reason]: AUTH_ERROR_REASON_PASSWORD_POLICY_FAILED,
      failures: result.failures,
    },
  );
}

function mapSafeUserToGuestConversionResponse(
  user: AuthSafeUserResponse,
): AuthGuestConversionResponse {
  return {
    user,
    email_verification_required: true,
    guest_converted: true,
  };
}

@Injectable()
export class GuestConversionService {
  constructor(
    private readonly supabaseAuthRepository: SupabaseAuthRepository,
    private readonly authUserRepository: AuthUserRepository,
    private readonly guestSessionRepository: GuestSessionRepository,
    private readonly authAuditRepository: AuthAuditRepository,
  ) {}

  async convertGuestToCustomer(
    auth: AuthInternalContext,
    dto: ConvertGuestToCustomerDtoLike,
    tokens: GuestConversionTokenInput,
    request: GuestConversionServiceRequestMetadata = EMPTY_REQUEST_METADATA,
  ): Promise<AuthGuestConversionResponse> {
    assertContextIsConvertibleGuest(auth);
    assertPasswordAllowed(dto);

    try {
      const providerResult =
        await this.supabaseAuthRepository.convertAnonymousGuestToEmailPassword({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          email: dto.email,
          password: dto.password,
          fullName: dto.full_name,
          phone: dto.phone ?? null,
          timezone: dto.timezone ?? null,
        });

      if (providerResult.user.id !== auth.profile.authUserId) {
        throw AppError.guestConversionFailed(
          new Error(
            'Converted provider user did not match current guest user.',
          ),
        );
      }

      const convertedAt = new Date().toISOString();

      const user =
        await this.guestSessionRepository.convertGuestUserToCustomerById({
          userId: auth.profile.id,
          email: dto.email,
          phone: dto.phone ?? null,
          fullName: dto.full_name,
          timezone: dto.timezone ?? null,
          convertedFromGuestAt: convertedAt,
        });

      await this.guestSessionRepository.markGuestSessionConverted({
        sessionId: auth.session.id,
        convertedAt,
      });

      await this.authAuditRepository.createEvent({
        actorUserId: user.id,
        targetUserId: user.id,
        eventType: AUTH_AUDIT_EVENT_GUEST_CONVERSION_STARTED,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        metadata: {
          email: dto.email,
          session_id: auth.session.id,
          converted_from_guest_at: convertedAt,
        },
      });

      return mapSafeUserToGuestConversionResponse(user);
    } catch (error) {
      await this.writeGuestConversionFailedAudit(auth, dto.email, request);

      if (isAppError(error)) {
        throw error;
      }

      throw AppError.guestConversionFailed(error);
    }
  }

  async completeGuestConversion(
    input: GuestConversionCompletionInput,
    request: GuestConversionServiceRequestMetadata = EMPTY_REQUEST_METADATA,
  ): Promise<GuestConversionCompletionResult> {
    const user = await this.authUserRepository.activateByAuthUserId({
      authUserId: input.authUserId,
      email: input.email,
    });

    await this.authAuditRepository.createEvent({
      actorUserId: user.id,
      targetUserId: user.id,
      eventType: AUTH_AUDIT_EVENT_GUEST_CONVERSION_COMPLETED,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      metadata: {
        email: input.email,
        completed_at: input.completedAt,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        full_name: user.fullName,
        role: user.role,
        status: user.status,
        is_guest: user.isGuest,
        avatar_path: user.avatarPath,
        timezone: user.timezone,
        created_at: user.createdAt,
        updated_at: user.updatedAt,
      },
      completedAt: input.completedAt,
    };
  }

  private async writeGuestConversionFailedAudit(
    auth: AuthInternalContext,
    email: string,
    request: GuestConversionServiceRequestMetadata,
  ): Promise<void> {
    try {
      await this.authAuditRepository.createEvent({
        actorUserId: auth.profile.id,
        targetUserId: auth.profile.id,
        eventType: AUTH_AUDIT_EVENT_GUEST_CONVERSION_FAILED,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        metadata: {
          email,
          session_id: auth.session.id,
        },
      });
    } catch (auditError) {
      void auditError;
    }
  }
}
