"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  userWalletClient,
  type UserWallet,
  type UserWalletTransaction,
  type UserWalletTransactionFilters,
} from "@/lib/user/wallet";

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "The wallet request failed.";

export function useWallet(filters: UserWalletTransactionFilters) {
  const [wallet, setWallet] = useState<UserWallet | null>(null);
  const [transactions, setTransactions] = useState<UserWalletTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    let didTimeout = false;
    const timeout = window.setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, 10_000);
    setIsLoading(true);
    setError(null);

    try {
      const [walletResult, transactionResult] = await Promise.all([
        userWalletClient.get(controller.signal),
        userWalletClient.listTransactions(filters, controller.signal),
      ]);
      setWallet(walletResult);
      setTransactions(transactionResult.items);
      setTotal(transactionResult.total);
    } catch (requestError: unknown) {
      if (!controller.signal.aborted || didTimeout) {
        setError(
          didTimeout
            ? "The wallet request timed out. Please try again."
            : errorMessage(requestError),
        );
      }
    } finally {
      window.clearTimeout(timeout);
      if (controllerRef.current === controller) setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const request = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(request);
      controllerRef.current?.abort();
    };
  }, [load]);

  const getTransaction = useCallback(async (id: string) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    try {
      return await userWalletClient.getTransaction(id, controller.signal);
    } finally {
      window.clearTimeout(timeout);
    }
  }, []);

  return { error, getTransaction, isLoading, load, total, transactions, wallet };
}
