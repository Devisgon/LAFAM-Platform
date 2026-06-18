// apps/api/src/modules/payments/domain/wallet-ledger.policy.ts
/**
 * LAFAM Wallet ledger policy.
 *
 * Role:
 * - Centralizes wallet account and wallet ledger safety rules.
 * - Protects wallet debit operations from negative balances.
 * - Validates credit/debit ledger entry types.
 * - Validates wallet ledger balance math.
 * - Validates wallet ledger status transitions.
 * - Enforces KWD-only wallet currency for this phase.
 * - Enforces manual wallet adjustment audit requirements.
 *
 * Important:
 * - This policy does not call the database.
 * - This policy does not mutate wallet balances.
 * - This policy does not create ledger rows.
 * - Atomic database RPCs must still lock wallet rows before debit/credit mutation.
 * - Services must not implement read-balance-then-update wallet logic.
 * - Wallet ledger rows should be append-only; corrections should be new ledger entries.
 */

import { AppError } from '../../../common/errors/app-error';
import {
  PAYMENT_ALLOWED_CURRENCIES,
  PAYMENT_DEFAULT_CURRENCY,
  WALLET_ACCOUNT_STATUS_ACTIVE,
  WALLET_ACCOUNT_STATUS_CLOSED,
  WALLET_ACCOUNT_STATUS_FROZEN,
  WALLET_ADMIN_ADJUSTMENT_REASON_MAX_LENGTH,
  WALLET_ADMIN_ADJUSTMENT_REASON_MIN_LENGTH,
  WALLET_BALANCE_MIN,
  WALLET_DEBIT_ENTRY_TYPES,
  WALLET_LEDGER_DESCRIPTION_MAX_LENGTH,
  WALLET_LEDGER_ENTRY_STATUS_FAILED,
  WALLET_LEDGER_ENTRY_STATUS_PENDING,
  WALLET_LEDGER_ENTRY_STATUS_POSTED,
  WALLET_LEDGER_ENTRY_STATUS_REVERSED,
  WALLET_LEDGER_ENTRY_TYPE_ADMIN_ADJUSTMENT_CREDIT,
  WALLET_LEDGER_ENTRY_TYPE_ADMIN_ADJUSTMENT_DEBIT,
  WALLET_LEDGER_ENTRY_TYPE_BOOKING_PAYMENT,
  WALLET_LEDGER_ENTRY_TYPE_PRIVATE_BOOKING_PAYMENT,
  WALLET_LEDGER_ENTRY_TYPE_REFUND_CREDIT,
  WALLET_LEDGER_ENTRY_TYPE_WALLET_TOP_UP,
  WALLET_TOP_UP_AMOUNT_MAX,
  WALLET_TOP_UP_AMOUNT_MIN,
  isPaymentCurrency,
  isWalletCreditEntryType,
  isWalletDebitEntryType,
  isWalletLedgerEntryStatus,
  isWalletLedgerEntryType,
  type PaymentCurrency,
  type PaymentTargetType,
  type WalletDebitEntryType,
  type WalletLedgerEntryStatus,
  type WalletLedgerEntryType,
} from '../constants/payment.constants';
import {
  PAYMENT_TARGET_TYPE_BOOKING,
  PAYMENT_TARGET_TYPE_PRIVATE_BOOKING,
  PAYMENT_TARGET_TYPE_WALLET_TOP_UP,
} from '../constants/payment.constants';
import type {
  AdminWalletAdjustmentInput,
  WalletAccountRecord,
  WalletCreditInput,
  WalletDebitInput,
  WalletLedgerEntryRecord,
} from '../types/payment.types';

interface WalletBalanceMutationInput {
  readonly wallet: WalletAccountRecord;
  readonly amount: number;
  readonly currency: PaymentCurrency;
}

interface WalletLedgerBalanceMathInput {
  readonly entry_type: WalletLedgerEntryType;
  readonly amount: number;
  readonly balance_before: number;
  readonly balance_after: number;
}

interface WalletLedgerStatusTransitionInput {
  readonly current_status: WalletLedgerEntryStatus;
  readonly next_status: WalletLedgerEntryStatus;
}

interface WalletLedgerStatusTransitionResult {
  readonly allowed: boolean;
  readonly ignored: boolean;
  readonly reason: string | null;
}

interface WalletPaymentTargetShapeInput {
  readonly entry_type: WalletDebitEntryType;
  readonly booking_id?: string | null;
  readonly private_booking_id?: string | null;
}

const WALLET_AMOUNT_SCALE = 1000;

const WALLET_LEDGER_STATUS_TRANSITIONS: ReadonlyMap<
  WalletLedgerEntryStatus,
  ReadonlySet<WalletLedgerEntryStatus>
> = new Map([
  [
    WALLET_LEDGER_ENTRY_STATUS_PENDING,
    new Set<WalletLedgerEntryStatus>([
      WALLET_LEDGER_ENTRY_STATUS_POSTED,
      WALLET_LEDGER_ENTRY_STATUS_FAILED,
    ]),
  ],
  [
    WALLET_LEDGER_ENTRY_STATUS_POSTED,
    new Set<WalletLedgerEntryStatus>([WALLET_LEDGER_ENTRY_STATUS_REVERSED]),
  ],
  [WALLET_LEDGER_ENTRY_STATUS_REVERSED, new Set<WalletLedgerEntryStatus>()],
  [WALLET_LEDGER_ENTRY_STATUS_FAILED, new Set<WalletLedgerEntryStatus>()],
]);

function roundWalletAmount(value: number): number {
  return Math.round(value * WALLET_AMOUNT_SCALE) / WALLET_AMOUNT_SCALE;
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function walletDetails(wallet: WalletAccountRecord): Record<string, unknown> {
  return {
    wallet_account_id: wallet.id,
    user_id: wallet.user_id,
    currency: wallet.currency,
    status: wallet.status,
  };
}

function ledgerDetails(
  ledgerEntry: WalletLedgerEntryRecord,
): Record<string, unknown> {
  return {
    wallet_ledger_entry_id: ledgerEntry.id,
    wallet_account_id: ledgerEntry.wallet_account_id,
    user_id: ledgerEntry.user_id,
    entry_type: ledgerEntry.entry_type,
    entry_status: ledgerEntry.entry_status,
  };
}

function assertAmountPositive(amount: number, fieldName = 'amount'): void {
  if (Number.isFinite(amount) && amount > 0) {
    return;
  }

  throw AppError.paymentAmountInvalid(
    `${fieldName} must be greater than zero.`,
    {
      [fieldName]: amount,
    },
  );
}

function assertWalletAmountWithinTopUpRange(amount: number): void {
  if (
    amount >= WALLET_TOP_UP_AMOUNT_MIN &&
    amount <= WALLET_TOP_UP_AMOUNT_MAX
  ) {
    return;
  }

  throw AppError.paymentAmountInvalid(
    `wallet top-up amount must be between ${WALLET_TOP_UP_AMOUNT_MIN} and ${WALLET_TOP_UP_AMOUNT_MAX}.`,
    {
      amount,
      min_amount: WALLET_TOP_UP_AMOUNT_MIN,
      max_amount: WALLET_TOP_UP_AMOUNT_MAX,
    },
  );
}

function assertDescriptionLength(description: string | null | undefined): void {
  if (!hasText(description)) {
    return;
  }

  const normalizedDescription = description.trim();

  if (normalizedDescription.length <= WALLET_LEDGER_DESCRIPTION_MAX_LENGTH) {
    return;
  }

  throw AppError.invalidRequest(
    `wallet ledger description must not exceed ${WALLET_LEDGER_DESCRIPTION_MAX_LENGTH} characters.`,
    {
      description_length: normalizedDescription.length,
      max_length: WALLET_LEDGER_DESCRIPTION_MAX_LENGTH,
    },
  );
}

function assertCurrencySupported(currency: string): PaymentCurrency {
  if (isPaymentCurrency(currency)) {
    return currency;
  }

  throw AppError.paymentCurrencyUnsupported('Wallet currency must be KWD.', {
    currency,
    allowed_currencies: [...PAYMENT_ALLOWED_CURRENCIES],
  });
}

export class WalletLedgerPolicy {
  static assertWalletActive(wallet: WalletAccountRecord): void {
    if (wallet.status === WALLET_ACCOUNT_STATUS_ACTIVE) {
      return;
    }

    if (wallet.status === WALLET_ACCOUNT_STATUS_FROZEN) {
      throw AppError.walletNotActive('Wallet account is frozen.', {
        ...walletDetails(wallet),
      });
    }

    if (wallet.status === WALLET_ACCOUNT_STATUS_CLOSED) {
      throw AppError.walletNotActive('Wallet account is closed.', {
        ...walletDetails(wallet),
      });
    }

    throw AppError.walletNotActive('Wallet account is not active.', {
      ...walletDetails(wallet),
    });
  }

  static assertWalletCurrency(
    wallet: WalletAccountRecord,
    currency: string,
  ): PaymentCurrency {
    const normalizedCurrency = assertCurrencySupported(currency);
    const walletCurrency = assertCurrencySupported(wallet.currency);

    if (walletCurrency === normalizedCurrency) {
      return normalizedCurrency;
    }

    throw AppError.paymentCurrencyUnsupported(
      'Wallet currency does not match payment currency.',
      {
        ...walletDetails(wallet),
        requested_currency: normalizedCurrency,
      },
    );
  }

  static assertWalletCanCredit(input: WalletBalanceMutationInput): void {
    this.assertWalletActive(input.wallet);
    this.assertWalletCurrency(input.wallet, input.currency);
    assertAmountPositive(input.amount);
  }

  static assertWalletCanDebit(input: WalletBalanceMutationInput): void {
    this.assertWalletActive(input.wallet);
    this.assertWalletCurrency(input.wallet, input.currency);
    assertAmountPositive(input.amount);

    const balanceAfter = this.resolveBalanceAfterDebit(input);

    if (balanceAfter >= WALLET_BALANCE_MIN) {
      return;
    }

    throw AppError.walletInsufficientBalance(
      'Wallet has insufficient available balance.',
      {
        ...walletDetails(input.wallet),
        amount: input.amount,
        available_balance: input.wallet.available_balance,
        balance_after: balanceAfter,
      },
    );
  }

  static assertCreditInput(input: WalletCreditInput): void {
    assertCurrencySupported(input.currency);
    assertAmountPositive(input.amount);

    if (!isWalletCreditEntryType(input.entry_type)) {
      throw AppError.invalidRequest(
        'Wallet credit entry_type must be a supported credit type.',
        {
          entry_type: input.entry_type,
        },
      );
    }

    assertDescriptionLength(input.description);
  }

  static assertDebitInput(input: WalletDebitInput): void {
    assertCurrencySupported(input.currency);
    assertAmountPositive(input.amount);

    if (!isWalletDebitEntryType(input.entry_type)) {
      throw AppError.invalidRequest(
        'Wallet debit entry_type must be a supported debit type.',
        {
          entry_type: input.entry_type,
          allowed_debit_entry_types: [...WALLET_DEBIT_ENTRY_TYPES],
        },
      );
    }

    this.assertDebitTargetShape({
      entry_type: input.entry_type,
      booking_id: input.booking_id ?? null,
      private_booking_id: input.private_booking_id ?? null,
    });

    assertDescriptionLength(input.description);
  }

  static assertAdminWalletAdjustmentInput(
    input: AdminWalletAdjustmentInput,
  ): void {
    assertCurrencySupported(input.currency);
    assertAmountPositive(input.amount);

    if (
      input.entry_type !== WALLET_LEDGER_ENTRY_TYPE_ADMIN_ADJUSTMENT_CREDIT &&
      input.entry_type !== WALLET_LEDGER_ENTRY_TYPE_ADMIN_ADJUSTMENT_DEBIT
    ) {
      throw AppError.invalidRequest(
        'Admin wallet adjustment entry_type must be credit or debit adjustment.',
        {
          entry_type: input.entry_type,
        },
      );
    }

    const reason = input.reason.trim();

    if (
      reason.length < WALLET_ADMIN_ADJUSTMENT_REASON_MIN_LENGTH ||
      reason.length > WALLET_ADMIN_ADJUSTMENT_REASON_MAX_LENGTH
    ) {
      throw AppError.invalidRequest(
        `Admin wallet adjustment reason must be between ${WALLET_ADMIN_ADJUSTMENT_REASON_MIN_LENGTH} and ${WALLET_ADMIN_ADJUSTMENT_REASON_MAX_LENGTH} characters.`,
        {
          admin_user_id: input.admin_user_id,
          target_user_id: input.target_user_id,
          reason_length: reason.length,
        },
      );
    }
  }

  static assertTopUpCreditInput(input: WalletCreditInput): void {
    this.assertCreditInput(input);
    assertWalletAmountWithinTopUpRange(input.amount);

    if (input.entry_type === WALLET_LEDGER_ENTRY_TYPE_WALLET_TOP_UP) {
      return;
    }

    throw AppError.invalidRequest(
      'Wallet top-up credit must use wallet_top_up ledger entry type.',
      {
        entry_type: input.entry_type,
      },
    );
  }

  static assertRefundCreditInput(input: WalletCreditInput): void {
    this.assertCreditInput(input);

    if (input.entry_type === WALLET_LEDGER_ENTRY_TYPE_REFUND_CREDIT) {
      return;
    }

    throw AppError.invalidRequest(
      'Wallet refund credit must use refund_credit ledger entry type.',
      {
        entry_type: input.entry_type,
      },
    );
  }

  static assertDebitTargetShape(input: WalletPaymentTargetShapeInput): void {
    if (
      input.entry_type === WALLET_LEDGER_ENTRY_TYPE_BOOKING_PAYMENT &&
      hasText(input.booking_id) &&
      !hasText(input.private_booking_id)
    ) {
      return;
    }

    if (
      input.entry_type === WALLET_LEDGER_ENTRY_TYPE_PRIVATE_BOOKING_PAYMENT &&
      !hasText(input.booking_id) &&
      hasText(input.private_booking_id)
    ) {
      return;
    }

    if (
      input.entry_type === WALLET_LEDGER_ENTRY_TYPE_ADMIN_ADJUSTMENT_DEBIT &&
      !hasText(input.booking_id) &&
      !hasText(input.private_booking_id)
    ) {
      return;
    }

    throw AppError.invalidRequest(
      'Wallet debit target shape is invalid for the selected ledger entry type.',
      {
        entry_type: input.entry_type,
        booking_id: input.booking_id ?? null,
        private_booking_id: input.private_booking_id ?? null,
      },
    );
  }

  static assertLedgerEntryType(entryType: string): WalletLedgerEntryType {
    if (isWalletLedgerEntryType(entryType)) {
      return entryType;
    }

    throw AppError.invalidRequest('Unsupported wallet ledger entry type.', {
      entry_type: entryType,
    });
  }

  static assertLedgerEntryStatus(entryStatus: string): WalletLedgerEntryStatus {
    if (isWalletLedgerEntryStatus(entryStatus)) {
      return entryStatus;
    }

    throw AppError.invalidRequest('Unsupported wallet ledger entry status.', {
      entry_status: entryStatus,
    });
  }

  static canTransitionLedgerStatus(
    input: WalletLedgerStatusTransitionInput,
  ): WalletLedgerStatusTransitionResult {
    if (input.current_status === input.next_status) {
      return {
        allowed: true,
        ignored: true,
        reason: 'duplicate_ledger_status_transition',
      };
    }

    const allowedNextStatuses = WALLET_LEDGER_STATUS_TRANSITIONS.get(
      input.current_status,
    );

    if (!allowedNextStatuses) {
      return {
        allowed: false,
        ignored: false,
        reason: 'unknown_current_ledger_status',
      };
    }

    if (allowedNextStatuses.has(input.next_status)) {
      return {
        allowed: true,
        ignored: false,
        reason: null,
      };
    }

    if (
      input.current_status === WALLET_LEDGER_ENTRY_STATUS_REVERSED ||
      input.current_status === WALLET_LEDGER_ENTRY_STATUS_FAILED
    ) {
      return {
        allowed: false,
        ignored: true,
        reason: 'terminal_ledger_status_transition_ignored',
      };
    }

    return {
      allowed: false,
      ignored: false,
      reason: 'ledger_status_transition_not_allowed',
    };
  }

  static assertLedgerStatusTransitionAllowed(
    input: WalletLedgerStatusTransitionInput,
  ): WalletLedgerStatusTransitionResult {
    const result = this.canTransitionLedgerStatus(input);

    if (result.allowed || result.ignored) {
      return result;
    }

    throw AppError.invalidRequest(
      'Wallet ledger status transition is not allowed.',
      {
        current_status: input.current_status,
        next_status: input.next_status,
        reason: result.reason,
      },
    );
  }

  static assertLedgerEntryCanBeReversed(
    ledgerEntry: WalletLedgerEntryRecord,
  ): void {
    if (ledgerEntry.entry_status === WALLET_LEDGER_ENTRY_STATUS_POSTED) {
      return;
    }

    throw AppError.invalidRequest(
      'Only posted wallet ledger entries can be reversed.',
      {
        ...ledgerDetails(ledgerEntry),
      },
    );
  }

  static assertLedgerBalanceMath(input: WalletLedgerBalanceMathInput): void {
    assertAmountPositive(input.amount, 'ledger amount');

    if (!Number.isFinite(input.balance_before)) {
      throw AppError.paymentAmountInvalid(
        'Wallet ledger balance_before must be a finite number.',
        {
          balance_before: input.balance_before,
        },
      );
    }

    if (!Number.isFinite(input.balance_after)) {
      throw AppError.paymentAmountInvalid(
        'Wallet ledger balance_after must be a finite number.',
        {
          balance_after: input.balance_after,
        },
      );
    }

    if (isWalletCreditEntryType(input.entry_type)) {
      const expectedBalanceAfter = roundWalletAmount(
        input.balance_before + input.amount,
      );

      if (roundWalletAmount(input.balance_after) === expectedBalanceAfter) {
        return;
      }

      throw AppError.paymentAmountInvalid(
        'Wallet credit ledger balance math is invalid.',
        {
          entry_type: input.entry_type,
          amount: input.amount,
          balance_before: input.balance_before,
          balance_after: input.balance_after,
          expected_balance_after: expectedBalanceAfter,
        },
      );
    }

    if (isWalletDebitEntryType(input.entry_type)) {
      const expectedBalanceAfter = roundWalletAmount(
        input.balance_before - input.amount,
      );

      if (
        roundWalletAmount(input.balance_after) === expectedBalanceAfter &&
        expectedBalanceAfter >= WALLET_BALANCE_MIN
      ) {
        return;
      }

      throw AppError.paymentAmountInvalid(
        'Wallet debit ledger balance math is invalid.',
        {
          entry_type: input.entry_type,
          amount: input.amount,
          balance_before: input.balance_before,
          balance_after: input.balance_after,
          expected_balance_after: expectedBalanceAfter,
        },
      );
    }

    throw AppError.invalidRequest(
      'Wallet ledger balance math cannot be resolved for unsupported entry type.',
      {
        entry_type: input.entry_type,
      },
    );
  }

  static resolveBalanceAfterCredit(input: WalletBalanceMutationInput): number {
    this.assertWalletCanCredit(input);

    return roundWalletAmount(input.wallet.available_balance + input.amount);
  }

  static resolveBalanceAfterDebit(input: WalletBalanceMutationInput): number {
    this.assertWalletActive(input.wallet);
    this.assertWalletCurrency(input.wallet, input.currency);
    assertAmountPositive(input.amount);

    return roundWalletAmount(input.wallet.available_balance - input.amount);
  }

  static resolveLedgerEntryTypeForPaymentTarget(
    targetType: PaymentTargetType,
  ): WalletLedgerEntryType {
    if (targetType === PAYMENT_TARGET_TYPE_BOOKING) {
      return WALLET_LEDGER_ENTRY_TYPE_BOOKING_PAYMENT;
    }

    if (targetType === PAYMENT_TARGET_TYPE_PRIVATE_BOOKING) {
      return WALLET_LEDGER_ENTRY_TYPE_PRIVATE_BOOKING_PAYMENT;
    }

    if (targetType === PAYMENT_TARGET_TYPE_WALLET_TOP_UP) {
      return WALLET_LEDGER_ENTRY_TYPE_WALLET_TOP_UP;
    }

    throw AppError.invalidRequest(
      'Wallet ledger entry type cannot be resolved for payment target.',
      {
        target_type: targetType,
      },
    );
  }

  static isCreditEntryType(entryType: string): boolean {
    return isWalletCreditEntryType(entryType);
  }

  static isDebitEntryType(entryType: string): boolean {
    return isWalletDebitEntryType(entryType);
  }

  static normalizeWalletCurrency(currency?: string | null): PaymentCurrency {
    if (!hasText(currency)) {
      return PAYMENT_DEFAULT_CURRENCY;
    }

    return assertCurrencySupported(currency);
  }
}
