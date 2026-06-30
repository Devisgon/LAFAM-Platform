import type { AdminBooking, PrivateTrainerBooking } from "@/modules/bookings";
import type { AdminUser } from "@/modules/users";

import type {
  PaymentStatus,
  PaymentTransactionStatus,
} from "../api/paymentsApi";

export function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The payment request failed.";
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "Not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat("en", {
    currency: "KWD",
    maximumFractionDigits: 3,
    minimumFractionDigits: 3,
    style: "currency",
  }).format(value);
}

export function getUserDisplayName(user?: AdminUser): string {
  if (!user) return "Unknown user";

  return (
    user.full_name ??
    user.email ??
    user.phone ??
    `User ${user.id.slice(0, 8)}`
  );
}

export function getUserOptionLabel(user: AdminUser): string {
  const name = getUserDisplayName(user);

  if (user.email && user.email !== name) return `${name} - ${user.email}`;
  if (user.phone && user.phone !== name) return `${name} - ${user.phone}`;

  return name;
}

export function getPaymentUserName(
  userId: string,
  usersById: Map<string, AdminUser>,
): string {
  const user = usersById.get(userId);

  return user ? getUserDisplayName(user) : `User ${userId.slice(0, 8)}`;
}

export function getBookingCustomerName(
  booking: AdminBooking | PrivateTrainerBooking,
): string {
  return (
    booking.customer?.full_name ??
    booking.customer?.email ??
    booking.customer?.phone ??
    "Unknown customer"
  );
}

export function getBookingOptionLabel(
  booking: AdminBooking | PrivateTrainerBooking,
): string {
  return `${getBookingCustomerName(booking)} - ${booking.booking_number}`;
}

export function statusTone(
  status: PaymentStatus | PaymentTransactionStatus,
): "neutral" | "info" | "success" | "warning" | "error" {
  if (status === "paid" || status === "succeeded") return "success";
  if (
    status === "pending" ||
    status === "requires_redirect" ||
    status === "processing" ||
    status === "refund_requested" ||
    status === "refund_processing"
  ) {
    return "warning";
  }
  if (
    status === "failed" ||
    status === "cancelled" ||
    status === "expired" ||
    status === "manual_refund_required"
  ) {
    return "error";
  }
  if (status === "refunded" || status === "ignored") return "info";
  return "neutral";
}
