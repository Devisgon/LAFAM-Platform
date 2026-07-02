export const fieldClass =
  "min-h-12 w-full rounded-sm border border-background-secondary bg-card-bg-primary px-4 text-sm text-txt-primary outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:opacity-60";

export const pageSizeOptions = [10, 20, 50] as const;

export const promoStatuses = [
  "active",
  "inactive",
  "expired",
  "deleted",
] as const;

export const promoDiscountTypes = ["percentage", "fixed_amount"] as const;
export const promoTargetTypes = [
  "booking",
  "private_booking",
  "booking_order",
] as const;
export const promoPaymentMethods = ["knet", "card", "wallet"] as const;
