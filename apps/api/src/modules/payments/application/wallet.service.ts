// apps/api/src/modules/payments/application/wallet.service.ts
/**
 * LAFAM Wallet service.
 *
 * Role:
 * - Provides customer wallet balance access.
 * - Provides customer wallet ledger history.
 * - Starts wallet top-up checkout through PaymentCheckoutService.
 * - Provides admin wallet listing/detail helpers.
 * - Preserves booking-order wallet ledger/payment identity in wallet responses.
 * - Rejects unsafe admin wallet adjustment until an atomic database RPC exists.
 *
 * Important:
 * - This service does not directly mutate wallet balances.
 * - This service does not perform read-balance-then-update logic.
 * - Wallet debit/credit mutation must stay inside atomic PostgreSQL RPCs.
 * - Customer wallet reads enforce ownership.
 * - Guest users cannot use wallet features.
 * - Booking-order wallet debits are handled by the checkout/wallet RPC path.
 * - Wallet top-up checkout creation must not send a success email.
 * - Wallet top-up success, failure, and expiry emails belong to verified
 *   payment/wallet settlement transitions, not wallet read or checkout-start
 *   methods.
 * - Wallet booking debit success email is handled by PaymentCheckoutService
 *   after the atomic wallet debit succeeds.
 * - Admin wallet adjustment emails remain blocked until an atomic admin wallet
 *   adjustment RPC exists.
 * - Admin adjustment is deliberately blocked because the current database
 *   contract does not expose an atomic admin wallet adjustment RPC.
 */

import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import {
  PAYMENT_TARGET_TYPE_WALLET_TOP_UP,
  WALLET_LEDGER_ENTRY_TYPE_WALLET_TOP_UP,
  type PaymentCurrency,
} from '../constants/payment.constants';
import { PaymentSecurityPolicy } from '../domain/payment-security.policy';
import { WalletLedgerPolicy } from '../domain/wallet-ledger.policy';
import { WalletRepository } from '../repositories/wallet.repository';
import type {
  AdminWalletAdjustmentInput,
  AdminWalletAdjustmentResponse,
  AdminWalletListQuery,
  PaymentPaginatedResult,
  PaymentRecord,
  PaymentSummary,
  WalletAccountRecord,
  WalletAccountResponse,
  WalletAccountSummary,
  WalletLedgerEntryRecord,
  WalletLedgerEntrySummary,
  WalletLedgerListQuery,
  WalletLedgerListResponse,
  WalletTopUpInput,
  WalletTopUpResponse,
} from '../types/payment.types';
import { PaymentCheckoutService } from './payment-checkout.service';

interface CustomerWalletInput {
  readonly user_id: string;
  readonly currency?: PaymentCurrency;
  readonly is_guest?: boolean;
}

interface CustomerWalletLedgerInput extends WalletLedgerListQuery {
  readonly is_guest?: boolean;
}

interface CustomerWalletLedgerEntryInput {
  readonly user_id: string;
  readonly ledger_entry_id: string;
  readonly is_guest?: boolean;
}

interface WalletTopUpServiceInput extends WalletTopUpInput {
  readonly is_guest?: boolean;
}

interface AdminWalletByUserInput {
  readonly user_id: string;
  readonly currency?: PaymentCurrency;
}

interface AdminWalletByIdInput {
  readonly wallet_account_id: string;
}

type AdminWalletLedgerListInput = WalletLedgerListQuery;

function assertWalletFeatureAvailableForCustomer(input: {
  readonly user_id: string;
  readonly is_guest?: boolean;
}): void {
  if (input.is_guest === true) {
    throw AppError.walletAccessDenied('Guest users cannot access wallet.', {
      user_id: input.user_id,
    });
  }
}

function buildPaginatedResult<TItem>(input: {
  readonly records: readonly TItem[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}): PaymentPaginatedResult<TItem> {
  return {
    items: input.records,
    total: input.total,
    limit: input.limit,
    offset: input.offset,
    has_more: input.offset + input.records.length < input.total,
  };
}

function mapWalletAccountToSummary(
  wallet: WalletAccountRecord,
): WalletAccountSummary {
  return {
    id: wallet.id,
    user_id: wallet.user_id,
    currency: WalletLedgerPolicy.normalizeWalletCurrency(wallet.currency),
    available_balance: wallet.available_balance,
    pending_balance: wallet.pending_balance,
    status: wallet.status,
    created_at: wallet.created_at,
    updated_at: wallet.updated_at,
    realtime_version: wallet.realtime_version,
  };
}

function mapWalletLedgerEntryToSummary(
  ledgerEntry: WalletLedgerEntryRecord,
): WalletLedgerEntrySummary {
  return {
    id: ledgerEntry.id,
    wallet_account_id: ledgerEntry.wallet_account_id,
    user_id: ledgerEntry.user_id,
    payment_id: ledgerEntry.payment_id,
    booking_id: ledgerEntry.booking_id,
    private_booking_id: ledgerEntry.private_booking_id,
    booking_order_id: ledgerEntry.booking_order_id,
    entry_type: WalletLedgerPolicy.assertLedgerEntryType(
      ledgerEntry.entry_type,
    ),
    entry_status: WalletLedgerPolicy.assertLedgerEntryStatus(
      ledgerEntry.entry_status,
    ),
    amount: ledgerEntry.amount,
    balance_before: ledgerEntry.balance_before,
    balance_after: ledgerEntry.balance_after,
    description: ledgerEntry.description,
    metadata: ledgerEntry.metadata,
    created_at: ledgerEntry.created_at,
  };
}

function mapPaymentToSummary(payment: PaymentRecord): PaymentSummary {
  return {
    id: payment.id,
    payment_number: payment.payment_number,
    receipt_number: payment.receipt_number,
    user_id: payment.user_id,
    target_type: payment.target_type,
    booking_id: payment.booking_id,
    private_booking_id: payment.private_booking_id,
    booking_order_id: payment.booking_order_id,
    amount: payment.amount,
    discount_amount: payment.discount_amount,
    final_amount: payment.final_amount,
    currency: WalletLedgerPolicy.normalizeWalletCurrency(payment.currency),
    payment_method: payment.payment_method,
    payment_provider: payment.payment_provider,
    status: payment.status,
    redirect_url: payment.redirect_url,
    paid_at: payment.paid_at,
    failed_at: payment.failed_at,
    cancelled_at: payment.cancelled_at,
    expired_at: payment.expired_at,
    refunded_at: payment.refunded_at,
    refunded_amount: payment.refunded_amount,
    expires_at: payment.expires_at,
    created_at: payment.created_at,
    updated_at: payment.updated_at,
    realtime_version: payment.realtime_version,
  };
}

@Injectable()
export class WalletService {
  constructor(
    private readonly walletRepository: WalletRepository,
    private readonly paymentCheckoutService: PaymentCheckoutService,
  ) {}

  async getCustomerWallet(
    input: CustomerWalletInput,
  ): Promise<WalletAccountResponse> {
    assertWalletFeatureAvailableForCustomer(input);

    const wallet = await this.walletRepository.ensureWalletAccountForUser({
      user_id: input.user_id,
      currency: input.currency,
    });

    PaymentSecurityPolicy.assertWalletOwnedByUser({
      wallet,
      user_id: input.user_id,
    });

    return {
      wallet: mapWalletAccountToSummary(wallet),
    };
  }

  async listCustomerWalletTransactions(
    input: CustomerWalletLedgerInput,
  ): Promise<WalletLedgerListResponse> {
    assertWalletFeatureAvailableForCustomer(input);

    if (input.wallet_account_id) {
      const wallet = await this.walletRepository.findWalletAccountById(
        input.wallet_account_id,
      );

      if (!wallet) {
        throw AppError.walletNotFound('Wallet account was not found.', {
          wallet_account_id: input.wallet_account_id,
          user_id: input.user_id,
        });
      }

      PaymentSecurityPolicy.assertWalletOwnedByUser({
        wallet,
        user_id: input.user_id,
      });
    }

    const result = await this.walletRepository.listWalletLedgerEntries(input);

    return {
      transactions: buildPaginatedResult({
        records: result.records.map(mapWalletLedgerEntryToSummary),
        total: result.total,
        limit: input.limit,
        offset: input.offset,
      }),
    };
  }

  async getCustomerWalletTransaction(
    input: CustomerWalletLedgerEntryInput,
  ): Promise<WalletLedgerEntrySummary> {
    assertWalletFeatureAvailableForCustomer(input);

    const ledgerEntry = await this.walletRepository.findWalletLedgerEntry({
      ledger_entry_id: input.ledger_entry_id,
      user_id: input.user_id,
    });

    if (!ledgerEntry) {
      throw AppError.walletNotFound('Wallet transaction was not found.', {
        wallet_ledger_entry_id: input.ledger_entry_id,
        user_id: input.user_id,
      });
    }

    PaymentSecurityPolicy.assertWalletLedgerEntryOwnedByUser({
      ledger_entry: ledgerEntry,
      user_id: input.user_id,
    });

    return mapWalletLedgerEntryToSummary(ledgerEntry);
  }

  async createWalletTopUp(
    input: WalletTopUpServiceInput,
  ): Promise<WalletTopUpResponse> {
    assertWalletFeatureAvailableForCustomer(input);

    WalletLedgerPolicy.assertTopUpCreditInput({
      user_id: input.user_id,
      amount: input.amount,
      currency: input.currency,
      payment_id: null,
      entry_type: WALLET_LEDGER_ENTRY_TYPE_WALLET_TOP_UP,
      description: 'Wallet top-up payment.',
      metadata: input.metadata,
    });

    await this.walletRepository.ensureWalletAccountForUser({
      user_id: input.user_id,
      currency: input.currency,
    });

    const checkoutResult =
      await this.paymentCheckoutService.createCheckoutPayment({
        user_id: input.user_id,
        target_type: PAYMENT_TARGET_TYPE_WALLET_TOP_UP,
        wallet_top_up_amount: input.amount,
        currency: input.currency,
        payment_method: input.payment_method,
        idempotency_key: input.idempotency_key,
        metadata: input.metadata,
        is_guest: input.is_guest,
      });

    if (!checkoutResult.requires_redirect) {
      throw AppError.invalidRequest(
        'Wallet top-up must return a hosted payment redirect.',
        {
          payment_id: checkoutResult.payment.id,
          payment_status: checkoutResult.payment.status,
        },
      );
    }

    return {
      payment: mapPaymentToSummary(checkoutResult.payment),
      redirect_url: checkoutResult.redirect_url,
    };
  }

  async listAdminWallets(
    input: AdminWalletListQuery,
  ): Promise<PaymentPaginatedResult<WalletAccountSummary>> {
    const result = await this.walletRepository.listAdminWalletAccounts(input);

    return buildPaginatedResult({
      records: result.records.map(mapWalletAccountToSummary),
      total: result.total,
      limit: input.limit,
      offset: input.offset,
    });
  }

  async getAdminWalletByUserId(
    input: AdminWalletByUserInput,
  ): Promise<WalletAccountResponse> {
    const wallet =
      await this.walletRepository.findWalletAccountByUserIdAndCurrency({
        user_id: input.user_id,
        currency: input.currency,
      });

    if (!wallet) {
      throw AppError.walletNotFound('Wallet account was not found.', {
        user_id: input.user_id,
        currency:
          input.currency ??
          WalletLedgerPolicy.normalizeWalletCurrency(undefined),
      });
    }

    return {
      wallet: mapWalletAccountToSummary(wallet),
    };
  }

  async getAdminWalletByWalletAccountId(
    input: AdminWalletByIdInput,
  ): Promise<WalletAccountResponse> {
    const wallet = await this.walletRepository.findWalletAccountById(
      input.wallet_account_id,
    );

    if (!wallet) {
      throw AppError.walletNotFound('Wallet account was not found.', {
        wallet_account_id: input.wallet_account_id,
      });
    }

    return {
      wallet: mapWalletAccountToSummary(wallet),
    };
  }

  async listAdminWalletTransactions(
    input: AdminWalletLedgerListInput,
  ): Promise<WalletLedgerListResponse> {
    if (input.wallet_account_id) {
      const wallet = await this.walletRepository.findWalletAccountById(
        input.wallet_account_id,
      );

      if (!wallet) {
        throw AppError.walletNotFound('Wallet account was not found.', {
          wallet_account_id: input.wallet_account_id,
          user_id: input.user_id,
        });
      }

      if (wallet.user_id !== input.user_id) {
        throw AppError.invalidRequest(
          'Wallet account does not belong to the requested user.',
          {
            wallet_account_id: wallet.id,
            wallet_user_id: wallet.user_id,
            requested_user_id: input.user_id,
          },
        );
      }
    }

    const result = await this.walletRepository.listWalletLedgerEntries(input);

    return {
      transactions: buildPaginatedResult({
        records: result.records.map(mapWalletLedgerEntryToSummary),
        total: result.total,
        limit: input.limit,
        offset: input.offset,
      }),
    };
  }

  adjustWalletAsAdmin(
    input: AdminWalletAdjustmentInput,
  ): Promise<AdminWalletAdjustmentResponse> {
    PaymentSecurityPolicy.assertAdminActionHasAuditReason({
      admin_user_id: input.admin_user_id,
      reason: input.reason,
      metadata: input.metadata,
    });

    WalletLedgerPolicy.assertAdminWalletAdjustmentInput(input);

    PaymentSecurityPolicy.sanitizeMetadata(input.metadata);

    throw AppError.invalidRequest(
      'Admin wallet adjustment is blocked because no atomic admin wallet adjustment RPC exists yet.',
      {
        admin_user_id: input.admin_user_id,
        target_user_id: input.target_user_id,
        entry_type: input.entry_type,
        amount: input.amount,
        currency: input.currency,
      },
    );
  }
}
