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
} from "@/lib/pilates";
import { Badge } from "./reuseable_ui_components/badge";
import { LoadingState } from "./reuseable_ui_components/loading_state";
import { Toast } from "./reuseable_ui_components/toast";

const fieldClass =
  "min-h-10 w-full rounded-lg border border-background-secondary bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-primary disabled:opacity-60";
const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-background-secondary px-4 py-2 text-xs font-bold transition hover:bg-background-secondary disabled:cursor-not-allowed disabled:opacity-50";
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
    level: String(data.get("level")) as PilatesClassLevel,
    status: String(data.get("status")) as Exclude<PilatesClassStatus, "deleted">,
    ...(image instanceof File && image.size > 0 ? { image } : {}),
  };
}

function schedulePayload(
  form: HTMLFormElement,
  classId: string,
): CreatePilatesSchedulePayload {
  const data = new FormData(form);
  return {
    class_id: classId,
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
    const payload = schedulePayload(event.currentTarget, classId);
    const current = editingSchedule;
    void run(
      () =>
        current
          ? api.updateSchedule(current.id, payload)
          : api.createSchedule(payload),
      current ? "Schedule updated" : "Schedule created",
      current
        ? "The class schedule was updated."
        : "A new schedule was added to this class.",
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
      <nav className="mb-5 text-sm text-text-secondary" aria-label="Breadcrumb">
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
        <Modal onClose={() => setEditingClass(false)} title={`Edit ${detail.title}`}>
          <ClassEditForm detail={detail} isSaving={api.isMutating} onClose={() => setEditingClass(false)} onSubmit={updateClass} />
        </Modal>
      ) : null}

      {creatingSchedule || editingSchedule ? (
        <Modal onClose={() => { setCreatingSchedule(false); setEditingSchedule(null); }} title={editingSchedule ? "Edit schedule" : `Schedule ${detail.title}`}>
          <ScheduleForm
            detail={detail}
            isSaving={api.isMutating}
            item={editingSchedule ?? undefined}
            onClose={() => { setCreatingSchedule(false); setEditingSchedule(null); }}
            onSubmit={saveSchedule}
            trainers={api.trainers}
          />
        </Modal>
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
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-text-primary">{detail.title}</h1>
              <p className="mt-3 text-sm leading-6 text-text-secondary">
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
          <p className="mt-6 border-t border-dashed border-background-secondary py-8 text-center text-sm text-text-secondary">
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
            <span className="text-xs font-semibold text-text-secondary">{item.studio}</span>
          </div>
          <h3 className="mt-3 text-lg font-bold text-text-primary">{formatDate(item.class_date)}</h3>
          <p className="mt-1 text-sm text-text-secondary">
            Trainer: <strong className="text-text-primary">{item.trainer?.display_name ?? "Assigned trainer"}</strong>
          </p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-text-secondary">
            <span><strong className="text-text-primary">{formatTime(item.start_time)} - {formatTime(item.end_time)}</strong> time</span>
            <span><strong className="text-text-primary">{item.duration_minutes} min</strong> duration</span>
            <span><strong className="text-text-primary">{item.availability.booked_count}/{item.capacity}</strong> booked</span>
            <span><strong className="text-text-primary">{item.availability.available_seats}</strong> seats left</span>
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
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
  return (
    <form onSubmit={onSubmit}>
      <div className="mt-4 rounded-lg bg-primary/10 p-3 text-sm text-primary">
        This schedule will be created for <strong>{detail.title}</strong>.
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-xs font-bold sm:col-span-2">Trainer<select className={fieldClass} defaultValue={item?.trainer_staff_profile_id ?? ""} disabled={isSaving} name="trainer_staff_profile_id" required><option value="">Select a trainer</option>{trainers.map((trainer) => <option key={trainer.id} value={trainer.id}>{trainer.display_name} ({label(trainer.staff_status)})</option>)}</select></label>
        <FormInput defaultValue={item?.studio ?? "LAFAM Pilates Studio"} label="Studio" maxLength={120} name="studio" required />
        <FormInput defaultValue={item?.class_date} label="Date" name="class_date" required type="date" />
        <FormInput defaultValue={item?.start_time?.slice(0, 5)} label="Start time" name="start_time" required type="time" />
        <FormInput defaultValue={item?.duration_minutes ?? detail.default_duration_minutes} label="Duration (minutes)" max={240} min={15} name="duration_minutes" required type="number" />
        <FormInput defaultValue={item?.capacity ?? detail.default_capacity} label="Capacity" max={100} min={1} name="capacity" required type="number" />
      </div>
      <ModalFooter isSaving={isSaving} onClose={onClose} submitLabel={item ? "Save schedule" : "Create schedule"} />
    </form>
  );
}

function Modal({ children, onClose, title }: { children: ReactNode; onClose: () => void; title: string }) {
  return <section aria-modal="true" className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4" role="dialog"><button aria-label="Close dialog" className="absolute inset-0" onClick={onClose} type="button" /><article className="relative z-10 my-auto max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-background-secondary bg-card-bg-primary p-6 text-text-primary shadow-2xl"><button aria-label="Close dialog" className="absolute right-4 top-4" onClick={onClose} type="button">X</button><h2 className="pr-10 text-xl font-bold">{title}</h2>{children}</article></section>;
}

function ModalFooter({ isSaving, onClose, submitLabel }: { isSaving: boolean; onClose: () => void; submitLabel: string }) {
  return <footer className="mt-6 flex justify-end gap-2 border-t border-background-secondary pt-4"><button className={buttonClass} disabled={isSaving} onClick={onClose} type="button">Close</button><button className="rounded-lg bg-button-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-60" disabled={isSaving} type="submit">{isSaving ? "Saving..." : submitLabel}</button></footer>;
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
      <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-secondary">{statLabel}</dt>
      <dd className="mt-1 text-base font-bold text-text-primary">{value}</dd>
    </div>
  );
}
