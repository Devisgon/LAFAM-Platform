"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminBookingsClient,
  type AdminBooking,
  type AdminBookingFilters,
  type AdminPrivateBookingFilters,
  type AdminWaitlistEntry,
  type PrivateTrainerBooking,
} from "@/modules/bookings";

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The bookings request failed.";
}

export function useAdminBookings(filters: AdminBookingFilters, enabled = true) {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    if (!enabled) {
      setIsLoading(false);
      return {
        bookings: [],
        limit: filters.limit,
        offset: filters.offset,
        total: 0,
      };
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await adminBookingsClient.list(filters);
      setBookings(result.bookings);
      setTotal(result.total);
      return result;
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
      throw requestError;
    } finally {
      setIsLoading(false);
    }
  }, [enabled, filters]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const load = window.setTimeout(() => {
      void loadBookings().catch(() => undefined);
    }, 200);

    return () => window.clearTimeout(load);
  }, [enabled, loadBookings]);

  return {
    bookings,
    error,
    isLoading,
    loadBookings,
    total,
  };
}

export function useAdminPrivateBookings(
  filters: AdminPrivateBookingFilters,
  enabled = true,
) {
  const [bookings, setBookings] = useState<PrivateTrainerBooking[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    if (!enabled) {
      setIsLoading(false);
      return {
        limit: filters.limit,
        offset: filters.offset,
        private_bookings: [],
        total: 0,
      };
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await adminBookingsClient.listPrivateTrainer(filters);
      setBookings(result.private_bookings);
      setTotal(result.total);
      return result;
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
      throw requestError;
    } finally {
      setIsLoading(false);
    }
  }, [enabled, filters]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const load = window.setTimeout(() => {
      void loadBookings().catch(() => undefined);
    }, 200);

    return () => window.clearTimeout(load);
  }, [enabled, loadBookings]);

  return {
    bookings,
    error,
    isLoading,
    loadBookings,
    total,
  };
}

export function useAdminScheduleWaitlist(
  scheduleId: string | null,
  enabled = true,
) {
  const [waitlist, setWaitlist] = useState<AdminWaitlistEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(enabled && Boolean(scheduleId));
  const [error, setError] = useState<string | null>(null);

  const loadWaitlist = useCallback(async () => {
    if (!enabled || !scheduleId) {
      setWaitlist([]);
      setTotal(0);
      setIsLoading(false);
      return { waitlist: [], limit: 0, offset: 0, total: 0 };
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await adminBookingsClient.listScheduleWaitlist(scheduleId);
      setWaitlist(result.waitlist);
      setTotal(result.total);
      return result;
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
      throw requestError;
    } finally {
      setIsLoading(false);
    }
  }, [enabled, scheduleId]);

  useEffect(() => {
    if (!enabled || !scheduleId) {
      const clear = window.setTimeout(() => {
        setWaitlist([]);
        setTotal(0);
        setIsLoading(false);
      }, 0);

      return () => window.clearTimeout(clear);
    }

    const load = window.setTimeout(() => {
      void loadWaitlist().catch(() => undefined);
    }, 200);

    return () => window.clearTimeout(load);
  }, [enabled, loadWaitlist, scheduleId]);

  return {
    error,
    isLoading,
    loadWaitlist,
    total,
    waitlist,
  };
}
