// apps/api/src/modules/auth/utils/auth-normalization.util.ts
/**
 * LAFAM Auth normalization utilities.
 *
 * Role:
 * - Normalizes Auth input before repository/service use.
 * - Keeps email, phone, name, timezone, OTP, token, and device metadata handling consistent.
 * - Avoids duplicated trimming/casing/length handling across DTOs and services.
 *
 * Important:
 * - This file does not throw AppError.
 * - This file does not read environment variables.
 * - Password normalization must not trim or mutate the password.
 * - Validation and business errors belong in DTOs/services.
 */

import type { DatabaseJsonObject } from '../../../database/database.types';
import {
  AUTH_DEFAULT_METADATA,
  AUTH_DEFAULT_TIMEZONE,
  AUTH_FIELD_LIMITS,
} from '../constants/auth.constants';

export interface AuthDeviceMetadataInput {
  readonly deviceId?: string | null;
  readonly deviceName?: string | null;
  readonly ipAddress?: string | null;
  readonly userAgent?: string | null;
}

export interface AuthNormalizedDeviceMetadata {
  readonly deviceId: string | null;
  readonly deviceName: string | null;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

const AUTH_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const AUTH_PHONE_PATTERN = /^\+?[1-9]\d{6,15}$/u;
const AUTH_TIMEZONE_PATTERN = /^[A-Za-z]+(?:[/_-][A-Za-z0-9+_-]+)+$/u;
const WHITESPACE_PATTERN = /\s+/gu;
const PHONE_REMOVABLE_CHARACTER_PATTERN = /[()\s-]/gu;

function normalizeNullableString(
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();

  return normalizedValue.length > 0 ? normalizedValue : null;
}

function removeControlCharacters(value: string): string {
  return Array.from(value)
    .filter((character) => {
      const codePoint = character.codePointAt(0);

      return codePoint !== undefined && codePoint > 31 && codePoint !== 127;
    })
    .join('');
}

function collapseWhitespace(value: string): string {
  return value.replace(WHITESPACE_PATTERN, ' ').trim();
}

function limitString(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function normalizeLimitedOptionalString(
  value: string | null | undefined,
  maxLength: number,
): string | null {
  const normalizedValue = normalizeNullableString(value);

  if (!normalizedValue) {
    return null;
  }

  return limitString(removeControlCharacters(normalizedValue), maxLength);
}

export function normalizeAuthEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeOptionalAuthEmail(
  value: string | null | undefined,
): string | null {
  const normalizedValue = normalizeNullableString(value);

  return normalizedValue ? normalizeAuthEmail(normalizedValue) : null;
}

export function isValidAuthEmail(value: string): boolean {
  const normalizedValue = normalizeAuthEmail(value);

  return (
    normalizedValue.length <= AUTH_FIELD_LIMITS.emailMaxLength &&
    AUTH_EMAIL_PATTERN.test(normalizedValue)
  );
}

export function normalizeAuthPhone(
  value: string | null | undefined,
): string | null {
  const normalizedValue = normalizeNullableString(value);

  if (!normalizedValue) {
    return null;
  }

  return normalizedValue.replace(PHONE_REMOVABLE_CHARACTER_PATTERN, '').trim();
}

export function isValidAuthPhone(value: string): boolean {
  const normalizedValue = normalizeAuthPhone(value);

  return (
    normalizedValue !== null &&
    normalizedValue.length <= AUTH_FIELD_LIMITS.phoneMaxLength &&
    AUTH_PHONE_PATTERN.test(normalizedValue)
  );
}

export function normalizeAuthFullName(
  value: string | null | undefined,
): string | null {
  const normalizedValue = normalizeNullableString(value);

  if (!normalizedValue) {
    return null;
  }

  return limitString(
    collapseWhitespace(removeControlCharacters(normalizedValue)),
    AUTH_FIELD_LIMITS.fullNameMaxLength,
  );
}

export function isValidAuthFullName(value: string): boolean {
  const normalizedValue = normalizeAuthFullName(value);

  return (
    normalizedValue !== null &&
    normalizedValue.length > 0 &&
    normalizedValue.length <= AUTH_FIELD_LIMITS.fullNameMaxLength
  );
}

export function normalizeAuthTimezone(
  value: string | null | undefined,
): string | null {
  const normalizedValue = normalizeNullableString(value);

  if (!normalizedValue) {
    return null;
  }

  return limitString(
    removeControlCharacters(normalizedValue),
    AUTH_FIELD_LIMITS.timezoneMaxLength,
  );
}

export function resolveAuthTimezone(value: string | null | undefined): string {
  return normalizeAuthTimezone(value) ?? AUTH_DEFAULT_TIMEZONE;
}

export function isValidAuthTimezone(value: string): boolean {
  const normalizedValue = normalizeAuthTimezone(value);

  return (
    normalizedValue !== null &&
    normalizedValue.length <= AUTH_FIELD_LIMITS.timezoneMaxLength &&
    AUTH_TIMEZONE_PATTERN.test(normalizedValue)
  );
}

export function normalizeAuthOtp(value: string): string {
  return value.trim().replace(WHITESPACE_PATTERN, '');
}

export function isValidAuthOtp(value: string): boolean {
  const normalizedValue = normalizeAuthOtp(value);

  return (
    normalizedValue.length >= AUTH_FIELD_LIMITS.otpMinLength &&
    normalizedValue.length <= AUTH_FIELD_LIMITS.otpMaxLength
  );
}

export function normalizeAuthResetToken(value: string): string {
  return value.trim();
}

export function isValidAuthResetToken(value: string): boolean {
  const normalizedValue = normalizeAuthResetToken(value);

  return (
    normalizedValue.length > 0 &&
    normalizedValue.length <= AUTH_FIELD_LIMITS.resetTokenMaxLength
  );
}

export function normalizeAuthPassword(value: string): string {
  return value;
}

export function normalizeAuthAvatarPath(
  value: string | null | undefined,
): string | null {
  return normalizeLimitedOptionalString(
    value,
    AUTH_FIELD_LIMITS.avatarPathMaxLength,
  );
}

export function normalizeAuthDeviceId(
  value: string | null | undefined,
): string | null {
  return normalizeLimitedOptionalString(
    value,
    AUTH_FIELD_LIMITS.deviceIdMaxLength,
  );
}

export function normalizeAuthDeviceName(
  value: string | null | undefined,
): string | null {
  const normalizedValue = normalizeNullableString(value);

  if (!normalizedValue) {
    return null;
  }

  return limitString(
    collapseWhitespace(removeControlCharacters(normalizedValue)),
    AUTH_FIELD_LIMITS.deviceNameMaxLength,
  );
}

export function normalizeAuthIpAddress(
  value: string | null | undefined,
): string | null {
  return normalizeLimitedOptionalString(
    value,
    AUTH_FIELD_LIMITS.ipAddressMaxLength,
  );
}

export function normalizeAuthUserAgent(
  value: string | null | undefined,
): string | null {
  return normalizeLimitedOptionalString(
    value,
    AUTH_FIELD_LIMITS.userAgentMaxLength,
  );
}

export function normalizeAuthDeviceMetadata(
  input: AuthDeviceMetadataInput,
): AuthNormalizedDeviceMetadata {
  return {
    deviceId: normalizeAuthDeviceId(input.deviceId),
    deviceName: normalizeAuthDeviceName(input.deviceName),
    ipAddress: normalizeAuthIpAddress(input.ipAddress),
    userAgent: normalizeAuthUserAgent(input.userAgent),
  };
}

export function normalizeAuthMetadata(
  value: DatabaseJsonObject | null | undefined,
): DatabaseJsonObject {
  return value ?? AUTH_DEFAULT_METADATA;
}

export function normalizeAuthSearchTerm(
  value: string | null | undefined,
): string | null {
  const normalizedValue = normalizeNullableString(value);

  if (!normalizedValue) {
    return null;
  }

  return collapseWhitespace(
    removeControlCharacters(normalizedValue),
  ).toLowerCase();
}
