// apps/api/src/modules/auth/application/guest-session.service.ts
/**
 * LAFAM guest session service.
 *
 * Role:
 * - Owns public guest-session creation.
 * - Owns authenticated guest-session ending.
 * - Enforces guest captcha/rate-limit/expiry rules before repository writes.
 *
 * Important:
 * - Guest access is not unauthenticated access.
 * - Guest users are Supabase anonymous authenticated users with LAFAM role = guest.
 * - Guest sessions must be revocable, auditable, and convertible only into customer accounts.
 */

import { Injectable } from '@nestjs/common';

import { currentAuthConfig } from '../../../common/config';
import { AppError } from '../../../common/errors/app-error';
import { AUTH_GUEST_ROLE } from '../constants/auth-role.constants';
import {
  AUTH_AUDIT_EVENT_GUEST_SESSION_CREATED,
  AUTH_AUDIT_EVENT_GUEST_SESSION_ENDED,
  AUTH_SESSION_TYPE_GUEST,
  AUTH_TOKEN_TYPE,
  AUTH_USER_STATUS_GUEST_ACTIVE,
} from '../constants/auth.constants';
import type { CreateGuestSessionDto } from '../dto/create-guest-session.dto';
import { AuthAuditRepository } from '../repositories/auth-audit.repository';
import { AuthSessionRepository } from '../repositories/auth-session.repository';
import { GuestSessionRepository } from '../repositories/guest-session.repository';
import { SupabaseAuthRepository } from '../repositories/supabase-auth.repository';
import type { AuthInternalContext } from '../types/auth-context.types';
import type {
  AuthEndGuestSessionResponse,
  AuthGuestSessionResponse,
} from '../types/auth-response.types';
import { createAuthSessionHashPair } from '../utils/auth-token-hash.util';

export interface GuestSessionServiceRequestMetadata {
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

export interface ExpireGuestSessionInput {
  readonly userId: string;
  readonly sessionId: string;
  readonly expiredAt?: string;
}

type CountGuestSessionsByIpSinceInput = Parameters<
  AuthSessionRepository['countGuestSessionsByIpSince']
>[0];

const EMPTY_REQUEST_METADATA: GuestSessionServiceRequestMetadata = {
  ipAddress: null,
  userAgent: null,
};

function addHoursToIsoString(hours: number, now = new Date()): string {
  return new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
}

function subtractHoursToIsoString(hours: number, now = new Date()): string {
  return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
}

function buildGuestSessionRateLimitInput(
  ipAddress: string,
  windowStartedAt: string,
): CountGuestSessionsByIpSinceInput {
  return {
    ipAddress,
    windowStartedAt,
  };
}

function assertCaptchaAllowed(dto: CreateGuestSessionDto): void {
  if (!currentAuthConfig.guest.requireCaptcha) {
    return;
  }

  if (dto.captcha_token) {
    return;
  }

  throw AppError.validationFailed('Captcha verification is required.', {
    field: 'captcha_token',
  });
}

function assertContextIsActiveGuest(auth: AuthInternalContext): void {
  if (
    auth.profile.role !== AUTH_GUEST_ROLE ||
    auth.profile.status !== AUTH_USER_STATUS_GUEST_ACTIVE ||
    !auth.profile.isGuest ||
    auth.session.sessionType !== AUTH_SESSION_TYPE_GUEST
  ) {
    throw AppError.guestSessionRequired(
      'A valid guest session is required for this action.',
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
}

@Injectable()
export class GuestSessionService {
  constructor(
    private readonly supabaseAuthRepository: SupabaseAuthRepository,
    private readonly authSessionRepository: AuthSessionRepository,
    private readonly guestSessionRepository: GuestSessionRepository,
    private readonly authAuditRepository: AuthAuditRepository,
  ) {}

  async createGuestSession(
    dto: CreateGuestSessionDto,
    request: GuestSessionServiceRequestMetadata = EMPTY_REQUEST_METADATA,
  ): Promise<AuthGuestSessionResponse> {
    assertCaptchaAllowed(dto);

    await this.assertGuestSessionRateLimit(request);

    const providerResult =
      await this.supabaseAuthRepository.createAnonymousGuestSession({
        captchaToken: dto.captcha_token ?? null,
      });

    const tokenHashes = createAuthSessionHashPair(
      {
        accessToken: providerResult.session.accessToken,
        refreshToken: providerResult.session.refreshToken,
      },
      currentAuthConfig.token.accessTokenHashPepper,
    );

    const guestExpiresAt = addHoursToIsoString(
      currentAuthConfig.guest.sessionTtlHours,
    );

    const createdGuest =
      await this.guestSessionRepository.createGuestUserAndSession({
        user: {
          authUserId: providerResult.user.id,
          guestExpiresAt,
          metadata: {
            provider: 'supabase_anonymous',
            created_from: 'guest_session',
          },
        },
        session: {
          supabaseAuthUserId: providerResult.user.id,
          accessTokenHash: tokenHashes.accessTokenHash,
          refreshTokenHash: tokenHashes.refreshTokenHash,
          deviceId: dto.device_id ?? null,
          deviceName: dto.device_name ?? null,
          ipAddress: request.ipAddress,
          userAgent: request.userAgent,
          expiresAt: guestExpiresAt,
        },
      });

    await this.authAuditRepository.createEvent({
      actorUserId: createdGuest.user.id,
      targetUserId: createdGuest.user.id,
      eventType: AUTH_AUDIT_EVENT_GUEST_SESSION_CREATED,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      metadata: {
        session_id: createdGuest.session.id,
        session_type: createdGuest.session.type,
        guest_expires_at: guestExpiresAt,
      },
    });

    return {
      guest: true,
      access_token: providerResult.session.accessToken,
      refresh_token: providerResult.session.refreshToken,
      token_type: AUTH_TOKEN_TYPE,
      expires_in: providerResult.session.expiresIn,
      user: createdGuest.user,
      session: createdGuest.session,
    };
  }

  async endGuestSession(
    auth: AuthInternalContext,
    request: GuestSessionServiceRequestMetadata = EMPTY_REQUEST_METADATA,
  ): Promise<AuthEndGuestSessionResponse> {
    assertContextIsActiveGuest(auth);

    const endedAt = new Date().toISOString();

    const result = await this.guestSessionRepository.endGuestSession({
      userId: auth.profile.id,
      sessionId: auth.session.id,
      endedAt,
    });

    await this.authAuditRepository.createEvent({
      actorUserId: auth.profile.id,
      targetUserId: auth.profile.id,
      eventType: AUTH_AUDIT_EVENT_GUEST_SESSION_ENDED,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      metadata: {
        session_id: result.sessionId,
        ended_at: result.endedAt,
      },
    });

    return {
      guest_session_ended: true,
      session_id: result.sessionId,
    };
  }

  async expireGuestSession(input: ExpireGuestSessionInput): Promise<void> {
    await this.guestSessionRepository.expireGuestUserAndSession({
      userId: input.userId,
      sessionId: input.sessionId,
      expiredAt: input.expiredAt ?? new Date().toISOString(),
    });
  }

  private async assertGuestSessionRateLimit(
    request: GuestSessionServiceRequestMetadata,
  ): Promise<void> {
    if (!request.ipAddress) {
      return;
    }

    const since = subtractHoursToIsoString(1);

    const sessionCount =
      await this.authSessionRepository.countGuestSessionsByIpSince(
        buildGuestSessionRateLimitInput(request.ipAddress, since),
      );

    if (sessionCount < currentAuthConfig.guest.maxSessionsPerIpPerHour) {
      return;
    }

    throw AppError.guestRateLimited(
      'Too many guest sessions have been created from this IP address. Please try again later.',
    );
  }
}
