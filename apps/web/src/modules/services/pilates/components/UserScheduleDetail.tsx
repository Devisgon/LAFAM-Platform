import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type { PublicPilatesSchedule } from "../api/schedulesApi";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  weekday: "long",
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

function formatLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatPrice(item: PublicPilatesSchedule): string {
  if (item.price_amount === null || item.price_amount === undefined || !item.currency) {
    return `${item.class.default_price_amount?.toFixed(3) ?? "0.000"} ${item.class.currency ?? "KWD"}`;
  }

  return `${item.price_amount.toFixed(3)} ${item.currency}`;
}

function availabilityTone(item: PublicPilatesSchedule): "success" | "warning" {
  return item.availability.available_seats > 0 ? "success" : "warning";
}

function statusTone(status: string): "success" | "warning" | "error" {
  if (status === "scheduled" || status === "available") return "success";
  if (status === "cancelled" || status === "deleted") return "error";
  return "warning";
}

export function UserScheduleDetail({ schedule }: { schedule: PublicPilatesSchedule }) {
  const generationSource = schedule.generation_source
    ? formatLabel(schedule.generation_source)
    : "Not provided";
  const specialties =
    schedule.trainer.specialties.length > 0
      ? schedule.trainer.specialties.join(", ")
      : "Not provided";

  return (
    <article className="grid gap-6 text-txt-primary">
      <section className="overflow-hidden rounded-2xl border border-background-secondary bg-card-bg-primary shadow-sm">
        <div className="grid lg:grid-cols-[minmax(260px,0.75fr)_minmax(0,1.25fr)]">
          <div className="min-h-72 bg-primary/10 lg:min-h-[420px]">
            {schedule.class.image_url ? (
              // Public storage URLs are runtime data and intentionally avoid a broad image allowlist.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt=""
                className="h-full min-h-52 w-full object-cover lg:min-h-[420px]"
                decoding="async"
                height="840"
                src={schedule.class.image_url}
                width="840"
              />
            ) : (
              <div className="flex h-full min-h-72 items-center justify-center text-xl font-bold text-primary lg:min-h-[420px]">
                Pilates
              </div>
            )}
          </div>

          <div className="p-6 sm:p-8 lg:p-10">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={availabilityTone(schedule)}>
                {schedule.availability.available_seats} seats left
              </Badge>
              <Badge tone={statusTone(schedule.status)}>
                {formatLabel(schedule.status)}
              </Badge>
            </div>
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-txt-secondary">
              Pilates schedule
            </p>
            <h1 className="mt-2 text-3xl font-bold">{schedule.class.title}</h1>
            <p className="mt-4 text-sm leading-7 text-txt-secondary">
              {formatDate(schedule.class_date)} from {formatTime(schedule.start_time)} to{" "}
              {formatTime(schedule.end_time)} at {schedule.studio}
            </p>

            <dl className="mt-8 grid gap-3 sm:grid-cols-2">
              <Detail label="Trainer" value={schedule.trainer.display_name} />
              <Detail label="Trainer role" value={schedule.trainer.post_title} />
              <Detail label="Duration" value={`${schedule.duration_minutes} minutes`} />
              <Detail label="Capacity" value={`${schedule.capacity} people`} />
              <Detail label="Price" value={formatPrice(schedule)} />
              <Detail label="Level" value={formatLabel(schedule.class.level)} />
              <Detail label="Class type" value={generationSource} />
              <Detail
                label="Waitlist"
                value={schedule.availability.waitlist_available ? "Available" : "Unavailable"}
              />
            </dl>

            <div className="mt-8 grid gap-3 border-t border-background-secondary pt-6">
              <Link
                aria-disabled={schedule.status !== "scheduled"}
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-button-primary px-5 text-sm font-bold text-txt-primary transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-disabled:pointer-events-none aria-disabled:opacity-50"
                href={`/bookings/cart?schedule_id=${encodeURIComponent(schedule.id)}`}
              >
                Book schedule
              </Link>
              <div className="flex flex-wrap gap-3">
                <Link
                  className="inline-flex min-h-11 items-center rounded-lg border border-background-secondary px-5 text-sm font-bold"
                  href={`/services/pilates/${schedule.class.id}`}
                >
                  Back to class
                </Link>
                <Link
                  className="inline-flex min-h-11 items-center rounded-lg border border-background-secondary px-5 text-sm font-bold"
                  href="/services/pilates"
                >
                  All classes
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-background-secondary bg-card-bg-primary p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-bold">Schedule details</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Studio" value={schedule.studio} />
          <Detail label="Class date" value={schedule.class_date} />
          <Detail label="Start time" value={schedule.start_time} />
          <Detail label="End time" value={schedule.end_time} />
          <Detail label="Duration" value={`${schedule.duration_minutes} minutes`} />
          <Detail label="Capacity" value={String(schedule.capacity)} />
          <Detail label="Status" value={formatLabel(schedule.status)} />
          <Detail label="Generation source" value={generationSource} />
        </dl>
      </section>

      <section className="rounded-2xl border border-background-secondary bg-card-bg-primary p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-bold">Class details</h2>
        <p className="mt-3 whitespace-pre-line text-sm leading-7 text-txt-secondary">
          {schedule.class.description ?? "No description has been provided for this class."}
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Title" value={schedule.class.title} />
          <Detail
            label="Price amount"
            value={`${schedule.class.default_price_amount?.toFixed(3) ?? "0.000"} ${schedule.class.currency ?? "KWD"}`}
          />
          <Detail label="Level" value={formatLabel(schedule.class.level)} />
        </dl>
      </section>

      <section className="rounded-2xl border border-background-secondary bg-card-bg-primary p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-bold">Trainer details</h2>
          <Badge tone={statusTone(schedule.trainer.status)}>
            {formatLabel(schedule.trainer.status)}
          </Badge>
        </div>
        <p className="mt-3 whitespace-pre-line text-sm leading-7 text-txt-secondary">
          {schedule.trainer.bio ?? "No trainer bio has been provided."}
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Display name" value={schedule.trainer.display_name} />
          <Detail label="Specialties" value={specialties} />
          <Detail label="Status" value={formatLabel(schedule.trainer.status)} />
        </dl>
      </section>

      <section className="rounded-2xl border border-background-secondary bg-card-bg-primary p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-bold">Availability details</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Availability capacity" value={String(schedule.availability.capacity)} />
          <Detail label="Booked count" value={String(schedule.availability.booked_count)} />
          <Detail label="Available seats" value={String(schedule.availability.available_seats)} />
          <Detail label="Waitlist count" value={String(schedule.availability.waitlist_count)} />
        </dl>
      </section>
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card-bg-secondary p-4">
      <dt className="text-xs font-bold uppercase tracking-[0.1em] text-txt-secondary">
        {label}
      </dt>
      <dd className="mt-1 break-words text-base font-bold text-txt-primary">{value}</dd>
    </div>
  );
}
