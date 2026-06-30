"use client";

import { useQuery } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { getSafeErrorMessage } from "@/lib/error/handleError";

// Convenience wrapper only: React Query remains the single cache and invalidation source.
type CachedQueryOptions<TData> = {
  enabled?: boolean;
  initialData: TData;
  queryKey: QueryKey;
  queryFn: () => Promise<TData>;
};

export function useCachedQuery<TData>({
  enabled = true,
  initialData,
  queryKey,
  queryFn,
}: CachedQueryOptions<TData>) {
  const query = useQuery({
    enabled,
    queryFn,
    queryKey,
  });
  const data = query.data ?? initialData;
  const isInitialLoading = enabled && query.isPending;

  return {
    cachedData: query.data ?? null,
    data,
    error: query.error ? getSafeErrorMessage(query.error) : null,
    isInitialLoading,
    isLoading: isInitialLoading,
    isRefreshing: query.isFetching && !isInitialLoading,
    refetch: async () => (await query.refetch()).data ?? initialData,
  };
}
