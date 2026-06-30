"use client";

import { Badge } from "@/components/ui/Badge";

import type { WalletAccountSummary } from "../../api/adminWalletApi";
import { formatDateTime, formatMoney, label, walletStatusTone } from "../../utils/walletFormatters";

export function WalletRow({
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
