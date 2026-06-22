"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminBookingsClient,
  type AdminBookingCalendarEvent,
  type AdminBookingCalendarFilters,
  type CreatePrivateTrainerBookingPayload,
} from "@/lib/admin/admin-bookings";

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The booking calendar request failed.";
}

export function useAdminBookingCalendar(filters: AdminBookingCalendarFilters) {
  const [events, setEvents] = useState<AdminBookingCalendarEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCalendar = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await adminBookingsClient.calendar(filters);
      setEvents(result.events);
      setTotal(result.total);
      return result;
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
      throw requestError;
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const load = window.setTimeout(() => {
      void loadCalendar().catch(() => undefined);
    }, 200);

    return () => window.clearTimeout(load);
  }, [loadCalendar]);

  const createPrivateTrainerBooking = useCallback(
    async (payload: CreatePrivateTrainerBookingPayload) => {
      setIsCreating(true);
      setError(null);

      try {
        const result = await adminBookingsClient.createPrivateTrainer(payload);
        await loadCalendar();
        return result;
      } catch (requestError: unknown) {
        setError(getErrorMessage(requestError));
        throw requestError;
      } finally {
        setIsCreating(false);
      }
    },
    [loadCalendar],
  );

  return {
    createPrivateTrainerBooking,
    error,
    events,
    isCreating,
    isLoading,
    loadCalendar,
    total,
  };
}
