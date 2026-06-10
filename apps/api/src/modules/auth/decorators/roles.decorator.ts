// apps/api/src/modules/auth/decorators/roles.decorator.ts
/**
 * LAFAM Auth roles decorator.
 *
 * Role:
 * - Attaches required role metadata to protected routes.
 * - Allows RolesGuard to enforce role-based access.
 * - Keeps controller authorization declarations explicit.
 *
 * Important:
 * - This decorator does not authenticate requests.
 * - AuthGuard and ActiveSessionGuard must run before role enforcement.
 * - Frontend role checks are only usability hints; backend guards remain final authority.
 */

import { SetMetadata } from '@nestjs/common';

import type { AuthUserRole } from '../constants/auth-role.constants';

export const AUTH_ROLES_METADATA_KEY = 'lafam:auth:roles';

export const Roles = (
  ...roles: readonly AuthUserRole[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(AUTH_ROLES_METADATA_KEY, roles);

export function isAuthRolesMetadataValue(
  value: unknown,
): value is readonly AuthUserRole[] {
  return (
    Array.isArray(value) && value.every((role) => typeof role === 'string')
  );
}
