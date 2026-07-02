"use client";

import Link from "next/link";
import { ChevronDown, Eye, Power, RotateCcw, Trash2 } from "lucide-react";

import { fieldClass } from "../../constants/userUi.constants";

export function FilterSelect({
  disabled = false,
  label: filterLabel,
  options,
  value,
  onChange,
}: {
  disabled?: boolean;
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
        disabled={disabled}
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
      className="flex size-9 items-center justify-center rounded-full border border-background-secondary bg-primary text-txt-primary shadow-sm transition hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      href={href}
      title={actionLabel}
    >
      <Eye aria-hidden="true" size={17} strokeWidth={2.5} />
    </Link>
  );
}

export function UserStatusToggle({
  checked,
  label,
}: {
  checked: boolean;
  label: string;
}) {
  return (
    <span
      aria-checked={checked}
      aria-label={label}
      className={`inline-flex h-7 w-12 items-center rounded-full border border-background-secondary p-1 transition ${
        checked ? "bg-primary" : "bg-card-bg-secondary"
      }`}
      role="switch"
    >
      <span
        className={`size-5 rounded-full bg-card-bg-primary shadow-sm transition ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </span>
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
      className={`flex size-9 items-center justify-center rounded-full border border-background-secondary shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${tones[tone]}`}
      onClick={onClick}
      title={actionLabel}
      type="button"
    >
      <Icon aria-hidden="true" size={17} strokeWidth={2.5} />
    </button>
  );
}
