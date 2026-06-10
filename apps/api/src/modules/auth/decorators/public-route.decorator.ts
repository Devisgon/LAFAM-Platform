// apps/api/src/modules/auth/decorators/public-route.decorator.ts
/**
 * LAFAM Auth public-route decorator.
 *
 * Role:
 * - Marks routes that do not require authenticated access.
 * - Allows AuthGuard to skip bearer-token enforcement for public endpoints.
 * - Keeps public route metadata centralized and reusable.
 *
 * Important:
 * - Public does not mean unrestricted business access.
 * - Public routes must still use DTO validation, throttling where needed, and safe error responses.
 * - Protected routes should not use this decorator.
 */

import { SetMetadata } from '@nestjs/common';

export const AUTH_PUBLIC_ROUTE_METADATA_KEY = 'lafam:auth:public_route';

export const PublicRoute = (): MethodDecorator & ClassDecorator =>
  SetMetadata(AUTH_PUBLIC_ROUTE_METADATA_KEY, true);

export function isPublicRouteMetadataValue(value: unknown): value is true {
  return value === true;
}
