"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, CalendarClock, CreditCard, History, UserRound } from "lucide-react";
import { LoadingState } from "@/components/data-display/LoadingState";
import { Badge } from "@/components/ui/Badge";
import { useUserBookingDetail } from "../hooks/useUserBookings";
import type {
  UserBooking,
  UserBookingDetail,
} from "../api/userBookingsApi";

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function statusTone(status: string): "success" | "warning" | "error" | "neutral" {
  if (status === "confirmed" || status === "scheduled" || status === "paid") {
    return "success";
  }

  if (status === "cancelled" || status === "deleted" || status === "failed") {
    return "error";
  }

  if (status === "completed" || status === "not_required") {
    return "neutral";
  }

  return "warning";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not scheduled";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Not provided";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatTime(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : "--:--";
}

function formatPrice(item: UserBooking): string {
  if (item.price?.amount !== null && item.price?.amount !== undefined && item.price.currency) {
    return `${item.price.amount.toFixed(3)} ${item.price.currency}`;
  }

  return "Not configured";
}

function optional(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export function UserBookingDetailScreen({ bookingId }: { bookingId: string }) {
  const detail = useUserBookingDetail(bookingId);
  const booking = detail.booking;

  return (
    <div className="grid gap-6 text-txt-primary">
      <section className="rounded-2xl border border-background-secondary bg-card-bg-primary p-5 shadow-sm sm:p-6">
        <Link
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-background-secondary px-4 py-2 text-sm font-bold"
          href="/bookings"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to bookings
        </Link>
        <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-txt-secondary">
              Booking detail
            </p>
            <h1 className="mt-2 text-2xl font-bold">
              {booking?.booking_number ?? "Loading booking"}
            </h1>
          </div>
          {booking ? (
            <div className="flex flex-wrap gap-2">
              <Badge tone={statusTone(booking.status)}>{label(booking.status)}</Badge>
              <Badge tone={statusTone(booking.payment_status)}>
                {label(booking.payment_status)}
              </Badge>
            </div>
          ) : null}
        </div>
      </section>

      {detail.error ? (
        <section className="rounded-xl border border-error/30 bg-error/10 p-4">
          <p className="text-sm text-error" role="alert">
            {detail.error}
          </p>
        </section>
      ) : null}

      {detail.isLoading ? (
        <LoadingState className="rounded-2xl border border-background-secondary bg-card-bg-primary p-8" label="Loading booking details" />
      ) : null}

      {booking ? <BookingDetailContent booking={booking} /> : null}
    </div>
  );
}

function BookingDetailContent({ booking }: { booking: UserBookingDetail }) {
  return (
    <div className="grid gap-5">
      <DetailSection
        icon={<CalendarClock size={18} aria-hidden="true" />}
        items={[
          ["Booking number", booking.booking_number],
          ["Customer name", booking.customer?.full_name ?? "Customer"],
          ["Class name", booking.class?.title ?? "Class unavailable"],
          ["Trainer name", booking.trainer?.display_name ?? "Trainer unavailable"],
          ["Status", label(booking.status)],
          ["Payment status", label(booking.payment_status)],
          ["Payment required", optional(booking.payment_required)],
          ["Price", formatPrice(booking)],
          ["Created", formatDateTime(booking.created_at)],
          ["Updated", formatDateTime(booking.updated_at)],
        ]}
        title="Overview"
      />
      <DetailSection
        icon={<CalendarClock size={18} aria-hidden="true" />}
        items={[
          ["Studio", booking.schedule?.studio ?? null],
          ["Date", formatDate(booking.schedule?.class_date)],
          [
            "Time",
            booking.schedule
              ? `${formatTime(booking.schedule.start_time)} - ${formatTime(booking.schedule.end_time)}`
              : null,
          ],
          ["Duration", booking.schedule ? `${booking.schedule.duration_minutes} minutes` : null],
          ["Schedule capacity", booking.schedule?.capacity ?? null],
          ["Schedule status", booking.schedule?.status ? label(booking.schedule.status) : null],
          ["Cancellation reason", booking.schedule?.cancellation_reason ?? null],
          ["Schedule realtime version", booking.schedule?.realtime_version ?? null],
        ]}
        title="Schedule"
      />
      <DetailSection
        icon={<UserRound size={18} aria-hidden="true" />}
        items={[
          ["Class", booking.class?.title ?? null],
          ["Description", booking.class?.description ?? null],
          ["Level", booking.class?.level ? label(booking.class.level) : null],
          ["Class status", booking.class?.status ? label(booking.class.status) : null],
          ["Default duration", booking.class ? `${booking.class.duration_minutes} minutes` : null],
          ["Default capacity", booking.class ? `${booking.class.capacity} people` : null],
          ["Trainer", booking.trainer?.display_name ?? null],
          ["Trainer role", booking.trainer?.post_title ?? null],
          ["Trainer email", booking.trainer?.email ?? null],
          ["Trainer phone", booking.trainer?.phone ?? null],
        ]}
        title="Class and trainer"
      />
      {booking.availability ? (
        <DetailSection
          icon={<UserRound size={18} aria-hidden="true" />}
          items={[
            ["Capacity", booking.availability.capacity],
            ["Booked count", booking.availability.booked_count],
            ["Pending holds", booking.availability.pending_hold_count],
            ["Available seats", booking.availability.available_seats],
            ["Waitlist count", booking.availability.waitlist_count],
            ["Waitlist available", booking.availability.waitlist_available],
            ["Realtime version", booking.availability.schedule_realtime_version],
          ]}
          title="Availability"
        />
      ) : null}
      {booking.payment_state ? (
        <DetailSection
          icon={<CreditCard size={18} aria-hidden="true" />}
          items={[
            ["Checkout required", booking.payment_state.checkout_required],
            ["Payable", booking.payment_state.is_payable],
            ["Settled", booking.payment_state.is_settled],
            ["Failed", booking.payment_state.is_failed],
            ["Terminal", booking.payment_state.is_terminal],
            ["Hold expires", formatDateTime(booking.payment_state.hold_expires_at)],
            ["Latest payment", booking.payment_state.latest_payment?.payment_number ?? null],
          ]}
          title="Payment state"
        />
      ) : null}
      {booking.history.length > 0 ? (
        <section className="rounded-2xl border border-background-secondary bg-card-bg-primary p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-2">
            <History size={18} aria-hidden="true" className="text-primary" />
            <h2 className="text-xl font-bold">History</h2>
          </div>
          <div className="mt-4 grid gap-2">
            {booking.history.map((entry) => (
              <div className="rounded-xl bg-card-bg-secondary p-4 text-sm" key={entry.id}>
                <p className="font-semibold">{label(entry.action)}</p>
                <p className="mt-1 text-txt-secondary">
                  {optional(entry.from_status ? label(entry.from_status) : null)} to{" "}
                  {optional(entry.to_status ? label(entry.to_status) : null)} |{" "}
                  {formatDateTime(entry.created_at)}
                </p>
                {entry.notes ? <p className="mt-1 text-txt-secondary">{entry.notes}</p> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function DetailSection({
  icon,
  items,
  title,
}: {
  icon: ReactNode;
  items: Array<[string, string | number | boolean | null | undefined]>;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-background-secondary bg-card-bg-primary p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <h2 className="text-xl font-bold">{title}</h2>
      </div>
      <dl className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map(([term, value]) => (
          <div className="rounded-xl bg-card-bg-secondary p-4" key={term}>
            <dt className="text-xs font-bold uppercase tracking-[0.1em] text-txt-secondary">
              {term}
            </dt>
            <dd className="mt-1 break-words text-sm font-semibold">{optional(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
