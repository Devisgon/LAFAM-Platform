"use client";

import Link from "next/link";
import { ChevronDown, Eye, Power, RotateCcw, Trash2 } from "lucide-react";

import { fieldClass } from "../../constants/userUi.constants";

export function FilterSelect({
  label: filterLabel,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<[string, string]>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative">
      <span className="sr-only">{filterLabel}</span>
      <select
        aria-label={filterLabel}
        className={`${fieldClass} appearance-none pr-10`}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue || "all"} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-txt-secondary"
        size={16}
      />
    </label>
  );
}

export function ViewCustomerLink({
  href,
  label: actionLabel,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      aria-label={actionLabel}
      className="flex size-9 items-center justify-center rounded-full bg-primary text-white shadow-sm transition hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      href={href}
      title={actionLabel}
    >
      <Eye aria-hidden="true" size={17} strokeWidth={2.5} />
    </Link>
  );
}

export function ActionButton({
  icon,
  label: actionLabel,
  onClick,
  tone,
}: {
  icon: "deactivate" | "reactivate" | "delete";
  label: string;
  onClick: () => void;
  tone: "success" | "warning" | "error";
}) {
  const tones = {
    success: "bg-success text-txt-primary hover:opacity-85",
    warning: "bg-warning text-txt-primary hover:opacity-85",
    error: "bg-error text-txt-primary hover:opacity-85",
  };
  const Icon =
    icon === "reactivate" ? RotateCcw : icon === "delete" ? Trash2 : Power;

  return (
    <button
      aria-label={actionLabel}
      className={`flex size-9 items-center justify-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary shadow-sm ${tones[tone]}`}
      onClick={onClick}
      title={actionLabel}
      type="button"
    >
      <Icon aria-hidden="true" size={17} strokeWidth={2.5} />
    </button>
  );
}
