"use client";

import { type FormEvent, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { PilatesSchedule } from "@/modules/services/pilates";

import { adminBookingsClient } from "../../api/adminBookingsApi";
import { fieldClass } from "../../constants/bookingUi.constants";
import { useBookingCustomerLookup } from "../../hooks/useBookingCustomerLookup";
import {
  formatPrice,
  formatTime,
  getErrorMessage,
} from "../../utils/bookingFormatters";
import { buildBulkBookingKey } from "../../utils/bookingNormalizers";
import {
  BookingCustomerLookupPanel,
  FormField,
  OptionSelect,
  SelectedScheduleTags,
} from "./BookingFormControls";

export function CreateClassBulkBookingForm({
  areSchedulesLoading,
  onClose,
  onCreated,
  onError,
  scheduleLoadError,
  schedules,
}: {
  areSchedulesLoading: boolean;
  onClose: () => void;
  onCreated: (orderNumbers: string[]) => void;
  onError: (message: string) => void;
  scheduleLoadError: string | null;
  schedules: PilatesSchedule[];
}) {
  const customerLookup = useBookingCustomerLookup();
  const [classId, setClassId] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const classOptions = useMemo(() => {
    const map = new Map<string, string>();
    schedules.forEach((schedule) => {
      if (schedule.class) {
        map.set(schedule.class_id, schedule.class.title);
      }
    });
    return Array.from(map.entries()).sort((left, right) =>
      left[1].localeCompare(right[1]),
    );
  }, [schedules]);

  const scheduleOptions = useMemo(() => {
    if (!classId) return [];

    return schedules
      .filter((schedule) => schedule.status === "scheduled")
      .filter((schedule) => schedule.class_id === classId)
      .filter((schedule) => schedule.availability.available_seats > 0)
      .filter((schedule) =>
        scheduleDate ? schedule.class_date === scheduleDate : true,
      )
      .sort((left, right) =>
        `${left.class_date} ${left.start_time}`.localeCompare(
          `${right.class_date} ${right.start_time}`,
        ),
      );
  }, [classId, scheduleDate, schedules]);

  const selectedSchedules = useMemo(
    () =>
      selectedScheduleIds
        .map((scheduleId) =>
          schedules.find((schedule) => schedule.id === scheduleId),
        )
        .filter((schedule): schedule is PilatesSchedule => Boolean(schedule)),
    [schedules, selectedScheduleIds],
  );
  const totalAmount = useMemo(
    () =>
      selectedSchedules.reduce(
        (total, schedule) =>
          total +
          (schedule.price_amount ?? schedule.class?.default_price_amount ?? 0),
        0,
      ),
    [selectedSchedules],
  );

  const removeSchedule = (scheduleId: string) => {
    setSelectedScheduleIds((current) =>
      current.filter((id) => id !== scheduleId),
    );
  };

  const addScheduleFromDropdown = (scheduleId: string) => {
    if (!scheduleId) return;

    setSelectedScheduleIds((current) =>
      current.includes(scheduleId) ? current : [...current, scheduleId],
    );
  };

  const createBulkBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(event.currentTarget);
    const notes = String(formData.get("admin_notes") ?? "").trim();

    if (selectedScheduleIds.length === 0) {
      onError("Select at least one time slot.");
      return;
    }

    setIsCreating(true);
    try {
      const attendee = await customerLookup.resolveAttendee(form);
      const result = await adminBookingsClient.createBulkBooking({
        customer_user_id: attendee.app_user_id,
        schedule_ids: selectedScheduleIds,
        idempotency_key: buildBulkBookingKey({
          customerUserId: attendee.app_user_id,
          scheduleIds: selectedScheduleIds,
        }),
        ...(notes ? { admin_notes: notes } : {}),
      });
      const orderDetail = await adminBookingsClient
        .getBookingOrder(result.booking_order.id)
        .catch(() => null);

      onCreated([
        orderDetail?.order_number ?? result.booking_order.order_number,
      ]);
    } catch (requestError: unknown) {
      onError(getErrorMessage(requestError));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <form
      className="overflow-hidden rounded-md border border-background-secondary bg-card-bg-primary text-txt-primary shadow-sm"
      onSubmit={(formEvent) => void createBulkBooking(formEvent)}
    >
      <header className="border-b border-background-secondary bg-card-bg-primary px-5 py-5">
        <h2 className="text-2xl font-medium">Add Class Booking</h2>
      </header>

      <div className="grid gap-6 px-5 py-5">
        <BookingCustomerLookupPanel customerLookup={customerLookup} />

        <section className="grid gap-4">
          <section className="rounded-sm border border-background-secondary bg-card-bg-secondary p-4">
            <h3 className="text-sm font-bold">Booking Details</h3>
            <p className="mt-1 text-sm text-txt-secondary">
              Select a service, date, and available time slots.
            </p>
          </section>
          <div className="grid gap-4">
            <OptionSelect
              disabled={areSchedulesLoading || classOptions.length === 0}
              label="Service"
              name="class_filter"
              onChange={(value) => {
                setClassId(value);
                setSelectedScheduleIds([]);
                setScheduleDate("");
              }}
              options={classOptions}
              placeholder={
                areSchedulesLoading ? "Loading services..." : "Select service"
              }
              value={classId}
            />
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_160px_180px]">
              <FormField
                disabled={!classId}
                label="Session date"
                name="schedule_date"
                onChange={(value) => {
                  setScheduleDate(value);
                  setSelectedScheduleIds([]);
                }}
                type="date"
              />
              <label className="grid gap-1.5 text-xs font-bold">
                Session Time
                <span className="relative flex min-h-16 items-center gap-2 rounded-sm border border-background-secondary bg-card-bg-primary px-3 py-2 focus-within:border-primary">
                  <SelectedScheduleTags
                    onRemove={removeSchedule}
                    schedules={selectedSchedules}
                  />
                  <span className="relative min-w-0 flex-1">
                    <select
                      aria-label="Session Time"
                      className={`min-h-10 w-full appearance-none rounded-sm bg-transparent text-base text-txt-primary outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
                        selectedSchedules.length > 0
                          ? "absolute inset-y-0 right-0 z-10 cursor-pointer opacity-0"
                          : "px-2 pr-10"
                      }`}
                      disabled={!classId || scheduleOptions.length === 0}
                      defaultValue=""
                      onChange={(event) => {
                        addScheduleFromDropdown(event.target.value);
                        event.target.value = "";
                      }}
                    >
                      <option value="">
                        {!classId
                          ? "Select service first"
                          : scheduleOptions.length === 0
                            ? "No available time"
                            : "Select time"}
                      </option>
                      {scheduleOptions.map((schedule) => (
                        <option key={schedule.id} value={schedule.id}>
                          {formatTime(schedule.start_time)} -{" "}
                          {formatTime(schedule.end_time)} |{" "}
                          {formatPrice(
                            schedule.price_amount ??
                              schedule.class?.default_price_amount ??
                              null,
                            schedule.currency ?? schedule.class?.currency,
                          )}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      aria-hidden="true"
                      className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-txt-secondary"
                      size={16}
                    />
                  </span>
                </span>
              </label>
              <FormField
                disabled
                label="Total Sessions"
                name="total_sessions_display"
                value={String(selectedSchedules.length)}
              />
              <FormField
                disabled
                label="Total Amount"
                name="total_amount_display"
                value={`${totalAmount.toFixed(3)} KWD`}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
              <label className="grid gap-1.5 text-xs font-bold">
                Payment Method
                <span className="relative">
                  <select
                    className={`${fieldClass} appearance-none pr-10`}
                    defaultValue="cash"
                    name="payment_method"
                  >
                    <option value="card">Card</option>
                    <option value="knet">KNET</option>
                  </select>
                  <ChevronDown
                    aria-hidden="true"
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-txt-secondary"
                    size={16}
                  />
                </span>
              </label>
              <FormField
                label="Admin notes"
                name="admin_notes"
                placeholder="Booked at front desk."
              />
            </div>
          </div>

          {scheduleLoadError ? (
            <p className="text-sm text-error" role="alert">
              {scheduleLoadError}
            </p>
          ) : null}
        </section>
      </div>

      <footer className="flex justify-start gap-2 border-t border-background-secondary px-5 py-5">
        <button
          className="min-h-11 rounded-sm bg-button-primary px-4 py-3 text-xs font-bold text-txt-primary disabled:cursor-not-allowed disabled:opacity-60"
          disabled={
            isCreating ||
            customerLookup.isCreatingCustomer ||
            selectedScheduleIds.length === 0
          }
          type="submit"
        >
          {isCreating ? "Creating..." : "Create booking order"}
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
