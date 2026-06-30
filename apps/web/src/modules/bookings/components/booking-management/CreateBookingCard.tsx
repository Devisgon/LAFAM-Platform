"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { PilatesSchedule } from "@/modules/services/pilates";

import { fieldClass } from "../../constants/bookingUi.constants";
import type { CreateBookingMode } from "../../types/bookingUi.types";
import { CreateClassBulkBookingForm } from "./CreateClassBulkBookingForm";
import { CreatePrivateBookingForm } from "./CreatePrivateBookingForm";

export function CreateBookingCard({
  areSchedulesLoading,
  canCreateBulkBooking,
  canCreatePrivateBooking,
  isStaffLoading,
  onBulkCreated,
  onClose,
  onError,
  onPrivateCreated,
  scheduleLoadError,
  schedules,
  staffOptions,
}: {
  areSchedulesLoading: boolean;
  canCreateBulkBooking: boolean;
  canCreatePrivateBooking: boolean;
  isStaffLoading: boolean;
  onBulkCreated: (orderNumbers: string[]) => void;
  onClose: () => void;
  onError: (message: string) => void;
  onPrivateCreated: (bookingNumber: string) => void;
  scheduleLoadError: string | null;
  schedules: PilatesSchedule[];
  staffOptions: Array<[string, string]>;
}) {
  const defaultMode = canCreateBulkBooking ? "class" : "private";
  const [mode, setMode] = useState<CreateBookingMode>(defaultMode);
  const canSwitchModes = canCreateBulkBooking && canCreatePrivateBooking;

  return (
    <section className="grid gap-5">
      {canSwitchModes ? (
        <section className="rounded-md border border-background-secondary bg-card-bg-primary p-5 text-txt-primary shadow-sm">
          <label className="grid max-w-sm gap-1.5 text-xs font-bold">
            Booking type
            <span className="relative">
              <select
                className={`${fieldClass} appearance-none pr-10`}
                onChange={(event) =>
                  setMode(event.target.value as CreateBookingMode)
                }
                value={mode}
              >
                <option value="class">Pilates class booking</option>
                <option value="private">Private trainer booking</option>
              </select>
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-txt-secondary"
                size={16}
              />
            </span>
          </label>
        </section>
      ) : null}

      {mode === "class" && canCreateBulkBooking ? (
        <CreateClassBulkBookingForm
          areSchedulesLoading={areSchedulesLoading}
          onClose={onClose}
          onCreated={onBulkCreated}
          onError={onError}
          scheduleLoadError={scheduleLoadError}
          schedules={schedules}
        />
      ) : canCreatePrivateBooking ? (
        <CreatePrivateBookingForm
          isStaffLoading={isStaffLoading}
          onClose={onClose}
          onCreated={onPrivateCreated}
          onError={onError}
          staffOptions={staffOptions}
        />
      ) : (
        <section className="rounded-md border border-error/30 bg-error/10 p-5 text-sm text-error">
          Booking creation is locked for your account permissions.
        </section>
      )}
    </section>
  );
}
