"use client";

import { useCallback, useEffect, useState } from "react";
import {
  staffClient,
  type CreateStaffPayload,
  type StaffMember,
  type UpdateStaffAvailabilityPayload,
  type UpdateStaffPayload,
} from "@/lib/admin/staff";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The staff request failed.";
}

export function useStaff() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reconcileStaff = useCallback((updatedStaff: StaffMember) => {
    setStaff((current) =>
      current.map((member) =>
        member.id === updatedStaff.id ? updatedStaff : member,
      ),
    );
  }, []);

  const loadStaff = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await staffClient.list();
      setStaff(result.staff);
      setTotal(result.total);
      return result;
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
      throw requestError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const load = window.setTimeout(() => {
      void loadStaff().catch(() => undefined);
    }, 0);

    return () => window.clearTimeout(load);
  }, [loadStaff]);

  const createStaff = useCallback(async (payload: CreateStaffPayload) => {
    setIsCreating(true);
    setError(null);

    try {
      const createdStaff = await staffClient.create(payload);
      setStaff((current) => [createdStaff, ...current]);
      setTotal((current) => current + 1);
      return createdStaff;
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
      throw requestError;
    } finally {
      setIsCreating(false);
    }
  }, []);

  const getStaff = useCallback(
    async (staffId: string) => {
      const detail = await staffClient.getById(staffId);
      reconcileStaff(detail);
      return detail;
    },
    [reconcileStaff],
  );

  const updateStaff = useCallback(
    async (staffId: string, payload: UpdateStaffPayload) => {
      setIsMutating(true);
      setError(null);

      try {
        const updatedStaff = await staffClient.update(staffId, payload);
        reconcileStaff(updatedStaff);
        return updatedStaff;
      } catch (requestError: unknown) {
        setError(getErrorMessage(requestError));
        throw requestError;
      } finally {
        setIsMutating(false);
      }
    },
    [reconcileStaff],
  );

  const updateAvailability = useCallback(
    async (staffId: string, payload: UpdateStaffAvailabilityPayload) => {
      setIsMutating(true);
      setError(null);

      try {
        const updatedStaff = await staffClient.updateAvailability(
          staffId,
          payload,
        );
        reconcileStaff(updatedStaff);
        return updatedStaff;
      } catch (requestError: unknown) {
        setError(getErrorMessage(requestError));
        throw requestError;
      } finally {
        setIsMutating(false);
      }
    },
    [reconcileStaff],
  );

  const deactivateStaff = useCallback(
    async (staffId: string) => {
      setIsMutating(true);
      setError(null);

      try {
        const updatedStaff = await staffClient.deactivate(staffId);
        reconcileStaff(updatedStaff);
        return updatedStaff;
      } catch (requestError: unknown) {
        setError(getErrorMessage(requestError));
        throw requestError;
      } finally {
        setIsMutating(false);
      }
    },
    [reconcileStaff],
  );

  const reactivateStaff = useCallback(
    async (staffId: string) => {
      setIsMutating(true);
      setError(null);

      try {
        const updatedStaff = await staffClient.reactivate(staffId);
        reconcileStaff(updatedStaff);
        return updatedStaff;
      } catch (requestError: unknown) {
        setError(getErrorMessage(requestError));
        throw requestError;
      } finally {
        setIsMutating(false);
      }
    },
    [reconcileStaff],
  );

  const deleteStaff = useCallback(async (staffId: string) => {
    setIsMutating(true);
    setError(null);

    try {
      const result = await staffClient.delete(staffId);
      setStaff((current) => current.filter((member) => member.id !== staffId));
      setTotal((current) => Math.max(0, current - 1));
      return result;
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
      throw requestError;
    } finally {
      setIsMutating(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    staff,
    total,
    isLoading,
    isCreating,
    isMutating,
    error,
    loadStaff,
    createStaff,
    getStaff,
    updateStaff,
    updateAvailability,
    deactivateStaff,
    reactivateStaff,
    deleteStaff,
    clearError,
  };
}
