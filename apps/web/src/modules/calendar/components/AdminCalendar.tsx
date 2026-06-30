"use client";

import { useMemo, useState } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { LoadingState } from "@/components/data-display/LoadingState";
import { useAdminBookingCalendar } from "@/modules/calendar";
import { usePilates } from "@/modules/services/pilates";
import type {
  AdminBookingCalendarEvent,
  AdminBookingCalendarFilters,
} from "@/modules/bookings";

import {
  buildCalendarDays,
  buildCalendarMonthOptions,
  buildUpcomingYearOptions,
  dayNames,
  defaultMonth,
  eventTypeClass,
  eventTypeLabel,
  monthDateRange,
} from "../utils/calendarFormatters";
import {
  EventDetailCard,
  FilterSelect,
  ToggleFilter,
} from "./calendar-management/CalendarControls";

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
  const calendarMonthOptions = useMemo(() => buildCalendarMonthOptions(), []);
  const calendarYearOptions = useMemo(() => buildUpcomingYearOptions(10), []);
  const calendarYearFilterOptions = useMemo(
    () => calendarYearOptions.map((year) => [year, year] as const),
    [calendarYearOptions],
  );
  const selectedYear = selectedMonth.slice(0, 4);
  const selectedMonthNumber = selectedMonth.slice(5, 7);
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
  const updateCalendarMonth = (nextYear: string, nextMonth: string) => {
    setSelectedMonth(`${nextYear}-${nextMonth}`);
    setSelectedEvent(null);
    setExpandedDay(null);
  };

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
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
              <FilterSelect
                label="Calendar month"
                onChange={(value) => updateCalendarMonth(selectedYear, value)}
                options={calendarMonthOptions}
                value={selectedMonthNumber}
              />
              <FilterSelect
                label="Calendar year"
                onChange={(value) =>
                  updateCalendarMonth(value, selectedMonthNumber)
                }
                options={calendarYearFilterOptions}
                value={selectedYear}
              />
            </div>
            <FilterSelect
              disabled={isPilatesLoading || trainerOptions.length === 0}
              label="Staff trainer"
              onChange={(value) => {
                setTrainerStaffProfileId(value);
                setSelectedEvent(null);
              }}
              options={[
                ["", isPilatesLoading ? "Loading trainers..." : "All trainers"],
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
                ["", isPilatesLoading ? "Loading classes..." : "All classes"],
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
              <span className="inline-flex items-center gap-2" key={eventType}>
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
                      isDayExpanded ? dayEvents.length : collapsedEventCount,
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
