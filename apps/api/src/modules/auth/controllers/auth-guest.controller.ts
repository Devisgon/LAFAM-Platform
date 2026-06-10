// apps/api/src/modules/auth/controllers/auth-guest.controller.ts
/**
 * LAFAM Auth guest controller.
 *
 * Role:
 * - Exposes guest-session creation.
 * - Exposes guest-to-customer conversion.
 * - Exposes guest-session ending.
 * - Keeps controller logic thin and delegates business rules to services/guards.
 *
 * Important:
 * - Guest session creation is public.
 * - Guest conversion and guest-session ending require AuthGuard, ActiveSessionGuard, and GuestOnlyGuard.
 * - Guest conversion requires the current guest access token and refresh token.
 * - Do not log raw access tokens, refresh tokens, passwords, OTPs, or reset tokens.
 */

import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
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
import { GuestConversionService } from '../application/guest-conversion.service';
import { GuestSessionService } from '../application/guest-session.service';
import type { AuthInternalContext } from '../types/auth-context.types';
import type {
  AuthEndGuestSessionResponse,
  AuthGuestConversionResponse,
  AuthGuestSessionResponse,
} from '../types/auth-response.types';
import type { AuthenticatedRequest } from '../decorators/current-user.decorator';
import { PublicRoute } from '../decorators/public-route.decorator';
import { ConvertGuestDto } from '../dto/convert-guest.dto';
import { CreateGuestSessionDto } from '../dto/create-guest-session.dto';
import { ActiveSessionGuard } from '../guards/active-session.guard';
import { AuthGuard } from '../guards/auth.guard';
import { GuestOnlyGuard } from '../guards/guest-only.guard';

const GUEST_REFRESH_TOKEN_HEADER = 'x-refresh-token';

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

function resolveBearerAccessToken(request: Request): string {
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

  return token;
}

function resolveGuestRefreshToken(request: Request): string {
  const refreshToken = extractHeaderValue(
    request.headers[GUEST_REFRESH_TOKEN_HEADER],
  );

  if (!refreshToken) {
    throw AppError.invalidRequest(
      'Guest refresh token is required for guest conversion.',
      {
        header: GUEST_REFRESH_TOKEN_HEADER,
      },
    );
  }

  return refreshToken;
}

@Controller('auth')
export class AuthGuestController {
  constructor(
    private readonly guestSessionService: GuestSessionService,
    private readonly guestConversionService: GuestConversionService,
  ) {}

  @PublicRoute()
  @Post('guest-session')
  async createGuestSession(
    @Body() dto: CreateGuestSessionDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<AuthGuestSessionResponse>> {
    const data = await this.guestSessionService.createGuestSession(
      dto,
      resolveRequestMetadata(request),
    );

    return createApiSuccessResponse({
      status: HttpStatus.CREATED,
      message: 'Guest session created successfully.',
      data,
    });
  }

  @Post('guest/convert')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, ActiveSessionGuard, GuestOnlyGuard)
  async convertGuestToCustomer(
    @Body() dto: ConvertGuestDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<AuthGuestConversionResponse>> {
    const data = await this.guestConversionService.convertGuestToCustomer(
      resolveAuthContext(request),
      dto,
      {
        accessToken: resolveBearerAccessToken(request),
        refreshToken: resolveGuestRefreshToken(request),
      },
      resolveRequestMetadata(request),
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message:
        'Guest account conversion started successfully. Please verify your email.',
      data,
    });
  }

  @Delete('guest-session')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, ActiveSessionGuard, GuestOnlyGuard)
  async endGuestSession(
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<AuthEndGuestSessionResponse>> {
    const data = await this.guestSessionService.endGuestSession(
      resolveAuthContext(request),
      resolveRequestMetadata(request),
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Guest session ended successfully.',
      data,
    });
  }
}
