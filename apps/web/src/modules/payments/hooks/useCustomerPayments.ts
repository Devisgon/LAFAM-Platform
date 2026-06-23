"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CACHE_KEYS } from "@/lib/cache/cacheKeys";
import { getSafeErrorMessage } from "@/lib/error/handleError";
import {
  customerPaymentsClient,
  type CustomerCheckoutPaymentPayload,
  type CustomerPaymentFilters,
  type CustomerPaymentListResult,
  type CustomerPaymentTransactionFilters,
  type CustomerPaymentTransactionListResult,
} from "../api/paymentsApi";

const EMPTY_PAYMENTS_RESULT: CustomerPaymentListResult = {
  has_more: false,
  items: [],
  limit: 20,
  offset: 0,
  total: 0,
};

const EMPTY_TRANSACTIONS_RESULT: CustomerPaymentTransactionListResult = {
  has_more: false,
  items: [],
  limit: 20,
  offset: 0,
  total: 0,
};

export function useCustomerPayments(filters: CustomerPaymentFilters) {
  const query = useQuery({
    queryFn: () => customerPaymentsClient.list(filters),
    queryKey: [...CACHE_KEYS.payments.user, filters],
  });
  const result = query.data ?? EMPTY_PAYMENTS_RESULT;

  return {
    error: query.error ? getSafeErrorMessage(query.error) : null,
    isLoading: query.isPending,
    load: async () => (await query.refetch()).data ?? null,
    payments: result.items,
    total: result.total,
  };
}

export function useCustomerPaymentDetail(paymentId: string | null) {
  const query = useQuery({
    enabled: Boolean(paymentId),
    queryFn: () => customerPaymentsClient.get(paymentId ?? ""),
    queryKey: [...CACHE_KEYS.payments.detail, paymentId],
  });

  return {
    error: query.error ? getSafeErrorMessage(query.error) : null,
    isLoading: query.isPending && Boolean(paymentId),
    payment: query.data ?? null,
    reload: async () => (await query.refetch()).data ?? null,
  };
}

export function useCustomerPaymentTransactions(
  paymentId: string | null,
  filters: CustomerPaymentTransactionFilters,
) {
  const query = useQuery({
    enabled: Boolean(paymentId),
    queryFn: () => customerPaymentsClient.listTransactions(paymentId ?? "", filters),
    queryKey: [...CACHE_KEYS.payments.transactions, paymentId, filters],
  });
  const result = query.data ?? EMPTY_TRANSACTIONS_RESULT;

  return {
    error: query.error ? getSafeErrorMessage(query.error) : null,
    isLoading: query.isPending && Boolean(paymentId),
    load: async () => (await query.refetch()).data ?? null,
    total: result.total,
    transactions: result.items,
  };
}

export function useCustomerCheckoutPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CustomerCheckoutPaymentPayload) =>
      customerPaymentsClient.checkout(payload),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CACHE_KEYS.bookings.user }),
        result.payment.booking_id
          ? queryClient.invalidateQueries({
              queryKey: [...CACHE_KEYS.bookings.detail, result.payment.booking_id],
            })
          : Promise.resolve(),
      ]);
    },
  });
}

export function useCustomerVerifyPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (paymentId: string) => customerPaymentsClient.verify(paymentId),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CACHE_KEYS.bookings.user }),
        result.payment.booking_id
          ? queryClient.invalidateQueries({
              queryKey: [...CACHE_KEYS.bookings.detail, result.payment.booking_id],
            })
          : Promise.resolve(),
      ]);
    },
  });
}
