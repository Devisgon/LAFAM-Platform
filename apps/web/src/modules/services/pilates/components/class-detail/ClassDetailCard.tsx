"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";

import type {
  PilatesClassDefinition,
  PilatesSchedule,
} from "../../api/pilatesApi";
import {
  buildCalendarDays,
  buildCalendarMonthOptions,
  buildUpcomingYearOptions,
  buttonClass,
  calendarDayNames,
  classTone,
  defaultMonth,
  fieldClass,
  formatTime,
  label,
  monthDateRange,
  monthLabel,
} from "../../utils/pilatesDetailUtils";
import { HeroStat } from "./PilatesDetailControls";
import { ScheduleDetailPanel } from "./ScheduleDetailPanel";

export function ClassDetailCard({
  detail,
  onCancelSchedule,
  onCompleteSchedule,
  onCreateSchedule,
  onDeleteSchedule,
  onEdit,
  onEditSchedule,
  schedules,
}: {
  detail: PilatesClassDefinition;
  onCancelSchedule: (item: PilatesSchedule) => void;
  onCompleteSchedule: (item: PilatesSchedule) => void;
  onCreateSchedule: () => void;
  onDeleteSchedule: (item: PilatesSchedule) => void;
  onEdit: () => void;
  onEditSchedule: (item: PilatesSchedule) => void;
  schedules: PilatesSchedule[];
}) {
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(
    null,
  );
  const calendarMonthOptions = useMemo(() => buildCalendarMonthOptions(), []);
  const calendarYearOptions = useMemo(() => buildUpcomingYearOptions(10), []);
  const selectedYear = selectedMonth.slice(0, 4);
  const selectedMonthNumber = selectedMonth.slice(5, 7);
  const { fromDate, toDate } = useMemo(
    () => monthDateRange(selectedMonth),
    [selectedMonth],
  );
  const days = useMemo(
    () => buildCalendarDays(fromDate, toDate),
    [fromDate, toDate],
  );
  const schedulesByDate = useMemo(() => {
    const grouped = new Map<string, PilatesSchedule[]>();

    schedules
      .filter(
        (schedule) =>
          schedule.class_date >= fromDate && schedule.class_date <= toDate,
      )
      .sort((left, right) =>
        `${left.class_date} ${left.start_time}`.localeCompare(
          `${right.class_date} ${right.start_time}`,
        ),
      )
      .forEach((schedule) => {
        const list = grouped.get(schedule.class_date) ?? [];
        list.push(schedule);
        grouped.set(schedule.class_date, list);
      });

    return grouped;
  }, [fromDate, schedules, toDate]);
  const visibleSchedules = useMemo(
    () => Array.from(schedulesByDate.values()).flat(),
    [schedulesByDate],
  );
  const selectedSchedule = useMemo(
    () =>
      selectedScheduleId
        ? (visibleSchedules.find(
            (schedule) => schedule.id === selectedScheduleId,
          ) ?? null)
        : null,
    [selectedScheduleId, visibleSchedules],
  );
  const updateCalendarMonth = (nextYear: string, nextMonth: string) => {
    setSelectedMonth(`${nextYear}-${nextMonth}`);
    setSelectedScheduleId(null);
  };

  return (
    <article className="overflow-hidden rounded-3xl border border-background-secondary bg-card-bg-primary shadow-sm">
      <div className="grid lg:grid-cols-[300px_minmax(0,1fr)]">
        {detail.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            className="h-full min-h-64 w-full object-cover"
            height="512"
            src={detail.image_url}
            width="560"
          />
        ) : (
          <div className="flex min-h-64 items-center justify-center p-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="LAFAM"
              className="h-auto w-full max-w-56 object-contain"
              height="320"
              src="/logo.png"
              width="320"
            />
          </div>
        )}
        <div className="flex flex-col p-6 lg:p-8">
          <div className="flex flex-1 flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl">
              <div className="flex flex-wrap gap-2">
                <Badge tone={classTone(detail.status)}>
                  {label(detail.status)}
                </Badge>
                <Badge tone="info">{label(detail.level)}</Badge>
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-txt-primary">
                {detail.title}
              </h1>
              <p className="mt-3 text-sm leading-6 text-txt-secondary">
                {detail.description ?? "No description provided."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className={buttonClass} onClick={onEdit} type="button">
                Edit class
              </button>
              <button
                className="rounded-lg bg-button-primary px-5 py-2 text-xs font-bold text-txt-primary shadow-sm shadow-primary/20 disabled:opacity-50"
                disabled={detail.status !== "active"}
                onClick={onCreateSchedule}
                type="button"
              >
                Add schedule
              </button>
            </div>
          </div>
          <dl className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <HeroStat
              label="Duration"
              value={`${detail.default_duration_minutes} min`}
            />
            <HeroStat
              label="Capacity"
              value={`${detail.default_capacity} people`}
            />
            <HeroStat
              label="Price per booking"
              value={`${detail.default_price_amount.toFixed(3)} ${detail.currency}`}
            />
            <HeroStat
              label="Total schedules"
              value={String(schedules.length)}
            />
          </dl>
        </div>
      </div>
      <section
        className="border-t border-background-secondary px-6 py-6 lg:px-8"
        aria-labelledby="class-schedules-heading"
      >
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2
              className="text-2xl font-medium text-txt-primary"
              id="class-schedules-heading"
            >
              Schedule calendar
            </h2>
            <p className="mt-1 text-sm text-txt-secondary">
              Showing schedules for {detail.title}.
            </p>
          </div>
          <div className="grid w-full max-w-md gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
            <label className="grid gap-1.5 text-xs font-bold">
              Month
              <select
                className={fieldClass}
                onChange={(event) =>
                  updateCalendarMonth(selectedYear, event.target.value)
                }
                value={selectedMonthNumber}
              >
                {calendarMonthOptions.map(([value, optionLabel]) => (
                  <option key={value} value={value}>
                    {optionLabel}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-bold">
              Year
              <select
                className={fieldClass}
                onChange={(event) =>
                  updateCalendarMonth(event.target.value, selectedMonthNumber)
                }
                value={selectedYear}
              >
                {calendarYearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        {schedules.length === 0 ? (
          <p className="mt-6 border-t border-dashed border-background-secondary py-8 text-center text-sm text-txt-secondary">
            No schedules have been created for this class.
          </p>
        ) : (
          <div
            className={`mt-6 grid gap-5 ${selectedSchedule ? "xl:grid-cols-[minmax(0,1fr)_340px]" : "grid-cols-1"}`}
          >
            <section
              aria-label={`${detail.title} schedule calendar`}
              className="min-w-0"
            >
              <div className="w-full overflow-hidden rounded-sm border border-background-secondary">
                <div className="grid grid-cols-7 border-b border-background-secondary bg-card-bg-secondary">
                  {calendarDayNames.map((day) => (
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

                    const daySchedules = schedulesByDate.get(day) ?? [];

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
                          {daySchedules.length > 0 ? (
                            daySchedules.map((schedule) => (
                              <button
                                className={`calendar-event-card calendar-event--class-schedule min-w-0 overflow-hidden rounded-sm px-2 py-1.5 text-left text-[11px] font-semibold leading-tight transition hover:brightness-95 sm:text-xs ${
                                  selectedSchedule?.id === schedule.id
                                    ? "ring-2 ring-primary ring-offset-1 ring-offset-card-bg-primary"
                                    : ""
                                }`}
                                key={schedule.id}
                                onClick={() =>
                                  setSelectedScheduleId(schedule.id)
                                }
                                type="button"
                              >
                                <span className="block truncate">
                                  {formatTime(schedule.start_time)} -{" "}
                                  {formatTime(schedule.end_time)}
                                </span>
                                <span className="mt-1 block truncate text-[10px] opacity-75 sm:text-[11px]">
                                  {schedule.trainer?.display_name ??
                                    "Assigned trainer"}
                                </span>
                              </button>
                            ))
                          ) : (
                            <span className="text-[11px] text-txt-secondary">
                              No schedule
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <p className="mt-4 text-center text-sm text-txt-secondary">
                Showing {visibleSchedules.length} schedules in{" "}
                {monthLabel(selectedMonth)}
              </p>
            </section>

            {selectedSchedule ? (
              <ScheduleDetailPanel
                item={selectedSchedule}
                onCancel={() => onCancelSchedule(selectedSchedule)}
                onComplete={() => onCompleteSchedule(selectedSchedule)}
                onDelete={() => onDeleteSchedule(selectedSchedule)}
                onEdit={() => onEditSchedule(selectedSchedule)}
                onClose={() => setSelectedScheduleId(null)}
              />
            ) : null}
          </div>
        )}
      </section>
    </article>
  );
}
