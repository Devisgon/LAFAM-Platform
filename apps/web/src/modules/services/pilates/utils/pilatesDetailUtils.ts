import type { StaffMember } from "@/modules/staff";

import type {
  CreatePilatesClassPayload,
  CreatePilatesSchedulePayload,
  PilatesClassDefinition,
  PilatesClassLevel,
  PilatesClassStatus,
  PilatesScheduleStatus,
  UpdatePilatesSchedulePayload,
} from "../api/pilatesApi";

export const fieldClass =
  "min-h-12 w-full rounded-sm border border-background-secondary bg-card-bg-primary px-3 py-2 text-sm text-txt-primary outline-none focus:border-primary disabled:opacity-60";
export const buttonClass =
  "inline-flex min-h-11 items-center justify-center rounded-sm border border-background-secondary px-4 py-2 text-xs font-bold transition hover:bg-background-secondary disabled:cursor-not-allowed disabled:opacity-50";
const detailCacheKey = (classId: string) =>
  `lafam:admin:pilates:class:${classId}`;

export function readDetailCache(
  classId: string,
): PilatesClassDefinition | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(
      window.sessionStorage.getItem(detailCacheKey(classId)) ?? "null",
    ) as PilatesClassDefinition | null;
  } catch {
    window.sessionStorage.removeItem(detailCacheKey(classId));
    return null;
  }
}

export function writeDetailCache(
  classId: string,
  detail: PilatesClassDefinition,
): void {
  try {
    window.sessionStorage.setItem(
      detailCacheKey(classId),
      JSON.stringify(detail),
    );
  } catch {
    // Rendering fresh API data still works when storage is unavailable.
  }
}

export function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

export function classTone(
  status: PilatesClassStatus,
): "success" | "warning" | "error" {
  if (status === "active") return "success";
  if (status === "deleted") return "error";
  return "warning";
}

export function scheduleTone(
  status: PilatesScheduleStatus,
): "success" | "warning" | "error" {
  if (status === "scheduled") return "success";
  if (status === "completed") return "warning";
  return "error";
}

export function formatDate(date: string): string {
  const value = new Date(`${date}T00:00:00`);
  return Number.isNaN(value.getTime())
    ? date
    : new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value);
}

export function formatTime(time: string): string {
  const value = new Date(`2026-01-01T${time}`);
  return Number.isNaN(value.getTime())
    ? time
    : new Intl.DateTimeFormat("en", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(value);
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
    currency: "KWD" as const,
    level: String(data.get("level")) as PilatesClassLevel,
    status: String(data.get("status")) as Exclude<
      PilatesClassStatus,
      "deleted"
    >,
    ...(image instanceof File && image.size > 0 ? { image } : {}),
  };
}

export const calendarDayNames = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];
export const scheduleWeekDays = [
  { label: "Monday", shortLabel: "Mon", value: 1 },
  { label: "Tuesday", shortLabel: "Tue", value: 2 },
  { label: "Wednesday", shortLabel: "Wed", value: 3 },
  { label: "Thursday", shortLabel: "Thu", value: 4 },
  { label: "Friday", shortLabel: "Fri", value: 5 },
  { label: "Saturday", shortLabel: "Sat", value: 6 },
  { label: "Sunday", shortLabel: "Sun", value: 0 },
] as const;

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
    return monthDateRange(defaultMonth());
  }

  return {
    fromDate: isoDate(new Date(year, monthIndex, 1)),
    toDate: isoDate(new Date(year, monthIndex + 1, 0)),
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

export type TimeSlotOption = {
  endTime: string;
  label: string;
  startTime: string;
};
export type DaySlotOption = TimeSlotOption & {
  available: boolean;
};
export type MonthlySchedulePlan = Record<string, string[]>;

export function minutesFromTime(time: string): number {
  const [hour, minute] = time.slice(0, 5).split(":").map(Number);

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return Number.NaN;
  }

  return hour * 60 + minute;
}

export function timeFromMinutes(totalMinutes: number): string {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function dayFromDate(date: string): number | null {
  const value = new Date(`${date}T00:00:00`);

  if (Number.isNaN(value.getTime())) {
    return null;
  }

  return value.getDay();
}

export function dayOccursInInterval(
  dayOfWeek: number,
  startDate: string,
  endDate: string,
): boolean {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start > end
  ) {
    return false;
  }

  const daysUntilOccurrence = (dayOfWeek - start.getDay() + 7) % 7;
  const firstOccurrence = new Date(start);
  firstOccurrence.setDate(start.getDate() + daysUntilOccurrence);

  return firstOccurrence <= end;
}

export function trainerSlots(
  trainer: StaffMember | undefined,
  dayOfWeek: number | null,
  durationMinutes: number,
): TimeSlotOption[] {
  if (!trainer || dayOfWeek === null || durationMinutes < 15) {
    return [];
  }

  const seen = new Set<string>();

  return trainer.availability
    .filter((rule) => rule.is_available && rule.day_of_week === dayOfWeek)
    .flatMap((rule) => {
      const start = minutesFromTime(rule.start_time);
      const end = minutesFromTime(rule.end_time);

      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        return [];
      }

      const options: TimeSlotOption[] = [];

      for (
        let cursor = start;
        cursor + durationMinutes <= end;
        cursor += durationMinutes
      ) {
        const startTime = timeFromMinutes(cursor);
        const endTime = timeFromMinutes(cursor + durationMinutes);
        const key = `${startTime}-${endTime}`;

        if (!seen.has(key)) {
          seen.add(key);
          options.push({
            endTime,
            label: `${startTime} - ${endTime}`,
            startTime,
          });
        }
      }

      return options;
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function trainerDaySlots(
  trainer: StaffMember | undefined,
  dayOfWeek: number | null,
  durationMinutes: number,
): DaySlotOption[] {
  if (dayOfWeek === null || durationMinutes < 15 || durationMinutes > 240) {
    return [];
  }

  const availableRanges = trainer
    ? trainer.availability.filter(
        (rule) => rule.is_available && rule.day_of_week === dayOfWeek,
      )
    : [];
  const slots: DaySlotOption[] = [];

  for (
    let cursor = 0;
    cursor + durationMinutes <= 24 * 60;
    cursor += durationMinutes
  ) {
    const startTime = timeFromMinutes(cursor);
    const endTime = timeFromMinutes(cursor + durationMinutes);
    const available = availableRanges.some((rule) => {
      const rangeStart = minutesFromTime(rule.start_time);
      const rangeEnd = minutesFromTime(rule.end_time);

      return (
        Number.isFinite(rangeStart) &&
        Number.isFinite(rangeEnd) &&
        cursor >= rangeStart &&
        cursor + durationMinutes <= rangeEnd
      );
    });

    slots.push({
      available,
      endTime,
      label: `${startTime} - ${endTime}`,
      startTime,
    });
  }

  return slots;
}

export function parseMonthlySchedulePlan(
  value: FormDataEntryValue | null,
): MonthlySchedulePlan {
  if (typeof value !== "string" || !value.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .map(([day, slots]) => [
          day,
          Array.isArray(slots)
            ? slots.filter((slot): slot is string => typeof slot === "string")
            : [],
        ])
        .filter(([, slots]) => slots.length > 0),
    );
  } catch {
    return {};
  }
}

export function createSchedulePayloads(
  form: HTMLFormElement,
  classId: string,
): CreatePilatesSchedulePayload[] {
  const data = new FormData(form);
  const mode = String(data.get("mode"));
  const common = {
    class_id: classId,
    trainer_staff_profile_id: String(data.get("trainer_staff_profile_id")),
    studio: String(data.get("studio")).trim(),
    price_amount: Number(data.get("price_amount")),
    currency: "KWD" as const,
  };

  if (mode === "monthly") {
    const startDate = String(data.get("start_date"));
    const endDate = String(data.get("end_date"));

    if (!startDate || !endDate || startDate > endDate) {
      throw new Error("Select a valid start and end date.");
    }

    const plan = parseMonthlySchedulePlan(data.get("monthly_schedule_plan"));
    const scheduleDays = Object.entries(plan)
      .map(([day, selectedSlots]) => ({
        day_of_week: Number(day),
        time_slots: selectedSlots.map((startTime) => ({
          start_time: startTime,
          duration_minutes: Number(data.get("duration_minutes")),
          capacity: Number(data.get("capacity")),
        })),
      }))
      .filter(
        (day) =>
          Number.isInteger(day.day_of_week) &&
          day.day_of_week >= 0 &&
          day.day_of_week <= 6 &&
          dayOccursInInterval(day.day_of_week, startDate, endDate) &&
          day.time_slots.length > 0,
      );

    if (scheduleDays.length === 0) {
      throw new Error("Select at least one available trainer time slot.");
    }

    return [
      {
        ...common,
        start_date: startDate,
        end_date: endDate,
        default_capacity: Number(data.get("capacity")),
        schedule_days: scheduleDays,
      },
    ];
  }

  throw new Error("Select at least one available trainer time slot.");
}

export function updateSchedulePayload(
  form: HTMLFormElement,
): UpdatePilatesSchedulePayload {
  const data = new FormData(form);
  const startTime = String(data.get("start_time"));

  if (!startTime) {
    throw new Error("Select a trainer time slot.");
  }

  return {
    trainer_staff_profile_id: String(data.get("trainer_staff_profile_id")),
    studio: String(data.get("studio")).trim(),
    class_date: String(data.get("class_date")),
    start_time: startTime,
    duration_minutes: Number(data.get("duration_minutes")),
    capacity: Number(data.get("capacity")),
    price_amount: Number(data.get("price_amount")),
    currency: "KWD",
  };
}
