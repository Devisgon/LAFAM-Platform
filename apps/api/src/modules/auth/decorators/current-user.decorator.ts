// apps/api/src/modules/auth/decorators/current-user.decorator.ts
/**
 * LAFAM Auth current-user decorator.
 *
 * Role:
 * - Reads the resolved Auth context attached to the request by Auth guards.
 * - Gives controllers a typed way to access the authenticated user, profile, session, or full Auth context.
 * - Keeps controller method signatures clean.
 *
 * Important:
 * - This decorator does not authenticate requests.
 * - AuthGuard and ActiveSessionGuard must resolve and attach request.auth before this decorator is used.
 * - Public routes must not depend on this decorator.
 */

import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type {
  AuthenticatedRequestContext,
  AuthInternalContext,
} from '../types/auth-context.types';
import type { AuthResolvedSession } from '../types/auth-session.types';
import type {
  AuthResolvedUser,
  AuthUserInternalProfile,
} from '../types/auth-user.types';

export type CurrentAuthSelector = 'context' | 'user' | 'profile' | 'session';

export interface AuthenticatedRequest extends Request {
  readonly auth?: AuthInternalContext;
}

function getAuthenticatedRequest(
  context: ExecutionContext,
): AuthenticatedRequest {
  return context.switchToHttp().getRequest<AuthenticatedRequest>();
}

function getAuthContextFromRequest(
  request: AuthenticatedRequest,
): AuthInternalContext | undefined {
  return request.auth;
}

export const CurrentAuth = createParamDecorator(
  (
    _data: unknown,
    context: ExecutionContext,
  ): AuthInternalContext | undefined =>
    getAuthContextFromRequest(getAuthenticatedRequest(context)),
);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthResolvedUser | undefined =>
    getAuthContextFromRequest(getAuthenticatedRequest(context))?.user,
);

export const CurrentUserProfile = createParamDecorator(
  (
    _data: unknown,
    context: ExecutionContext,
  ): AuthUserInternalProfile | undefined =>
    getAuthContextFromRequest(getAuthenticatedRequest(context))?.profile,
);

export const CurrentSession = createParamDecorator(
  (
    _data: unknown,
    context: ExecutionContext,
  ): AuthResolvedSession | undefined =>
    getAuthContextFromRequest(getAuthenticatedRequest(context))?.session,
);

export function attachAuthContextToRequest(
  request: Request,
  auth: AuthInternalContext,
): asserts request is Request & AuthenticatedRequestContext {
  Object.defineProperty(request, 'auth', {
    value: auth,
    writable: false,
    enumerable: false,
    configurable: true,
  });
}
