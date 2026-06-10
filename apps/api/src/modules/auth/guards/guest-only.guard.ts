// apps/api/src/modules/auth/guards/guest-only.guard.ts
/**
 * LAFAM guest-only guard.
 *
 * Role:
 * - Allows only authenticated guest users to access guest-only routes.
 * - Enforces role = guest, status = guest_active, is_guest = true, and session_type = guest.
 * - Keeps guest-only route authorization separate from generic role checks.
 *
 * Important:
 * - This guard does not authenticate tokens.
 * - AuthGuard must run before this guard.
 * - ActiveSessionGuard should run before or alongside this guard for revoked/expired session checks.
 * - Public routes pass through without guest enforcement.
 */

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AppError } from '../../../common/errors/app-error';
import { AUTH_GUEST_ROLE } from '../constants/auth-role.constants';
import {
  AUTH_SESSION_TYPE_GUEST,
  AUTH_USER_STATUS_GUEST_ACTIVE,
} from '../constants/auth.constants';
import type { AuthenticatedRequest } from '../decorators/current-user.decorator';
import {
  AUTH_PUBLIC_ROUTE_METADATA_KEY,
  isPublicRouteMetadataValue,
} from '../decorators/public-route.decorator';
import type { AuthInternalContext } from '../types/auth-context.types';

function resolveRequestFromContext(
  context: ExecutionContext,
): AuthenticatedRequest {
  return context.switchToHttp().getRequest<AuthenticatedRequest>();
}

function resolveAuthContextFromRequest(
  request: AuthenticatedRequest,
): AuthInternalContext {
  if (!request.auth) {
    throw AppError.authenticationRequired('Authentication is required.');
  }

  return request.auth;
}

function assertGuestIdentity(auth: AuthInternalContext): void {
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
}

function assertGuestSessionState(auth: AuthInternalContext): void {
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
export class GuestOnlyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.isPublicRoute(context)) {
      return true;
    }

    const request = resolveRequestFromContext(context);
    const auth = resolveAuthContextFromRequest(request);

    assertGuestIdentity(auth);
    assertGuestSessionState(auth);

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
