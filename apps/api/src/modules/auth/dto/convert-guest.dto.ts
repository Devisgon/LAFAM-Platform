// apps/api/src/modules/auth/dto/convert-guest.dto.ts
/**
 * LAFAM Auth convert-guest DTO.
 *
 * Role:
 * - Validates guest-to-customer conversion request payloads.
 * - Normalizes email, phone, full name, and timezone before service use.
 * - Keeps password values unchanged because passwords must not be trimmed or mutated.
 *
 * Important:
 * - This DTO intentionally has no role field.
 * - Guest conversion always creates customer account state.
 * - Guest users must never be allowed to convert into admin, staff, trainer, stylist, or super_admin.
 */

import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { AUTH_FIELD_LIMITS } from '../constants/auth.constants';
import {
  normalizeAuthEmail,
  normalizeAuthFullName,
  normalizeAuthPhone,
  normalizeAuthTimezone,
} from '../utils/auth-normalization.util';

function transformStringValue(
  params: TransformFnParams,
  normalizer: (value: string) => string | null,
): unknown {
  return typeof params.value === 'string'
    ? normalizer(params.value)
    : params.value;
}

export class ConvertGuestDto {
  @Transform((params) =>
    transformStringValue(params, (value) => normalizeAuthEmail(value)),
  )
  @IsEmail({}, { message: 'email must be a valid email address.' })
  @MaxLength(AUTH_FIELD_LIMITS.emailMaxLength, {
    message: `email must be at most ${AUTH_FIELD_LIMITS.emailMaxLength} characters long.`,
  })
  readonly email!: string;

  @Transform((params) => transformStringValue(params, normalizeAuthFullName))
  @IsString({ message: 'full_name must be a string.' })
  @MaxLength(AUTH_FIELD_LIMITS.fullNameMaxLength, {
    message: `full_name must be at most ${AUTH_FIELD_LIMITS.fullNameMaxLength} characters long.`,
  })
  readonly full_name!: string;

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

  @Transform((params) => transformStringValue(params, normalizeAuthPhone))
  @IsOptional()
  @IsString({ message: 'phone must be a string.' })
  @MaxLength(AUTH_FIELD_LIMITS.phoneMaxLength, {
    message: `phone must be at most ${AUTH_FIELD_LIMITS.phoneMaxLength} characters long.`,
  })
  @Matches(/^\+?[1-9]\d{6,15}$/u, {
    message: 'phone must be a valid international phone number without spaces.',
  })
  readonly phone?: string | null;

  @Transform((params) => transformStringValue(params, normalizeAuthTimezone))
  @IsOptional()
  @IsString({ message: 'timezone must be a string.' })
  @MaxLength(AUTH_FIELD_LIMITS.timezoneMaxLength, {
    message: `timezone must be at most ${AUTH_FIELD_LIMITS.timezoneMaxLength} characters long.`,
  })
  @Matches(/^[A-Za-z]+(?:[/_-][A-Za-z0-9+_-]+)+$/u, {
    message: 'timezone must be a valid timezone value such as Asia/Kuwait.',
  })
  readonly timezone?: string | null;
}
