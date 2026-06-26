"use client";

import { useMemo, useState } from "react";
import { ChevronDown, RotateCcw, X } from "lucide-react";
import { useAdminBookingCalendar } from "@/modules/calendar";
import { usePilates } from "@/modules/services/pilates";
import {
  type AdminBookingCalendarEvent,
  type AdminBookingCalendarFilters,
} from "@/modules/bookings";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/data-display/LoadingState";

const fieldClass =
  "min-h-12 w-full rounded-sm border border-background-secondary bg-card-bg-primary px-4 text-base text-txt-primary outline-none transition placeholder:text-txt-secondary focus:border-primary";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function defaultMonth(): string {
  return isoDate(new Date()).slice(0, 7);
}

function monthDateRange(monthValue: string): {
  fromDate: string;
  toDate: string;
} {
  const [yearText, monthText] = monthValue.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex)) {
    const fallback = defaultMonth();
    return monthDateRange(fallback);
  }

  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);

  return {
    fromDate: isoDate(firstDay),
    toDate: isoDate(lastDay),
  };
}

function monthLabel(monthValue: string): string {
  const [yearText, monthText] = monthValue.split("-");
  const date = new Date(Number(yearText), Number(monthText) - 1, 1);

  if (Number.isNaN(date.getTime())) return monthValue;

  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function buildMonthOptions(): Array<[string, string]> {
  const now = new Date();
  const startYear = now.getFullYear() - 1;
  const options: Array<[string, string]> = [];

  for (let year = startYear; year <= startYear + 2; year += 1) {
    for (let month = 0; month < 12; month += 1) {
      const value = `${year}-${String(month + 1).padStart(2, "0")}`;
      options.push([value, monthLabel(value)]);
    }
  }

  return options;
}

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function statusTone(
  status: string,
): "neutral" | "info" | "success" | "warning" | "error" {
  if (status === "confirmed" || status === "scheduled") return "success";
  if (status === "pending_payment" || status === "waiting") return "warning";
  if (status === "completed") return "info";
  if (status === "cancelled" || status === "deleted" || status === "expired") {
    return "error";
  }

  return "neutral";
}

function eventTypeLabel(
  eventType: AdminBookingCalendarEvent["event_type"],
): string {
  if (eventType === "pilates_schedule") return "Class schedule";
  if (eventType === "pilates_booking") return "Class booking";
  if (eventType === "private_trainer_booking") return "Private booking";
  return "Waitlist";
}

function eventTypeClass(
  eventType: AdminBookingCalendarEvent["event_type"],
): string {
  if (eventType === "pilates_schedule") return "calendar-event--class-schedule";
  if (eventType === "pilates_booking") return "calendar-event--class-booking";
  return `calendar-event--${eventType.replaceAll("_", "-")}`;
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getSourceValue(
  event: AdminBookingCalendarEvent,
  key: string,
): string | null {
  return event.source[key] ?? null;
}

function buildCalendarDays(
  fromDate: string,
  toDate: string,
): Array<string | null> {
  const start = new Date(`${fromDate}T00:00:00`);
  const end = new Date(`${toDate}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [];
  }

  const days: Array<string | null> = Array.from(
    { length: start.getDay() },
    () => null,
  );
  const cursor = new Date(start);
  let guard = 0;

  while (cursor <= end && guard < 62) {
    days.push(isoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }

  const trailingDays = (7 - (days.length % 7)) % 7;
  for (let count = 0; count < trailingDays; count += 1) {
    days.push(null);
  }

  return days;
}

export function AdminCalendar() {
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [trainerStaffProfileId, setTrainerStaffProfileId] = useState("");
  const [classId, setClassId] = useState("");
  const [includeClassSchedules, setIncludeClassSchedules] = useState(true);
  const [includeClassBookings, setIncludeClassBookings] = useState(true);
  const [includePrivateBookings, setIncludePrivateBookings] = useState(true);
  const [selectedEvent, setSelectedEvent] =
    useState<AdminBookingCalendarEvent | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const {
    classes,
    error: pilatesError,
    isLoading: isPilatesLoading,
    trainers,
  } = usePilates();
  const { fromDate, toDate } = useMemo(
    () => monthDateRange(selectedMonth),
    [selectedMonth],
  );
  const classOptions = useMemo(
    () =>
      classes
        .filter((item) => item.status !== "deleted")
        .map((item) => [item.id, item.title] as const),
    [classes],
  );
  const trainerOptions = useMemo(
    () =>
      trainers.map(
        (trainer) =>
          [
            trainer.id,
            `${trainer.display_name}${trainer.post_title ? ` - ${trainer.post_title}` : ""}`,
          ] as const,
      ),
    [trainers],
  );

  const filters = useMemo<AdminBookingCalendarFilters>(
    () => ({
      from_date: fromDate,
      include_class_bookings: includeClassBookings,
      include_class_schedules: includeClassSchedules,
      include_private_bookings: includePrivateBookings,
      include_waitlist: false,
      sort_by: "start_at",
      sort_direction: "asc",
      to_date: toDate,
      ...(trainerStaffProfileId.trim()
        ? { trainer_staff_profile_id: trainerStaffProfileId }
        : {}),
      ...(classId.trim() ? { class_id: classId } : {}),
    }),
    [
      classId,
      fromDate,
      includeClassBookings,
      includeClassSchedules,
      includePrivateBookings,
      toDate,
      trainerStaffProfileId,
    ],
  );
  const { error, events, isLoading, loadCalendar, total } =
    useAdminBookingCalendar(filters);
  const days = useMemo(
    () => buildCalendarDays(fromDate, toDate),
    [fromDate, toDate],
  );
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, AdminBookingCalendarEvent[]>();

    events.forEach((event: AdminBookingCalendarEvent) => {
      const list = grouped.get(event.date) ?? [];
      list.push(event);
      grouped.set(event.date, list);
    });

    return grouped;
  }, [events]);

  return (
    <div className="grid gap-7">
            <section className="overflow-hidden rounded-md bg-card-bg-primary shadow-sm">
              <header className="border-b border-background-secondary px-5 py-5">
                <h2 className="text-2xl font-medium text-txt-primary">
                  Booking Calendar
                </h2>
              </header>

              <div className="grid gap-4 border-b border-background-secondary px-5 py-5">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <FilterSelect
                    label="Calendar month"
                    onChange={(value) => {
                      setSelectedMonth(value);
                      setSelectedEvent(null);
                    }}
                    options={buildMonthOptions()}
                    value={selectedMonth}
                  />
                  <FilterSelect
                    disabled={isPilatesLoading || trainerOptions.length === 0}
                    label="Staff trainer"
                    onChange={(value) => {
                      setTrainerStaffProfileId(value);
                      setSelectedEvent(null);
                    }}
                    options={[
                      [
                        "",
                        isPilatesLoading
                          ? "Loading trainers..."
                          : "All trainers",
                      ],
                      ...trainerOptions,
                    ]}
                    value={trainerStaffProfileId}
                  />
                  <FilterSelect
                    disabled={isPilatesLoading || classOptions.length === 0}
                    label="Class"
                    onChange={(value) => {
                      setClassId(value);
                      setSelectedEvent(null);
                    }}
                    options={[
                      [
                        "",
                        isPilatesLoading ? "Loading classes..." : "All classes",
                      ],
                      ...classOptions,
                    ]}
                    value={classId}
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <ToggleFilter
                    checked={includeClassSchedules}
                    label="Class schedules"
                    onChange={(value) => {
                      setIncludeClassSchedules(value);
                      setSelectedEvent(null);
                    }}
                  />
                  <ToggleFilter
                    checked={includeClassBookings}
                    label="Class bookings"
                    onChange={(value) => {
                      setIncludeClassBookings(value);
                      setSelectedEvent(null);
                    }}
                  />
                  <ToggleFilter
                    checked={includePrivateBookings}
                    label="Private bookings"
                    onChange={(value) => {
                      setIncludePrivateBookings(value);
                      setSelectedEvent(null);
                    }}
                  />
                </div>

                <div
                  aria-label="Calendar event colors"
                  className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-txt-secondary"
                >
                  {(
                    [
                      "pilates_schedule",
                      "pilates_booking",
                      "private_trainer_booking",
                      "waitlist_entry",
                    ] as const
                  ).map((eventType) => (
                    <span
                      className="inline-flex items-center gap-2"
                      key={eventType}
                    >
                      <span
                        aria-hidden="true"
                        className={`size-3 rounded-full ${eventTypeClass(eventType)}`}
                      />
                      {eventTypeLabel(eventType)}
                    </span>
                  ))}
                </div>

                {pilatesError ? (
                  <p className="text-sm text-error" role="alert">
                    {pilatesError}
                  </p>
                ) : null}
              </div>

              {isLoading ? (
                <LoadingState className="p-6" label="Loading calendar events" />
              ) : error ? (
                <div className="p-6">
                  <p className="text-sm text-txt-primary" role="alert">
                    {error}
                  </p>
                  <button
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-button-primary px-4 py-2 text-xs font-bold text-txt-primary"
                    onClick={() => void loadCalendar().catch(() => undefined)}
                    type="button"
                  >
                    <RotateCcw aria-hidden="true" size={14} />
                    Try again
                  </button>
                </div>
              ) : (
                <div
                  className={`grid gap-5 p-5 ${
                    selectedEvent
                      ? "xl:grid-cols-[minmax(0,1fr)_360px]"
                      : "grid-cols-1"
                  }`}
                >
                  <section aria-label="Calendar grid" className="min-w-0">
                    <div className="w-full overflow-hidden rounded-sm border border-background-secondary">
                      <div className="grid grid-cols-7 border-b border-background-secondary bg-card-bg-secondary">
                        {dayNames.map((day) => (
                          <div
                            className="min-w-0 border-r border-background-secondary px-1.5 py-3 text-center text-xs font-semibold text-txt-primary last:border-r-0 sm:px-3 sm:text-sm"
                            key={day}
                          >
                            {day}
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7">
                        {days.map((day, index) => {
                          if (!day) {
                            return (
                              <div
                                aria-hidden="true"
                                className="min-h-28 min-w-0 border-b border-r border-background-secondary bg-background-secondary/30 p-1.5 last:border-r-0 sm:min-h-32 sm:p-2 lg:min-h-36 lg:p-3"
                                key={`empty-${index}`}
                              />
                            );
                          }

                          const dayEvents = eventsByDate.get(day) ?? [];
                          const collapsedEventCount = selectedEvent ? 2 : 3;
                          const isDayExpanded = expandedDay === day;
                          const visibleEvents = dayEvents.slice(
                            0,
                            isDayExpanded
                              ? dayEvents.length
                              : collapsedEventCount,
                          );
                          const hiddenEventCount = Math.max(
                            0,
                            dayEvents.length - collapsedEventCount,
                          );

                          return (
                            <div
                              className="min-h-28 min-w-0 overflow-hidden border-b border-r border-background-secondary bg-card-bg-primary p-1.5 last:border-r-0 sm:min-h-32 sm:p-2 lg:min-h-36 lg:p-3"
                              key={day}
                            >
                              <p className="mb-2 truncate text-xs font-semibold text-txt-primary sm:text-sm">
                                {new Intl.DateTimeFormat("en", {
                                  day: "numeric",
                                  month: "short",
                                }).format(new Date(`${day}T00:00:00`))}
                              </p>
                              <div className="grid min-w-0 gap-1.5">
                                {visibleEvents.map((event) => (
                                  <button
                                    className={`calendar-event-card min-w-0 overflow-hidden rounded-sm px-2 py-1.5 text-left text-[11px] font-semibold leading-tight transition hover:brightness-95 sm:text-xs ${eventTypeClass(event.event_type)}`}
                                    key={event.id}
                                    onClick={() => setSelectedEvent(event)}
                                    type="button"
                                  >
                                    <span className="block truncate">
                                      {event.title}
                                    </span>
                                    <span className="mt-1 block truncate text-[10px] opacity-75 sm:text-[11px]">
                                      {event.start_time} - {event.end_time}
                                    </span>
                                  </button>
                                ))}
                                {hiddenEventCount > 0 ? (
                                  <button
                                    aria-expanded={isDayExpanded}
                                    className="flex min-h-7 items-center gap-1 rounded-sm px-1 text-left text-[10px] font-semibold text-txt-secondary transition hover:bg-background-secondary hover:text-txt-primary sm:text-xs"
                                    onClick={() =>
                                      setExpandedDay((currentDay) =>
                                        currentDay === day ? null : day,
                                      )
                                    }
                                    type="button"
                                  >
                                    <ChevronDown
                                      aria-hidden="true"
                                      className={`shrink-0 transition-transform ${isDayExpanded ? "rotate-180" : ""}`}
                                      size={13}
                                    />
                                    <span className="truncate">
                                      {isDayExpanded
                                        ? "Show less"
                                        : `+${hiddenEventCount} more`}
                                    </span>
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <p className="mt-4 text-center text-sm text-txt-secondary">
                      Showing {events.length} of {total} events
                    </p>
                  </section>

                  {selectedEvent ? (
                    <EventDetailCard
                      event={selectedEvent}
                      onClose={() => setSelectedEvent(null)}
                    />
                  ) : null}
                </div>
              )}
            </section>
    </div>
  );
}

function EventDetailCard({
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

function Detail({
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

function FilterSelect({
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

function ToggleFilter({
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
