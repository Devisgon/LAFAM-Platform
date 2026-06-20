"use client";

import { type FormEvent, useMemo, useState } from "react";
import {
  ChevronDown,
  FileSpreadsheet,
  ReceiptText,
  RotateCcw,
  Search,
} from "lucide-react";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import {
  useAdminWallets,
  useAdminWalletTransactions,
} from "@/hooks/useAdminWallets";
import {
  adminWalletsClient,
  type AdminWalletAdjustmentEntryType,
  type AdminWalletAdjustmentResult,
  type AdminWalletFilters,
  type AdminWalletLedgerSortField,
  type AdminWalletTransactionFilters,
  type WalletAccountStatus,
  type WalletAccountSummary,
  type WalletLedgerEntryStatus,
  type WalletLedgerEntrySummary,
} from "@/lib/admin-wallets";
import { type AdminUser, type AdminUserFilters } from "@/lib/admin-users";
import { Badge } from "@/components/reuseable_ui_components/badge";
import { DataTable } from "@/components/reuseable_ui_components/data_table";
import { LoadingState } from "@/components/reuseable_ui_components/loading_state";
import { Toast } from "@/components/reuseable_ui_components/toast";

type WalletView = "wallets" | "transactions";

type ResultToast = {
  message: string;
  title: string;
  tone: "success" | "error";
};

const fieldClass =
  "min-h-12 w-full rounded-sm border border-background-secondary bg-card-bg-primary px-4 text-base text-txt-primary outline-none transition placeholder:text-txt-secondary focus:border-primary";

const pageSizeOptions = [10, 25, 50];

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en", {
    currency: "KWD",
    maximumFractionDigits: 3,
    minimumFractionDigits: 3,
    style: "currency",
  }).format(value);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The wallet request failed.";
}

function getUserDisplayName(user?: AdminUser): string {
  if (!user) return "Unknown user";

  return (
    user.full_name ?? user.email ?? user.phone ?? `User ${user.id.slice(0, 8)}`
  );
}

function getUserOptionLabel(user: AdminUser): string {
  const name = getUserDisplayName(user);

  if (user.email && user.email !== name) return `${name} - ${user.email}`;
  if (user.phone && user.phone !== name) return `${name} - ${user.phone}`;

  return name;
}

function getWalletUserName(
  userId: string,
  usersById: Map<string, AdminUser>,
): string {
  const user = usersById.get(userId);

  return user ? getUserDisplayName(user) : `User ${userId.slice(0, 8)}`;
}

function walletStatusTone(
  status: WalletAccountStatus,
): "neutral" | "info" | "success" | "warning" | "error" {
  if (status === "active") return "success";
  if (status === "frozen") return "warning";
  return "neutral";
}

function transactionStatusTone(
  status: WalletLedgerEntryStatus,
): "neutral" | "info" | "success" | "warning" | "error" {
  if (status === "posted") return "success";
  if (status === "pending") return "warning";
  if (status === "failed") return "error";
  return "info";
}

export function AdminWalletManager() {
  const userFilters = useMemo<AdminUserFilters>(() => ({}), []);
  const {
    users,
    error: usersError,
    isLoading: areUsersLoading,
  } = useAdminUsers(userFilters);
  const usersById = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users],
  );
  const userOptions = useMemo(
    () => users.map((user) => [user.id, getUserOptionLabel(user)] as const),
    [users],
  );
  const [view, setView] = useState<WalletView>("wallets");
  const [transactionUserId, setTransactionUserId] = useState("");
  const [transactionWalletId, setTransactionWalletId] = useState("");

  const openTransactions = (wallet?: WalletAccountSummary) => {
    setTransactionUserId(wallet?.user_id ?? "");
    setTransactionWalletId(wallet?.id ?? "");
    setView("transactions");
  };

  if (view === "transactions") {
    return (
      <WalletTransactionsPanel
        areUsersLoading={areUsersLoading}
        initialUserId={transactionUserId}
        initialWalletId={transactionWalletId}
        onBack={() => setView("wallets")}
        userOptions={userOptions}
        usersById={usersById}
        usersError={usersError}
      />
    );
  }

  return (
    <WalletListPanel
      areUsersLoading={areUsersLoading}
      onOpenTransactions={openTransactions}
      userOptions={userOptions}
      usersById={usersById}
      usersError={usersError}
    />
  );
}

function WalletListPanel({
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
          <button
            aria-label="Export wallet records"
            className="flex size-12 shrink-0 items-center justify-center rounded-md bg-button-secondary text-txt-primary transition hover:opacity-80"
            type="button"
          >
            <FileSpreadsheet aria-hidden="true" size={22} strokeWidth={2.4} />
          </button>

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

function WalletRow({
  onAdjust,
  onLoadDetail,
  onOpenTransactions,
  userName,
  wallet,
}: {
  onAdjust: () => void;
  onLoadDetail: () => void;
  onOpenTransactions: () => void;
  userName: string;
  wallet: WalletAccountSummary;
}) {
  return (
    <tr className="divide-x divide-background-secondary bg-card-bg-primary transition odd:bg-background-secondary/20 hover:bg-card-bg-secondary/40">
      <td className="px-4 py-4 font-medium text-txt-primary">{userName}</td>
      <td className="px-4 py-4 font-semibold text-txt-primary">KWD</td>
      <td className="px-4 py-4 font-semibold text-txt-primary">
        {formatMoney(wallet.available_balance)}
      </td>
      <td className="px-4 py-4 text-txt-primary">
        {formatMoney(wallet.pending_balance)}
      </td>
      <td className="px-4 py-4">
        <Badge tone={walletStatusTone(wallet.status)}>
          {label(wallet.status)}
        </Badge>
      </td>
      <td className="px-4 py-4 font-mono text-xs text-txt-secondary">
        {wallet.id}
      </td>
      <td className="px-4 py-4 text-txt-secondary">
        {formatDateTime(wallet.updated_at)}
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center justify-center gap-2">
          <button
            className="min-h-9 rounded-sm border border-background-secondary px-3 text-xs font-bold text-txt-secondary transition hover:bg-background-secondary"
            onClick={onLoadDetail}
            type="button"
          >
            Details
          </button>
          <button
            className="min-h-9 rounded-sm bg-button-primary px-3 text-xs font-bold text-txt-primary transition hover:opacity-85"
            onClick={onOpenTransactions}
            type="button"
          >
            Transactions
          </button>
          <button
            className="min-h-9 rounded-sm bg-success px-3 text-xs font-bold text-txt-primary transition hover:opacity-85"
            onClick={onAdjust}
            type="button"
          >
            Adjust
          </button>
        </div>
      </td>
    </tr>
  );
}

function WalletDetailCard({
  error,
  isLoading,
  onClose,
  onOpenAdjustment,
  onOpenTransactions,
  usersById,
  wallet,
}: {
  error: string | null;
  isLoading: boolean;
  onClose: () => void;
  onOpenAdjustment: (wallet: WalletAccountSummary) => void;
  onOpenTransactions: (wallet: WalletAccountSummary) => void;
  usersById: Map<string, AdminUser>;
  wallet: WalletAccountSummary | null;
}) {
  return (
    <section className="border-b border-background-secondary bg-card-bg-secondary px-5 py-5 text-txt-primary">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold text-txt-secondary">
            Wallet detail
          </p>
          <h3 className="mt-1 text-xl font-medium">
            {wallet
              ? getWalletUserName(wallet.user_id, usersById)
              : "Selected wallet"}
          </h3>
        </div>
        <button
          className="min-h-10 rounded-sm border border-background-secondary px-4 text-xs font-bold text-txt-secondary transition hover:bg-background-secondary"
          onClick={onClose}
          type="button"
        >
          Close
        </button>
      </div>

      {isLoading ? (
        <LoadingState className="mt-4 p-4" label="Loading wallet detail" />
      ) : error ? (
        <p
          className="mt-4 rounded-sm border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
          role="alert"
        >
          {error}
        </p>
      ) : wallet ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <DetailItem
            label="Name"
            value={getWalletUserName(wallet.user_id, usersById)}
          />
          <DetailItem label="Currency" value="KWD" />
          <DetailItem
            label="Available"
            value={formatMoney(wallet.available_balance)}
          />
          <DetailItem
            label="Pending"
            value={formatMoney(wallet.pending_balance)}
          />
          <DetailItem label="Status" value={label(wallet.status)} />
          <button
            className="min-h-16 rounded-sm bg-button-primary px-4 text-sm font-semibold text-txt-primary transition hover:opacity-85"
            onClick={() => onOpenTransactions(wallet)}
            type="button"
          >
            View transactions
          </button>
          <button
            className="min-h-16 rounded-sm bg-success px-4 text-sm font-semibold text-txt-primary transition hover:opacity-85"
            onClick={() => onOpenAdjustment(wallet)}
            type="button"
          >
            Adjust balance
          </button>
        </div>
      ) : null}
    </section>
  );
}

function WalletAdjustmentDialog({
  onAdjusted,
  onClose,
  userName,
  wallet,
}: {
  onAdjusted: (result: AdminWalletAdjustmentResult) => void;
  onClose: () => void;
  userName: string;
  wallet: WalletAccountSummary;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitAdjustment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const source = String(formData.get("source") ?? "").trim();
    const idempotencyKey = String(formData.get("idempotency_key") ?? "").trim();

    setIsSaving(true);
    setError(null);

    try {
      const result = await adminWalletsClient.adjustByUserId(wallet.user_id, {
        amount: Number(formData.get("amount")),
        entry_type: String(
          formData.get("entry_type"),
        ) as AdminWalletAdjustmentEntryType,
        reason: String(formData.get("reason") ?? "").trim(),
        ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
        ...(source ? { metadata: { source } } : {}),
      });
      onAdjusted(result);
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4"
      role="dialog"
    >
      <form
        className="w-full max-w-3xl overflow-hidden rounded-md border border-background-secondary bg-card-bg-primary text-txt-primary shadow-xl"
        onSubmit={(event) => void submitAdjustment(event)}
      >
        <header className="border-b border-background-secondary bg-card-bg-secondary px-5 py-5">
          <p className="text-sm font-semibold text-txt-secondary">
            Admin wallet action
          </p>
          <h2 className="mt-1 text-2xl font-medium">Adjust wallet balance</h2>
          <p className="mt-2 text-sm text-txt-secondary">
            {userName} currently has {formatMoney(wallet.available_balance)}{" "}
            available and {formatMoney(wallet.pending_balance)} pending.
          </p>
        </header>

        <div className="grid gap-5 px-5 py-5">
          {error ? (
            <p
              className="rounded-sm border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-bold">
              Entry type
              <span className="relative">
                <select
                  className={`${fieldClass} appearance-none pr-10`}
                  defaultValue="admin_adjustment_credit"
                  name="entry_type"
                  required
                >
                  <option value="admin_adjustment_credit">
                    Admin adjustment credit
                  </option>
                  <option value="admin_adjustment_debit">
                    Admin adjustment debit
                  </option>
                </select>
                <ChevronDown
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-txt-secondary"
                  size={16}
                />
              </span>
            </label>
            <label className="grid gap-1.5 text-xs font-bold">
              Amount
              <input
                className={fieldClass}
                min="0.001"
                name="amount"
                placeholder="10.000"
                required
                step="0.001"
                type="number"
              />
            </label>
            <label className="grid gap-1.5 text-xs font-bold md:col-span-2">
              Audit reason
              <textarea
                className={`${fieldClass} min-h-28 resize-y py-3`}
                maxLength={500}
                minLength={3}
                name="reason"
                placeholder="Manual correction after admin audit."
                required
              />
            </label>
          </div>
        </div>

        <footer className="flex flex-col gap-2 border-t border-background-secondary px-5 py-5 sm:flex-row">
          <button
            className="min-h-11 rounded-sm bg-success px-4 py-3 text-xs font-bold text-txt-primary disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "Saving..." : "Submit adjustment"}
          </button>
          <button
            className="min-h-11 rounded-sm border border-background-secondary px-4 py-3 text-xs font-bold text-txt-secondary transition hover:bg-background-secondary disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
        </footer>
      </form>
    </section>
  );
}

function WalletTransactionsPanel({
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
          <DataTable
            columns={[
              { key: "name", heading: "Name" },
              { key: "currency", heading: "Currency" },
              { key: "amount", heading: "Amount" },
              { key: "balance-before", heading: "Balance Before" },
              { key: "balance-after", heading: "Balance After" },
              { key: "entry-type", heading: "Entry Type" },
              { key: "status", heading: "Status" },
              { key: "wallet-account-id", heading: "Wallet Account ID" },
              { key: "payment-id", heading: "Payment ID" },
              { key: "booking-id", heading: "Booking ID" },
              { key: "description", heading: "Description" },
              { key: "created", heading: "Created" },
            ]}
            emptyMessage="No wallet transactions found."
            isEmpty={transactions.length === 0}
            minWidthClassName="min-w-[1260px]"
          >
            {transactions.map((transaction) => (
              <WalletTransactionRow
                key={transaction.id}
                transaction={transaction}
                userName={getWalletUserName(transaction.user_id, usersById)}
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
    </section>
  );
}

function WalletTransactionRow({
  transaction,
  userName,
}: {
  transaction: WalletLedgerEntrySummary;
  userName: string;
}) {
  const bookingId =
    transaction.booking_id ?? transaction.private_booking_id ?? "None";

  return (
    <tr className="divide-x divide-background-secondary bg-card-bg-primary transition odd:bg-background-secondary/20 hover:bg-card-bg-secondary/40">
      <td className="px-4 py-4 font-medium text-txt-primary">{userName}</td>
      <td className="px-4 py-4 font-semibold text-txt-primary">KWD</td>
      <td className="px-4 py-4 font-semibold text-txt-primary">
        {formatMoney(transaction.amount)}
      </td>
      <td className="px-4 py-4 text-txt-primary">
        {formatMoney(transaction.balance_before)}
      </td>
      <td className="px-4 py-4 text-txt-primary">
        {formatMoney(transaction.balance_after)}
      </td>
      <td className="px-4 py-4 text-txt-primary">
        {label(transaction.entry_type)}
      </td>
      <td className="px-4 py-4">
        <Badge tone={transactionStatusTone(transaction.entry_status)}>
          {label(transaction.entry_status)}
        </Badge>
      </td>
      <td className="px-4 py-4 font-mono text-xs text-txt-secondary">
        {transaction.wallet_account_id}
      </td>
      <td className="px-4 py-4 font-mono text-xs text-txt-secondary">
        {transaction.payment_id ?? "None"}
      </td>
      <td className="px-4 py-4 font-mono text-xs text-txt-secondary">
        {bookingId}
      </td>
      <td className="max-w-[260px] px-4 py-4 text-txt-secondary">
        {transaction.description ?? "No description"}
      </td>
      <td className="px-4 py-4 text-txt-secondary">
        {formatDateTime(transaction.created_at)}
      </td>
    </tr>
  );
}

function PaginationFooter({
  currentPage,
  onPageChange,
  onPageSizeChange,
  pageCount,
  pageSize,
  total,
  visibleEnd,
  visibleStart,
}: {
  currentPage: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageCount: number;
  pageSize: number;
  total: number;
  visibleEnd: number;
  visibleStart: number;
}) {
  return (
    <footer className="flex flex-col gap-4 px-5 pb-5 text-base text-txt-secondary md:flex-row md:items-center md:justify-between">
      <label className="flex items-center gap-4">
        <span className="relative inline-flex">
          <select
            aria-label="Records per page"
            className="min-h-12 appearance-none rounded-sm border border-background-secondary bg-card-bg-primary px-4 pr-10 text-txt-primary outline-none focus:border-primary"
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            value={pageSize}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-txt-secondary"
            size={16}
          />
        </span>
        records per page
      </label>

      <p>
        Showing {visibleStart} to {visibleEnd} of {total} entries
      </p>

      <nav aria-label="Wallet pagination" className="flex items-center">
        <button
          className="min-h-11 rounded-l-sm border border-background-secondary px-4 text-txt-secondary disabled:cursor-not-allowed disabled:opacity-50"
          disabled={currentPage === 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          type="button"
        >
          Previous
        </button>
        <span className="flex min-h-11 min-w-11 items-center justify-center bg-button-primary px-4 font-medium text-txt-primary">
          {currentPage}
        </span>
        <button
          className="min-h-11 rounded-r-sm border border-background-secondary px-4 text-txt-secondary disabled:cursor-not-allowed disabled:opacity-50"
          disabled={currentPage >= pageCount}
          onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}
          type="button"
        >
          Next
        </button>
      </nav>
    </footer>
  );
}

function FilterSelect({
  disabled = false,
  label: filterLabel,
  onChange,
  options,
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<readonly [string, string]>;
  value: string;
}) {
  return (
    <label className="relative">
      <span className="sr-only">{filterLabel}</span>
      <select
        aria-label={filterLabel}
        className={`${fieldClass} appearance-none pr-10 disabled:cursor-not-allowed disabled:opacity-60`}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue || "all"} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-txt-secondary"
        size={16}
      />
    </label>
  );
}

function DateField({
  label: dateLabel,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label>
      <span className="sr-only">{dateLabel}</span>
      <input
        aria-label={dateLabel}
        className={fieldClass}
        onChange={(event) => onChange(event.target.value)}
        type="date"
        value={value}
      />
    </label>
  );
}

function DetailItem({
  label: itemLabel,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-sm border border-background-secondary bg-card-bg-primary p-3">
      <dt className="text-xs font-bold uppercase text-txt-secondary">
        {itemLabel}
      </dt>
      <dd className="mt-1 break-words text-sm font-semibold">{value}</dd>
    </div>
  );
}
