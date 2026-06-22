"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminUsersClient,
  type AdminUser,
  type AdminUserFilters,
} from "@/modules/users";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The user request failed.";
}

export function useAdminUsers(filters: AdminUserFilters) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reconcile = useCallback((updatedUser: AdminUser) => {
    setUsers((current) =>
      current.map((user) => (user.id === updatedUser.id ? updatedUser : user)),
    );
  }, []);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await adminUsersClient.list(filters);
      setUsers(result.users);
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
      void loadUsers().catch(() => undefined);
    }, 200);

    return () => window.clearTimeout(load);
  }, [loadUsers]);

  const mutate = useCallback(
    async (
      action: "deactivate" | "reactivate",
      userId: string,
    ): Promise<AdminUser> => {
      setIsMutating(true);
      setError(null);

      try {
        const updated =
          action === "deactivate"
            ? await adminUsersClient.deactivate(userId)
            : await adminUsersClient.reactivate(userId);
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

  const hardDeleteUser = useCallback(async (userId: string) => {
    setIsMutating(true);
    setError(null);

    try {
      const result = await adminUsersClient.hardDelete(userId);
      setUsers((current) => current.filter((user) => user.id !== userId));
      setTotal((current) => Math.max(0, current - 1));
      return result;
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
      throw requestError;
    } finally {
      setIsMutating(false);
    }
  }, []);

  return {
    users,
    total,
    isLoading,
    isMutating,
    error,
    loadUsers,
    deactivateUser: (userId: string) => mutate("deactivate", userId),
    reactivateUser: (userId: string) => mutate("reactivate", userId),
    hardDeleteUser,
  };
}
