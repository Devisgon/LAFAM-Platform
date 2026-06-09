// apps/api/src/modules/auth/dto/login.dto.ts
/**
 * LAFAM Auth login DTO.
 *
 * Role:
 * - Validates login request payloads.
 * - Normalizes email and device metadata before service use.
 * - Keeps password unchanged because passwords must not be trimmed or mutated.
 *
 * Important:
 * - This DTO does not decide account status.
 * - The Auth service must reject unverified, deactivated, deleted, or invalid users.
 * - Device metadata is optional and used only for session/audit metadata.
 */

import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { AUTH_FIELD_LIMITS } from '../constants/auth.constants';
import {
  normalizeAuthDeviceId,
  normalizeAuthDeviceName,
  normalizeAuthEmail,
} from '../utils/auth-normalization.util';

function transformStringValue(
  params: TransformFnParams,
  normalizer: (value: string) => string | null,
): unknown {
  return typeof params.value === 'string'
    ? normalizer(params.value)
    : params.value;
}

export class LoginDto {
  @Transform((params) =>
    transformStringValue(params, (value) => normalizeAuthEmail(value)),
  )
  @IsEmail({}, { message: 'email must be a valid email address.' })
  @MaxLength(AUTH_FIELD_LIMITS.emailMaxLength, {
    message: `email must be at most ${AUTH_FIELD_LIMITS.emailMaxLength} characters long.`,
  })
  readonly email!: string;

  @IsString({ message: 'password must be a string.' })
  @MinLength(1, {
    message: 'password is required.',
  })
  @MaxLength(AUTH_FIELD_LIMITS.passwordMaxLength, {
    message: `password must be at most ${AUTH_FIELD_LIMITS.passwordMaxLength} characters long.`,
  })
  readonly password!: string;

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
