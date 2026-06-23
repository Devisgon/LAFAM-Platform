import { BookingCart } from "@/modules/bookings";
import { publicSchedulesClient } from "@/modules/services/pilates";

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BookingCartPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const scheduleId = firstParam((await searchParams).schedule_id);

  if (!scheduleId) {
    return (
      <section className="rounded-2xl border border-error/30 bg-card-bg-primary p-8 text-center">
        <h1 className="text-xl font-bold text-txt-primary">Schedule required</h1>
        <p className="mt-2 text-sm text-txt-secondary">
          Please choose a Pilates schedule before confirming a booking.
        </p>
      </section>
    );
  }

  const schedule = await publicSchedulesClient.get(scheduleId).catch(() => null);

  if (!schedule) {
    return (
      <section className="rounded-2xl border border-error/30 bg-card-bg-primary p-8 text-center">
        <h1 className="text-xl font-bold text-txt-primary">Schedule unavailable</h1>
        <p className="mt-2 text-sm text-txt-secondary">
          This Pilates schedule could not be found or is no longer available.
        </p>
      </section>
    );
  }

  return <BookingCart schedule={schedule} />;
}
