// apps/api/src/modules/auth/dto/verify-email.dto.ts
/**
 * LAFAM Auth verify-email DTO.
 *
 * Role:
 * - Validates email verification OTP request payloads.
 * - Normalizes email and OTP before service use.
 * - Supports normal signup verification and guest-to-customer conversion verification.
 *
 * Important:
 * - This DTO does not decide account state.
 * - Supabase verifies the OTP.
 * - The Auth service activates the LAFAM app user after provider verification succeeds.
 */

import { Transform, type TransformFnParams } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

import { AUTH_FIELD_LIMITS } from '../constants/auth.constants';
import {
  normalizeAuthEmail,
  normalizeAuthOtp,
} from '../utils/auth-normalization.util';

function transformStringValue(
  params: TransformFnParams,
  normalizer: (value: string) => string,
): unknown {
  return typeof params.value === 'string'
    ? normalizer(params.value)
    : params.value;
}

export class VerifyEmailDto {
  @Transform((params) =>
    transformStringValue(params, (value) => normalizeAuthEmail(value)),
  )
  @IsEmail({}, { message: 'email must be a valid email address.' })
  @MaxLength(AUTH_FIELD_LIMITS.emailMaxLength, {
    message: `email must be at most ${AUTH_FIELD_LIMITS.emailMaxLength} characters long.`,
  })
  readonly email!: string;

  @Transform((params) => transformStringValue(params, normalizeAuthOtp))
  @IsString({ message: 'otp must be a string.' })
  @MinLength(AUTH_FIELD_LIMITS.otpMinLength, {
    message: `otp must be at least ${AUTH_FIELD_LIMITS.otpMinLength} characters long.`,
  })
  @MaxLength(AUTH_FIELD_LIMITS.otpMaxLength, {
    message: `otp must be at most ${AUTH_FIELD_LIMITS.otpMaxLength} characters long.`,
  })
  readonly otp!: string;
}
