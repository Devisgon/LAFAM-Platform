import type { PilatesSchedule } from "@/modules/services/pilates";

import type {
  AdminBooking,
  AdminBookingPaymentStatus,
  AdminBookingStatus,
  AdminWaitlistEntry,
  PrivateTrainerBooking,
} from "../api/adminBookingsApi";

export function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

export function sourceLabel(value?: string | null): string {
  return value?.trim() ? label(value) : "Not recorded";
}

export function statusTone(
  status: string,
): "neutral" | "info" | "success" | "warning" | "error" {
  if (status === "confirmed" || status === "scheduled") return "success";
  if (status === "pending_payment" || status === "waiting") return "warning";
  if (status === "completed") return "info";
  if (status === "cancelled" || status === "deleted" || status === "expired") {
    return "error";
  }

  return "neutral";
}

export function paymentTone(
  status: AdminBookingPaymentStatus,
): "neutral" | "info" | "success" | "warning" | "error" {
  if (status === "paid" || status === "not_required") return "success";
  if (status === "pending") return "warning";
  if (status === "failed" || status === "expired") return "error";
  if (status === "refunded") return "info";
  return "neutral";
}

export function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatTime(value: string): string {
  const [hours = "0", minutes = "00"] = value.split(":");
  const date = new Date(2000, 0, 1, Number(hours), Number(minutes));

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
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

export function formatPrice(
  amount?: number | null,
  currency?: string | null,
): string {
  if (amount === null || amount === undefined) return "Not configured";
  return `${amount.toFixed(3)} ${currency ?? "KWD"}`;
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The booking request failed.";
}

export function availabilityReason(reason: string | null): string {
  if (reason === "past_slot") return "This time has already passed.";
  if (reason === "trainer_not_available") {
    return "The trainer is outside their configured working hours.";
  }
  if (reason === "pilates_class_schedule_conflict") {
    return "The trainer already has a Pilates class at this time.";
  }
  if (reason === "private_booking_conflict") {
    return "The trainer already has a private booking at this time.";
  }
  return "The trainer is unavailable at this time.";
}

export function isPreviousBooking(booking: AdminBooking): boolean {
  return isPreviousStatus(booking.status);
}

export function isPreviousPrivateBooking(
  booking: PrivateTrainerBooking,
): boolean {
  return isPreviousStatus(booking.status);
}

export function isPreviousStatus(status: AdminBookingStatus): boolean {
  return (
    status === "cancelled" || status === "completed" || status === "no_show"
  );
}

export function waitlistScheduleLabel(schedule: PilatesSchedule): string {
  const classTitle = schedule.class?.title ?? schedule.class_id;
  const trainerName =
    schedule.trainer?.display_name ?? schedule.trainer_staff_profile_id;

  return [
    classTitle,
    formatDate(schedule.class_date),
    `${formatTime(schedule.start_time)} - ${formatTime(schedule.end_time)}`,
    trainerName,
  ].join(" | ");
}

export function waitlistMatchesSearch(
  entry: AdminWaitlistEntry,
  query: string,
): boolean {
  const searchText = query.trim().toLowerCase();

  if (!searchText) return true;

  return [
    entry.id,
    entry.user_id,
    entry.customer?.full_name,
    entry.customer?.email,
    entry.customer?.phone,
    entry.class?.title,
    entry.schedule?.class_date,
    entry.schedule?.start_time,
    entry.schedule?.end_time,
    entry.trainer?.display_name,
    entry.trainer_staff_profile_id,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(searchText));
}
