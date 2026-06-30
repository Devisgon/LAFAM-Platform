import type { AdminBookingCalendarEvent } from "@/modules/bookings";

export const fieldClass =
  "min-h-12 w-full rounded-sm border border-background-secondary bg-card-bg-primary px-4 text-base text-txt-primary outline-none transition placeholder:text-txt-secondary focus:border-primary";

export const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function isoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function defaultMonth(): string {
  return isoDate(new Date()).slice(0, 7);
}

export function monthDateRange(monthValue: string): {
  fromDate: string;
  toDate: string;
} {
  const [yearText, monthText] = monthValue.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex)) {
    const fallback = defaultMonth();
    return monthDateRange(fallback);
  }

  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);

  return {
    fromDate: isoDate(firstDay),
    toDate: isoDate(lastDay),
  };
}

export function monthLabel(monthValue: string): string {
  const [yearText, monthText] = monthValue.split("-");
  const date = new Date(Number(yearText), Number(monthText) - 1, 1);

  if (Number.isNaN(date.getTime())) return monthValue;

  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function buildCalendarMonthOptions(): Array<[string, string]> {
  return Array.from({ length: 12 }, (_, monthIndex) => {
    const value = String(monthIndex + 1).padStart(2, "0");
    const label = new Intl.DateTimeFormat("en", { month: "long" }).format(
      new Date(2026, monthIndex, 1),
    );

    return [value, label];
  });
}

export function buildUpcomingYearOptions(count = 10): string[] {
  const currentYear = new Date().getFullYear();

  return Array.from({ length: count }, (_, index) =>
    String(currentYear + index),
  );
}

export function buildMonthOptions(): Array<[string, string]> {
  const now = new Date();
  const startYear = now.getFullYear() - 1;
  const options: Array<[string, string]> = [];

  for (let year = startYear; year <= startYear + 2; year += 1) {
    for (let month = 0; month < 12; month += 1) {
      const value = `${year}-${String(month + 1).padStart(2, "0")}`;
      options.push([value, monthLabel(value)]);
    }
  }

  return options;
}

export function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
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

export function eventTypeLabel(
  eventType: AdminBookingCalendarEvent["event_type"],
): string {
  if (eventType === "pilates_schedule") return "Class schedule";
  if (eventType === "pilates_booking") return "Class booking";
  if (eventType === "private_trainer_booking") return "Private booking";
  return "Waitlist";
}

export function eventTypeClass(
  eventType: AdminBookingCalendarEvent["event_type"],
): string {
  if (eventType === "pilates_schedule") return "calendar-event--class-schedule";
  if (eventType === "pilates_booking") return "calendar-event--class-booking";
  return `calendar-event--${eventType.replaceAll("_", "-")}`;
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

export function getSourceValue(
  event: AdminBookingCalendarEvent,
  key: string,
): string | null {
  return event.source[key] ?? null;
}

export function buildCalendarDays(
  fromDate: string,
  toDate: string,
): Array<string | null> {
  const start = new Date(`${fromDate}T00:00:00`);
  const end = new Date(`${toDate}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [];
  }

  const days: Array<string | null> = Array.from(
    { length: start.getDay() },
    () => null,
  );
  const cursor = new Date(start);
  let guard = 0;

  while (cursor <= end && guard < 62) {
    days.push(isoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }

  const trailingDays = (7 - (days.length % 7)) % 7;
  for (let count = 0; count < trailingDays; count += 1) {
    days.push(null);
  }

  return days;
}
