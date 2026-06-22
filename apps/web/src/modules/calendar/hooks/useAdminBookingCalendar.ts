"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CACHE_KEYS } from "@/lib/cache/cacheKeys";
import { getSafeErrorMessage } from "@/lib/error/handleError";
import type {
  AdminBookingCalendarFilters,
  CreatePrivateTrainerBookingPayload,
} from "@/modules/bookings";
import { calendarApi } from "../api/calendarApi";

export function useAdminBookingCalendar(filters: AdminBookingCalendarFilters) {
  const queryClient = useQueryClient();
  const calendarQuery = useQuery({
    queryFn: () => calendarApi.list(filters),
    queryKey: [...CACHE_KEYS.calendar.all, filters],
  });
  const createMutation = useMutation({
    mutationFn: (payload: CreatePrivateTrainerBookingPayload) =>
      calendarApi.createPrivateTrainerBooking(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: CACHE_KEYS.calendar.all }),
  });
  const error = calendarQuery.error ?? createMutation.error;

  return {
    createPrivateTrainerBooking: createMutation.mutateAsync,
    error: error ? getSafeErrorMessage(error) : null,
    events: calendarQuery.data?.events ?? [],
    isCreating: createMutation.isPending,
    isLoading: calendarQuery.isPending,
    loadCalendar: async () => (await calendarQuery.refetch()).data,
    total: calendarQuery.data?.total ?? 0,
  };
}
