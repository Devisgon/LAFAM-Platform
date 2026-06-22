// apps/api/src/common/config/auth.config.ts
/**
 * LAFAM API Auth configuration.
 *
 * Role:
 * - Exposes Auth module runtime configuration.
 * - Converts the validated environment into a focused Auth config object.
 * - Keeps Auth security, reset-token, avatar, and guest-session settings outside business logic.
 *
 * Important:
 * - This file does not validate raw environment values directly.
 * - Validation is owned by env.validation.ts.
 * - AUTH_ACCESS_TOKEN_HASH_PEPPER is server-only and must never be logged or returned in API responses.
 * - Auth services should consume this config instead of reading process.env.
 */

import { validateEnvironment, type EnvironmentInput } from './env.validation';

export interface AuthTokenConfig {
  readonly accessTokenHashPepper: string;
  readonly resetTokenTtlMinutes: number;
  readonly maxResetOtpAttempts: number;
}

export interface AuthAvatarConfig {
  readonly bucket: string;
  readonly maxSizeBytes: number;
  readonly signedUrlTtlSeconds: number;
  readonly allowedMimeTypes: readonly string[];
}

export interface AuthGuestConfig {
  readonly sessionTtlHours: number;
  readonly maxSessionsPerIpPerHour: number;
  readonly requireCaptcha: boolean;
  readonly cleanupEnabled: boolean;
}

export interface AuthSessionConfig {
  readonly ttlHours: number;
}

export interface AuthConfig {
  readonly token: AuthTokenConfig;
  readonly avatar: AuthAvatarConfig;
  readonly session: AuthSessionConfig;
  readonly guest: AuthGuestConfig;
}

const AUTH_AVATAR_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export function createAuthConfig(
  environment: EnvironmentInput = process.env,
): AuthConfig {
  const validatedEnvironment = validateEnvironment(environment);
  const { auth } = validatedEnvironment;

  return {
    token: {
      accessTokenHashPepper: auth.accessTokenHashPepper,
      resetTokenTtlMinutes: auth.resetTokenTtlMinutes,
      maxResetOtpAttempts: auth.maxResetOtpAttempts,
    },
    avatar: {
      bucket: auth.avatarBucket,
      maxSizeBytes: auth.avatarMaxSizeBytes,
      signedUrlTtlSeconds: auth.avatarSignedUrlTtlSeconds,
      allowedMimeTypes: AUTH_AVATAR_ALLOWED_MIME_TYPES,
    },
    session: {
      ttlHours: auth.authenticatedSessionTtlHours,
    },
    guest: {
      sessionTtlHours: auth.guestSessionTtlHours,
      maxSessionsPerIpPerHour: auth.guestMaxSessionsPerIpPerHour,
      requireCaptcha: auth.guestRequireCaptcha,
      cleanupEnabled: auth.guestCleanupEnabled,
    },
  };
}

export const currentAuthConfig = createAuthConfig();
