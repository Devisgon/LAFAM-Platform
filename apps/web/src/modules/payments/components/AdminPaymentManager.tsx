"use client";

import { useMemo } from "react";
import { useAdminBookings, useAdminPrivateBookings } from "@/modules/bookings";
import { useAdminUsers } from "@/modules/users";
import type { AdminBookingFilters, AdminPrivateBookingFilters } from "@/modules/bookings";
import type { AdminUserFilters } from "@/modules/users";

import { getBookingOptionLabel, getUserOptionLabel } from "../utils/paymentFormatters";
import { PaymentListPanel } from "./payment-management/PaymentListPanel";

export function AdminPaymentManager() {
  const userFilters = useMemo<AdminUserFilters>(() => ({}), []);
  const bookingFilters = useMemo<AdminBookingFilters>(
    () => ({
      limit: 100,
      offset: 0,
      sort_by: "created_at",
      sort_direction: "desc",
    }),
    [],
  );
  const privateBookingFilters = useMemo<AdminPrivateBookingFilters>(
    () => ({
      limit: 100,
      offset: 0,
      sort_by: "created_at",
      sort_direction: "desc",
    }),
    [],
  );
  const {
    users,
    error: usersError,
    isLoading: areUsersLoading,
  } = useAdminUsers(userFilters);
  const usersById = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users],
  );
  const userOptions = useMemo(
    () => users.map((user) => [user.id, getUserOptionLabel(user)] as const),
    [users],
  );
  const {
    bookings,
    error: bookingsError,
    isLoading: areBookingsLoading,
  } = useAdminBookings(bookingFilters);
  const {
    bookings: privateBookings,
    error: privateBookingsError,
    isLoading: arePrivateBookingsLoading,
  } = useAdminPrivateBookings(privateBookingFilters);
  const bookingOptions = useMemo(
    () =>
      bookings.map(
        (booking) => [booking.id, getBookingOptionLabel(booking)] as const,
      ),
    [bookings],
  );
  const privateBookingOptions = useMemo(
    () =>
      privateBookings.map(
        (booking) => [booking.id, getBookingOptionLabel(booking)] as const,
      ),
    [privateBookings],
  );

  return (
    <PaymentListPanel
      areBookingsLoading={areBookingsLoading}
      arePrivateBookingsLoading={arePrivateBookingsLoading}
      areUsersLoading={areUsersLoading}
      bookingOptions={bookingOptions}
      bookingsError={bookingsError}
      privateBookingOptions={privateBookingOptions}
      privateBookingsError={privateBookingsError}
      userOptions={userOptions}
      usersById={usersById}
      usersError={usersError}
    />
  );
}
