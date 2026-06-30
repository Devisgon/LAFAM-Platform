"use client";

import { ChevronDown, RotateCcw } from "lucide-react";

import { fieldClass, pageSizeOptions } from "../../constants/paymentUi.constants";

export function RetryState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="p-6">
      <p className="text-sm text-txt-primary" role="alert">
        {error}
      </p>
      <button
        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-button-primary px-4 py-2 text-xs font-bold text-txt-primary"
        onClick={onRetry}
        type="button"
      >
        <RotateCcw aria-hidden="true" size={14} />
        Try again
      </button>
    </div>
  );
}

export function BillingLine({
  emphasized = false,
  label: itemLabel,
  value,
}: {
  emphasized?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 ${emphasized ? "border-t border-background-secondary pt-3 text-lg font-bold" : "text-sm"}`}
    >
      <dt className="text-txt-secondary">{itemLabel}</dt>
      <dd className="font-semibold text-txt-primary">{value}</dd>
    </div>
  );
}

export function DetailItem({ label: itemLabel, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-background-secondary bg-card-bg-secondary p-3">
      <dt className="text-xs font-bold uppercase text-txt-secondary">
        {itemLabel}
      </dt>
      <dd className="mt-1 break-words text-sm font-semibold">{value}</dd>
    </div>
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
    <footer className="flex flex-col gap-4 px-5 pb-5 text-base text-txt-secondary md:flex-row md:items-center md:justify-between">
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

      <nav aria-label="Payment pagination" className="flex items-center">
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

export function FilterSelect({
  disabled = false,
  label: filterLabel,
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
      <span className="sr-only">{filterLabel}</span>
      <select
        aria-label={filterLabel}
        className={`${fieldClass} appearance-none pr-10 disabled:cursor-not-allowed disabled:opacity-60`}
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

export function DateField({
  label: dateLabel,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label>
      <span className="sr-only">{dateLabel}</span>
      <input
        aria-label={dateLabel}
        className={fieldClass}
        onChange={(event) => onChange(event.target.value)}
        type="date"
        value={value}
      />
    </label>
  );
}
