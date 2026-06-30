import type { ClassCardBookingSummary } from "@/components/data-display/ClassCard";

import type {
  CreatePilatesClassPayload,
  PilatesClassLevel,
  PilatesClassStatus,
  PilatesSchedule,
} from "../api/pilatesApi";

export const classListFieldClass =
  "min-h-12 w-full rounded-sm border border-background-secondary bg-card-bg-primary px-3 py-2 text-sm text-txt-primary outline-none focus:border-primary disabled:opacity-60";
export const classListButtonClass =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-background-secondary px-4 py-2 text-xs font-bold transition hover:bg-background-secondary";

export function label(value: string): string {
  return value.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

export function classPayload(form: HTMLFormElement): CreatePilatesClassPayload {
  const data = new FormData(form);
  const image = data.get("image");
  return {
    title: String(data.get("title")).trim(),
    description: String(data.get("description")).trim() || null,
    default_duration_minutes: Number(data.get("default_duration_minutes")),
    default_capacity: Number(data.get("default_capacity")),
    default_price_amount: Number(data.get("default_price_amount")),
    currency: "KWD",
    level: String(data.get("level")) as PilatesClassLevel,
    status: String(data.get("status")) as Exclude<PilatesClassStatus, "deleted">,
    ...(image instanceof File && image.size > 0 ? { image } : {}),
  };
}

export function scheduleStartTimestamp(schedule: PilatesSchedule): number {
  return new Date(
    `${schedule.class_date}T${schedule.start_time.slice(0, 8)}`,
  ).getTime();
}

export function bookingSummary(schedule: PilatesSchedule): ClassCardBookingSummary {
  return {
    availableSeats: schedule.availability.available_seats,
    bookedCount: schedule.availability.booked_count,
    capacity: schedule.capacity,
  };
}

export function defaultBookingSummary(defaultCapacity: number): ClassCardBookingSummary {
  return {
    availableSeats: defaultCapacity,
    bookedCount: 0,
    capacity: defaultCapacity,
  };
}
