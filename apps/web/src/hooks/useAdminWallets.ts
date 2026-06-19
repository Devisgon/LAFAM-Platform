"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminWalletsClient,
  type AdminWalletFilters,
  type AdminWalletTransactionFilters,
  type WalletAccountSummary,
  type WalletLedgerEntrySummary,
} from "@/lib/admin-wallets";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The wallet request failed.";
}

export function useAdminWallets(filters: AdminWalletFilters) {
  const [wallets, setWallets] = useState<WalletAccountSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWallets = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await adminWalletsClient.list(filters);
      setWallets(result.items);
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
      void loadWallets().catch(() => undefined);
    }, 200);

    return () => window.clearTimeout(load);
  }, [loadWallets]);

  return {
    error,
    isLoading,
    loadWallets,
    total,
    wallets,
  };
}

export function useAdminWalletTransactions(
  userId: string,
  filters: AdminWalletTransactionFilters,
  enabled = true,
) {
  const [transactions, setTransactions] = useState<WalletLedgerEntrySummary[]>(
    [],
  );
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const loadTransactions = useCallback(async () => {
    if (!enabled || !userId) {
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
      const result = await adminWalletsClient.listTransactionsByUserId(
        userId,
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
  }, [enabled, filters, userId]);

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
