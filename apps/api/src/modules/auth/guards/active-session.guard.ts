// apps/api/src/modules/auth/guards/active-session.guard.ts
/**
 * LAFAM active-session guard.
 *
 * Role:
 * - Enforces LAFAM-owned session state after AuthGuard resolves the request Auth context.
 * - Rejects revoked, expired, converted, deleted, deactivated, or unverified identities.
 * - Enforces guest-session expiry at request time.
 *
 * Important:
 * - AuthGuard verifies the Bearer token and attaches request.auth.
 * - This guard verifies that the resolved LAFAM session/user can still access protected APIs.
 * - RolesGuard handles role-specific authorization separately.
 * - Public routes must pass through without requiring request.auth.
 */

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { currentAuthConfig } from '../../../common/config';
import { AppError } from '../../../common/errors/app-error';
import { AUTH_GUEST_ROLE } from '../constants/auth-role.constants';
import {
  AUTH_SESSION_TYPE_GUEST,
  AUTH_USER_STATUS_DEACTIVATED,
  AUTH_USER_STATUS_DELETED,
  AUTH_USER_STATUS_PENDING_EMAIL_VERIFICATION,
  isAuthAccessAllowedUserStatus,
} from '../constants/auth.constants';
import type { AuthenticatedRequest } from '../decorators/current-user.decorator';
import {
  AUTH_PUBLIC_ROUTE_METADATA_KEY,
  isPublicRouteMetadataValue,
} from '../decorators/public-route.decorator';
import { GuestSessionService } from '../application/guest-session.service';
import type { AuthInternalContext } from '../types/auth-context.types';

function resolveRequestFromContext(
  context: ExecutionContext,
): AuthenticatedRequest {
  return context.switchToHttp().getRequest<AuthenticatedRequest>();
}

function isIsoDateExpired(value: string | null, now = new Date()): boolean {
  if (!value) {
    return false;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return true;
  }

  return parsedDate.getTime() <= now.getTime();
}

function isRequiredIsoDateExpired(
  value: string | null,
  now = new Date(),
): boolean {
  if (!value) {
    return true;
  }

  return isIsoDateExpired(value, now);
}

function resolveAuthContextFromRequest(
  request: AuthenticatedRequest,
): AuthInternalContext {
  if (!request.auth) {
    throw AppError.authenticationRequired('Authentication is required.');
  }

  return request.auth;
}

function isGuestAuthContext(auth: AuthInternalContext): boolean {
  return (
    auth.profile.role === AUTH_GUEST_ROLE ||
    auth.profile.isGuest ||
    auth.session.sessionType === AUTH_SESSION_TYPE_GUEST
  );
}

function assertGuestContextIsConsistent(auth: AuthInternalContext): void {
  if (!isGuestAuthContext(auth)) {
    return;
  }

  if (
    auth.profile.role !== AUTH_GUEST_ROLE ||
    !auth.profile.isGuest ||
    auth.session.sessionType !== AUTH_SESSION_TYPE_GUEST
  ) {
    throw AppError.guestSessionRequired(
      'A valid guest session is required for this action.',
    );
  }
}

function assertUserStatusAllowsAccess(auth: AuthInternalContext): void {
  if (isAuthAccessAllowedUserStatus(auth.profile.status)) {
    return;
  }

  if (auth.profile.status === AUTH_USER_STATUS_PENDING_EMAIL_VERIFICATION) {
    throw AppError.emailNotVerified(
      'Please verify your email before continuing.',
    );
  }

  if (auth.profile.status === AUTH_USER_STATUS_DEACTIVATED) {
    throw AppError.accountDeactivated('This account has been deactivated.');
  }

  if (auth.profile.status === AUTH_USER_STATUS_DELETED) {
    throw AppError.accountDeleted('This account has been deleted.');
  }

  throw AppError.authorizationDenied(
    'This account cannot access protected features.',
  );
}

function assertSessionIsNotRevoked(auth: AuthInternalContext): void {
  if (!auth.session.revokedAt) {
    return;
  }

  if (isGuestAuthContext(auth)) {
    throw AppError.guestSessionRevoked('The guest session has been revoked.');
  }

  throw AppError.sessionRevoked('The session has been revoked.');
}

function assertSessionIsNotConverted(auth: AuthInternalContext): void {
  if (!auth.session.convertedAt) {
    return;
  }

  if (isGuestAuthContext(auth)) {
    throw AppError.guestAlreadyConverted(
      'The guest session has already been converted.',
    );
  }

  throw AppError.sessionRevoked('The session has been converted.');
}

@Injectable()
export class ActiveSessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly guestSessionService: GuestSessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublicRoute(context)) {
      return true;
    }

    const request = resolveRequestFromContext(context);
    const auth = resolveAuthContextFromRequest(request);

    assertUserStatusAllowsAccess(auth);
    assertGuestContextIsConsistent(auth);
    assertSessionIsNotRevoked(auth);
    assertSessionIsNotConverted(auth);

    await this.assertSessionIsNotExpired(auth);

    return true;
  }

  private async assertSessionIsNotExpired(
    auth: AuthInternalContext,
  ): Promise<void> {
    if (isRequiredIsoDateExpired(auth.session.expiresAt)) {
      await this.expireGuestSessionIfNeeded(auth);

      if (isGuestAuthContext(auth)) {
        throw AppError.guestSessionExpired('The guest session has expired.');
      }

      throw AppError.sessionExpired('The session has expired.');
    }

    if (
      isGuestAuthContext(auth) &&
      isRequiredIsoDateExpired(auth.profile.guestExpiresAt)
    ) {
      await this.expireGuestSessionIfNeeded(auth);

      throw AppError.guestSessionExpired('The guest session has expired.');
    }
  }

  private async expireGuestSessionIfNeeded(
    auth: AuthInternalContext,
  ): Promise<void> {
    if (!isGuestAuthContext(auth)) {
      return;
    }

    if (!currentAuthConfig.guest.cleanupEnabled) {
      return;
    }

    await this.guestSessionService.expireGuestSession({
      userId: auth.profile.id,
      sessionId: auth.session.id,
    });
  }

  private isPublicRoute(context: ExecutionContext): boolean {
    const metadata = this.reflector.getAllAndOverride<unknown>(
      AUTH_PUBLIC_ROUTE_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    return isPublicRouteMetadataValue(metadata);
  }
}
