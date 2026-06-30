"use client";

import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { LoadingState } from "@/components/data-display/LoadingState";
import { WalletTransactionTable } from "@/components/data-display/WalletTransactionTable";
import type { AdminUser } from "@/modules/users";

import type { AdminWalletFilters, AdminWalletLedgerSortField, AdminWalletTransactionFilters } from "../../api/adminWalletApi";
import { pageSizeOptions } from "../../constants/walletUi.constants";
import {
  useAdminWallets,
  useAdminWalletTransactions,
} from "../../hooks/useAdminWallets";
import { formatMoney, getWalletUserName } from "../../utils/walletFormatters";
import { DateField, FilterSelect, PaginationFooter } from "./WalletControls";

export function WalletTransactionsPanel({
  areUsersLoading,
  initialUserId,
  initialWalletId,
  onBack,
  userOptions,
  usersById,
  usersError,
}: {
  areUsersLoading: boolean;
  initialUserId: string;
  initialWalletId: string;
  onBack: () => void;
  userOptions: ReadonlyArray<readonly [string, string]>;
  usersById: Map<string, AdminUser>;
  usersError: string | null;
}) {
  const [userId, setUserId] = useState(initialUserId);
  const [walletAccountId, setWalletAccountId] = useState(initialWalletId);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortBy, setSortBy] =
    useState<AdminWalletLedgerSortField>("created_at");
  const [pageSize, setPageSize] = useState(pageSizeOptions[0]);
  const [currentPage, setCurrentPage] = useState(1);

  const walletFilters = useMemo<AdminWalletFilters>(
    () => ({
      limit: 100,
      offset: 0,
      sort_by: "created_at",
      sort_direction: "desc",
      ...(userId ? { user_id: userId } : {}),
    }),
    [userId],
  );
  const {
    wallets,
    error: walletOptionsError,
    isLoading: areWalletOptionsLoading,
  } = useAdminWallets(walletFilters);
  const walletOptions = useMemo(
    () =>
      wallets.map(
        (wallet) =>
          [
            wallet.id,
            `${getWalletUserName(wallet.user_id, usersById)} - ${formatMoney(wallet.available_balance)}`,
          ] as const,
      ),
    [usersById, wallets],
  );
  const filters = useMemo<AdminWalletTransactionFilters>(
    () => ({
      limit: pageSize,
      offset: (currentPage - 1) * pageSize,
      sort_by: sortBy,
      sort_direction: "desc",
      ...(walletAccountId ? { wallet_account_id: walletAccountId } : {}),
      ...(fromDate ? { from_date: fromDate } : {}),
      ...(toDate ? { to_date: toDate } : {}),
    }),
    [currentPage, fromDate, pageSize, sortBy, toDate, walletAccountId],
  );
  const { error, isLoading, loadTransactions, total, transactions } =
    useAdminWalletTransactions(userId, filters, Boolean(userId));
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safeCurrentPage = Math.min(currentPage, pageCount);
  const visibleStart = total === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const visibleEnd = Math.min(
    (safeCurrentPage - 1) * pageSize + transactions.length,
    total,
  );
  const resetToFirstPage = () => setCurrentPage(1);

  return (
    <section
      aria-label="Wallet transaction ledger"
      className="overflow-hidden rounded-md bg-card-bg-primary shadow-sm"
    >
      <header className="flex flex-col gap-4 border-b border-background-secondary bg-card-bg-secondary px-5 py-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-semibold text-txt-secondary">
            Wallet module
          </p>
          <h2 className="mt-1 text-2xl font-medium text-txt-primary">
            Transaction Ledger
          </h2>
          <p className="mt-1 text-sm text-txt-secondary">
            Search wallet transactions by user, account, date, and amount sort.
          </p>
        </div>
        <button
          className="min-h-11 rounded-sm border border-background-secondary px-5 text-sm font-semibold text-txt-secondary transition hover:bg-background-secondary"
          onClick={onBack}
          type="button"
        >
          Back to wallets
        </button>
      </header>

      <div className="grid gap-4 border-b border-background-secondary px-5 py-5">
        <div className="grid gap-3 md:grid-cols-2">
          <FilterSelect
            disabled={areUsersLoading || userOptions.length === 0}
            label="User"
            onChange={(value) => {
              setUserId(value);
              setWalletAccountId("");
              resetToFirstPage();
            }}
            options={[
              ["", areUsersLoading ? "Loading users..." : "Select user"],
              ...userOptions,
            ]}
            value={userId}
          />
          <FilterSelect
            disabled={
              !userId || areWalletOptionsLoading || walletOptions.length === 0
            }
            label="Wallet account"
            onChange={(value) => {
              setWalletAccountId(value);
              resetToFirstPage();
            }}
            options={[
              [
                "",
                !userId
                  ? "Select user first"
                  : areWalletOptionsLoading
                    ? "Loading wallets..."
                    : "All wallet accounts",
              ],
              ...walletOptions,
            ]}
            value={walletAccountId}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <DateField
            label="From date"
            onChange={(value) => {
              setFromDate(value);
              resetToFirstPage();
            }}
            value={fromDate}
          />
          <DateField
            label="To date"
            onChange={(value) => {
              setToDate(value);
              resetToFirstPage();
            }}
            value={toDate}
          />
          <FilterSelect
            label="Sort"
            onChange={(value) => {
              setSortBy(value as AdminWalletLedgerSortField);
              resetToFirstPage();
            }}
            options={[
              ["created_at", "Newest first"],
              ["amount", "Amount"],
            ]}
            value={sortBy}
          />
          <button
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-sm bg-button-primary px-4 text-sm font-semibold text-txt-primary transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!userId || isLoading}
            onClick={() => void loadTransactions().catch(() => undefined)}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={16} />
            Refresh
          </button>
        </div>

        {usersError || walletOptionsError ? (
          <p className="text-sm text-error" role="alert">
            {usersError ?? walletOptionsError}
          </p>
        ) : null}
      </div>

      {!userId ? (
        <div className="p-6">
          <p className="text-sm text-txt-secondary">
            Select a user to load wallet transactions.
          </p>
        </div>
      ) : isLoading ? (
        <LoadingState className="p-6" label="Loading wallet transactions" />
      ) : error ? (
        <div className="p-6">
          <p className="text-sm text-txt-primary" role="alert">
            {error}
          </p>
          <button
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-button-primary px-4 py-2 text-xs font-bold text-txt-primary"
            onClick={() => void loadTransactions().catch(() => undefined)}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={14} />
            Try again
          </button>
        </div>
      ) : (
        <>
          <WalletTransactionTable
            getUserName={(transaction) =>
              getWalletUserName(transaction.user_id, usersById)
            }
            getWalletName={(transaction) =>
              `${getWalletUserName(transaction.user_id, usersById)}'s wallet`
            }
            transactions={transactions}
          />

          <PaginationFooter
            currentPage={safeCurrentPage}
            onPageChange={setCurrentPage}
            onPageSizeChange={(value) => {
              setPageSize(value);
              setCurrentPage(1);
            }}
            pageCount={pageCount}
            pageSize={pageSize}
            total={total}
            visibleEnd={visibleEnd}
            visibleStart={visibleStart}
          />
        </>
      )}
    </section>
  );
}
