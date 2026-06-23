"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { CalendarClock, Eye, XCircle } from "lucide-react";
import { DataTable } from "@/components/data-display/DataTable";
import { LoadingState } from "@/components/data-display/LoadingState";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useSchedules } from "@/modules/services/pilates";
import { getSafeErrorMessage } from "@/lib/error/handleError";
import { UserPrivateBookings } from "./UserPrivateBookings";
import {
  useCancelUserBooking,
  useRescheduleUserBooking,
  useUserBookings,
} from "../hooks/useUserBookings";
import type {
  UserBooking,
  UserBookingFilters,
  UserPrivateBookingFilters,
} from "../api/userBookingsApi";

const BOOKING_COLUMNS = [
  { heading: "Booking", key: "booking" },
  { heading: "Class", key: "class" },
  { heading: "Trainer", key: "trainer" },
  { heading: "Schedule", key: "schedule" },
  { heading: "Status", key: "status" },
  { heading: "Payment", key: "payment" },
  { heading: "Price", key: "price" },
  { heading: "Actions", key: "actions" },
];

type BookingView = "class" | "private";

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

function formatTime(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : "--:--";
}

function formatPrice(item: UserBooking): string {
  if (item.price?.amount !== null && item.price?.amount !== undefined && item.price.currency) {
    return `${item.price.amount.toFixed(3)} ${item.price.currency}`;
  }

  return "Not configured";
}

function canCancel(item: UserBooking): boolean {
  return item.status === "confirmed" || item.status === "pending_payment";
}

function canReschedule(item: UserBooking): boolean {
  return item.status === "confirmed";
}

export function UserBookings({
  filters,
  privateFilters,
}: {
  filters: UserBookingFilters;
  privateFilters: UserPrivateBookingFilters;
}) {
  const bookings = useUserBookings(filters);
  const cancelBooking = useCancelUserBooking();
  const rescheduleBooking = useRescheduleUserBooking();
  const scheduleOptions = useSchedules({ limit: 100, offset: 0 });
  const [reschedulingBooking, setReschedulingBooking] = useState<UserBooking | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [bookingView, setBookingView] = useState<BookingView>("class");

  const handleCancel = async (item: UserBooking) => {
    const reason = window.prompt("Why do you want to cancel this booking?");

    if (reason === null) return;

    setActionError(null);

    try {
      await cancelBooking.mutateAsync({
        bookingId: item.id,
        payload: { reason: reason.trim() || undefined },
      });
    } catch (error: unknown) {
      setActionError(getSafeErrorMessage(error));
    }
  };

  const handleReschedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!reschedulingBooking) return;

    const formData = new FormData(event.currentTarget);
    const targetScheduleId = String(formData.get("target_schedule_id") ?? "").trim();
    const reason = String(formData.get("reason") ?? "").trim();
    const joinWaitlistIfFull = formData.get("join_waitlist_if_full") === "on";

    if (!targetScheduleId) {
      setActionError("Please choose a target schedule.");
      return;
    }

    setActionError(null);

    try {
      await rescheduleBooking.mutateAsync({
        bookingId: reschedulingBooking.id,
        payload: {
          target_schedule_id: targetScheduleId,
          join_waitlist_if_full: joinWaitlistIfFull,
          reason: reason || undefined,
        },
      });
      setReschedulingBooking(null);
    } catch (error: unknown) {
      setActionError(getSafeErrorMessage(error));
    }
  };

  return (
    <div className="grid gap-6 text-txt-primary">
      <section className="rounded-2xl border border-background-secondary bg-card-bg-primary p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold">My bookings</h1>
        <p className="mt-2 text-sm leading-6 text-txt-secondary">
          Review your class bookings, open full booking details, cancel, or move a confirmed booking to another available schedule.
        </p>
        <div className="mt-5 inline-flex min-h-11 overflow-hidden rounded-lg border border-background-secondary bg-card-bg-secondary p-1">
          {(["class", "private"] as const).map((view) => (
            <button
              className={`rounded-md px-4 text-sm font-bold transition ${
                bookingView === view
                  ? "bg-button-primary text-txt-primary"
                  : "text-txt-secondary hover:text-txt-primary"
              }`}
              key={view}
              onClick={() => setBookingView(view)}
              type="button"
            >
              {view === "class" ? "Class bookings" : "Private bookings"}
            </button>
          ))}
        </div>
        <form
          action="/bookings"
          className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(150px,1fr)_minmax(150px,1fr)_minmax(150px,1fr)_minmax(150px,1fr)_minmax(180px,1fr)_auto]"
          method="get"
        >
          <label className="grid gap-1.5 text-xs font-bold">
            Status
            <select
              className="min-h-11 rounded-lg border border-background-secondary bg-card-bg-secondary px-3 text-sm text-txt-primary outline-none focus:border-primary"
              defaultValue={filters.status ?? ""}
              name="status"
            >
              <option value="">All bookings</option>
              <option value="pending_payment">Pending payment</option>
              <option value="confirmed">Confirmed</option>
              <option value="cancelled">Cancelled</option>
              <option value="completed">Completed</option>
              <option value="no_show">No show</option>
              <option value="expired">Expired</option>
              <option value="rescheduled">Rescheduled</option>
              <option value="deleted">Deleted</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-bold">
            From date
            <input
              className="min-h-11 rounded-lg border border-background-secondary bg-card-bg-secondary px-3 text-sm text-txt-primary outline-none focus:border-primary"
              defaultValue={filters.from_date}
              name="from_date"
              type="date"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-bold">
            To date
            <input
              className="min-h-11 rounded-lg border border-background-secondary bg-card-bg-secondary px-3 text-sm text-txt-primary outline-none focus:border-primary"
              defaultValue={filters.to_date}
              name="to_date"
              type="date"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-bold">
            Private trainer ID
            <input
              className="min-h-11 rounded-lg border border-background-secondary bg-card-bg-secondary px-3 text-sm text-txt-primary outline-none focus:border-primary"
              disabled={bookingView !== "private"}
              defaultValue={privateFilters.trainer_staff_profile_id}
              name="trainer_staff_profile_id"
              placeholder="trainer_staff_profile_id"
              type="text"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-bold">
            Sort
            <select
              className="min-h-11 rounded-lg border border-background-secondary bg-card-bg-secondary px-3 text-sm text-txt-primary outline-none focus:border-primary"
              defaultValue={filters.sort_by}
              name="sort_by"
            >
              <option value="created_at">Created</option>
              <option value="schedule_date">Schedule date</option>
              <option value="start_time">Start time</option>
              <option value="status">Status</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <input name="sort_direction" type="hidden" value={filters.sort_direction} />
            <Button type="submit">Apply</Button>
          </div>
        </form>
      </section>

      {actionError ? (
        bookingView === "class" ? <section className="rounded-xl border border-error/30 bg-error/10 p-4">
          <p className="text-sm text-error" role="alert">
            {actionError}
          </p>
        </section> : null
      ) : null}

      {bookingView === "class" ? (
      <section className="rounded-2xl border border-background-secondary bg-card-bg-primary shadow-sm">
        {bookings.error ? (
          <div className="p-5">
            <p className="text-sm text-error" role="alert">
              {bookings.error}
            </p>
            <Button className="mt-3" onClick={() => void bookings.load()} variant="outline">
              Try again
            </Button>
          </div>
        ) : bookings.isLoading ? (
          <LoadingState className="p-8" label="Loading bookings" />
        ) : (
          <DataTable
            columns={BOOKING_COLUMNS}
            emptyMessage="You do not have any bookings yet."
            isEmpty={bookings.bookings.length === 0}
            minWidthClassName="min-w-[1120px]"
          >
            {bookings.bookings.map((item) => (
              <tr className="divide-x divide-background-secondary" key={item.id}>
                <td className="px-4 py-3 text-sm font-semibold">{item.booking_number}</td>
                <td className="px-4 py-3 text-sm">{item.class?.title ?? "Class unavailable"}</td>
                <td className="px-4 py-3 text-sm">{item.trainer?.display_name ?? "Trainer unavailable"}</td>
                <td className="px-4 py-3 text-sm">
                  <span className="block font-semibold">{formatDate(item.schedule?.class_date)}</span>
                  <span className="text-xs text-txt-secondary">
                    {formatTime(item.schedule?.start_time)} - {formatTime(item.schedule?.end_time)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <Badge tone={statusTone(item.status)}>{label(item.status)}</Badge>
                </td>
                <td className="px-4 py-3 text-sm">
                  <Badge tone={statusTone(item.payment_status)}>
                    {label(item.payment_status)}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm">{formatPrice(item)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      aria-label={`View booking ${item.booking_number}`}
                      className="inline-flex min-h-8 items-center justify-center rounded-lg border border-background-secondary px-3 py-1 text-sm font-semibold text-txt-primary transition hover:bg-background-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      href={`/bookings/${encodeURIComponent(item.id)}`}
                      title="View booking"
                    >
                      <Eye size={16} aria-hidden="true" />
                    </Link>
                    <Button
                      aria-label={`Reschedule booking ${item.booking_number}`}
                      disabled={!canReschedule(item)}
                      onClick={() => setReschedulingBooking(item)}
                      size="sm"
                      variant="secondary"
                      title="Reschedule booking"
                    >
                      <CalendarClock size={16} aria-hidden="true" />
                      <span className="sr-only">Reschedule booking</span>
                    </Button>
                    <Button
                      aria-label={`Cancel booking ${item.booking_number}`}
                      disabled={!canCancel(item)}
                      loading={cancelBooking.isPending}
                      onClick={() => void handleCancel(item)}
                      size="sm"
                      variant="danger"
                      title="Cancel booking"
                    >
                      <XCircle size={16} aria-hidden="true" />
                      <span className="sr-only">Cancel booking</span>
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>
      ) : null}

      {bookingView === "class" && reschedulingBooking ? (
        <section className="rounded-2xl border border-background-secondary bg-card-bg-primary p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Reschedule booking</h2>
              <p className="mt-2 text-sm text-txt-secondary">
                Move {reschedulingBooking.class?.title ?? reschedulingBooking.booking_number} to another schedule.
              </p>
            </div>
            <Button onClick={() => setReschedulingBooking(null)} variant="ghost">
              Close
            </Button>
          </div>
          <form className="mt-5 grid gap-4" onSubmit={(event) => void handleReschedule(event)}>
            <label className="grid gap-1.5 text-sm font-semibold">
              Target schedule
              <select
                className="min-h-11 w-full rounded-lg border border-background-secondary bg-card-bg-secondary px-3 text-sm text-txt-primary outline-none focus:border-primary"
                disabled={scheduleOptions.isLoading || rescheduleBooking.isPending}
                name="target_schedule_id"
                required
              >
                <option value="">Choose a schedule</option>
                {scheduleOptions.items.map((schedule) => (
                  <option key={schedule.id} value={schedule.id}>
                    {schedule.class.title} | {formatDate(schedule.class_date)} |{" "}
                    {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)} |{" "}
                    {schedule.trainer.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Reason
              <textarea
                className="min-h-24 rounded-lg border border-background-secondary bg-card-bg-secondary px-3 py-2 text-sm text-txt-primary outline-none focus:border-primary"
                maxLength={500}
                name="reason"
                placeholder="Customer requested a different time slot."
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input name="join_waitlist_if_full" type="checkbox" />
              Join waitlist if the target schedule is full
            </label>
            <div className="flex flex-wrap gap-2">
              <Button loading={rescheduleBooking.isPending} type="submit">
                Reschedule
              </Button>
              <Button onClick={() => setReschedulingBooking(null)} variant="outline">
                Cancel
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      {bookingView === "private" ? (
        <UserPrivateBookings filters={privateFilters} />
      ) : null}
    </div>
  );
}
