// apps/api/src/modules/auth/guards/roles.guard.ts
/**
 * LAFAM roles guard.
 *
 * Role:
 * - Enforces @Roles(...) metadata on protected routes.
 * - Uses the Auth context attached by AuthGuard.
 * - Keeps route-level RBAC enforcement centralized.
 *
 * Important:
 * - This guard does not authenticate tokens.
 * - AuthGuard must run before this guard.
 * - ActiveSessionGuard should run before or alongside this guard for revoked/expired session checks.
 * - Public routes pass through without role enforcement.
 */

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AppError } from '../../../common/errors/app-error';
import type { AuthUserRole } from '../constants/auth-role.constants';
import type { AuthenticatedRequest } from '../decorators/current-user.decorator';
import {
  AUTH_PUBLIC_ROUTE_METADATA_KEY,
  isPublicRouteMetadataValue,
} from '../decorators/public-route.decorator';
import {
  AUTH_ROLES_METADATA_KEY,
  isAuthRolesMetadataValue,
} from '../decorators/roles.decorator';
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

function hasRequiredRole(
  userRole: AuthUserRole,
  requiredRoles: readonly AuthUserRole[],
): boolean {
  return requiredRoles.includes(userRole);
}

function isSuperAdminOnlyRoute(
  requiredRoles: readonly AuthUserRole[],
): boolean {
  return requiredRoles.length === 1 && requiredRoles[0] === 'super_admin';
}

function isAdminRoute(requiredRoles: readonly AuthUserRole[]): boolean {
  return (
    requiredRoles.includes('admin') || requiredRoles.includes('super_admin')
  );
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.isPublicRoute(context)) {
      return true;
    }

    const requiredRoles = this.resolveRequiredRoles(context);

    if (requiredRoles.length === 0) {
      return true;
    }

    const request = resolveRequestFromContext(context);
    const auth = resolveAuthContextFromRequest(request);

    if (hasRequiredRole(auth.profile.role, requiredRoles)) {
      return true;
    }

    if (isSuperAdminOnlyRoute(requiredRoles)) {
      throw AppError.superAdminRequired('Super admin access is required.');
    }

    if (isAdminRoute(requiredRoles)) {
      throw AppError.adminAccessRequired('Admin access is required.');
    }

    throw AppError.authorizationDenied(
      'You do not have permission to perform this action.',
    );
  }

  private resolveRequiredRoles(
    context: ExecutionContext,
  ): readonly AuthUserRole[] {
    const metadata = this.reflector.getAllAndOverride<unknown>(
      AUTH_ROLES_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    return isAuthRolesMetadataValue(metadata) ? metadata : [];
  }

  private isPublicRoute(context: ExecutionContext): boolean {
    const metadata = this.reflector.getAllAndOverride<unknown>(
      AUTH_PUBLIC_ROUTE_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    return isPublicRouteMetadataValue(metadata);
  }
}
