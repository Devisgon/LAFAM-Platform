"use client";

import { useState } from "react";
import { Badge } from "@/components/reuseable_ui_components/badge";
import { DataTable } from "@/components/reuseable_ui_components/data_table";

export type WalletTransactionItem = {
  id: string;
  wallet_account_id: string;
  user_id: string;
  payment_id: string | null;
  booking_id: string | null;
  private_booking_id: string | null;
  entry_type: string;
  entry_status: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

const label = (value: string) =>
  value.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());

function money(value: number): string {
  return new Intl.NumberFormat("en", {
    currency: "KWD",
    maximumFractionDigits: 3,
    minimumFractionDigits: 3,
    style: "currency",
  }).format(value);
}

function dateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function tone(status: string): "success" | "warning" | "error" | "info" {
  if (status === "posted") return "success";
  if (status === "pending") return "warning";
  if (status === "failed") return "error";
  return "info";
}

export function WalletTransactionTable({
  emptyMessage = "No wallet transactions found.",
  getTransaction,
  getUserName,
  getWalletName,
  transactions,
}: {
  emptyMessage?: string;
  getTransaction?: (id: string) => Promise<WalletTransactionItem>;
  getUserName: (transaction: WalletTransactionItem) => string;
  getWalletName?: (transaction: WalletTransactionItem) => string;
  transactions: WalletTransactionItem[];
}) {
  const [selected, setSelected] = useState<WalletTransactionItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openReceipt = async (transaction: WalletTransactionItem) => {
    setError(null);
    setSelected(transaction);
    if (!getTransaction) return;

    setIsLoading(true);
    try {
      setSelected(await getTransaction(transaction.id));
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The transaction detail could not be loaded.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <DataTable
        columns={[
          { key: "customer", heading: "Customer" },
          { key: "type", heading: "Transaction" },
          { key: "amount", heading: "Amount" },
          { key: "balance", heading: "Balance after" },
          { key: "status", heading: "Status" },
          { key: "created", heading: "Created" },
          { key: "action", heading: "Action" },
        ]}
        emptyMessage={emptyMessage}
        isEmpty={transactions.length === 0}
        minWidthClassName="min-w-[860px]"
      >
        {transactions.map((transaction) => (
          <tr className="divide-x divide-background-secondary bg-card-bg-primary transition odd:bg-background-secondary/20 hover:bg-card-bg-secondary/40" key={transaction.id}>
            <td className="px-4 py-4 font-semibold text-txt-primary">{getUserName(transaction)}</td>
            <td className="px-4 py-4 text-txt-primary">{label(transaction.entry_type)}</td>
            <td className="px-4 py-4 font-bold text-txt-primary">{money(transaction.amount)}</td>
            <td className="px-4 py-4 text-txt-primary">{money(transaction.balance_after)}</td>
            <td className="px-4 py-4"><Badge tone={tone(transaction.entry_status)}>{label(transaction.entry_status)}</Badge></td>
            <td className="px-4 py-4 text-txt-secondary">{dateTime(transaction.created_at)}</td>
            <td className="px-4 py-4">
              <button className="min-h-9 rounded-lg bg-button-primary px-4 text-xs font-bold text-txt-primary" onClick={() => void openReceipt(transaction)} type="button">
                View
              </button>
            </td>
          </tr>
        ))}
      </DataTable>

      {selected ? (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/55 p-4" role="presentation">
          <section aria-labelledby="transaction-receipt-title" aria-modal="true" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-card-bg-primary shadow-2xl" role="dialog">
            <header className="flex items-start justify-between gap-4 border-b border-background-secondary p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-txt-secondary">Transaction receipt</p>
                <h2 className="mt-1 text-2xl font-bold text-txt-primary" id="transaction-receipt-title">{label(selected.entry_type)}</h2>
              </div>
              <button aria-label="Close transaction receipt" className="flex size-9 items-center justify-center rounded-lg bg-background-secondary font-bold text-txt-primary" onClick={() => setSelected(null)} type="button">×</button>
            </header>

            <div className="p-5">
              {isLoading ? <p className="text-sm text-txt-secondary">Loading complete transaction…</p> : null}
              {error ? <p className="rounded-lg bg-error/10 p-3 text-sm text-error" role="alert">{error}</p> : null}
              <div className="mt-2 rounded-2xl bg-primary/10 p-5 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-txt-secondary">Amount</p>
                <p className="mt-2 text-3xl font-bold text-txt-primary">{money(selected.amount)}</p>
                <div className="mt-3"><Badge tone={tone(selected.entry_status)}>{label(selected.entry_status)}</Badge></div>
              </div>
              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                <ReceiptItem label="Customer" value={getUserName(selected)} />
                <ReceiptItem label="Wallet" value={getWalletName?.(selected) ?? "Customer wallet"} />
                <ReceiptItem label="Balance before" value={money(selected.balance_before)} />
                <ReceiptItem label="Balance after" value={money(selected.balance_after)} />
                <ReceiptItem label="Created" value={dateTime(selected.created_at)} />
                <ReceiptItem label="Description" value={selected.description ?? "No description"} />
                <ReceiptItem label="Transaction reference" value={selected.id} />
                {selected.payment_id ? <ReceiptItem label="Payment reference" value={selected.payment_id} /> : null}
                {selected.booking_id || selected.private_booking_id ? <ReceiptItem label="Booking reference" value={selected.booking_id ?? selected.private_booking_id ?? ""} /> : null}
              </dl>
              {Object.keys(selected.metadata).length > 0 ? (
                <div className="mt-3 rounded-xl border border-background-secondary p-4">
                  <p className="text-xs font-bold uppercase text-txt-secondary">Additional information</p>
                  <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-txt-primary">{JSON.stringify(selected.metadata, null, 2)}</pre>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function ReceiptItem({ label: term, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-background-secondary p-4">
      <dt className="text-xs font-bold uppercase text-txt-secondary">{term}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-txt-primary">{value}</dd>
    </div>
  );
}
