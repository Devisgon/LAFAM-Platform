"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  type ActiveSession,
  type ChangePasswordPayload,
  profileSessionsClient,
  type UpdateProfilePayload,
} from "@/lib/profile-sessions";

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The account request could not be completed.";
}

export function useProfileSessions() {
  const { logout, setAvatarUrl, setCurrentUser, user } = useAuth();
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isMutatingSessions, setIsMutatingSessions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await profileSessionsClient.listSessions();
      setSessions(result.sessions);
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
      void loadSessions().catch(() => undefined);
    }, 0);

    return () => window.clearTimeout(load);
  }, [loadSessions]);

  const updateProfile = useCallback(
    async (payload: UpdateProfilePayload) => {
      setIsSavingProfile(true);
      setError(null);

      try {
        const updatedUser = await profileSessionsClient.updateProfile(payload);
        setCurrentUser(updatedUser);
        return updatedUser;
      } catch (requestError: unknown) {
        setError(getErrorMessage(requestError));
        throw requestError;
      } finally {
        setIsSavingProfile(false);
      }
    },
    [setCurrentUser],
  );

  const uploadAvatar = useCallback(
    async (file: File) => {
      setIsUploadingAvatar(true);
      setError(null);

      try {
        const avatar = await profileSessionsClient.uploadAvatar(file);
        setAvatarUrl(avatar.avatar_url);
        setCurrentUser(
          user ? { ...user, avatar_path: avatar.avatar_path } : user,
        );
        return avatar;
      } catch (requestError: unknown) {
        setError(getErrorMessage(requestError));
        throw requestError;
      } finally {
        setIsUploadingAvatar(false);
      }
    },
    [setAvatarUrl, setCurrentUser, user],
  );

  const changePassword = useCallback(async (payload: ChangePasswordPayload) => {
    setIsChangingPassword(true);
    setError(null);

    try {
      return await profileSessionsClient.changePassword(payload);
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
      throw requestError;
    } finally {
      setIsChangingPassword(false);
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    setIsMutatingSessions(true);
    setError(null);

    try {
      return await profileSessionsClient.deleteAccount();
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
      throw requestError;
    } finally {
      setIsMutatingSessions(false);
    }
  }, []);

  const revokeSession = useCallback(async (sessionId: string) => {
    setIsMutatingSessions(true);
    setError(null);

    try {
      const result = await profileSessionsClient.revokeSession(sessionId);
      setSessions((current) =>
        current.filter((session) => session.id !== sessionId),
      );
      setTotal((current) => Math.max(0, current - 1));
      return result;
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
      throw requestError;
    } finally {
      setIsMutatingSessions(false);
    }
  }, []);

  const logoutCurrent = useCallback(async () => {
    setIsMutatingSessions(true);
    setError(null);

    try {
      await logout();
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
      throw requestError;
    } finally {
      setIsMutatingSessions(false);
    }
  }, [logout]);

  const logoutAll = useCallback(async () => {
    setIsMutatingSessions(true);
    setError(null);

    try {
      return await profileSessionsClient.logoutAll();
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
      throw requestError;
    } finally {
      setIsMutatingSessions(false);
    }
  }, []);

  return {
    sessions,
    total,
    isLoading,
    isSavingProfile,
    isUploadingAvatar,
    isChangingPassword,
    isMutatingSessions,
    error,
    loadSessions,
    updateProfile,
    uploadAvatar,
    changePassword,
    deleteAccount,
    revokeSession,
    logoutCurrent,
    logoutAll,
  };
}
