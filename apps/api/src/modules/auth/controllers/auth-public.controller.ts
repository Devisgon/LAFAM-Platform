// apps/api/src/modules/auth/controllers/auth-public.controller.ts
/**
 * LAFAM public Auth controller.
 *
 * Role:
 * - Exposes public authentication endpoints.
 * - Keeps controllers thin by delegating business logic to Auth services.
 * - Wraps successful service data with the standard API success response envelope.
 *
 * Important:
 * - This controller is public by route metadata.
 * - Services own validation beyond DTO structure, provider calls, session creation, and audit events.
 * - Controllers must not log passwords, OTPs, raw access tokens, refresh tokens, or reset tokens.
 */

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  createApiSuccessResponse,
  type ApiSuccessResponse,
} from '../../../common/responses/api-response';
import { AuthService } from '../application/auth.service';
import { PasswordResetService } from '../application/password-reset.service';
import { PublicRoute } from '../decorators/public-route.decorator';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { ResendVerificationOtpDto } from '../dto/resend-verification-otp.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { SignUpDto } from '../dto/sign-up.dto';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { VerifyResetOtpDto } from '../dto/verify-reset-otp.dto';
import type {
  AuthEmailVerificationResponse,
  AuthForgotPasswordResponse,
  AuthLoginResponse,
  AuthRefreshTokenResponse,
  AuthResendVerificationOtpResponse,
  AuthResetPasswordResponse,
  AuthSignUpResponse,
  AuthVerifyResetOtpResponse,
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
@PublicRoute()
@Controller('auth')
export class AuthPublicController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  @Post('sign-up')
  async signUp(
    @Body() dto: SignUpDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<AuthSignUpResponse>> {
    const data = await this.authService.signUp(
      dto,
      resolveRequestMetadata(request),
    );

    return createApiSuccessResponse({
      status: HttpStatus.CREATED,
      message: 'Account created successfully. Please verify your email.',
      data,
    });
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<AuthEmailVerificationResponse>> {
    const data = await this.authService.verifyEmail(
      dto,
      resolveRequestMetadata(request),
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Email verified successfully.',
      data,
    });
  }

  @Post('resend-verification-otp')
  @HttpCode(HttpStatus.OK)
  async resendVerificationOtp(
    @Body() dto: ResendVerificationOtpDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<AuthResendVerificationOtpResponse>> {
    const data = await this.authService.resendVerificationOtp(
      dto,
      resolveRequestMetadata(request),
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Verification code sent successfully.',
      data,
    });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<AuthLoginResponse>> {
    const data = await this.authService.login(
      dto,
      resolveRequestMetadata(request),
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Login successful.',
      data,
    });
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Body() dto: RefreshTokenDto,
  ): Promise<ApiSuccessResponse<AuthRefreshTokenResponse>> {
    const data = await this.authService.refreshToken(dto);

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Token refreshed successfully.',
      data,
    });
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<ApiSuccessResponse<AuthForgotPasswordResponse>> {
    const data = await this.passwordResetService.forgotPassword(dto);

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Password reset code sent successfully.',
      data,
    });
  }

  @Post('verify-reset-otp')
  @HttpCode(HttpStatus.OK)
  async verifyResetOtp(
    @Body() dto: VerifyResetOtpDto,
  ): Promise<ApiSuccessResponse<AuthVerifyResetOtpResponse>> {
    const data = await this.passwordResetService.verifyResetOtp(dto);

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Password reset code verified successfully.',
      data,
    });
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<ApiSuccessResponse<AuthResetPasswordResponse>> {
    const data = await this.passwordResetService.resetPassword(dto);

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Password reset successfully.',
      data,
    });
  }
}
