import { AdminBookingManager, UserBookings } from "@/modules/bookings";
import { getServerSession, isAdminRole } from "@/lib/auth/session";
import type {
  UserBookingFilters,
  UserPrivateBookingFilters,
  UserPrivateBookingSortField,
  UserBookingSortDirection,
  UserBookingSortField,
  UserBookingStatus,
} from "@/modules/bookings";

type SearchParams = Record<string, string | string[] | undefined>;

const BOOKING_STATUSES: UserBookingStatus[] = [
  "pending_payment",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
  "expired",
  "rescheduled",
  "deleted",
];

const BOOKING_SORT_FIELDS: UserBookingSortField[] = [
  "created_at",
  "schedule_date",
  "start_time",
  "status",
];

const BOOKING_SORT_DIRECTIONS: UserBookingSortDirection[] = ["asc", "desc"];
const PRIVATE_BOOKING_SORT_FIELDS: UserPrivateBookingSortField[] = [
  "created_at",
  "session_date",
  "start_time",
  "status",
];

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function resolveFilters(searchParams: SearchParams): UserBookingFilters {
  const limit = Number(firstParam(searchParams.limit));
  const offset = Number(firstParam(searchParams.offset));
  const sortBy = firstParam(searchParams.sort_by);
  const sortDirection = firstParam(searchParams.sort_direction);
  const status = firstParam(searchParams.status);

  return {
    status: BOOKING_STATUSES.includes(status as UserBookingStatus)
      ? (status as UserBookingStatus)
      : undefined,
    from_date: firstParam(searchParams.from_date),
    limit: Number.isInteger(limit) && limit > 0 ? limit : 20,
    offset: Number.isInteger(offset) && offset >= 0 ? offset : 0,
    sort_by: BOOKING_SORT_FIELDS.includes(sortBy as UserBookingSortField)
      ? (sortBy as UserBookingSortField)
      : "created_at",
    sort_direction: BOOKING_SORT_DIRECTIONS.includes(
      sortDirection as UserBookingSortDirection,
    )
      ? (sortDirection as UserBookingSortDirection)
      : "desc",
    to_date: firstParam(searchParams.to_date),
  };
}

function resolvePrivateFilters(searchParams: SearchParams): UserPrivateBookingFilters {
  const limit = Number(firstParam(searchParams.limit));
  const offset = Number(firstParam(searchParams.offset));
  const sortBy = firstParam(searchParams.sort_by);
  const sortDirection = firstParam(searchParams.sort_direction);
  const status = firstParam(searchParams.status);
  const privateSortBy =
    sortBy === "schedule_date" ? "session_date" : sortBy;

  return {
    status: BOOKING_STATUSES.includes(status as UserBookingStatus)
      ? (status as UserBookingStatus)
      : undefined,
    trainer_staff_profile_id: firstParam(searchParams.trainer_staff_profile_id),
    from_date: firstParam(searchParams.from_date),
    limit: Number.isInteger(limit) && limit > 0 ? limit : 20,
    offset: Number.isInteger(offset) && offset >= 0 ? offset : 0,
    sort_by: PRIVATE_BOOKING_SORT_FIELDS.includes(
      privateSortBy as UserPrivateBookingSortField,
    )
      ? (privateSortBy as UserPrivateBookingSortField)
      : "created_at",
    sort_direction: BOOKING_SORT_DIRECTIONS.includes(
      sortDirection as UserBookingSortDirection,
    )
      ? (sortDirection as UserBookingSortDirection)
      : "desc",
    to_date: firstParam(searchParams.to_date),
  };
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getServerSession();
  if (isAdminRole(session?.role)) return <AdminBookingManager />;
  const params = await searchParams;
  const filters = resolveFilters(params);
  const privateFilters = resolvePrivateFilters(params);

  return <UserBookings filters={filters} privateFilters={privateFilters} />;
}
