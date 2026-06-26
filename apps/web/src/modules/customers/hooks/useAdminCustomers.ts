"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminCustomersClient,
  type CreateCustomerPayload,
  type CustomerFilters,
  type CustomerProfile,
  type UpdateCustomerPayload,
} from "@/modules/customers";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The customer request failed.";
}

export function useAdminCustomers(filters: CustomerFilters) {
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reconcileCustomer = useCallback((updatedCustomer: CustomerProfile) => {
    setCustomers((current) =>
      current.map((customer) =>
        customer.id === updatedCustomer.id ? updatedCustomer : customer,
      ),
    );
  }, []);

  const loadCustomers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await adminCustomersClient.list(filters);
      setCustomers(result.customers);
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
      void loadCustomers().catch(() => undefined);
    }, 200);

    return () => window.clearTimeout(load);
  }, [loadCustomers]);

  const createCustomer = useCallback(async (payload: CreateCustomerPayload) => {
    setIsCreating(true);
    setError(null);

    try {
      const createdCustomer = await adminCustomersClient.create(payload);
      setCustomers((current) => [createdCustomer, ...current]);
      setTotal((current) => current + 1);
      return createdCustomer;
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
      throw requestError;
    } finally {
      setIsCreating(false);
    }
  }, []);

  const updateCustomer = useCallback(
    async (customerId: string, payload: UpdateCustomerPayload) => {
      setIsMutating(true);
      setError(null);

      try {
        const updatedCustomer = await adminCustomersClient.update(
          customerId,
          payload,
        );
        reconcileCustomer(updatedCustomer);
        return updatedCustomer;
      } catch (requestError: unknown) {
        setError(getErrorMessage(requestError));
        throw requestError;
      } finally {
        setIsMutating(false);
      }
    },
    [reconcileCustomer],
  );

  const deactivateCustomer = useCallback(
    async (customerId: string) => {
      setIsMutating(true);
      setError(null);

      try {
        const updatedCustomer = await adminCustomersClient.deactivate(customerId);
        reconcileCustomer(updatedCustomer);
        return updatedCustomer;
      } catch (requestError: unknown) {
        setError(getErrorMessage(requestError));
        throw requestError;
      } finally {
        setIsMutating(false);
      }
    },
    [reconcileCustomer],
  );

  const reactivateCustomer = useCallback(
    async (customerId: string) => {
      setIsMutating(true);
      setError(null);

      try {
        const updatedCustomer = await adminCustomersClient.reactivate(customerId);
        reconcileCustomer(updatedCustomer);
        return updatedCustomer;
      } catch (requestError: unknown) {
        setError(getErrorMessage(requestError));
        throw requestError;
      } finally {
        setIsMutating(false);
      }
    },
    [reconcileCustomer],
  );

  return {
    customers,
    total,
    isLoading,
    isCreating,
    isMutating,
    error,
    loadCustomers,
    createCustomer,
    updateCustomer,
    deactivateCustomer,
    reactivateCustomer,
  };
}
