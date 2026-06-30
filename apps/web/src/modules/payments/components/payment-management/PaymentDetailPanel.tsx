"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/data-display/LoadingState";
import { Toast } from "@/components/ui/Toast";
import type { AdminUser } from "@/modules/users";

import { adminPaymentsClient, type PaymentDetail } from "../../api/paymentsApi";
import type { ResultToast } from "../../types/paymentUi.types";
import { formatDateTime, formatMoney, getErrorMessage, getPaymentUserName, label, statusTone } from "../../utils/paymentFormatters";
import { BillingLine, DetailItem, RetryState } from "./PaymentControls";
import { PaymentTransactionsSection } from "./PaymentTransactionsSection";
import { RefundDialog } from "./RefundDialog";

export function PaymentDetailPanel({
  onBack,
  onChanged,
  paymentId,
  usersById,
}: {
  onBack: () => void;
  onChanged: () => void;
  paymentId: string;
  usersById: Map<string, AdminUser>;
}) {
  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refundOpen, setRefundOpen] = useState(false);
  const [toast, setToast] = useState<ResultToast | null>(null);

  const loadPayment = async () => {
    setIsLoading(true);
    setError(null);

    try {
      setPayment(await adminPaymentsClient.get(paymentId));
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const request = window.setTimeout(() => {
      void loadPayment();
    }, 0);

    return () => window.clearTimeout(request);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId]);

  if (isLoading) {
    return (
      <section className="overflow-hidden rounded-md bg-card-bg-primary shadow-sm">
        <LoadingState className="p-6" label="Loading payment detail" />
      </section>
    );
  }

  if (!payment) {
    return (
      <section className="overflow-hidden rounded-md bg-card-bg-primary shadow-sm">
        <RetryState
          error={error ?? "Payment detail could not be loaded."}
          onRetry={() => void loadPayment()}
        />
        <div className="px-6 pb-6">
          <button
            className="min-h-11 rounded-sm border border-background-secondary px-5 text-sm font-semibold text-txt-secondary"
            onClick={onBack}
            type="button"
          >
            Back to payments
          </button>
        </div>
      </section>
    );
  }

  const userName = getPaymentUserName(payment.user_id, usersById);

  return (
    <section className="overflow-hidden rounded-md bg-card-bg-primary text-txt-primary shadow-sm">
      <header className="flex flex-col gap-4 border-b border-background-secondary bg-card-bg-secondary px-5 py-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-semibold text-txt-secondary">
            Billing detail
          </p>
          <h2 className="mt-1 text-2xl font-medium">{payment.payment_number}</h2>
          <p className="mt-1 text-sm text-txt-secondary">
            {userName} - {payment.receipt_number ?? "No receipt yet"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone={statusTone(payment.status)}>{label(payment.status)}</Badge>
            <Badge tone="neutral">{label(payment.target_type)}</Badge>
            <Badge tone="neutral">{label(payment.payment_method)}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="min-h-11 rounded-sm border border-background-secondary px-5 text-sm font-semibold text-txt-secondary transition hover:bg-background-secondary"
            onClick={onBack}
            type="button"
          >
            Back to payments
          </button>
          <button
            className="min-h-11 rounded-sm bg-button-primary px-5 text-sm font-semibold text-txt-primary transition hover:opacity-85"
            onClick={() => setRefundOpen(true)}
            type="button"
          >
            Refund
          </button>
        </div>
      </header>

      {error ? (
        <p
          className="mx-5 mt-5 rounded-sm border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="grid items-start gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="grid gap-5">
          <section className="rounded-md border border-background-secondary">
            <header className="border-b border-background-secondary px-4 py-3">
              <h3 className="font-semibold">Payment information</h3>
            </header>
            <dl className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
              <DetailItem label="Name" value={userName} />
              <DetailItem label="Transaction ID" value={payment.gateway_reference ?? "None"} />
              <DetailItem label="Payment method" value={label(payment.payment_method)} />
              <DetailItem label="Payment provider" value={label(payment.payment_provider)} />
              <DetailItem label="Status" value={label(payment.status)} />
              <DetailItem label="Booking reference" value={payment.booking_id ?? payment.private_booking_id ?? "None"} />
              <DetailItem label="Created" value={formatDateTime(payment.created_at)} />
            </dl>
          </section>

          <section className="rounded-md border border-background-secondary">
            <header className="border-b border-background-secondary px-4 py-3">
              <h3 className="font-semibold">Timeline and refund data</h3>
            </header>
            <dl className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
              <DetailItem label="Paid time" value={formatDateTime(payment.paid_at)} />
              <DetailItem label="Expired time" value={formatDateTime(payment.expired_at)} />
              <DetailItem label="Expires at" value={formatDateTime(payment.expires_at)} />
              <DetailItem label="Failed time" value={formatDateTime(payment.failed_at)} />
              <DetailItem label="Cancelled time" value={formatDateTime(payment.cancelled_at)} />
              <DetailItem label="Refunded time" value={formatDateTime(payment.refunded_at)} />
              <DetailItem label="Refund amount" value={formatMoney(payment.refunded_amount)} />
              <DetailItem label="Failure" value={payment.failure_message ?? payment.failure_code ?? "None"} />
            </dl>
          </section>
        </section>

        <aside className="h-fit rounded-md border border-background-secondary bg-card-bg-secondary">
          <header className="border-b border-background-secondary px-4 py-4">
            <h3 className="text-xl font-semibold">Billing summary</h3>
          </header>
          <dl className="grid gap-3 p-4">
            <BillingLine label="Amount" value={formatMoney(payment.amount)} />
            <BillingLine
              label="Discount"
              value={`-${formatMoney(payment.discount_amount)}`}
            />
            <BillingLine
              emphasized
              label="Total amount"
              value={formatMoney(payment.final_amount)}
            />
            <BillingLine
              label="Currency"
              value={payment.currency}
            />
          </dl>
          <section className="border-t border-background-secondary p-4">
            <h4 className="text-sm font-bold">Discounts</h4>
            <div className="mt-3 grid gap-3">
              {payment.discounts && payment.discounts.length > 0 ? (
                payment.discounts.map((discount) => (
                  <div
                    className="rounded-sm bg-card-bg-primary p-3 text-sm"
                    key={discount.id}
                  >
                    <p className="font-semibold">{discount.code}</p>
                    <p className="text-txt-secondary">
                      {formatMoney(discount.discount_amount)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-txt-secondary">No discounts.</p>
              )}
            </div>
          </section>
        </aside>
      </div>

      <div className="mx-5 mb-5">
        <PaymentTransactionsSection paymentId={payment.id} />
      </div>

      {refundOpen ? (
        <RefundDialog
          onClose={() => setRefundOpen(false)}
          onRefunded={(updatedPayment) => {
            setRefundOpen(false);
            setPayment((current) =>
              current ? { ...current, ...updatedPayment } : current,
            );
            setToast({
              message: `${updatedPayment.payment_number} refund status is ${label(updatedPayment.status)}.`,
              title: "Refund processed",
              tone: "success",
            });
            onChanged();
            void loadPayment();
          }}
          payment={payment}
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
