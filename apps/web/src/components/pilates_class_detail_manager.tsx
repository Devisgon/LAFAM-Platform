"use client";

import Link from "next/link";
import {
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  useEffect,
  useState,
} from "react";
import { usePilates } from "@/hooks/usePilates";
import {
  type CreatePilatesClassPayload,
  type CreatePilatesSchedulePayload,
  type PilatesClassDefinition,
  type PilatesClassLevel,
  type PilatesClassStatus,
  type PilatesSchedule,
  type PilatesScheduleStatus,
  type UpdatePilatesSchedulePayload,
} from "@/lib/pilates";
import { Badge } from "./reuseable_ui_components/badge";
import { DataTable } from "./reuseable_ui_components/data_table";
import { LoadingState } from "./reuseable_ui_components/loading_state";
import { Toast } from "./reuseable_ui_components/toast";

const fieldClass =
  "min-h-12 w-full rounded-sm border border-background-secondary bg-card-bg-primary px-3 py-2 text-sm text-txt-primary outline-none focus:border-primary disabled:opacity-60";
const buttonClass =
  "inline-flex min-h-11 items-center justify-center rounded-sm border border-background-secondary px-4 py-2 text-xs font-bold transition hover:bg-background-secondary disabled:cursor-not-allowed disabled:opacity-50";
const detailCacheKey = (classId: string) => `lafam:admin:pilates:class:${classId}`;

function readDetailCache(classId: string): PilatesClassDefinition | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.sessionStorage.getItem(detailCacheKey(classId)) ?? "null") as PilatesClassDefinition | null;
  } catch {
    window.sessionStorage.removeItem(detailCacheKey(classId));
    return null;
  }
}

function writeDetailCache(classId: string, detail: PilatesClassDefinition): void {
  try {
    window.sessionStorage.setItem(detailCacheKey(classId), JSON.stringify(detail));
  } catch {
    // Rendering fresh API data still works when storage is unavailable.
  }
}

function label(value: string): string {
  return value.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

function classTone(status: PilatesClassStatus): "success" | "warning" | "error" {
  if (status === "active") return "success";
  if (status === "deleted") return "error";
  return "warning";
}

function scheduleTone(status: PilatesScheduleStatus): "success" | "warning" | "error" {
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
    : new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(value);
}

function addMinutes(time: string, minutes: number): string {
  const [hours = "0", mins = "0"] = time.split(":");
  const value = new Date("2026-01-01T00:00:00");
  value.setHours(Number(hours), Number(mins) + minutes, 0, 0);
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

function classPayload(form: HTMLFormElement): CreatePilatesClassPayload {
  const data = new FormData(form);
  const image = data.get("image");
  return {
    title: String(data.get("title")).trim(),
    description: String(data.get("description")).trim() || null,
    default_duration_minutes: Number(data.get("default_duration_minutes")),
    default_capacity: Number(data.get("default_capacity")),
    level: String(data.get("level")) as PilatesClassLevel,
    status: String(data.get("status")) as Exclude<PilatesClassStatus, "deleted">,
    ...(image instanceof File && image.size > 0 ? { image } : {}),
  };
}

const weekDays = [
  { label: "Sunday", value: 0 },
  { label: "Monday", value: 1 },
  { label: "Tuesday", value: 2 },
  { label: "Wednesday", value: 3 },
  { label: "Thursday", value: 4 },
  { label: "Friday", value: 5 },
  { label: "Saturday", value: 6 },
] as const;

function excludedDates(data: FormData): string[] {
  return String(data.get("excluded_dates") ?? "")
    .split(/[\n,]/)
    .map((date) => date.trim())
    .filter(Boolean);
}

function createSchedulePayload(
  form: HTMLFormElement,
  classId: string,
): CreatePilatesSchedulePayload {
  const data = new FormData(form);
  const mode = String(data.get("mode"));
  const base = {
    class_id: classId,
    trainer_staff_profile_id: String(data.get("trainer_staff_profile_id")),
    studio: String(data.get("studio")).trim(),
    start_time: String(data.get("start_time")),
    duration_minutes: Number(data.get("duration_minutes")),
    capacity: Number(data.get("capacity")),
  };

  if (mode === "weekly") {
    return {
      ...base,
      mode: "recurring",
      start_date: String(data.get("start_date")),
      end_date: String(data.get("end_date")),
      recurrence: {
        frequency: "weekly",
        days_of_week: data
          .getAll("days_of_week")
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6),
        excluded_dates: excludedDates(data),
      },
    };
  }

  if (mode === "monthly") {
    return {
      ...base,
      mode: "recurring",
      start_date: String(data.get("start_date")),
      end_date: String(data.get("end_date")),
      recurrence: {
        frequency: "monthly",
        monthly_rule: "day_of_month",
        day_of_month: Number(data.get("day_of_month")),
        excluded_dates: excludedDates(data),
      },
    };
  }

  return {
    ...base,
    mode: "single",
    class_date: String(data.get("class_date")),
  };
}

function updateSchedulePayload(form: HTMLFormElement): UpdatePilatesSchedulePayload {
  const data = new FormData(form);
  return {
    trainer_staff_profile_id: String(data.get("trainer_staff_profile_id")),
    studio: String(data.get("studio")).trim(),
    class_date: String(data.get("class_date")),
    start_time: String(data.get("start_time")),
    duration_minutes: Number(data.get("duration_minutes")),
    capacity: Number(data.get("capacity")),
  };
}

export function PilatesClassDetailManager({ classId }: { classId: string }) {
  const api = usePilates();
  const getClass = api.getClass;
  const [cachedDetail] = useState(() => readDetailCache(classId));
  const [detail, setDetail] = useState<PilatesClassDefinition | null>(cachedDetail);
  const [isDetailLoading, setIsDetailLoading] = useState(!cachedDetail);
  const [editingClass, setEditingClass] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<PilatesSchedule | null>(null);
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
            message: error instanceof Error ? error.message : "Class details could not be loaded.",
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

    const payload = createSchedulePayload(event.currentTarget, classId);
    void run(
      () => api.createSchedule(payload),
      "Schedule created",
      "A new schedule was added to this class.",
      () => {
        setEditingSchedule(null);
        setCreatingSchedule(false);
      },
    );
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
    return <LoadingState className="p-6" label="Loading class management page" />;
  }

  if (!detail) {
    return (
      <section className="rounded-xl border border-error/30 bg-error/10 p-6">
        <p className="text-sm text-error">This Pilates class could not be loaded.</p>
        <Link className={`${buttonClass} mt-4`} href="/admin/services/pilates">Back to classes</Link>
      </section>
    );
  }

  return (
    <>
      <nav className="mb-5 text-sm text-txt-secondary" aria-label="Breadcrumb">
        <Link className="inline-flex items-center gap-2 font-semibold text-primary hover:underline" href="/admin/services/pilates">
          <span aria-hidden="true">&larr;</span>
          Back to Pilates classes
        </Link>
      </nav>

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
        <InlineCard onClose={() => setEditingClass(false)} title={`Edit ${detail.title}`}>
          <ClassEditForm detail={detail} isSaving={api.isMutating} onClose={() => setEditingClass(false)} onSubmit={updateClass} />
        </InlineCard>
      ) : null}

      {creatingSchedule || editingSchedule ? (
        <InlineCard onClose={() => { setCreatingSchedule(false); setEditingSchedule(null); }} title={editingSchedule ? "Edit schedule" : `Schedule ${detail.title}`}>
          <ScheduleForm
            detail={detail}
            isSaving={api.isMutating}
            item={editingSchedule ?? undefined}
            onClose={() => { setCreatingSchedule(false); setEditingSchedule(null); }}
            onSubmit={saveSchedule}
            trainers={api.trainers}
          />
        </InlineCard>
      ) : null}

      {toast ? (
        <div className="fixed bottom-4 right-4 z-[90]">
          <Toast onDismiss={() => setToast(null)} title={toast.title} tone={toast.tone}>{toast.message}</Toast>
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
  return (
    <article className="overflow-hidden rounded-3xl border border-background-secondary bg-card-bg-primary shadow-sm">
      <div className="grid lg:grid-cols-[300px_minmax(0,1fr)]">
        {detail.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" className="h-full min-h-64 w-full object-cover" height="512" src={detail.image_url} width="560" />
        ) : (
          <div className="flex min-h-64 items-center justify-center p-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="LAFAM" className="h-auto w-full max-w-56 object-contain" height="320" src="/logo.png" width="320" />
          </div>
        )}
        <div className="flex flex-col p-6 lg:p-8">
          <div className="flex flex-1 flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl">
              <div className="flex flex-wrap gap-2">
                <Badge tone={classTone(detail.status)}>{label(detail.status)}</Badge>
                <Badge tone="info">{label(detail.level)}</Badge>
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-txt-primary">{detail.title}</h1>
              <p className="mt-3 text-sm leading-6 text-txt-secondary">
                {detail.description ?? "No description provided."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className={buttonClass} onClick={onEdit} type="button">Edit class</button>
              <button className="rounded-lg bg-button-primary px-5 py-2 text-xs font-bold text-white shadow-sm shadow-primary/20 disabled:opacity-50" disabled={detail.status !== "active"} onClick={onCreateSchedule} type="button">Add schedule</button>
            </div>
          </div>
          <dl className="mt-8 grid gap-3 sm:grid-cols-3">
            <HeroStat label="Duration" value={`${detail.default_duration_minutes} min`} />
            <HeroStat label="Capacity" value={`${detail.default_capacity} people`} />
            <HeroStat label="Total schedules" value={String(schedules.length)} />
          </dl>
        </div>
      </div>
      <section className="border-t border-background-secondary px-6 py-6 lg:px-8" aria-labelledby="class-schedules-heading">
        
        {schedules.length === 0 ? (
          <p className="mt-6 border-t border-dashed border-background-secondary py-8 text-center text-sm text-txt-secondary">
            No schedules have been created for this class.
          </p>
        ) : (
          <div className="mt-6 divide-y divide-background-secondary border-t border-background-secondary">
            {schedules.map((item) => (
              <ScheduleRow
                item={item}
                key={item.id}
                onCancel={() => onCancelSchedule(item)}
                onComplete={() => onCompleteSchedule(item)}
                onDelete={() => onDeleteSchedule(item)}
                onEdit={() => onEditSchedule(item)}
              />
            ))}
          </div>
        )}
      </section>
    </article>
  );
}

function ScheduleRow({
  item,
  onCancel,
  onComplete,
  onDelete,
  onEdit,
}: {
  item: PilatesSchedule;
  onCancel: () => void;
  onComplete: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const active = item.status === "scheduled";
  return (
    <article className="py-5">
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={scheduleTone(item.status)}>{label(item.status)}</Badge>
            <span className="text-xs font-semibold text-txt-secondary">{item.studio}</span>
          </div>
          <h3 className="mt-3 text-lg font-bold text-txt-primary">{formatDate(item.class_date)}</h3>
          <p className="mt-1 text-sm text-txt-secondary">
            Trainer: <strong className="text-txt-primary">{item.trainer?.display_name ?? "Assigned trainer"}</strong>
          </p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-txt-secondary">
            <span><strong className="text-txt-primary">{formatTime(item.start_time)} - {formatTime(item.end_time)}</strong> time</span>
            <span><strong className="text-txt-primary">{item.duration_minutes} min</strong> duration</span>
            <span><strong className="text-txt-primary">{item.availability.booked_count}/{item.capacity}</strong> booked</span>
            <span><strong className="text-txt-primary">{item.availability.available_seats}</strong> seats left</span>
          </div>
          {item.cancellation_reason ? <p className="mt-3 text-xs text-error">{item.cancellation_reason}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2 md:max-w-64 md:justify-end">
          <button className={buttonClass} disabled={!active} onClick={onEdit} type="button">Reschedule</button>
          <button className={buttonClass} disabled={!active} onClick={onComplete} type="button">Complete</button>
          <button className={`${buttonClass} text-error`} disabled={!active} onClick={onCancel} type="button">Cancel</button>
          <button className={`${buttonClass} text-error`} onClick={onDelete} type="button">Delete</button>
        </div>
      </div>
    </article>
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
        <FormInput className="sm:col-span-2" defaultValue={detail.title} label="Class title" maxLength={160} name="title" required />
        <label className="grid gap-1.5 text-xs font-bold sm:col-span-2">Description<textarea className={`${fieldClass} min-h-24 resize-y`} defaultValue={detail.description ?? ""} maxLength={2000} name="description" /></label>
        <FormInput defaultValue={detail.default_duration_minutes} label="Default duration (minutes)" max={240} min={15} name="default_duration_minutes" required type="number" />
        <FormInput defaultValue={detail.default_capacity} label="Default capacity" max={100} min={1} name="default_capacity" required type="number" />
        <Select defaultValue={detail.level} label="Level" name="level" options={["beginner", "intermediate", "advanced", "all_levels"]} />
        <Select defaultValue={detail.status} label="Status" name="status" options={["draft", "active", "inactive"]} />
        <label className="grid gap-1.5 text-xs font-bold sm:col-span-2">Replace cover image<input accept="image/jpeg,image/png,image/webp" className={fieldClass} name="image" type="file" /></label>
      </div>
      <ModalFooter isSaving={isSaving} onClose={onClose} submitLabel="Save class" />
    </form>
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
  trainers: Array<{ id: string; display_name: string; staff_status: string }>;
}) {
  const isEditing = Boolean(item);
  const [mode, setMode] = useState<"single" | "weekly" | "monthly">("single");
  const [selectedWeekDays, setSelectedWeekDays] = useState<number[]>([1, 3, 5]);
  const [activeWeekDay, setActiveWeekDay] = useState(2);
  const [activeMonthDay, setActiveMonthDay] = useState(22);
  const [copySource, setCopySource] = useState(1);
  const [startTime, setStartTime] = useState(item?.start_time?.slice(0, 5) ?? "10:00");
  const [durationMinutes, setDurationMinutes] = useState(item?.duration_minutes ?? detail.default_duration_minutes);
  const [capacity, setCapacity] = useState(item?.capacity ?? detail.default_capacity);
  const scheduleDate = item?.class_date ?? "";

  const selectWeekDay = (day: number) => {
    setActiveWeekDay(day);
    setSelectedWeekDays((current) =>
      current.includes(day) ? current : [...current, day].sort((a, b) => a - b),
    );
  };

  const toggleActiveWeekDay = () => {
    setSelectedWeekDays((current) =>
      current.includes(activeWeekDay)
        ? current.length === 1
          ? current
          : current.filter((value) => value !== activeWeekDay)
        : [...current, activeWeekDay].sort((a, b) => a - b),
    );
  };

  const copyFormat = () => {
    if (mode === "weekly") {
      setSelectedWeekDays((current) =>
        current.includes(copySource)
          ? current
          : [...current, copySource].sort((a, b) => a - b),
      );
      setActiveWeekDay(copySource);
      return;
    }

    setActiveMonthDay(copySource);
  };

  return (
    <form onSubmit={onSubmit}>
      <input name="mode" type="hidden" value={mode} />
      {!isEditing && mode === "weekly"
        ? selectedWeekDays.map((day) => (
            <input key={day} name="days_of_week" type="hidden" value={day} />
          ))
        : null}
      {!isEditing && mode === "monthly" ? (
        <input name="day_of_month" type="hidden" value={activeMonthDay} />
      ) : null}

      <div className="px-5 py-5">
        <div className="rounded-sm bg-primary/10 p-3 text-sm text-primary">
          {isEditing ? "Update this occurrence for" : "Create schedules for"}{" "}
          <strong>{detail.title}</strong>.
        </div>

        {!isEditing ? (
          <fieldset className="mt-5">
            <legend className="text-xs font-bold">Schedule type</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3" role="list">
              <ScheduleModeButton
                active={mode === "single"}
                description="One bookable class"
                label="One occurrence"
                onClick={() => setMode("single")}
              />
              <ScheduleModeButton
                active={mode === "weekly"}
                description="Repeat on selected days"
                label="Weekly recurring"
                onClick={() => setMode("weekly")}
              />
              <ScheduleModeButton
                active={mode === "monthly"}
                description="Repeat every month"
                label="Monthly recurring"
                onClick={() => setMode("monthly")}
              />
            </div>
          </fieldset>
        ) : null}

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-bold md:col-span-2">Trainer<select className={fieldClass} defaultValue={item?.trainer_staff_profile_id ?? ""} disabled={isSaving} name="trainer_staff_profile_id" required><option value="">Select a trainer</option>{trainers.map((trainer) => <option key={trainer.id} value={trainer.id}>{trainer.display_name} ({label(trainer.staff_status)})</option>)}</select></label>
          <FormInput defaultValue={item?.studio ?? "LAFAM Pilates Studio"} label="Studio" maxLength={120} name="studio" required />
          {isEditing || mode === "single" ? (
            <FormInput defaultValue={scheduleDate} label="Class date" name="class_date" required type="date" />
          ) : (
            <>
              <FormInput label="Start date" name="start_date" required type="date" />
              <FormInput label="End date" name="end_date" required type="date" />
            </>
          )}
          <FormInput label="Start time" name="start_time" onChange={(event) => setStartTime(event.target.value)} required type="time" value={startTime} />
          <FormInput label="Duration (minutes)" max={240} min={15} name="duration_minutes" onChange={(event) => setDurationMinutes(Number(event.target.value))} required type="number" value={durationMinutes} />
          <FormInput label="Capacity" max={100} min={1} name="capacity" onChange={(event) => setCapacity(Number(event.target.value))} required type="number" value={capacity} />
        </div>

        {!isEditing && mode !== "single" ? (
          <RecurringDayPlanner
            activeMonthDay={activeMonthDay}
            activeWeekDay={activeWeekDay}
            capacity={capacity}
            copyFormat={copyFormat}
            copySource={copySource}
            durationMinutes={durationMinutes}
            mode={mode}
            onCopySourceChange={setCopySource}
            onMonthDaySelect={setActiveMonthDay}
            onToggleActiveWeekDay={toggleActiveWeekDay}
            onWeekDaySelect={selectWeekDay}
            selectedWeekDays={selectedWeekDays}
            startTime={startTime}
          />
        ) : null}

        {!isEditing && mode !== "single" ? (
          <label className="mt-5 grid gap-1.5 text-xs font-bold">
            Excluded dates
            <textarea
              className={`${fieldClass} min-h-20 resize-y`}
              name="excluded_dates"
              placeholder="2026-07-01, 2026-08-14"
            />
            <span className="font-normal text-txt-secondary">
              Separate blackout dates with commas or new lines.
            </span>
          </label>
        ) : null}
      </div>

      <ModalFooter
        isSaving={isSaving}
        onClose={onClose}
        submitLabel={
          item
            ? "Save schedule"
            : mode === "weekly"
              ? "Create weekly schedules"
              : mode === "monthly"
                ? "Create monthly schedules"
                : "Create schedule"
        }
      />
    </form>
  );
}

function ScheduleModeButton({
  active,
  description,
  label: buttonLabel,
  onClick,
}: {
  active: boolean;
  description: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`min-h-20 rounded-xl border p-3 text-left transition ${
        active
          ? "border-primary bg-primary/10 text-primary shadow-sm"
          : "border-background-secondary bg-background text-txt-primary hover:bg-card-bg-secondary"
      }`}
      onClick={onClick}
      type="button"
    >
      <span className="block text-sm font-bold">{buttonLabel}</span>
      <span className="mt-1 block text-xs text-txt-secondary">{description}</span>
    </button>
  );
}

function RecurringDayPlanner({
  activeMonthDay,
  activeWeekDay,
  capacity,
  copyFormat,
  copySource,
  durationMinutes,
  mode,
  onCopySourceChange,
  onMonthDaySelect,
  onToggleActiveWeekDay,
  onWeekDaySelect,
  selectedWeekDays,
  startTime,
}: {
  activeMonthDay: number;
  activeWeekDay: number;
  capacity: number;
  copyFormat: () => void;
  copySource: number;
  durationMinutes: number;
  mode: "weekly" | "monthly";
  onCopySourceChange: (value: number) => void;
  onMonthDaySelect: (value: number) => void;
  onToggleActiveWeekDay: () => void;
  onWeekDaySelect: (value: number) => void;
  selectedWeekDays: number[];
  startTime: string;
}) {
  const monthlyDays = Array.from({ length: 31 }, (_, index) => index + 1);
  const activeLabel =
    mode === "weekly"
      ? (weekDays.find((day) => day.value === activeWeekDay)?.label ?? "Selected day")
      : `Day ${activeMonthDay}`;
  const isActiveIncluded =
    mode === "monthly" || selectedWeekDays.includes(activeWeekDay);
  const endTime = addMinutes(startTime, Number.isFinite(durationMinutes) ? durationMinutes : 0);
  const copyOptions =
    mode === "weekly"
      ? weekDays.map((day) => ({ label: day.label, value: day.value }))
      : monthlyDays.map((day) => ({ label: `Day ${day}`, value: day }));

  return (
    <section className="mt-6 overflow-hidden rounded-sm border border-background-secondary bg-card-bg-primary">
      <div className="overflow-x-auto border-b border-background-secondary bg-background-secondary/40">
        <div className="flex min-w-max">
          {mode === "weekly"
            ? weekDays.map((day) => {
                const selected = selectedWeekDays.includes(day.value);
                const active = activeWeekDay === day.value;
                return (
                  <button
                    className={`min-h-12 min-w-32 border-r border-background-secondary px-4 text-sm transition ${
                      active
                        ? "border-t-2 border-t-button-primary bg-card-bg-primary text-txt-primary"
                        : selected
                          ? "bg-primary/10 text-primary"
                          : "text-txt-secondary hover:bg-card-bg-primary"
                    }`}
                    key={day.value}
                    onClick={() => onWeekDaySelect(day.value)}
                    type="button"
                  >
                    {day.label}
                  </button>
                );
              })
            : monthlyDays.map((day) => (
                <button
                  className={`min-h-12 min-w-14 border-r border-background-secondary px-3 text-sm transition ${
                    activeMonthDay === day
                      ? "border-t-2 border-t-button-primary bg-card-bg-primary text-txt-primary"
                      : "text-txt-secondary hover:bg-card-bg-primary"
                  }`}
                  key={day}
                  onClick={() => onMonthDaySelect(day)}
                  type="button"
                >
                  {day}
                </button>
              ))}
        </div>
      </div>

      <div className="m-4 flex flex-col gap-4 rounded-sm bg-[#e9caca] p-4 text-white md:flex-row md:items-center md:justify-between">
        <p className="text-xl font-medium">
          Do you want to copy this schedule format from another day?
        </p>
        <div className="flex shrink-0">
          <select
            aria-label="Copy schedule format from"
            className="min-h-11 rounded-l-sm border border-background-secondary bg-card-bg-primary px-4 text-sm text-txt-primary outline-none"
            onChange={(event) => onCopySourceChange(Number(event.target.value))}
            value={copySource}
          >
            {copyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            className="min-h-11 rounded-r-sm bg-black px-5 text-sm font-bold text-white"
            onClick={copyFormat}
            type="button"
          >
            Copy
          </button>
        </div>
      </div>

      <div className="mx-4 flex flex-col gap-3 rounded-sm bg-black p-4 text-white md:flex-row md:items-center md:justify-between">
        <h3 className="text-xl font-medium">{mode === "weekly" ? "Set Weekly Time Slot" : "Set Monthly Time Slot"}</h3>
        <div className="flex overflow-hidden rounded-sm">
          <span className="flex min-h-11 items-center bg-background-secondary px-4 text-sm font-semibold text-txt-primary">
            Capacity
          </span>
          <span className="flex min-h-11 min-w-28 items-center bg-card-bg-primary px-4 text-sm font-semibold text-txt-primary">
            {capacity || 0}
          </span>
        </div>
      </div>

      <div>
        <DataTable
          bodyClassName=""
          className="border-0"
          columnHeaderClassName="border-l border-background-secondary px-1 py-2 font-bold first:border-l-0"
          columns={[
            { className: "w-16", key: "selected", heading: <span className="sr-only">Selected</span> },
            { key: "day", heading: "Day" },
            { key: "start", heading: "Start" },
            { key: "end", heading: "End" },
            { key: "capacity", heading: "Capacity" },
            { key: "action", heading: "Action" },
          ]}
          headerRowClassName="border-b-2 border-txt-primary"
          minWidthClassName="min-w-[760px]"
          textSizeClassName="text-sm"
          wrapperClassName="overflow-x-auto px-4 pb-4 pt-4"
        >
          <tr className="border-b border-background-secondary bg-background-secondary/60">
            <td className="px-1 py-2">
              <input
                checked={isActiveIncluded}
                className="size-5 accent-primary"
                onChange={mode === "weekly" ? onToggleActiveWeekDay : undefined}
                readOnly={mode === "monthly"}
                type="checkbox"
              />
            </td>
            <td className="border-l border-background-secondary px-1 py-3 font-semibold">
              {activeLabel}
            </td>
            <td className="border-l border-background-secondary px-1 py-3">
              {formatTime(startTime)}
            </td>
            <td className="border-l border-background-secondary px-1 py-3">
              {formatTime(endTime)}
            </td>
            <td className="border-l border-background-secondary px-1 py-3">
              {capacity || 0}
            </td>
            <td className="border-l border-background-secondary px-1 py-3">
              <button
                aria-pressed={isActiveIncluded}
                className={`relative inline-flex h-7 w-14 rounded-full transition ${
                  isActiveIncluded ? "bg-[#e9caca]" : "bg-background-secondary"
                }`}
                onClick={mode === "weekly" ? onToggleActiveWeekDay : undefined}
                type="button"
              >
                <span
                  className={`absolute top-1 size-5 rounded-full bg-card-bg-primary shadow transition ${
                    isActiveIncluded ? "left-8" : "left-1"
                  }`}
                />
              </button>
            </td>
          </tr>
        </DataTable>
        <p className="mt-3 text-xs text-txt-secondary">
          {mode === "weekly"
            ? "Selected weekday tabs will receive this same schedule."
            : "Choose the monthly day tab that should receive this schedule."}
        </p>
      </div>
    </section>
  );
}

function InlineCard({ children, onClose, title }: { children: ReactNode; onClose: () => void; title: string }) {
  return <article className="mt-6 overflow-hidden rounded-md border border-background-secondary bg-card-bg-primary text-txt-primary shadow-sm"><header className="relative border-b border-background-secondary bg-card-bg-primary px-5 py-5"><button aria-label="Close card" className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-sm bg-background-secondary text-txt-secondary" onClick={onClose} type="button">X</button><h2 className="pr-10 text-2xl font-medium">{title}</h2></header>{children}</article>;
}

function ModalFooter({ isSaving, onClose, submitLabel }: { isSaving: boolean; onClose: () => void; submitLabel: string }) {
  return <footer className="flex justify-start gap-2 border-t border-background-secondary px-5 py-5"><button className={buttonClass} disabled={isSaving} onClick={onClose} type="button">Close</button><button className="min-h-11 rounded-sm bg-button-primary px-4 py-3 text-xs font-bold text-white disabled:opacity-60" disabled={isSaving} type="submit">{isSaving ? "Saving..." : submitLabel}</button></footer>;
}

function FormInput({ className, label: inputLabel, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className={`grid gap-1.5 text-xs font-bold ${className ?? ""}`}>{inputLabel}<input className={fieldClass} {...props} /></label>;
}

function Select({ defaultValue, label: selectLabel, name, options }: { defaultValue: string; label: string; name: string; options: string[] }) {
  return <label className="grid gap-1.5 text-xs font-bold">{selectLabel}<select className={fieldClass} defaultValue={defaultValue} name={name}>{options.map((option) => <option key={option} value={option}>{label(option)}</option>)}</select></label>;
}

function HeroStat({ label: statLabel, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card-bg-secondary p-4">
      <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-txt-secondary">{statLabel}</dt>
      <dd className="mt-1 text-base font-bold text-txt-primary">{value}</dd>
    </div>
  );
}
