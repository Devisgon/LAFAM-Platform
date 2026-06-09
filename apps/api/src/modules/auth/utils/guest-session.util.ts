// apps/api/src/modules/auth/utils/guest-session.util.ts
/**
 * LAFAM guest session utilities.
 *
 * Role:
 * - Provides guest-session expiry, conversion, and access-state helpers.
 * - Keeps guest validation logic consistent across services and guards.
 * - Keeps guest access separate from unauthenticated public access.
 *
 * Important:
 * - This file does not call Supabase.
 * - This file does not read environment variables.
 * - This file does not write audit events.
 * - Guest means authenticated anonymous Supabase user plus LAFAM role = guest.
 */

import {
  AUTH_GUEST_ROLE,
  type AuthUserRole,
} from '../constants/auth-role.constants';
import {
  AUTH_SESSION_TYPE_GUEST,
  AUTH_USER_STATUS_GUEST_ACTIVE,
  AUTH_USER_STATUS_PENDING_EMAIL_VERIFICATION,
  type AuthSessionType,
  type AuthUserStatus,
} from '../constants/auth.constants';

export interface GuestIdentityInput {
  readonly role: AuthUserRole;
  readonly status: AuthUserStatus;
  readonly isGuest: boolean;
}

export interface GuestSessionStateInput extends GuestIdentityInput {
  readonly sessionType: AuthSessionType;
  readonly guestExpiresAt: string | null;
  readonly sessionExpiresAt: string | null;
  readonly revokedAt: string | null;
  readonly convertedAt: string | null;
}

export interface GuestSessionExpiryResult {
  readonly expiresAt: string;
  readonly ttlHours: number;
}

export interface GuestAccessStateResult {
  readonly isGuest: boolean;
  readonly isGuestSession: boolean;
  readonly isExpired: boolean;
  readonly isRevoked: boolean;
  readonly isConverted: boolean;
  readonly isActiveGuest: boolean;
  readonly canUseGuestSession: boolean;
  readonly canConvertToCustomer: boolean;
}

export interface GuestConversionStateInput {
  readonly role: AuthUserRole;
  readonly status: AuthUserStatus;
  readonly isGuest: boolean;
  readonly convertedAt: string | null;
}

export interface GuestConversionStateResult {
  readonly isConverted: boolean;
  readonly conversionPendingEmailVerification: boolean;
}

export interface GuestRateLimitWindowResult {
  readonly startedAt: string;
  readonly endedAt: string;
}

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;

function assertValidDate(value: Date, label: string): void {
  if (Number.isNaN(value.getTime())) {
    throw new Error(`${label} must be a valid date.`);
  }
}

function parseDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function getEarliestDate(dates: readonly (Date | null)[]): Date | null {
  const validDates = dates.filter((date): date is Date => date !== null);

  if (validDates.length === 0) {
    return null;
  }

  return validDates.reduce((earliestDate, currentDate) =>
    currentDate.getTime() < earliestDate.getTime() ? currentDate : earliestDate,
  );
}

export function createGuestSessionExpiry(
  ttlHours: number,
  now: Date = new Date(),
): GuestSessionExpiryResult {
  assertValidDate(now, 'Guest session base date');

  if (!Number.isInteger(ttlHours) || ttlHours <= 0) {
    throw new Error('Guest session TTL must be a positive integer.');
  }

  return {
    expiresAt: new Date(
      now.getTime() + ttlHours * MILLISECONDS_PER_HOUR,
    ).toISOString(),
    ttlHours,
  };
}

export function createGuestRateLimitWindow(
  now: Date = new Date(),
): GuestRateLimitWindowResult {
  assertValidDate(now, 'Guest rate-limit date');

  const startedAt = new Date(now);
  startedAt.setMinutes(0, 0, 0);

  const endedAt = new Date(startedAt.getTime() + MILLISECONDS_PER_HOUR);

  return {
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
  };
}

export function isGuestIdentity(input: GuestIdentityInput): boolean {
  return (
    input.role === AUTH_GUEST_ROLE &&
    input.status === AUTH_USER_STATUS_GUEST_ACTIVE &&
    input.isGuest
  );
}

export function isGuestSessionType(sessionType: AuthSessionType): boolean {
  return sessionType === AUTH_SESSION_TYPE_GUEST;
}

export function isGuestSessionExpired(
  expiresAt: string | null,
  now: Date = new Date(),
): boolean {
  assertValidDate(now, 'Guest session comparison date');

  const expiryDate = parseDate(expiresAt);

  if (!expiryDate) {
    return false;
  }

  return expiryDate.getTime() <= now.getTime();
}

export function resolveGuestSessionEffectiveExpiry(
  input: Pick<GuestSessionStateInput, 'guestExpiresAt' | 'sessionExpiresAt'>,
): string | null {
  const earliestDate = getEarliestDate([
    parseDate(input.guestExpiresAt),
    parseDate(input.sessionExpiresAt),
  ]);

  return earliestDate?.toISOString() ?? null;
}

export function isGuestSessionRevoked(revokedAt: string | null): boolean {
  return revokedAt !== null;
}

export function isGuestSessionConverted(convertedAt: string | null): boolean {
  return convertedAt !== null;
}

export function resolveGuestAccessState(
  input: GuestSessionStateInput,
  now: Date = new Date(),
): GuestAccessStateResult {
  const isGuest = isGuestIdentity(input);
  const isGuestSession = isGuestSessionType(input.sessionType);
  const effectiveExpiresAt = resolveGuestSessionEffectiveExpiry(input);
  const isExpired = isGuestSessionExpired(effectiveExpiresAt, now);
  const isRevoked = isGuestSessionRevoked(input.revokedAt);
  const isConverted = isGuestSessionConverted(input.convertedAt);
  const isActiveGuest =
    isGuest && isGuestSession && !isExpired && !isRevoked && !isConverted;

  return {
    isGuest,
    isGuestSession,
    isExpired,
    isRevoked,
    isConverted,
    isActiveGuest,
    canUseGuestSession: isActiveGuest,
    canConvertToCustomer: isActiveGuest,
  };
}

export function resolveGuestConversionState(
  input: GuestConversionStateInput,
): GuestConversionStateResult {
  const isConverted =
    !input.isGuest &&
    input.role !== AUTH_GUEST_ROLE &&
    input.convertedAt !== null;

  return {
    isConverted,
    conversionPendingEmailVerification:
      isConverted &&
      input.status === AUTH_USER_STATUS_PENDING_EMAIL_VERIFICATION,
  };
}

export function shouldExpireGuestSession(
  input: GuestSessionStateInput,
  now: Date = new Date(),
): boolean {
  const state = resolveGuestAccessState(input, now);

  return state.isGuest && state.isGuestSession && state.isExpired;
}

export function canGuestSessionBeConverted(
  input: GuestSessionStateInput,
  now: Date = new Date(),
): boolean {
  return resolveGuestAccessState(input, now).canConvertToCustomer;
}
