"use client";

import {
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ChevronDown, Eye, EyeOff, RotateCcw } from "lucide-react";
import {
  useAdminBookings,
  useAdminPrivateBookings,
} from "@/modules/bookings";
import { useAdminUsers } from "@/modules/users";
import {
  type PilatesSchedule,
  usePilates,
} from "@/modules/services/pilates";
import { useStaff } from "@/modules/staff";
import {
  adminCustomersClient,
  type CreateCustomerPayload,
  type CustomerProfile,
} from "@/modules/customers";
import {
  adminBookingsClient,
  type AdminBooking,
  type AdminBookingDetail,
  type AdminBookingFilters,
  type AdminBookingPaymentStatus,
  type AdminPrivateBookingFilters,
  type AdminBookingStatus,
  type AdminOverrideBookingPayload,
  type AdminWaitlistEntry,
  type CreatePrivateTrainerBookingPayload,
  type PrivateTrainerBooking,
  type PrivateTrainerBookingDetail,
} from "@/modules/bookings";
import { type AdminUserFilters } from "@/modules/users";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/data-display/DataTable";
import { LoadingState } from "@/components/data-display/LoadingState";
import { Toast } from "@/components/ui/Toast";

type ResultToast = {
  message: string;
  title: string;
  tone: "success" | "error";
};

type BookingMode = "class" | "private";
type CreateBookingMode = "class" | "private";
type CustomerBookingMode = "single" | "multiple";

const fieldClass =
  "min-h-12 w-full rounded-sm border border-background-secondary bg-card-bg-primary px-4 text-base text-txt-primary outline-none transition placeholder:text-txt-secondary focus:border-primary";
const BOOKING_PHONE_PATTERN = /^\+?[1-9]\d{6,15}$/u;
const BOOKING_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

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

function sourceLabel(value?: string | null): string {
  return value?.trim() ? label(value) : "Not recorded";
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

function availabilityReason(reason: string | null): string {
  if (reason === "past_slot") return "This time has already passed.";
  if (reason === "trainer_not_available") {
    return "The trainer is outside their configured working hours.";
  }
  if (reason === "pilates_class_schedule_conflict") {
    return "The trainer already has a Pilates class at this time.";
  }
  if (reason === "private_booking_conflict") {
    return "The trainer already has a private booking at this time.";
  }
  return "The trainer is unavailable at this time.";
}

function buildIdempotencyKey(
  payload: CreatePrivateTrainerBookingPayload,
): string {
  return [
    "private-booking",
    payload.session_date,
    payload.start_time.replace(":", "-"),
    payload.user_id.slice(0, 8),
    payload.trainer_staff_profile_id.slice(0, 8),
  ].join("-");
}

function buildBulkBookingKey(input: {
  customerUserId: string;
  scheduleIds: string[];
}): string {
  return [
    "admin-bulk",
    input.customerUserId.slice(0, 8),
    input.scheduleIds
      .map((scheduleId) => scheduleId.slice(0, 8))
      .join("-"),
    Date.now().toString(36),
  ].join("-");
}

function normalizeBookingText(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function normalizeBookingPhone(value: string): string {
  return value.trim().replace(/\s+/g, "");
}

function normalizeBookingCivilId(value: string): string {
  return value.trim().replace(/[^\d -]/g, "");
}

function assertCreateCustomerInput(input: {
  civilId: string;
  email: string;
  fullName: string;
  password: string;
  phone: string;
}): void {
  if (!input.fullName) {
    throw new Error("Full name is required to create a customer user.");
  }
  if (!BOOKING_EMAIL_PATTERN.test(input.email)) {
    throw new Error("Enter a valid email address for the customer user.");
  }
  if (!BOOKING_PHONE_PATTERN.test(input.phone)) {
    throw new Error("Phone must be international format, like +923001234567.");
  }
  if (input.civilId.replace(/\D/g, "").length !== 12) {
    throw new Error("Civil ID must contain exactly 12 digits.");
  }
  if (input.password.length < 8) {
    throw new Error("Password must be at least 8 characters long.");
  }
  if (!/[a-z]/u.test(input.password)) {
    throw new Error("Password must include at least one lowercase letter.");
  }
  if (!/[A-Z]/u.test(input.password)) {
    throw new Error("Password must include at least one uppercase letter.");
  }
  if (!/[0-9]/u.test(input.password)) {
    throw new Error("Password must include at least one number.");
  }
  if (!/[^A-Za-z0-9]/u.test(input.password)) {
    throw new Error("Password must include at least one symbol.");
  }
  if (/\s/u.test(input.password)) {
    throw new Error("Password must not contain spaces.");
  }
}

function buildMissingCustomerPayload(
  formData: FormData,
  lookupPhone: string,
  lookupCivilId: string,
): CreateCustomerPayload {
  const fullName = normalizeBookingText(formData.get("new_customer_full_name"));
  const email = normalizeBookingText(formData.get("new_customer_email")).toLowerCase();
  const phone = normalizeBookingPhone(lookupPhone);
  const civilId = normalizeBookingCivilId(lookupCivilId);
  const password = String(formData.get("new_customer_password") ?? "");
  const confirmPassword = String(
    formData.get("new_customer_confirm_password") ?? "",
  );

  if (password !== confirmPassword) {
    throw new Error("Password and confirmation do not match.");
  }

  assertCreateCustomerInput({
    civilId,
    email,
    fullName,
    password,
    phone,
  });

  return {
    full_name: fullName,
    email,
    phone,
    civil_id: civilId,
    password,
    confirm_password: confirmPassword,
    timezone:
      normalizeBookingText(formData.get("new_customer_timezone")) ||
      "Asia/Kuwait",
  };
}

function isPreviousBooking(booking: AdminBooking): boolean {
  return isPreviousStatus(booking.status);
}

function isPreviousPrivateBooking(booking: PrivateTrainerBooking): boolean {
  return isPreviousStatus(booking.status);
}

function isPreviousStatus(status: AdminBookingStatus): boolean {
  return (
    status === "cancelled" || status === "completed" || status === "no_show"
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
  const {
    schedules,
    isLoading: areSchedulesLoading,
    error: scheduleLoadError,
  } = usePilates();
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
          <CreateBookingCard
            areCustomersLoading={areCustomersLoading}
            customerOptions={customerOptions.map((customer) => [
              customer.id,
              `${customer.full_name ?? customer.email ?? customer.phone ?? "Unnamed customer"}${customer.email ? ` - ${customer.email}` : ""}`,
            ])}
            areSchedulesLoading={areSchedulesLoading}
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
            schedules={schedules}
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
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    null,
  );
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
    bookingMode === "class"
      ? classBookingState.total
      : privateBookingState.total;
  const activeError =
    bookingMode === "class"
      ? classBookingState.error
      : privateBookingState.error;
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
              { key: "source", heading: "Source" },
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
            <nav
              aria-label="Booking records pagination"
              className="flex items-center"
            >
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
  const bookingDate =
    booking.schedule?.class_date ?? booking.created_at.slice(0, 10);

  return (
    <tr className="divide-x divide-background-secondary bg-background-secondary/40 transition hover:bg-card-bg-secondary">
      <td className="px-4 py-4 align-top">
        <strong className="block text-txt-primary">
          {booking.booking_number}
        </strong>
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
        <strong className="block text-txt-primary">
          {formatDate(bookingDate)}
        </strong>
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
      <td className="px-4 py-4 align-top text-sm font-semibold text-txt-primary">
        {sourceLabel(booking.source)}
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
        <strong className="block text-txt-primary">
          {booking.booking_number}
        </strong>
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
      <td className="px-4 py-4 align-top text-sm font-semibold text-txt-primary">
        {sourceLabel(booking.source)}
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

      <section className="grid items-stretch gap-5 xl:grid-cols-3">
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
      </section>

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

function PrivateBookingDetailPanel({
  bookingId,
  onBack,
  onChanged,
}: {
  bookingId: string;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [booking, setBooking] = useState<PrivateTrainerBookingDetail | null>(
    null,
  );
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

      <section className="grid items-stretch gap-5 xl:grid-cols-2">
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
      </section>

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

function DetailItem({
  label: itemLabel,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-sm border border-background-secondary p-3">
      <dt className="text-xs font-bold uppercase text-txt-secondary">
        {itemLabel}
      </dt>
      <dd className="mt-1 break-words text-sm font-semibold">{value}</dd>
    </div>
  );
}

function ActionCard({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="flex min-h-[330px] flex-col rounded-md border border-background-secondary bg-card-bg-secondary p-4">
      <h4 className="mb-4 font-semibold">{title}</h4>
      <div className="flex flex-1 flex-col">{children}</div>
    </section>
  );
}

function CreateBookingCard({
  areCustomersLoading,
  areSchedulesLoading,
  customerOptions,
  isStaffLoading,
  onBulkCreated,
  onClose,
  onError,
  onPrivateCreated,
  scheduleLoadError,
  schedules,
  staffOptions,
}: {
  areCustomersLoading: boolean;
  areSchedulesLoading: boolean;
  customerOptions: Array<[string, string]>;
  isStaffLoading: boolean;
  onBulkCreated: (orderNumbers: string[]) => void;
  onClose: () => void;
  onError: (message: string) => void;
  onPrivateCreated: (bookingNumber: string) => void;
  scheduleLoadError: string | null;
  schedules: PilatesSchedule[];
  staffOptions: Array<[string, string]>;
}) {
  const [mode, setMode] = useState<CreateBookingMode>("class");

  return (
    <section className="grid gap-5">
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

      {mode === "class" ? (
        <CreateClassBulkBookingCard
          areSchedulesLoading={areSchedulesLoading}
          onClose={onClose}
          onCreated={onBulkCreated}
          onError={onError}
          scheduleLoadError={scheduleLoadError}
          schedules={schedules}
        />
      ) : (
        <CreatePrivateBookingCard
          areCustomersLoading={areCustomersLoading}
          customerOptions={customerOptions}
          isStaffLoading={isStaffLoading}
          onClose={onClose}
          onCreated={onPrivateCreated}
          onError={onError}
          staffOptions={staffOptions}
        />
      )}
    </section>
  );
}

function CreateClassBulkBookingCard({
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
  const [customerMode, setCustomerMode] =
    useState<CustomerBookingMode>("single");
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookupCivilId, setLookupCivilId] = useState("");
  const [lookupCustomer, setLookupCustomer] = useState<CustomerProfile | null>(
    null,
  );
  const [selectedCustomers, setSelectedCustomers] = useState<CustomerProfile[]>(
    [],
  );
  const [lookupStatus, setLookupStatus] = useState<{
    tone: "idle" | "loading" | "success" | "warning" | "error";
    message: string;
  }>({ tone: "idle", message: "Enter phone or Civil ID to find a customer." });
  const [classId, setClassId] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [showNewCustomerPassword, setShowNewCustomerPassword] = useState(false);
  const [showNewCustomerConfirmPassword, setShowNewCustomerConfirmPassword] =
    useState(false);

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

  useEffect(() => {
    const phone = lookupPhone.trim().replace(/\s+/g, "");
    const civilId = lookupCivilId.trim();
    const civilDigits = civilId.replace(/\D/g, "");
    const canLookupByPhone = phone.startsWith("+") && phone.length >= 8;
    const canLookupByCivilId = civilDigits.length === 12;

    if (!canLookupByPhone && !canLookupByCivilId) {
      const reset = window.setTimeout(() => {
        setLookupCustomer(null);
        setSelectedCustomers((current) =>
          customerMode === "single" ? [] : current,
        );
        setLookupStatus({
          tone: "idle",
          message: "Enter phone or a 12-digit Civil ID to find a customer.",
        });
      }, 0);

      return () => window.clearTimeout(reset);
    }

    const controller = new AbortController();
    const request = window.setTimeout(() => {
      setLookupStatus({ tone: "loading", message: "Looking up customer..." });
      void adminCustomersClient
        .lookup(
          {
            ...(canLookupByPhone ? { phone } : {}),
            ...(canLookupByCivilId ? { civil_id: civilId } : {}),
          },
          controller.signal,
        )
        .then((result) => {
          setLookupCustomer(result.customer);

          if (!result.customer) {
            setSelectedCustomers((current) =>
              customerMode === "single" ? [] : current,
            );
            setLookupStatus({
              tone: "warning",
              message:
                "No customer matched those details. Create the customer user below, then book.",
            });
            return;
          }

          if (customerMode === "single") {
            setSelectedCustomers([result.customer]);
          }

          setLookupStatus({
            tone: "success",
            message: `${result.customer.full_name} found and details filled.`,
          });
        })
        .catch((requestError: unknown) => {
          if (
            requestError instanceof DOMException &&
            requestError.name === "AbortError"
          ) {
            return;
          }

          setLookupCustomer(null);
          setLookupStatus({
            tone: "error",
            message: getErrorMessage(requestError),
          });
        });
    }, 120);

    return () => {
      window.clearTimeout(request);
      controller.abort();
    };
  }, [customerMode, lookupCivilId, lookupPhone]);

  const addLookupCustomer = () => {
    if (!lookupCustomer) return;

    setSelectedCustomers((current) =>
      current.some((customer) => customer.id === lookupCustomer.id)
        ? current
        : [...current, lookupCustomer],
    );
  };

  const toggleSchedule = (scheduleId: string) => {
    setSelectedScheduleIds((current) =>
      current.includes(scheduleId)
        ? current.filter((id) => id !== scheduleId)
        : [...current, scheduleId],
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
    const formData = new FormData(event.currentTarget);
    const notes = String(formData.get("admin_notes") ?? "").trim();
    const customers =
      customerMode === "single"
        ? selectedCustomers.slice(0, 1)
        : selectedCustomers;

    if (customers.length === 0) {
      onError("Find or create the customer user first.");
      return;
    }

    if (selectedScheduleIds.length === 0) {
      onError("Select at least one time slot.");
      return;
    }

    setIsCreating(true);
    try {
      const results = await Promise.all(
        customers.map((customer) =>
          adminBookingsClient.createBulkBooking({
            customer_user_id: customer.app_user_id,
            schedule_ids: selectedScheduleIds,
            idempotency_key: buildBulkBookingKey({
              customerUserId: customer.app_user_id,
              scheduleIds: selectedScheduleIds,
            }),
            ...(notes ? { admin_notes: notes } : {}),
          }),
        ),
      );
      const orderDetails = await Promise.all(
        results.map((result) =>
          adminBookingsClient
            .getBookingOrder(result.booking_order.id)
            .catch(() => null),
        ),
      );

      onCreated(
        results.map(
          (result, index) =>
            orderDetails[index]?.order_number ??
            result.booking_order.order_number,
        ),
      );
    } catch (requestError: unknown) {
      onError(getErrorMessage(requestError));
    } finally {
      setIsCreating(false);
    }
  };

  const createMissingCustomer = async (
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    const form = event.currentTarget.form;

    if (!form) return;

    setIsCreatingCustomer(true);
    try {
      const createdCustomer = await adminCustomersClient.create(
        buildMissingCustomerPayload(
          new FormData(form),
          lookupPhone,
          lookupCivilId,
        ),
      );

      setLookupCustomer(createdCustomer);
      setSelectedCustomers((current) =>
        customerMode === "single"
          ? [createdCustomer]
          : current.some((customer) => customer.id === createdCustomer.id)
            ? current
            : [...current, createdCustomer],
      );
      setLookupStatus({
        tone: "success",
        message: `${createdCustomer.full_name} was created and selected.`,
      });
      window.dispatchEvent(new CustomEvent("lafam:users:changed"));
    } catch (requestError: unknown) {
      setLookupStatus({
        tone: "error",
        message: getErrorMessage(requestError),
      });
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  const lookupStatusClass =
    lookupStatus.tone === "success"
      ? "border-success/30 bg-success/10 text-success"
      : lookupStatus.tone === "error"
        ? "border-error/30 bg-error/10 text-error"
        : lookupStatus.tone === "warning"
          ? "border-warning/30 bg-warning/10 text-warning"
          : "border-background-secondary bg-card-bg-secondary text-txt-secondary";

  return (
    <form
      className="overflow-hidden rounded-md border border-background-secondary bg-card-bg-primary text-txt-primary shadow-sm"
      onSubmit={(formEvent) => void createBulkBooking(formEvent)}
    >
      <header className="border-b border-background-secondary bg-card-bg-primary px-5 py-5">
        <h2 className="text-2xl font-medium">Add Class Booking</h2>
      </header>

      <div className="grid gap-6 px-5 py-5">
        <section className="rounded-sm border border-background-secondary bg-card-bg-secondary p-4">
          <h3 className="text-sm font-bold">1. Find customer user</h3>
          <p className="mt-1 text-sm text-txt-secondary">
            Enter phone or Civil ID. Existing customer details fill automatically.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-bold">
            Customer selection
            <span className="relative">
              <select
                className={`${fieldClass} appearance-none pr-10`}
                onChange={(event) => {
                  const nextMode = event.target.value as CustomerBookingMode;
                  setCustomerMode(nextMode);
                  setSelectedCustomers((current) =>
                    nextMode === "single" ? current.slice(0, 1) : current,
                  );
                }}
                value={customerMode}
              >
                <option value="single">Single customer</option>
                <option value="multiple">Multiple customers</option>
              </select>
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-txt-secondary"
                size={16}
              />
            </span>
          </label>
          <FormField
            label="Customer phone"
            name="lookup_phone"
            onChange={setLookupPhone}
            placeholder="+923001234567"
            type="text"
          />
          <FormField
            label="Civil ID"
            name="lookup_civil_id"
            onChange={setLookupCivilId}
            placeholder="2990-1011-2345"
            type="text"
          />
        </section>

        <section
          aria-live="polite"
          className={`rounded-sm border px-4 py-3 text-sm font-semibold ${lookupStatusClass}`}
          role={lookupStatus.tone === "error" ? "alert" : "status"}
        >
          {lookupStatus.message}
        </section>

        {lookupCustomer ? (
          <section className="grid gap-3 rounded-sm border border-background-secondary bg-card-bg-secondary p-4">
            <h3 className="text-sm font-bold">Customer detail</h3>
            <div className="grid gap-3 md:grid-cols-4">
              <DetailItem label="Customer" value={lookupCustomer.full_name} />
              <DetailItem label="Phone" value={lookupCustomer.phone} />
              <DetailItem label="Email" value={lookupCustomer.email} />
              <DetailItem label="Civil ID" value={lookupCustomer.civil_id} />
            </div>
            {customerMode === "multiple" ? (
              <button
                className="min-h-11 rounded-sm bg-button-primary px-4 py-3 text-sm font-semibold text-txt-primary"
                onClick={addLookupCustomer}
                type="button"
              >
                Add customer to booking list
              </button>
            ) : null}
          </section>
        ) : null}

        {!lookupCustomer && lookupStatus.tone === "warning" ? (
          <section className="grid gap-4 rounded-sm border border-warning/30 bg-warning/10 p-4">
            <div>
              <h3 className="text-sm font-bold">Create customer user for booking</h3>
              <p className="mt-1 text-sm text-txt-secondary">
                The phone and Civil ID above will be used for the new customer user.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label="Full name"
                name="new_customer_full_name"
                placeholder="Ahmad Sajid"
                required
              />
              <FormField
                label="Email"
                name="new_customer_email"
                placeholder="customer@example.com"
                required
                type="text"
              />
              <BookingPasswordField
                label="Password"
                name="new_customer_password"
                onToggle={() =>
                  setShowNewCustomerPassword((value) => !value)
                }
                required
                showPassword={showNewCustomerPassword}
              />
              <BookingPasswordField
                label="Confirm password"
                name="new_customer_confirm_password"
                onToggle={() =>
                  setShowNewCustomerConfirmPassword((value) => !value)
                }
                required
                showPassword={showNewCustomerConfirmPassword}
              />
              <FormField
                defaultValue="Asia/Kuwait"
                label="Timezone"
                name="new_customer_timezone"
                placeholder="Asia/Kuwait"
              />
            </div>
            <button
              className="min-h-11 rounded-sm bg-button-primary px-4 py-3 text-sm font-semibold text-txt-primary disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isCreatingCustomer}
              onClick={(buttonEvent) => void createMissingCustomer(buttonEvent)}
              type="button"
            >
              {isCreatingCustomer ? "Creating customer..." : "Create customer user"}
            </button>
          </section>
        ) : null}

        {customerMode === "multiple" && selectedCustomers.length > 0 ? (
          <section className="grid gap-2">
            <h3 className="text-sm font-bold">Selected customers</h3>
            <div className="flex flex-wrap gap-2">
              {selectedCustomers.map((customer) => (
                <span
                  className="inline-flex items-center gap-2 rounded-sm border border-background-secondary bg-card-bg-secondary px-3 py-2 text-sm font-semibold"
                  key={customer.id}
                >
                  {customer.full_name}
                  {customerMode === "multiple" ? (
                    <button
                      aria-label={`Remove ${customer.full_name}`}
                      className="text-error"
                      onClick={() =>
                        setSelectedCustomers((current) =>
                          current.filter((item) => item.id !== customer.id),
                        )
                      }
                      type="button"
                    >
                      X
                    </button>
                  ) : null}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {selectedCustomers.length > 0 ? (
          <>
            <section className="grid gap-4">
              <section className="rounded-sm border border-background-secondary bg-card-bg-secondary p-4">
                <h3 className="text-sm font-bold">
                  Booking Details
                </h3>
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
                    <span className="relative">
                      <select
                        className={`${fieldClass} appearance-none pr-10 disabled:cursor-not-allowed disabled:opacity-60`}
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
                            {formatDate(schedule.class_date)} |{" "}
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
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-txt-secondary"
                        size={16}
                      />
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
                        <option value="cash">Cash</option>
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

              <section className="grid gap-2">
                <h4 className="text-sm font-bold">Selected time slots</h4>
                {selectedSchedules.length > 0 ? (
                  <div className="grid gap-2">
                    {selectedSchedules.map((schedule) => (
                      <div
                        className="grid gap-2 rounded-sm border border-background-secondary bg-card-bg-secondary p-3 text-sm md:grid-cols-[1fr_auto]"
                        key={schedule.id}
                      >
                        <div>
                          <p className="font-semibold">
                            {schedule.class?.title ?? "Pilates class"}
                          </p>
                          <p className="mt-1 text-txt-secondary">
                            {formatDate(schedule.class_date)} |{" "}
                            {formatTime(schedule.start_time)} -{" "}
                            {formatTime(schedule.end_time)} | {schedule.studio}
                          </p>
                        </div>
                        <button
                          className="min-h-10 rounded-sm border border-background-secondary px-3 text-xs font-bold text-error"
                          onClick={() => toggleSchedule(schedule.id)}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-sm border border-background-secondary bg-card-bg-secondary p-3 text-sm text-txt-secondary">
                    No time slots selected.
                  </p>
                )}
              </section>
            </section>

            <ScheduleWaitlistPanel
              scheduleId={selectedScheduleIds[0] ?? ""}
              schedules={schedules}
            />
          </>
        ) : (
          <section className="rounded-sm border border-background-secondary bg-card-bg-secondary p-4 text-sm text-txt-secondary">
            Find or create a customer user before choosing a class.
          </section>
        )}
      </div>

      <footer className="flex justify-start gap-2 border-t border-background-secondary px-5 py-5">
        <button
          className="min-h-11 rounded-sm bg-button-primary px-4 py-3 text-xs font-bold text-txt-primary disabled:cursor-not-allowed disabled:opacity-60"
          disabled={
            isCreating ||
            selectedCustomers.length === 0 ||
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

function ScheduleWaitlistPanel({
  scheduleId,
  schedules,
}: {
  scheduleId: string;
  schedules: PilatesSchedule[];
}) {
  const [waitlist, setWaitlist] = useState<AdminWaitlistEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const schedule = schedules.find((item) => item.id === scheduleId);

  useEffect(() => {
    if (!scheduleId) {
      const reset = window.setTimeout(() => {
        setWaitlist([]);
        setError(null);
      }, 0);

      return () => window.clearTimeout(reset);
    }

    let isCurrent = true;
    const request = window.setTimeout(() => {
      setIsLoading(true);
      setError(null);

      void adminBookingsClient
        .listScheduleWaitlist(scheduleId)
        .then((result) => {
          if (isCurrent) {
            setWaitlist(result.waitlist);
          }
        })
        .catch((requestError: unknown) => {
          if (isCurrent) {
            setError(getErrorMessage(requestError));
          }
        })
        .finally(() => {
          if (isCurrent) {
            setIsLoading(false);
          }
        });
    }, 0);

    return () => {
      isCurrent = false;
      window.clearTimeout(request);
    };
  }, [scheduleId]);

  const removeEntry = async (waitlistId: string) => {
    setIsRemoving(true);
    setError(null);
    try {
      await adminBookingsClient.removeWaitlistEntry(waitlistId);
      setWaitlist((current) =>
        current.filter((entry) => entry.id !== waitlistId),
      );
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsRemoving(false);
    }
  };

  if (!scheduleId) {
    return (
      <section className="rounded-sm border border-background-secondary bg-card-bg-secondary p-4 text-sm text-txt-secondary">
        Select a time slot to review its waitlist.
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-sm border border-background-secondary bg-card-bg-secondary">
      <header className="border-b border-background-secondary px-4 py-3">
        <h3 className="text-sm font-bold">
          Waitlist for{" "}
          {schedule
            ? `${schedule.class?.title ?? "selected class"} | ${formatDate(schedule.class_date)} ${formatTime(schedule.start_time)}`
            : "selected slot"}
        </h3>
      </header>

      {isLoading ? (
        <LoadingState className="p-4" label="Loading waitlist" />
      ) : error ? (
        <p className="p-4 text-sm text-error" role="alert">
          {error}
        </p>
      ) : waitlist.length === 0 ? (
        <p className="p-4 text-sm text-txt-secondary">
          No waitlist entries for this slot.
        </p>
      ) : (
        <div className="grid gap-2 p-4">
          {waitlist.map((entry) => (
            <div
              className="grid gap-2 rounded-sm border border-background-secondary bg-card-bg-primary p-3 md:grid-cols-[1fr_auto]"
              key={entry.id}
            >
              <div>
                <p className="font-semibold">
                  #{entry.position}{" "}
                  {entry.customer?.full_name ??
                    entry.customer?.email ??
                    "Unnamed customer"}
                </p>
                <p className="mt-1 text-xs text-txt-secondary">
                  {label(entry.status)} | Joined {formatDateTime(entry.joined_at)}
                </p>
              </div>
              <button
                className="min-h-10 rounded-sm bg-error px-3 text-xs font-bold text-white disabled:opacity-60"
                disabled={isRemoving}
                onClick={() => void removeEntry(entry.id)}
                type="button"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
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
  onChange,
  placeholder,
  required = false,
  step,
  type = "text",
  value,
}: {
  defaultValue?: string;
  disabled?: boolean;
  label: string;
  min?: string;
  name: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  step?: string;
  type?: "date" | "number" | "text" | "time";
  value?: string;
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
        onChange={
          onChange ? (event) => onChange(event.target.value) : undefined
        }
        placeholder={placeholder}
        readOnly={value !== undefined && !onChange}
        required={required}
        step={step}
        type={type}
        value={value}
      />
    </label>
  );
}

function BookingPasswordField({
  disabled = false,
  label,
  name,
  onToggle,
  required = false,
  showPassword,
}: {
  disabled?: boolean;
  label: string;
  name: string;
  onToggle: () => void;
  required?: boolean;
  showPassword: boolean;
}) {
  const Icon = showPassword ? EyeOff : Eye;

  return (
    <label className="grid gap-1.5 text-xs font-bold">
      {label}
      <span className="relative">
        <input
          autoComplete="new-password"
          className={`${fieldClass} pr-12`}
          disabled={disabled}
          maxLength={128}
          minLength={8}
          name={name}
          required={required}
          type={showPassword ? "text" : "password"}
        />
        <button
          aria-label={showPassword ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-sm text-txt-secondary transition hover:bg-background-secondary hover:text-txt-primary"
          onClick={onToggle}
          type="button"
        >
          <Icon aria-hidden="true" size={18} />
        </button>
      </span>
    </label>
  );
}

function OptionSelect({
  disabled = false,
  label,
  name,
  onChange,
  options,
  placeholder,
  required = false,
  value,
}: {
  disabled?: boolean;
  label: string;
  name: string;
  onChange?: (value: string) => void;
  options: Array<[string, string]>;
  placeholder: string;
  required?: boolean;
  value?: string;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-bold">
      {label}
      <span className="relative">
        <select
          className={`${fieldClass} appearance-none pr-10 disabled:cursor-not-allowed disabled:opacity-60`}
          disabled={disabled}
          name={name}
          onChange={
            onChange ? (event) => onChange(event.target.value) : undefined
          }
          required={required}
          value={value}
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

export function AdminBookingManager() {
  return <BookingExplorer />;
}
