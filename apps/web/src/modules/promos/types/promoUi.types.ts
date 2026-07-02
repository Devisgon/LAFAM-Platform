import type { PromoCode } from "../api/promoCodesApi";

export type ResultToast = {
  message: string;
  title: string;
  tone: "success" | "error";
};

export type PromoDialog =
  | { promoCode: PromoCode; type: "edit" }
  | { promoCode: PromoCode; type: "delete" };
