// apps/api/src/modules/auth/utils/auth-token-hash.util.ts
/**
 * LAFAM Auth token hash utilities.
 *
 * Role:
 * - Hashes access tokens, refresh tokens, and reset tokens before persistence.
 * - Generates secure temporary reset tokens.
 * - Verifies token hashes without storing raw token values.
 *
 * Important:
 * - Never store raw access tokens.
 * - Never store raw refresh tokens.
 * - Never store raw reset tokens.
 * - Never log raw tokens or token hashes.
 * - The pepper must come from Auth config, not process.env directly.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import {
  AUTH_RESET_TOKEN_BYTE_LENGTH,
  AUTH_RESET_TOKEN_ENCODING,
  AUTH_TOKEN_HASH_ALGORITHM,
} from '../constants/auth.constants';
import type {
  AuthSessionHashPair,
  AuthSessionTokenPair,
} from '../types/auth-session.types';

export const AUTH_TOKEN_HASH_PURPOSES = [
  'access_token',
  'refresh_token',
  'reset_token',
] as const;

export type AuthTokenHashPurpose = (typeof AUTH_TOKEN_HASH_PURPOSES)[number];

export interface HashAuthTokenInput {
  readonly token: string;
  readonly pepper: string;
  readonly purpose: AuthTokenHashPurpose;
}

export interface VerifyAuthTokenHashInput extends HashAuthTokenInput {
  readonly expectedHash: string;
}

export interface AuthResetTokenResult {
  readonly resetToken: string;
  readonly resetTokenHash: string;
}

function assertNonEmptyString(value: string, label: string): void {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} is required.`);
  }
}

function createTokenHashPayload(input: HashAuthTokenInput): string {
  assertNonEmptyString(input.token, 'Auth token');
  assertNonEmptyString(input.pepper, 'Auth token hash pepper');

  return `${input.purpose}:${input.pepper}:${input.token}`;
}

export function hashAuthToken(input: HashAuthTokenInput): string {
  return createHash(AUTH_TOKEN_HASH_ALGORITHM)
    .update(createTokenHashPayload(input), 'utf8')
    .digest('hex');
}

export function hashAuthAccessToken(
  accessToken: string,
  pepper: string,
): string {
  return hashAuthToken({
    token: accessToken,
    pepper,
    purpose: 'access_token',
  });
}

export function hashAuthRefreshToken(
  refreshToken: string,
  pepper: string,
): string {
  return hashAuthToken({
    token: refreshToken,
    pepper,
    purpose: 'refresh_token',
  });
}

export function hashAuthResetToken(resetToken: string, pepper: string): string {
  return hashAuthToken({
    token: resetToken,
    pepper,
    purpose: 'reset_token',
  });
}

export function createAuthSessionHashPair(
  tokens: AuthSessionTokenPair,
  pepper: string,
): AuthSessionHashPair {
  return {
    accessTokenHash: hashAuthAccessToken(tokens.accessToken, pepper),
    refreshTokenHash: hashAuthRefreshToken(tokens.refreshToken, pepper),
  };
}

export function createAuthResetToken(pepper: string): AuthResetTokenResult {
  const resetToken = randomBytes(AUTH_RESET_TOKEN_BYTE_LENGTH).toString(
    AUTH_RESET_TOKEN_ENCODING,
  );

  return {
    resetToken,
    resetTokenHash: hashAuthResetToken(resetToken, pepper),
  };
}

export function timingSafeCompareAuthTokenHashes(
  candidateHash: string,
  expectedHash: string,
): boolean {
  if (!candidateHash || !expectedHash) {
    return false;
  }

  const candidateBuffer = Buffer.from(candidateHash, 'utf8');
  const expectedBuffer = Buffer.from(expectedHash, 'utf8');

  if (candidateBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(candidateBuffer, expectedBuffer);
}

export function verifyAuthTokenHash(input: VerifyAuthTokenHashInput): boolean {
  const candidateHash = hashAuthToken({
    token: input.token,
    pepper: input.pepper,
    purpose: input.purpose,
  });

  return timingSafeCompareAuthTokenHashes(candidateHash, input.expectedHash);
}

export function verifyAuthAccessTokenHash(
  accessToken: string,
  expectedHash: string,
  pepper: string,
): boolean {
  return verifyAuthTokenHash({
    token: accessToken,
    expectedHash,
    pepper,
    purpose: 'access_token',
  });
}

export function verifyAuthRefreshTokenHash(
  refreshToken: string,
  expectedHash: string,
  pepper: string,
): boolean {
  return verifyAuthTokenHash({
    token: refreshToken,
    expectedHash,
    pepper,
    purpose: 'refresh_token',
  });
}

export function verifyAuthResetTokenHash(
  resetToken: string,
  expectedHash: string,
  pepper: string,
): boolean {
  return verifyAuthTokenHash({
    token: resetToken,
    expectedHash,
    pepper,
    purpose: 'reset_token',
  });
}
