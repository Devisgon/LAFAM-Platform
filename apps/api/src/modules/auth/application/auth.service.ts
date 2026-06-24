// apps/api/src/modules/auth/application/auth.service.ts
/**
 * LAFAM Auth service.
 *
 * Role:
 * - Owns public Auth flows: sign-up, verify email, resend verification OTP, login, and refresh-token.
 * - Coordinates Supabase Auth provider calls with LAFAM-owned app_users/auth_sessions state.
 * - Creates required customer profile identity during public customer sign-up.
 * - Keeps controllers thin and keeps provider/database details out of route handlers.
 *
 * Important:
 * - Public sign-up always creates customer users.
 * - Public customer sign-up requires full name, email, phone, Civil ID, password, and password confirmation.
 * - Passwords, OTPs, access tokens, refresh tokens, reset tokens, and Civil ID values must never be logged.
 * - Raw access/refresh tokens are returned only in login/refresh responses and stored only as hashes.
 * - LAFAM session state must be checked because provider JWTs can remain valid until expiry.
 */

import { Injectable, Optional } from '@nestjs/common';

import { currentAuthConfig } from '../../../common/config';
import { AppError } from '../../../common/errors/app-error';
import type { DatabaseJsonObject } from '../../../database/database.types';
import { CustomerRepository } from '../../customers/repositories/customer.repository';
import {
  AUTH_ERROR_REASON_PASSWORD_CONFIRMATION_MISMATCH,
  AUTH_ERROR_REASON_PASSWORD_POLICY_FAILED,
} from '../constants/auth-error.constants';
import { getAuthPermissionsForRole } from '../constants/auth-permission.constants';
import {
  AUTH_CUSTOMER_ROLE,
  isAuthAdminAccessRole,
  isAuthStaffAccessRole,
} from '../constants/auth-role.constants';
import {
  AUTH_AUDIT_EVENT_EMAIL_VERIFIED,
  AUTH_AUDIT_EVENT_LOGIN_FAILED,
  AUTH_AUDIT_EVENT_LOGIN_SUCCEEDED,
  AUTH_AUDIT_EVENT_SIGN_UP_REQUESTED,
  AUTH_AUDIT_EVENT_TOKEN_REFRESHED,
  AUTH_AUDIT_EVENT_VERIFICATION_OTP_RESENT,
  AUTH_SESSION_TYPE_ADMIN,
  AUTH_SESSION_TYPE_AUTHENTICATED,
  AUTH_SESSION_TYPE_STAFF,
  AUTH_TOKEN_TYPE,
  AUTH_USER_STATUS_ACTIVE,
  AUTH_USER_STATUS_DEACTIVATED,
  AUTH_USER_STATUS_DELETED,
  AUTH_USER_STATUS_PENDING_EMAIL_VERIFICATION,
  type AuthSessionType,
} from '../constants/auth.constants';
import type { LoginDto } from '../dto/login.dto';
import type { RefreshTokenDto } from '../dto/refresh-token.dto';
import type { ResendVerificationOtpDto } from '../dto/resend-verification-otp.dto';
import type { SignUpDto } from '../dto/sign-up.dto';
import type { VerifyEmailDto } from '../dto/verify-email.dto';
import { AuthAuditRepository } from '../repositories/auth-audit.repository';
import {
  SupabaseAuthRepository,
  type SupabaseAuthSession,
} from '../repositories/supabase-auth.repository';
import { AuthSessionRepository } from '../repositories/auth-session.repository';
import { AuthUserRepository } from '../repositories/auth-user.repository';
import type {
  AuthSafeSessionResponse,
  AuthSessionDeviceMetadata,
  AuthSessionInternal,
} from '../types/auth-session.types';
import type {
  AuthEmailVerificationResponse,
  AuthLoginResponse,
  AuthRefreshTokenResponse,
  AuthResendVerificationOtpResponse,
  AuthSignUpResponse,
} from '../types/auth-response.types';
import type {
  AuthSafeUserResponse,
  AuthUserInternalProfile,
} from '../types/auth-user.types';
import {
  createAuthSessionHashPair,
  hashAuthRefreshToken,
} from '../utils/auth-token-hash.util';
import { normalizeAuthCivilIdNormalized } from '../utils/auth-normalization.util';
import {
  validateAuthPasswordAndConfirmation,
  getAuthPasswordPolicyFailureCodes,
} from '../utils/password-policy.util';

export interface AuthServiceRequestMetadata {
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

const EMPTY_REQUEST_METADATA: AuthServiceRequestMetadata = {
  ipAddress: null,
  userAgent: null,
};

function resolveSessionTypeForRole(
  role: AuthUserInternalProfile['role'],
): AuthSessionType {
  if (isAuthAdminAccessRole(role)) {
    return AUTH_SESSION_TYPE_ADMIN;
  }

  if (isAuthStaffAccessRole(role)) {
    return AUTH_SESSION_TYPE_STAFF;
  }

  return AUTH_SESSION_TYPE_AUTHENTICATED;
}

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

function mapInternalSessionToSafeSessionResponse(
  session: AuthSessionInternal,
): AuthSafeSessionResponse {
  return {
    id: session.id,
    type: session.sessionType,
    device_id: session.deviceId,
    device_name: session.deviceName,
    ip_address: session.ipAddress,
    user_agent: session.userAgent,
    created_at: session.createdAt,
    last_seen_at: session.lastSeenAt,
    expires_at: session.expiresAt,
    revoked_at: session.revokedAt,
    revoked_reason: session.revokedReason,
    converted_at: session.convertedAt,
  };
}

function resolveAppSessionExpiresAt(now: Date): string {
  return new Date(
    now.getTime() + currentAuthConfig.session.ttlHours * 60 * 60 * 1000,
  ).toISOString();
}

function isIsoDateExpired(
  value: string | null,
  now: Date = new Date(),
): boolean {
  if (!value) {
    return false;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return true;
  }

  return parsedDate.getTime() <= now.getTime();
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
export class AuthService {
  constructor(
    private readonly supabaseAuthRepository: SupabaseAuthRepository,
    private readonly authUserRepository: AuthUserRepository,
    private readonly authSessionRepository: AuthSessionRepository,
    private readonly authAuditRepository: AuthAuditRepository,
    @Optional()
    private readonly customerRepository?: CustomerRepository,
  ) {}

  async signUp(
    dto: SignUpDto,
    request: AuthServiceRequestMetadata = EMPTY_REQUEST_METADATA,
  ): Promise<AuthSignUpResponse> {
    const civilIdNormalized = resolveRequiredCivilIdNormalized(dto.civil_id);

    this.assertPasswordAllowed(dto.password, dto.confirm_password, {
      email: dto.email,
      fullName: dto.full_name,
    });

    await this.assertCustomerSignupIdentityAvailable({
      email: dto.email,
      phone: dto.phone,
      civilIdNormalized,
    });

    const providerResult = await this.supabaseAuthRepository.signUpWithPassword(
      {
        email: dto.email,
        password: dto.password,
        fullName: dto.full_name,
        phone: dto.phone,
        timezone: dto.timezone ?? null,
      },
    );

    let user: AuthUserInternalProfile | null = null;

    try {
      user = await this.authUserRepository.createAppUser({
        authUserId: providerResult.user.id,
        email: dto.email,
        phone: dto.phone,
        fullName: dto.full_name,
        role: AUTH_CUSTOMER_ROLE,
        status: AUTH_USER_STATUS_PENDING_EMAIL_VERIFICATION,
        isGuest: false,
        timezone: dto.timezone ?? null,
        metadata: {
          source: 'public_sign_up',
        },
      });

      await this.getCustomerRepository().createProfile({
        appUserId: user.id,
        civilId: dto.civil_id,
        civilIdNormalized,
        createdByAdminId: null,
        updatedByAdminId: null,
      });
    } catch (error) {
      await this.cleanupFailedPublicSignUp({
        authUserId: providerResult.user.id,
        appUserId: user?.id ?? null,
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw AppError.customerCreateFailed(error);
    }

    await this.authAuditRepository.createEvent({
      actorUserId: user.id,
      targetUserId: user.id,
      eventType: AUTH_AUDIT_EVENT_SIGN_UP_REQUESTED,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      metadata: {
        email: dto.email,
      },
    });

    return {
      user: mapInternalProfileToSafeUserResponse(user),
      email_verification_required: true,
    };
  }

  async verifyEmail(
    dto: VerifyEmailDto,
    request: AuthServiceRequestMetadata = EMPTY_REQUEST_METADATA,
  ): Promise<AuthEmailVerificationResponse> {
    const providerResult = await this.supabaseAuthRepository.verifyEmailOtp({
      email: dto.email,
      otp: dto.otp,
    });

    const user = await this.authUserRepository.activateByAuthUserId({
      authUserId: providerResult.user.id,
      email: dto.email,
    });

    await this.authAuditRepository.createEvent({
      actorUserId: user.id,
      targetUserId: user.id,
      eventType: AUTH_AUDIT_EVENT_EMAIL_VERIFIED,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      metadata: {
        email: dto.email,
      },
    });

    return {
      user: mapInternalProfileToSafeUserResponse(user),
      verified: true,
    };
  }

  async resendVerificationOtp(
    dto: ResendVerificationOtpDto,
    request: AuthServiceRequestMetadata = EMPTY_REQUEST_METADATA,
  ): Promise<AuthResendVerificationOtpResponse> {
    await this.supabaseAuthRepository.resendVerificationOtp({
      email: dto.email,
    });

    const user = await this.authUserRepository.findByEmail({
      email: dto.email,
    });

    if (user) {
      await this.authAuditRepository.createEvent({
        actorUserId: user.id,
        targetUserId: user.id,
        eventType: AUTH_AUDIT_EVENT_VERIFICATION_OTP_RESENT,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        metadata: {
          email: dto.email,
        },
      });
    }

    return {
      email: dto.email,
      sent: true,
    };
  }

  async login(
    dto: LoginDto,
    request: AuthServiceRequestMetadata = EMPTY_REQUEST_METADATA,
  ): Promise<AuthLoginResponse> {
    try {
      const providerResult =
        await this.supabaseAuthRepository.signInWithPassword({
          email: dto.email,
          password: dto.password,
        });

      const user = await this.authUserRepository.getByAuthUserId({
        authUserId: providerResult.user.id,
      });

      this.assertUserCanLogin(user);

      const session = await this.createSessionForProviderSession({
        user,
        providerSession: providerResult.session,
        device: {
          deviceId: dto.device_id ?? null,
          deviceName: dto.device_name ?? null,
          ipAddress: request.ipAddress,
          userAgent: request.userAgent,
        },
      });

      await this.authAuditRepository.createEvent({
        actorUserId: user.id,
        targetUserId: user.id,
        eventType: AUTH_AUDIT_EVENT_LOGIN_SUCCEEDED,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        metadata: {
          session_id: session.id,
          session_type: session.sessionType,
          device_id: dto.device_id ?? null,
          device_name: dto.device_name ?? null,
        },
      });

      return {
        authenticated: true,
        access_token: providerResult.session.accessToken,
        refresh_token: providerResult.session.refreshToken,
        token_type: AUTH_TOKEN_TYPE,
        expires_in: providerResult.session.expiresIn,
        user: mapInternalProfileToSafeUserResponse(user),
        session: mapInternalSessionToSafeSessionResponse(session),
      };
    } catch (error) {
      await this.authAuditRepository.createEvent({
        eventType: AUTH_AUDIT_EVENT_LOGIN_FAILED,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        metadata: {
          email: dto.email,
        },
      });

      throw error;
    }
  }

  async refreshToken(dto: RefreshTokenDto): Promise<AuthRefreshTokenResponse> {
    const refreshTokenHash = hashAuthRefreshToken(
      dto.refresh_token,
      currentAuthConfig.token.accessTokenHashPepper,
    );

    const existingSession =
      await this.authSessionRepository.findByRefreshTokenHash({
        refreshTokenHash,
      });

    if (!existingSession) {
      throw AppError.invalidCredentials('The refresh token is invalid.');
    }

    const refreshTime = new Date();

    this.assertSessionCanRefresh(existingSession, refreshTime);

    const user = await this.authUserRepository.getById({
      userId: existingSession.userId,
    });

    this.assertUserCanLogin(user);

    const providerResult = await this.supabaseAuthRepository.refreshSession({
      refreshToken: dto.refresh_token,
    });

    if (providerResult.user.id !== existingSession.supabaseAuthUserId) {
      throw AppError.invalidCredentials('The refresh token is invalid.');
    }

    const tokenHashes = createAuthSessionHashPair(
      {
        accessToken: providerResult.session.accessToken,
        refreshToken: providerResult.session.refreshToken,
      },
      currentAuthConfig.token.accessTokenHashPepper,
    );

    const updatedSession = await this.authSessionRepository.updateTokenHashes({
      sessionId: existingSession.id,
      previousRefreshTokenHash: existingSession.refreshTokenHash,
      accessTokenHash: tokenHashes.accessTokenHash,
      refreshTokenHash: tokenHashes.refreshTokenHash,
      expiresAt: resolveAppSessionExpiresAt(refreshTime),
      lastSeenAt: refreshTime.toISOString(),
    });

    if (!updatedSession) {
      throw AppError.invalidCredentials(
        'The refresh token has already been rotated.',
      );
    }

    await this.authAuditRepository.createEvent({
      actorUserId: updatedSession.userId,
      targetUserId: updatedSession.userId,
      eventType: AUTH_AUDIT_EVENT_TOKEN_REFRESHED,
      metadata: {
        session_id: updatedSession.id,
      },
    });

    return {
      access_token: providerResult.session.accessToken,
      refresh_token: providerResult.session.refreshToken,
      token_type: AUTH_TOKEN_TYPE,
      expires_in: providerResult.session.expiresIn,
      session: mapInternalSessionToSafeSessionResponse(updatedSession),
    };
  }

  private async assertCustomerSignupIdentityAvailable(input: {
    readonly email: string;
    readonly phone: string;
    readonly civilIdNormalized: string;
  }): Promise<void> {
    const existingUser = await this.authUserRepository.findByEmail({
      email: input.email,
    });

    if (existingUser) {
      throw AppError.emailAlreadyRegistered(
        'An account with this email already exists.',
      );
    }

    const existingPhoneUser = await this.authUserRepository.findByPhone({
      phone: input.phone,
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

  private async createSessionForProviderSession(input: {
    readonly user: AuthUserInternalProfile;
    readonly providerSession: SupabaseAuthSession;
    readonly device: AuthSessionDeviceMetadata;
  }): Promise<AuthSessionInternal> {
    const tokenHashes = createAuthSessionHashPair(
      {
        accessToken: input.providerSession.accessToken,
        refreshToken: input.providerSession.refreshToken,
      },
      currentAuthConfig.token.accessTokenHashPepper,
    );

    const createdAt = new Date();

    return this.authSessionRepository.createSession({
      userId: input.user.id,
      supabaseAuthUserId: input.user.authUserId,
      accessTokenHash: tokenHashes.accessTokenHash,
      refreshTokenHash: tokenHashes.refreshTokenHash,
      sessionType: resolveSessionTypeForRole(input.user.role),
      deviceId: input.device.deviceId,
      deviceName: input.device.deviceName,
      ipAddress: input.device.ipAddress,
      userAgent: input.device.userAgent,
      expiresAt: resolveAppSessionExpiresAt(createdAt),
    });
  }

  private assertPasswordAllowed(
    password: string,
    confirmPassword: string,
    context: {
      readonly email: string;
      readonly fullName: string | null;
    },
  ): void {
    const result = validateAuthPasswordAndConfirmation(
      password,
      confirmPassword,
      {
        email: context.email,
        fullName: context.fullName,
      },
    );

    if (result.valid) {
      return;
    }

    const failureCodes = getAuthPasswordPolicyFailureCodes(result);

    if (
      failureCodes.includes(AUTH_ERROR_REASON_PASSWORD_CONFIRMATION_MISMATCH)
    ) {
      throw AppError.passwordConfirmationMismatch(
        'Password confirmation does not match.',
      );
    }

    throw AppError.passwordPolicyFailed(
      'The password does not meet security requirements.',
      buildPasswordFailureDetails(result.failures, failureCodes),
    );
  }

  private assertUserCanLogin(user: AuthUserInternalProfile): void {
    if (user.status === AUTH_USER_STATUS_PENDING_EMAIL_VERIFICATION) {
      throw AppError.emailNotVerified(
        'Please verify your email before continuing.',
      );
    }

    if (user.status === AUTH_USER_STATUS_DEACTIVATED) {
      throw AppError.accountDeactivated('This account has been deactivated.');
    }

    if (user.status === AUTH_USER_STATUS_DELETED) {
      throw AppError.accountDeleted('This account has been deleted.');
    }

    if (user.status !== AUTH_USER_STATUS_ACTIVE) {
      throw AppError.authorizationDenied(
        'This account cannot access authenticated features.',
      );
    }

    const permissions = getAuthPermissionsForRole(user.role);

    if (permissions.length === 0) {
      throw AppError.authorizationDenied(
        'This account does not have application access.',
      );
    }
  }

  private assertSessionCanRefresh(
    session: AuthSessionInternal,
    now: Date,
  ): void {
    if (session.revokedAt) {
      throw AppError.sessionRevoked('The session has been revoked.');
    }

    if (session.convertedAt) {
      throw AppError.sessionRevoked('The session has already been converted.');
    }

    if (!session.expiresAt || isIsoDateExpired(session.expiresAt, now)) {
      throw AppError.sessionExpired('The session has expired.');
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

  private async cleanupFailedPublicSignUp(input: {
    readonly authUserId: string;
    readonly appUserId: string | null;
  }): Promise<void> {
    const deletedAt = new Date().toISOString();

    if (input.appUserId) {
      try {
        await this.authUserRepository.softDeleteById({
          userId: input.appUserId,
          deletedAt,
        });
      } catch (error) {
        void error;
      }
    }

    try {
      await this.supabaseAuthRepository.deleteAuthUser({
        authUserId: input.authUserId,
        shouldSoftDelete: false,
      });
    } catch (error) {
      void error;
    }
  }
}
