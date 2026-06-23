"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CACHE_KEYS } from "@/lib/cache/cacheKeys";
import { getSafeErrorMessage } from "@/lib/error/handleError";
import {
  userBookingsClient,
  userPrivateBookingsClient,
  type CancelUserBookingPayload,
  type CreateUserPrivateBookingPayload,
  type CreateUserBookingPayload,
  type RescheduleUserPrivateBookingPayload,
  type RescheduleUserBookingPayload,
  type UserBookingFilters,
  type UserBookingListResult,
  type UserPrivateBookingFilters,
  type UserPrivateBookingListResult,
} from "../api/userBookingsApi";

const EMPTY_RESULT: UserBookingListResult = {
  bookings: [],
  limit: 20,
  offset: 0,
  total: 0,
};

const EMPTY_PRIVATE_RESULT: UserPrivateBookingListResult = {
  private_bookings: [],
  limit: 20,
  offset: 0,
  total: 0,
};

export function useUserBookings(filters: UserBookingFilters) {
  const query = useQuery({
    queryFn: () => userBookingsClient.list(filters),
    queryKey: [...CACHE_KEYS.bookings.user, filters],
  });
  const result = query.data ?? EMPTY_RESULT;

  return {
    ...result,
    error: query.error ? getSafeErrorMessage(query.error) : null,
    isLoading: query.isPending,
    load: async () => (await query.refetch()).data ?? null,
  };
}

export function useCreateUserBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateUserBookingPayload) =>
      userBookingsClient.create(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CACHE_KEYS.bookings.user }),
        queryClient.invalidateQueries({
          queryKey: CACHE_KEYS.pilates.publicSchedules,
        }),
      ]);
    },
  });
}

export function useUserBookingDetail(bookingId: string | null) {
  const query = useQuery({
    enabled: Boolean(bookingId),
    queryFn: () => userBookingsClient.get(bookingId ?? ""),
    queryKey: [...CACHE_KEYS.bookings.detail, bookingId],
  });

  return {
    booking: query.data ?? null,
    error: query.error ? getSafeErrorMessage(query.error) : null,
    isLoading: query.isPending && Boolean(bookingId),
  };
}

export function useUserPrivateBookings(filters: UserPrivateBookingFilters) {
  const query = useQuery({
    queryFn: () => userPrivateBookingsClient.list(filters),
    queryKey: [...CACHE_KEYS.bookings.userPrivate, filters],
  });
  const result = query.data ?? EMPTY_PRIVATE_RESULT;

  return {
    ...result,
    error: query.error ? getSafeErrorMessage(query.error) : null,
    isLoading: query.isPending,
    load: async () => (await query.refetch()).data ?? null,
  };
}

export function useUserPrivateBookingDetail(privateBookingId: string | null) {
  const query = useQuery({
    enabled: Boolean(privateBookingId),
    queryFn: () => userPrivateBookingsClient.get(privateBookingId ?? ""),
    queryKey: [...CACHE_KEYS.bookings.privateDetail, privateBookingId],
  });

  return {
    booking: query.data ?? null,
    error: query.error ? getSafeErrorMessage(query.error) : null,
    isLoading: query.isPending && Boolean(privateBookingId),
  };
}

export function useCreateUserPrivateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateUserPrivateBookingPayload) =>
      userPrivateBookingsClient.create(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: CACHE_KEYS.bookings.userPrivate,
        }),
        queryClient.invalidateQueries({ queryKey: CACHE_KEYS.payments.user }),
      ]);
    },
  });
}

export function useCancelUserBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      bookingId,
      payload,
    }: {
      bookingId: string;
      payload: CancelUserBookingPayload;
    }) => userBookingsClient.cancel(bookingId, payload),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CACHE_KEYS.bookings.user }),
        queryClient.invalidateQueries({
          queryKey: [...CACHE_KEYS.bookings.detail, variables.bookingId],
        }),
      ]);
    },
  });
}

export function useRescheduleUserBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      bookingId,
      payload,
    }: {
      bookingId: string;
      payload: RescheduleUserBookingPayload;
    }) => userBookingsClient.reschedule(bookingId, payload),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CACHE_KEYS.bookings.user }),
        queryClient.invalidateQueries({
          queryKey: [...CACHE_KEYS.bookings.detail, variables.bookingId],
        }),
      ]);
    },
  });
}

export function useCancelUserPrivateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      privateBookingId,
      payload,
    }: {
      privateBookingId: string;
      payload: CancelUserBookingPayload;
    }) => userPrivateBookingsClient.cancel(privateBookingId, payload),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: CACHE_KEYS.bookings.userPrivate,
        }),
        queryClient.invalidateQueries({
          queryKey: [
            ...CACHE_KEYS.bookings.privateDetail,
            variables.privateBookingId,
          ],
        }),
      ]);
    },
  });
}

export function useRescheduleUserPrivateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      privateBookingId,
      payload,
    }: {
      privateBookingId: string;
      payload: RescheduleUserPrivateBookingPayload;
    }) => userPrivateBookingsClient.reschedule(privateBookingId, payload),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: CACHE_KEYS.bookings.userPrivate,
        }),
        queryClient.invalidateQueries({
          queryKey: [
            ...CACHE_KEYS.bookings.privateDetail,
            variables.privateBookingId,
          ],
        }),
      ]);
    },
  });
}
