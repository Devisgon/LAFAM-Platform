"use client";

import { useMemo, useState } from "react";
import { ReceiptText, RotateCcw, Search } from "lucide-react";
import { DataTable } from "@/components/data-display/DataTable";
import { LoadingState } from "@/components/data-display/LoadingState";
import { Toast } from "@/components/ui/Toast";
import type { AdminUser } from "@/modules/users";

import {
  adminWalletsClient,
  type AdminWalletFilters,
  type WalletAccountSummary,
} from "../../api/adminWalletApi";
import { pageSizeOptions } from "../../constants/walletUi.constants";
import { useAdminWallets } from "../../hooks/useAdminWallets";
import type { ResultToast } from "../../types/walletUi.types";
import { formatMoney, getErrorMessage, getWalletUserName } from "../../utils/walletFormatters";
import { DateField, FilterSelect, PaginationFooter } from "./WalletControls";
import { WalletAdjustmentDialog } from "./WalletAdjustmentDialog";
import { WalletDetailCard } from "./WalletDetailCard";
import { WalletRow } from "./WalletTableRows";

export function WalletListPanel({
  areUsersLoading,
  onOpenTransactions,
  userOptions,
  usersById,
  usersError,
}: {
  areUsersLoading: boolean;
  onOpenTransactions: (wallet?: WalletAccountSummary) => void;
  userOptions: ReadonlyArray<readonly [string, string]>;
  usersById: Map<string, AdminUser>;
  usersError: string | null;
}) {
  const [userId, setUserId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [pageSize, setPageSize] = useState(pageSizeOptions[0]);
  const [currentPage, setCurrentPage] = useState(1);
  const [detailWallet, setDetailWallet] = useState<WalletAccountSummary | null>(
    null,
  );
  const [adjustmentWallet, setAdjustmentWallet] =
    useState<WalletAccountSummary | null>(null);
  const [toast, setToast] = useState<ResultToast | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const filters = useMemo<AdminWalletFilters>(
    () => ({
      limit: pageSize,
      offset: (currentPage - 1) * pageSize,
      sort_by: "created_at",
      sort_direction: "desc",
      ...(userId ? { user_id: userId } : {}),
      ...(fromDate ? { from_date: fromDate } : {}),
      ...(toDate ? { to_date: toDate } : {}),
    }),
    [currentPage, fromDate, pageSize, toDate, userId],
  );
  const { error, isLoading, loadWallets, total, wallets } =
    useAdminWallets(filters);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safeCurrentPage = Math.min(currentPage, pageCount);
  const visibleStart = total === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const visibleEnd = Math.min(
    (safeCurrentPage - 1) * pageSize + wallets.length,
    total,
  );
  const resetToFirstPage = () => setCurrentPage(1);

  const loadWalletByAccountId = async (walletAccountId: string) => {
    setIsDetailLoading(true);
    setDetailError(null);

    try {
      setDetailWallet(
        await adminWalletsClient.getByWalletAccountId(walletAccountId),
      );
    } catch (requestError: unknown) {
      setDetailError(getErrorMessage(requestError));
    } finally {
      setIsDetailLoading(false);
    }
  };

  const loadWalletBySelectedUser = async () => {
    if (!userId) {
      setDetailError("Select a user first.");
      return;
    }

    setIsDetailLoading(true);
    setDetailError(null);

    try {
      setDetailWallet(await adminWalletsClient.getByUserId(userId));
    } catch (requestError: unknown) {
      setDetailError(getErrorMessage(requestError));
    } finally {
      setIsDetailLoading(false);
    }
  };

  return (
    <section
      aria-label="Admin wallet accounts"
      className="overflow-hidden rounded-md bg-card-bg-primary shadow-sm"
    >
      <header className="flex flex-col gap-4 border-b border-background-secondary bg-card-bg-secondary px-5 py-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-2xl font-medium text-txt-primary">
            Wallet Accounts
          </h2>
          <p className="mt-1 text-sm text-txt-secondary">
            Review customer wallet balances and ledger activity.
          </p>
        </div>
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-sm bg-button-primary px-4 text-sm font-semibold text-txt-primary transition hover:opacity-85"
          onClick={() => onOpenTransactions()}
          type="button"
        >
          <ReceiptText aria-hidden="true" size={18} />
          Transaction ledger
        </button>
      </header>

      <div className="grid gap-4 border-b border-background-secondary px-5 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <FilterSelect
              disabled={areUsersLoading || userOptions.length === 0}
              label="User"
              onChange={(value) => {
                setUserId(value);
                setDetailWallet(null);
                resetToFirstPage();
              }}
              options={[
                ["", areUsersLoading ? "Loading users..." : "All users"],
                ...userOptions,
              ]}
              value={userId}
            />
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
            <button
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-sm border border-background-secondary px-4 text-sm font-semibold text-txt-secondary transition hover:bg-background-secondary disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!userId || isDetailLoading}
              onClick={() => void loadWalletBySelectedUser()}
              type="button"
            >
              <Search aria-hidden="true" size={16} />
              Load user wallet
            </button>
          </div>
        </div>

        {usersError ? (
          <p className="text-sm text-error" role="alert">
            {usersError}
          </p>
        ) : null}
      </div>

      {detailWallet || detailError || isDetailLoading ? (
        <WalletDetailCard
          error={detailError}
          isLoading={isDetailLoading}
          onClose={() => {
            setDetailWallet(null);
            setDetailError(null);
          }}
          onOpenTransactions={onOpenTransactions}
          onOpenAdjustment={setAdjustmentWallet}
          usersById={usersById}
          wallet={detailWallet}
        />
      ) : null}

      {isLoading ? (
        <LoadingState className="p-6" label="Loading wallet accounts" />
      ) : error ? (
        <div className="p-6">
          <p className="text-sm text-txt-primary" role="alert">
            {error}
          </p>
          <button
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-button-primary px-4 py-2 text-xs font-bold text-txt-primary"
            onClick={() => void loadWallets().catch(() => undefined)}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={14} />
            Try again
          </button>
        </div>
      ) : (
        <>
          <DataTable
            columns={[
              { key: "name", heading: "Name" },
              { key: "currency", heading: "Currency" },
              { key: "available-balance", heading: "Available Balance" },
              { key: "pending-balance", heading: "Pending Balance" },
              { key: "status", heading: "Status" },
              { key: "wallet-account-id", heading: "Wallet Account ID" },
              { key: "updated", heading: "Updated" },
              {
                className: "w-[270px] text-center",
                key: "action",
                heading: "Action",
              },
            ]}
            emptyMessage="No wallet accounts found."
            isEmpty={wallets.length === 0}
            minWidthClassName="min-w-[1120px]"
          >
            {wallets.map((wallet) => (
              <WalletRow
                key={wallet.id}
                onAdjust={() => setAdjustmentWallet(wallet)}
                onLoadDetail={() => void loadWalletByAccountId(wallet.id)}
                onOpenTransactions={() => onOpenTransactions(wallet)}
                userName={getWalletUserName(wallet.user_id, usersById)}
                wallet={wallet}
              />
            ))}
          </DataTable>

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

      {adjustmentWallet ? (
        <WalletAdjustmentDialog
          onAdjusted={(result) => {
            setAdjustmentWallet(null);
            setDetailWallet(result.wallet);
            setToast({
              message: `New available balance is ${formatMoney(result.wallet.available_balance)}.`,
              title: "Wallet adjusted",
              tone: "success",
            });
            void loadWallets().catch(() => undefined);
          }}
          onClose={() => setAdjustmentWallet(null)}
          userName={getWalletUserName(adjustmentWallet.user_id, usersById)}
          wallet={adjustmentWallet}
        />
      ) : null}

      {toast ? (
        <div className="fixed right-4 top-4 z-[90]">
          <Toast
            onDismiss={() => setToast(null)}
            title={toast.title}
            tone={toast.tone}
          >
            {toast.message}
          </Toast>
        </div>
      ) : null}
    </section>
  );
}
