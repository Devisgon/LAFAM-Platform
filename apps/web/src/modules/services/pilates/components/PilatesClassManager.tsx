"use client";

import {
  type FormEvent,
  type InputHTMLAttributes,
  useEffect,
  useState,
} from "react";
import { usePilates } from "@/modules/services/pilates";
import {
  type CreatePilatesClassPayload,
  type PilatesClassLevel,
  type PilatesClassStatus,
} from "@/modules/services/pilates";
import { ClassCard } from "@/components/data-display/ClassCard";
import { LoadingState } from "@/components/data-display/LoadingState";
import { Toast } from "@/components/ui/Toast";

const fieldClass =
  "min-h-12 w-full rounded-sm border border-background-secondary bg-card-bg-primary px-3 py-2 text-sm text-txt-primary outline-none focus:border-primary disabled:opacity-60";
const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-background-secondary px-4 py-2 text-xs font-bold transition hover:bg-background-secondary";

function label(value: string): string {
  return value.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
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
    currency: "KWD",
    level: String(data.get("level")) as PilatesClassLevel,
    status: String(data.get("status")) as Exclude<PilatesClassStatus, "deleted">,
    ...(image instanceof File && image.size > 0 ? { image } : {}),
  };
}

export function PilatesClassManager() {
  const api = usePilates();
  const [isCreateMode, setIsCreateMode] = useState(() =>
    typeof window === "undefined" ? false : window.location.hash === "#create-class",
  );
  const [toast, setToast] = useState<{
    message: string;
    title: string;
    tone: "success" | "error";
  } | null>(null);

  useEffect(() => {
    const syncCreateMode = () => {
      setIsCreateMode(window.location.hash === "#create-class");
    };

    window.addEventListener("hashchange", syncCreateMode);
    return () => window.removeEventListener("hashchange", syncCreateMode);
  }, []);

  const createClass = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const created = await api.createClass(classPayload(form));
      form.reset();
      window.history.replaceState(null, "", window.location.pathname);
      setIsCreateMode(false);
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
      {api.error ? (
        <section className="mb-5 rounded-xl border border-error/30 bg-error/10 p-4">
          <p className="text-sm text-error" role="alert">{api.error}</p>
          <button className={`${buttonClass} mt-3`} onClick={() => void api.load()} type="button">Try again</button>
        </section>
      ) : null}

      {isCreateMode ? (
        <section className="px-8">
          <CreateClassCard
            isSaving={api.isMutating}
            onCancel={() => {
              window.history.replaceState(null, "", window.location.pathname);
              setIsCreateMode(false);
            }}
            onSubmit={createClass}
          />
        </section>
      ) : (
        <section className="grid gap-7 px-8" aria-labelledby="pilates-classes-heading">
          <header className="flex min-h-22 items-center justify-between gap-4 rounded-md bg-card-bg-primary px-5 shadow-lg shadow-slate-900/10 md:px-6">
            <h2 className="text-2xl font-medium text-txt-primary" id="pilates-classes-heading">Pilates classes</h2>
            <button
              className="inline-flex min-h-12 items-center rounded-sm bg-button-primary px-5 text-base font-semibold text-txt-primary transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              onClick={() => {
                window.history.replaceState(null, "", "#create-class");
                setIsCreateMode(true);
              }}
              type="button"
            >
              + Create New Class
            </button>
          </header>

          <div className="grid gap-5">
            {api.classes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-background-secondary bg-card-bg-primary p-10 text-center text-sm text-txt-secondary">
                No Pilates classes found. Create a new class to get started.
              </div>
            ) : (
              api.classes.map((item) => (
                <ClassCard
                  actionHref={`/services/pilates/${item.id}`}
                  actionLabel="Manage class"
                  item={item}
                  key={item.id}
                />
              ))
            )}
          </div>
        </section>
      )}

      {toast ? (
        <div className="fixed right-4 top-4 z-[90]">
          <Toast onDismiss={() => setToast(null)} title={toast.title} tone={toast.tone}>{toast.message}</Toast>
        </div>
      ) : null}
    </>
  );
}

function CreateClassCard({
  isSaving,
  onCancel,
  onSubmit,
}: {
  isSaving: boolean;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      className="overflow-hidden rounded-md border border-background-secondary bg-card-bg-primary text-txt-primary shadow-sm"
      id="create-class"
      onSubmit={onSubmit}
    >
      <header className="border-b border-background-secondary bg-card-bg-primary px-5 py-5">
        <h2 className="text-2xl font-medium" id="create-class-title">
          Add New Class
        </h2>
      </header>
      <div className="px-5 py-5">
        <p className="mb-5 text-sm text-txt-secondary">
          After creation, open the class page to edit it and add schedules.
        </p>
        <div className="grid gap-5 md:grid-cols-2">
          <FormInput className="md:col-span-2" label="Class title" maxLength={160} name="title" required />
          <label className="grid gap-1.5 text-xs font-bold md:col-span-2">
            Description
            <textarea className={`${fieldClass} min-h-24 resize-y`} maxLength={2000} name="description" />
          </label>
          <FormInput defaultValue={60} label="Default duration (minutes)" max={240} min={15} name="default_duration_minutes" required type="number" />
          <FormInput defaultValue={8} label="Default capacity" max={100} min={1} name="default_capacity" required type="number" />
          <FormInput defaultValue={15} label="Price per booking (KWD)" min={0} name="default_price_amount" required step="0.001" type="number" />
          <FormInput defaultValue="KWD" disabled label="Currency" readOnly type="text" />
          <Select defaultValue="all_levels" label="Level" name="level" options={["beginner", "intermediate", "advanced", "all_levels"]} />
          <Select defaultValue="active" label="Status" name="status" options={["draft", "active", "inactive"]} />
          <label className="grid gap-1.5 text-xs font-bold md:col-span-2">
            Cover image
            <input accept="image/jpeg,image/png,image/webp" className={fieldClass} name="image" type="file" />
          </label>
        </div>
      </div>
      <footer className="flex justify-start gap-2 border-t border-background-secondary px-5 py-5">
        <button className="min-h-11 rounded-sm bg-button-primary px-4 py-3 text-xs font-bold text-white disabled:opacity-60" disabled={isSaving} type="submit">
          {isSaving ? "Creating..." : "Create class"}
        </button>
        <button
          className="min-h-11 rounded-sm border border-background-secondary px-4 py-3 text-xs font-bold text-txt-secondary transition hover:bg-background-secondary disabled:opacity-60"
          disabled={isSaving}
          onClick={onCancel}
          type="button"
        >
          Back to classes
        </button>
      </footer>
    </form>
  );
}

function FormInput({ className, label: inputLabel, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className={`grid gap-1.5 text-xs font-bold ${className ?? ""}`}>{inputLabel}<input className={fieldClass} {...props} /></label>;
}

function Select({ defaultValue, label: selectLabel, name, options }: { defaultValue: string; label: string; name: string; options: string[] }) {
  return <label className="grid gap-1.5 text-xs font-bold">{selectLabel}<select className={fieldClass} defaultValue={defaultValue} name={name}>{options.map((option) => <option key={option} value={option}>{label(option)}</option>)}</select></label>;
}
