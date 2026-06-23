"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { CalendarClock, Eye, XCircle } from "lucide-react";
import { DataTable } from "@/components/data-display/DataTable";
import { LoadingState } from "@/components/data-display/LoadingState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getSafeErrorMessage } from "@/lib/error/handleError";
import { useSchedules } from "@/modules/services/pilates";
import {
  useCreateUserPrivateBooking,
  useCancelUserPrivateBooking,
  useRescheduleUserPrivateBooking,
  useUserPrivateBookings,
} from "../hooks/useUserBookings";
import { userPrivateBookingsClient } from "../api/userBookingsApi";
import type {
  UserPrivateBooking,
  UserPrivateBookingFilters,
  UserPrivateTrainerAvailabilityResult,
  UserPrivateTrainerAvailabilitySlot,
} from "../api/userBookingsApi";

const PRIVATE_BOOKING_COLUMNS = [
  { heading: "Booking", key: "booking" },
  { heading: "Customer", key: "customer" },
  { heading: "Trainer", key: "trainer" },
  { heading: "Session", key: "session" },
  { heading: "Status", key: "status" },
  { heading: "Payment", key: "payment" },
  { heading: "Price", key: "price" },
  { heading: "Actions", key: "actions" },
];

type PrivateBookingScreen = "list" | "create";

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function statusTone(status: string): "success" | "warning" | "error" | "neutral" {
  if (status === "confirmed" || status === "paid") return "success";
  if (status === "cancelled" || status === "deleted" || status === "failed") {
    return "error";
  }
  if (status === "completed" || status === "not_required") return "neutral";
  return "warning";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not scheduled";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatTime(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : "--:--";
}

function dateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultToDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return dateInputValue(date);
}

function formatPrice(item: UserPrivateBooking): string {
  if (
    item.price?.amount !== null &&
    item.price?.amount !== undefined &&
    item.price.currency
  ) {
    return `${item.price.amount.toFixed(3)} ${item.price.currency}`;
  }

  if (item.price_amount !== null && item.price_amount !== undefined) {
    return `${item.price_amount.toFixed(3)} ${item.currency ?? "KWD"}`;
  }

  return "Not configured";
}

function displayCustomerName(item: UserPrivateBooking): string {
  return (
    item.customer?.full_name ??
    item.customer?.email ??
    item.customer?.phone ??
    "Customer"
  );
}

function canCancel(item: UserPrivateBooking): boolean {
  return item.status === "confirmed" || item.status === "pending_payment";
}

function canReschedule(item: UserPrivateBooking): boolean {
  return item.status === "confirmed";
}

function buildRescheduleKey(item: UserPrivateBooking, date: string, time: string): string {
  return [
    "private-reschedule",
    item.id.slice(0, 8),
    date,
    time.replace(":", "-"),
  ].join("-");
}

function slotKey(slot: UserPrivateTrainerAvailabilitySlot): string {
  return `${slot.session_date}|${slot.start_time}|${slot.end_time}`;
}

function availabilityReason(reason: string | null): string {
  if (reason === "past_slot") return "This time has already passed.";
  if (reason === "trainer_not_available") {
    return "Trainer is outside their configured working hours.";
  }
  if (reason === "pilates_class_schedule_conflict") {
    return "Trainer already has a Pilates class at this time.";
  }
  if (reason === "private_booking_conflict") {
    return "Trainer already has another private booking at this time.";
  }
  return "Trainer is unavailable at this time.";
}

function buildCreateKey(slot: UserPrivateTrainerAvailabilitySlot): string {
  return [
    "private-booking",
    slot.trainer_staff_profile_id.slice(0, 8),
    slot.session_date,
    slot.start_time.replace(":", "-"),
  ].join("-");
}

export function UserPrivateBookings({
  filters,
}: {
  filters: UserPrivateBookingFilters;
}) {
  const bookings = useUserPrivateBookings(filters);
  const createBooking = useCreateUserPrivateBooking();
  const cancelBooking = useCancelUserPrivateBooking();
  const rescheduleBooking = useRescheduleUserPrivateBooking();
  const trainerSchedules = useSchedules({
    limit: 100,
    offset: 0,
    only_available: true,
    sort_by: "class_date",
    sort_direction: "asc",
  });
  const [reschedulingBooking, setReschedulingBooking] =
    useState<UserPrivateBooking | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [availability, setAvailability] =
    useState<UserPrivateTrainerAvailabilityResult | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [selectedSlotKey, setSelectedSlotKey] = useState("");
  const [createdMessage, setCreatedMessage] = useState<string | null>(null);
  const [bookingStudio, setBookingStudio] = useState("LAFAM Pilates Studio");
  const [bookingPaymentRequired, setBookingPaymentRequired] = useState(true);
  const [screen, setScreen] = useState<PrivateBookingScreen>("list");

  const trainerOptions = useMemo(() => {
    const trainers = new Map<string, string>();

    trainerSchedules.items.forEach((schedule) => {
      if (!schedule.trainer?.id) return;

      trainers.set(
        schedule.trainer.id,
        `${schedule.trainer.display_name}${schedule.trainer.post_title ? ` - ${schedule.trainer.post_title}` : ""}`,
      );
    });

    return Array.from(trainers.entries());
  }, [trainerSchedules.items]);

  const availableSlots = useMemo(
    () => availability?.slots.filter((slot) => slot.available) ?? [],
    [availability],
  );

  const selectedSlot =
    availableSlots.find((slot) => slotKey(slot) === selectedSlotKey) ?? null;

  const handleCheckAvailability = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const trainerStaffProfileId = String(
      formData.get("trainer_staff_profile_id") ?? "",
    ).trim();
    const fromDate = String(formData.get("from_date") ?? "").trim();
    const toDate = String(formData.get("to_date") ?? "").trim();
    const durationMinutes = Number(formData.get("duration_minutes") ?? 60);
    const studio = bookingStudio.trim();

    if (!trainerStaffProfileId || !fromDate || !toDate) {
      setAvailabilityError("Please choose a trainer and date range.");
      return;
    }

    if (!Number.isInteger(durationMinutes) || durationMinutes < 15) {
      setAvailabilityError("Duration must be at least 15 minutes.");
      return;
    }

    setAvailability(null);
    setAvailabilityError(null);
    setSelectedSlotKey("");
    setCreatedMessage(null);
    setIsCheckingAvailability(true);

    try {
      const result = await userPrivateBookingsClient.availability(
        trainerStaffProfileId,
        {
          from_date: fromDate,
          to_date: toDate,
          duration_minutes: durationMinutes,
          ...(studio ? { studio } : {}),
        },
      );
      setAvailability(result);
      if (result.slots.find((slot) => slot.available)) {
        setSelectedSlotKey(slotKey(result.slots.find((slot) => slot.available)!));
      }
    } catch (error: unknown) {
      setAvailabilityError(getSafeErrorMessage(error));
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  const handleCreatePrivateBooking = async () => {
    if (!selectedSlot) {
      setAvailabilityError("Choose an available slot before creating.");
      return;
    }

    const studio = bookingStudio.trim() || "LAFAM Pilates Studio";

    setAvailabilityError(null);
    setCreatedMessage(null);

    try {
      const result = await createBooking.mutateAsync({
        trainer_staff_profile_id: selectedSlot.trainer_staff_profile_id,
        session_date: selectedSlot.session_date,
        start_time: selectedSlot.start_time.slice(0, 5),
        duration_minutes: selectedSlot.duration_minutes,
        studio,
        payment_required: bookingPaymentRequired,
        idempotency_key: buildCreateKey(selectedSlot),
      });
      setCreatedMessage(
        `${result.private_booking.booking_number} was created successfully.`,
      );
      setAvailability(null);
      setSelectedSlotKey("");
      setScreen("list");
    } catch (error: unknown) {
      setAvailabilityError(getSafeErrorMessage(error));
    }
  };

  const handleCancel = async (item: UserPrivateBooking) => {
    const reason = window.prompt("Why do you want to cancel this booking?");

    if (reason === null) return;

    setActionError(null);

    try {
      await cancelBooking.mutateAsync({
        privateBookingId: item.id,
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
    const targetSessionDate = String(
      formData.get("target_session_date") ?? "",
    ).trim();
    const targetStartTime = String(formData.get("target_start_time") ?? "").trim();
    const durationValue = Number(formData.get("target_duration_minutes"));
    const studio = String(formData.get("studio") ?? "").trim();
    const reason = String(formData.get("reason") ?? "").trim();
    const paymentRequired = formData.get("payment_required") === "true";

    if (!targetSessionDate || !targetStartTime) {
      setActionError("Please choose a target date and start time.");
      return;
    }

    setActionError(null);

    try {
      await rescheduleBooking.mutateAsync({
        privateBookingId: reschedulingBooking.id,
        payload: {
          target_session_date: targetSessionDate,
          target_start_time: targetStartTime,
          ...(Number.isInteger(durationValue) && durationValue > 0
            ? { target_duration_minutes: durationValue }
            : {}),
          ...(studio ? { studio } : {}),
          ...(reason ? { reason } : {}),
          idempotency_key: buildRescheduleKey(
            reschedulingBooking,
            targetSessionDate,
            targetStartTime,
          ),
          payment_required: paymentRequired,
        },
      });
      setReschedulingBooking(null);
    } catch (error: unknown) {
      setActionError(getSafeErrorMessage(error));
    }
  };

  return (
    <section className="grid gap-6 text-txt-primary">
      <div className="rounded-2xl border border-background-secondary bg-card-bg-primary p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Private trainer bookings</h2>
            <p className="mt-2 text-sm leading-6 text-txt-secondary">
              {screen === "list"
                ? "View your private sessions, trainer details, payment status, and booking history."
                : "Check trainer availability first, then create from an available private slot."}
            </p>
          </div>
          {screen === "list" ? (
            <Button
              onClick={() => {
                setScreen("create");
                setAvailability(null);
                setAvailabilityError(null);
                setSelectedSlotKey("");
                setCreatedMessage(null);
              }}
              type="button"
            >
              Create private booking
            </Button>
          ) : (
            <Button onClick={() => setScreen("list")} type="button" variant="outline">
              Back to private bookings
            </Button>
          )}
        </div>
      </div>

      {screen === "create" ? (
      <section className="rounded-2xl border border-background-secondary bg-card-bg-primary p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Create private booking</h2>
            <p className="mt-2 text-sm leading-6 text-txt-secondary">
              Check trainer availability first, then create from an available private slot.
            </p>
          </div>
          <Badge tone={availableSlots.length > 0 ? "success" : "neutral"}>
            {availableSlots.length} available
          </Badge>
        </div>

        <form
          className="mt-5 grid gap-4"
          onSubmit={(event) => void handleCheckAvailability(event)}
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="grid gap-1.5 text-sm font-semibold">
              Trainer
              <select
                className="min-h-11 rounded-lg border border-background-secondary bg-card-bg-secondary px-3 text-sm text-txt-primary outline-none focus:border-primary"
                disabled={trainerSchedules.isLoading || trainerOptions.length === 0}
                name="trainer_staff_profile_id"
                required
              >
                <option value="">
                  {trainerSchedules.isLoading ? "Loading trainers..." : "Choose trainer"}
                </option>
                {trainerOptions.map(([trainerId, trainerLabel]) => (
                  <option key={trainerId} value={trainerId}>
                    {trainerLabel}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              From date
              <input
                className="min-h-11 rounded-lg border border-background-secondary bg-card-bg-secondary px-3 text-sm text-txt-primary outline-none focus:border-primary"
                defaultValue={dateInputValue(new Date())}
                name="from_date"
                required
                type="date"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              To date
              <input
                className="min-h-11 rounded-lg border border-background-secondary bg-card-bg-secondary px-3 text-sm text-txt-primary outline-none focus:border-primary"
                defaultValue={defaultToDate()}
                name="to_date"
                required
                type="date"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Duration minutes
              <input
                className="min-h-11 rounded-lg border border-background-secondary bg-card-bg-secondary px-3 text-sm text-txt-primary outline-none focus:border-primary"
                defaultValue="60"
                min="15"
                name="duration_minutes"
                required
                type="number"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Studio
              <input
                className="min-h-11 rounded-lg border border-background-secondary bg-card-bg-secondary px-3 text-sm text-txt-primary outline-none focus:border-primary"
                name="studio"
                onChange={(event) => setBookingStudio(event.target.value)}
                type="text"
                value={bookingStudio}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Payment required
              <select
                className="min-h-11 rounded-lg border border-background-secondary bg-card-bg-secondary px-3 text-sm text-txt-primary outline-none focus:border-primary"
                name="payment_required"
                onChange={(event) =>
                  setBookingPaymentRequired(event.target.value === "true")
                }
                value={String(bookingPaymentRequired)}
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>
          </div>

          {trainerSchedules.error ? (
            <p className="text-sm text-error" role="alert">
              {trainerSchedules.error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button loading={isCheckingAvailability} type="submit">
              Check availability
            </Button>
            <Button
              disabled={!selectedSlot}
              loading={createBooking.isPending}
              onClick={() => void handleCreatePrivateBooking()}
              type="button"
              variant="secondary"
            >
              Create private booking
            </Button>
          </div>
        </form>

        {availabilityError ? (
          <p className="mt-4 rounded-xl border border-error/30 bg-error/10 p-4 text-sm text-error" role="alert">
            {availabilityError}
          </p>
        ) : null}

        {createdMessage ? (
          <p className="mt-4 rounded-xl border border-success/30 bg-success/10 p-4 text-sm text-success" role="status">
            {createdMessage}
          </p>
        ) : null}

        {availability ? (
          <div className="mt-5 grid gap-3">
            <h3 className="text-sm font-bold uppercase tracking-[0.1em] text-txt-secondary">
              Available slots
            </h3>
            {availableSlots.length > 0 ? (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {availableSlots.map((slot) => (
                  <label
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-background-secondary bg-card-bg-secondary p-4 text-sm"
                    key={slotKey(slot)}
                  >
                    <input
                      checked={selectedSlotKey === slotKey(slot)}
                      className="mt-1"
                      name="selected_private_slot"
                      onChange={() => setSelectedSlotKey(slotKey(slot))}
                      type="radio"
                    />
                    <span>
                      <strong className="block">
                        {formatDate(slot.session_date)}
                      </strong>
                      <span className="text-txt-secondary">
                        {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-background-secondary bg-card-bg-secondary p-4 text-sm text-txt-secondary">
                No available slots in this range.
                {availability.slots.find((slot) => !slot.available) ? (
                  <span className="mt-1 block">
                    First unavailable reason:{" "}
                    {availabilityReason(
                      availability.slots.find((slot) => !slot.available)
                        ?.unavailable_reason ?? null,
                    )}
                  </span>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </section>
      ) : null}

      {actionError ? (
        <section className="rounded-xl border border-error/30 bg-error/10 p-4">
          <p className="text-sm text-error" role="alert">
            {actionError}
          </p>
        </section>
      ) : null}

      {screen === "list" && createdMessage ? (
        <p className="rounded-xl border border-success/30 bg-success/10 p-4 text-sm text-success" role="status">
          {createdMessage}
        </p>
      ) : null}

      {screen === "list" ? (
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
          <LoadingState className="p-8" label="Loading private bookings" />
        ) : (
          <DataTable
            columns={PRIVATE_BOOKING_COLUMNS}
            emptyMessage="You do not have any private trainer bookings yet."
            isEmpty={bookings.private_bookings.length === 0}
            minWidthClassName="min-w-[1120px]"
          >
            {bookings.private_bookings.map((item) => (
              <tr className="divide-x divide-background-secondary" key={item.id}>
                <td className="px-4 py-3 text-sm font-semibold">{item.booking_number}</td>
                <td className="px-4 py-3 text-sm">{displayCustomerName(item)}</td>
                <td className="px-4 py-3 text-sm">
                  {item.trainer?.display_name ?? "Trainer unavailable"}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className="block font-semibold">{formatDate(item.session_date)}</span>
                  <span className="text-xs text-txt-secondary">
                    {formatTime(item.start_time)} - {formatTime(item.end_time)}
                  </span>
                  <span className="mt-1 block text-xs text-txt-secondary">
                    {item.studio}
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
                      aria-label={`View private booking ${item.booking_number}`}
                      className="inline-flex min-h-8 items-center justify-center rounded-lg border border-background-secondary px-3 py-1 text-sm font-semibold text-txt-primary transition hover:bg-background-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      href={`/bookings/private/${encodeURIComponent(item.id)}`}
                      title="View private booking"
                    >
                      <Eye size={16} aria-hidden="true" />
                    </Link>
                    <Button
                      aria-label={`Reschedule private booking ${item.booking_number}`}
                      disabled={!canReschedule(item)}
                      onClick={() => setReschedulingBooking(item)}
                      size="sm"
                      title="Reschedule private booking"
                      variant="secondary"
                    >
                      <CalendarClock size={16} aria-hidden="true" />
                      <span className="sr-only">Reschedule private booking</span>
                    </Button>
                    <Button
                      aria-label={`Cancel private booking ${item.booking_number}`}
                      disabled={!canCancel(item)}
                      loading={cancelBooking.isPending}
                      onClick={() => void handleCancel(item)}
                      size="sm"
                      title="Cancel private booking"
                      variant="danger"
                    >
                      <XCircle size={16} aria-hidden="true" />
                      <span className="sr-only">Cancel private booking</span>
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>
      ) : null}

      {screen === "list" && reschedulingBooking ? (
        <section className="rounded-2xl border border-background-secondary bg-card-bg-primary p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Reschedule private booking</h2>
              <p className="mt-2 text-sm text-txt-secondary">
                Move {reschedulingBooking.booking_number} to another private session time.
              </p>
            </div>
            <Button onClick={() => setReschedulingBooking(null)} variant="ghost">
              Close
            </Button>
          </div>
          <form className="mt-5 grid gap-4" onSubmit={(event) => void handleReschedule(event)}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-semibold">
                Target date
                <input
                  className="min-h-11 rounded-lg border border-background-secondary bg-card-bg-secondary px-3 text-sm text-txt-primary outline-none focus:border-primary"
                  defaultValue={reschedulingBooking.session_date}
                  name="target_session_date"
                  required
                  type="date"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold">
                Start time
                <input
                  className="min-h-11 rounded-lg border border-background-secondary bg-card-bg-secondary px-3 text-sm text-txt-primary outline-none focus:border-primary"
                  defaultValue={reschedulingBooking.start_time.slice(0, 5)}
                  name="target_start_time"
                  required
                  type="time"
                />
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-semibold">
                Duration minutes
                <input
                  className="min-h-11 rounded-lg border border-background-secondary bg-card-bg-secondary px-3 text-sm text-txt-primary outline-none focus:border-primary"
                  defaultValue={reschedulingBooking.duration_minutes}
                  min="15"
                  name="target_duration_minutes"
                  type="number"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold">
                Studio
                <input
                  className="min-h-11 rounded-lg border border-background-secondary bg-card-bg-secondary px-3 text-sm text-txt-primary outline-none focus:border-primary"
                  defaultValue={reschedulingBooking.studio}
                  name="studio"
                  type="text"
                />
              </label>
            </div>
            <label className="grid gap-1.5 text-sm font-semibold">
              Payment required
              <select
                className="min-h-11 rounded-lg border border-background-secondary bg-card-bg-secondary px-3 text-sm text-txt-primary outline-none focus:border-primary"
                defaultValue={String(reschedulingBooking.payment_required)}
                name="payment_required"
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Reason
              <textarea
                className="min-h-24 rounded-lg border border-background-secondary bg-card-bg-secondary px-3 py-2 text-sm text-txt-primary outline-none focus:border-primary"
                maxLength={500}
                name="reason"
                placeholder="Customer requested a later time."
              />
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
    </section>
  );
}
