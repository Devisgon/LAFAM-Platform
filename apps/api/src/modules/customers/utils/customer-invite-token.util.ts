// apps/api/src/modules/customers/utils/customer-invite-token.util.ts
/**
 * LAFAM customer invite token utilities.
 *
 * Role:
 * - Creates cryptographically random invite tokens.
 * - Hashes invite tokens before database persistence.
 * - Validates raw tokens and token hashes.
 * - Compares token hashes safely.
 * - Builds the public invite acceptance URL.
 *
 * Important:
 * - Raw invite tokens must never be stored in the database.
 * - Raw invite tokens must never be written to logs, audit metadata, email
 *   metadata, or provider payloads.
 * - Only token hashes are persisted.
 * - The raw token is used only to build the customer-facing invite URL.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { AppError } from '../../../common/errors/app-error';
import {
  CUSTOMER_INVITE_TOKEN_BYTE_LENGTH,
  CUSTOMER_INVITE_TOKEN_HASH_LENGTH,
  CUSTOMER_INVITE_TOKEN_HASH_PATTERN,
  CUSTOMER_INVITE_TOKEN_MAX_LENGTH,
  CUSTOMER_INVITE_TOKEN_MIN_LENGTH,
  CUSTOMER_INVITE_TOKEN_PATTERN,
} from '../constants/customer.constants';
import type {
  CustomerInviteLinkCreateResult,
  CustomerInviteToken,
  CustomerInviteTokenCreateResult,
  CustomerInviteTokenHash,
} from '../types/customer.types';

export interface CreateCustomerInviteLinkInput {
  readonly acceptUrlBase: string;
  readonly token: CustomerInviteToken;
  readonly tokenHash: CustomerInviteTokenHash;
  readonly expiresAt: string;
}

export interface CreateCustomerInviteExpiryInput {
  readonly ttlHours: number;
  readonly now?: Date;
}

function normalizeOptionalString(
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function removeTrailingSlashes(value: string): string {
  return value.replace(/\/+$/u, '');
}

function assertPositiveFiniteNumber(value: number, fieldName: string): void {
  if (Number.isFinite(value) && value > 0) {
    return;
  }

  throw AppError.validationFailed(`${fieldName} must be a positive number.`, {
    fieldName,
  });
}

export function normalizeCustomerInviteToken(
  token: string | null | undefined,
): CustomerInviteToken {
  const normalizedToken = normalizeOptionalString(token);

  if (!normalizedToken) {
    throw AppError.customerInviteTokenInvalid(
      'Customer invitation token is required.',
    );
  }

  return normalizedToken;
}

export function isCustomerInviteTokenValid(
  token: string | null | undefined,
): token is CustomerInviteToken {
  const normalizedToken = normalizeOptionalString(token);

  return (
    typeof normalizedToken === 'string' &&
    normalizedToken.length >= CUSTOMER_INVITE_TOKEN_MIN_LENGTH &&
    normalizedToken.length <= CUSTOMER_INVITE_TOKEN_MAX_LENGTH &&
    CUSTOMER_INVITE_TOKEN_PATTERN.test(normalizedToken)
  );
}

export function assertValidCustomerInviteToken(
  token: string | null | undefined,
): CustomerInviteToken {
  const normalizedToken = normalizeCustomerInviteToken(token);

  if (isCustomerInviteTokenValid(normalizedToken)) {
    return normalizedToken;
  }

  throw AppError.customerInviteTokenInvalid(
    'Customer invitation token is invalid.',
  );
}

export function normalizeCustomerInviteTokenHash(
  tokenHash: string | null | undefined,
): CustomerInviteTokenHash {
  const normalizedTokenHash = normalizeOptionalString(tokenHash)?.toLowerCase();

  if (!normalizedTokenHash) {
    throw AppError.customerInviteTokenInvalid(
      'Customer invitation token hash is required.',
    );
  }

  return normalizedTokenHash;
}

export function isCustomerInviteTokenHashValid(
  tokenHash: string | null | undefined,
): tokenHash is CustomerInviteTokenHash {
  const normalizedTokenHash = normalizeOptionalString(tokenHash)?.toLowerCase();

  return (
    typeof normalizedTokenHash === 'string' &&
    normalizedTokenHash.length === CUSTOMER_INVITE_TOKEN_HASH_LENGTH &&
    CUSTOMER_INVITE_TOKEN_HASH_PATTERN.test(normalizedTokenHash)
  );
}

export function assertValidCustomerInviteTokenHash(
  tokenHash: string | null | undefined,
): CustomerInviteTokenHash {
  const normalizedTokenHash = normalizeCustomerInviteTokenHash(tokenHash);

  if (isCustomerInviteTokenHashValid(normalizedTokenHash)) {
    return normalizedTokenHash;
  }

  throw AppError.customerInviteTokenInvalid(
    'Customer invitation token hash is invalid.',
  );
}

export function hashCustomerInviteToken(
  token: string | null | undefined,
): CustomerInviteTokenHash {
  const normalizedToken = assertValidCustomerInviteToken(token);

  return createHash('sha256').update(normalizedToken).digest('hex');
}

export function createCustomerInviteToken(): CustomerInviteTokenCreateResult {
  const token = randomBytes(CUSTOMER_INVITE_TOKEN_BYTE_LENGTH).toString(
    'base64url',
  );
  const tokenHash = hashCustomerInviteToken(token);

  return {
    token,
    token_hash: tokenHash,
  };
}

export function areCustomerInviteTokenHashesEqual(
  firstTokenHash: string | null | undefined,
  secondTokenHash: string | null | undefined,
): boolean {
  if (
    !isCustomerInviteTokenHashValid(firstTokenHash) ||
    !isCustomerInviteTokenHashValid(secondTokenHash)
  ) {
    return false;
  }

  const firstHashBuffer = Buffer.from(firstTokenHash, 'hex');
  const secondHashBuffer = Buffer.from(secondTokenHash, 'hex');

  if (firstHashBuffer.length !== secondHashBuffer.length) {
    return false;
  }

  return timingSafeEqual(firstHashBuffer, secondHashBuffer);
}

export function doesCustomerInviteTokenMatchHash(input: {
  readonly token: string | null | undefined;
  readonly tokenHash: string | null | undefined;
}): boolean {
  if (!isCustomerInviteTokenValid(input.token)) {
    return false;
  }

  const computedTokenHash = hashCustomerInviteToken(input.token);

  return areCustomerInviteTokenHashesEqual(computedTokenHash, input.tokenHash);
}

export function createCustomerInviteExpiresAt(
  input: CreateCustomerInviteExpiryInput,
): string {
  assertPositiveFiniteNumber(input.ttlHours, 'ttlHours');

  const baseDate = input.now ?? new Date();
  const expiresAt = new Date(
    baseDate.getTime() + input.ttlHours * 60 * 60 * 1000,
  );

  return expiresAt.toISOString();
}

export function isCustomerInviteExpired(input: {
  readonly expiresAt: string;
  readonly now?: Date;
}): boolean {
  const expiresAtTime = Date.parse(input.expiresAt);

  if (!Number.isFinite(expiresAtTime)) {
    return true;
  }

  return expiresAtTime <= (input.now ?? new Date()).getTime();
}

export function createCustomerInviteAcceptUrl(input: {
  readonly acceptUrlBase: string;
  readonly token: CustomerInviteToken;
}): string {
  const normalizedAcceptUrlBase = normalizeOptionalString(input.acceptUrlBase);

  if (!normalizedAcceptUrlBase) {
    throw AppError.customerInviteCreateFailed(
      new Error('Customer invite accept URL base is missing.'),
    );
  }

  const token = assertValidCustomerInviteToken(input.token);
  const url = new URL(removeTrailingSlashes(normalizedAcceptUrlBase));

  url.searchParams.set('token', token);

  return url.toString();
}

export function createCustomerInviteLink(
  input: CreateCustomerInviteLinkInput,
): CustomerInviteLinkCreateResult {
  const token = assertValidCustomerInviteToken(input.token);
  const tokenHash = assertValidCustomerInviteTokenHash(input.tokenHash);

  return {
    token,
    token_hash: tokenHash,
    accept_url: createCustomerInviteAcceptUrl({
      acceptUrlBase: input.acceptUrlBase,
      token,
    }),
    expires_at: input.expiresAt,
  };
}
