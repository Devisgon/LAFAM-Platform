import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { UserClassSchedules } from "./UserClassSchedules";
import type { PublicPilatesClass } from "../api/classesApi";
import type { PublicScheduleList } from "../api/schedulesApi";

function label(value: string): string {
  return value.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

export function UserClassDetail({
  initialSchedules,
  item,
}: {
  initialSchedules?: PublicScheduleList;
  item: PublicPilatesClass;
}) {
  const price =
    item.default_price_amount !== undefined && item.currency
      ? `${item.default_price_amount.toFixed(3)} ${item.currency}`
      : "Contact us";

  return (
    <div className="grid gap-6">
      <article className="overflow-hidden rounded-2xl border border-background-secondary bg-card-bg-primary shadow-sm">
        <div className="grid lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
          <div className="min-h-72 bg-primary/10 lg:min-h-[440px]">
            {item.image_url ? (
              // Runtime public storage URLs avoid a broad remote image allowlist.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt=""
                className="h-full min-h-72 w-full object-cover lg:min-h-[440px]"
                decoding="async"
                height="880"
                src={item.image_url}
                width="880"
              />
            ) : (
              <div className="flex h-full min-h-72 items-center justify-center text-xl font-bold text-primary lg:min-h-[440px]">
                Pilates
              </div>
            )}
          </div>

          <div className="p-6 sm:p-8 lg:p-10">
            <Badge tone="success">Available</Badge>
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-txt-secondary">
              Pilates class
            </p>
            <h1 className="mt-2 text-3xl font-bold text-txt-primary">{item.title}</h1>
            <p className="mt-4 whitespace-pre-line text-sm leading-7 text-txt-secondary">
              {item.description ?? "No description has been provided for this class."}
            </p>

            <dl className="mt-8 grid gap-3 sm:grid-cols-2">
              <Detail label="Duration" value={`${item.default_duration_minutes} minutes`} />
              <Detail label="Class capacity" value={`${item.default_capacity} people`} />
              <Detail label="Level" value={label(item.level)} />
              <Detail label="Price per booking" value={price} />
            </dl>

            <div className="mt-8 flex flex-wrap gap-3 border-t border-background-secondary pt-6">
              <Link className="inline-flex min-h-11 items-center rounded-lg bg-button-primary px-5 text-sm font-bold text-txt-primary transition hover:opacity-90" href="#class-schedules">
                View schedules
              </Link>
              <Link className="inline-flex min-h-11 items-center rounded-lg border border-background-secondary px-5 text-sm font-bold text-txt-primary" href="/services/pilates">
                Back to classes
              </Link>
            </div>
          </div>
        </div>
      </article>

      <UserClassSchedules
        filters={{ class_id: item.id, only_available: false }}
        initialResult={initialSchedules}
      />
    </div>
  );
}

function Detail({ label: term, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card-bg-secondary p-4">
      <dt className="text-xs font-bold uppercase tracking-[0.1em] text-txt-secondary">{term}</dt>
      <dd className="mt-1 text-base font-bold text-txt-primary">{value}</dd>
    </div>
  );
}
