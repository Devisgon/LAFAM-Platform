"use client";

import Link from "next/link";
import {
  type FormEvent,
  type InputHTMLAttributes,
  useState,
} from "react";
import { usePilates } from "@/hooks/usePilates";
import {
  type CreatePilatesClassPayload,
  type PilatesClassDefinition,
  type PilatesClassLevel,
  type PilatesClassStatus,
} from "@/lib/pilates";
import { Badge } from "./reuseable_ui_components/badge";
import { LoadingState } from "./reuseable_ui_components/loading_state";
import { Toast } from "./reuseable_ui_components/toast";

const fieldClass =
  "min-h-10 w-full rounded-lg border border-background-secondary bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-primary disabled:opacity-60";
const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-background-secondary px-4 py-2 text-xs font-bold transition hover:bg-background-secondary";

function label(value: string): string {
  return value.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

function statusTone(status: PilatesClassStatus): "success" | "warning" | "error" {
  if (status === "active") return "success";
  if (status === "deleted") return "error";
  return "warning";
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

export function PilatesClassManager() {
  const api = usePilates();
  const [toast, setToast] = useState<{
    message: string;
    title: string;
    tone: "success" | "error";
  } | null>(null);

  const createClass = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const created = await api.createClass(classPayload(form));
      form.reset();
      window.history.replaceState(null, "", window.location.pathname);
      setToast({
        message: `${created.title} is ready to manage and schedule.`,
        title: "Class created",
        tone: "success",
      });
    } catch (error: unknown) {
      setToast({
        message: error instanceof Error ? error.message : "The class could not be created.",
        title: "Class not created",
        tone: "error",
      });
    }
  };

  if (api.isLoading) {
    return <LoadingState className="p-6" label="Loading Pilates classes" />;
  }

  return (
    <>
      <section className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-text-secondary">
            {api.classes.length} class definitions ·{" "}
            {api.classes.filter((item) => item.status === "active").length} active
          </p>
        </div>
      </section>

      {api.error ? (
        <section className="mb-5 rounded-xl border border-error/30 bg-error/10 p-4">
          <p className="text-sm text-error" role="alert">{api.error}</p>
          <button className={`${buttonClass} mt-3`} onClick={() => void api.load()} type="button">Try again</button>
        </section>
      ) : null}

      <section className="grid gap-5" aria-labelledby="pilates-classes-heading">
        <h2 className="sr-only" id="pilates-classes-heading">Pilates classes</h2>
        {api.classes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-background-secondary bg-card-bg-primary p-10 text-center text-sm text-text-secondary">
            Create your first Pilates class.
          </div>
        ) : (
          api.classes.map((item) => <ClassListCard item={item} key={item.id} />)
        )}
      </section>

      <section aria-labelledby="create-class-title" aria-modal="true" className="fixed inset-0 z-50 hidden items-center justify-center overflow-y-auto bg-slate-950/60 p-4 target:flex" id="create-class" role="dialog">
        <a aria-label="Close create class form" className="absolute inset-0" href="#pilates-classes-heading" />
        <article className="relative z-10 my-auto w-full max-w-2xl rounded-2xl border border-background-secondary bg-card-bg-primary p-6 text-text-primary shadow-2xl">
          <a aria-label="Close create class form" className="absolute right-4 top-4" href="#pilates-classes-heading">X</a>
          <h2 className="text-xl font-bold" id="create-class-title">Create Pilates class</h2>
          <form onSubmit={createClass}>
            <p className="mt-1 text-sm text-text-secondary">
              After creation, open the class page to edit it and add schedules.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <FormInput className="sm:col-span-2" label="Class title" maxLength={160} name="title" required />
              <label className="grid gap-1.5 text-xs font-bold sm:col-span-2">
                Description
                <textarea className={`${fieldClass} min-h-24 resize-y`} maxLength={2000} name="description" />
              </label>
              <FormInput defaultValue={60} label="Default duration (minutes)" max={240} min={15} name="default_duration_minutes" required type="number" />
              <FormInput defaultValue={8} label="Default capacity" max={100} min={1} name="default_capacity" required type="number" />
              <Select defaultValue="all_levels" label="Level" name="level" options={["beginner", "intermediate", "advanced", "all_levels"]} />
              <Select defaultValue="active" label="Status" name="status" options={["draft", "active", "inactive"]} />
              <label className="grid gap-1.5 text-xs font-bold sm:col-span-2">
                Cover image
                <input accept="image/jpeg,image/png,image/webp" className={fieldClass} name="image" type="file" />
              </label>
            </div>
            <footer className="mt-6 flex justify-end gap-2 border-t border-background-secondary pt-4">
              <a className={buttonClass} href="#pilates-classes-heading">Cancel</a>
              <button className="rounded-lg bg-button-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-60" disabled={api.isMutating} type="submit">
                {api.isMutating ? "Creating..." : "Create class"}
              </button>
            </footer>
          </form>
        </article>
      </section>

      {toast ? (
        <div className="fixed right-4 top-4 z-[90]">
          <Toast onDismiss={() => setToast(null)} title={toast.title} tone={toast.tone}>{toast.message}</Toast>
        </div>
      ) : null}
    </>
  );
}

function ClassListCard({ item }: { item: PilatesClassDefinition }) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-background-secondary bg-card-bg-primary shadow-sm before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-primary">
      <div className="grid gap-5 p-5 pl-6 sm:grid-cols-[168px_minmax(0,1fr)_auto] sm:items-center">
        <div className="overflow-hidden rounded-lg bg-primary/10">
          {item.image_url ? (
            // Runtime storage URLs should not require a broad Next image host allowlist.
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" className="h-28 w-full object-cover" decoding="async" height="224" loading="lazy" src={item.image_url} width="336" />
          ) : (
            <div className="flex h-28 items-center justify-center text-sm font-bold text-primary">Pilates</div>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(item.status)}>{label(item.status)}</Badge>
            <span className="text-xs text-text-secondary">◇ Pilates</span>
          </div>
          <h3 className="mt-2 text-xl font-bold text-text-primary">{item.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-text-secondary">
            {item.description ?? "No description provided."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-text-primary">
            <span className="rounded-lg bg-primary/10 px-3 py-2">◷ {item.default_duration_minutes} minutes</span>
            <span className="rounded-lg bg-primary/10 px-3 py-2">♙ {item.default_capacity} capacity</span>
            <span className="rounded-lg bg-primary/10 px-3 py-2">Level: {label(item.level)}</span>
          </div>
        </div>
        <Link className="inline-flex min-h-10 items-center justify-center rounded-lg bg-button-primary px-5 py-2 text-sm font-bold text-white transition hover:opacity-90" href={`/admin/services/pilates/${item.id}`}>
          Manage class
        </Link>
      </div>
    </article>
  );
}

function FormInput({ className, label: inputLabel, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className={`grid gap-1.5 text-xs font-bold ${className ?? ""}`}>{inputLabel}<input className={fieldClass} {...props} /></label>;
}

function Select({ defaultValue, label: selectLabel, name, options }: { defaultValue: string; label: string; name: string; options: string[] }) {
  return <label className="grid gap-1.5 text-xs font-bold">{selectLabel}<select className={fieldClass} defaultValue={defaultValue} name={name}>{options.map((option) => <option key={option} value={option}>{label(option)}</option>)}</select></label>;
}
