// apps/api/src/modules/auth/controllers/auth-session.controller.ts
/**
 * LAFAM Auth session controller.
 *
 * Role:
 * - Exposes authenticated session-management endpoints.
 * - Allows the current user to logout, logout all sessions, list active sessions, and revoke one owned session.
 * - Keeps controller logic thin and delegates business/session rules to AuthSessionService.
 *
 * Important:
 * - AuthGuard resolves the Bearer token and attaches Auth context.
 * - ActiveSessionGuard rejects revoked, expired, deleted, deactivated, and invalid guest sessions.
 * - Controllers must not log raw access tokens, refresh tokens, passwords, OTPs, or token hashes.
 */

import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { AppError } from '../../../common/errors/app-error';
import {
  createApiSuccessResponse,
  type ApiSuccessResponse,
} from '../../../common/responses/api-response';
import { AuthSessionService } from '../application/auth-session.service';
import type { AuthenticatedRequest } from '../decorators/current-user.decorator';
import { RevokeSessionParamDto } from '../dto/revoke-session-param.dto';
import { ActiveSessionGuard } from '../guards/active-session.guard';
import { AuthGuard } from '../guards/auth.guard';
import type { AuthInternalContext } from '../types/auth-context.types';
import type {
  AuthLogoutAllResponse,
  AuthLogoutResponse,
  AuthRevokeSessionResponse,
  AuthSessionListResponse,
} from '../types/auth-response.types';

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

function resolveRequestMetadata(request: Request): {
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
} {
  return {
    ipAddress: resolveClientIp(request),
    userAgent: resolveUserAgent(request),
  };
}

function resolveAuthContext(request: Request): AuthInternalContext {
  const authenticatedRequest = request as AuthenticatedRequest;

  if (!authenticatedRequest.auth) {
    throw AppError.authenticationRequired('Authentication is required.');
  }

  return authenticatedRequest.auth;
}

function resolveBearerAccessToken(request: Request): string | null {
  const authorizationHeader = extractHeaderValue(request.headers.authorization);

  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token, ...extraParts] = authorizationHeader.split(/\s+/u);

  if (
    scheme?.toLowerCase() !== 'bearer' ||
    !token ||
    token.trim().length === 0 ||
    extraParts.length > 0
  ) {
    return null;
  }

  return token;
}

@Controller('auth')
@UseGuards(AuthGuard, ActiveSessionGuard)
export class AuthSessionController {
  constructor(private readonly authSessionService: AuthSessionService) {}

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<AuthLogoutResponse>> {
    const data = await this.authSessionService.logout(
      resolveAuthContext(request),
      {
        accessToken: resolveBearerAccessToken(request),
      },
      resolveRequestMetadata(request),
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Logout successful.',
      data,
    });
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<AuthLogoutAllResponse>> {
    const data = await this.authSessionService.logoutAll(
      resolveAuthContext(request),
      {
        accessToken: resolveBearerAccessToken(request),
      },
      resolveRequestMetadata(request),
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'All sessions logged out successfully.',
      data,
    });
  }

  @Get('sessions')
  async listActiveSessions(
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<AuthSessionListResponse>> {
    const data = await this.authSessionService.listActiveSessions(
      resolveAuthContext(request),
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Active sessions retrieved successfully.',
      data,
    });
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.OK)
  async revokeSession(
    @Param() params: RevokeSessionParamDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<AuthRevokeSessionResponse>> {
    const data = await this.authSessionService.revokeSession(
      resolveAuthContext(request),
      {
        sessionId: params.sessionId,
      },
      resolveRequestMetadata(request),
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Session revoked successfully.',
      data,
    });
  }
}
