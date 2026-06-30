import type {
  PaymentMethod,
  PaymentTransactionStatus,
  PaymentTransactionType,
} from "../api/paymentsApi";

export const fieldClass =
  "min-h-12 w-full rounded-sm border border-background-secondary bg-card-bg-primary px-4 text-base text-txt-primary outline-none transition placeholder:text-txt-secondary focus:border-primary";

export const pageSizeOptions = [10, 25, 50];

export const paymentMethods: PaymentMethod[] = ["knet", "card", "wallet"];
export const transactionTypes: PaymentTransactionType[] = [
  "intent_created",
  "provider_request",
  "provider_response",
  "callback_received",
  "webhook_received",
  "verification",
  "status_change",
  "wallet_debit",
  "wallet_credit",
  "refund_requested",
  "refund_processed",
  "refund_failed",
];
export const transactionStatuses: PaymentTransactionStatus[] = [
  "pending",
  "succeeded",
  "failed",
  "ignored",
];
