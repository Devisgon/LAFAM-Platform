"use client";

import Link from "next/link";
import {
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  useEffect,
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
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/data-display/LoadingState";
import { Toast } from "@/components/ui/Toast";

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

  if (mode === "weekly") {
    const selectedDays = data
      .getAll("days_of_week")
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);

    return selectedDays.map((day) => {
      const startTime = String(data.get(`weekly_start_time_${day}`));
      const durationMinutes = Number(data.get(`weekly_duration_${day}`));
      const capacity = Number(data.get(`weekly_capacity_${day}`));

      return {
        ...common,
        mode: "recurring",
        start_date: String(data.get("start_date")),
        end_date: String(data.get("end_date")),
        start_time: startTime,
        duration_minutes: durationMinutes,
        capacity,
        time_slots: [
          {
            start_time: startTime,
            duration_minutes: durationMinutes,
            capacity,
            studio: common.studio,
          },
        ],
        recurrence: {
          frequency: "weekly",
          days_of_week: [day],
          excluded_dates: excludedDates(data),
        },
      };
    });
  }

  return [
    {
      ...common,
      mode: "single",
      class_date: String(data.get("class_date")),
      start_time: String(data.get("start_time")),
      duration_minutes: Number(data.get("duration_minutes")),
      capacity: Number(data.get("capacity")),
    },
  ];
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
    price_amount: Number(data.get("price_amount")),
    currency: "KWD",
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
        <Link className={`${buttonClass} mt-4`} href="/services/pilates">Back to classes</Link>
      </section>
    );
  }

  return (
    <>
      <nav className="mb-5 text-sm text-txt-secondary" aria-label="Breadcrumb">
        <Link className="inline-flex items-center gap-2 font-semibold text-primary hover:underline" href="/services/pilates">
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
          <dl className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <HeroStat label="Duration" value={`${detail.default_duration_minutes} min`} />
            <HeroStat label="Capacity" value={`${detail.default_capacity} people`} />
            <HeroStat label="Price per booking" value={`${detail.default_price_amount.toFixed(3)} ${detail.currency}`} />
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
            <span><strong className="text-txt-primary">{(item.price_amount ?? 0).toFixed(3)} {item.currency ?? "KWD"}</strong> price</span>
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
        <FormInput defaultValue={detail.default_price_amount} label="Price per booking (KWD)" min={0} name="default_price_amount" required step="0.001" type="number" />
        <FormInput defaultValue={detail.currency} disabled label="Currency" readOnly type="text" />
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
  const [mode, setMode] = useState<"single" | "weekly">("single");
  const [selectedWeekDays, setSelectedWeekDays] = useState<number[]>([1, 3, 5]);
  const [startTime, setStartTime] = useState(item?.start_time?.slice(0, 5) ?? "10:00");
  const [durationMinutes, setDurationMinutes] = useState(item?.duration_minutes ?? detail.default_duration_minutes);
  const [capacity, setCapacity] = useState(item?.capacity ?? detail.default_capacity);
  const [priceAmount, setPriceAmount] = useState(item?.price_amount ?? detail.default_price_amount);
  const [weeklySlots, setWeeklySlots] = useState(() =>
    Object.fromEntries(
      weekDays.map((day, index) => [
        day.value,
        {
          startTime: `${String(9 + index).padStart(2, "0")}:00`,
          durationMinutes: detail.default_duration_minutes,
          capacity: detail.default_capacity,
        },
      ]),
    ) as Record<number, { startTime: string; durationMinutes: number; capacity: number }>,
  );
  const scheduleDate = item?.class_date ?? "";

  const toggleWeekDay = (day: number) => {
    setSelectedWeekDays((current) =>
      current.includes(day)
        ? current.length === 1
          ? current
          : current.filter((value) => value !== day)
        : [...current, day].sort((a, b) => a - b),
    );
  };

  const updateWeeklySlot = (
    day: number,
    patch: Partial<{ startTime: string; durationMinutes: number; capacity: number }>,
  ) => {
    setWeeklySlots((current) => ({
      ...current,
      [day]: { ...current[day], ...patch },
    }));
  };

  return (
    <form onSubmit={onSubmit}>
      <input name="mode" type="hidden" value={mode} />
      <div className="px-5 py-5">
        <div className="rounded-sm bg-primary/10 p-3 text-sm text-primary">
          {isEditing ? "Update this occurrence for" : "Create schedules for"}{" "}
          <strong>{detail.title}</strong>.
        </div>

        {!isEditing ? (
          <fieldset className="mt-5">
            <legend className="text-xs font-bold">Schedule type</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2" role="list">
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
          {isEditing || mode === "single" ? (
            <>
              <FormInput label="Start time" name="start_time" onChange={(event) => setStartTime(event.target.value)} required type="time" value={startTime} />
              <FormInput label="Duration (minutes)" max={240} min={15} name="duration_minutes" onChange={(event) => setDurationMinutes(Number(event.target.value))} required type="number" value={durationMinutes} />
              <FormInput label="Capacity" max={100} min={1} name="capacity" onChange={(event) => setCapacity(Number(event.target.value))} required type="number" value={capacity} />
            </>
          ) : null}
          <FormInput label="Price (KWD)" min={0} name="price_amount" onChange={(event) => setPriceAmount(Number(event.target.value))} required step="0.001" type="number" value={priceAmount} />
          <FormInput defaultValue="KWD" disabled label="Currency" readOnly type="text" />
        </div>

        {!isEditing && mode === "weekly" ? (
          <WeeklyDayPlanner
            onToggleDay={toggleWeekDay}
            onUpdateSlot={updateWeeklySlot}
            selectedWeekDays={selectedWeekDays}
            slots={weeklySlots}
          />
        ) : null}

        {!isEditing && mode === "weekly" ? (
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

function WeeklyDayPlanner({
  onToggleDay,
  onUpdateSlot,
  selectedWeekDays,
  slots,
}: {
  onToggleDay: (day: number) => void;
  onUpdateSlot: (
    day: number,
    patch: Partial<{
      startTime: string;
      durationMinutes: number;
      capacity: number;
    }>,
  ) => void;
  selectedWeekDays: number[];
  slots: Record<
    number,
    { startTime: string; durationMinutes: number; capacity: number }
  >;
}) {
  return (
    <section className="mt-6 overflow-hidden rounded-sm border border-background-secondary bg-card-bg-primary">
      <header className="border-b border-background-secondary bg-background-secondary/40 px-4 py-4">
        <h3 className="text-lg font-bold text-txt-primary">
          Weekly day and time settings
        </h3>
        <p className="mt-1 text-xs text-txt-secondary">
          Select the weekdays and set a different start time, duration, and
          capacity for each day.
        </p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-background-secondary text-xs uppercase text-txt-secondary">
            <tr>
              <th className="px-4 py-3">Use</th>
              <th className="px-4 py-3">Day</th>
              <th className="px-4 py-3">Start time</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">Capacity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-background-secondary">
            {weekDays.map((day) => {
              const selected = selectedWeekDays.includes(day.value);
              const slot = slots[day.value];

              return (
                <tr className={selected ? "bg-primary/5" : "opacity-60"} key={day.value}>
                  <td className="px-4 py-3">
                    <input
                      aria-label={`Include ${day.label}`}
                      checked={selected}
                      className="size-5 accent-primary"
                      name="days_of_week"
                      onChange={() => onToggleDay(day.value)}
                      type="checkbox"
                      value={day.value}
                    />
                  </td>
                  <td className="px-4 py-3 font-semibold text-txt-primary">{day.label}</td>
                  <td className="px-4 py-3">
                    <input
                      aria-label={`${day.label} start time`}
                      className={fieldClass}
                      disabled={!selected}
                      name={`weekly_start_time_${day.value}`}
                      onChange={(event) => onUpdateSlot(day.value, { startTime: event.target.value })}
                      required={selected}
                      type="time"
                      value={slot.startTime}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      aria-label={`${day.label} duration`}
                      className={fieldClass}
                      disabled={!selected}
                      max={240}
                      min={15}
                      name={`weekly_duration_${day.value}`}
                      onChange={(event) => onUpdateSlot(day.value, { durationMinutes: Number(event.target.value) })}
                      required={selected}
                      type="number"
                      value={slot.durationMinutes}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      aria-label={`${day.label} capacity`}
                      className={fieldClass}
                      disabled={!selected}
                      max={100}
                      min={1}
                      name={`weekly_capacity_${day.value}`}
                      onChange={(event) => onUpdateSlot(day.value, { capacity: Number(event.target.value) })}
                      required={selected}
                      type="number"
                      value={slot.capacity}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
