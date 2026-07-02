"use client";

import { ChevronDown, Eye, Pencil, Trash2 } from "lucide-react";
import { fieldClass, pageSizeOptions } from "../../constants/promoUi.constants";

export function FilterSelect({
  disabled = false,
  label,
  onChange,
  options,
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<readonly [string, string]>;
  value: string;
}) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
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

export function SearchField({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label>
      <span className="sr-only">Search promo codes</span>
      <input
        className={fieldClass}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search code or description..."
        type="search"
        value={value}
      />
    </label>
  );
}

export function PromoActionButton({
  icon,
  label,
  onClick,
  tone = "neutral",
}: {
  icon: "view" | "edit" | "delete";
  label: string;
  onClick: () => void;
  tone?: "neutral" | "warning" | "error";
}) {
  const Icon = icon === "view" ? Eye : icon === "edit" ? Pencil : Trash2;
  const tones = {
    error: "bg-error text-txt-primary hover:opacity-85",
    neutral: "bg-primary text-txt-primary hover:opacity-85",
    warning: "bg-warning text-txt-primary hover:opacity-85",
  };

  return (
    <button
      aria-label={label}
      className={`flex size-9 items-center justify-center rounded-full border border-background-secondary shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${tones[tone]}`}
      onClick={onClick}
      title={label}
      type="button"
    >
      <Icon aria-hidden="true" size={17} strokeWidth={2.5} />
    </button>
  );
}

export function PromoStatusToggle({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      aria-label={label}
      aria-checked={checked}
      className={`mx-auto flex h-7 w-12 items-center rounded-full p-1 transition ${
        checked ? "bg-primary" : "bg-background-secondary"
      } disabled:cursor-not-allowed disabled:opacity-60`}
      disabled={disabled}
      onClick={onChange}
      role="switch"
      type="button"
    >
      <span
        className={`size-5 rounded-full bg-card-bg-primary shadow-sm transition ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export function PaginationFooter({
  currentPage,
  onPageChange,
  onPageSizeChange,
  pageCount,
  pageSize,
  total,
  visibleEnd,
  visibleStart,
}: {
  currentPage: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageCount: number;
  pageSize: number;
  total: number;
  visibleEnd: number;
  visibleStart: number;
}) {
  return (
    <footer className="flex flex-col gap-4 px-5 py-5 text-base text-txt-secondary md:flex-row md:items-center md:justify-between">
      <label className="flex items-center gap-4">
        <span className="relative inline-flex">
          <select
            aria-label="Records per page"
            className="min-h-12 appearance-none rounded-sm border border-background-secondary bg-card-bg-primary px-4 pr-10 text-txt-primary outline-none focus:border-primary"
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            value={pageSize}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-txt-secondary"
            size={16}
          />
        </span>
        records per page
      </label>

      <p>
        Showing {visibleStart} to {visibleEnd} of {total} entries
      </p>

      <nav aria-label="Promo code pagination" className="flex items-center">
        <button
          className="min-h-11 rounded-l-sm border border-background-secondary px-4 text-txt-secondary disabled:cursor-not-allowed disabled:opacity-50"
          disabled={currentPage === 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          type="button"
        >
          Previous
        </button>
        <span className="flex min-h-11 min-w-11 items-center justify-center bg-button-primary px-4 font-medium text-txt-primary">
          {currentPage}
        </span>
        <button
          className="min-h-11 rounded-r-sm border border-background-secondary px-4 text-txt-secondary disabled:cursor-not-allowed disabled:opacity-50"
          disabled={currentPage >= pageCount}
          onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}
          type="button"
        >
          Next
        </button>
      </nav>
    </footer>
  );
}

export function RetryState({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="p-6">
      <p className="text-sm text-txt-primary" role="alert">
        {error}
      </p>
      <button
        className="mt-3 rounded-lg bg-button-primary px-4 py-2 text-xs font-bold text-txt-primary"
        onClick={onRetry}
        type="button"
      >
        Try again
      </button>
    </div>
  );
}
