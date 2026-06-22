"use client";

import { useQuery } from "@tanstack/react-query";
import { CACHE_KEYS } from "@/lib/cache/cacheKeys";
import { getSafeErrorMessage } from "@/lib/error/handleError";
import {
  publicClassesClient,
  type PublicClassFilters,
  type PublicClassList,
} from "../api/classesApi";

const EMPTY_RESULT: PublicClassList = {
  items: [],
  total: 0,
  limit: 100,
  offset: 0,
  has_more: false,
};

export function useClasses(filters: PublicClassFilters, initialResult?: PublicClassList) {
  const query = useQuery({
    initialData: initialResult,
    queryFn: ({ signal }) => publicClassesClient.list(filters, signal),
    queryKey: [...CACHE_KEYS.pilates.publicClasses, filters],
  });
  const result = query.data ?? EMPTY_RESULT;

  return {
    ...result,
    error: query.error ? getSafeErrorMessage(query.error) : null,
    isLoading: query.isPending,
    load: async () => (await query.refetch()).data ?? null,
  };
}
