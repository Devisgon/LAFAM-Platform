"use client";

import Link from "next/link";
import { LoadingState } from "@/components/data-display/LoadingState";
import { Badge } from "@/components/ui/Badge";
import { useSchedules } from "../hooks/useSchedules";
import type {
  PublicPilatesSchedule,
  PublicScheduleFilters,
  PublicScheduleList,
} from "../api/schedulesApi";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  weekday: "short",
  year: "numeric",
});

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return dateFormatter.format(date);
}

function formatTime(value: string): string {
  return value.slice(0, 5);
}

function formatPrice(item: PublicPilatesSchedule): string {
  if (item.price_amount === null || item.price_amount === undefined || !item.currency) {
    return `${item.class.default_price_amount?.toFixed(3) ?? "0.000"} ${item.class.currency ?? "KWD"}`;
  }

  return `${item.price_amount.toFixed(3)} ${item.currency}`;
}

function availabilityLabel(item: PublicPilatesSchedule): string {
  const seats = item.availability.available_seats;

  if (seats <= 0) {
    return item.availability.waitlist_available ? "Waitlist open" : "Fully booked";
  }

  return `${seats} ${seats === 1 ? "seat" : "seats"} left`;
}

function sourceLabel(item: PublicPilatesSchedule): string {
  if (!item.generation_source) {
    return "Schedule";
  }

  return item.generation_source === "recurring" ? "Recurring class" : "Single class";
}

export function UserClassSchedules({
  filters,
  initialResult,
}: {
  filters: PublicScheduleFilters;
  initialResult?: PublicScheduleList;
}) {
  const schedules = useSchedules(filters, initialResult);

  return (
    <section id="class-schedules" className="rounded-2xl border border-background-secondary bg-card-bg-primary p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-txt-primary">Upcoming schedules</h2>
          <p className="mt-2 text-sm leading-6 text-txt-secondary">
            Choose from the next available class occurrences.
          </p>
        </div>
        <Badge tone="success">{schedules.total} available</Badge>
      </div>

      {schedules.error ? (
        <div className="mt-5 rounded-xl border border-error/30 bg-error/10 p-4">
          <p className="text-sm text-error" role="alert">
            {schedules.error}
          </p>
          <button
            className="mt-3 min-h-10 rounded-lg border border-error/30 px-4 text-sm font-bold"
            onClick={() => void schedules.load()}
            type="button"
          >
            Try again
          </button>
        </div>
      ) : null}

      {schedules.isLoading ? (
        <LoadingState className="mt-5 p-8" label="Loading Pilates schedules" />
      ) : schedules.items.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-background-secondary bg-card-bg-secondary p-6 text-center">
          <h3 className="text-base font-bold text-txt-primary">No upcoming schedules</h3>
          <p className="mt-2 text-sm text-txt-secondary">
            Please check back soon for new class times.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {schedules.items.map((item) => (
            <article
              className="grid gap-4 rounded-xl border border-background-secondary bg-card-bg-secondary p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
              key={item.id}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={item.availability.available_seats > 0 ? "success" : "warning"}>
                    {availabilityLabel(item)}
                  </Badge>
                  <span className="text-xs font-semibold text-txt-secondary">
                    {sourceLabel(item)}
                  </span>
                </div>
                <h3 className="mt-2 text-lg font-bold text-txt-primary">
                  {formatDate(item.class_date)}
                </h3>
                <p className="mt-1 text-sm text-txt-secondary">
                  {formatTime(item.start_time)} - {formatTime(item.end_time)} at {item.studio}
                </p>
                <p className="mt-2 text-sm font-semibold text-txt-primary">
                  {item.trainer.display_name} | {formatPrice(item)}
                </p>
              </div>
              <div className="grid gap-2">
                <Link
                  className="inline-flex min-h-10 items-center justify-center rounded-lg bg-button-primary px-5 py-2 text-sm font-bold text-txt-primary transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-disabled:pointer-events-none aria-disabled:opacity-50"
                  href={`/bookings/cart?schedule_id=${encodeURIComponent(item.id)}`}
                  aria-disabled={item.status !== "scheduled"}
                >
                  Book schedule
                </Link>
                <Link
                  className="inline-flex min-h-10 items-center justify-center rounded-lg border border-background-secondary px-5 py-2 text-sm font-bold text-txt-primary transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  href={`/services/pilates/schedules/${encodeURIComponent(item.id)}`}
                >
                  View schedule
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
