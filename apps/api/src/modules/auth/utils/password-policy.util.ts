// apps/api/src/modules/auth/utils/password-policy.util.ts
/**
 * LAFAM Auth password policy utilities.
 *
 * Role:
 * - Validates password strength.
 * - Validates password confirmation.
 * - Provides stable failure codes/details for Auth services and DTO-facing errors.
 *
 * Important:
 * - Do not trim or mutate passwords.
 * - Do not log passwords.
 * - Do not return the password in validation results.
 * - Throwing AppError belongs in services. This utility returns validation results only.
 */

import { AUTH_FIELD_LIMITS } from '../constants/auth.constants';

export const AUTH_PASSWORD_POLICY_FAILURE_CODES = [
  'password_required',
  'password_too_short',
  'password_too_long',
  'password_missing_lowercase',
  'password_missing_uppercase',
  'password_missing_number',
  'password_missing_symbol',
  'password_contains_whitespace',
  'password_too_common',
  'password_contains_email',
  'password_contains_name',
  'password_confirmation_mismatch',
] as const;

export type AuthPasswordPolicyFailureCode =
  (typeof AUTH_PASSWORD_POLICY_FAILURE_CODES)[number];

export interface AuthPasswordPolicyFailure {
  readonly code: AuthPasswordPolicyFailureCode;
  readonly message: string;
}

export interface AuthPasswordPolicyResult {
  readonly valid: boolean;
  readonly failures: readonly AuthPasswordPolicyFailure[];
}

export interface AuthPasswordPolicyContext {
  readonly email?: string | null;
  readonly fullName?: string | null;
}

export interface AuthPasswordConfirmationResult {
  readonly valid: boolean;
  readonly mismatch: boolean;
}

const AUTH_PASSWORD_COMMON_VALUES = new Set<string>([
  'password',
  'password1',
  'password12',
  'password123',
  'password1234',
  'admin123',
  'admin1234',
  'qwerty123',
  'qwerty1234',
  '12345678',
  '123456789',
  '1234567890',
  'lafam123',
  'lafam1234',
]);

const LOWERCASE_PATTERN = /[a-z]/u;
const UPPERCASE_PATTERN = /[A-Z]/u;
const NUMBER_PATTERN = /[0-9]/u;
const SYMBOL_PATTERN = /[^A-Za-z0-9]/u;
const WHITESPACE_PATTERN = /\s/u;

function createFailure(
  code: AuthPasswordPolicyFailureCode,
  message: string,
): AuthPasswordPolicyFailure {
  return {
    code,
    message,
  };
}

function normalizeComparableValue(value: string): string {
  return value.trim().toLowerCase();
}

function extractEmailLocalPart(
  email: string | null | undefined,
): string | null {
  if (!email) {
    return null;
  }

  const normalizedEmail = normalizeComparableValue(email);
  const atIndex = normalizedEmail.indexOf('@');

  if (atIndex <= 0) {
    return null;
  }

  return normalizedEmail.slice(0, atIndex);
}

function extractNameParts(
  fullName: string | null | undefined,
): readonly string[] {
  if (!fullName) {
    return [];
  }

  return fullName
    .trim()
    .toLowerCase()
    .split(/\s+/u)
    .filter((part) => part.length >= 3);
}

function passwordContainsEmail(
  password: string,
  email: string | null | undefined,
): boolean {
  const emailLocalPart = extractEmailLocalPart(email);

  if (!emailLocalPart || emailLocalPart.length < 3) {
    return false;
  }

  return normalizeComparableValue(password).includes(emailLocalPart);
}

function passwordContainsName(
  password: string,
  fullName: string | null | undefined,
): boolean {
  const nameParts = extractNameParts(fullName);

  if (nameParts.length === 0) {
    return false;
  }

  const normalizedPassword = normalizeComparableValue(password);

  return nameParts.some((part) => normalizedPassword.includes(part));
}

export function validateAuthPasswordPolicy(
  password: string,
  context: AuthPasswordPolicyContext = {},
): AuthPasswordPolicyResult {
  const failures: AuthPasswordPolicyFailure[] = [];

  if (password.length === 0) {
    failures.push(createFailure('password_required', 'Password is required.'));

    return {
      valid: false,
      failures,
    };
  }

  if (password.length < AUTH_FIELD_LIMITS.passwordMinLength) {
    failures.push(
      createFailure(
        'password_too_short',
        `Password must be at least ${AUTH_FIELD_LIMITS.passwordMinLength} characters long.`,
      ),
    );
  }

  if (password.length > AUTH_FIELD_LIMITS.passwordMaxLength) {
    failures.push(
      createFailure(
        'password_too_long',
        `Password must be at most ${AUTH_FIELD_LIMITS.passwordMaxLength} characters long.`,
      ),
    );
  }

  if (!LOWERCASE_PATTERN.test(password)) {
    failures.push(
      createFailure(
        'password_missing_lowercase',
        'Password must include at least one lowercase letter.',
      ),
    );
  }

  if (!UPPERCASE_PATTERN.test(password)) {
    failures.push(
      createFailure(
        'password_missing_uppercase',
        'Password must include at least one uppercase letter.',
      ),
    );
  }

  if (!NUMBER_PATTERN.test(password)) {
    failures.push(
      createFailure(
        'password_missing_number',
        'Password must include at least one number.',
      ),
    );
  }

  if (!SYMBOL_PATTERN.test(password)) {
    failures.push(
      createFailure(
        'password_missing_symbol',
        'Password must include at least one symbol.',
      ),
    );
  }

  if (WHITESPACE_PATTERN.test(password)) {
    failures.push(
      createFailure(
        'password_contains_whitespace',
        'Password must not contain spaces or whitespace characters.',
      ),
    );
  }

  if (AUTH_PASSWORD_COMMON_VALUES.has(normalizeComparableValue(password))) {
    failures.push(
      createFailure(
        'password_too_common',
        'Password is too common. Choose a stronger password.',
      ),
    );
  }

  if (passwordContainsEmail(password, context.email)) {
    failures.push(
      createFailure(
        'password_contains_email',
        'Password must not contain your email name.',
      ),
    );
  }

  if (passwordContainsName(password, context.fullName)) {
    failures.push(
      createFailure(
        'password_contains_name',
        'Password must not contain your name.',
      ),
    );
  }

  return {
    valid: failures.length === 0,
    failures,
  };
}

export function validateAuthPasswordConfirmation(
  password: string,
  confirmPassword: string,
): AuthPasswordConfirmationResult {
  const mismatch = password !== confirmPassword;

  return {
    valid: !mismatch,
    mismatch,
  };
}

export function validateAuthPasswordAndConfirmation(
  password: string,
  confirmPassword: string,
  context: AuthPasswordPolicyContext = {},
): AuthPasswordPolicyResult {
  const policyResult = validateAuthPasswordPolicy(password, context);
  const confirmationResult = validateAuthPasswordConfirmation(
    password,
    confirmPassword,
  );

  if (confirmationResult.valid) {
    return policyResult;
  }

  return {
    valid: false,
    failures: [
      ...policyResult.failures,
      createFailure(
        'password_confirmation_mismatch',
        'Password confirmation does not match.',
      ),
    ],
  };
}

export function getAuthPasswordPolicyFailureCodes(
  result: AuthPasswordPolicyResult,
): readonly AuthPasswordPolicyFailureCode[] {
  return result.failures.map((failure) => failure.code);
}
