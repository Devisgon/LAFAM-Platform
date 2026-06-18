// apps/api/src/modules/payments/domain/payment-security.policy.ts
/**
 * LAFAM Payment security policy.
 *
 * Role:
 * - Centralizes Payment Module security checks.
 * - Enforces customer ownership checks for payment and wallet objects.
 * - Enforces safe target-shape rules before checkout/payment mutation.
 * - Enforces wallet access restrictions.
 * - Enforces webhook/callback trust prerequisites.
 * - Sanitizes metadata before storage/logging.
 * - Builds deterministic rate-limit keys for the Payment-specific rate-limit guard.
 *
 * Important:
 * - This policy does not call the database.
 * - This policy does not verify provider signatures cryptographically.
 * - This policy does not mutate payments, bookings, private bookings, or wallets.
 * - Provider adapters must still verify webhook signatures and payment status.
 * - Repositories/RPCs must still enforce atomic wallet/payment mutation.
 * - Services must call this policy before sensitive payment/wallet operations.
 */

import { AppError } from '../../../common/errors/app-error';
import type {
  DatabaseJson,
  DatabaseJsonObject,
} from '../../../database/database.types';
import {
  PAYMENT_ALLOWED_CURRENCIES,
  PAYMENT_DEFAULT_CURRENCY,
  PAYMENT_IDEMPOTENCY_KEY_MAX_LENGTH,
  PAYMENT_IDEMPOTENCY_KEY_MIN_LENGTH,
  PAYMENT_METADATA_MAX_TOP_LEVEL_KEYS,
  PAYMENT_METHOD_CARD,
  PAYMENT_METHOD_KNET,
  PAYMENT_METHOD_WALLET,
  PAYMENT_PROVIDER_MOCK,
  PAYMENT_RATE_LIMIT_KEY_IP_PREFIX,
  PAYMENT_RATE_LIMIT_KEY_PAYMENT_PREFIX,
  PAYMENT_RATE_LIMIT_KEY_PROVIDER_REFERENCE_PREFIX,
  PAYMENT_RATE_LIMIT_KEY_TARGET_USER_PREFIX,
  PAYMENT_RATE_LIMIT_KEY_USER_PREFIX,
  PAYMENT_SENSITIVE_METADATA_KEYS,
  PAYMENT_TARGET_TYPE_BOOKING,
  PAYMENT_TARGET_TYPE_PRIVATE_BOOKING,
  PAYMENT_TARGET_TYPE_WALLET_TOP_UP,
  PAYMENT_WEBHOOK_MAX_CLOCK_SKEW_SECONDS,
  REFUND_REASON_MAX_LENGTH,
  REFUND_REASON_MIN_LENGTH,
  isPaymentCurrency,
  type PaymentCurrency,
  type PaymentMethod,
  type PaymentProvider,
  type PaymentTargetType,
} from '../constants/payment.constants';
import type {
  PaymentAdminActionAuditContext,
  PaymentOwnershipCheckInput,
  PaymentRateLimitContext,
  PaymentResolvedTargetReference,
  PaymentSafeLogContext,
  PaymentSanitizationResult,
  PaymentTargetOwnershipCheckInput,
  PaymentWebhookHeaders,
  WalletAccountRecord,
  WalletLedgerEntryRecord,
} from '../types/payment.types';

interface PaymentTargetOwnerCheckInput extends PaymentTargetOwnershipCheckInput {
  readonly owner_user_id: string | null;
}

interface WalletOwnershipCheckInput {
  readonly wallet: WalletAccountRecord;
  readonly user_id: string;
}

interface WalletLedgerOwnershipCheckInput {
  readonly ledger_entry: WalletLedgerEntryRecord;
  readonly user_id: string;
}

interface PaymentMethodForTargetInput {
  readonly target_type: PaymentTargetType;
  readonly payment_method: PaymentMethod;
  readonly currency: PaymentCurrency;
  readonly is_guest: boolean;
}

interface PaymentAmountIntegrityInput {
  readonly amount: number;
  readonly discount_amount: number;
  readonly final_amount: number;
}

interface PaymentReferencePresenceInput {
  readonly payment_id?: string | null;
  readonly provider_reference?: string | null;
  readonly gateway_payment_id?: string | null;
  readonly gateway_invoice_id?: string | null;
}

interface PaymentWebhookTimestampInput {
  readonly headers: PaymentWebhookHeaders;
  readonly require_timestamp: boolean;
  readonly now?: Date;
}

const PAYMENT_AMOUNT_SCALE = 1000;

function roundPaymentAmount(value: number): number {
  return Math.round(value * PAYMENT_AMOUNT_SCALE) / PAYMENT_AMOUNT_SCALE;
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeSensitiveKey(value: string): string {
  return value.toLowerCase().replace(/[\s.-]+/gu, '_');
}

function isSensitiveMetadataKey(key: string): boolean {
  const normalizedKey = normalizeSensitiveKey(key);

  return PAYMENT_SENSITIVE_METADATA_KEYS.some((sensitiveKey) => {
    const normalizedSensitiveKey = normalizeSensitiveKey(sensitiveKey);

    return (
      normalizedKey === normalizedSensitiveKey ||
      normalizedKey.includes(normalizedSensitiveKey)
    );
  });
}

function isDatabaseJsonObject(
  value: DatabaseJson,
): value is DatabaseJsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseWebhookTimestamp(value: string): number | null {
  const trimmedValue = value.trim();

  if (/^\d+$/u.test(trimmedValue)) {
    const numericValue = Number(trimmedValue);

    if (!Number.isFinite(numericValue)) {
      return null;
    }

    return trimmedValue.length <= 10 ? numericValue * 1000 : numericValue;
  }

  const parsedValue = Date.parse(trimmedValue);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function buildRateLimitPart(
  prefix: string,
  value: string | null,
): string | null {
  if (!hasText(value)) {
    return null;
  }

  return `${prefix}:${value.trim()}`;
}

export class PaymentSecurityPolicy {
  static assertPaymentOwnedByUser(input: PaymentOwnershipCheckInput): void {
    if (input.payment.user_id === input.user_id) {
      return;
    }

    throw AppError.paymentAccessDenied(
      'You are not allowed to access this payment.',
      {
        payment_id: input.payment.id,
        user_id: input.user_id,
      },
    );
  }

  static assertTargetOwnedByUser(input: PaymentTargetOwnerCheckInput): void {
    if (input.owner_user_id !== null && input.owner_user_id === input.user_id) {
      return;
    }

    throw AppError.paymentAccessDenied(
      'You are not allowed to create payment for this target.',
      {
        user_id: input.user_id,
        target_type: input.target.target_type,
        booking_id: input.target.booking_id,
        private_booking_id: input.target.private_booking_id,
      },
    );
  }

  static assertWalletOwnedByUser(input: WalletOwnershipCheckInput): void {
    if (input.wallet.user_id === input.user_id) {
      return;
    }

    throw AppError.walletAccessDenied(
      'You are not allowed to access this wallet.',
      {
        wallet_account_id: input.wallet.id,
        user_id: input.user_id,
      },
    );
  }

  static assertWalletLedgerEntryOwnedByUser(
    input: WalletLedgerOwnershipCheckInput,
  ): void {
    if (input.ledger_entry.user_id === input.user_id) {
      return;
    }

    throw AppError.walletAccessDenied(
      'You are not allowed to access this wallet transaction.',
      {
        wallet_ledger_entry_id: input.ledger_entry.id,
        user_id: input.user_id,
      },
    );
  }

  static assertResolvedTargetShape(
    target: PaymentResolvedTargetReference,
  ): void {
    if (
      target.target_type === PAYMENT_TARGET_TYPE_BOOKING &&
      target.booking_id !== null &&
      target.private_booking_id === null
    ) {
      return;
    }

    if (
      target.target_type === PAYMENT_TARGET_TYPE_PRIVATE_BOOKING &&
      target.booking_id === null &&
      target.private_booking_id !== null
    ) {
      return;
    }

    if (
      target.target_type === PAYMENT_TARGET_TYPE_WALLET_TOP_UP &&
      target.booking_id === null &&
      target.private_booking_id === null
    ) {
      return;
    }

    throw AppError.paymentTargetInvalid(
      'Payment target shape is invalid for the selected target type.',
      {
        target_type: target.target_type,
        booking_id: target.booking_id,
        private_booking_id: target.private_booking_id,
      },
    );
  }

  static assertPaymentMethodAllowedForTarget(
    input: PaymentMethodForTargetInput,
  ): void {
    this.assertCurrencySupported(input.currency);

    if (
      input.target_type === PAYMENT_TARGET_TYPE_WALLET_TOP_UP &&
      input.payment_method === PAYMENT_METHOD_WALLET
    ) {
      throw AppError.invalidRequest(
        'Wallet top-up cannot be paid using wallet balance.',
        {
          target_type: input.target_type,
          payment_method: input.payment_method,
        },
      );
    }

    if (input.is_guest && input.payment_method === PAYMENT_METHOD_WALLET) {
      throw AppError.walletAccessDenied(
        'Guest users cannot use wallet payment.',
        {
          target_type: input.target_type,
          payment_method: input.payment_method,
        },
      );
    }

    if (
      (input.payment_method === PAYMENT_METHOD_KNET ||
        input.payment_method === PAYMENT_METHOD_CARD) &&
      input.currency !== PAYMENT_DEFAULT_CURRENCY
    ) {
      throw AppError.paymentCurrencyUnsupported(
        'Hosted payment methods support KWD only.',
        {
          currency: input.currency,
          allowed_currencies: [...PAYMENT_ALLOWED_CURRENCIES],
        },
      );
    }
  }

  static assertCurrencySupported(currency: string): PaymentCurrency {
    if (isPaymentCurrency(currency)) {
      return currency;
    }

    throw AppError.paymentCurrencyUnsupported('Payment currency must be KWD.', {
      currency,
      allowed_currencies: [...PAYMENT_ALLOWED_CURRENCIES],
    });
  }

  static assertAmountIntegrity(input: PaymentAmountIntegrityInput): void {
    if (
      !Number.isFinite(input.amount) ||
      !Number.isFinite(input.discount_amount) ||
      !Number.isFinite(input.final_amount)
    ) {
      throw AppError.paymentAmountInvalid(
        'Payment amount values must be finite numbers.',
        {
          amount: input.amount,
          discount_amount: input.discount_amount,
          final_amount: input.final_amount,
        },
      );
    }

    if (input.amount <= 0) {
      throw AppError.paymentAmountInvalid(
        'Payment amount must be greater than zero.',
        {
          amount: input.amount,
        },
      );
    }

    if (input.discount_amount < 0) {
      throw AppError.paymentAmountInvalid(
        'Payment discount amount cannot be negative.',
        {
          discount_amount: input.discount_amount,
        },
      );
    }

    if (input.discount_amount > input.amount) {
      throw AppError.paymentAmountInvalid(
        'Payment discount amount cannot exceed payment amount.',
        {
          amount: input.amount,
          discount_amount: input.discount_amount,
        },
      );
    }

    const expectedFinalAmount = roundPaymentAmount(
      input.amount - input.discount_amount,
    );

    if (roundPaymentAmount(input.final_amount) !== expectedFinalAmount) {
      throw AppError.paymentAmountInvalid(
        'Payment final_amount must equal amount minus discount_amount.',
        {
          amount: input.amount,
          discount_amount: input.discount_amount,
          final_amount: input.final_amount,
          expected_final_amount: expectedFinalAmount,
        },
      );
    }

    if (expectedFinalAmount <= 0) {
      throw AppError.paymentAmountInvalid(
        'Payment final_amount must be greater than zero.',
        {
          final_amount: input.final_amount,
        },
      );
    }
  }

  static assertReferencePresent(input: PaymentReferencePresenceInput): void {
    if (
      hasText(input.payment_id) ||
      hasText(input.provider_reference) ||
      hasText(input.gateway_payment_id) ||
      hasText(input.gateway_invoice_id)
    ) {
      return;
    }

    throw AppError.invalidRequest(
      'At least one payment reference is required.',
      {
        payment_id: input.payment_id ?? null,
        provider_reference: input.provider_reference ?? null,
        gateway_payment_id: input.gateway_payment_id ?? null,
        gateway_invoice_id: input.gateway_invoice_id ?? null,
      },
    );
  }

  static assertWebhookSignaturePresent(
    headers: PaymentWebhookHeaders,
    provider: PaymentProvider,
  ): void {
    if (provider === PAYMENT_PROVIDER_MOCK) {
      return;
    }

    if (hasText(headers.signature)) {
      return;
    }

    throw AppError.paymentWebhookInvalid(
      'Payment webhook signature is required.',
      {
        provider,
      },
    );
  }

  static assertWebhookTimestampFresh(
    input: PaymentWebhookTimestampInput,
  ): void {
    if (!hasText(input.headers.timestamp)) {
      if (!input.require_timestamp) {
        return;
      }

      throw AppError.paymentWebhookInvalid(
        'Payment webhook timestamp is required.',
      );
    }

    const timestampMs = parseWebhookTimestamp(input.headers.timestamp);

    if (timestampMs === null) {
      throw AppError.paymentWebhookInvalid(
        'Payment webhook timestamp is invalid.',
        {
          timestamp: input.headers.timestamp,
        },
      );
    }

    const nowMs = (input.now ?? new Date()).getTime();
    const skewMs = Math.abs(nowMs - timestampMs);
    const maxSkewMs = PAYMENT_WEBHOOK_MAX_CLOCK_SKEW_SECONDS * 1000;

    if (skewMs <= maxSkewMs) {
      return;
    }

    throw AppError.paymentWebhookInvalid(
      'Payment webhook timestamp is outside the allowed replay window.',
      {
        timestamp: input.headers.timestamp,
        max_clock_skew_seconds: PAYMENT_WEBHOOK_MAX_CLOCK_SKEW_SECONDS,
      },
    );
  }

  static assertAdminActionHasAuditReason(
    input: PaymentAdminActionAuditContext,
  ): void {
    const reason = input.reason.trim();

    if (
      reason.length >= REFUND_REASON_MIN_LENGTH &&
      reason.length <= REFUND_REASON_MAX_LENGTH
    ) {
      return;
    }

    throw AppError.invalidRequest(
      `Admin payment action reason must be between ${REFUND_REASON_MIN_LENGTH} and ${REFUND_REASON_MAX_LENGTH} characters.`,
      {
        admin_user_id: input.admin_user_id,
        reason_length: reason.length,
      },
    );
  }

  static assertIdempotencyKey(idempotencyKey: string | null | undefined): void {
    if (!hasText(idempotencyKey)) {
      return;
    }

    const normalizedIdempotencyKey = idempotencyKey.trim();

    if (
      normalizedIdempotencyKey.length >= PAYMENT_IDEMPOTENCY_KEY_MIN_LENGTH &&
      normalizedIdempotencyKey.length <= PAYMENT_IDEMPOTENCY_KEY_MAX_LENGTH
    ) {
      return;
    }

    throw AppError.invalidRequest(
      `idempotency_key must be between ${PAYMENT_IDEMPOTENCY_KEY_MIN_LENGTH} and ${PAYMENT_IDEMPOTENCY_KEY_MAX_LENGTH} characters.`,
      {
        idempotency_key_length: normalizedIdempotencyKey.length,
      },
    );
  }

  static sanitizeMetadata(
    metadata: DatabaseJsonObject | null | undefined,
  ): PaymentSanitizationResult {
    if (!metadata) {
      return {
        sanitized: {},
        removed_keys: [],
      };
    }

    const topLevelKeys = Object.keys(metadata);

    if (topLevelKeys.length > PAYMENT_METADATA_MAX_TOP_LEVEL_KEYS) {
      throw AppError.invalidRequest(
        `metadata must not contain more than ${PAYMENT_METADATA_MAX_TOP_LEVEL_KEYS} top-level keys.`,
        {
          key_count: topLevelKeys.length,
          max_key_count: PAYMENT_METADATA_MAX_TOP_LEVEL_KEYS,
        },
      );
    }

    const removedKeys: string[] = [];
    const sanitized = this.sanitizeJsonObject(metadata, removedKeys, '');

    return {
      sanitized,
      removed_keys: removedKeys,
    };
  }

  static sanitizeSafeLogContext(
    context: PaymentSafeLogContext,
  ): PaymentSafeLogContext {
    return {
      ...(hasText(context.request_id)
        ? { request_id: context.request_id.trim() }
        : {}),
      ...(hasText(context.payment_id)
        ? { payment_id: context.payment_id.trim() }
        : {}),
      ...(hasText(context.payment_number)
        ? { payment_number: context.payment_number.trim() }
        : {}),
      ...(hasText(context.booking_id)
        ? { booking_id: context.booking_id.trim() }
        : {}),
      ...(hasText(context.private_booking_id)
        ? { private_booking_id: context.private_booking_id.trim() }
        : {}),
      ...(hasText(context.user_id) ? { user_id: context.user_id.trim() } : {}),
      ...(hasText(context.admin_user_id)
        ? { admin_user_id: context.admin_user_id.trim() }
        : {}),
      ...(typeof context.provider === 'string'
        ? { provider: context.provider }
        : {}),
      ...(hasText(context.gateway_reference)
        ? { gateway_reference: context.gateway_reference.trim() }
        : {}),
      ...(typeof context.status === 'string' ? { status: context.status } : {}),
      ...(hasText(context.failure_code)
        ? { failure_code: context.failure_code.trim() }
        : {}),
    };
  }

  static buildRateLimitKey(context: PaymentRateLimitContext): string {
    const parts: string[] = [context.bucket];

    const userPart = buildRateLimitPart(
      PAYMENT_RATE_LIMIT_KEY_USER_PREFIX,
      context.user_id ?? null,
    );
    const ipPart = buildRateLimitPart(
      PAYMENT_RATE_LIMIT_KEY_IP_PREFIX,
      context.ip_address,
    );
    const paymentPart = buildRateLimitPart(
      PAYMENT_RATE_LIMIT_KEY_PAYMENT_PREFIX,
      context.payment_id ?? null,
    );
    const providerReferencePart = buildRateLimitPart(
      PAYMENT_RATE_LIMIT_KEY_PROVIDER_REFERENCE_PREFIX,
      context.provider_reference ?? null,
    );
    const targetUserPart = buildRateLimitPart(
      PAYMENT_RATE_LIMIT_KEY_TARGET_USER_PREFIX,
      context.target_user_id ?? null,
    );

    for (const part of [
      userPart,
      ipPart,
      paymentPart,
      providerReferencePart,
      targetUserPart,
    ]) {
      if (part !== null) {
        parts.push(part);
      }
    }

    if (parts.length === 1) {
      parts.push('anonymous');
    }

    return parts.join('|');
  }

  private static sanitizeJsonObject(
    input: DatabaseJsonObject,
    removedKeys: string[],
    path: string,
  ): DatabaseJsonObject {
    const sanitized: DatabaseJsonObject = {};

    for (const [key, value] of Object.entries(input)) {
      const keyPath = path.length > 0 ? `${path}.${key}` : key;

      if (isSensitiveMetadataKey(key)) {
        removedKeys.push(keyPath);
        continue;
      }

      const sanitizedValue = this.sanitizeJsonValue(
        value,
        removedKeys,
        keyPath,
      );

      if (typeof sanitizedValue !== 'undefined') {
        sanitized[key] = sanitizedValue;
      }
    }

    return sanitized;
  }

  private static sanitizeJsonValue(
    value: DatabaseJson | undefined,
    removedKeys: string[],
    path: string,
  ): DatabaseJson | undefined {
    if (typeof value === 'undefined') {
      return undefined;
    }

    if (Array.isArray(value)) {
      return value
        .map((item, index) =>
          this.sanitizeJsonValue(item, removedKeys, `${path}[${index}]`),
        )
        .filter((item): item is DatabaseJson => typeof item !== 'undefined');
    }

    if (isDatabaseJsonObject(value)) {
      return this.sanitizeJsonObject(value, removedKeys, path);
    }

    return value;
  }
}
