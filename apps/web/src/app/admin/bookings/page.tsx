"use client";

import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { ChevronDown, FileSpreadsheet, RotateCcw } from "lucide-react";
import {
  useAdminBookings,
  useAdminPrivateBookings,
} from "@/hooks/useAdminBookings";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { usePilates } from "@/hooks/usePilates";
import { useStaff } from "@/hooks/useStaff";
import {
  adminBookingsClient,
  type AdminBooking,
  type AdminBookingDetail,
  type AdminBookingFilters,
  type AdminBookingPaymentStatus,
  type AdminPrivateBookingFilters,
  type AdminBookingStatus,
  type AdminOverrideBookingPayload,
  type CreatePrivateTrainerBookingPayload,
  type PrivateTrainerBooking,
  type PrivateTrainerBookingDetail,
} from "@/lib/admin-bookings";
import { type AdminUserFilters } from "@/lib/admin-users";
import { Badge } from "@/components/reuseable_ui_components/badge";
import { DataTable } from "@/components/reuseable_ui_components/data_table";
import { LoadingState } from "@/components/reuseable_ui_components/loading_state";
import { Toast } from "@/components/reuseable_ui_components/toast";
import { PageHeader } from "@/components/page_header";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top_bar";

type ResultToast = {
  message: string;
  title: string;
  tone: "success" | "error";
};

type BookingMode = "class" | "private";

const fieldClass =
  "min-h-12 w-full rounded-sm border border-background-secondary bg-card-bg-primary px-4 text-base text-txt-primary outline-none transition placeholder:text-txt-secondary focus:border-primary";

const pageSizeOptions = [10, 25, 50];

const bookingStatuses: AdminBookingStatus[] = [
  "pending_payment",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
  "expired",
  "rescheduled",
  "deleted",
];

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function statusTone(
  status: string,
): "neutral" | "info" | "success" | "warning" | "error" {
  if (status === "confirmed" || status === "scheduled") return "success";
  if (status === "pending_payment" || status === "waiting") return "warning";
  if (status === "completed") return "info";
  if (status === "cancelled" || status === "deleted" || status === "expired") {
    return "error";
  }

  return "neutral";
}

function paymentTone(
  status: AdminBookingPaymentStatus,
): "neutral" | "info" | "success" | "warning" | "error" {
  if (status === "paid" || status === "not_required") return "success";
  if (status === "pending") return "warning";
  if (status === "failed" || status === "expired") return "error";
  if (status === "refunded") return "info";
  return "neutral";
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatTime(value: string): string {
  const [hours = "0", minutes = "00"] = value.split(":");
  const date = new Date(2000, 0, 1, Number(hours), Number(minutes));

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDateTime(value?: string | null): string {
  if (!value) return "Not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatPrice(amount?: number | null, currency?: string | null): string {
  if (amount === null || amount === undefined) return "Not configured";
  return `${amount.toFixed(3)} ${currency ?? "KWD"}`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The booking request failed.";
}

function buildIdempotencyKey(payload: CreatePrivateTrainerBookingPayload): string {
  return [
    "private-booking",
    payload.session_date,
    payload.start_time.replace(":", "-"),
    payload.user_id.slice(0, 8),
    payload.trainer_staff_profile_id.slice(0, 8),
  ].join("-");
}

function isPreviousBooking(booking: AdminBooking): boolean {
  return isPreviousStatus(booking.status);
}

function isPreviousPrivateBooking(booking: PrivateTrainerBooking): boolean {
  return isPreviousStatus(booking.status);
}

function isPreviousStatus(status: AdminBookingStatus): boolean {
  return (
    status === "cancelled" ||
    status === "completed" ||
    status === "no_show"
  );
}

export function BookingExplorer({
  heading = "Booking List",
  previousOnly = false,
}: {
  heading?: string;
  previousOnly?: boolean;
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toast, setToast] = useState<ResultToast | null>(null);
  const customerFilters = useMemo<AdminUserFilters>(() => ({}), []);
  const { users: customers, isLoading: areCustomersLoading } =
    useAdminUsers(customerFilters);
  const { staff, isLoading: isStaffLoading } = useStaff();
  const customerOptions = useMemo(() => {
    const customerLikeUsers = customers.filter(
      (customer) =>
        customer.is_guest ||
        customer.role === "customer" ||
        customer.role === "guest" ||
        customer.role === "user",
    );

    return customerLikeUsers.length > 0 ? customerLikeUsers : customers;
  }, [customers]);
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
          <CreatePrivateBookingCard
            areCustomersLoading={areCustomersLoading}
            customerOptions={customerOptions.map((customer) => [
              customer.id,
              `${customer.full_name ?? customer.email ?? customer.phone ?? "Unnamed customer"}${customer.email ? ` - ${customer.email}` : ""}`,
            ])}
            isStaffLoading={isStaffLoading}
            onClose={() => setIsCreateOpen(false)}
            onCreated={(bookingNumber) => {
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
            staffOptions={staffOptions.map((member) => [
              member.id,
              `${member.display_name} - ${member.post_title}`,
            ])}
          />
        ) : (
          <>
            <section className="flex items-center justify-between gap-4 rounded-md bg-card-bg-primary px-5 py-5 shadow-xl">
              <h2 className="text-2xl font-medium">Add New Booking</h2>
              <button
                className="min-h-12 rounded-sm bg-button-primary px-5 text-base font-semibold text-txt-primary transition hover:opacity-85"
                onClick={() => setIsCreateOpen(true)}
                type="button"
              >
                Add New Booking
              </button>
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
              <BookingListPanel previousOnly={previousOnly} />
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

function BookingListPanel({ previousOnly }: { previousOnly: boolean }) {
  const [bookingMode, setBookingMode] = useState<BookingMode>("class");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AdminBookingStatus | "">("");
  const [classId, setClassId] = useState("");
  const [trainerStaffProfileId, setTrainerStaffProfileId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [pageSize, setPageSize] = useState(pageSizeOptions[0]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [selectedPrivateBookingId, setSelectedPrivateBookingId] = useState<
    string | null
  >(null);
  const {
    classes,
    error: pilatesError,
    isLoading: isPilatesLoading,
    schedules,
    trainers,
  } = usePilates();
  const classOptions = useMemo(
    () =>
      classes
        .filter((item) => item.status !== "deleted")
        .map(
          (item) =>
            [
              item.id,
              `${item.title} - ${formatPrice(item.default_price_amount, item.currency)}`,
            ] as const,
        ),
    [classes],
  );
  const trainerOptions = useMemo(
    () =>
      trainers.map(
        (trainer) =>
          [
            trainer.id,
            `${trainer.display_name}${trainer.post_title ? ` - ${trainer.post_title}` : ""}`,
          ] as const,
      ),
    [trainers],
  );

  const filters = useMemo<AdminBookingFilters>(
    () => ({
      limit: pageSize,
      offset: (currentPage - 1) * pageSize,
      sort_by: "created_at",
      sort_direction: "desc",
      ...(search.trim() ? { search } : {}),
      ...(status ? { status } : {}),
      ...(classId.trim() ? { class_id: classId } : {}),
      ...(trainerStaffProfileId.trim()
        ? { trainer_staff_profile_id: trainerStaffProfileId }
        : {}),
      ...(fromDate ? { from_date: fromDate } : {}),
      ...(toDate ? { to_date: toDate } : {}),
    }),
    [
      classId,
      currentPage,
      fromDate,
      pageSize,
      search,
      status,
      toDate,
      trainerStaffProfileId,
    ],
  );
  const privateFilters = useMemo<AdminPrivateBookingFilters>(
    () => ({
      limit: pageSize,
      offset: (currentPage - 1) * pageSize,
      sort_by: "created_at",
      sort_direction: "desc",
      ...(search.trim() ? { search } : {}),
      ...(status ? { status } : {}),
      ...(trainerStaffProfileId.trim()
        ? { trainer_staff_profile_id: trainerStaffProfileId }
        : {}),
      ...(fromDate ? { from_date: fromDate } : {}),
      ...(toDate ? { to_date: toDate } : {}),
    }),
    [
      currentPage,
      fromDate,
      pageSize,
      search,
      status,
      toDate,
      trainerStaffProfileId,
    ],
  );
  const classBookingState = useAdminBookings(filters, bookingMode === "class");
  const privateBookingState = useAdminPrivateBookings(
    privateFilters,
    bookingMode === "private",
  );
  const visibleBookings = previousOnly
    ? classBookingState.bookings.filter(isPreviousBooking)
    : classBookingState.bookings;
  const visiblePrivateBookings = previousOnly
    ? privateBookingState.bookings.filter(isPreviousPrivateBooking)
    : privateBookingState.bookings;
  const activeTotal =
    bookingMode === "class" ? classBookingState.total : privateBookingState.total;
  const activeError =
    bookingMode === "class" ? classBookingState.error : privateBookingState.error;
  const activeIsLoading =
    bookingMode === "class"
      ? classBookingState.isLoading
      : privateBookingState.isLoading;
  const activeLoadBookings =
    bookingMode === "class"
      ? classBookingState.loadBookings
      : privateBookingState.loadBookings;
  const activeVisibleCount =
    bookingMode === "class"
      ? visibleBookings.length
      : visiblePrivateBookings.length;
  const pageCount = Math.max(1, Math.ceil(activeTotal / pageSize));
  const safeCurrentPage = Math.min(currentPage, pageCount);
  const visibleStart =
    activeTotal === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const visibleEnd = Math.min(
    (safeCurrentPage - 1) * pageSize + activeVisibleCount,
    activeTotal,
  );
  const resetToFirstPage = () => setCurrentPage(1);
  const selectBookingMode = (mode: BookingMode) => {
    setBookingMode(mode);
    setSelectedBookingId(null);
    setSelectedPrivateBookingId(null);
    setClassId("");
    setCurrentPage(1);
  };

  if (selectedBookingId) {
    return (
      <BookingDetailPanel
        bookingId={selectedBookingId}
        onBack={() => setSelectedBookingId(null)}
        onChanged={() =>
          void classBookingState.loadBookings().catch(() => undefined)
        }
        schedules={schedules}
      />
    );
  }

  if (selectedPrivateBookingId) {
    return (
      <PrivateBookingDetailPanel
        bookingId={selectedPrivateBookingId}
        onBack={() => setSelectedPrivateBookingId(null)}
        onChanged={() =>
          void privateBookingState.loadBookings().catch(() => undefined)
        }
      />
    );
  }

  return (
    <>
      <div className="grid gap-4 border-b border-background-secondary px-5 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <button
              aria-label="Export booking records"
              className="flex size-12 shrink-0 items-center justify-center rounded-md bg-button-secondary text-txt-primary transition hover:opacity-80"
              type="button"
            >
              <FileSpreadsheet aria-hidden="true" size={22} strokeWidth={2.4} />
            </button>
            <div className="flex min-h-12 overflow-hidden rounded-sm border border-background-secondary bg-card-bg-secondary p-1">
              {(["class", "private"] as const).map((mode) => (
                <button
                  className={`rounded-sm px-4 text-sm font-semibold transition ${
                    bookingMode === mode
                      ? "bg-button-primary text-txt-primary"
                      : "text-txt-secondary hover:text-txt-primary"
                  }`}
                  key={mode}
                  onClick={() => selectBookingMode(mode)}
                  type="button"
                >
                  {mode === "class" ? "Class bookings" : "Private bookings"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label>
              <span className="sr-only">Search booking records</span>
              <input
                className={fieldClass}
                onChange={(event) => {
                  setSearch(event.target.value);
                  resetToFirstPage();
                }}
                placeholder="Search..."
                type="search"
                value={search}
              />
            </label>
            <FilterSelect
              label="Status"
              onChange={(value) => {
                setStatus(value as AdminBookingStatus | "");
                resetToFirstPage();
              }}
              options={[
                ["", "All statuses"],
                ...bookingStatuses.map((item) => [item, label(item)] as const),
              ]}
              value={status}
            />
            <DateField
              label="From date"
              onChange={(value) => {
                setFromDate(value);
                resetToFirstPage();
              }}
              value={fromDate}
            />
            <DateField
              label="To date"
              onChange={(value) => {
                setToDate(value);
                resetToFirstPage();
              }}
              value={toDate}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {bookingMode === "class" ? (
            <FilterSelect
              disabled={isPilatesLoading || classOptions.length === 0}
              label="Class"
              onChange={(value) => {
                setClassId(value);
                resetToFirstPage();
              }}
              options={[
                ["", isPilatesLoading ? "Loading classes..." : "All classes"],
                ...classOptions,
              ]}
              value={classId}
            />
          ) : null}
          <FilterSelect
            disabled={isPilatesLoading || trainerOptions.length === 0}
            label="Staff trainer"
            onChange={(value) => {
              setTrainerStaffProfileId(value);
              resetToFirstPage();
            }}
            options={[
              ["", isPilatesLoading ? "Loading trainers..." : "All trainers"],
              ...trainerOptions,
            ]}
            value={trainerStaffProfileId}
          />
        </div>

        {pilatesError ? (
          <p className="text-sm text-error" role="alert">
            {pilatesError}
          </p>
        ) : null}
      </div>

      {activeIsLoading ? (
        <LoadingState className="p-6" label="Loading booking records" />
      ) : activeError ? (
        <div className="p-6">
          <p className="text-sm text-txt-primary" role="alert">
            {activeError}
          </p>
          <button
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-button-primary px-4 py-2 text-xs font-bold text-txt-primary"
            onClick={() => void activeLoadBookings().catch(() => undefined)}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={14} />
            Try again
          </button>
        </div>
      ) : (
        <>
          <DataTable
            columns={[
              { key: "booking-no", heading: "Booking No." },
              { key: "customer", heading: "Customer" },
              {
                key: "booking-target",
                heading: bookingMode === "class" ? "Class" : "Session",
              },
              { key: "trainer", heading: "Trainer" },
              { key: "date", heading: "Date" },
              { key: "status", heading: "Status" },
              { key: "payment", heading: "Payment" },
              { key: "price", heading: "Price" },
              { key: "action", heading: "Action" },
            ]}
            emptyMessage="No booking records found."
            isEmpty={
              bookingMode === "class"
                ? visibleBookings.length === 0
                : visiblePrivateBookings.length === 0
            }
            minWidthClassName="min-w-[1040px]"
          >
            {bookingMode === "class"
              ? visibleBookings.map((booking) => (
                  <BookingRecordRow
                    booking={booking}
                    key={booking.id}
                    onView={() => setSelectedBookingId(booking.id)}
                  />
                ))
              : visiblePrivateBookings.map((booking) => (
                  <PrivateBookingRecordRow
                    booking={booking}
                    key={booking.id}
                    onView={() => setSelectedPrivateBookingId(booking.id)}
                  />
                ))}
          </DataTable>

          <footer className="flex flex-col gap-4 px-5 pb-5 text-base text-txt-secondary md:flex-row md:items-center md:justify-between">
            <label className="flex items-center gap-4">
              <span className="relative inline-flex">
                <select
                  aria-label="Records per page"
                  className="min-h-12 appearance-none rounded-sm border border-background-secondary bg-card-bg-primary px-4 pr-10 text-txt-primary outline-none focus:border-primary"
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    resetToFirstPage();
                  }}
                  value={pageSize}
                >
                  {pageSizeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-txt-secondary"
                  size={16}
                />
              </span>
              records per page
            </label>
            <p>
              Showing {visibleStart} to {visibleEnd} of {activeTotal} entries
            </p>
            <nav aria-label="Booking records pagination" className="flex items-center">
              <button
                className="min-h-11 rounded-l-sm border border-background-secondary px-4 text-txt-secondary disabled:cursor-not-allowed disabled:opacity-50"
                disabled={safeCurrentPage === 1}
                onClick={() =>
                  setCurrentPage(() => Math.max(1, safeCurrentPage - 1))
                }
                type="button"
              >
                Previous
              </button>
              <span className="flex min-h-11 min-w-11 items-center justify-center bg-button-primary px-4 font-medium text-txt-primary">
                {safeCurrentPage}
              </span>
              <button
                className="min-h-11 rounded-r-sm border border-background-secondary px-4 text-txt-secondary disabled:cursor-not-allowed disabled:opacity-50"
                disabled={safeCurrentPage >= pageCount}
                onClick={() =>
                  setCurrentPage(() => Math.min(pageCount, safeCurrentPage + 1))
                }
                type="button"
              >
                Next
              </button>
            </nav>
          </footer>
        </>
      )}
    </>
  );
}

function BookingRecordRow({
  booking,
  onView,
}: {
  booking: AdminBooking;
  onView: () => void;
}) {
  const customerName =
    booking.customer?.full_name ?? booking.customer?.email ?? "No customer";
  const trainerName =
    booking.trainer?.display_name ?? booking.trainer_staff_profile_id;
  const classTitle = booking.class?.title ?? "No class";
  const bookingDate = booking.schedule?.class_date ?? booking.created_at.slice(0, 10);

  return (
    <tr className="divide-x divide-background-secondary bg-background-secondary/40 transition hover:bg-card-bg-secondary">
      <td className="px-4 py-4 align-top">
        <strong className="block text-txt-primary">{booking.booking_number}</strong>
        <span className="mt-1 block font-mono text-xs text-txt-secondary">
          {booking.id}
        </span>
      </td>
      <td className="px-4 py-4 align-top">
        <strong className="block text-txt-primary">{customerName}</strong>
        <span className="mt-1 block text-sm text-txt-secondary">
          {booking.customer?.phone ?? booking.customer?.email ?? "No contact"}
        </span>
      </td>
      <td className="px-4 py-4 align-top text-txt-primary">{classTitle}</td>
      <td className="px-4 py-4 align-top text-txt-primary">{trainerName}</td>
      <td className="px-4 py-4 align-top">
        <strong className="block text-txt-primary">{formatDate(bookingDate)}</strong>
        <span className="mt-1 block text-sm text-txt-secondary">
          {booking.schedule?.start_time && booking.schedule.end_time
            ? `${booking.schedule.start_time} - ${booking.schedule.end_time}`
            : formatDateTime(booking.created_at)}
        </span>
      </td>
      <td className="px-4 py-4 align-top">
        <Badge tone={statusTone(booking.status)}>{label(booking.status)}</Badge>
      </td>
      <td className="px-4 py-4 align-top">
        <Badge tone={paymentTone(booking.payment_status)}>
          {label(booking.payment_status)}
        </Badge>
      </td>
      <td className="px-4 py-4 align-top font-semibold text-txt-primary">
        {formatPrice(booking.price?.amount, booking.price?.currency)}
      </td>
      <td className="px-4 py-4 align-top">
        <button
          className="min-h-10 rounded-sm bg-button-primary px-4 text-sm font-semibold text-txt-primary transition hover:opacity-90"
          onClick={onView}
          type="button"
        >
          View booking
        </button>
      </td>
    </tr>
  );
}

function PrivateBookingRecordRow({
  booking,
  onView,
}: {
  booking: PrivateTrainerBooking;
  onView: () => void;
}) {
  const customerName =
    booking.customer?.full_name ?? booking.customer?.email ?? "No customer";
  const trainerName =
    booking.trainer?.display_name ?? booking.trainer_staff_profile_id;

  return (
    <tr className="divide-x divide-background-secondary bg-background-secondary/40 transition hover:bg-card-bg-secondary">
      <td className="px-4 py-4 align-top">
        <strong className="block text-txt-primary">{booking.booking_number}</strong>
        <span className="mt-1 block font-mono text-xs text-txt-secondary">
          {booking.id}
        </span>
      </td>
      <td className="px-4 py-4 align-top">
        <strong className="block text-txt-primary">{customerName}</strong>
        <span className="mt-1 block text-sm text-txt-secondary">
          {booking.customer?.phone ?? booking.customer?.email ?? "No contact"}
        </span>
      </td>
      <td className="px-4 py-4 align-top text-txt-primary">
        Private trainer
        <span className="mt-1 block text-sm text-txt-secondary">
          {booking.studio}
        </span>
      </td>
      <td className="px-4 py-4 align-top text-txt-primary">{trainerName}</td>
      <td className="px-4 py-4 align-top">
        <strong className="block text-txt-primary">
          {formatDate(booking.session_date)}
        </strong>
        <span className="mt-1 block text-sm text-txt-secondary">
          {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
        </span>
      </td>
      <td className="px-4 py-4 align-top">
        <Badge tone={statusTone(booking.status)}>{label(booking.status)}</Badge>
      </td>
      <td className="px-4 py-4 align-top">
        <Badge tone={paymentTone(booking.payment_status)}>
          {label(booking.payment_status)}
        </Badge>
      </td>
      <td className="px-4 py-4 align-top font-semibold text-txt-primary">
        {formatPrice(booking.price?.amount, booking.price?.currency)}
      </td>
      <td className="px-4 py-4 align-top">
        <button
          className="min-h-10 rounded-sm bg-button-primary px-4 text-sm font-semibold text-txt-primary transition hover:opacity-90"
          onClick={onView}
          type="button"
        >
          View booking
        </button>
      </td>
    </tr>
  );
}

function BookingDetailPanel({
  bookingId,
  onBack,
  onChanged,
  schedules,
}: {
  bookingId: string;
  onBack: () => void;
  onChanged: () => void;
  schedules: ReturnType<typeof usePilates>["schedules"];
}) {
  const [booking, setBooking] = useState<AdminBookingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");

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
        .map((schedule) => [
          schedule.id,
          [
            `${formatTime(schedule.start_time)} - ${formatTime(schedule.end_time)}`,
            schedule.class?.title ?? schedule.class_id,
            schedule.trainer?.display_name ?? schedule.trainer_staff_profile_id,
            formatPrice(schedule.price_amount, schedule.currency),
          ].join(" | "),
        ] as const),
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
    const reason = String(new FormData(event.currentTarget).get("reason")).trim();

    setIsSaving(true);
    setError(null);
    try {
      await adminBookingsClient.cancelBooking(bookingId, { reason });
      event.currentTarget.reset();
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
      target_status: String(formData.get("target_status")) as AdminBookingStatus,
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
        <button className="mt-3 rounded-sm border border-background-secondary px-4 py-2 text-sm font-semibold text-txt-secondary" onClick={onBack} type="button">
          Back to bookings
        </button>
      </div>
    );
  }

  const customerName =
    booking.customer?.full_name ?? booking.customer?.email ?? "No customer";
  const trainerName =
    booking.trainer?.display_name ?? booking.trainer_staff_profile_id;
  const bookingDate = booking.schedule?.class_date ?? booking.created_at.slice(0, 10);

  return (
    <section className="grid gap-6 p-5 text-txt-primary">
      <header className="flex flex-col gap-4 border-b border-background-secondary pb-5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold text-txt-secondary">Booking detail</p>
          <h3 className="mt-1 text-2xl font-medium">{booking.booking_number}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone={statusTone(booking.status)}>{label(booking.status)}</Badge>
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
        <p className="rounded-sm border border-error/30 bg-error/10 px-4 py-3 text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}

      <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DetailItem label="Customer" value={customerName} />
        <DetailItem label="Class" value={booking.class?.title ?? "No class"} />
        <DetailItem label="Trainer" value={trainerName} />
        <DetailItem label="Date" value={formatDate(bookingDate)} />
        <DetailItem label="Time" value={booking.schedule ? `${booking.schedule.start_time} - ${booking.schedule.end_time}` : formatDateTime(booking.created_at)} />
        <DetailItem label="Price" value={formatPrice(booking.price?.amount, booking.price?.currency)} />
        <DetailItem label="Booking ID" value={booking.id} />
        <DetailItem label="Schedule ID" value={booking.schedule_id} />
        <DetailItem label="Admin notes" value={booking.admin_notes ?? "No admin notes"} />
      </dl>

      <section className="grid items-stretch gap-5 xl:grid-cols-3">
        <ActionCard title="Cancel booking">
          <form className="flex h-full flex-col gap-3" onSubmit={(event) => void cancelBooking(event)}>
            <FormField label="Audit reason" name="reason" required />
            <button className="mt-auto min-h-11 rounded-sm bg-error px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isSaving} type="submit">
              Cancel booking
            </button>
          </form>
        </ActionCard>

        <ActionCard title="Reschedule booking">
          <form className="flex h-full flex-col gap-3" onSubmit={(event) => void rescheduleBooking(event)}>
            <label className="grid gap-1.5 text-xs font-bold">
              New date
              <span className="relative">
                <select
                  className={`${fieldClass} appearance-none pr-10`}
                  disabled={isSaving || rescheduleDateOptions.length === 0}
                  onChange={(event) => setRescheduleDate(event.target.value)}
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
                <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-txt-secondary" size={16} />
              </span>
            </label>
            <label className="grid gap-1.5 text-xs font-bold">
              Available time
              <span className="relative">
                <select
                  className={`${fieldClass} appearance-none pr-10`}
                  disabled={isSaving || !rescheduleDate || rescheduleTimeOptions.length === 0}
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
                <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-txt-secondary" size={16} />
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-txt-primary">
              <input className="size-4 accent-primary" name="join_waitlist_if_full" type="checkbox" />
              Join waitlist if full
            </label>
            <FormField label="Reason" name="reason" />
            <button className="mt-auto min-h-11 rounded-sm bg-button-primary px-4 text-sm font-semibold text-txt-primary disabled:opacity-60" disabled={isSaving || !rescheduleDate || rescheduleTimeOptions.length === 0} type="submit">
              Reschedule
            </button>
          </form>
        </ActionCard>

        <ActionCard title="Override status">
          <form className="flex h-full flex-col gap-3" onSubmit={(event) => void overrideBooking(event)}>
            <label className="grid gap-1.5 text-xs font-bold">
              Target status
              <span className="relative">
                <select className={`${fieldClass} appearance-none pr-10`} defaultValue={booking.status} name="target_status">
                  {bookingStatuses.map((statusOption) => (
                    <option key={statusOption} value={statusOption}>
                      {label(statusOption)}
                    </option>
                  ))}
                </select>
                <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-txt-secondary" size={16} />
              </span>
            </label>
            <FormField label="Audit reason" name="reason" required />
            <label className="grid gap-1.5 text-xs font-bold">
              Admin notes
              <textarea className={`${fieldClass} min-h-24 resize-y`} name="admin_notes" />
            </label>
            <button className="mt-auto min-h-11 rounded-sm bg-button-primary px-4 text-sm font-semibold text-txt-primary disabled:opacity-60" disabled={isSaving} type="submit">
              Override status
            </button>
          </form>
        </ActionCard>
      </section>

      <section className="rounded-md border border-background-secondary">
        <header className="border-b border-background-secondary px-4 py-3">
          <h4 className="font-semibold">Booking history</h4>
        </header>
        <div className="grid gap-3 p-4">
          {booking.history.length > 0 ? (
            booking.history.map((entry) => (
              <div className="rounded-sm bg-background-secondary/40 p-3 text-sm" key={entry.id}>
                <p className="font-semibold">{label(entry.action)}</p>
                <p className="mt-1 text-txt-secondary">
                  {formatDateTime(entry.created_at)} {entry.from_status ? `${label(entry.from_status)} -> ` : ""}{entry.to_status ? label(entry.to_status) : ""}
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

function PrivateBookingDetailPanel({
  bookingId,
  onBack,
  onChanged,
}: {
  bookingId: string;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [booking, setBooking] = useState<PrivateTrainerBookingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
    const reason = String(new FormData(event.currentTarget).get("reason")).trim();

    setIsSaving(true);
    setError(null);
    try {
      await adminBookingsClient.cancelPrivateTrainerBooking(bookingId, { reason });
      event.currentTarget.reset();
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
    const targetSessionDate = String(formData.get("target_session_date")).trim();
    const targetStartTime = String(formData.get("target_start_time")).trim();

    setIsSaving(true);
    setError(null);
    try {
      await adminBookingsClient.reschedulePrivateTrainerBooking(bookingId, {
        payment_required: formData.get("payment_required") === "true",
        target_duration_minutes: Number(formData.get("target_duration_minutes") || 60),
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
    return <LoadingState className="p-6" label="Loading private booking details" />;
  }

  if (!booking) {
    return (
      <div className="p-6">
        <p className="text-sm text-error" role="alert">
          {error ?? "Private booking details could not be loaded."}
        </p>
        <button className="mt-3 rounded-sm border border-background-secondary px-4 py-2 text-sm font-semibold text-txt-secondary" onClick={onBack} type="button">
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
          <h3 className="mt-1 text-2xl font-medium">{booking.booking_number}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone={statusTone(booking.status)}>{label(booking.status)}</Badge>
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
        <p className="rounded-sm border border-error/30 bg-error/10 px-4 py-3 text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}

      <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DetailItem label="Customer" value={customerName} />
        <DetailItem label="Session" value="Private trainer" />
        <DetailItem label="Trainer" value={trainerName} />
        <DetailItem label="Date" value={formatDate(booking.session_date)} />
        <DetailItem label="Time" value={`${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}`} />
        <DetailItem label="Duration" value={`${booking.duration_minutes} minutes`} />
        <DetailItem label="Studio" value={booking.studio} />
        <DetailItem label="Price" value={formatPrice(booking.price?.amount, booking.price?.currency)} />
        <DetailItem label="Booking ID" value={booking.id} />
        <DetailItem label="Admin notes" value={booking.admin_notes ?? "No admin notes"} />
      </dl>

      <section className="grid items-stretch gap-5 xl:grid-cols-2">
        <ActionCard title="Cancel private booking">
          <form className="flex h-full flex-col gap-3" onSubmit={(event) => void cancelBooking(event)}>
            <FormField label="Audit reason" name="reason" required />
            <button className="mt-auto min-h-11 rounded-sm bg-error px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isSaving} type="submit">
              Cancel booking
            </button>
          </form>
        </ActionCard>

        <ActionCard title="Reschedule private booking">
          <form className="flex h-full flex-col gap-3" onSubmit={(event) => void rescheduleBooking(event)}>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField defaultValue={booking.session_date} label="New date" name="target_session_date" required type="date" />
              <FormField defaultValue={booking.start_time.slice(0, 5)} label="Start time" name="target_start_time" required type="time" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField defaultValue={String(booking.duration_minutes)} label="Duration minutes" name="target_duration_minutes" required type="number" />
              <FormField defaultValue={booking.studio} label="Studio" name="studio" />
            </div>
            <label className="grid gap-1.5 text-xs font-bold">
              Payment required
              <span className="relative">
                <select className={`${fieldClass} appearance-none pr-10`} defaultValue={String(booking.payment_required)} name="payment_required">
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
                <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-txt-secondary" size={16} />
              </span>
            </label>
            <FormField label="Reason" name="reason" />
            <button className="mt-auto min-h-11 rounded-sm bg-button-primary px-4 text-sm font-semibold text-txt-primary disabled:opacity-60" disabled={isSaving} type="submit">
              Reschedule
            </button>
          </form>
        </ActionCard>
      </section>

      <section className="rounded-md border border-background-secondary">
        <header className="border-b border-background-secondary px-4 py-3">
          <h4 className="font-semibold">Private booking history</h4>
        </header>
        <div className="grid gap-3 p-4">
          {booking.history.length > 0 ? (
            booking.history.map((entry) => (
              <div className="rounded-sm bg-background-secondary/40 p-3 text-sm" key={entry.id}>
                <p className="font-semibold">{label(entry.action)}</p>
                <p className="mt-1 text-txt-secondary">
                  {formatDateTime(entry.created_at)} {entry.from_status ? `${label(entry.from_status)} -> ` : ""}{entry.to_status ? label(entry.to_status) : ""}
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

function DetailItem({ label: itemLabel, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-background-secondary p-3">
      <dt className="text-xs font-bold uppercase text-txt-secondary">{itemLabel}</dt>
      <dd className="mt-1 break-words text-sm font-semibold">{value}</dd>
    </div>
  );
}

function ActionCard({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="flex min-h-[330px] flex-col rounded-md border border-background-secondary bg-card-bg-secondary p-4">
      <h4 className="mb-4 font-semibold">{title}</h4>
      <div className="flex flex-1 flex-col">{children}</div>
    </section>
  );
}

function CreatePrivateBookingCard({
  areCustomersLoading,
  customerOptions,
  isStaffLoading,
  onClose,
  onCreated,
  onError,
  staffOptions,
}: {
  areCustomersLoading: boolean;
  customerOptions: Array<[string, string]>;
  isStaffLoading: boolean;
  onClose: () => void;
  onCreated: (bookingNumber: string) => void;
  onError: (message: string) => void;
  staffOptions: Array<[string, string]>;
}) {
  const [isCreating, setIsCreating] = useState(false);

  const createPrivateBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
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
      user_id: String(formData.get("user_id")).trim(),
    };
    payload.idempotency_key =
      String(formData.get("idempotency_key")).trim() ||
      buildIdempotencyKey(payload);

    setIsCreating(true);
    try {
      const result = await adminBookingsClient.createPrivateTrainer(payload);
      form.reset();
      onCreated(result.private_booking.booking_number);
    } catch (requestError: unknown) {
      onError(getErrorMessage(requestError));
    } finally {
      setIsCreating(false);
    }
  };

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
          Create a private trainer booking for a customer and trainer.
        </p>
        <div className="grid gap-5 md:grid-cols-2">
          <OptionSelect
            disabled={areCustomersLoading || customerOptions.length === 0}
            label="Customer"
            name="user_id"
            options={customerOptions}
            placeholder={
              areCustomersLoading ? "Loading customers..." : "Select customer"
            }
            required
          />
          <OptionSelect
            disabled={isStaffLoading || staffOptions.length === 0}
            label="Staff trainer"
            name="trainer_staff_profile_id"
            options={staffOptions}
            placeholder={isStaffLoading ? "Loading staff..." : "Select staff"}
            required
          />
          <FormField label="Session date" name="session_date" required type="date" />
          <FormField label="Start time" name="start_time" required type="time" />
          <FormField
            defaultValue="60"
            label="Duration minutes"
            name="duration_minutes"
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

        </div>
      </div>

      <footer className="flex justify-start gap-2 border-t border-background-secondary px-5 py-5">
        <button
          className="min-h-11 rounded-sm bg-button-primary px-4 py-3 text-xs font-bold text-txt-primary disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isCreating}
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

function FilterSelect({
  label: filterLabel,
  options,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  options: ReadonlyArray<readonly [string, string]>;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="relative">
      <span className="sr-only">{filterLabel}</span>
      <select
        aria-label={filterLabel}
        className={`${fieldClass} appearance-none pr-10 disabled:cursor-not-allowed disabled:opacity-60`}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue || "all"} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-txt-secondary"
        size={16}
      />
    </label>
  );
}

function DateField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <input
        aria-label={label}
        className={fieldClass}
        onChange={(event) => onChange(event.target.value)}
        type="date"
        value={value}
      />
    </label>
  );
}

function FormField({
  defaultValue,
  disabled = false,
  label,
  min,
  name,
  placeholder,
  required = false,
  step,
  type = "text",
}: {
  defaultValue?: string;
  disabled?: boolean;
  label: string;
  min?: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  step?: string;
  type?: "date" | "number" | "text" | "time";
}) {
  return (
    <label className="grid gap-1.5 text-xs font-bold">
      {label}
      <input
        className={fieldClass}
        defaultValue={defaultValue}
        disabled={disabled}
        min={min}
        name={name}
        placeholder={placeholder}
        required={required}
        step={step}
        type={type}
      />
    </label>
  );
}

function OptionSelect({
  disabled = false,
  label,
  name,
  options,
  placeholder,
  required = false,
}: {
  disabled?: boolean;
  label: string;
  name: string;
  options: Array<[string, string]>;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-bold">
      {label}
      <span className="relative">
        <select
          className={`${fieldClass} appearance-none pr-10 disabled:cursor-not-allowed disabled:opacity-60`}
          defaultValue=""
          disabled={disabled}
          name={name}
          required={required}
        >
          <option value="">{placeholder}</option>
          {options.map(([value, optionLabel]) => (
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
  );
}

export default function BookingsPage() {
  return (
    <div className="min-h-screen bg-background-primary">
      <TopBar
        dateLabel="8 Jun - 14 Jun 2026"
        description="Manage appointments"
        title="Bookings"
      />
      <div className="md:flex">
        <Sidebar activeItem="Bookings" />
        <div className="min-w-0 flex-1">
          <PageHeader title="Bookings" />
          <main className="p-4 lg:p-10">
            <BookingExplorer />
          </main>
        </div>
      </div>
    </div>
  );
}
