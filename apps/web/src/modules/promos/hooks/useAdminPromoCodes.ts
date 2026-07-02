"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminPromoCodesClient,
  type PromoCode,
  type PromoCodeFilters,
  type UpdatePromoCodePayload,
} from "../api/promoCodesApi";

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The promo-code request failed.";
}

export function useAdminPromoCodes(filters: PromoCodeFilters) {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reconcile = useCallback((updatedPromoCode: PromoCode) => {
    setPromoCodes((current) =>
      current.map((promoCode) =>
        promoCode.id === updatedPromoCode.id ? updatedPromoCode : promoCode,
      ),
    );
  }, []);

  const loadPromoCodes = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await adminPromoCodesClient.list(filters);
      setPromoCodes(result.promo_codes);
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
      void loadPromoCodes().catch(() => undefined);
    }, 200);

    return () => window.clearTimeout(load);
  }, [loadPromoCodes]);

  const activatePromoCode = useCallback(
    async (promoCodeId: string) => {
      setIsMutating(true);
      setError(null);

      try {
        const updated = await adminPromoCodesClient.activate(promoCodeId);
        reconcile(updated);
        return updated;
      } catch (requestError: unknown) {
        setError(getErrorMessage(requestError));
        throw requestError;
      } finally {
        setIsMutating(false);
      }
    },
    [reconcile],
  );

  const pausePromoCode = useCallback(
    async (promoCodeId: string) => {
      setIsMutating(true);
      setError(null);

      try {
        const updated = await adminPromoCodesClient.pause(promoCodeId);
        reconcile(updated);
        return updated;
      } catch (requestError: unknown) {
        setError(getErrorMessage(requestError));
        throw requestError;
      } finally {
        setIsMutating(false);
      }
    },
    [reconcile],
  );

  const updatePromoCode = useCallback(
    async (promoCodeId: string, payload: UpdatePromoCodePayload) => {
      setIsMutating(true);
      setError(null);

      try {
        const updated = await adminPromoCodesClient.update(
          promoCodeId,
          payload,
        );
        reconcile(updated);
        return updated;
      } catch (requestError: unknown) {
        setError(getErrorMessage(requestError));
        throw requestError;
      } finally {
        setIsMutating(false);
      }
    },
    [reconcile],
  );

  const deletePromoCode = useCallback(async (promoCodeId: string) => {
    setIsMutating(true);
    setError(null);

    try {
      await adminPromoCodesClient.delete(promoCodeId);
      setPromoCodes((current) =>
        current.filter((promoCode) => promoCode.id !== promoCodeId),
      );
      setTotal((current) => Math.max(0, current - 1));
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
      throw requestError;
    } finally {
      setIsMutating(false);
    }
  }, []);

  return {
    activatePromoCode,
    deletePromoCode,
    error,
    isLoading,
    isMutating,
    loadPromoCodes,
    pausePromoCode,
    promoCodes,
    total,
    updatePromoCode,
  };
}
