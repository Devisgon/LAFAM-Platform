"use client";

import Link from "next/link";
import { ClassCard } from "@/components/data-display/ClassCard";
import { LoadingState } from "@/components/data-display/LoadingState";
import { useClasses } from "@/modules/bookings";
import type {
  PublicClassFilters,
  PublicClassList,
} from "@/modules/bookings";

const fieldClass =
  "min-h-11 w-full rounded-lg border border-background-secondary bg-card-bg-secondary px-3 text-sm text-txt-primary outline-none focus:border-primary";

export function UserClasses({
  filters,
  initialResult,
}: {
  filters: PublicClassFilters;
  initialResult?: PublicClassList;
}) {
  const classes = useClasses(filters, initialResult);

  return (
    <div className="grid gap-6 text-txt-primary">
      <section className="rounded-2xl border border-background-secondary bg-card-bg-primary p-5 shadow-sm sm:p-6">
        <div>
        
          <h2 className="mt-2 text-2xl font-bold">Find your next class</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-txt-secondary">
            Explore active Pilates classes and narrow the catalogue by level or
            scheduled date.
          </p>
        </div>

        <form
          action="/services/pilates"
          className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,2fr)_minmax(150px,1fr)_minmax(150px,1fr)_minmax(150px,1fr)_auto] xl:items-end"
          method="get"
        >
          <label className="grid gap-1.5 text-xs font-bold">
            Search
            <input
              className={fieldClass}
              defaultValue={filters.search}
              maxLength={160}
              name="search"
              placeholder="Search title or description"
              type="search"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-bold">
            Level
            <select className={fieldClass} defaultValue={filters.level ?? ""} name="level">
              <option value="">All levels</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="all_levels">All levels</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-bold">
            From date
            <input className={fieldClass} defaultValue={filters.from_date} name="from_date" type="date" />
          </label>
          <label className="grid gap-1.5 text-xs font-bold">
            To date
            <input className={fieldClass} defaultValue={filters.to_date} name="to_date" type="date" />
          </label>
          <div className="flex gap-2">
            <button className="min-h-11 rounded-lg bg-button-primary px-5 text-sm font-bold" type="submit">
              Apply
            </button>
            <Link className="inline-flex min-h-11 items-center rounded-lg border border-background-secondary px-4 text-sm font-bold" href="/services/pilates">
              Clear
            </Link>
          </div>
        </form>
      </section>

      {classes.error ? (
        <section className="rounded-xl border border-error/30 bg-error/10 p-4">
          <p className="text-sm text-error" role="alert">{classes.error}</p>
          <button className="mt-3 min-h-10 rounded-lg border border-error/30 px-4 text-sm font-bold" onClick={() => void classes.load()} type="button">
            Try again
          </button>
        </section>
      ) : null}

      {classes.isLoading ? (
        <LoadingState className="p-8" label="Loading Pilates classes" />
      ) : classes.items.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-background-secondary bg-card-bg-primary p-10 text-center">
          <h2 className="text-lg font-bold">No classes match these filters</h2>
          <p className="mt-2 text-sm text-txt-secondary">
            Try a different level, search phrase, or date range.
          </p>
        </section>
      ) : (
        <section aria-label="Available Pilates classes" className="grid gap-5">
          <p className="text-sm text-txt-secondary">
            {classes.total} {classes.total === 1 ? "class" : "classes"} found
          </p>
          {classes.items.map((item) => (
            <ClassCard
              actionHref={`/services/pilates/${item.id}`}
              actionLabel="View class"
              item={item}
              key={item.id}
            />
          ))}
        </section>
      )}
    </div>
  );
}
