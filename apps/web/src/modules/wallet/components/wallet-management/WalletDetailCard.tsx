"use client";

import { LoadingState } from "@/components/data-display/LoadingState";
import type { AdminUser } from "@/modules/users";

import type { WalletAccountSummary } from "../../api/adminWalletApi";
import { formatMoney, getWalletUserName, label } from "../../utils/walletFormatters";
import { DetailItem } from "./WalletControls";

export function WalletDetailCard({
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
