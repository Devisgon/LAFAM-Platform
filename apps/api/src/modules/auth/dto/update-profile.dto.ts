// apps/api/src/modules/auth/dto/update-profile.dto.ts
/**
 * LAFAM Auth update-profile DTO.
 *
 * Role:
 * - Validates authenticated profile update request payloads.
 * - Normalizes phone, full name, and timezone before service use.
 * - Keeps profile updates limited to safe self-service fields.
 *
 * Important:
 * - This DTO must not allow email, role, status, auth_user_id, or avatar_path updates.
 * - Email changes require a separate verified flow and are not part of profile update.
 * - Avatar updates are handled by the avatar endpoint.
 */

import { Transform, type TransformFnParams } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { AUTH_FIELD_LIMITS } from '../constants/auth.constants';
import {
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

export class UpdateProfileDto {
  @Transform((params) => transformStringValue(params, normalizeAuthFullName))
  @IsOptional()
  @IsString({ message: 'full_name must be a string.' })
  @MaxLength(AUTH_FIELD_LIMITS.fullNameMaxLength, {
    message: `full_name must be at most ${AUTH_FIELD_LIMITS.fullNameMaxLength} characters long.`,
  })
  readonly full_name?: string | null;

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
