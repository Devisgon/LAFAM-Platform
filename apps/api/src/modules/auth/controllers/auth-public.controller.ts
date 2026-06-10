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

import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

import {
  createApiSuccessResponse,
  type ApiSuccessResponse,
} from '../../../common/responses/api-response';
import { AuthService } from '../application/auth.service';
import { PasswordResetService } from '../application/password-reset.service';
import { PublicRoute } from '../decorators/public-route.decorator';
import type { ForgotPasswordDto } from '../dto/forgot-password.dto';
import type { LoginDto } from '../dto/login.dto';
import type { RefreshTokenDto } from '../dto/refresh-token.dto';
import type { ResendVerificationOtpDto } from '../dto/resend-verification-otp.dto';
import type { ResetPasswordDto } from '../dto/reset-password.dto';
import type { SignUpDto } from '../dto/sign-up.dto';
import type { VerifyEmailDto } from '../dto/verify-email.dto';
import type { VerifyResetOtpDto } from '../dto/verify-reset-otp.dto';
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
  ): Promise<ApiSuccessResponse<AuthSignUpResponse>> {
    const data = await this.authService.signUp(dto);

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
  ): Promise<ApiSuccessResponse<AuthEmailVerificationResponse>> {
    const data = await this.authService.verifyEmail(dto);

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
  ): Promise<ApiSuccessResponse<AuthResendVerificationOtpResponse>> {
    const data = await this.authService.resendVerificationOtp(dto);

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
  ): Promise<ApiSuccessResponse<AuthLoginResponse>> {
    const data = await this.authService.login(dto);

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
