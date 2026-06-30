import type { AnalyticsBookingListItem } from "../api/dashboardApi";

export type ChartPoint = {
  axisLabel: string;
  value: number;
  x: number;
  y: number;
};

export const DEFAULT_UPCOMING_DAYS = 7;
export const DEFAULT_RECENT_LIMIT = 5;
export const DEFAULT_TOP_SERVICES_LIMIT = 5;
export const DONUT_CIRCUMFERENCE = 276.5;

export function formatDate(value?: string | null): string {
  if (!value) return "Not scheduled";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatShortDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
  }).format(date);
}

export function formatMoney(value: number, currency: string): string {
  return `${value.toLocaleString()} ${currency}`;
}

export function formatAxisMoney(value: number): string {
  if (value >= 1000) {
    return `${Math.round(value / 1000)}K`;
  }

  return Math.round(value).toLocaleString();
}

export function formatPaymentStatus(status: string): string {
  return status
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

export function getCurrentMonthRange() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0);
  const format = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  return {
    from_date: format(from),
    to_date: format(to),
  };
}

export function bookingTitle(booking: AnalyticsBookingListItem): string {
  if (booking.booking_type === "private_trainer_booking") {
    return "Private trainer";
  }

  return booking.class?.title ?? "Pilates class";
}

export function bookingDateLabel(booking: AnalyticsBookingListItem): string {
  const date =
    booking.schedule.class_date ??
    booking.schedule.session_date ??
    booking.created_at.slice(0, 10);
  const time = booking.schedule.start_time;

  return time ? `${formatDate(date)}, ${time.slice(0, 5)}` : formatDate(date);
}

export function statusTone(status: string): "success" | "warning" | "error" | "info" {
  if (status === "confirmed" || status === "paid" || status === "not_required") {
    return "success";
  }

  if (status === "pending" || status === "pending_payment") {
    return "warning";
  }

  if (status === "cancelled" || status === "failed" || status === "expired") {
    return "error";
  }

  return "info";
}
