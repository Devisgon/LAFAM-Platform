// apps/api/src/modules/auth/dto/resend-verification-otp.dto.ts
/**
 * LAFAM Auth resend verification OTP DTO.
 *
 * Role:
 * - Validates resend-email-verification request payloads.
 * - Normalizes email before service use.
 * - Keeps resend verification input intentionally minimal.
 *
 * Important:
 * - This DTO does not reveal whether the email exists.
 * - Public response behavior should remain service-controlled.
 * - Supabase handles OTP delivery; LAFAM normalizes and audits the request.
 */

import { Transform, type TransformFnParams } from 'class-transformer';
import { IsEmail, MaxLength } from 'class-validator';

import { AUTH_FIELD_LIMITS } from '../constants/auth.constants';
import { normalizeAuthEmail } from '../utils/auth-normalization.util';

function transformStringValue(
  params: TransformFnParams,
  normalizer: (value: string) => string,
): unknown {
  return typeof params.value === 'string'
    ? normalizer(params.value)
    : params.value;
}

export class ResendVerificationOtpDto {
  @Transform((params) =>
    transformStringValue(params, (value) => normalizeAuthEmail(value)),
  )
  @IsEmail({}, { message: 'email must be a valid email address.' })
  @MaxLength(AUTH_FIELD_LIMITS.emailMaxLength, {
    message: `email must be at most ${AUTH_FIELD_LIMITS.emailMaxLength} characters long.`,
  })
  readonly email!: string;
}
