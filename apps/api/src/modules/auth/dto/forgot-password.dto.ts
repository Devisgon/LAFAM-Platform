// apps/api/src/modules/auth/dto/forgot-password.dto.ts
/**
 * LAFAM Auth forgot-password DTO.
 *
 * Role:
 * - Validates forgot-password request payloads.
 * - Normalizes email before service use.
 * - Keeps password reset request input intentionally minimal.
 *
 * Important:
 * - This DTO does not reveal whether an account exists.
 * - Public response behavior must remain service-controlled.
 * - Supabase handles reset OTP delivery; LAFAM tracks reset challenge state.
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

export class ForgotPasswordDto {
  @Transform((params) =>
    transformStringValue(params, (value) => normalizeAuthEmail(value)),
  )
  @IsEmail({}, { message: 'email must be a valid email address.' })
  @MaxLength(AUTH_FIELD_LIMITS.emailMaxLength, {
    message: `email must be at most ${AUTH_FIELD_LIMITS.emailMaxLength} characters long.`,
  })
  readonly email!: string;
}
