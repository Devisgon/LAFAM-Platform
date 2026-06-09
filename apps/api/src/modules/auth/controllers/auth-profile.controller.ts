// apps/api/src/modules/auth/controllers/auth-profile.controller.ts
/**
 * LAFAM Auth profile controller.
 *
 * Role:
 * - Exposes authenticated self-profile endpoints.
 * - Exposes avatar upload/read endpoints.
 * - Exposes password-change and self account-delete endpoints.
 * - Keeps controller logic thin and delegates business rules to services.
 *
 * Important:
 * - AuthGuard resolves the Bearer token and attaches Auth context.
 * - ActiveSessionGuard rejects revoked, expired, deleted, deactivated, and invalid guest sessions.
 * - Services enforce guest restrictions for profile mutation, avatar upload, password change, and account deletion.
 * - Controllers must not log raw access tokens, refresh tokens, passwords, OTPs, or token hashes.
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';

import { AppError } from '../../../common/errors/app-error';
import {
  createApiSuccessResponse,
  type ApiSuccessResponse,
} from '../../../common/responses/api-response';
import {
  AuthProfileService,
  type AuthProfileServiceRequestMetadata,
} from '../application/auth-profile.service';
import {
  AvatarService,
  type AuthAvatarUploadFile,
} from '../application/avatar.service';
import type { AuthenticatedRequest } from '../decorators/current-user.decorator';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { ActiveSessionGuard } from '../guards/active-session.guard';
import { AuthGuard } from '../guards/auth.guard';
import type { AuthInternalContext } from '../types/auth-context.types';
import type {
  AuthAvatarResponse,
  AuthAvatarUploadResponse,
  AuthChangePasswordResponse,
  AuthCurrentUserResponse,
  AuthDeleteAccountResponse,
  AuthUpdateProfileResponse,
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

function resolveRequestMetadata(
  request: Request,
): AuthProfileServiceRequestMetadata {
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

@Controller('auth')
@UseGuards(AuthGuard, ActiveSessionGuard)
export class AuthProfileController {
  constructor(
    private readonly authProfileService: AuthProfileService,
    private readonly avatarService: AvatarService,
  ) {}

  @Get('me')
  getCurrentUser(
    @Req() request: Request,
  ): ApiSuccessResponse<AuthCurrentUserResponse> {
    const data = this.authProfileService.getCurrentUser(
      resolveAuthContext(request),
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Current user retrieved successfully.',
      data,
    });
  }

  @Patch('profile')
  async updateProfile(
    @Body() dto: UpdateProfileDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<AuthUpdateProfileResponse>> {
    const data = await this.authProfileService.updateProfile(
      resolveAuthContext(request),
      dto,
      resolveRequestMetadata(request),
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Profile updated successfully.',
      data,
    });
  }

  @Post('avatar')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('avatar'))
  async uploadAvatar(
    @UploadedFile() file: AuthAvatarUploadFile | undefined,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<AuthAvatarUploadResponse>> {
    const data = await this.avatarService.uploadAvatar(
      resolveAuthContext(request),
      file ?? null,
      resolveRequestMetadata(request),
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Avatar uploaded successfully.',
      data,
    });
  }

  @Get('avatar')
  async getAvatar(
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<AuthAvatarResponse>> {
    const data = await this.avatarService.getAvatar(
      resolveAuthContext(request),
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Avatar retrieved successfully.',
      data,
    });
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<AuthChangePasswordResponse>> {
    const data = await this.authProfileService.changePassword(
      resolveAuthContext(request),
      dto,
      resolveRequestMetadata(request),
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Password changed successfully.',
      data,
    });
  }

  @Delete('delete-account')
  @HttpCode(HttpStatus.OK)
  async deleteAccount(
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<AuthDeleteAccountResponse>> {
    const data = await this.authProfileService.deleteAccount(
      resolveAuthContext(request),
      resolveRequestMetadata(request),
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Account deleted successfully.',
      data,
    });
  }
}
