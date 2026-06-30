"use client";

import { ChevronDown } from "lucide-react";
import type { PilatesSchedule } from "@/modules/services/pilates";

import {
  BOOKING_PHONE_COUNTRY_CODES,
  fieldClass,
} from "../../constants/bookingUi.constants";
import { useBookingCustomerLookup } from "../../hooks/useBookingCustomerLookup";
import { formatTime } from "../../utils/bookingFormatters";

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

export function DateField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <input
        aria-label={label}
        className={fieldClass}
        onChange={(event) => onChange(event.target.value)}
        type="date"
        value={value}
      />
    </label>
  );
}

export function FormField({
  defaultValue,
  disabled = false,
  label,
  min,
  name,
  onChange,
  placeholder,
  prefix,
  required = false,
  step,
  type = "text",
  value,
}: {
  defaultValue?: string;
  disabled?: boolean;
  label: string;
  min?: string;
  name: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  prefix?: string;
  required?: boolean;
  step?: string;
  type?: "date" | "number" | "text" | "time";
  value?: string;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-bold">
      {label}
      {prefix ? (
        <span className="flex min-h-12 overflow-hidden rounded-sm border border-background-secondary bg-card-bg-primary text-base text-txt-primary transition focus-within:border-primary">
          <span className="flex items-center border-r border-background-secondary px-4 font-semibold text-txt-secondary">
            {prefix}
          </span>
          <input
            className="min-w-0 flex-1 bg-transparent px-4 text-base text-txt-primary outline-none placeholder:text-txt-secondary disabled:opacity-60"
            defaultValue={defaultValue}
            disabled={disabled}
            min={min}
            name={name}
            onChange={
              onChange ? (event) => onChange(event.target.value) : undefined
            }
            placeholder={placeholder}
            readOnly={value !== undefined && !onChange}
            required={required}
            step={step}
            type={type}
            value={value}
          />
        </span>
      ) : (
        <input
          className={fieldClass}
          defaultValue={defaultValue}
          disabled={disabled}
          min={min}
          name={name}
          onChange={
            onChange ? (event) => onChange(event.target.value) : undefined
          }
          placeholder={placeholder}
          readOnly={value !== undefined && !onChange}
          required={required}
          step={step}
          type={type}
          value={value}
        />
      )}
    </label>
  );
}

export function OptionSelect({
  disabled = false,
  label,
  name,
  onChange,
  options,
  placeholder,
  required = false,
  value,
}: {
  disabled?: boolean;
  label: string;
  name: string;
  onChange?: (value: string) => void;
  options: Array<[string, string]>;
  placeholder: string;
  required?: boolean;
  value?: string;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-bold">
      {label}
      <span className="relative">
        <select
          className={`${fieldClass} appearance-none pr-10 disabled:cursor-not-allowed disabled:opacity-60`}
          disabled={disabled}
          name={name}
          onChange={
            onChange ? (event) => onChange(event.target.value) : undefined
          }
          required={required}
          value={value}
        >
          <option value="">{placeholder}</option>
          {options.map(([value, optionLabel]) => (
            <option key={value} value={value}>
              {optionLabel}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-txt-secondary"
          size={16}
        />
      </span>
    </label>
  );
}

function PhoneNumberField({
  countryCode,
  label,
  name,
  onChange,
  onCountryCodeChange,
  placeholder,
  required = false,
  value,
}: {
  countryCode: string;
  label: string;
  name: string;
  onChange: (value: string) => void;
  onCountryCodeChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-bold">
      {label}
      <span className="grid min-h-12 overflow-hidden rounded-sm border border-background-secondary bg-card-bg-primary text-base text-txt-primary transition focus-within:border-primary sm:grid-cols-[minmax(10rem,13rem)_1fr]">
        <span className="relative border-b border-background-secondary sm:border-b-0 sm:border-r">
          <select
            aria-label="Country code"
            className="min-h-12 w-full appearance-none bg-transparent px-3 pr-8 text-sm font-semibold text-txt-primary outline-none"
            name={`${name}_country_code`}
            onChange={(event) => onCountryCodeChange(event.target.value)}
            value={countryCode}
          >
            {BOOKING_PHONE_COUNTRY_CODES.map((option) => (
              <option
                key={`${option.code}-${option.label}`}
                value={option.code}
              >
                {option.label} {option.code}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-txt-secondary"
            size={14}
          />
        </span>
        <input
          className="min-w-0 bg-transparent px-4 text-base text-txt-primary outline-none placeholder:text-txt-secondary"
          name={name}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required={required}
          type="tel"
          value={value}
        />
      </span>
    </label>
  );
}

export function BookingCustomerLookupPanel({
  customerLookup,
}: {
  customerLookup: ReturnType<typeof useBookingCustomerLookup>;
}) {
  const {
    customerDraft,
    lookupPhoneCountryCode,
    lookupStatus,
    updateCustomerDraft,
    updateLookupCivilId,
    updateLookupPhone,
    updateLookupPhoneCountryCode,
  } = customerLookup;
  const lookupStatusClass =
    lookupStatus.tone === "success"
      ? "border-success/30 bg-success/10 text-success"
      : lookupStatus.tone === "error"
        ? "border-error/30 bg-error/10 text-error"
        : lookupStatus.tone === "warning"
          ? "border-warning/30 bg-warning/10 text-warning"
          : "border-background-secondary bg-card-bg-secondary text-txt-secondary";

  return (
    <section className="overflow-hidden rounded-sm border border-background-secondary bg-card-bg-primary">
      <header className="border-b border-background-secondary px-4 py-3">
        <h3 className="text-sm font-bold">Customer Details</h3>
      </header>
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <PhoneNumberField
          countryCode={lookupPhoneCountryCode}
          label="Customer Mobile Number"
          name="lookup_phone"
          onChange={updateLookupPhone}
          onCountryCodeChange={updateLookupPhoneCountryCode}
          placeholder="00000000"
          required
          value={customerLookup.lookupPhone}
        />
        <FormField
          label="Customer CIVIL ID"
          name="lookup_civil_id"
          onChange={updateLookupCivilId}
          placeholder="2990-1011-2345"
          required
          type="text"
          value={customerLookup.lookupCivilId}
        />
        <FormField
          label="Customer Name"
          name="new_customer_full_name"
          onChange={(value) => updateCustomerDraft("fullName", value)}
          placeholder="Name"
          required
          value={customerDraft.fullName}
        />
        <FormField
          label="Customer Email"
          name="new_customer_email"
          onChange={(value) => updateCustomerDraft("email", value)}
          placeholder="Email"
          required
          type="text"
          value={customerDraft.email}
        />
        <input
          name="new_customer_timezone"
          type="hidden"
          value={customerDraft.timezone}
        />
      </div>
      {lookupStatus.tone !== "idle" ? (
        <p
          aria-live="polite"
          className={`mx-4 mb-4 rounded-sm border px-4 py-3 text-sm font-semibold ${lookupStatusClass}`}
          role={lookupStatus.tone === "error" ? "alert" : "status"}
        >
          {lookupStatus.message}
        </p>
      ) : null}
    </section>
  );
}

export function SelectedScheduleTags({
  onRemove,
  schedules,
}: {
  onRemove: (scheduleId: string) => void;
  schedules: PilatesSchedule[];
}) {
  if (schedules.length === 0) {
    return <span className="min-w-0 flex-1" aria-hidden="true" />;
  }

  return (
    <span className="flex min-w-0 flex-1 flex-wrap gap-2">
      {schedules.map((schedule) => (
        <span
          className="inline-flex max-w-full items-center gap-2 rounded-sm border border-background-secondary bg-card-bg-secondary px-2 py-1 text-xs font-semibold text-txt-primary"
          key={schedule.id}
        >
          <span className="truncate">
            {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
          </span>
          <button
            aria-label={`Remove ${formatTime(schedule.start_time)} session`}
            className="text-txt-secondary transition hover:text-error"
            onClick={() => onRemove(schedule.id)}
            type="button"
          >
            X
          </button>
        </span>
      ))}
    </span>
  );
}
