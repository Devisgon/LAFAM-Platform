"use client";

import { useMemo, useState } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { DataTable } from "@/components/data-display/DataTable";
import { LoadingState } from "@/components/data-display/LoadingState";
import { usePilates } from "@/modules/services/pilates";

import { adminBookingsClient } from "../../api/adminBookingsApi";
import type {
  AdminBookingFilters,
  AdminBookingStatus,
  AdminPrivateBookingFilters,
  AdminWaitlistEntry,
} from "../../api/adminBookingsApi";
import {
  bookingStatuses,
  fieldClass,
  pageSizeOptions,
  waitlistStatuses,
} from "../../constants/bookingUi.constants";
import {
  useAdminBookings,
  useAdminPrivateBookings,
  useAdminScheduleWaitlist,
} from "../../hooks/useAdminBookings";
import type { BookingMode, BookingPermission } from "../../types/bookingUi.types";
import {
  formatPrice,
  isPreviousBooking,
  isPreviousPrivateBooking,
  label,
  waitlistMatchesSearch,
  waitlistScheduleLabel,
} from "../../utils/bookingFormatters";
import { hasPermission } from "../../utils/bookingNormalizers";
import { BookingDetailPanel } from "./BookingDetailPanel";
import { DateField, FilterSelect } from "./BookingFormControls";
import {
  BookingRecordRow,
  PrivateBookingRecordRow,
  WaitlistRecordRow,
} from "./BookingTableRows";
import { PrivateBookingDetailPanel } from "./PrivateBookingDetailPanel";

export function BookingListPanel({
  permissions,
  previousOnly,
}: {
  permissions: readonly BookingPermission[];
  previousOnly: boolean;
}) {
  const [bookingMode, setBookingMode] = useState<BookingMode>("class");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [classId, setClassId] = useState("");
  const [trainerStaffProfileId, setTrainerStaffProfileId] = useState("");
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [pageSize, setPageSize] = useState(pageSizeOptions[0]);
  const [currentPage, setCurrentPage] = useState(1);
  const [removingWaitlistId, setRemovingWaitlistId] = useState<string | null>(
    null,
  );
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    null,
  );
  const [selectedPrivateBookingId, setSelectedPrivateBookingId] = useState<
    string | null
  >(null);
  const canManageWaitlist = hasPermission(
    permissions,
    "admin:bookings:waitlist",
  );
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
  const waitlistScheduleOptions = useMemo(
    () =>
      schedules
        .filter((schedule) => schedule.status === "scheduled")
        .filter((schedule) => (classId ? schedule.class_id === classId : true))
        .filter((schedule) =>
          trainerStaffProfileId
            ? schedule.trainer_staff_profile_id === trainerStaffProfileId
            : true,
        )
        .toSorted((first, second) =>
          `${first.class_date}T${first.start_time}`.localeCompare(
            `${second.class_date}T${second.start_time}`,
          ),
        )
        .map(
          (schedule) => [schedule.id, waitlistScheduleLabel(schedule)] as const,
        ),
    [classId, schedules, trainerStaffProfileId],
  );
  const resolvedWaitlistScheduleId = useMemo(() => {
    const hasSelectedSchedule = waitlistScheduleOptions.some(
      ([scheduleId]) => scheduleId === selectedScheduleId,
    );

    if (hasSelectedSchedule) return selectedScheduleId;

    return (
      waitlistScheduleOptions.find(([scheduleId]) =>
        schedules.some(
          (schedule) =>
            schedule.id === scheduleId &&
            schedule.availability.waitlist_count > 0,
        ),
      )?.[0] ??
      waitlistScheduleOptions[0]?.[0] ??
      ""
    );
  }, [schedules, selectedScheduleId, waitlistScheduleOptions]);

  const filters = useMemo<AdminBookingFilters>(
    () => ({
      limit: pageSize,
      offset: (currentPage - 1) * pageSize,
      sort_by: "created_at",
      sort_direction: "desc",
      ...(search.trim() ? { search } : {}),
      ...(status ? { status: status as AdminBookingStatus } : {}),
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
      ...(status ? { status: status as AdminBookingStatus } : {}),
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
  const waitlistState = useAdminScheduleWaitlist(
    resolvedWaitlistScheduleId || null,
    bookingMode === "waitlist",
  );
  const visibleBookings = previousOnly
    ? classBookingState.bookings.filter(isPreviousBooking)
    : classBookingState.bookings;
  const visiblePrivateBookings = previousOnly
    ? privateBookingState.bookings.filter(isPreviousPrivateBooking)
    : privateBookingState.bookings;
  const filteredWaitlistEntries = waitlistState.waitlist.filter(
    (entry) =>
      waitlistMatchesSearch(entry, search) &&
      (status ? entry.status === status : true) &&
      (classId ? entry.class_id === classId : true) &&
      (trainerStaffProfileId
        ? entry.trainer_staff_profile_id === trainerStaffProfileId
        : true) &&
      (fromDate ? (entry.schedule?.class_date ?? "") >= fromDate : true) &&
      (toDate ? (entry.schedule?.class_date ?? "") <= toDate : true),
  );
  const visibleWaitlistEntries = filteredWaitlistEntries.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const activeTotal =
    bookingMode === "class"
      ? classBookingState.total
      : bookingMode === "private"
        ? privateBookingState.total
        : filteredWaitlistEntries.length;
  const activeError =
    bookingMode === "class"
      ? classBookingState.error
      : bookingMode === "private"
        ? privateBookingState.error
        : waitlistState.error;
  const activeIsLoading =
    bookingMode === "class"
      ? classBookingState.isLoading
      : bookingMode === "private"
        ? privateBookingState.isLoading
        : waitlistState.isLoading;
  const activeLoadBookings =
    bookingMode === "class"
      ? classBookingState.loadBookings
      : bookingMode === "private"
        ? privateBookingState.loadBookings
        : waitlistState.loadWaitlist;
  const activeVisibleCount =
    bookingMode === "class"
      ? visibleBookings.length
      : bookingMode === "private"
        ? visiblePrivateBookings.length
        : visibleWaitlistEntries.length;
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
    setStatus("");
    setClassId("");
    setCurrentPage(1);
  };

  const removeWaitlistEntry = async (entry: AdminWaitlistEntry) => {
    if (
      !window.confirm(
        `Remove ${entry.customer?.full_name ?? "this customer"} from the waitlist?`,
      )
    ) {
      return;
    }

    setRemovingWaitlistId(entry.id);
    try {
      await adminBookingsClient.removeWaitlistEntry(entry.id);
      await waitlistState.loadWaitlist();
    } catch {
      await waitlistState.loadWaitlist().catch(() => undefined);
    } finally {
      setRemovingWaitlistId(null);
    }
  };

  if (selectedBookingId) {
    return (
      <BookingDetailPanel
        bookingId={selectedBookingId}
        onBack={() => setSelectedBookingId(null)}
        onChanged={() =>
          void classBookingState.loadBookings().catch(() => undefined)
        }
        permissions={permissions}
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
        permissions={permissions}
      />
    );
  }

  return (
    <>
      <div className="grid gap-4 border-b border-background-secondary px-5 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-h-12 overflow-hidden rounded-sm border border-background-secondary bg-card-bg-secondary p-1">
              {(["class", "private", "waitlist"] as const).map((mode) => (
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
                  {mode === "class"
                    ? "Class bookings"
                    : mode === "private"
                      ? "Private bookings"
                      : "Waitlist"}
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
                setStatus(value);
                resetToFirstPage();
              }}
              options={[
                [
                  "",
                  bookingMode === "waitlist"
                    ? "All waitlist states"
                    : "All statuses",
                ],
                ...(bookingMode === "waitlist"
                  ? waitlistStatuses.map((item) => [item, label(item)] as const)
                  : bookingStatuses.map(
                      (item) => [item, label(item)] as const,
                    )),
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

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {bookingMode !== "private" ? (
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
          {bookingMode === "waitlist" ? (
            <FilterSelect
              disabled={
                isPilatesLoading || waitlistScheduleOptions.length === 0
              }
              label="Schedule waitlist"
              onChange={(value) => {
                setSelectedScheduleId(value);
                resetToFirstPage();
              }}
              options={[
                [
                  "",
                  isPilatesLoading
                    ? "Loading schedules..."
                    : "Select schedule waitlist",
                ],
                ...waitlistScheduleOptions,
              ]}
              value={resolvedWaitlistScheduleId}
            />
          ) : null}
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
            columns={
              bookingMode === "waitlist"
                ? [
                    { key: "position", heading: "Position" },
                    { key: "customer", heading: "Customer" },
                    { key: "class", heading: "Class" },
                    { key: "trainer", heading: "Trainer" },
                    { key: "date", heading: "Date" },
                    { key: "status", heading: "Status" },
                    { key: "joined", heading: "Joined" },
                    { key: "promotion", heading: "Promotion" },
                    ...(canManageWaitlist
                      ? [{ key: "action", heading: "Action" }]
                      : []),
                  ]
                : [
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
                  ]
            }
            emptyMessage={
              bookingMode === "waitlist" && !resolvedWaitlistScheduleId
                ? "Select a schedule to view its waitlist."
                : bookingMode === "waitlist"
                  ? "No waitlist entries found."
                  : "No booking records found."
            }
            isEmpty={
              bookingMode === "class"
                ? visibleBookings.length === 0
                : bookingMode === "private"
                  ? visiblePrivateBookings.length === 0
                  : visibleWaitlistEntries.length === 0
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
              : bookingMode === "private"
                ? visiblePrivateBookings.map((booking) => (
                    <PrivateBookingRecordRow
                      booking={booking}
                      key={booking.id}
                      onView={() => setSelectedPrivateBookingId(booking.id)}
                    />
                  ))
                : visibleWaitlistEntries.map((entry) => (
                    <WaitlistRecordRow
                      entry={entry}
                      isRemoving={removingWaitlistId === entry.id}
                      key={entry.id}
                      canManage={canManageWaitlist}
                      onRemove={() => void removeWaitlistEntry(entry)}
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
