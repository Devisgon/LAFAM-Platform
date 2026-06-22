"use client";

import { useMemo, useState } from "react";
import { WalletTransactionTable } from "@/components/reuseable_ui_components/wallet_transaction_table";
import { LoadingState } from "@/components/reuseable_ui_components/loading_state";
import { getCachedAuthUser } from "@/lib/auth/auth";
import { useWallet } from "@/hooks/user/useWallet";
import type {
  UserWalletTransactionFilters,
  WalletEntryStatus,
  WalletEntryType,
  WalletSortField,
} from "@/lib/user/wallet";

const fieldClass =
  "min-h-11 w-full rounded-lg border border-background-secondary bg-card-bg-primary px-3 text-sm text-txt-primary outline-none focus:border-primary";

const money = (value: number) =>
  new Intl.NumberFormat("en", {
    currency: "KWD",
    maximumFractionDigits: 3,
    minimumFractionDigits: 3,
    style: "currency",
  }).format(value);

const label = (value: string) =>
  value.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());

export function UserWalletScreen() {
  const [entryType, setEntryType] = useState<WalletEntryType | "">("");
  const [entryStatus, setEntryStatus] = useState<WalletEntryStatus | "">("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortBy, setSortBy] = useState<WalletSortField>("created_at");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const user = useMemo(() => getCachedAuthUser(), []);
  const customerName = user?.full_name ?? user?.email ?? "My account";
  const filters = useMemo<UserWalletTransactionFilters>(
    () => ({
      limit: pageSize,
      offset: (page - 1) * pageSize,
      sort_by: sortBy,
      sort_direction: "desc",
      ...(entryType ? { entry_type: entryType } : {}),
      ...(entryStatus ? { entry_status: entryStatus } : {}),
      ...(fromDate ? { from_date: fromDate } : {}),
      ...(toDate ? { to_date: toDate } : {}),
    }),
    [entryStatus, entryType, fromDate, page, sortBy, toDate],
  );
  const wallet = useWallet(filters);
  const pageCount = Math.max(1, Math.ceil(wallet.total / pageSize));
  const resetPage = () => setPage(1);

  return (
    <div className="grid gap-6 text-txt-primary">
      {wallet.error ? (
        <section className="rounded-xl border border-error/30 bg-error/10 p-4">
          <p className="text-sm text-error" role="alert">{wallet.error}</p>
          <button className="mt-3 min-h-10 rounded-lg border border-error/30 px-4 text-sm font-bold" onClick={() => void wallet.load()} type="button">Try again</button>
        </section>
      ) : null}

      {wallet.isLoading && !wallet.wallet ? (
        <LoadingState className="p-8" label="Loading your wallet" />
      ) : wallet.wallet ? (
        <section className="overflow-hidden rounded-3xl border border-primary/40 bg-[linear-gradient(135deg,var(--card-background-primary),color-mix(in_srgb,var(--primary)_42%,white))] p-6 shadow-sm sm:p-8" aria-labelledby="wallet-balance-title">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-md font-bold uppercase  text-txt-secondary">{customerName}&apos;s wallet</p>
              <h1 className="mt-3 text-4xl font-semibold text-txt-primary" id="wallet-balance-title">{money(wallet.wallet.available_balance)}</h1>
              <p className="mt-2 text-sm text-txt-secondary">Available balance</p>
            </div>
            <dl className="grid min-w-64 grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/55 p-4">
                <dt className="text-xs font-bold uppercase text-txt-secondary">Pending</dt>
                <dd className="mt-1 text-lg font-bold">{money(wallet.wallet.pending_balance)}</dd>
              </div>
              <div className="rounded-2xl bg-white/55 p-4">
                <dt className="text-xs font-bold uppercase text-txt-secondary">Status</dt>
                <dd className="mt-1 text-lg font-bold">{label(wallet.wallet.status)}</dd>
              </div>
            </dl>
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-background-secondary bg-card-bg-primary shadow-sm" aria-labelledby="wallet-transactions-title">
        <header className="border-b border-background-secondary p-5 sm:p-6">
          <h2 className="text-2xl font-bold" id="wallet-transactions-title">Wallet transactions</h2>
          <p className="mt-1 text-sm text-txt-secondary">Review balance changes and open a complete transaction receipt.</p>
        </header>

        <div className="grid gap-3 border-b border-background-secondary p-5 md:grid-cols-2 xl:grid-cols-5">
          <FilterSelect label="Transaction type" onChange={(value) => { setEntryType(value as WalletEntryType | ""); resetPage(); }} options={[
            ["", "All transaction types"],
            ["wallet_top_up", "Wallet top up"],
            ["booking_payment", "Booking payment"],
            ["private_booking_payment", "Private booking payment"],
            ["refund_credit", "Refund credit"],
            ["admin_adjustment_credit", "Adjustment credit"],
            ["admin_adjustment_debit", "Adjustment debit"],
          ]} value={entryType} />
          <FilterSelect label="Status" onChange={(value) => { setEntryStatus(value as WalletEntryStatus | ""); resetPage(); }} options={[["", "All statuses"], ["posted", "Posted"], ["pending", "Pending"], ["reversed", "Reversed"], ["failed", "Failed"]]} value={entryStatus} />
          <DateInput label="From date" onChange={(value) => { setFromDate(value); resetPage(); }} value={fromDate} />
          <DateInput label="To date" onChange={(value) => { setToDate(value); resetPage(); }} value={toDate} />
          <FilterSelect label="Sort transactions" onChange={(value) => { setSortBy(value as WalletSortField); resetPage(); }} options={[["created_at", "Newest first"], ["amount", "Amount"]]} value={sortBy} />
        </div>

        {wallet.isLoading && wallet.wallet ? (
          <LoadingState className="p-6" label="Loading wallet transactions" />
        ) : (
          <WalletTransactionTable
            getTransaction={wallet.getTransaction}
            getUserName={() => customerName}
            getWalletName={() => `${customerName}'s wallet`}
            transactions={wallet.transactions}
          />
        )}

        <footer className="flex items-center justify-between gap-4 px-5 pb-5 text-sm text-txt-secondary">
          <p>{wallet.total} transaction{wallet.total === 1 ? "" : "s"}</p>
          <nav aria-label="Wallet transaction pages" className="flex items-center gap-2">
            <button className="min-h-10 rounded-lg border border-background-secondary px-4 disabled:opacity-50" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button">Previous</button>
            <span>Page {Math.min(page, pageCount)} of {pageCount}</span>
            <button className="min-h-10 rounded-lg border border-background-secondary px-4 disabled:opacity-50" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} type="button">Next</button>
          </nav>
        </footer>
      </section>
    </div>
  );
}

function FilterSelect({ label: selectLabel, onChange, options, value }: { label: string; onChange: (value: string) => void; options: ReadonlyArray<readonly [string, string]>; value: string }) {
  return <label className="grid gap-1.5 text-xs font-bold">{selectLabel}<select className={fieldClass} onChange={(event) => onChange(event.target.value)} value={value}>{options.map(([optionValue, optionLabel]) => <option key={optionValue || "all"} value={optionValue}>{optionLabel}</option>)}</select></label>;
}

function DateInput({ label: inputLabel, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return <label className="grid gap-1.5 text-xs font-bold">{inputLabel}<input className={fieldClass} onChange={(event) => onChange(event.target.value)} type="date" value={value} /></label>;
}
