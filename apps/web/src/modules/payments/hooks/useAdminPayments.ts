"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminPaymentsClient,
  type AdminPaymentFilters,
  type AdminPaymentTransactionFilters,
  type PaymentSummary,
  type PaymentTransactionSummary,
} from "@/modules/payments";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The payment request failed.";
}

export function useAdminPayments(filters: AdminPaymentFilters) {
  const [payments, setPayments] = useState<PaymentSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPayments = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await adminPaymentsClient.list(filters);
      setPayments(result.items);
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
      void loadPayments().catch(() => undefined);
    }, 200);

    return () => window.clearTimeout(load);
  }, [loadPayments]);

  return {
    error,
    isLoading,
    loadPayments,
    payments,
    total,
  };
}

export function useAdminPaymentTransactions(
  paymentId: string,
  filters: AdminPaymentTransactionFilters,
  enabled = true,
) {
  const [transactions, setTransactions] = useState<
    PaymentTransactionSummary[]
  >([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const loadTransactions = useCallback(async () => {
    if (!enabled || !paymentId) {
      setTransactions([]);
      setTotal(0);
      setIsLoading(false);
      return {
        has_more: false,
        items: [],
        limit: filters.limit,
        offset: filters.offset,
        total: 0,
      };
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await adminPaymentsClient.listTransactions(
        paymentId,
        filters,
      );
      setTransactions(result.items);
      setTotal(result.total);
      return result;
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
      throw requestError;
    } finally {
      setIsLoading(false);
    }
  }, [enabled, filters, paymentId]);

  useEffect(() => {
    const load = window.setTimeout(() => {
      void loadTransactions().catch(() => undefined);
    }, 200);

    return () => window.clearTimeout(load);
  }, [loadTransactions]);

  return {
    error,
    isLoading,
    loadTransactions,
    total,
    transactions,
  };
}
