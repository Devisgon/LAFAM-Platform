// apps/api/src/modules/auth/application/password-reset.service.ts
/**
 * LAFAM password reset service.
 *
 * Role:
 * - Owns forgot-password, verify-reset-OTP, and reset-password flows.
 * - Coordinates Supabase OTP verification with LAFAM reset-token challenge state.
 * - Ensures reset tokens are hashed, short-lived, single-use, and never stored raw.
 *
 * Important:
 * - Forgot-password responses must not reveal whether an account exists.
 * - Raw OTPs, reset tokens, passwords, access tokens, and refresh tokens must never be logged.
 * - Reset-password must revoke existing application sessions after password update.
 */

import { Injectable } from '@nestjs/common';

import { currentAuthConfig } from '../../../common/config';
import { AppError } from '../../../common/errors/app-error';
import {
  AUTH_ERROR_DETAIL_KEYS,
  AUTH_ERROR_REASON_PASSWORD_CONFIRMATION_MISMATCH,
  AUTH_ERROR_REASON_PASSWORD_POLICY_FAILED,
} from '../constants/auth-error.constants';
import {
  AUTH_AUDIT_EVENT_PASSWORD_RESET_COMPLETED,
  AUTH_AUDIT_EVENT_PASSWORD_RESET_OTP_VERIFIED,
  AUTH_AUDIT_EVENT_PASSWORD_RESET_REQUESTED,
  AUTH_SESSION_REVOCATION_REASON_PASSWORD_CHANGED,
  AUTH_USER_STATUS_DEACTIVATED,
  AUTH_USER_STATUS_DELETED,
} from '../constants/auth.constants';
import type { ForgotPasswordDto } from '../dto/forgot-password.dto';
import type { ResetPasswordDto } from '../dto/reset-password.dto';
import type { VerifyResetOtpDto } from '../dto/verify-reset-otp.dto';
import { AuthAuditRepository } from '../repositories/auth-audit.repository';
import { AuthSessionRepository } from '../repositories/auth-session.repository';
import { AuthUserRepository } from '../repositories/auth-user.repository';
import {
  PasswordResetRepository,
  type PasswordResetChallengeInternal,
} from '../repositories/password-reset.repository';
import { SupabaseAuthRepository } from '../repositories/supabase-auth.repository';
import type {
  AuthForgotPasswordResponse,
  AuthResetPasswordResponse,
  AuthVerifyResetOtpResponse,
} from '../types/auth-response.types';
import type { AuthUserInternalProfile } from '../types/auth-user.types';
import {
  createAuthResetToken,
  hashAuthResetToken,
} from '../utils/auth-token-hash.util';
import {
  getAuthPasswordPolicyFailureCodes,
  validateAuthPasswordAndConfirmation,
} from '../utils/password-policy.util';

export interface PasswordResetServiceRequestMetadata {
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

const EMPTY_REQUEST_METADATA: PasswordResetServiceRequestMetadata = {
  ipAddress: null,
  userAgent: null,
};

function addMinutesToIsoString(minutes: number, now = new Date()): string {
  return new Date(now.getTime() + minutes * 60 * 1000).toISOString();
}

function isIsoDateExpired(value: string, now = new Date()): boolean {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return true;
  }

  return parsedDate.getTime() <= now.getTime();
}

function isPasswordResetAllowedForUser(user: AuthUserInternalProfile): boolean {
  return (
    user.status !== AUTH_USER_STATUS_DEACTIVATED &&
    user.status !== AUTH_USER_STATUS_DELETED &&
    !user.isGuest
  );
}

function assertResetChallengeCanVerifyOtp(
  challenge: PasswordResetChallengeInternal,
): void {
  if (challenge.usedAt) {
    throw AppError.resetOtpInvalid('The password reset code is invalid.');
  }

  if (isIsoDateExpired(challenge.expiresAt)) {
    throw AppError.resetOtpExpired('The password reset code has expired.');
  }

  if (challenge.failedAttempts >= currentAuthConfig.token.maxResetOtpAttempts) {
    throw AppError.resetOtpInvalid(
      'Too many invalid password reset attempts. Please request a new reset code.',
    );
  }
}

function assertResetChallengeCanResetPassword(
  challenge: PasswordResetChallengeInternal,
  email: string,
): void {
  if (challenge.email !== email) {
    throw AppError.resetTokenInvalid('The password reset token is invalid.');
  }

  if (!challenge.authUserId) {
    throw AppError.resetTokenInvalid('The password reset token is invalid.');
  }

  if (!challenge.verifiedAt || !challenge.resetTokenHash) {
    throw AppError.resetTokenInvalid('The password reset token is invalid.');
  }

  if (challenge.usedAt) {
    throw AppError.resetTokenInvalid('The password reset token is invalid.');
  }

  if (isIsoDateExpired(challenge.expiresAt)) {
    throw AppError.resetTokenExpired('The password reset token has expired.');
  }
}

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly supabaseAuthRepository: SupabaseAuthRepository,
    private readonly authUserRepository: AuthUserRepository,
    private readonly authSessionRepository: AuthSessionRepository,
    private readonly passwordResetRepository: PasswordResetRepository,
    private readonly authAuditRepository: AuthAuditRepository,
  ) {}

  async forgotPassword(
    dto: ForgotPasswordDto,
    request: PasswordResetServiceRequestMetadata = EMPTY_REQUEST_METADATA,
  ): Promise<AuthForgotPasswordResponse> {
    const user = await this.authUserRepository.findByEmail({
      email: dto.email,
    });

    if (!user || !isPasswordResetAllowedForUser(user)) {
      return {
        email: dto.email,
        reset_otp_sent: true,
      };
    }

    const now = new Date().toISOString();

    await this.passwordResetRepository.invalidateUnusedChallengesForEmail({
      email: dto.email,
      usedAt: now,
    });

    await this.supabaseAuthRepository.sendPasswordResetOtp({
      email: dto.email,
    });

    await this.passwordResetRepository.createChallenge({
      email: dto.email,
      authUserId: user.authUserId,
      expiresAt: addMinutesToIsoString(
        currentAuthConfig.token.resetTokenTtlMinutes,
      ),
    });

    await this.authAuditRepository.createEvent({
      actorUserId: user.id,
      targetUserId: user.id,
      eventType: AUTH_AUDIT_EVENT_PASSWORD_RESET_REQUESTED,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      metadata: {
        email: dto.email,
      },
    });

    return {
      email: dto.email,
      reset_otp_sent: true,
    };
  }

  async verifyResetOtp(
    dto: VerifyResetOtpDto,
    request: PasswordResetServiceRequestMetadata = EMPTY_REQUEST_METADATA,
  ): Promise<AuthVerifyResetOtpResponse> {
    const challenge = await this.passwordResetRepository.findLatestByEmail({
      email: dto.email,
    });

    if (!challenge) {
      throw AppError.resetOtpInvalid('The password reset code is invalid.');
    }

    assertResetChallengeCanVerifyOtp(challenge);

    try {
      const providerResult = await this.supabaseAuthRepository.verifyResetOtp({
        email: dto.email,
        otp: dto.otp,
      });

      if (
        challenge.authUserId &&
        providerResult.user.id !== challenge.authUserId
      ) {
        throw AppError.resetOtpInvalid('The password reset code is invalid.');
      }

      const resetTokenExpiresAt = addMinutesToIsoString(
        currentAuthConfig.token.resetTokenTtlMinutes,
      );

      const resetToken = createAuthResetToken(
        currentAuthConfig.token.accessTokenHashPepper,
      );

      const verifiedChallenge = await this.passwordResetRepository.markVerified(
        {
          challengeId: challenge.id,
          resetTokenHash: resetToken.resetTokenHash,
          verifiedAt: new Date().toISOString(),
          expiresAt: resetTokenExpiresAt,
        },
      );

      const user = verifiedChallenge.authUserId
        ? await this.authUserRepository.findByAuthUserId({
            authUserId: verifiedChallenge.authUserId,
          })
        : null;

      await this.authAuditRepository.createEvent({
        actorUserId: user?.id ?? null,
        targetUserId: user?.id ?? null,
        eventType: AUTH_AUDIT_EVENT_PASSWORD_RESET_OTP_VERIFIED,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        metadata: {
          email: dto.email,
        },
      });

      return {
        email: dto.email,
        reset_token: resetToken.resetToken,
        reset_token_expires_at: resetTokenExpiresAt,
      };
    } catch (error) {
      await this.passwordResetRepository.incrementFailedAttempts({
        challengeId: challenge.id,
        failedAttempts: challenge.failedAttempts,
      });

      throw error;
    }
  }

  async resetPassword(
    dto: ResetPasswordDto,
    request: PasswordResetServiceRequestMetadata = EMPTY_REQUEST_METADATA,
  ): Promise<AuthResetPasswordResponse> {
    this.assertPasswordAllowed(dto.password, dto.confirm_password, dto.email);

    const resetTokenHash = hashAuthResetToken(
      dto.reset_token,
      currentAuthConfig.token.accessTokenHashPepper,
    );

    const challenge = await this.passwordResetRepository.getByResetTokenHash({
      resetTokenHash,
    });

    assertResetChallengeCanResetPassword(challenge, dto.email);

    const challengeAuthUserId = challenge.authUserId;

    if (!challengeAuthUserId) {
      throw AppError.resetTokenInvalid('The password reset token is invalid.');
    }

    const user = await this.authUserRepository.getByAuthUserId({
      authUserId: challengeAuthUserId,
    });

    if (user.status === AUTH_USER_STATUS_DEACTIVATED) {
      throw AppError.accountDeactivated('This account has been deactivated.');
    }

    if (user.status === AUTH_USER_STATUS_DELETED) {
      throw AppError.accountDeleted('This account has been deleted.');
    }

    await this.supabaseAuthRepository.updateAuthUserPassword({
      authUserId: user.authUserId,
      password: dto.password,
    });

    const usedAt = new Date().toISOString();

    await this.passwordResetRepository.markUsed({
      challengeId: challenge.id,
      usedAt,
    });

    await this.passwordResetRepository.invalidateUnusedChallengesForEmail({
      email: dto.email,
      usedAt,
    });

    await this.authSessionRepository.revokeAllForUser({
      userId: user.id,
      revokedAt: usedAt,
      revokedReason: AUTH_SESSION_REVOCATION_REASON_PASSWORD_CHANGED,
    });

    await this.authAuditRepository.createEvent({
      actorUserId: user.id,
      targetUserId: user.id,
      eventType: AUTH_AUDIT_EVENT_PASSWORD_RESET_COMPLETED,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      metadata: {
        email: dto.email,
      },
    });

    return {
      password_reset: true,
    };
  }

  private assertPasswordAllowed(
    password: string,
    confirmPassword: string,
    email: string,
  ): void {
    const result = validateAuthPasswordAndConfirmation(
      password,
      confirmPassword,
      {
        email,
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
      {
        [AUTH_ERROR_DETAIL_KEYS.reason]:
          AUTH_ERROR_REASON_PASSWORD_POLICY_FAILED,
        failures: result.failures,
      },
    );
  }
}
