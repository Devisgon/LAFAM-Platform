"use client";

import { useQuery } from "@tanstack/react-query";
import { CACHE_KEYS } from "@/lib/cache/cacheKeys";
import { getSafeErrorMessage } from "@/lib/error/handleError";
import {
  publicSchedulesClient,
  type PublicScheduleFilters,
  type PublicScheduleList,
} from "../api/schedulesApi";

const EMPTY_RESULT: PublicScheduleList = {
  items: [],
  total: 0,
  limit: 100,
  offset: 0,
  has_more: false,
};

export function useSchedules(
  filters: PublicScheduleFilters,
  initialResult?: PublicScheduleList,
) {
  const query = useQuery({
    initialData: initialResult,
    queryFn: ({ signal }) => publicSchedulesClient.list(filters, signal),
    queryKey: [...CACHE_KEYS.pilates.publicSchedules, filters],
  });
  const result = query.data ?? EMPTY_RESULT;

  return {
    ...result,
    error: query.error ? getSafeErrorMessage(query.error) : null,
    isLoading: query.isPending,
    load: async () => (await query.refetch()).data ?? null,
  };
}
