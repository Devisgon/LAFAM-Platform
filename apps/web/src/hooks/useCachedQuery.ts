"use client";

import { useQuery } from "@tanstack/react-query";
import { getSafeErrorMessage } from "@/lib/error/handleError";

type CachedQueryOptions<TData> = {
  enabled?: boolean;
  initialData: TData;
  key: string;
  queryFn: () => Promise<TData>;
};

export function useCachedQuery<TData>({
  enabled = true,
  initialData,
  key,
  queryFn,
}: CachedQueryOptions<TData>) {
  const query = useQuery({
    enabled,
    queryFn,
    queryKey: [key],
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
