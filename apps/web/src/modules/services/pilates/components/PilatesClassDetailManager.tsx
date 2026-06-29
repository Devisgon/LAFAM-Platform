"use client";

import Link from "next/link";
import {
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePilates } from "@/modules/services/pilates";
import {
  type CreatePilatesClassPayload,
  type CreatePilatesSchedulePayload,
  type PilatesClassDefinition,
  type PilatesClassLevel,
  type PilatesClassStatus,
  type PilatesSchedule,
  type PilatesScheduleStatus,
  type UpdatePilatesSchedulePayload,
} from "@/modules/services/pilates";
import type { StaffMember } from "@/modules/staff";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/data-display/LoadingState";
import { Toast } from "@/components/ui/Toast";

const fieldClass =
  "min-h-12 w-full rounded-sm border border-background-secondary bg-card-bg-primary px-3 py-2 text-sm text-txt-primary outline-none focus:border-primary disabled:opacity-60";
const buttonClass =
  "inline-flex min-h-11 items-center justify-center rounded-sm border border-background-secondary px-4 py-2 text-xs font-bold transition hover:bg-background-secondary disabled:cursor-not-allowed disabled:opacity-50";
const detailCacheKey = (classId: string) =>
  `lafam:admin:pilates:class:${classId}`;

function readDetailCache(classId: string): PilatesClassDefinition | null {
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

function writeDetailCache(
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

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function classTone(
  status: PilatesClassStatus,
): "success" | "warning" | "error" {
  if (status === "active") return "success";
  if (status === "deleted") return "error";
  return "warning";
}

function scheduleTone(
  status: PilatesScheduleStatus,
): "success" | "warning" | "error" {
  if (status === "scheduled") return "success";
  if (status === "completed") return "warning";
  return "error";
}

function formatDate(date: string): string {
  const value = new Date(`${date}T00:00:00`);
  return Number.isNaN(value.getTime())
    ? date
    : new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value);
}

function formatTime(time: string): string {
  const value = new Date(`2026-01-01T${time}`);
  return Number.isNaN(value.getTime())
    ? time
    : new Intl.DateTimeFormat("en", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(value);
}

function classPayload(form: HTMLFormElement): CreatePilatesClassPayload {
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

const calendarDayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const scheduleWeekDays = [
  { label: "Monday", shortLabel: "Mon", value: 1 },
  { label: "Tuesday", shortLabel: "Tue", value: 2 },
  { label: "Wednesday", shortLabel: "Wed", value: 3 },
  { label: "Thursday", shortLabel: "Thu", value: 4 },
  { label: "Friday", shortLabel: "Fri", value: 5 },
  { label: "Saturday", shortLabel: "Sat", value: 6 },
  { label: "Sunday", shortLabel: "Sun", value: 0 },
] as const;

function isoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function defaultMonth(): string {
  return isoDate(new Date()).slice(0, 7);
}

function monthDateRange(monthValue: string): {
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

function monthLabel(monthValue: string): string {
  const [yearText, monthText] = monthValue.split("-");
  const date = new Date(Number(yearText), Number(monthText) - 1, 1);

  if (Number.isNaN(date.getTime())) return monthValue;

  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function buildMonthOptions(): Array<[string, string]> {
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

function buildCalendarDays(
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

type TimeSlotOption = {
  endTime: string;
  label: string;
  startTime: string;
};
type DaySlotOption = TimeSlotOption & {
  available: boolean;
};
type MonthlySchedulePlan = Record<string, string[]>;

function minutesFromTime(time: string): number {
  const [hour, minute] = time.slice(0, 5).split(":").map(Number);

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return Number.NaN;
  }

  return hour * 60 + minute;
}

function timeFromMinutes(totalMinutes: number): string {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function dayFromDate(date: string): number | null {
  const value = new Date(`${date}T00:00:00`);

  if (Number.isNaN(value.getTime())) {
    return null;
  }

  return value.getDay();
}

function dayOccursInInterval(
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

function trainerSlots(
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

function trainerDaySlots(
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

function parseMonthlySchedulePlan(
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

function createSchedulePayloads(
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

function updateSchedulePayload(
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

export function PilatesClassDetailManager({ classId }: { classId: string }) {
  const api = usePilates();
  const getClass = api.getClass;
  const [cachedDetail] = useState(() => readDetailCache(classId));
  const [detail, setDetail] = useState<PilatesClassDefinition | null>(
    cachedDetail,
  );
  const [isDetailLoading, setIsDetailLoading] = useState(!cachedDetail);
  const [editingClass, setEditingClass] = useState(false);
  const [editingSchedule, setEditingSchedule] =
    useState<PilatesSchedule | null>(null);
  const [creatingSchedule, setCreatingSchedule] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    title: string;
    tone: "success" | "error";
  } | null>(null);

  const schedules = api.schedules.filter((item) => item.class_id === classId);

  useEffect(() => {
    const request = window.setTimeout(async () => {
      if (!cachedDetail) setIsDetailLoading(true);
      try {
        const freshDetail = await getClass(classId);
        setDetail(freshDetail);
        writeDetailCache(classId, freshDetail);
      } catch (error: unknown) {
        if (!cachedDetail) {
          setToast({
            message:
              error instanceof Error
                ? error.message
                : "Class details could not be loaded.",
            title: "Class not loaded",
            tone: "error",
          });
        }
      } finally {
        setIsDetailLoading(false);
      }
    }, 0);
    return () => window.clearTimeout(request);
  }, [cachedDetail, classId, getClass]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const reloadDetail = async () => {
    const freshDetail = await getClass(classId);
    setDetail(freshDetail);
    writeDetailCache(classId, freshDetail);
  };

  const run = async (
    request: () => Promise<unknown>,
    title: string,
    message: string,
    close?: () => void,
  ) => {
    try {
      await request();
      await reloadDetail();
      close?.();
      setToast({ message, title, tone: "success" });
    } catch (error: unknown) {
      setToast({
        message: error instanceof Error ? error.message : "The action failed.",
        title: "Pilates action failed",
        tone: "error",
      });
    }
  };

  const updateClass = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = classPayload(event.currentTarget);
    void run(
      () => api.updateClass(classId, payload),
      "Class updated",
      `${payload.title} was updated.`,
      () => setEditingClass(false),
    );
  };

  const saveSchedule = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const current = editingSchedule;

    try {
      if (current) {
        const payload = updateSchedulePayload(event.currentTarget);
        void run(
          () => api.updateSchedule(current.id, payload),
          "Schedule updated",
          "The class schedule was updated.",
          () => {
            setEditingSchedule(null);
            setCreatingSchedule(false);
          },
        );
        return;
      }

      const payloads = createSchedulePayloads(event.currentTarget, classId);
      void run(
        () => api.createSchedules(payloads),
        "Schedule created",
        `${payloads.length} schedule series added to this class.`,
        () => {
          setEditingSchedule(null);
          setCreatingSchedule(false);
        },
      );
    } catch (error: unknown) {
      setToast({
        message:
          error instanceof Error
            ? error.message
            : "The schedule is incomplete.",
        title: "Schedule not ready",
        tone: "error",
      });
    }
  };

  const cancelSchedule = (item: PilatesSchedule) => {
    const reason = window.prompt("Why is this schedule being cancelled?");
    if (!reason?.trim()) return;
    void run(
      () => api.cancelSchedule(item.id, reason.trim()),
      "Schedule cancelled",
      "The schedule and cancellation reason were saved.",
    );
  };

  const completeSchedule = (item: PilatesSchedule) => {
    if (!window.confirm("Mark this schedule as completed?")) return;
    void run(
      () => api.completeSchedule(item.id),
      "Schedule completed",
      "The schedule was marked completed.",
    );
  };

  const deleteSchedule = (item: PilatesSchedule) => {
    if (!window.confirm("Delete this schedule?")) return;
    void run(
      () => api.deleteSchedule(item.id),
      "Schedule deleted",
      "The schedule was deleted.",
    );
  };

  if (api.isLoading || isDetailLoading) {
    return (
      <LoadingState className="p-6" label="Loading class management page" />
    );
  }

  if (!detail) {
    return (
      <section className="rounded-xl border border-error/30 bg-error/10 p-6">
        <p className="text-sm text-error">
          This Pilates class could not be loaded.
        </p>
        <Link className={`${buttonClass} mt-4`} href="/services/pilates">
          Back to classes
        </Link>
      </section>
    );
  }

  return (
    <>
      <nav className="mb-5 text-sm text-txt-secondary" aria-label="Breadcrumb">
        <Link
          className="inline-flex items-center gap-2 font-semibold text-primary hover:underline"
          href="/services/pilates"
        >
          <span aria-hidden="true">&larr;</span>
          Back to Pilates classes
        </Link>
      </nav>

      {creatingSchedule || editingSchedule ? (
        <ScheduleScreen
          onClose={() => {
            setCreatingSchedule(false);
            setEditingSchedule(null);
          }}
          title={editingSchedule ? "Edit schedule" : `Schedule ${detail.title}`}
        >
          <ScheduleForm
            detail={detail}
            isSaving={api.isMutating}
            item={editingSchedule ?? undefined}
            onClose={() => {
              setCreatingSchedule(false);
              setEditingSchedule(null);
            }}
            onSubmit={saveSchedule}
            trainers={api.trainers}
          />
        </ScheduleScreen>
      ) : (
        <>
          <ClassDetailCard
            detail={detail}
            onCreateSchedule={() => setCreatingSchedule(true)}
            onEdit={() => setEditingClass(true)}
            schedules={schedules}
            onCancelSchedule={cancelSchedule}
            onCompleteSchedule={completeSchedule}
            onDeleteSchedule={deleteSchedule}
            onEditSchedule={setEditingSchedule}
          />

          {editingClass ? (
            <InlineCard
              onClose={() => setEditingClass(false)}
              title={`Edit ${detail.title}`}
            >
              <ClassEditForm
                detail={detail}
                isSaving={api.isMutating}
                onClose={() => setEditingClass(false)}
                onSubmit={updateClass}
              />
            </InlineCard>
          ) : null}
        </>
      )}

      {toast ? (
        <div className="fixed bottom-4 right-4 z-[90]">
          <Toast
            onDismiss={() => setToast(null)}
            title={toast.title}
            tone={toast.tone}
          >
            {toast.message}
          </Toast>
        </div>
      ) : null}
    </>
  );
}

function ClassDetailCard({
  detail,
  onCancelSchedule,
  onCompleteSchedule,
  onCreateSchedule,
  onDeleteSchedule,
  onEdit,
  onEditSchedule,
  schedules,
}: {
  detail: PilatesClassDefinition;
  onCancelSchedule: (item: PilatesSchedule) => void;
  onCompleteSchedule: (item: PilatesSchedule) => void;
  onCreateSchedule: () => void;
  onDeleteSchedule: (item: PilatesSchedule) => void;
  onEdit: () => void;
  onEditSchedule: (item: PilatesSchedule) => void;
  schedules: PilatesSchedule[];
}) {
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(
    null,
  );
  const { fromDate, toDate } = useMemo(
    () => monthDateRange(selectedMonth),
    [selectedMonth],
  );
  const days = useMemo(
    () => buildCalendarDays(fromDate, toDate),
    [fromDate, toDate],
  );
  const schedulesByDate = useMemo(() => {
    const grouped = new Map<string, PilatesSchedule[]>();

    schedules
      .filter(
        (schedule) =>
          schedule.class_date >= fromDate && schedule.class_date <= toDate,
      )
      .sort((left, right) =>
        `${left.class_date} ${left.start_time}`.localeCompare(
          `${right.class_date} ${right.start_time}`,
        ),
      )
      .forEach((schedule) => {
        const list = grouped.get(schedule.class_date) ?? [];
        list.push(schedule);
        grouped.set(schedule.class_date, list);
      });

    return grouped;
  }, [fromDate, schedules, toDate]);
  const visibleSchedules = useMemo(
    () => Array.from(schedulesByDate.values()).flat(),
    [schedulesByDate],
  );
  const selectedSchedule = useMemo(
    () =>
      selectedScheduleId
        ? (visibleSchedules.find(
            (schedule) => schedule.id === selectedScheduleId,
          ) ?? null)
        : null,
    [selectedScheduleId, visibleSchedules],
  );

  return (
    <article className="overflow-hidden rounded-3xl border border-background-secondary bg-card-bg-primary shadow-sm">
      <div className="grid lg:grid-cols-[300px_minmax(0,1fr)]">
        {detail.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            className="h-full min-h-64 w-full object-cover"
            height="512"
            src={detail.image_url}
            width="560"
          />
        ) : (
          <div className="flex min-h-64 items-center justify-center p-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="LAFAM"
              className="h-auto w-full max-w-56 object-contain"
              height="320"
              src="/logo.png"
              width="320"
            />
          </div>
        )}
        <div className="flex flex-col p-6 lg:p-8">
          <div className="flex flex-1 flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl">
              <div className="flex flex-wrap gap-2">
                <Badge tone={classTone(detail.status)}>
                  {label(detail.status)}
                </Badge>
                <Badge tone="info">{label(detail.level)}</Badge>
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-txt-primary">
                {detail.title}
              </h1>
              <p className="mt-3 text-sm leading-6 text-txt-secondary">
                {detail.description ?? "No description provided."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className={buttonClass} onClick={onEdit} type="button">
                Edit class
              </button>
              <button
                className="rounded-lg bg-button-primary px-5 py-2 text-xs font-bold text-white shadow-sm shadow-primary/20 disabled:opacity-50"
                disabled={detail.status !== "active"}
                onClick={onCreateSchedule}
                type="button"
              >
                Add schedule
              </button>
            </div>
          </div>
          <dl className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <HeroStat
              label="Duration"
              value={`${detail.default_duration_minutes} min`}
            />
            <HeroStat
              label="Capacity"
              value={`${detail.default_capacity} people`}
            />
            <HeroStat
              label="Price per booking"
              value={`${detail.default_price_amount.toFixed(3)} ${detail.currency}`}
            />
            <HeroStat
              label="Total schedules"
              value={String(schedules.length)}
            />
          </dl>
        </div>
      </div>
      <section
        className="border-t border-background-secondary px-6 py-6 lg:px-8"
        aria-labelledby="class-schedules-heading"
      >
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2
              className="text-2xl font-medium text-txt-primary"
              id="class-schedules-heading"
            >
              Schedule calendar
            </h2>
            <p className="mt-1 text-sm text-txt-secondary">
              Showing schedules for {detail.title}.
            </p>
          </div>
          <label className="grid max-w-xs gap-1.5 text-xs font-bold">
            Month
            <select
              className={fieldClass}
              onChange={(event) => {
                setSelectedMonth(event.target.value);
                setSelectedScheduleId(null);
              }}
              value={selectedMonth}
            >
              {buildMonthOptions().map(([value, optionLabel]) => (
                <option key={value} value={value}>
                  {optionLabel}
                </option>
              ))}
            </select>
          </label>
        </header>

        {schedules.length === 0 ? (
          <p className="mt-6 border-t border-dashed border-background-secondary py-8 text-center text-sm text-txt-secondary">
            No schedules have been created for this class.
          </p>
        ) : (
          <div
            className={`mt-6 grid gap-5 ${selectedSchedule ? "xl:grid-cols-[minmax(0,1fr)_340px]" : "grid-cols-1"}`}
          >
            <section
              aria-label={`${detail.title} schedule calendar`}
              className="min-w-0"
            >
              <div className="w-full overflow-hidden rounded-sm border border-background-secondary">
                <div className="grid grid-cols-7 border-b border-background-secondary bg-card-bg-secondary">
                  {calendarDayNames.map((day) => (
                    <div
                      className="min-w-0 border-r border-background-secondary px-1.5 py-3 text-center text-xs font-semibold text-txt-primary last:border-r-0 sm:px-3 sm:text-sm"
                      key={day}
                    >
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {days.map((day, index) => {
                    if (!day) {
                      return (
                        <div
                          aria-hidden="true"
                          className="min-h-28 min-w-0 border-b border-r border-background-secondary bg-background-secondary/30 p-1.5 last:border-r-0 sm:min-h-32 sm:p-2 lg:min-h-36 lg:p-3"
                          key={`empty-${index}`}
                        />
                      );
                    }

                    const daySchedules = schedulesByDate.get(day) ?? [];

                    return (
                      <div
                        className="min-h-28 min-w-0 overflow-hidden border-b border-r border-background-secondary bg-card-bg-primary p-1.5 last:border-r-0 sm:min-h-32 sm:p-2 lg:min-h-36 lg:p-3"
                        key={day}
                      >
                        <p className="mb-2 truncate text-xs font-semibold text-txt-primary sm:text-sm">
                          {new Intl.DateTimeFormat("en", {
                            day: "numeric",
                            month: "short",
                          }).format(new Date(`${day}T00:00:00`))}
                        </p>
                        <div className="grid min-w-0 gap-1.5">
                          {daySchedules.length > 0 ? (
                            daySchedules.map((schedule) => (
                              <button
                                className={`calendar-event-card calendar-event--class-schedule min-w-0 overflow-hidden rounded-sm px-2 py-1.5 text-left text-[11px] font-semibold leading-tight transition hover:brightness-95 sm:text-xs ${
                                  selectedSchedule?.id === schedule.id
                                    ? "ring-2 ring-primary ring-offset-1 ring-offset-card-bg-primary"
                                    : ""
                                }`}
                                key={schedule.id}
                                onClick={() =>
                                  setSelectedScheduleId(schedule.id)
                                }
                                type="button"
                              >
                                <span className="block truncate">
                                  {formatTime(schedule.start_time)} -{" "}
                                  {formatTime(schedule.end_time)}
                                </span>
                                <span className="mt-1 block truncate text-[10px] opacity-75 sm:text-[11px]">
                                  {schedule.trainer?.display_name ??
                                    "Assigned trainer"}
                                </span>
                              </button>
                            ))
                          ) : (
                            <span className="text-[11px] text-txt-secondary">
                              No schedule
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <p className="mt-4 text-center text-sm text-txt-secondary">
                Showing {visibleSchedules.length} schedules in{" "}
                {monthLabel(selectedMonth)}
              </p>
            </section>

            {selectedSchedule ? (
              <ScheduleDetailPanel
                item={selectedSchedule}
                onCancel={() => onCancelSchedule(selectedSchedule)}
                onComplete={() => onCompleteSchedule(selectedSchedule)}
                onDelete={() => onDeleteSchedule(selectedSchedule)}
                onEdit={() => onEditSchedule(selectedSchedule)}
                onClose={() => setSelectedScheduleId(null)}
              />
            ) : null}
          </div>
        )}
      </section>
    </article>
  );
}

function ScheduleDetailPanel({
  item,
  onCancel,
  onComplete,
  onClose,
  onDelete,
  onEdit,
}: {
  item: PilatesSchedule;
  onCancel: () => void;
  onComplete: () => void;
  onClose: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const active = item.status === "scheduled";
  return (
    <aside className="self-start rounded-md border border-background-secondary bg-card-bg-secondary p-5 shadow-sm">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={scheduleTone(item.status)}>{label(item.status)}</Badge>
          <span className="text-xs font-semibold text-txt-secondary">
            {item.studio}
          </span>
        </div>
        <button
          aria-label="Close schedule details"
          className="flex size-8 items-center justify-center rounded-sm bg-card-bg-primary text-txt-secondary transition hover:bg-background-secondary hover:text-txt-primary"
          onClick={onClose}
          type="button"
        >
          X
        </button>
      </header>
      <h3 className="mt-4 text-xl font-bold text-txt-primary">
        {formatDate(item.class_date)}
      </h3>
      <p className="mt-1 text-sm text-txt-secondary">
        Trainer:{" "}
        <strong className="text-txt-primary">
          {item.trainer?.display_name ?? "Assigned trainer"}
        </strong>
      </p>
      <dl className="mt-5 grid gap-3 text-sm">
        <DetailLine
          label="Time"
          value={`${formatTime(item.start_time)} - ${formatTime(item.end_time)}`}
        />
        <DetailLine label="Duration" value={`${item.duration_minutes} min`} />
        <DetailLine
          label="Booked"
          value={`${item.availability.booked_count}/${item.capacity}`}
        />
        <DetailLine
          label="Seats left"
          value={String(item.availability.available_seats)}
        />
        <DetailLine
          label="Price"
          value={`${(item.price_amount ?? 0).toFixed(3)} ${item.currency ?? "KWD"}`}
        />
      </dl>
      {item.cancellation_reason ? (
        <p className="mt-4 text-xs text-error">{item.cancellation_reason}</p>
      ) : null}
      <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        <button className={buttonClass} onClick={onEdit} type="button">
          Reschedule
        </button>
        <button
          className={buttonClass}
          disabled={!active}
          onClick={onComplete}
          type="button"
        >
          Complete
        </button>
        <button
          className={`${buttonClass} text-error`}
          disabled={!active}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        <button
          className={`${buttonClass} text-error`}
          onClick={onDelete}
          type="button"
        >
          Delete
        </button>
      </div>
    </aside>
  );
}

function DetailLine({
  label: detailLabel,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase text-txt-secondary">
        {detailLabel}
      </dt>
      <dd className="mt-1 break-words font-semibold text-txt-primary">
        {value}
      </dd>
    </div>
  );
}

function ClassEditForm({
  detail,
  isSaving,
  onClose,
  onSubmit,
}: {
  detail: PilatesClassDefinition;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit}>
      <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
        <FormInput
          className="sm:col-span-2"
          defaultValue={detail.title}
          label="Class title"
          maxLength={160}
          name="title"
          required
        />
        <label className="grid gap-1.5 text-xs font-bold sm:col-span-2">
          Description
          <textarea
            className={`${fieldClass} min-h-24 resize-y`}
            defaultValue={detail.description ?? ""}
            maxLength={2000}
            name="description"
          />
        </label>
        <FormInput
          defaultValue={detail.default_duration_minutes}
          label="Default duration (minutes)"
          max={240}
          min={15}
          name="default_duration_minutes"
          required
          type="number"
        />
        <FormInput
          defaultValue={detail.default_capacity}
          label="Default capacity"
          max={100}
          min={1}
          name="default_capacity"
          required
          type="number"
        />
        <FormInput
          defaultValue={detail.default_price_amount}
          label="Price per booking (KWD)"
          min={0}
          name="default_price_amount"
          required
          step="0.001"
          type="number"
        />
        <FormInput
          defaultValue={detail.currency}
          disabled
          label="Currency"
          readOnly
          type="text"
        />
        <Select
          defaultValue={detail.level}
          label="Level"
          name="level"
          options={["beginner", "intermediate", "advanced", "all_levels"]}
        />
        <Select
          defaultValue={detail.status}
          label="Status"
          name="status"
          options={["draft", "active", "inactive"]}
        />
        <label className="grid gap-1.5 text-xs font-bold sm:col-span-2">
          Replace cover image
          <input
            accept="image/jpeg,image/png,image/webp"
            className={fieldClass}
            name="image"
            type="file"
          />
        </label>
      </div>
      <ModalFooter
        isSaving={isSaving}
        onClose={onClose}
        submitLabel="Save class"
      />
    </form>
  );
}

function ScheduleScreen({
  children,
  onClose,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <section className="overflow-hidden rounded-md border border-background-secondary bg-card-bg-primary text-txt-primary shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-background-secondary bg-card-bg-primary px-5 py-5">
        <div>
          <p className="text-xs font-bold uppercase text-txt-secondary">
            Scheduling
          </p>
          <h2 className="mt-1 text-2xl font-medium">{title}</h2>
        </div>
        <button className={buttonClass} onClick={onClose} type="button">
          Back to class
        </button>
      </header>
      {children}
    </section>
  );
}

function ScheduleForm({
  detail,
  isSaving,
  item,
  onClose,
  onSubmit,
  trainers,
}: {
  detail: PilatesClassDefinition;
  isSaving: boolean;
  item?: PilatesSchedule;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  trainers: StaffMember[];
}) {
  const isEditing = Boolean(item);
  const [selectedTrainerId, setSelectedTrainerId] = useState(
    item?.trainer_staff_profile_id ?? "",
  );
  const [startTime, setStartTime] = useState(
    item?.start_time?.slice(0, 5) ?? "10:00",
  );
  const [classDate, setClassDate] = useState(item?.class_date ?? "");
  const defaultScheduleRange = useMemo(
    () => monthDateRange(item?.class_date?.slice(0, 7) ?? defaultMonth()),
    [item?.class_date],
  );
  const [scheduleStartDate, setScheduleStartDate] = useState(
    defaultScheduleRange.fromDate,
  );
  const [scheduleEndDate, setScheduleEndDate] = useState(
    defaultScheduleRange.toDate,
  );
  const [selectedScheduleDay, setSelectedScheduleDay] = useState(1);
  const [monthlyPlan, setMonthlyPlan] = useState<MonthlySchedulePlan>({});
  const [durationMinutes, setDurationMinutes] = useState(
    item?.duration_minutes ?? detail.default_duration_minutes,
  );
  const [capacity, setCapacity] = useState(
    item?.capacity ?? detail.default_capacity,
  );
  const [priceAmount, setPriceAmount] = useState(
    item?.price_amount ?? detail.default_price_amount,
  );
  const selectedTrainer = useMemo(
    () => trainers.find((trainer) => trainer.id === selectedTrainerId),
    [selectedTrainerId, trainers],
  );
  const singleSlots = useMemo(
    () =>
      trainerSlots(selectedTrainer, dayFromDate(classDate), durationMinutes),
    [classDate, durationMinutes, selectedTrainer],
  );
  const singleSlotsWithCurrent = useMemo(() => {
    if (
      !isEditing ||
      !startTime ||
      singleSlots.some((option) => option.startTime === startTime)
    ) {
      return singleSlots;
    }

    const endTime = item?.end_time?.slice(0, 5) ?? "";

    return [
      {
        endTime,
        label: endTime
          ? `${startTime} - ${endTime} (current)`
          : `${startTime} (current)`,
        startTime,
      },
      ...singleSlots,
    ];
  }, [isEditing, item?.end_time, singleSlots, startTime]);

  const validMonthlyPlan = useMemo(() => {
    if (isEditing) return monthlyPlan;

    if (!selectedTrainer || durationMinutes < 15 || durationMinutes > 240) {
      return {};
    }

    const next: MonthlySchedulePlan = {};

    Object.entries(monthlyPlan).forEach(([day, selectedSlots]) => {
      const dayNumber = Number(day);

      if (!dayOccursInInterval(dayNumber, scheduleStartDate, scheduleEndDate)) {
        return;
      }

      const availableStarts = new Set(
        trainerDaySlots(selectedTrainer, dayNumber, durationMinutes)
          .filter((slot) => slot.available)
          .map((slot) => slot.startTime),
      );
      const validSlots = selectedSlots.filter((slot) =>
        availableStarts.has(slot),
      );

      if (validSlots.length > 0) {
        next[day] = validSlots;
      }
    });

    return next;
  }, [
    durationMinutes,
    isEditing,
    monthlyPlan,
    scheduleEndDate,
    scheduleStartDate,
    selectedTrainer,
  ]);

  const toggleMonthlySlot = (
    dayOfWeek: number,
    slotStartTime: string,
    available: boolean,
  ) => {
    if (!available) return;
    if (!dayOccursInInterval(dayOfWeek, scheduleStartDate, scheduleEndDate)) {
      return;
    }

    setMonthlyPlan((current) => {
      const key = String(dayOfWeek);
      const selectedSlots = new Set(current[key] ?? []);

      if (selectedSlots.has(slotStartTime)) {
        selectedSlots.delete(slotStartTime);
      } else {
        selectedSlots.add(slotStartTime);
      }

      const next = { ...current };
      const sortedSlots = Array.from(selectedSlots).sort();

      if (sortedSlots.length > 0) {
        next[key] = sortedSlots;
      } else {
        delete next[key];
      }

      return next;
    });
  };

  const copyMonthlySlots = (targetDay: number, sourceDay: number) => {
    if (!selectedTrainer) return;
    if (!dayOccursInInterval(targetDay, scheduleStartDate, scheduleEndDate)) {
      return;
    }

    setMonthlyPlan((current) => {
      const sourceSlots = current[String(sourceDay)] ?? [];
      const availableStarts = new Set(
        trainerDaySlots(selectedTrainer, targetDay, durationMinutes)
          .filter((slot) => slot.available)
          .map((slot) => slot.startTime),
      );
      const copiedSlots = sourceSlots
        .filter((slot) => availableStarts.has(slot))
        .sort();
      const next = { ...current };

      if (copiedSlots.length > 0) {
        next[String(targetDay)] = copiedSlots;
      } else {
        delete next[String(targetDay)];
      }

      return next;
    });
  };

  return (
    <form onSubmit={onSubmit}>
      <input
        name="mode"
        type="hidden"
        value={isEditing ? "single" : "monthly"}
      />
      {!isEditing ? (
        <input
          name="monthly_schedule_plan"
          type="hidden"
          value={JSON.stringify(validMonthlyPlan)}
        />
      ) : null}
      <div className="px-5 py-5">
        <div className="rounded-sm bg-primary/10 p-3 text-sm text-primary">
          {isEditing ? "Update this occurrence for" : "Create schedules for"}{" "}
          <strong>{detail.title}</strong>.
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-bold md:col-span-2">
            Trainer
            <select
              className={fieldClass}
              disabled={isSaving}
              name="trainer_staff_profile_id"
              onChange={(event) => setSelectedTrainerId(event.target.value)}
              required
              value={selectedTrainerId}
            >
              <option value="">Select a trainer</option>
              {trainers.map((trainer) => (
                <option key={trainer.id} value={trainer.id}>
                  {trainer.display_name} ({label(trainer.staff_status)})
                </option>
              ))}
            </select>
          </label>
          <FormInput
            defaultValue={item?.studio ?? "LAFAM Pilates Studio"}
            label="Studio"
            maxLength={120}
            name="studio"
            required
          />
          <FormInput
            label="Duration (minutes)"
            max={240}
            min={15}
            name="duration_minutes"
            onChange={(event) => setDurationMinutes(Number(event.target.value))}
            required
            type="number"
            value={durationMinutes}
          />
          {isEditing ? (
            <FormInput
              label="Class date"
              name="class_date"
              onChange={(event) => setClassDate(event.target.value)}
              required
              type="date"
              value={classDate}
            />
          ) : null}
          {!isEditing ? (
            <>
              <FormInput
                label="Start date"
                name="start_date"
                onChange={(event) => setScheduleStartDate(event.target.value)}
                required
                type="date"
                value={scheduleStartDate}
              />
              <FormInput
                label="End date"
                min={scheduleStartDate}
                name="end_date"
                onChange={(event) => setScheduleEndDate(event.target.value)}
                required
                type="date"
                value={scheduleEndDate}
              />
            </>
          ) : null}
          {isEditing ? (
            <>
              <TimeSlotPicker
                className="md:col-span-2"
                disabled={isSaving}
                emptyLabel={
                  selectedTrainerId && classDate
                    ? "No trainer availability fits this duration on the selected day."
                    : "Select a trainer and class date to show available time slots."
                }
                name="start_time"
                onChange={setStartTime}
                options={singleSlotsWithCurrent}
                required
                value={startTime}
              />
              <FormInput
                label="Capacity"
                max={100}
                min={1}
                name="capacity"
                onChange={(event) => setCapacity(Number(event.target.value))}
                required
                type="number"
                value={capacity}
              />
            </>
          ) : (
            <FormInput
              label="Default capacity"
              max={100}
              min={1}
              name="capacity"
              onChange={(event) => setCapacity(Number(event.target.value))}
              required
              type="number"
              value={capacity}
            />
          )}
          <FormInput
            label="Price (KWD)"
            min={0}
            name="price_amount"
            onChange={(event) => setPriceAmount(Number(event.target.value))}
            required
            step="0.001"
            type="number"
            value={priceAmount}
          />
          <FormInput
            defaultValue="KWD"
            disabled
            label="Currency"
            readOnly
            type="text"
          />
        </div>

        {!isEditing ? (
          <MonthlySchedulePlanner
            durationMinutes={durationMinutes}
            onCopySlots={copyMonthlySlots}
            onSelectedDayChange={setSelectedScheduleDay}
            onToggleSlot={toggleMonthlySlot}
            plan={validMonthlyPlan}
            scheduleEndDate={scheduleEndDate}
            scheduleStartDate={scheduleStartDate}
            selectedDay={selectedScheduleDay}
            selectedTrainer={selectedTrainer}
          />
        ) : null}
      </div>

      <ModalFooter
        isSaving={isSaving}
        onClose={onClose}
        submitLabel={item ? "Save schedule" : "Create schedule plan"}
      />
    </form>
  );
}

function TimeSlotPicker({
  className,
  disabled,
  emptyLabel,
  name,
  onChange,
  options,
  required,
  value,
}: {
  className?: string;
  disabled?: boolean;
  emptyLabel: string;
  name: string;
  onChange: (value: string) => void;
  options: TimeSlotOption[];
  required?: boolean;
  value: string;
}) {
  const selectedValue = options.some((option) => option.startTime === value)
    ? value
    : "";

  return (
    <fieldset className={`grid gap-2 text-xs font-bold ${className ?? ""}`}>
      <legend>Time slot</legend>
      {options.length > 0 ? (
        <select
          className={fieldClass}
          disabled={disabled}
          name={name}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          value={selectedValue}
        >
          <option value="">Select available time</option>
          {options.map((option) => {
            return (
              <option key={option.startTime} value={option.startTime}>
                {option.label}
              </option>
            );
          })}
        </select>
      ) : (
        <p className="rounded-sm border border-dashed border-background-secondary bg-background px-3 py-3 text-xs font-semibold text-txt-secondary">
          {emptyLabel}
        </p>
      )}
      {required && options.length > 0 ? (
        <span className="font-normal text-txt-secondary">
          Select one available trainer time slot.
        </span>
      ) : null}
    </fieldset>
  );
}

function MonthlySchedulePlanner({
  durationMinutes,
  onCopySlots,
  onSelectedDayChange,
  onToggleSlot,
  plan,
  scheduleEndDate,
  scheduleStartDate,
  selectedDay,
  selectedTrainer,
}: {
  durationMinutes: number;
  onCopySlots: (targetDay: number, sourceDay: number) => void;
  onSelectedDayChange: (value: number) => void;
  onToggleSlot: (
    dayOfWeek: number,
    slotStartTime: string,
    available: boolean,
  ) => void;
  plan: MonthlySchedulePlan;
  scheduleEndDate: string;
  scheduleStartDate: string;
  selectedDay: number;
  selectedTrainer: StaffMember | undefined;
}) {
  const slots = useMemo(
    () => trainerDaySlots(selectedTrainer, selectedDay, durationMinutes),
    [durationMinutes, selectedDay, selectedTrainer],
  );
  const availableSlotCountByDay = useMemo(
    () =>
      Object.fromEntries(
        Array.from({ length: 7 }, (_, day) => [
          day,
          trainerDaySlots(selectedTrainer, day, durationMinutes).filter(
            (slot) => slot.available,
          ).length,
        ]),
      ) as Record<number, number>,
    [durationMinutes, selectedTrainer],
  );
  const selectedDayLabel =
    scheduleWeekDays.find((day) => day.value === selectedDay)?.label ??
    "Selected day";
  const selectedDayIncluded = dayOccursInInterval(
    selectedDay,
    scheduleStartDate,
    scheduleEndDate,
  );
  const selectedStarts = new Set(plan[String(selectedDay)] ?? []);

  return (
    <section className="mt-6 overflow-hidden rounded-sm border border-background-secondary bg-card-bg-primary">
      <header className="border-b border-background-secondary bg-background-secondary/40 px-4 py-4">
        <h3 className="text-lg font-bold text-txt-primary">Schedule days</h3>
      </header>
      <div className="border-b border-background-secondary bg-card-bg-secondary px-4 py-4">
        <div
          aria-label="Select schedule day"
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7"
        >
          {scheduleWeekDays.map((day) => {
            const dayIncluded = dayOccursInInterval(
              day.value,
              scheduleStartDate,
              scheduleEndDate,
            );
            const selectedCount = dayIncluded
              ? (plan[String(day.value)]?.length ?? 0)
              : 0;
            const hasAvailable =
              dayIncluded && availableSlotCountByDay[day.value] > 0;
            const active = selectedDay === day.value;

            return (
              <button
                className={`relative min-h-24 w-full rounded-sm border px-3 py-2 text-left text-black transition ${
                  active && dayIncluded
                    ? "border-primary bg-primary shadow-sm ring-2 ring-primary/30"
                    : active
                      ? "border-warning/40 bg-warning/10 shadow-sm ring-2 ring-warning/20"
                      : dayIncluded
                        ? "border-primary/20 bg-primary/20 hover:bg-primary/30"
                        : "border-background-secondary bg-background text-txt-secondary hover:bg-card-bg-secondary"
                }`}
                key={day.value}
                onClick={() => onSelectedDayChange(day.value)}
                type="button"
              >
                <span className="block text-xs font-bold uppercase text-inherit">
                  {day.shortLabel}
                </span>
                <span className="mt-1 block break-words text-base font-bold leading-tight text-inherit 2xl:text-lg">
                  {day.label}
                </span>
                <span className="mt-2 block text-[11px] font-semibold text-inherit opacity-75">
                  {!dayIncluded
                    ? "Not in interval"
                    : hasAvailable
                      ? `${availableSlotCountByDay[day.value]} available`
                      : "No slots"}
                </span>
                {selectedCount > 0 ? (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {selectedCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      <div className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h4 className="text-sm font-bold text-txt-primary">
            {selectedDayLabel} slots
          </h4>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-bold text-txt-secondary">
              Copy from
              <select
                className="min-h-9 rounded-sm border border-background-secondary bg-card-bg-primary px-2 text-xs text-txt-primary outline-none focus:border-primary"
                disabled={!selectedDayIncluded}
                onChange={(event) => {
                  const sourceDay = Number(event.target.value);

                  if (Number.isInteger(sourceDay)) {
                    onCopySlots(selectedDay, sourceDay);
                  }

                  event.target.value = "";
                }}
                value=""
              >
                <option value="">Select day</option>
                {scheduleWeekDays
                  .filter((day) => day.value !== selectedDay)
                  .map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
              </select>
            </label>
            <span className="text-xs font-semibold text-txt-secondary">
              {selectedStarts.size} selected
            </span>
          </div>
        </div>
        {!selectedDayIncluded ? (
          <p className="rounded-sm border border-dashed border-warning/40 bg-warning/10 px-3 py-3 text-xs font-semibold text-txt-primary">
            {selectedDayLabel} is not included in this date interval.
          </p>
        ) : slots.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {slots.map((slot) => {
              const checked = selectedStarts.has(slot.startTime);

              return (
                <label
                  aria-disabled={!slot.available}
                  className={`flex min-h-12 items-center gap-3 rounded-sm border px-3 py-2 text-sm font-semibold transition ${
                    checked
                      ? "border-primary bg-primary/10 text-primary"
                      : slot.available
                        ? "cursor-pointer border-background-secondary bg-card-bg-primary text-txt-primary hover:bg-card-bg-secondary"
                        : "cursor-not-allowed border-background-secondary bg-background-secondary/45 text-txt-secondary"
                  }`}
                  key={slot.startTime}
                >
                  <input
                    checked={checked}
                    className="size-4 accent-primary disabled:opacity-70"
                    disabled={!slot.available}
                    onChange={() =>
                      onToggleSlot(selectedDay, slot.startTime, slot.available)
                    }
                    type="checkbox"
                  />
                  <span className="text-inherit">{slot.label}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="rounded-sm border border-dashed border-background-secondary bg-background px-3 py-3 text-xs font-semibold text-txt-secondary">
            Select a valid duration to show slots.
          </p>
        )}
      </div>
    </section>
  );
}

function InlineCard({
  children,
  onClose,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <article className="mt-6 overflow-hidden rounded-md border border-background-secondary bg-card-bg-primary text-txt-primary shadow-sm">
      <header className="relative border-b border-background-secondary bg-card-bg-primary px-5 py-5">
        <button
          aria-label="Close card"
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-sm bg-background-secondary text-txt-secondary"
          onClick={onClose}
          type="button"
        >
          X
        </button>
        <h2 className="pr-10 text-2xl font-medium">{title}</h2>
      </header>
      {children}
    </article>
  );
}

function ModalFooter({
  isSaving,
  onClose,
  submitLabel,
}: {
  isSaving: boolean;
  onClose: () => void;
  submitLabel: string;
}) {
  return (
    <footer className="flex justify-start gap-2 border-t border-background-secondary px-5 py-5">
      <button
        className={buttonClass}
        disabled={isSaving}
        onClick={onClose}
        type="button"
      >
        Close
      </button>
      <button
        className="min-h-11 rounded-sm bg-button-primary px-4 py-3 text-xs font-bold text-white disabled:opacity-60"
        disabled={isSaving}
        type="submit"
      >
        {isSaving ? "Saving..." : submitLabel}
      </button>
    </footer>
  );
}

function FormInput({
  className,
  label: inputLabel,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={`grid gap-1.5 text-xs font-bold ${className ?? ""}`}>
      {inputLabel}
      <input className={fieldClass} {...props} />
    </label>
  );
}

function Select({
  defaultValue,
  label: selectLabel,
  name,
  options,
}: {
  defaultValue: string;
  label: string;
  name: string;
  options: string[];
}) {
  return (
    <label className="grid gap-1.5 text-xs font-bold">
      {selectLabel}
      <select className={fieldClass} defaultValue={defaultValue} name={name}>
        {options.map((option) => (
          <option key={option} value={option}>
            {label(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function HeroStat({
  label: statLabel,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-card-bg-secondary p-4">
      <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-txt-secondary">
        {statLabel}
      </dt>
      <dd className="mt-1 text-base font-bold text-txt-primary">{value}</dd>
    </div>
  );
}
