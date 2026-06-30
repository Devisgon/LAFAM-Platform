"use client";

import { useMemo, useState } from "react";
import { Toast } from "@/components/ui/Toast";
import { type PilatesSchedule, usePilates } from "@/modules/services/pilates";
import { useStaff } from "@/modules/staff";

import type { BookingPermission, ResultToast } from "../types/bookingUi.types";
import { hasPermission } from "../utils/bookingNormalizers";
import { BookingListPanel } from "./booking-management/BookingListPanel";
import { CreateBookingCard } from "./booking-management/CreateBookingCard";

export function BookingExplorer({
  heading = "Booking List",
  permissions = [],
  previousOnly = false,
}: {
  heading?: string;
  permissions?: readonly BookingPermission[];
  previousOnly?: boolean;
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toast, setToast] = useState<ResultToast | null>(null);
  const canCreateBooking = hasPermission(permissions, "admin:bookings:create");
  const canCreateBulkBooking = hasPermission(
    permissions,
    "admin:bookings:bulk_create",
  );
  const canOpenCreateBooking = canCreateBooking || canCreateBulkBooking;
  const { staff, isLoading: isStaffLoading } = useStaff();
  const {
    schedules,
    isLoading: areSchedulesLoading,
    error: scheduleLoadError,
  } = usePilates();
  const staffOptions = useMemo(
    () =>
      staff.filter(
        (member) =>
          member.staff_status !== "deleted" &&
          member.staff_status !== "deactivated",
      ),
    [staff],
  );

  return (
    <>
      <section className="grid gap-9 text-txt-primary">
        {isCreateOpen ? (
          <CreateBookingCard
            areSchedulesLoading={areSchedulesLoading}
            canCreateBulkBooking={canCreateBulkBooking}
            canCreatePrivateBooking={canCreateBooking}
            isStaffLoading={isStaffLoading}
            onClose={() => setIsCreateOpen(false)}
            onBulkCreated={(orderNumbers) => {
              setIsCreateOpen(false);
              setToast({
                message: `${orderNumbers.join(", ")} ${orderNumbers.length === 1 ? "was" : "were"} created.`,
                title: "Booking order created",
                tone: "success",
              });
            }}
            onPrivateCreated={(bookingNumber) => {
              setIsCreateOpen(false);
              setToast({
                message: `${bookingNumber} was created.`,
                title: "Private booking created",
                tone: "success",
              });
            }}
            onError={(message) => {
              setToast({
                message,
                title: "Booking not created",
                tone: "error",
              });
            }}
            scheduleLoadError={scheduleLoadError}
            schedules={schedules as PilatesSchedule[]}
            staffOptions={staffOptions.map((member) => [
              member.id,
              `${member.display_name} - ${member.post_title}`,
            ])}
          />
        ) : (
          <>
            <section className="flex items-center justify-between gap-4 rounded-md bg-card-bg-primary px-5 py-5 shadow-xl">
              <h2 className="text-2xl font-medium">Add New Booking</h2>
              {canOpenCreateBooking ? (
                <button
                  className="min-h-12 rounded-sm bg-button-primary px-5 text-base font-semibold text-txt-primary transition hover:opacity-85"
                  onClick={() => setIsCreateOpen(true)}
                  type="button"
                >
                  Add New Booking
                </button>
              ) : null}
            </section>

            <section
              aria-labelledby="admin-bookings-heading"
              className="overflow-hidden rounded-md bg-card-bg-primary shadow-sm"
            >
              <header className="border-b border-background-secondary bg-card-bg-primary px-5 py-5">
                <h2
                  className="text-2xl font-medium text-txt-primary"
                  id="admin-bookings-heading"
                >
                  {heading}
                </h2>
              </header>
              <BookingListPanel
                permissions={permissions}
                previousOnly={previousOnly}
              />
            </section>
          </>
        )}
      </section>

      {toast ? (
        <div className="fixed right-4 top-4 z-[90]">
          <Toast
            onDismiss={() => setToast(null)}
            title={toast.title}
            tone={toast.tone}
          >
            {toast.message}
          </Toast>
        </div>
      ) : null}
    </>
  );
}

export function AdminBookingManager({
  permissions = [],
}: {
  permissions?: readonly BookingPermission[];
}) {
  return <BookingExplorer permissions={permissions} />;
}
