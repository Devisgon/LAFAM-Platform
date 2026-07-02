import type {
  PromoCode,
  PromoCodeStatus,
  PromoDiscountType,
} from "../api/promoCodesApi";

export function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

export function statusTone(
  status: PromoCodeStatus,
): "success" | "warning" | "error" | "neutral" {
  if (status === "active") return "success";
  if (status === "inactive" || status === "deleted") return "error";
  return "neutral";
}

export function formatDateTime(value: string | null): string {
  if (!value) return "Not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kuwait",
  }).format(date);
}

export function formatMoney(value: number | null | undefined): string {
  if (value === null || typeof value === "undefined") return "No limit";

  return new Intl.NumberFormat("en", {
    currency: "KWD",
    maximumFractionDigits: 3,
    style: "currency",
  }).format(value);
}

export function formatDiscount(
  discountType: PromoDiscountType,
  discountValue: number,
): string {
  if (discountType === "percentage") {
    return `${discountValue}%`;
  }

  return formatMoney(discountValue);
}

export function getUsageCount(promoCode: PromoCode): number {
  return promoCode.usage?.redemption_count ?? promoCode.redemption_count;
}

export function getMaxUsage(promoCode: PromoCode): number | null {
  return promoCode.usage?.max_redemptions ?? promoCode.max_redemptions;
}

export function getUsageLabel(promoCode: PromoCode): string {
  const used = getUsageCount(promoCode);
  const max = getMaxUsage(promoCode);

  return max === null || typeof max === "undefined" ? `${used} / unlimited` : `${used} / ${max}`;
}
