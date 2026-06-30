"use client";

import { type FormEvent, useState } from "react";
import { ChevronDown } from "lucide-react";

import { adminWalletsClient, type AdminWalletAdjustmentEntryType, type AdminWalletAdjustmentResult, type WalletAccountSummary } from "../../api/adminWalletApi";
import { fieldClass } from "../../constants/walletUi.constants";
import { formatMoney, getErrorMessage } from "../../utils/walletFormatters";

export function WalletAdjustmentDialog({
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
