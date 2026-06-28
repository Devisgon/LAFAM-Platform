import Link from "next/link";
import { Badge } from "@/components/ui/Badge";

export type ClassCardItem = {
  id: string;
  title: string;
  description: string | null;
  default_duration_minutes: number;
  default_capacity: number;
  default_price_amount?: number;
  currency?: string;
  level: string;
  image_url: string | null;
  status?: string;
};

export type ClassCardBookingSummary = {
  availableSeats: number;
  bookedCount: number;
  capacity: number;
};

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function statusTone(status: string): "success" | "warning" | "error" {
  if (status === "active") return "success";
  if (status === "deleted") return "error";
  return "warning";
}

function price(item: ClassCardItem): string {
  if (item.default_price_amount === undefined || !item.currency) {
    return "Contact us for pricing";
  }

  return `${item.default_price_amount.toFixed(3)} ${item.currency}`;
}

export function ClassCard({
  actionHref,
  actionLabel,
  bookingSummary,
  item,
}: {
  actionHref: string;
  actionLabel: string;
  bookingSummary?: ClassCardBookingSummary;
  item: ClassCardItem;
}) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-background-secondary bg-card-bg-primary shadow-sm before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-primary">
      <div className="grid gap-5 p-5 pl-6 sm:grid-cols-[168px_minmax(0,1fr)_auto] sm:items-center">
        <div className="overflow-hidden rounded-lg bg-primary/10">
          {item.image_url ? (
            // Public storage URLs are runtime data and intentionally avoid a broad image allowlist.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt=""
              className="h-28 w-full object-cover"
              decoding="async"
              height="224"
              loading="lazy"
              src={item.image_url}
              width="336"
            />
          ) : (
            <div className="flex h-28 items-center justify-center text-sm font-bold text-primary">
              Pilates
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {item.status ? (
              <Badge tone={statusTone(item.status)}>{label(item.status)}</Badge>
            ) : (
              <Badge tone="success">Available</Badge>
            )}
            <span className="text-xs text-txt-secondary">Pilates</span>
            {bookingSummary ? (
              <>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-txt-primary">
                  {bookingSummary.availableSeats}{" "}
                  {bookingSummary.availableSeats === 1 ? "seat" : "seats"} left
                </span>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-txt-primary">
                  {bookingSummary.bookedCount}/{bookingSummary.capacity} booked
                </span>
              </>
            ) : null}
          </div>
          <h3 className="mt-2 text-xl font-bold text-txt-primary">{item.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-txt-secondary">
            {item.description ?? "No description provided."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-txt-primary">
            <span className="rounded-lg bg-primary/10 px-3 py-2">
              {item.default_duration_minutes} minutes
            </span>
            <span className="rounded-lg bg-primary/10 px-3 py-2">
              {item.default_capacity} capacity
            </span>
            <span className="rounded-lg bg-primary/10 px-3 py-2">
              Price per booking: {price(item)}
            </span>
            <span className="rounded-lg bg-primary/10 px-3 py-2">
              Level: {label(item.level)}
            </span>
          </div>
        </div>

        <Link
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-button-primary px-5 py-2 text-sm font-bold text-txt-primary transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          href={actionHref}
        >
          {actionLabel}
        </Link>
      </div>
    </article>
  );
}
