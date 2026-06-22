"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  publicClassesClient,
  type PublicClassFilters,
  type PublicClassList,
} from "@/lib/user/classes";

const EMPTY_RESULT: PublicClassList = {
  items: [],
  total: 0,
  limit: 100,
  offset: 0,
  has_more: false,
};

export function useClasses(
  filters: PublicClassFilters,
  initialResult?: PublicClassList,
) {
  const [result, setResult] = useState(initialResult ?? EMPTY_RESULT);
  const [isLoading, setIsLoading] = useState(!initialResult);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const hasInitialResult = useRef(Boolean(initialResult));

  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 10_000);

    setIsLoading(true);
    setError(null);
    try {
      const nextResult = await publicClassesClient.list(filters, controller.signal);
      setResult(nextResult);
      return nextResult;
    } catch (requestError: unknown) {
      if (controller.signal.aborted) {
        setError("The class request timed out. Please try again.");
      } else {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "The classes could not be loaded.",
        )
      }
      return null;
    } finally {
      window.clearTimeout(timeout);
      if (controllerRef.current === controller) setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (hasInitialResult.current) {
      hasInitialResult.current = false;
      return;
    }

    void load();
    return () => controllerRef.current?.abort();
  }, [load]);

  return { ...result, error, isLoading, load };
}
