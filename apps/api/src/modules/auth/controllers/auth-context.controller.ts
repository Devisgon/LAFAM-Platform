// apps/api/src/modules/auth/controllers/auth-context.controller.ts
/**
 * LAFAM Auth context controller.
 *
 * Role:
 * - Exposes authenticated frontend Auth bootstrapping context.
 * - Returns the current user, session, permissions, and access flags.
 * - Keeps controller logic thin and delegates context construction/auditing to AuthContextService.
 *
 * Important:
 * - AuthGuard resolves the Bearer token and attaches Auth context.
 * - ActiveSessionGuard rejects revoked, expired, deleted, deactivated, and invalid guest sessions.
 * - Frontend access flags are usability helpers only.
 * - Backend guards/services remain the final authorization authority.
 */

import { Controller, Get, HttpStatus, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { AppError } from '../../../common/errors/app-error';
import {
  createApiSuccessResponse,
  type ApiSuccessResponse,
} from '../../../common/responses/api-response';
import { AuthContextService } from '../application/auth-context.service';
import type { AuthenticatedRequest } from '../decorators/current-user.decorator';
import { ActiveSessionGuard } from '../guards/active-session.guard';
import { AuthGuard } from '../guards/auth.guard';
import type { AuthInternalContext } from '../types/auth-context.types';
import type { AuthContextResponse } from '../types/auth-response.types';

function resolveAuthContext(request: Request): AuthInternalContext {
  const authenticatedRequest = request as AuthenticatedRequest;

  if (!authenticatedRequest.auth) {
    throw AppError.authenticationRequired('Authentication is required.');
  }

  return authenticatedRequest.auth;
}

@Controller('auth')
@UseGuards(AuthGuard, ActiveSessionGuard)
export class AuthContextController {
  constructor(private readonly authContextService: AuthContextService) {}

  @Get('context')
  async getAuthContext(
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<AuthContextResponse>> {
    const data = await this.authContextService.getAuthContext(
      resolveAuthContext(request),
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Auth context resolved successfully.',
      data,
    });
  }
}
