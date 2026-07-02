"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminPromoCodesClient,
  type PromoCode,
  type PromoCodeRedemption,
  type PromoCodeRedemptionFilters,
} from "../api/promoCodesApi";

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The promo-code detail request failed.";
}

export function useAdminPromoCodeDetail(
  promoCodeId: string,
  redemptionFilters: PromoCodeRedemptionFilters,
) {
  const [promoCode, setPromoCode] = useState<PromoCode | null>(null);
  const [redemptions, setRedemptions] = useState<PromoCodeRedemption[]>([]);
  const [totalRedemptions, setTotalRedemptions] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPromoCodeDetail = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [promoCodeResult, redemptionResult] = await Promise.all([
        adminPromoCodesClient.get(promoCodeId),
        adminPromoCodesClient.listRedemptions(promoCodeId, redemptionFilters),
      ]);

      setPromoCode(promoCodeResult);
      setRedemptions(redemptionResult.redemptions);
      setTotalRedemptions(redemptionResult.total);

      return {
        promoCode: promoCodeResult,
        redemptions: redemptionResult.redemptions,
        totalRedemptions: redemptionResult.total,
      };
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
      throw requestError;
    } finally {
      setIsLoading(false);
    }
  }, [promoCodeId, redemptionFilters]);

  useEffect(() => {
    const load = window.setTimeout(() => {
      void loadPromoCodeDetail().catch(() => undefined);
    }, 0);

    return () => window.clearTimeout(load);
  }, [loadPromoCodeDetail]);

  return {
    error,
    isLoading,
    loadPromoCodeDetail,
    promoCode,
    redemptions,
    totalRedemptions,
  };
}
