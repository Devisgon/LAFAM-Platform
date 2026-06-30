"use client";

import { type FormEvent, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { LoadingState } from "@/components/data-display/LoadingState";
import { Badge } from "@/components/ui/Badge";

import {
  adminBookingsClient,
  type PrivateTrainerBookingDetail,
} from "../../api/adminBookingsApi";
import { fieldClass } from "../../constants/bookingUi.constants";
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

export function PrivateBookingDetailPanel({
  bookingId,
  onBack,
  onChanged,
  permissions,
}: {
  bookingId: string;
  onBack: () => void;
  onChanged: () => void;
  permissions: readonly BookingPermission[];
}) {
  const [booking, setBooking] = useState<PrivateTrainerBookingDetail | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const canCancelBooking = hasPermission(permissions, "admin:bookings:cancel");
  const canRescheduleBooking = hasPermission(
    permissions,
    "admin:bookings:reschedule",
  );
  const hasWriteActions = canCancelBooking || canRescheduleBooking;

  const loadBooking = async () => {
    setIsLoading(true);
    setError(null);

    try {
      setBooking(await adminBookingsClient.getPrivateTrainerBooking(bookingId));
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
      await adminBookingsClient.cancelPrivateTrainerBooking(bookingId, {
        reason,
      });
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
    const idempotencyKey = String(formData.get("idempotency_key")).trim();
    const studio = String(formData.get("studio")).trim();
    const targetSessionDate = String(
      formData.get("target_session_date"),
    ).trim();
    const targetStartTime = String(formData.get("target_start_time")).trim();

    setIsSaving(true);
    setError(null);
    try {
      await adminBookingsClient.reschedulePrivateTrainerBooking(bookingId, {
        payment_required: formData.get("payment_required") === "true",
        target_duration_minutes: Number(
          formData.get("target_duration_minutes") || 60,
        ),
        target_session_date: targetSessionDate,
        target_start_time: targetStartTime,
        ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
        ...(reason ? { reason } : {}),
        ...(studio ? { studio } : {}),
      });
      form.reset();
      await refreshAfterChange();
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <LoadingState className="p-6" label="Loading private booking details" />
    );
  }

  if (!booking) {
    return (
      <div className="p-6">
        <p className="text-sm text-error" role="alert">
          {error ?? "Private booking details could not be loaded."}
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

  return (
    <section className="grid gap-6 p-5 text-txt-primary">
      <header className="flex flex-col gap-4 border-b border-background-secondary pb-5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold text-txt-secondary">
            Private booking detail
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
        <DetailItem label="Session" value="Private trainer" />
        <DetailItem label="Trainer" value={trainerName} />
        <DetailItem label="Date" value={formatDate(booking.session_date)} />
        <DetailItem
          label="Time"
          value={`${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}`}
        />
        <DetailItem
          label="Duration"
          value={`${booking.duration_minutes} minutes`}
        />
        <DetailItem label="Studio" value={booking.studio} />
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
        <section className="grid items-stretch gap-5 xl:grid-cols-2">
          {canCancelBooking ? (
            <ActionCard title="Cancel private booking">
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
            <ActionCard title="Reschedule private booking">
              <form
                className="flex h-full flex-col gap-3"
                onSubmit={(event) => void rescheduleBooking(event)}
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <FormField
                    defaultValue={booking.session_date}
                    label="New date"
                    name="target_session_date"
                    required
                    type="date"
                  />
                  <FormField
                    defaultValue={booking.start_time.slice(0, 5)}
                    label="Start time"
                    name="target_start_time"
                    required
                    type="time"
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <FormField
                    defaultValue={String(booking.duration_minutes)}
                    label="Duration minutes"
                    name="target_duration_minutes"
                    required
                    type="number"
                  />
                  <FormField
                    defaultValue={booking.studio}
                    label="Studio"
                    name="studio"
                  />
                </div>
                <label className="grid gap-1.5 text-xs font-bold">
                  Payment required
                  <span className="relative">
                    <select
                      className={`${fieldClass} appearance-none pr-10`}
                      defaultValue={String(booking.payment_required)}
                      name="payment_required"
                    >
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                    <ChevronDown
                      aria-hidden="true"
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-txt-secondary"
                      size={16}
                    />
                  </span>
                </label>
                <FormField label="Reason" name="reason" />
                <button
                  className="mt-auto min-h-11 rounded-sm bg-button-primary px-4 text-sm font-semibold text-txt-primary disabled:opacity-60"
                  disabled={isSaving}
                  type="submit"
                >
                  Reschedule
                </button>
              </form>
            </ActionCard>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-md border border-background-secondary">
        <header className="border-b border-background-secondary px-4 py-3">
          <h4 className="font-semibold">Private booking history</h4>
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
