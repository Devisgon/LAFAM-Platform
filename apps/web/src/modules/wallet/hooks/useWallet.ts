"use client";

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CACHE_KEYS } from "@/lib/cache/cacheKeys";
import { getSafeErrorMessage } from "@/lib/error/handleError";
import {
  userWalletClient,
  type UserWalletTransactionFilters,
  type WalletTopUpPayload,
} from "../api/userWalletApi";

export function useWalletTopUp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: WalletTopUpPayload) =>
      userWalletClient.createTopUp(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CACHE_KEYS.wallet.all });
    },
  });
}

export function useWallet(filters: UserWalletTransactionFilters) {
  const queryClient = useQueryClient();
  const walletQuery = useQuery({
    queryFn: ({ signal }) => userWalletClient.get(signal),
    queryKey: CACHE_KEYS.wallet.userWallet,
  });
  const transactionsQuery = useQuery({
    queryFn: ({ signal }) => userWalletClient.listTransactions(filters, signal),
    queryKey: [...CACHE_KEYS.wallet.transactions, filters],
  });
  const getTransaction = useCallback(
    (id: string) =>
      queryClient.fetchQuery({
        queryFn: ({ signal }) => userWalletClient.getTransaction(id, signal),
        queryKey: [...CACHE_KEYS.wallet.transaction, id],
      }),
    [queryClient],
  );
  const load = useCallback(async () => {
    await Promise.all([walletQuery.refetch(), transactionsQuery.refetch()]);
  }, [transactionsQuery, walletQuery]);
  const error = walletQuery.error ?? transactionsQuery.error;

  return {
    error: error ? getSafeErrorMessage(error) : null,
    getTransaction,
    isLoading: walletQuery.isPending || transactionsQuery.isPending,
    load,
    total: transactionsQuery.data?.total ?? 0,
    transactions: transactionsQuery.data?.items ?? [],
    wallet: walletQuery.data ?? null,
  };
}
