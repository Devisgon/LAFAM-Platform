"use client";

import type { FormEvent } from "react";

import { classListFieldClass } from "../../utils/pilatesClassListUtils";
import { FormInput, Select } from "./PilatesClassFormControls";

export function CreateClassCard({
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
            <textarea className={`${classListFieldClass} min-h-24 resize-y`} maxLength={2000} name="description" />
          </label>
          <FormInput defaultValue={60} label="Default duration (minutes)" max={240} min={15} name="default_duration_minutes" required type="number" />
          <FormInput defaultValue={8} label="Default capacity" max={100} min={1} name="default_capacity" required type="number" />
          <FormInput defaultValue={15} label="Price per booking (KWD)" min={0} name="default_price_amount" required step="0.001" type="number" />
          <FormInput defaultValue="KWD" disabled label="Currency" readOnly type="text" />
          <Select defaultValue="all_levels" label="Level" name="level" options={["beginner", "intermediate", "advanced", "all_levels"]} />
          <Select defaultValue="active" label="Status" name="status" options={["draft", "active", "inactive"]} />
          <label className="grid gap-1.5 text-xs font-bold md:col-span-2">
            Cover image
            <input accept="image/jpeg,image/png,image/webp" className={classListFieldClass} name="image" type="file" />
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
