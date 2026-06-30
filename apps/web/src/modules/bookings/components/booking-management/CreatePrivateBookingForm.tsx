"use client";

import { type FormEvent, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

import {
  adminBookingsClient,
  type CreatePrivateTrainerBookingPayload,
} from "../../api/adminBookingsApi";
import { fieldClass } from "../../constants/bookingUi.constants";
import { useBookingCustomerLookup } from "../../hooks/useBookingCustomerLookup";
import {
  availabilityReason,
  getErrorMessage,
} from "../../utils/bookingFormatters";
import { buildIdempotencyKey } from "../../utils/bookingNormalizers";
import {
  BookingCustomerLookupPanel,
  FormField,
  OptionSelect,
} from "./BookingFormControls";

export function CreatePrivateBookingForm({
  isStaffLoading,
  onClose,
  onCreated,
  onError,
  staffOptions,
}: {
  isStaffLoading: boolean;
  onClose: () => void;
  onCreated: (bookingNumber: string) => void;
  onError: (message: string) => void;
  staffOptions: Array<[string, string]>;
}) {
  const customerLookup = useBookingCustomerLookup();
  const [isCreating, setIsCreating] = useState(false);
  const [trainerId, setTrainerId] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [availability, setAvailability] = useState<{
    message: string;
    status: "checking" | "available" | "unavailable" | "error";
  } | null>(null);

  useEffect(() => {
    const duration = Number(durationMinutes);
    if (
      !trainerId ||
      !sessionDate ||
      !startTime ||
      !Number.isInteger(duration) ||
      duration < 15 ||
      duration > 240
    ) {
      return;
    }

    const controller = new AbortController();
    const request = window.setTimeout(() => {
      setAvailability({
        status: "checking",
        message: "Checking trainer availability…",
      });
      void adminBookingsClient
        .checkPrivateTrainerAvailability(
          trainerId,
          {
            session_date: sessionDate,
            start_time: startTime,
            duration_minutes: duration,
          },
          controller.signal,
        )
        .then((result) => {
          setAvailability(
            result.available
              ? {
                  status: "available",
                  message: `Trainer is available from ${result.start_time} to ${result.end_time}.`,
                }
              : {
                  status: "unavailable",
                  message: availabilityReason(result.unavailable_reason),
                },
          );
        })
        .catch((requestError: unknown) => {
          if (
            requestError instanceof DOMException &&
            requestError.name === "AbortError"
          ) {
            return;
          }
          setAvailability({
            status: "error",
            message: getErrorMessage(requestError),
          });
        });
    }, 300);

    return () => {
      window.clearTimeout(request);
      controller.abort();
    };
  }, [durationMinutes, sessionDate, startTime, trainerId]);

  const createPrivateBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setIsCreating(true);
    try {
      const attendee = await customerLookup.resolveAttendee(form);
      const payload: CreatePrivateTrainerBookingPayload = {
        currency: "KWD",
        duration_minutes: Number(formData.get("duration_minutes") || 60),
        payment_required: formData.get("payment_required") === "true",
        price_amount: Number(formData.get("price_amount") || 0),
        session_date: String(formData.get("session_date")).trim(),
        start_time: String(formData.get("start_time")).trim(),
        studio: String(formData.get("studio")).trim() || "LAFAM Pilates Studio",
        trainer_staff_profile_id: String(
          formData.get("trainer_staff_profile_id"),
        ).trim(),
        user_id: attendee.app_user_id,
      };
      payload.idempotency_key =
        String(formData.get("idempotency_key")).trim() ||
        buildIdempotencyKey(payload);
      const result = await adminBookingsClient.createPrivateTrainer(payload);
      form.reset();
      onCreated(result.private_booking.booking_number);
    } catch (requestError: unknown) {
      onError(getErrorMessage(requestError));
    } finally {
      setIsCreating(false);
    }
  };

  const hasCompleteSlotSelection = Boolean(
    trainerId && sessionDate && startTime && durationMinutes,
  );

  return (
    <form
      className="overflow-hidden rounded-md border border-background-secondary bg-card-bg-primary text-txt-primary shadow-sm"
      onSubmit={(formEvent) => void createPrivateBooking(formEvent)}
    >
      <header className="border-b border-background-secondary bg-card-bg-primary px-5 py-5">
        <h2 className="text-2xl font-medium" id="create-private-booking-title">
          Add New Private Booking
        </h2>
      </header>

      <div className="px-5 py-5">
        <p className="mb-5 text-sm text-txt-secondary">
          Create a private trainer booking for an attendee and trainer.
        </p>
        <div className="grid gap-5">
          <BookingCustomerLookupPanel customerLookup={customerLookup} />
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <OptionSelect
            disabled={isStaffLoading || staffOptions.length === 0}
            label="Staff trainer"
            name="trainer_staff_profile_id"
            onChange={(value) => {
              setTrainerId(value);
              setAvailability(null);
            }}
            options={staffOptions}
            placeholder={isStaffLoading ? "Loading staff..." : "Select staff"}
            required
          />
          <FormField
            label="Session date"
            name="session_date"
            onChange={(value) => {
              setSessionDate(value);
              setAvailability(null);
            }}
            required
            type="date"
          />
          <FormField
            label="Start time"
            name="start_time"
            onChange={(value) => {
              setStartTime(value);
              setAvailability(null);
            }}
            required
            type="time"
          />
          <FormField
            defaultValue="60"
            label="Duration minutes"
            name="duration_minutes"
            onChange={(value) => {
              setDurationMinutes(value);
              setAvailability(null);
            }}
            type="number"
          />
          <FormField
            defaultValue="LAFAM Pilates Studio"
            label="Studio"
            name="studio"
          />
          <FormField
            defaultValue="15"
            label="Booking price (KWD)"
            min="0"
            name="price_amount"
            required
            step="0.001"
            type="number"
          />
          <FormField
            defaultValue="KWD"
            disabled
            label="Currency"
            name="currency_display"
            type="text"
          />
          <label className="grid gap-1.5 text-xs font-bold">
            Payment required
            <span className="relative">
              <select
                className={`${fieldClass} appearance-none pr-10`}
                defaultValue="false"
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

          {availability ? (
            <p
              aria-live="polite"
              className={`rounded-sm border px-4 py-3 text-sm font-semibold md:col-span-2 ${
                availability.status === "available"
                  ? "border-success/30 bg-success/10 text-success"
                  : availability.status === "checking"
                    ? "border-background-secondary bg-card-bg-secondary text-txt-secondary"
                    : "border-error/30 bg-error/10 text-error"
              }`}
              role={availability.status === "unavailable" ? "alert" : "status"}
            >
              {availability.message}
            </p>
          ) : null}
        </div>
      </div>

      <footer className="flex justify-start gap-2 border-t border-background-secondary px-5 py-5">
        <button
          className="min-h-11 rounded-sm bg-button-primary px-4 py-3 text-xs font-bold text-txt-primary disabled:cursor-not-allowed disabled:opacity-60"
          disabled={
            isCreating ||
            customerLookup.isCreatingCustomer ||
            (hasCompleteSlotSelection && availability?.status !== "available")
          }
          type="submit"
        >
          {isCreating ? "Creating..." : "Create booking"}
        </button>
        <button
          className="min-h-11 rounded-sm border border-background-secondary px-4 py-3 text-xs font-bold text-txt-secondary transition hover:bg-background-secondary disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isCreating}
          onClick={onClose}
          type="button"
        >
          Back to bookings
        </button>
      </footer>
    </form>
  );
}
