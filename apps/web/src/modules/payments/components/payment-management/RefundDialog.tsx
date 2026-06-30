"use client";

import { type FormEvent, useState } from "react";

import { adminPaymentsClient, type PaymentDetail, type PaymentSummary } from "../../api/paymentsApi";
import { fieldClass } from "../../constants/paymentUi.constants";
import { formatMoney, getErrorMessage } from "../../utils/paymentFormatters";

export function RefundDialog({
  onClose,
  onRefunded,
  payment,
}: {
  onClose: () => void;
  onRefunded: (payment: PaymentSummary) => void;
  payment: PaymentDetail;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const defaultIdempotencyKey = `refund-${new Date()
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "")}-${payment.id.slice(0, 8)}`;

  const submitRefund = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const refundAmount = String(formData.get("refund_amount") ?? "").trim();
    const idempotencyKey = String(
      formData.get("idempotency_key") ?? "",
    ).trim();
    const source = String(formData.get("source") ?? "").trim();

    setIsSaving(true);
    setError(null);

    try {
      const updatedPayment = await adminPaymentsClient.refund(payment.id, {
        reason: String(formData.get("reason") ?? "").trim(),
        ...(refundAmount ? { refund_amount: Number(refundAmount) } : {}),
        ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
        ...(source ? { metadata: { source } } : {}),
      });
      onRefunded(updatedPayment);
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
        className="w-full max-w-2xl overflow-hidden rounded-md border border-background-secondary bg-card-bg-primary text-txt-primary shadow-xl"
        onSubmit={(event) => void submitRefund(event)}
      >
        <header className="border-b border-background-secondary bg-card-bg-secondary px-5 py-5">
          <p className="text-sm font-semibold text-txt-secondary">
            Admin payment action
          </p>
          <h2 className="mt-1 text-2xl font-medium">Refund payment</h2>
          <p className="mt-2 text-sm text-txt-secondary">
            Total amount {formatMoney(payment.final_amount)}. Leave refund
            amount empty for the backend default refund flow.
          </p>
        </header>

        <div className="grid gap-4 px-5 py-5">
          {error ? (
            <p
              className="rounded-sm border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <label className="grid gap-1.5 text-xs font-bold">
            Audit reason
            <textarea
              className={`${fieldClass} min-h-28 resize-y py-3`}
              maxLength={500}
              minLength={3}
              name="reason"
              placeholder="Customer refund approved by admin."
              required
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-bold">
              Refund amount
              <input
                className={fieldClass}
                max={payment.final_amount}
                min="0.001"
                name="refund_amount"
                placeholder="Optional"
                step="0.001"
                type="number"
              />
            </label>
            <label className="grid gap-1.5 text-xs font-bold">
              Idempotency key
              <input
                className={fieldClass}
                defaultValue={defaultIdempotencyKey}
                maxLength={120}
                minLength={8}
                name="idempotency_key"
              />
            </label>
            <label className="grid gap-1.5 text-xs font-bold md:col-span-2">
              Metadata source
              <input
                className={fieldClass}
                defaultValue="admin_payment_screen"
                maxLength={80}
                name="source"
              />
            </label>
          </div>
        </div>

        <footer className="flex flex-col gap-2 border-t border-background-secondary px-5 py-5 sm:flex-row">
          <button
            className="min-h-11 rounded-sm bg-button-primary px-4 py-3 text-xs font-bold text-txt-primary disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "Saving..." : "Submit refund"}
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
