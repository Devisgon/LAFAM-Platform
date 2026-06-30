"use client";

import { Badge } from "@/components/ui/Badge";

import type { PaymentSummary } from "../../api/paymentsApi";
import { formatDateTime, formatMoney, label, statusTone } from "../../utils/paymentFormatters";

export function PaymentRow({
  onView,
  payment,
  userName,
}: {
  onView: () => void;
  payment: PaymentSummary;
  userName: string;
}) {
  return (
    <tr className="divide-x divide-background-secondary bg-card-bg-primary transition odd:bg-background-secondary/20 hover:bg-card-bg-secondary/40">
      <td className="px-4 py-4 font-medium text-txt-primary">{userName}</td>
      <td className="px-4 py-4 font-semibold text-txt-primary">
        {formatMoney(payment.final_amount)}
      </td>
      <td className="px-4 py-4 text-txt-primary">{label(payment.target_type)}</td>
      <td className="px-4 py-4 text-txt-primary">
        {label(payment.payment_method)}
      </td>
      <td className="px-4 py-4">
        <Badge tone={statusTone(payment.status)}>{label(payment.status)}</Badge>
      </td>
      <td className="px-4 py-4 font-mono text-xs text-txt-secondary">
        {payment.payment_number}
      </td>
      <td className="px-4 py-4 text-txt-secondary">
        {formatDateTime(payment.created_at)}
      </td>
      <td className="px-4 py-4 text-center">
        <button
          className="min-h-9 rounded-sm bg-button-primary px-4 text-xs font-bold text-txt-primary transition hover:opacity-85"
          onClick={onView}
          type="button"
        >
          View
        </button>
      </td>
    </tr>
  );
}
