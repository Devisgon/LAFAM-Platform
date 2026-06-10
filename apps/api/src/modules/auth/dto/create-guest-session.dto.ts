// apps/api/src/modules/auth/dto/create-guest-session.dto.ts
/**
 * LAFAM Auth create-guest-session DTO.
 *
 * Role:
 * - Validates public guest-session creation request payloads.
 * - Normalizes optional device metadata before service use.
 * - Accepts an optional captcha token for production hardening.
 *
 * Important:
 * - This DTO does not create the guest session.
 * - Guest session creation must happen through the backend only.
 * - Guest access is authenticated anonymous access, not unauthenticated public access.
 */

import { Transform, type TransformFnParams } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { AUTH_FIELD_LIMITS } from '../constants/auth.constants';
import {
  normalizeAuthDeviceId,
  normalizeAuthDeviceName,
} from '../utils/auth-normalization.util';

const AUTH_CAPTCHA_TOKEN_MAX_LENGTH = 4096;

function normalizeOptionalString(value: string): string | null {
  const normalizedValue = value.trim();

  return normalizedValue.length > 0 ? normalizedValue : null;
}

function transformStringValue(
  params: TransformFnParams,
  normalizer: (value: string) => string | null,
): unknown {
  return typeof params.value === 'string'
    ? normalizer(params.value)
    : params.value;
}

export class CreateGuestSessionDto {
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

  @Transform((params) => transformStringValue(params, normalizeOptionalString))
  @IsOptional()
  @IsString({ message: 'captcha_token must be a string.' })
  @MaxLength(AUTH_CAPTCHA_TOKEN_MAX_LENGTH, {
    message: `captcha_token must be at most ${AUTH_CAPTCHA_TOKEN_MAX_LENGTH} characters long.`,
  })
  readonly captcha_token?: string | null;
}
