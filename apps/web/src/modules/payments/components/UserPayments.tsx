"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { DataTable } from "@/components/data-display/DataTable";
import { LoadingState } from "@/components/data-display/LoadingState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useCustomerPayments } from "../hooks/useCustomerPayments";
import type {
  CustomerPaymentFilters,
  PaymentStatus,
  PaymentSummary,
} from "../api/paymentsApi";

const PAYMENT_COLUMNS = [
  { heading: "Payment", key: "payment" },
  { heading: "Target", key: "target" },
  { heading: "Method", key: "method" },
  { heading: "Status", key: "status" },
  { heading: "Amount", key: "amount" },
  { heading: "Receipt", key: "receipt" },
  { heading: "Created", key: "created" },
  { heading: "Action", key: "action" },
];

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function statusTone(status: PaymentStatus): "success" | "warning" | "error" | "neutral" {
  if (status === "paid") return "success";
  if (status === "failed" || status === "cancelled" || status === "expired") return "error";
  if (status === "refunded") return "neutral";
  return "warning";
}

function formatAmount(payment: PaymentSummary): string {
  return `${payment.final_amount.toFixed(3)} ${payment.currency}`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function UserPayments({ filters }: { filters: CustomerPaymentFilters }) {
  const payments = useCustomerPayments(filters);

  return (
    <div className="grid gap-6 text-txt-primary">
      <section className="rounded-2xl border border-background-secondary bg-card-bg-primary p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold">My payments</h1>
        <p className="mt-2 text-sm leading-6 text-txt-secondary">
          Review your payment history and open receipts for completed payments.
        </p>
        <form
          action="/payments"
          className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(150px,1fr)_minmax(150px,1fr)_minmax(170px,1fr)_minmax(170px,1fr)_minmax(150px,1fr)_auto]"
          method="get"
        >
          <label className="grid gap-1.5 text-xs font-bold">
            Target
            <select
              className="min-h-11 rounded-lg border border-background-secondary bg-card-bg-secondary px-3 text-sm text-txt-primary outline-none focus:border-primary"
              defaultValue={filters.target_type ?? ""}
              name="target_type"
            >
              <option value="">All targets</option>
              <option value="booking">Booking</option>
              <option value="private_booking">Private booking</option>
              <option value="wallet_top_up">Wallet top-up</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-bold">
            Status
            <select
              className="min-h-11 rounded-lg border border-background-secondary bg-card-bg-secondary px-3 text-sm text-txt-primary outline-none focus:border-primary"
              defaultValue={filters.status ?? ""}
              name="status"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="requires_redirect">Requires redirect</option>
              <option value="processing">Processing</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
              <option value="expired">Expired</option>
              <option value="refund_requested">Refund requested</option>
              <option value="refund_processing">Refund processing</option>
              <option value="manual_refund_required">Manual refund required</option>
              <option value="refunded">Refunded</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-bold">
            From
            <input
              className="min-h-11 rounded-lg border border-background-secondary bg-card-bg-secondary px-3 text-sm text-txt-primary outline-none focus:border-primary"
              defaultValue={filters.from_date}
              name="from_date"
              type="datetime-local"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-bold">
            To
            <input
              className="min-h-11 rounded-lg border border-background-secondary bg-card-bg-secondary px-3 text-sm text-txt-primary outline-none focus:border-primary"
              defaultValue={filters.to_date}
              name="to_date"
              type="datetime-local"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-bold">
            Sort
            <select
              className="min-h-11 rounded-lg border border-background-secondary bg-card-bg-secondary px-3 text-sm text-txt-primary outline-none focus:border-primary"
              defaultValue={filters.sort_by}
              name="sort_by"
            >
              <option value="created_at">Created</option>
              <option value="updated_at">Updated</option>
              <option value="final_amount">Final amount</option>
              <option value="paid_at">Paid at</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <input name="sort_direction" type="hidden" value={filters.sort_direction} />
            <Button type="submit">Apply</Button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-background-secondary bg-card-bg-primary shadow-sm">
        {payments.error ? (
          <div className="p-5">
            <p className="text-sm text-error" role="alert">
              {payments.error}
            </p>
            <Button className="mt-3" onClick={() => void payments.load()} variant="outline">
              Try again
            </Button>
          </div>
        ) : payments.isLoading ? (
          <LoadingState className="p-8" label="Loading payments" />
        ) : (
          <DataTable
            columns={PAYMENT_COLUMNS}
            emptyMessage="You do not have any payments yet."
            isEmpty={payments.payments.length === 0}
            minWidthClassName="min-w-[1060px]"
          >
            {payments.payments.map((payment) => (
              <tr className="divide-x divide-background-secondary" key={payment.id}>
                <td className="px-4 py-3 text-sm font-semibold">
                  {payment.payment_number}
                </td>
                <td className="px-4 py-3 text-sm">{label(payment.target_type)}</td>
                <td className="px-4 py-3 text-sm">{label(payment.payment_method)}</td>
                <td className="px-4 py-3 text-sm">
                  <Badge tone={statusTone(payment.status)}>{label(payment.status)}</Badge>
                </td>
                <td className="px-4 py-3 text-sm font-semibold">
                  {formatAmount(payment)}
                </td>
                <td className="px-4 py-3 text-sm">
                  {payment.receipt_number ?? "Not issued"}
                </td>
                <td className="px-4 py-3 text-sm text-txt-secondary">
                  {formatDateTime(payment.created_at)}
                </td>
                <td className="px-4 py-3">
                  <Link
                    aria-label={`View payment ${payment.payment_number}`}
                    className="inline-flex min-h-8 items-center justify-center rounded-lg border border-background-secondary px-3 py-1 text-sm font-semibold text-txt-primary transition hover:bg-background-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    href={`/payments/${encodeURIComponent(payment.id)}`}
                    title="View payment"
                  >
                    <Eye size={16} aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>
    </div>
  );
}
