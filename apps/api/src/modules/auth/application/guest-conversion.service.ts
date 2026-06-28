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
 * - Guest conversion requires full name, email, phone, Civil ID, password, and password confirmation.
 * - Guest conversion must never allow role escalation.
 * - Raw access tokens, refresh tokens, passwords, OTPs, and Civil ID values must never be logged.
 * - The controller must provide the current guest access/refresh tokens because Supabase
 *   requires the anonymous session to update the anonymous user into an email/password user.
 */

import { Injectable, Optional } from '@nestjs/common';

import { AppError, isAppError } from '../../../common/errors/app-error';
import { CustomerRepository } from '../../customers/repositories/customer.repository';
import { normalizeAuthCivilIdNormalized } from '../utils/auth-normalization.util';
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
  readonly phone: string;
  readonly civil_id: string;
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

function resolveRequiredCivilIdNormalized(civilId: string): string {
  const civilIdNormalized = normalizeAuthCivilIdNormalized(civilId);

  if (!civilIdNormalized) {
    throw AppError.validationFailed(
      'civil_id must contain exactly 12 digits and may include spaces or hyphens.',
      {
        field: 'civil_id',
      },
    );
  }

  return civilIdNormalized;
}

@Injectable()
export class GuestConversionService {
  constructor(
    private readonly supabaseAuthRepository: SupabaseAuthRepository,
    private readonly authUserRepository: AuthUserRepository,
    private readonly guestSessionRepository: GuestSessionRepository,
    private readonly authAuditRepository: AuthAuditRepository,
    @Optional()
    private readonly customerRepository?: CustomerRepository,
  ) {}

  async convertGuestToCustomer(
    auth: AuthInternalContext,
    dto: ConvertGuestToCustomerDtoLike,
    tokens: GuestConversionTokenInput,
    request: GuestConversionServiceRequestMetadata = EMPTY_REQUEST_METADATA,
  ): Promise<AuthGuestConversionResponse> {
    assertContextIsConvertibleGuest(auth);

    const civilIdNormalized = resolveRequiredCivilIdNormalized(dto.civil_id);

    assertPasswordAllowed(dto);

    await this.assertCustomerConversionIdentityAvailable({
      currentGuestUserId: auth.profile.id,
      email: dto.email,
      phone: dto.phone,
      civilIdNormalized,
    });

    try {
      const providerResult =
        await this.supabaseAuthRepository.convertAnonymousGuestToEmailPassword({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          email: dto.email,
          password: dto.password,
          fullName: dto.full_name,
          phone: dto.phone,
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
          phone: dto.phone,
          fullName: dto.full_name,
          timezone: dto.timezone ?? null,
          convertedFromGuestAt: convertedAt,
        });

      await this.getCustomerRepository().createProfile({
        appUserId: user.id,
        civilId: dto.civil_id,
        civilIdNormalized,
        createdByAdminId: null,
        updatedByAdminId: null,
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
  private async assertCustomerConversionIdentityAvailable(input: {
    readonly currentGuestUserId: string;
    readonly email: string;
    readonly phone: string;
    readonly civilIdNormalized: string;
  }): Promise<void> {
    const existingUser = await this.authUserRepository.findByEmail({
      email: input.email,
    });

    if (existingUser && existingUser.id !== input.currentGuestUserId) {
      throw AppError.emailAlreadyRegistered(
        'An account with this email already exists.',
      );
    }

    const existingPhoneUser = await this.authUserRepository.findByPhone({
      phone: input.phone,
      excludeUserId: input.currentGuestUserId,
    });

    if (existingPhoneUser) {
      throw AppError.customerPhoneAlreadyExists(undefined, {
        field: 'phone',
      });
    }

    const existingCivilIdProfile =
      await this.getCustomerRepository().findByCivilIdNormalized({
        civilIdNormalized: input.civilIdNormalized,
        includeDeleted: true,
      });

    if (existingCivilIdProfile) {
      throw AppError.customerCivilIdAlreadyExists(undefined, {
        field: 'civil_id',
      });
    }
  }

  private getCustomerRepository(): CustomerRepository {
    if (!this.customerRepository) {
      throw AppError.customerProfileCreationFailed(
        new Error('CustomerRepository provider is not registered.'),
      );
    }

    return this.customerRepository;
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
