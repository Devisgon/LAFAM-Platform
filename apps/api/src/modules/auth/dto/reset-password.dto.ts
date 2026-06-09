// apps/api/src/modules/auth/dto/reset-password.dto.ts
/**
 * LAFAM Auth reset-password DTO.
 *
 * Role:
 * - Validates reset-password request payloads.
 * - Normalizes email and reset token before service use.
 * - Keeps password values unchanged because passwords must not be trimmed or mutated.
 *
 * Important:
 * - This DTO does not verify reset-token ownership.
 * - The password-reset service must hash and validate the reset token.
 * - Raw reset tokens must never be stored or logged.
 */

import { Transform, type TransformFnParams } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

import { AUTH_FIELD_LIMITS } from '../constants/auth.constants';
import {
  normalizeAuthEmail,
  normalizeAuthResetToken,
} from '../utils/auth-normalization.util';

function transformStringValue(
  params: TransformFnParams,
  normalizer: (value: string) => string,
): unknown {
  return typeof params.value === 'string'
    ? normalizer(params.value)
    : params.value;
}

export class ResetPasswordDto {
  @Transform((params) =>
    transformStringValue(params, (value) => normalizeAuthEmail(value)),
  )
  @IsEmail({}, { message: 'email must be a valid email address.' })
  @MaxLength(AUTH_FIELD_LIMITS.emailMaxLength, {
    message: `email must be at most ${AUTH_FIELD_LIMITS.emailMaxLength} characters long.`,
  })
  readonly email!: string;

  @Transform((params) => transformStringValue(params, normalizeAuthResetToken))
  @IsString({ message: 'reset_token must be a string.' })
  @MinLength(1, {
    message: 'reset_token is required.',
  })
  @MaxLength(AUTH_FIELD_LIMITS.resetTokenMaxLength, {
    message: `reset_token must be at most ${AUTH_FIELD_LIMITS.resetTokenMaxLength} characters long.`,
  })
  readonly reset_token!: string;

  @IsString({ message: 'password must be a string.' })
  @MinLength(AUTH_FIELD_LIMITS.passwordMinLength, {
    message: `password must be at least ${AUTH_FIELD_LIMITS.passwordMinLength} characters long.`,
  })
  @MaxLength(AUTH_FIELD_LIMITS.passwordMaxLength, {
    message: `password must be at most ${AUTH_FIELD_LIMITS.passwordMaxLength} characters long.`,
  })
  readonly password!: string;

  @IsString({ message: 'confirm_password must be a string.' })
  @MinLength(AUTH_FIELD_LIMITS.passwordMinLength, {
    message: `confirm_password must be at least ${AUTH_FIELD_LIMITS.passwordMinLength} characters long.`,
  })
  @MaxLength(AUTH_FIELD_LIMITS.passwordMaxLength, {
    message: `confirm_password must be at most ${AUTH_FIELD_LIMITS.passwordMaxLength} characters long.`,
  })
  readonly confirm_password!: string;
}
