"use client";

import type { FormEvent } from "react";

import type { PilatesClassDefinition } from "../../api/pilatesApi";
import { fieldClass } from "../../utils/pilatesDetailUtils";
import { FormInput, ModalFooter, Select } from "./PilatesDetailControls";

export function ClassEditForm({
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
