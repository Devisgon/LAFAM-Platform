"use client";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { useAdminBookings, useAdminPrivateBookings } from "@/modules/bookings";
import { type PilatesSchedule, usePilates } from "@/modules/services/pilates";
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
  type CreatePrivateTrainerBookingPayload,
  type PrivateTrainerBooking,
  type PrivateTrainerBookingDetail,
} from "@/modules/bookings";
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
type LookupStatus = {
  tone: "idle" | "loading" | "success" | "warning" | "error";
  message: string;
};
type CustomerDraft = {
  civilId: string;
  email: string;
  fullName: string;
  phone: string;
  timezone: string;
};

const fieldClass =
  "min-h-12 w-full rounded-sm border border-background-secondary bg-card-bg-primary px-4 text-base text-txt-primary outline-none transition placeholder:text-txt-secondary focus:border-primary";
const KUWAIT_PHONE_CODE = "+965";
const KUWAIT_PHONE_DIGIT_COUNT = 8;
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
    input.scheduleIds.map((scheduleId) => scheduleId.slice(0, 8)).join("-"),
    Date.now().toString(36),
  ].join("-");
}

function normalizeBookingText(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function normalizeBookingPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  const localDigits = digits.startsWith("965") ? digits.slice(3) : digits;

  return localDigits ? `${KUWAIT_PHONE_CODE}${localDigits}` : "";
}

function normalizeBookingCivilId(value: string): string {
  return value.trim().replace(/[^\d -]/g, "");
}

function bookingPhoneLocalValue(value: string): string {
  const digits = value.replace(/\D/g, "");

  return digits.startsWith("965") ? digits.slice(3) : digits;
}

function isValidKuwaitBookingPhone(value: string): boolean {
  return bookingPhoneLocalValue(value).length === KUWAIT_PHONE_DIGIT_COUNT;
}

function createGeneratedAttendeePassword(): string {
  const bytes = new Uint32Array(2);

  if (typeof window !== "undefined" && window.crypto) {
    window.crypto.getRandomValues(bytes);
  } else {
    bytes[0] = Date.now();
    bytes[1] = Math.floor(Math.random() * 1_000_000);
  }

  return `Lafam-${bytes[0].toString(36)}-${bytes[1].toString(36)}aA1!`;
}

function assertAttendeeInput(input: {
  civilId: string;
  email: string;
  fullName: string;
  phone: string;
}): void {
  if (!input.fullName) {
    throw new Error("Full name is required.");
  }
  if (!BOOKING_EMAIL_PATTERN.test(input.email)) {
    throw new Error("Enter a valid email address.");
  }
  if (!isValidKuwaitBookingPhone(input.phone)) {
    throw new Error("Enter a valid Kuwait phone number.");
  }
  if (input.civilId.replace(/\D/g, "").length !== 12) {
    throw new Error("Invalid Civil ID.");
  }
}

function buildManualAttendeePayload(formData: FormData): CreateCustomerPayload {
  const fullName = normalizeBookingText(formData.get("new_customer_full_name"));
  const email = normalizeBookingText(
    formData.get("new_customer_email"),
  ).toLowerCase();
  const phone = normalizeBookingPhone(
    String(formData.get("lookup_phone") ?? ""),
  );
  const civilId = normalizeBookingCivilId(
    String(formData.get("lookup_civil_id") ?? ""),
  );
  const password = createGeneratedAttendeePassword();

  assertAttendeeInput({
    civilId,
    email,
    fullName,
    phone,
  });

  return {
    full_name: fullName,
    email,
    phone,
    civil_id: civilId,
    password,
    confirm_password: password,
    timezone:
      normalizeBookingText(formData.get("new_customer_timezone")) ||
      "Asia/Kuwait",
  };
}

function useBookingCustomerLookup() {
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookupCivilId, setLookupCivilId] = useState("");
  const [lookupCustomer, setLookupCustomer] = useState<CustomerProfile | null>(
    null,
  );
  const [customerDraft, setCustomerDraft] = useState<CustomerDraft>({
    civilId: "",
    email: "",
    fullName: "",
    phone: "",
    timezone: "Asia/Kuwait",
  });
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>({
    tone: "idle",
    message: "Enter phone or Civil ID to find an attendee.",
  });
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

  const selectCustomer = useCallback((customer: CustomerProfile) => {
    setLookupCustomer(customer);
    setLookupPhone(bookingPhoneLocalValue(customer.phone));
    setLookupCivilId(customer.civil_id);
    setCustomerDraft({
      civilId: customer.civil_id,
      email: customer.email,
      fullName: customer.full_name,
      phone: customer.phone,
      timezone: customer.timezone ?? "Asia/Kuwait",
    });
  }, []);

  const updateLookupPhone = (value: string) => {
    const localPhone = bookingPhoneLocalValue(value);

    setLookupPhone(localPhone);
    setCustomerDraft((current) => ({
      ...current,
      phone: normalizeBookingPhone(localPhone),
    }));
  };

  const updateLookupCivilId = (value: string) => {
    setLookupCivilId(value);
    setCustomerDraft((current) => ({
      ...current,
      civilId: normalizeBookingCivilId(value),
    }));
  };

  const updateCustomerDraft = (field: keyof CustomerDraft, value: string) => {
    setCustomerDraft((current) => ({ ...current, [field]: value }));
  };

  const resolveAttendee = async (
    form: HTMLFormElement,
  ): Promise<CustomerProfile> => {
    if (lookupCustomer) {
      return lookupCustomer;
    }

    setIsCreatingCustomer(true);
    try {
      const createdCustomer = await adminCustomersClient.create(
        buildManualAttendeePayload(new FormData(form)),
      );

      selectCustomer(createdCustomer);
      setLookupStatus({
        tone: "success",
        message: `${createdCustomer.full_name} was added and selected.`,
      });
      window.dispatchEvent(new CustomEvent("lafam:users:changed"));
      return createdCustomer;
    } catch (requestError: unknown) {
      setLookupStatus({
        tone: "error",
        message: getErrorMessage(requestError),
      });
      throw requestError;
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  useEffect(() => {
    const phone = normalizeBookingPhone(lookupPhone);
    const civilId = normalizeBookingCivilId(lookupCivilId);
    const civilDigits = civilId.replace(/\D/g, "");
    const canLookupByPhone = isValidKuwaitBookingPhone(phone);
    const canLookupByCivilId = civilDigits.length === 12;

    if (!canLookupByPhone && !canLookupByCivilId) {
      const reset = window.setTimeout(() => {
        setLookupCustomer(null);
        setLookupStatus({
          tone: civilDigits.length > 0 ? "warning" : "idle",
          message:
            civilDigits.length > 0
              ? "Invalid Civil ID."
              : "Enter phone or Civil ID to find an attendee.",
        });
      }, 0);

      return () => window.clearTimeout(reset);
    }

    const controller = new AbortController();
    const request = window.setTimeout(() => {
      setLookupStatus({ tone: "loading", message: "Looking up attendee..." });
      void adminCustomersClient
        .lookup(
          {
            ...(canLookupByPhone ? { phone } : {}),
            ...(canLookupByCivilId ? { civil_id: civilId } : {}),
          },
          controller.signal,
        )
        .then((result) => {
          if (!result.customer) {
            setLookupCustomer(null);
            setCustomerDraft((current) => ({
              ...current,
              civilId,
              email: "",
              fullName: "",
              phone,
            }));
            setLookupStatus({
              tone: "warning",
              message:
                "No attendee matched those details. Complete the form, then add the attendee.",
            });
            return;
          }

          selectCustomer(result.customer);
          setLookupStatus({
            tone: "success",
            message: `${result.customer.full_name} found and selected.`,
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
  }, [lookupCivilId, lookupPhone, selectCustomer]);

  return {
    customerDraft,
    isCreatingCustomer,
    lookupCivilId,
    lookupCustomer,
    lookupPhone,
    lookupStatus,
    resolveAttendee,
    updateCustomerDraft,
    updateLookupCivilId,
    updateLookupPhone,
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
  areSchedulesLoading,
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

function BookingCustomerLookupPanel({
  customerLookup,
}: {
  customerLookup: ReturnType<typeof useBookingCustomerLookup>;
}) {
  const {
    customerDraft,
    lookupStatus,
    updateCustomerDraft,
    updateLookupCivilId,
    updateLookupPhone,
  } = customerLookup;
  const lookupStatusClass =
    lookupStatus.tone === "success"
      ? "border-success/30 bg-success/10 text-success"
      : lookupStatus.tone === "error"
        ? "border-error/30 bg-error/10 text-error"
        : lookupStatus.tone === "warning"
          ? "border-warning/30 bg-warning/10 text-warning"
          : "border-background-secondary bg-card-bg-secondary text-txt-secondary";

  return (
    <section className="overflow-hidden rounded-sm border border-background-secondary bg-card-bg-primary">
      <header className="border-b border-background-secondary px-4 py-3">
        <h3 className="text-sm font-bold">Customer Details</h3>
      </header>
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <FormField
          label="Customer Mobile Number"
          name="lookup_phone"
          onChange={updateLookupPhone}
          placeholder="00000000"
          required
          prefix={KUWAIT_PHONE_CODE}
          type="text"
          value={customerLookup.lookupPhone}
        />
        <FormField
          label="Customer CIVIL ID"
          name="lookup_civil_id"
          onChange={updateLookupCivilId}
          placeholder="2990-1011-2345"
          required
          type="text"
          value={customerLookup.lookupCivilId}
        />
        <FormField
          label="Customer Name"
          name="new_customer_full_name"
          onChange={(value) => updateCustomerDraft("fullName", value)}
          placeholder="Name"
          required
          value={customerDraft.fullName}
        />
        <FormField
          label="Customer Email"
          name="new_customer_email"
          onChange={(value) => updateCustomerDraft("email", value)}
          placeholder="Email"
          required
          type="text"
          value={customerDraft.email}
        />
        <input
          name="new_customer_timezone"
          type="hidden"
          value={customerDraft.timezone}
        />
      </div>
      {lookupStatus.tone !== "idle" ? (
        <p
          aria-live="polite"
          className={`mx-4 mb-4 rounded-sm border px-4 py-3 text-sm font-semibold ${lookupStatusClass}`}
          role={lookupStatus.tone === "error" ? "alert" : "status"}
        >
          {lookupStatus.message}
        </p>
      ) : null}
    </section>
  );
}

function SelectedScheduleTags({
  onRemove,
  schedules,
}: {
  onRemove: (scheduleId: string) => void;
  schedules: PilatesSchedule[];
}) {
  if (schedules.length === 0) {
    return <span className="min-w-0 flex-1" aria-hidden="true" />;
  }

  return (
    <span className="flex min-w-0 flex-1 flex-nowrap gap-2 overflow-hidden">
      {schedules.map((schedule) => (
        <span
          className="inline-flex max-w-full shrink-0 items-center gap-2 rounded-sm border border-background-secondary bg-card-bg-secondary px-2 py-1 text-xs font-semibold text-txt-primary"
          key={schedule.id}
        >
          <span className="truncate">
            {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
          </span>
          <button
            aria-label={`Remove ${formatTime(schedule.start_time)} session`}
            className="text-txt-secondary transition hover:text-error"
            onClick={() => onRemove(schedule.id)}
            type="button"
          >
            X
          </button>
        </span>
      ))}
    </span>
  );
}

function CreatePrivateBookingCard({
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
  prefix,
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
  prefix?: string;
  required?: boolean;
  step?: string;
  type?: "date" | "number" | "text" | "time";
  value?: string;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-bold">
      {label}
      {prefix ? (
        <span className="flex min-h-12 overflow-hidden rounded-sm border border-background-secondary bg-card-bg-primary text-base text-txt-primary transition focus-within:border-primary">
          <span className="flex items-center border-r border-background-secondary px-4 font-semibold text-txt-secondary">
            {prefix}
          </span>
          <input
            className="min-w-0 flex-1 bg-transparent px-4 text-base text-txt-primary outline-none placeholder:text-txt-secondary disabled:opacity-60"
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
        </span>
      ) : (
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
      )}
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
