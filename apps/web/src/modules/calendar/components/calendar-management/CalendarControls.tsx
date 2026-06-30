"use client";

import { ChevronDown, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { AdminBookingCalendarEvent } from "@/modules/bookings";

import {
  fieldClass,
  formatDate,
  getSourceValue,
  label,
  statusTone,
} from "../../utils/calendarFormatters";

export function EventDetailCard({
  event,
  onClose,
}: {
  event: AdminBookingCalendarEvent;
  onClose: () => void;
}) {
  const customerName =
    getSourceValue(event, "customer_full_name") ??
    event.user_id ??
    "No customer";
  const trainerName =
    getSourceValue(event, "trainer_display_name") ??
    event.trainer_staff_profile_id ??
    "No trainer";
  const bookingNumber =
    getSourceValue(event, "booking_number") ??
    event.private_booking_id ??
    event.id;

  return (
    <aside className="self-start rounded-md border border-background-secondary bg-card-bg-secondary p-5 shadow-sm">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold capitalize text-txt-primary">
            {bookingNumber}
          </h3>
          <Badge className="mt-2" tone={statusTone(event.status)}>
            {label(event.status)}
          </Badge>
        </div>
        <button
          aria-label="Close event details"
          className="flex size-9 items-center justify-center rounded-full bg-card-bg-primary text-txt-secondary"
          onClick={onClose}
          type="button"
        >
          <X aria-hidden="true" size={17} />
        </button>
      </header>

      <dl className="mt-5 grid gap-4 text-sm">
        <Detail label="Title" value={event.title} />
        <Detail label="Customer" value={customerName} />
        <Detail label="Trainer" value={trainerName} />
        <Detail label="Date" value={formatDate(event.date)} />
        <Detail
          label="Time"
          value={`${event.start_time} - ${event.end_time}`}
        />
      </dl>
    </aside>
  );
}

export function Detail({
  label: detailLabel,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-txt-secondary">
        {detailLabel}
      </dt>
      <dd className="mt-1 break-words text-txt-primary">{value}</dd>
    </div>
  );
}

export function FilterSelect({
  label: filterLabel,
  options,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  options: ReadonlyArray<readonly [string, string]>;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
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

export function ToggleFilter({
  checked,
  label: filterLabel,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      className={`inline-flex min-h-11 cursor-pointer items-center gap-3 rounded-sm border px-4 text-sm font-semibold transition ${
        checked
          ? "border-primary bg-button-primary text-txt-primary"
          : "border-background-secondary bg-card-bg-primary text-txt-secondary"
      }`}
    >
      <input
        aria-label={filterLabel}
        checked={checked}
        className="size-4 accent-primary"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      {filterLabel}
    </label>
  );
}
