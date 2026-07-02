"use client";

import { Badge } from "@/components/ui/Badge";
import type { PromoCode } from "../../api/promoCodesApi";
import {
  formatDateTime,
  formatDiscount,
  formatMoney,
  getMaxUsage,
  getUsageCount,
  label,
  statusTone,
} from "../../utils/promoFormatters";
import {
  PromoActionButton,
  PromoStatusToggle,
} from "./PromoCodeControls";

export function PromoCodeRow({
  isMutating,
  onDelete,
  onEdit,
  onToggleStatus,
  onView,
  promoCode,
}: {
  isMutating: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
  onView: () => void;
  promoCode: PromoCode;
}) {
  const maxUsage = getMaxUsage(promoCode);

  return (
    <tr className="divide-x divide-background-secondary bg-card-bg-primary transition odd:bg-background-secondary/20 hover:bg-card-bg-secondary/40">
      <td className="px-4 py-4 text-center">
        <PromoStatusToggle
          checked={promoCode.status === "active"}
          disabled={isMutating || promoCode.status === "deleted"}
          label={`${promoCode.status === "active" ? "Pause" : "Activate"} ${promoCode.code}`}
          onChange={onToggleStatus}
        />
      </td>
      <td className="px-4 py-4 font-semibold text-txt-primary">
        {promoCode.code}
        {promoCode.description ? (
          <span className="mt-0.5 block text-xs font-normal text-txt-secondary">
            {promoCode.description}
          </span>
        ) : null}
      </td>
      <td className="px-4 py-4 text-txt-primary">
        {formatDiscount(promoCode.discount_type, promoCode.discount_value)}
      </td>
      <td className="px-4 py-4 text-txt-primary">
        {label(promoCode.discount_type)}
      </td>
      <td className="px-4 py-4 text-txt-primary">
        {formatMoney(promoCode.max_discount_amount)}
      </td>
      <td className="px-4 py-4 text-txt-primary">
        {formatDateTime(promoCode.created_at)}
      </td>
      <td className="px-4 py-4 text-center">
        <Badge tone={statusTone(promoCode.status)}>
          {label(promoCode.status)}
        </Badge>
      </td>
      <td className="px-4 py-4 text-txt-primary">
        {formatMoney(promoCode.minimum_order_amount)}
      </td>
      <td className="px-4 py-4 text-txt-primary">
        {getUsageCount(promoCode)}
      </td>
      <td className="px-4 py-4 text-txt-primary">
        {maxUsage ?? "Unlimited"}
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center justify-center gap-2">
          <PromoActionButton
            icon="view"
            label={`View ${promoCode.code}`}
            onClick={onView}
          />
          <PromoActionButton
            icon="edit"
            label={`Update ${promoCode.code}`}
            onClick={onEdit}
            tone="warning"
          />
          <PromoActionButton
            icon="delete"
            label={`Delete ${promoCode.code}`}
            onClick={onDelete}
            tone="error"
          />
        </div>
      </td>
    </tr>
  );
}
