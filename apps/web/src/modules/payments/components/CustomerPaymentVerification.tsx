"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, CreditCard, XCircle } from "lucide-react";
import { LoadingState } from "@/components/data-display/LoadingState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getSafeErrorMessage } from "@/lib/error/handleError";
import { useCustomerVerifyPayment } from "../hooks/useCustomerPayments";
import type {
  CustomerPaymentReceipt,
  PaymentMethod,
  PaymentStatus,
  PaymentSummary,
} from "../api/paymentsApi";

function formatLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Not provided";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatAmount(amount: number, currency: string): string {
  return `${amount.toFixed(3)} ${currency}`;
}

function statusTone(status: PaymentStatus): "success" | "warning" | "error" | "neutral" {
  if (status === "paid") return "success";
  if (status === "failed" || status === "cancelled" || status === "expired") return "error";
  if (status === "refunded") return "neutral";
  return "warning";
}

function isFailedStatus(status: PaymentStatus): boolean {
  return status === "failed" || status === "cancelled" || status === "expired";
}

function isUsableRedirectUrl(value: string | null | undefined): value is string {
  if (!value?.trim() || value === "string") return false;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function CustomerPaymentVerification({
  bookingId,
  paymentId,
}: {
  bookingId?: string;
  paymentId: string;
}) {
  const { data, error: verifyError, isPending, mutate } = useCustomerVerifyPayment();
  const result = data;
  const payment = result?.payment;
  const error = verifyError ? getSafeErrorMessage(verifyError) : null;

  useEffect(() => {
    mutate(paymentId);
  }, [mutate, paymentId]);

  if (isPending && !payment) {
    return (
      <LoadingState
        className="rounded-2xl border border-background-secondary bg-card-bg-primary p-8"
        label="Verifying payment"
      />
    );
  }

  if (error) {
    return (
      <PaymentStateShell
        icon={<XCircle size={24} aria-hidden="true" />}
        tone="error"
        title="Payment verification failed"
      >
        <p className="text-sm text-txt-secondary">{error}</p>
        <PaymentActions bookingId={bookingId} payment={payment} onRetry={() => mutate(paymentId)} />
      </PaymentStateShell>
    );
  }

  if (!payment) {
    return null;
  }

  if (isFailedStatus(payment.status)) {
    return (
      <PaymentStateShell
        icon={<XCircle size={24} aria-hidden="true" />}
        tone="error"
        title="Payment failed"
      >
        <p className="text-sm text-txt-secondary">
          This payment is {formatLabel(payment.status)}. Please try another checkout or contact support.
        </p>
        <PaymentSummaryBlock payment={payment} />
        <PaymentActions bookingId={bookingId} payment={payment} onRetry={() => mutate(paymentId)} />
      </PaymentStateShell>
    );
  }

  if (payment.status === "paid" && result?.receipt) {
    return (
      <PaymentStateShell
        icon={<CheckCircle2 size={24} aria-hidden="true" />}
        tone="success"
        title="Payment successful"
      >
        <ReceiptBlock payment={payment} receipt={result.receipt} />
        <PaymentActions bookingId={bookingId} payment={payment} onRetry={() => mutate(paymentId)} />
      </PaymentStateShell>
    );
  }

  return (
    <PaymentStateShell
      icon={<Clock size={24} aria-hidden="true" />}
      tone="warning"
      title="Payment pending"
    >
      <p className="text-sm text-txt-secondary">
        Your payment is currently {formatLabel(payment.status)}. Verify again after completing the hosted payment step.
      </p>
      <PaymentSummaryBlock payment={payment} />
      <PaymentActions bookingId={bookingId} payment={payment} onRetry={() => mutate(paymentId)} />
    </PaymentStateShell>
  );
}

function PaymentStateShell({
  children,
  icon,
  title,
  tone,
}: {
  children: ReactNode;
  icon: ReactNode;
  title: string;
  tone: "success" | "warning" | "error";
}) {
  return (
    <section className="rounded-2xl border border-background-secondary bg-card-bg-primary p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-primary">{icon}</span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-txt-secondary">
              Payment verification
            </p>
            <h1 className="mt-1 text-2xl font-bold text-txt-primary">{title}</h1>
          </div>
        </div>
        <Badge tone={tone}>{formatLabel(tone)}</Badge>
      </div>
      <div className="mt-5 grid gap-4">{children}</div>
    </section>
  );
}

function ReceiptBlock({
  payment,
  receipt,
}: {
  payment: PaymentSummary;
  receipt: CustomerPaymentReceipt;
}) {
  return (
    <section className="rounded-xl border border-success/30 bg-success/10 p-4">
      <div className="flex items-center gap-2">
        <CreditCard size={18} aria-hidden="true" />
        <h2 className="text-lg font-bold text-success">Receipt</h2>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ReceiptItem label="Receipt number" value={receipt.receipt_number ?? "Not provided"} />
        <ReceiptItem label="Payment number" value={receipt.payment_number} />
        <ReceiptItem label="Payment method" value={formatLabel(receipt.payment_method as PaymentMethod)} />
        <ReceiptItem label="Provider" value={formatLabel(receipt.payment_provider)} />
        <ReceiptItem label="Paid at" value={formatDateTime(receipt.paid_at ?? payment.paid_at)} />
        <ReceiptItem label="Final amount" value={formatAmount(receipt.final_amount, receipt.currency)} />
      </dl>
    </section>
  );
}

function PaymentSummaryBlock({ payment }: { payment: PaymentSummary }) {
  return (
    <section className="rounded-xl border border-background-secondary bg-card-bg-secondary p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Payment summary</h2>
        <Badge tone={statusTone(payment.status)}>{formatLabel(payment.status)}</Badge>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ReceiptItem label="Payment number" value={payment.payment_number} />
        <ReceiptItem label="Method" value={formatLabel(payment.payment_method)} />
        <ReceiptItem label="Provider" value={formatLabel(payment.payment_provider)} />
        <ReceiptItem label="Final amount" value={formatAmount(payment.final_amount, payment.currency)} />
        <ReceiptItem label="Expires at" value={formatDateTime(payment.expires_at)} />
        <ReceiptItem label="Updated" value={formatDateTime(payment.updated_at)} />
      </dl>
    </section>
  );
}

function PaymentActions({
  bookingId,
  onRetry,
  payment,
}: {
  bookingId?: string;
  onRetry: () => void;
  payment?: PaymentSummary;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={onRetry} variant="outline">
        Verify again
      </Button>
      {payment && isUsableRedirectUrl(payment.redirect_url) ? (
        <a
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-button-primary px-4 py-2 text-sm font-bold text-txt-primary"
          href={payment.redirect_url}
          rel="noreferrer"
          target="_blank"
        >
          Continue payment
        </a>
      ) : null}
      {bookingId ? (
        <Link
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-background-secondary px-4 py-2 text-sm font-bold"
          href={`/bookings/${encodeURIComponent(bookingId)}`}
        >
          View booking
        </Link>
      ) : (
        <Link
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-background-secondary px-4 py-2 text-sm font-bold"
          href="/bookings"
        >
          My bookings
        </Link>
      )}
    </div>
  );
}

function ReceiptItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-card-bg-primary p-3">
      <dt className="text-xs font-bold uppercase tracking-[0.1em] text-txt-secondary">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-semibold text-txt-primary">{value}</dd>
    </div>
  );
}
