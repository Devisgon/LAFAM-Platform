// apps/api/src/modules/payments/repositories/wallet.repository.ts
/**
 * LAFAM Wallet repository.
 *
 * Role:
 * - Owns Wallet database reads for wallet accounts and wallet ledger entries.
 * - Wraps wallet atomic RPC calls.
 * - Provides customer/admin wallet list and lookup helpers.
 * - Converts database/RPC failures into frontend-safe AppError instances.
 *
 * Important:
 * - This repository does not perform authorization.
 * - This repository does not decide wallet business rules.
 * - This repository does not mutate wallet balances directly.
 * - Wallet debit/credit mutation must stay inside atomic PostgreSQL RPCs.
 * - Admin wallet adjustment is intentionally not implemented here because the
 *   current database contract does not expose an atomic admin adjustment RPC.
 */

import { Inject, Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { SUPABASE_ADMIN_CLIENT } from '../../../database/database.constants';
import type {
  DatabaseJsonObject,
  LAFAMSupabaseClient,
} from '../../../database/database.types';
import {
  ADMIN_WALLET_LIST_DEFAULT_LIMIT,
  ADMIN_WALLET_LIST_DEFAULT_OFFSET,
  ADMIN_WALLET_LIST_MAX_LIMIT,
  PAYMENT_DEFAULT_CURRENCY,
  WALLET_ACCOUNT_STATUS_ACTIVE,
  WALLET_LEDGER_LIST_DEFAULT_LIMIT,
  WALLET_LEDGER_LIST_DEFAULT_OFFSET,
  WALLET_LEDGER_LIST_MAX_LIMIT,
  type PaymentCurrency,
  type WalletAccountStatus,
} from '../constants/payment.constants';
import type {
  AdminWalletListQuery,
  CreditWalletAtomicResult,
  DebitWalletForBookingAtomicResult,
  PaymentRepositoryListResult,
  WalletAccountCreateRecord,
  WalletAccountRecord,
  WalletLedgerEntryRecord,
  WalletLedgerListQuery,
} from '../types/payment.types';

interface ProviderDatabaseError {
  readonly code?: string;
  readonly message?: string;
  readonly details?: string;
  readonly hint?: string;
}

interface WalletAccountUserCurrencyInput {
  readonly user_id: string;
  readonly currency?: PaymentCurrency;
}

interface WalletAccountStatusUpdateInput {
  readonly wallet_account_id: string;
  readonly status: WalletAccountStatus;
}

interface DebitWalletForBookingAtomicInput {
  readonly payment_id: string;
  readonly description?: string | null;
  readonly metadata?: DatabaseJsonObject;
}

interface CreditWalletAtomicInput {
  readonly user_id: string;
  readonly amount: number;
  readonly currency?: PaymentCurrency;
  readonly payment_id?: string | null;
  readonly description?: string | null;
  readonly metadata?: DatabaseJsonObject;
}

interface WalletLedgerLookupInput {
  readonly ledger_entry_id: string;
  readonly user_id?: string;
}

const POSTGRES_UNIQUE_VIOLATION_CODE = '23505';
const POSTGRES_FOREIGN_KEY_VIOLATION_CODE = '23503';
const POSTGRES_CHECK_VIOLATION_CODE = '23514';
const POSTGRES_RAISE_EXCEPTION_CODE = 'P0001';

function isProviderDatabaseError(
  error: unknown,
): error is ProviderDatabaseError {
  return typeof error === 'object' && error !== null;
}

function databaseMessageIncludes(
  error: ProviderDatabaseError,
  searchValue: string,
): boolean {
  return (
    error.message?.toLowerCase().includes(searchValue.toLowerCase()) ?? false
  );
}

function createProviderErrorDetails(
  error: ProviderDatabaseError,
): Record<string, unknown> {
  return {
    ...(error.code ? { provider_code: error.code } : {}),
    ...(error.details ? { provider_details: error.details } : {}),
    ...(error.hint ? { provider_hint: error.hint } : {}),
  };
}

function isWalletAccountDuplicateError(error: unknown): boolean {
  if (!isProviderDatabaseError(error)) {
    return false;
  }

  return (
    error.code === POSTGRES_UNIQUE_VIOLATION_CODE &&
    databaseMessageIncludes(error, 'wallet_accounts_user_currency_uidx')
  );
}

function mapWalletDatabaseError(error: unknown): AppError {
  if (!isProviderDatabaseError(error)) {
    return AppError.walletTransactionFailed(error);
  }

  const details = createProviderErrorDetails(error);

  if (error.code === POSTGRES_RAISE_EXCEPTION_CODE) {
    if (databaseMessageIncludes(error, 'insufficient wallet balance')) {
      return AppError.walletInsufficientBalance(
        'Wallet has insufficient available balance.',
        details,
      );
    }

    if (databaseMessageIncludes(error, 'wallet account is not active')) {
      return AppError.walletNotActive('Wallet account is not active.', details);
    }

    if (
      databaseMessageIncludes(error, 'wallet account was not found') ||
      databaseMessageIncludes(error, 'wallet account could not be created')
    ) {
      return AppError.walletNotFound('Wallet account was not found.', details);
    }

    if (databaseMessageIncludes(error, 'payment was not found')) {
      return AppError.paymentNotFound('Payment was not found.', details);
    }

    if (
      databaseMessageIncludes(error, 'payment is not a wallet payment') ||
      databaseMessageIncludes(error, 'wallet payment is not pending') ||
      databaseMessageIncludes(error, 'wallet debit is only supported') ||
      databaseMessageIncludes(error, 'target booking was not found') ||
      databaseMessageIncludes(
        error,
        'target private trainer booking was not found',
      ) ||
      databaseMessageIncludes(error, 'target booking is not pending payment') ||
      databaseMessageIncludes(
        error,
        'target private trainer booking is not pending payment',
      )
    ) {
      return AppError.invalidRequest(
        error.message ?? 'Wallet transaction request is invalid.',
        details,
      );
    }

    return AppError.walletTransactionFailed(error);
  }

  if (error.code === POSTGRES_UNIQUE_VIOLATION_CODE) {
    return AppError.invalidRequest(
      'Duplicate wallet account or wallet ledger reference was detected.',
      details,
    );
  }

  if (error.code === POSTGRES_FOREIGN_KEY_VIOLATION_CODE) {
    return AppError.invalidRequest(
      'A related wallet, user, payment, booking, or private booking record was not found.',
      details,
    );
  }

  if (error.code === POSTGRES_CHECK_VIOLATION_CODE) {
    return AppError.invalidRequest(
      'The submitted wallet data violates database constraints.',
      details,
    );
  }

  return AppError.walletTransactionFailed(error);
}

function resolveLimit(
  value: number,
  defaultValue: number,
  maxValue: number,
): number {
  if (!Number.isFinite(value)) {
    return defaultValue;
  }

  const normalizedValue = Math.floor(value);

  if (normalizedValue < 1) {
    return defaultValue;
  }

  return Math.min(normalizedValue, maxValue);
}

function resolveOffset(value: number, defaultValue: number): number {
  if (!Number.isFinite(value)) {
    return defaultValue;
  }

  const normalizedValue = Math.floor(value);

  return normalizedValue >= 0 ? normalizedValue : defaultValue;
}

function resolveRangeEnd(offset: number, limit: number): number {
  return offset + limit - 1;
}

function resolveTotal(count: number | null): number {
  return typeof count === 'number' && Number.isFinite(count) ? count : 0;
}

function startOfIsoDate(value: string): string {
  return `${value}T00:00:00.000Z`;
}

function endOfIsoDate(value: string): string {
  return `${value}T23:59:59.999Z`;
}

function resolveCurrency(currency?: PaymentCurrency): PaymentCurrency {
  return currency ?? PAYMENT_DEFAULT_CURRENCY;
}

function getRequiredRpcRow<TRow>(
  rows: readonly TRow[] | null,
  operation: string,
): TRow {
  const row = rows?.[0];

  if (typeof row !== 'undefined') {
    return row;
  }

  throw AppError.walletTransactionFailed(
    new Error(`${operation} did not return a result row.`),
  );
}

@Injectable()
export class WalletRepository {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly adminClient: LAFAMSupabaseClient,
  ) {}

  async createWalletAccount(
    payload: WalletAccountCreateRecord,
  ): Promise<WalletAccountRecord> {
    const { data, error } = await this.adminClient
      .from('wallet_accounts')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      throw mapWalletDatabaseError(error);
    }

    return data;
  }

  async ensureWalletAccountForUser(
    input: WalletAccountUserCurrencyInput,
  ): Promise<WalletAccountRecord> {
    const currency = resolveCurrency(input.currency);

    const existingWallet = await this.findWalletAccountByUserIdAndCurrency({
      user_id: input.user_id,
      currency,
    });

    if (existingWallet) {
      return existingWallet;
    }

    const payload: WalletAccountCreateRecord = {
      user_id: input.user_id,
      currency,
      status: WALLET_ACCOUNT_STATUS_ACTIVE,
    };

    const { data, error } = await this.adminClient
      .from('wallet_accounts')
      .insert(payload)
      .select('*')
      .maybeSingle();

    if (error) {
      if (isWalletAccountDuplicateError(error)) {
        const duplicatedWallet =
          await this.findWalletAccountByUserIdAndCurrency({
            user_id: input.user_id,
            currency,
          });

        if (duplicatedWallet) {
          return duplicatedWallet;
        }
      }

      throw mapWalletDatabaseError(error);
    }

    if (data) {
      return data;
    }

    const wallet = await this.findWalletAccountByUserIdAndCurrency({
      user_id: input.user_id,
      currency,
    });

    if (wallet) {
      return wallet;
    }

    throw AppError.walletNotFound('Wallet account could not be created.', {
      user_id: input.user_id,
      currency,
    });
  }

  async findWalletAccountById(
    walletAccountId: string,
  ): Promise<WalletAccountRecord | null> {
    const { data, error } = await this.adminClient
      .from('wallet_accounts')
      .select('*')
      .eq('id', walletAccountId)
      .maybeSingle();

    if (error) {
      throw mapWalletDatabaseError(error);
    }

    return data;
  }

  async findWalletAccountByIdForUser(
    walletAccountId: string,
    userId: string,
  ): Promise<WalletAccountRecord | null> {
    const { data, error } = await this.adminClient
      .from('wallet_accounts')
      .select('*')
      .eq('id', walletAccountId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw mapWalletDatabaseError(error);
    }

    return data;
  }

  async findWalletAccountByUserIdAndCurrency(
    input: WalletAccountUserCurrencyInput,
  ): Promise<WalletAccountRecord | null> {
    const currency = resolveCurrency(input.currency);

    const { data, error } = await this.adminClient
      .from('wallet_accounts')
      .select('*')
      .eq('user_id', input.user_id)
      .eq('currency', currency)
      .maybeSingle();

    if (error) {
      throw mapWalletDatabaseError(error);
    }

    return data;
  }

  async updateWalletAccountStatus(
    input: WalletAccountStatusUpdateInput,
  ): Promise<WalletAccountRecord> {
    const { data, error } = await this.adminClient
      .from('wallet_accounts')
      .update({
        status: input.status,
      })
      .eq('id', input.wallet_account_id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw mapWalletDatabaseError(error);
    }

    if (!data) {
      throw AppError.walletNotFound('Wallet account was not found.', {
        wallet_account_id: input.wallet_account_id,
      });
    }

    return data;
  }

  async listAdminWalletAccounts(
    input: AdminWalletListQuery,
  ): Promise<PaymentRepositoryListResult<WalletAccountRecord>> {
    const limit = resolveLimit(
      input.limit,
      ADMIN_WALLET_LIST_DEFAULT_LIMIT,
      ADMIN_WALLET_LIST_MAX_LIMIT,
    );
    const offset = resolveOffset(
      input.offset,
      ADMIN_WALLET_LIST_DEFAULT_OFFSET,
    );

    let query = this.adminClient
      .from('wallet_accounts')
      .select('*', { count: 'exact' });

    if (input.user_id) {
      query = query.eq('user_id', input.user_id);
    }

    if (input.status) {
      query = query.eq('status', input.status);
    }

    if (input.from_date) {
      query = query.gte('created_at', startOfIsoDate(input.from_date));
    }

    if (input.to_date) {
      query = query.lte('created_at', endOfIsoDate(input.to_date));
    }

    const { data, error, count } = await query
      .order(input.sort_by, {
        ascending: input.sort_direction === 'asc',
      })
      .range(offset, resolveRangeEnd(offset, limit));

    if (error) {
      throw mapWalletDatabaseError(error);
    }

    return {
      records: data ?? [],
      total: resolveTotal(count),
    };
  }

  async findWalletLedgerEntryById(
    ledgerEntryId: string,
  ): Promise<WalletLedgerEntryRecord | null> {
    const { data, error } = await this.adminClient
      .from('wallet_ledger_entries')
      .select('*')
      .eq('id', ledgerEntryId)
      .maybeSingle();

    if (error) {
      throw mapWalletDatabaseError(error);
    }

    return data;
  }

  async findWalletLedgerEntry(
    input: WalletLedgerLookupInput,
  ): Promise<WalletLedgerEntryRecord | null> {
    let query = this.adminClient
      .from('wallet_ledger_entries')
      .select('*')
      .eq('id', input.ledger_entry_id);

    if (input.user_id) {
      query = query.eq('user_id', input.user_id);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw mapWalletDatabaseError(error);
    }

    return data;
  }

  async listWalletLedgerEntries(
    input: WalletLedgerListQuery,
  ): Promise<PaymentRepositoryListResult<WalletLedgerEntryRecord>> {
    const limit = resolveLimit(
      input.limit,
      WALLET_LEDGER_LIST_DEFAULT_LIMIT,
      WALLET_LEDGER_LIST_MAX_LIMIT,
    );
    const offset = resolveOffset(
      input.offset,
      WALLET_LEDGER_LIST_DEFAULT_OFFSET,
    );

    let query = this.adminClient
      .from('wallet_ledger_entries')
      .select('*', { count: 'exact' })
      .eq('user_id', input.user_id);

    if (input.wallet_account_id) {
      query = query.eq('wallet_account_id', input.wallet_account_id);
    }

    if (input.entry_type) {
      query = query.eq('entry_type', input.entry_type);
    }

    if (input.entry_status) {
      query = query.eq('entry_status', input.entry_status);
    }

    if (input.from_date) {
      query = query.gte('created_at', startOfIsoDate(input.from_date));
    }

    if (input.to_date) {
      query = query.lte('created_at', endOfIsoDate(input.to_date));
    }

    const { data, error, count } = await query
      .order(input.sort_by, {
        ascending: input.sort_direction === 'asc',
      })
      .range(offset, resolveRangeEnd(offset, limit));

    if (error) {
      throw mapWalletDatabaseError(error);
    }

    return {
      records: data ?? [],
      total: resolveTotal(count),
    };
  }

  async listWalletLedgerEntriesByPaymentId(
    paymentId: string,
  ): Promise<readonly WalletLedgerEntryRecord[]> {
    const { data, error } = await this.adminClient
      .from('wallet_ledger_entries')
      .select('*')
      .eq('payment_id', paymentId)
      .order('created_at', {
        ascending: false,
      });

    if (error) {
      throw mapWalletDatabaseError(error);
    }

    return data ?? [];
  }

  async listWalletLedgerEntriesByWalletAccountId(
    walletAccountId: string,
  ): Promise<readonly WalletLedgerEntryRecord[]> {
    const { data, error } = await this.adminClient
      .from('wallet_ledger_entries')
      .select('*')
      .eq('wallet_account_id', walletAccountId)
      .order('created_at', {
        ascending: false,
      });

    if (error) {
      throw mapWalletDatabaseError(error);
    }

    return data ?? [];
  }

  async debitWalletForBookingAtomic(
    input: DebitWalletForBookingAtomicInput,
  ): Promise<DebitWalletForBookingAtomicResult> {
    const { data, error } = await this.adminClient.rpc(
      'debit_wallet_for_booking_atomic',
      {
        p_payment_id: input.payment_id,
        p_description: input.description ?? null,
        p_metadata: input.metadata ?? {},
      },
    );

    if (error) {
      throw mapWalletDatabaseError(error);
    }

    return getRequiredRpcRow<DebitWalletForBookingAtomicResult>(
      data,
      'debit_wallet_for_booking_atomic',
    );
  }

  async creditWalletAtomic(
    input: CreditWalletAtomicInput,
  ): Promise<CreditWalletAtomicResult> {
    const { data, error } = await this.adminClient.rpc('credit_wallet_atomic', {
      p_user_id: input.user_id,
      p_amount: input.amount,
      p_currency: resolveCurrency(input.currency),
      p_payment_id: input.payment_id ?? null,
      p_description: input.description ?? null,
      p_metadata: input.metadata ?? {},
    });

    if (error) {
      throw mapWalletDatabaseError(error);
    }

    return getRequiredRpcRow<CreditWalletAtomicResult>(
      data,
      'credit_wallet_atomic',
    );
  }
}
