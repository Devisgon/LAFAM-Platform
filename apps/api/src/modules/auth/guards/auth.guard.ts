// apps/api/src/modules/auth/guards/auth.guard.ts
/**
 * LAFAM Auth guard.
 *
 * Role:
 * - Verifies Bearer access tokens with Supabase Auth.
 * - Resolves the matching LAFAM app user and app-owned auth session.
 * - Attaches the resolved Auth context to the request for controllers and later guards.
 *
 * Important:
 * - This guard authenticates and resolves context.
 * - Active-session state checks belong to ActiveSessionGuard.
 * - Role authorization belongs to RolesGuard.
 * - Public routes must be explicitly marked with @PublicRoute().
 * - Never log raw access tokens or token hashes.
 */

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { currentAuthConfig } from '../../../common/config';
import { AppError } from '../../../common/errors/app-error';
import { getAuthPermissionsForRole } from '../constants/auth-permission.constants';
import {
  attachAuthContextToRequest,
  type AuthenticatedRequest,
} from '../decorators/current-user.decorator';
import {
  AUTH_PUBLIC_ROUTE_METADATA_KEY,
  isPublicRouteMetadataValue,
} from '../decorators/public-route.decorator';
import { AuthSessionRepository } from '../repositories/auth-session.repository';
import { AuthUserRepository } from '../repositories/auth-user.repository';
import { SupabaseAuthRepository } from '../repositories/supabase-auth.repository';
import type {
  AuthInternalContext,
  AuthRequestMetadata,
} from '../types/auth-context.types';
import type { AuthResolvedSession } from '../types/auth-session.types';
import type {
  AuthResolvedUser,
  AuthUserInternalProfile,
} from '../types/auth-user.types';
import { hashAuthAccessToken } from '../utils/auth-token-hash.util';

interface BearerTokenParseResult {
  readonly accessToken: string;
}

function resolveRequestFromContext(
  context: ExecutionContext,
): AuthenticatedRequest {
  return context.switchToHttp().getRequest<AuthenticatedRequest>();
}

function extractHeaderValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmedValue = value.trim();

    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    const trimmedValue = value[0].trim();

    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  return null;
}

function parseBearerToken(request: Request): BearerTokenParseResult {
  const authorizationHeader = extractHeaderValue(request.headers.authorization);

  if (!authorizationHeader) {
    throw AppError.authenticationRequired('Authentication is required.');
  }

  const [scheme, token, ...extraParts] = authorizationHeader.split(/\s+/u);

  if (
    scheme?.toLowerCase() !== 'bearer' ||
    !token ||
    token.trim().length === 0 ||
    extraParts.length > 0
  ) {
    throw AppError.invalidCredentials('The authorization token is invalid.');
  }

  return {
    accessToken: token,
  };
}

function resolveClientIp(request: Request): string | null {
  const forwardedForHeader = extractHeaderValue(
    request.headers['x-forwarded-for'],
  );

  if (forwardedForHeader) {
    const [firstIp] = forwardedForHeader.split(',');

    if (firstIp?.trim()) {
      return firstIp.trim();
    }
  }

  return request.ip ?? null;
}

function resolveUserAgent(request: Request): string | null {
  return extractHeaderValue(request.headers['user-agent']);
}

function createRequestMetadata(request: Request): AuthRequestMetadata {
  return {
    ipAddress: resolveClientIp(request),
    userAgent: resolveUserAgent(request),
  };
}

function buildResolvedUser(profile: AuthUserInternalProfile): AuthResolvedUser {
  const permissions = getAuthPermissionsForRole(profile.role);

  return {
    id: profile.id,
    authUserId: profile.authUserId,
    email: profile.email,
    role: profile.role,
    status: profile.status,
    isGuest: profile.isGuest,
    permissions,
  };
}

function buildAuthContext(input: {
  readonly request: Request;
  readonly profile: AuthUserInternalProfile;
  readonly session: AuthResolvedSession;
}): AuthInternalContext {
  const user = buildResolvedUser(input.profile);

  return {
    user,
    profile: input.profile,
    session: input.session,
    permissions: user.permissions,
    request: createRequestMetadata(input.request),
  };
}

function assertResolvedIdentityMatches(input: {
  readonly providerAuthUserId: string;
  readonly profile: AuthUserInternalProfile;
  readonly session: AuthResolvedSession;
}): void {
  if (
    input.profile.authUserId !== input.providerAuthUserId ||
    input.session.supabaseAuthUserId !== input.providerAuthUserId ||
    input.session.userId !== input.profile.id
  ) {
    throw AppError.invalidCredentials('The authorization token is invalid.');
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabaseAuthRepository: SupabaseAuthRepository,
    private readonly authUserRepository: AuthUserRepository,
    private readonly authSessionRepository: AuthSessionRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublicRoute(context)) {
      return true;
    }

    const request = resolveRequestFromContext(context);
    const { accessToken } = parseBearerToken(request);

    const providerResult =
      await this.supabaseAuthRepository.getAuthUserByAccessToken({
        accessToken,
      });

    const accessTokenHash = hashAuthAccessToken(
      accessToken,
      currentAuthConfig.token.accessTokenHashPepper,
    );

    const session = await this.authSessionRepository.findByAccessTokenHash({
      accessTokenHash,
    });

    if (!session) {
      throw AppError.invalidCredentials('The authorization token is invalid.');
    }

    const profile = await this.authUserRepository.getByAuthUserId({
      authUserId: providerResult.user.id,
    });

    assertResolvedIdentityMatches({
      providerAuthUserId: providerResult.user.id,
      profile,
      session,
    });

    attachAuthContextToRequest(
      request,
      buildAuthContext({
        request,
        profile,
        session,
      }),
    );

    return true;
  }

  private isPublicRoute(context: ExecutionContext): boolean {
    const metadata = this.reflector.getAllAndOverride<unknown>(
      AUTH_PUBLIC_ROUTE_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    return isPublicRouteMetadataValue(metadata);
  }
}
