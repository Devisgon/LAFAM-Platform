"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { LoadingState } from "@/components/data-display/LoadingState";
import { Badge } from "@/components/ui/Badge";
import type { PilatesSchedule } from "@/modules/services/pilates";

import {
  adminBookingsClient,
  type AdminBookingDetail,
  type AdminBookingStatus,
  type AdminOverrideBookingPayload,
} from "../../api/adminBookingsApi";
import { bookingStatuses, fieldClass } from "../../constants/bookingUi.constants";
import type { BookingPermission } from "../../types/bookingUi.types";
import {
  formatDate,
  formatDateTime,
  formatPrice,
  formatTime,
  getErrorMessage,
  label,
  paymentTone,
  sourceLabel,
  statusTone,
} from "../../utils/bookingFormatters";
import { hasPermission } from "../../utils/bookingNormalizers";
import { ActionCard, DetailItem } from "./BookingDetailBlocks";
import { FormField } from "./BookingFormControls";

export function BookingDetailPanel({
  bookingId,
  onBack,
  onChanged,
  permissions,
  schedules,
}: {
  bookingId: string;
  onBack: () => void;
  onChanged: () => void;
  permissions: readonly BookingPermission[];
  schedules: PilatesSchedule[];
}) {
  const [booking, setBooking] = useState<AdminBookingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const canCancelBooking = hasPermission(permissions, "admin:bookings:cancel");
  const canOverrideBooking = hasPermission(
    permissions,
    "admin:bookings:override",
  );
  const canRescheduleBooking = hasPermission(
    permissions,
    "admin:bookings:reschedule",
  );
  const hasWriteActions =
    canCancelBooking || canOverrideBooking || canRescheduleBooking;

  const targetSchedules = useMemo(
    () =>
      schedules
        .filter((schedule) => schedule.status === "scheduled")
        .filter((schedule) => schedule.id !== booking?.schedule_id)
        .toSorted((first, second) =>
          `${first.class_date}T${first.start_time}`.localeCompare(
            `${second.class_date}T${second.start_time}`,
          ),
        ),
    [booking?.schedule_id, schedules],
  );
  const rescheduleDateOptions = useMemo(
    () =>
      Array.from(
        new Map(
          targetSchedules.map((schedule) => [
            schedule.class_date,
            formatDate(schedule.class_date),
          ]),
        ),
      ),
    [targetSchedules],
  );
  const rescheduleTimeOptions = useMemo(
    () =>
      targetSchedules
        .filter((schedule) => schedule.class_date === rescheduleDate)
        .map(
          (schedule) =>
            [
              schedule.id,
              [
                `${formatTime(schedule.start_time)} - ${formatTime(schedule.end_time)}`,
                schedule.class?.title ?? schedule.class_id,
                schedule.trainer?.display_name ??
                  schedule.trainer_staff_profile_id,
                formatPrice(schedule.price_amount, schedule.currency),
              ].join(" | "),
            ] as const,
        ),
    [rescheduleDate, targetSchedules],
  );

  const loadBooking = async () => {
    setIsLoading(true);
    setError(null);

    try {
      setBooking(await adminBookingsClient.getBooking(bookingId));
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const request = window.setTimeout(() => {
      void loadBooking();
    }, 0);

    return () => window.clearTimeout(request);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  const refreshAfterChange = async () => {
    await loadBooking();
    onChanged();
  };

  const cancelBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;
    const reason = String(new FormData(form).get("reason")).trim();

    setIsSaving(true);
    setError(null);

    try {
      await adminBookingsClient.cancelBooking(bookingId, { reason });
      form.reset();
      await refreshAfterChange();
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsSaving(false);
    }
  };

  const rescheduleBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const reason = String(formData.get("reason")).trim();
    const targetScheduleId = String(formData.get("target_schedule_id")).trim();

    setIsSaving(true);
    setError(null);
    try {
      await adminBookingsClient.rescheduleBooking(bookingId, {
        join_waitlist_if_full: formData.get("join_waitlist_if_full") === "on",
        ...(reason ? { reason } : {}),
        target_schedule_id: targetScheduleId,
      });
      form.reset();
      setRescheduleDate("");
      await refreshAfterChange();
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsSaving(false);
    }
  };

  const overrideBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const adminNotes = String(formData.get("admin_notes")).trim();
    const payload: AdminOverrideBookingPayload = {
      reason: String(formData.get("reason")).trim(),
      target_status: String(
        formData.get("target_status"),
      ) as AdminBookingStatus,
      ...(adminNotes ? { admin_notes: adminNotes } : {}),
    };

    setIsSaving(true);
    setError(null);
    try {
      setBooking(await adminBookingsClient.overrideBooking(bookingId, payload));
      form.reset();
      onChanged();
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingState className="p-6" label="Loading booking details" />;
  }

  if (!booking) {
    return (
      <div className="p-6">
        <p className="text-sm text-error" role="alert">
          {error ?? "Booking details could not be loaded."}
        </p>
        <button
          className="mt-3 rounded-sm border border-background-secondary px-4 py-2 text-sm font-semibold text-txt-secondary"
          onClick={onBack}
          type="button"
        >
          Back to bookings
        </button>
      </div>
    );
  }

  const customerName =
    booking.customer?.full_name ?? booking.customer?.email ?? "No customer";
  const trainerName =
    booking.trainer?.display_name ?? booking.trainer_staff_profile_id;
  const bookingDate =
    booking.schedule?.class_date ?? booking.created_at.slice(0, 10);

  return (
    <section className="grid gap-6 p-5 text-txt-primary">
      <header className="flex flex-col gap-4 border-b border-background-secondary pb-5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold text-txt-secondary">
            Booking detail
          </p>
          <h3 className="mt-1 text-2xl font-medium">
            {booking.booking_number}
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone={statusTone(booking.status)}>
              {label(booking.status)}
            </Badge>
            <Badge tone={paymentTone(booking.payment_status)}>
              {label(booking.payment_status)}
            </Badge>
          </div>
        </div>
        <button
          className="min-h-11 rounded-sm border border-background-secondary px-5 text-sm font-semibold text-txt-secondary transition hover:bg-background-secondary"
          onClick={onBack}
          type="button"
        >
          Back to bookings
        </button>
      </header>

      {error ? (
        <p
          className="rounded-sm border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DetailItem label="Customer" value={customerName} />
        <DetailItem label="Class" value={booking.class?.title ?? "No class"} />
        <DetailItem label="Trainer" value={trainerName} />
        <DetailItem label="Date" value={formatDate(bookingDate)} />
        <DetailItem
          label="Time"
          value={
            booking.schedule
              ? `${booking.schedule.start_time} - ${booking.schedule.end_time}`
              : formatDateTime(booking.created_at)
          }
        />
        <DetailItem
          label="Price"
          value={formatPrice(booking.price?.amount, booking.price?.currency)}
        />
        <DetailItem label="Source" value={sourceLabel(booking.source)} />

        <DetailItem
          label="Admin notes"
          value={booking.admin_notes ?? "No admin notes"}
        />
      </dl>

      {hasWriteActions ? (
        <section className="grid items-stretch gap-5 xl:grid-cols-3">
          {canCancelBooking ? (
            <ActionCard title="Cancel booking">
              <form
                className="flex h-full flex-col gap-3"
                onSubmit={(event) => void cancelBooking(event)}
              >
                <FormField label="Audit reason" name="reason" required />
                <button
                  className="mt-auto min-h-11 rounded-sm bg-error px-4 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={isSaving}
                  type="submit"
                >
                  Cancel booking
                </button>
              </form>
            </ActionCard>
          ) : null}

          {canRescheduleBooking ? (
            <ActionCard title="Reschedule booking">
              <form
                className="flex h-full flex-col gap-3"
                onSubmit={(event) => void rescheduleBooking(event)}
              >
                <label className="grid gap-1.5 text-xs font-bold">
                  New date
                  <span className="relative">
                    <select
                      className={`${fieldClass} appearance-none pr-10`}
                      disabled={isSaving || rescheduleDateOptions.length === 0}
                      onChange={(event) =>
                        setRescheduleDate(event.target.value)
                      }
                      required
                      value={rescheduleDate}
                    >
                      <option value="">Select date</option>
                      {rescheduleDateOptions.map(([value, optionLabel]) => (
                        <option key={value} value={value}>
                          {optionLabel}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      aria-hidden="true"
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-txt-secondary"
                      size={16}
                    />
                  </span>
                </label>
                <label className="grid gap-1.5 text-xs font-bold">
                  Available time
                  <span className="relative">
                    <select
                      className={`${fieldClass} appearance-none pr-10`}
                      disabled={
                        isSaving ||
                        !rescheduleDate ||
                        rescheduleTimeOptions.length === 0
                      }
                      name="target_schedule_id"
                      required
                    >
                      <option value="">Select time</option>
                      {rescheduleTimeOptions.map(([value, optionLabel]) => (
                        <option key={value} value={value}>
                          {optionLabel}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      aria-hidden="true"
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-txt-secondary"
                      size={16}
                    />
                  </span>
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-txt-primary">
                  <input
                    className="size-4 accent-primary"
                    name="join_waitlist_if_full"
                    type="checkbox"
                  />
                  Join waitlist if full
                </label>
                <FormField label="Reason" name="reason" />
                <button
                  className="mt-auto min-h-11 rounded-sm bg-button-primary px-4 text-sm font-semibold text-txt-primary disabled:opacity-60"
                  disabled={
                    isSaving ||
                    !rescheduleDate ||
                    rescheduleTimeOptions.length === 0
                  }
                  type="submit"
                >
                  Reschedule
                </button>
              </form>
            </ActionCard>
          ) : null}

          {canOverrideBooking ? (
            <ActionCard title="Override status">
              <form
                className="flex h-full flex-col gap-3"
                onSubmit={(event) => void overrideBooking(event)}
              >
                <label className="grid gap-1.5 text-xs font-bold">
                  Target status
                  <span className="relative">
                    <select
                      className={`${fieldClass} appearance-none pr-10`}
                      defaultValue={booking.status}
                      name="target_status"
                    >
                      {bookingStatuses.map((statusOption) => (
                        <option key={statusOption} value={statusOption}>
                          {label(statusOption)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      aria-hidden="true"
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-txt-secondary"
                      size={16}
                    />
                  </span>
                </label>
                <FormField label="Audit reason" name="reason" required />
                <label className="grid gap-1.5 text-xs font-bold">
                  Admin notes
                  <textarea
                    className={`${fieldClass} min-h-24 resize-y`}
                    name="admin_notes"
                  />
                </label>
                <button
                  className="mt-auto min-h-11 rounded-sm bg-button-primary px-4 text-sm font-semibold text-txt-primary disabled:opacity-60"
                  disabled={isSaving}
                  type="submit"
                >
                  Override status
                </button>
              </form>
            </ActionCard>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-md border border-background-secondary">
        <header className="border-b border-background-secondary px-4 py-3">
          <h4 className="font-semibold">Booking history</h4>
        </header>
        <div className="grid gap-3 p-4">
          {booking.history.length > 0 ? (
            booking.history.map((entry) => (
              <div
                className="rounded-sm bg-background-secondary/40 p-3 text-sm"
                key={entry.id}
              >
                <p className="font-semibold">{label(entry.action)}</p>
                <p className="mt-1 text-txt-secondary">
                  {formatDateTime(entry.created_at)}{" "}
                  {entry.from_status ? `${label(entry.from_status)} -> ` : ""}
                  {entry.to_status ? label(entry.to_status) : ""}
                </p>
                {entry.notes ? <p className="mt-1">{entry.notes}</p> : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-txt-secondary">No history entries.</p>
          )}
        </div>
      </section>
    </section>
  );
}
