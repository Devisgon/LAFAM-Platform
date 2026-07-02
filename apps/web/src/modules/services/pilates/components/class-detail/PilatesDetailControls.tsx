"use client";

import type { InputHTMLAttributes, ReactNode } from "react";

import { buttonClass, fieldClass, label } from "../../utils/pilatesDetailUtils";

export function DetailLine({
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

export function InlineCard({
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

export function ModalFooter({
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
        className="min-h-11 rounded-sm bg-button-primary px-4 py-3 text-xs font-bold text-txt-primary disabled:opacity-60"
        disabled={isSaving}
        type="submit"
      >
        {isSaving ? "Saving..." : submitLabel}
      </button>
    </footer>
  );
}

export function FormInput({
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

export function Select({
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

export function HeroStat({
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
