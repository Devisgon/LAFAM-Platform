"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, CreditCard, Eye, ReceiptText } from "lucide-react";
import { DataTable } from "@/components/data-display/DataTable";
import { LoadingState } from "@/components/data-display/LoadingState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  useCustomerPaymentDetail,
  useCustomerPaymentTransactions,
} from "../hooks/useCustomerPayments";
import type {
  CustomerPaymentDetail,
  CustomerPaymentTransactionFilters,
  PaymentStatus,
  PaymentTransactionStatus,
} from "../api/paymentsApi";

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function statusTone(
  status: PaymentStatus | PaymentTransactionStatus,
): "success" | "warning" | "error" | "neutral" {
  if (status === "paid" || status === "succeeded") return "success";
  if (status === "failed" || status === "cancelled" || status === "expired") return "error";
  if (status === "refunded" || status === "ignored") return "neutral";
  return "warning";
}

function formatAmount(amount: number, currency: string): string {
  return `${amount.toFixed(3)} ${currency}`;
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

function optional(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export function UserPaymentDetailScreen({ paymentId }: { paymentId: string }) {
  const detail = useCustomerPaymentDetail(paymentId);
  const transactionFilters = useMemo<CustomerPaymentTransactionFilters>(
    () => ({
      limit: 20,
      offset: 0,
      sort_by: "created_at",
      sort_direction: "desc",
    }),
    [],
  );
  const transactions = useCustomerPaymentTransactions(paymentId, transactionFilters);
  const payment = detail.payment;

  return (
    <div className="grid gap-6 text-txt-primary">
      <section className="rounded-2xl border border-background-secondary bg-card-bg-primary p-5 shadow-sm sm:p-6">
        <Link
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-background-secondary px-4 py-2 text-sm font-bold"
          href="/payments"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to payments
        </Link>
        <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-txt-secondary">
              Payment detail
            </p>
            <h1 className="mt-2 text-2xl font-bold">
              {payment?.payment_number ?? "Loading payment"}
            </h1>
          </div>
          {payment ? (
            <Badge tone={statusTone(payment.status)}>{label(payment.status)}</Badge>
          ) : null}
        </div>
      </section>

      {detail.error ? (
        <section className="rounded-xl border border-error/30 bg-error/10 p-4">
          <p className="text-sm text-error" role="alert">
            {detail.error}
          </p>
        </section>
      ) : null}

      {detail.isLoading ? (
        <LoadingState className="rounded-2xl border border-background-secondary bg-card-bg-primary p-8" label="Loading payment detail" />
      ) : null}

      {payment ? (
        <>
          <PaymentOverview payment={payment} />
          <PaymentReceipt payment={payment} />
          <PaymentTransactions
            error={transactions.error}
            isLoading={transactions.isLoading}
            onRetry={() => void transactions.load()}
            transactions={transactions.transactions}
          />
        </>
      ) : null}
    </div>
  );
}

function PaymentOverview({ payment }: { payment: CustomerPaymentDetail }) {
  return (
    <section className="rounded-2xl border border-background-secondary bg-card-bg-primary p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-2">
        <CreditCard size={18} aria-hidden="true" className="text-primary" />
        <h2 className="text-xl font-bold">Payment summary</h2>
      </div>
      <dl className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <DetailItem label="Payment number" value={payment.payment_number} />
        <DetailItem label="Target type" value={label(payment.target_type)} />
        <DetailItem label="Booking" value={payment.booking_id ?? payment.private_booking_id ?? "Not linked"} />
        <DetailItem label="Method" value={label(payment.payment_method)} />
        <DetailItem label="Provider" value={label(payment.payment_provider)} />
        <DetailItem label="Status" value={label(payment.status)} />
        <DetailItem label="Amount" value={formatAmount(payment.amount, payment.currency)} />
        <DetailItem label="Discount" value={formatAmount(payment.discount_amount, payment.currency)} />
        <DetailItem label="Final amount" value={formatAmount(payment.final_amount, payment.currency)} />
        <DetailItem label="Created" value={formatDateTime(payment.created_at)} />
        <DetailItem label="Paid" value={formatDateTime(payment.paid_at)} />
        <DetailItem label="Expires" value={formatDateTime(payment.expires_at)} />
      </dl>
    </section>
  );
}

function PaymentReceipt({ payment }: { payment: CustomerPaymentDetail }) {
  const receipt = payment.receipt;
  const receiptNumber = receipt?.receipt_number ?? payment.receipt_number;

  return (
    <section className="rounded-2xl border border-background-secondary bg-card-bg-primary p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-2">
        <ReceiptText size={18} aria-hidden="true" className="text-primary" />
        <h2 className="text-xl font-bold">Receipt</h2>
      </div>
      {receiptNumber || payment.status === "paid" ? (
        <dl className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <DetailItem label="Receipt number" value={receiptNumber ?? "Not provided"} />
          <DetailItem label="Payment number" value={receipt?.payment_number ?? payment.payment_number} />
          <DetailItem label="Payment ID" value={receipt?.payment_id ?? payment.id} />
          <DetailItem label="Method" value={label(receipt?.payment_method ?? payment.payment_method)} />
          <DetailItem label="Provider" value={label(receipt?.payment_provider ?? payment.payment_provider)} />
          <DetailItem
            label="Paid at"
            value={formatDateTime(receipt?.paid_at ?? payment.paid_at)}
          />
          <DetailItem
            label="Final amount"
            value={formatAmount(receipt?.final_amount ?? payment.final_amount, receipt?.currency ?? payment.currency)}
          />
          <DetailItem label="Currency" value={receipt?.currency ?? payment.currency} />
        </dl>
      ) : (
        <p className="mt-3 text-sm text-txt-secondary">
          A receipt is issued after the payment is marked paid.
        </p>
      )}
    </section>
  );
}

function PaymentTransactions({
  error,
  isLoading,
  onRetry,
  transactions,
}: {
  error: string | null;
  isLoading: boolean;
  onRetry: () => void;
  transactions: Array<{
    created_at: string;
    id: string;
    payment_id: string;
    processed_at: string | null;
    provider: string;
    provider_reference: string | null;
    transaction_status: PaymentTransactionStatus;
    transaction_type: string;
  }>;
}) {
  return (
    <section className="rounded-2xl border border-background-secondary bg-card-bg-primary shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Eye size={18} aria-hidden="true" className="text-primary" />
          <h2 className="text-xl font-bold">Transactions</h2>
        </div>
        <Button onClick={onRetry} variant="outline">
          Refresh
        </Button>
      </div>
      {error ? (
        <p className="px-5 pb-5 text-sm text-error" role="alert">
          {error}
        </p>
      ) : isLoading ? (
        <LoadingState className="p-8" label="Loading payment transactions" />
      ) : (
        <DataTable
          columns={[
            { heading: "Type", key: "type" },
            { heading: "Provider", key: "provider" },
            { heading: "Status", key: "status" },
            { heading: "Reference", key: "reference" },
            { heading: "Processed", key: "processed" },
            { heading: "Created", key: "created" },
          ]}
          emptyMessage="No transactions found for this payment."
          isEmpty={transactions.length === 0}
          minWidthClassName="min-w-[920px]"
          wrapperClassName="overflow-x-auto px-5 pb-5"
        >
          {transactions.map((transaction) => (
            <tr className="divide-x divide-background-secondary" key={transaction.id}>
              <td className="px-4 py-3 text-sm">{label(transaction.transaction_type)}</td>
              <td className="px-4 py-3 text-sm">{label(transaction.provider)}</td>
              <td className="px-4 py-3 text-sm">
                <Badge tone={statusTone(transaction.transaction_status)}>
                  {label(transaction.transaction_status)}
                </Badge>
              </td>
              <td className="px-4 py-3 text-sm">
                {optional(transaction.provider_reference)}
              </td>
              <td className="px-4 py-3 text-sm text-txt-secondary">
                {formatDateTime(transaction.processed_at)}
              </td>
              <td className="px-4 py-3 text-sm text-txt-secondary">
                {formatDateTime(transaction.created_at)}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </section>
  );
}

function DetailItem({ label: term, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card-bg-secondary p-4">
      <dt className="text-xs font-bold uppercase tracking-[0.1em] text-txt-secondary">
        {term}
      </dt>
      <dd className="mt-1 break-words text-sm font-semibold text-txt-primary">{value}</dd>
    </div>
  );
}
