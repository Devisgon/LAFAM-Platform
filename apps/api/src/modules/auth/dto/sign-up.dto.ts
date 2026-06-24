// apps/api/src/modules/auth/dto/sign-up.dto.ts
/**
 * LAFAM Auth sign-up DTO.
 *
 * Role:
 * - Validates public customer sign-up request payloads.
 * - Normalizes email, phone, Civil ID, full name, timezone, and device metadata.
 * - Prevents public callers from choosing privileged roles.
 *
 * Important:
 * - Public sign-up always creates a customer account.
 * - This DTO intentionally has no role field.
 * - Password values must not be trimmed or mutated.
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
  normalizeAuthCivilId,
  normalizeAuthDeviceId,
  normalizeAuthDeviceName,
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

export class SignUpDto {
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
  @IsString({ message: 'phone must be a string.' })
  @MaxLength(AUTH_FIELD_LIMITS.phoneMaxLength, {
    message: `phone must be at most ${AUTH_FIELD_LIMITS.phoneMaxLength} characters long.`,
  })
  @Matches(/^\+?[1-9]\d{6,15}$/u, {
    message: 'phone must be a valid international phone number without spaces.',
  })
  readonly phone!: string;

  @Transform((params) => transformStringValue(params, normalizeAuthCivilId))
  @IsString({ message: 'civil_id must be a string.' })
  @MaxLength(AUTH_FIELD_LIMITS.civilIdMaxLength, {
    message: `civil_id must be at most ${AUTH_FIELD_LIMITS.civilIdMaxLength} characters long.`,
  })
  @Matches(/^(?=(?:\D*\d){12}\D*$)[0-9 -]+$/u, {
    message:
      'civil_id must contain exactly 12 digits and may include spaces or hyphens.',
  })
  readonly civil_id!: string;

  @Transform((params) => transformStringValue(params, normalizeAuthTimezone))
  @IsOptional()
  @IsString({ message: 'timezone must be a string.' })
  @MaxLength(AUTH_FIELD_LIMITS.timezoneMaxLength, {
    message: `timezone must be at most ${AUTH_FIELD_LIMITS.timezoneMaxLength} characters long.`,
  })
  readonly timezone?: string | null;

  @Transform((params) => transformStringValue(params, normalizeAuthDeviceId))
  @IsOptional()
  @IsString({ message: 'device_id must be a string.' })
  @MaxLength(AUTH_FIELD_LIMITS.deviceIdMaxLength, {
    message: `device_id must be at most ${AUTH_FIELD_LIMITS.deviceIdMaxLength} characters long.`,
  })
  readonly device_id?: string | null;

  @Transform((params) => transformStringValue(params, normalizeAuthDeviceName))
  @IsOptional()
  @IsString({ message: 'device_name must be a string.' })
  @MaxLength(AUTH_FIELD_LIMITS.deviceNameMaxLength, {
    message: `device_name must be at most ${AUTH_FIELD_LIMITS.deviceNameMaxLength} characters long.`,
  })
  readonly device_name?: string | null;
}
