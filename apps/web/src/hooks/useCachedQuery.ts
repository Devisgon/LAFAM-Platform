"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type CacheEntry<TData> = {
  data: TData;
};

type CachedQueryOptions<TData> = {
  enabled?: boolean;
  initialData: TData;
  key: string;
  queryFn: () => Promise<TData>;
};

const queryCache = new Map<string, CacheEntry<unknown>>();

function getCachedEntry<TData>(key: string): CacheEntry<TData> | null {
  return (queryCache.get(key) as CacheEntry<TData> | undefined) ?? null;
}

export function useCachedQuery<TData>({
  enabled = true,
  initialData,
  key,
  queryFn,
}: CachedQueryOptions<TData>) {
  const initialCache = enabled ? getCachedEntry<TData>(key) : null;
  const [data, setData] = useState<TData>(initialCache?.data ?? initialData);
  const [cachedData, setCachedData] = useState<TData | null>(
    initialCache?.data ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(
    enabled && !initialCache,
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const requestIdRef = useRef(0);

  const refetch = useCallback(async () => {
    if (!enabled) {
      setData(initialData);
      setCachedData(null);
      setIsInitialLoading(false);
      setIsRefreshing(false);
      return initialData;
    }

    const cached = getCachedEntry<TData>(key);
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (cached) {
      setData(cached.data);
      setCachedData(cached.data);
    }

    setError(null);
    setIsInitialLoading(!cached);
    setIsRefreshing(Boolean(cached));

    try {
      const freshData = await queryFn();

      if (requestIdRef.current === requestId) {
        queryCache.set(key, { data: freshData });
        setData(freshData);
        setCachedData(freshData);
      }

      return freshData;
    } catch (requestError: unknown) {
      const message =
        requestError instanceof Error ? requestError.message : "Request failed.";

      if (requestIdRef.current === requestId) {
        setError(message);
      }

      throw requestError;
    } finally {
      if (requestIdRef.current === requestId) {
        setIsInitialLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [enabled, initialData, key, queryFn]);

  useEffect(() => {
    const load = Promise.resolve().then(refetch);

    void load.catch(() => undefined);
  }, [refetch]);

  return {
    cachedData,
    data,
    error,
    isInitialLoading,
    isLoading: isInitialLoading,
    isRefreshing,
    refetch,
  };
}
