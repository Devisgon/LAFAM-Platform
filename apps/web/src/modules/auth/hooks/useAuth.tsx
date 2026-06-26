"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { useRateLimit } from "@/hooks/useRateLimit";
import { ERROR_MESSAGES } from "@/lib/error/errorMap";
import { getSafeErrorMessage } from "@/lib/error/handleError";
import { AppError } from "@/types/api.types";
import {
  AuthClientError,
  authClient,
  type AvatarResult,
  cacheAuthUser,
  cacheAvatarUrl,
  clearCachedAuthProfile,
  getCachedAuthUser,
  getCachedAvatarUrl,
  getCachedPasswordResetEmail,
  getDashboardPath,
  hasCachedAuthSession,
  type AuthUser,
  type ForgotPasswordResult,
  type LoginPayload,
  type LoginResult,
  type ResetPasswordPayload,
  type ResetPasswordResult,
  type VerifyResetOtpResult,
} from "@/modules/auth";

type AuthContextValue = {
  user: AuthUser | null;
  avatarUrl: string | null;
  passwordResetEmail: string | null;
  isAuthenticated: boolean;
  isChecking: boolean;
  isLoggingIn: boolean;
  isRequestingPasswordReset: boolean;
  isVerifyingResetOtp: boolean;
  isResettingPassword: boolean;
  error: string | null;
  login: (payload: LoginPayload) => Promise<LoginResult>;
  forgotPassword: (email: string) => Promise<ForgotPasswordResult>;
  verifyResetOtp: (otp: string) => Promise<VerifyResetOtpResult>;
  resetPassword: (
    payload: ResetPasswordPayload,
  ) => Promise<ResetPasswordResult>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
  refreshAvatar: () => Promise<AvatarResult>;
  setCurrentUser: (user: AuthUser | null) => void;
  setAvatarUrl: (url: string | null) => void;
  clearError: () => void;
  getDashboardPath: typeof getDashboardPath;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: React.ReactNode;
};

function isInvalidSessionError(error: unknown): boolean {
  return (
    error instanceof AuthClientError &&
    (error.status === 401 || error.status === 403)
  );
}

export function AuthProvider({ children }: AuthProviderProps) {
  const pathname = usePathname();
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [avatarUrl, setAvatarUrlState] = useState<string | null>(null);
  const [passwordResetEmail, setPasswordResetEmail] = useState<string | null>(
    null,
  );
  const [isChecking, setIsChecking] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRequestingPasswordReset, setIsRequestingPasswordReset] =
    useState(false);
  const [isVerifyingResetOtp, setIsVerifyingResetOtp] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [storedError, setStoredError] = useState<{
    message: string;
    pathname: string;
  } | null>(null);
  const rateLimiter = useRateLimit();

  const isAuthenticated = Boolean(user);
  const error = storedError?.pathname === pathname ? storedError.message : null;

  const setError = useCallback(
    (message: string | null) => {
      setStoredError(message === null ? null : { message, pathname });
    },
    [pathname],
  );

  const setCurrentUser = useCallback((nextUser: AuthUser | null) => {
    setUserState(nextUser);

    if (nextUser) {
      cacheAuthUser(nextUser);
      return;
    }

    setAvatarUrlState(null);
    clearCachedAuthProfile();
  }, []);

  const setCurrentAvatarUrl = useCallback((nextAvatarUrl: string | null) => {
    setAvatarUrlState(nextAvatarUrl);
    cacheAvatarUrl(nextAvatarUrl);
  }, []);

  const clearAuthState = useCallback(() => {
    setUserState(null);
    setAvatarUrlState(null);
    clearCachedAuthProfile();
  }, []);

  const getErrorMessage = useCallback((err: unknown, fallback: string) => {
    const message = getSafeErrorMessage(err);
    return message === ERROR_MESSAGES.unknown ? fallback : message;
  }, []);

  const enforceRateLimit = useCallback(() => {
    if (rateLimiter.canRun()) return;
    const error = new AppError("rate_limited", ERROR_MESSAGES.rate_limited, 429);
    setError(error.message);
    throw error;
  }, [rateLimiter, setError]);

  const refreshUser = useCallback(async () => {
    setIsChecking(true);

    try {
      if (!hasCachedAuthSession()) {
        clearAuthState();
        return null;
      }

      const currentUser = await authClient.getCurrentUser();

      if (!currentUser) {
        clearAuthState();
        return null;
      }

      setCurrentUser(currentUser);
      return currentUser;
    } catch (requestError: unknown) {
      if (isInvalidSessionError(requestError)) {
        clearAuthState();
        return null;
      }

      return getCachedAuthUser();
    } finally {
      setIsChecking(false);
    }
  }, [clearAuthState, setCurrentUser]);

  const refreshAvatar = useCallback(async () => {
    try {
      if (!hasCachedAuthSession()) {
        setCurrentAvatarUrl(null);
        return { avatar_path: null, avatar_url: null };
      }

      const avatar = await authClient.getAvatar();
      setCurrentAvatarUrl(avatar.avatar_url);
      return avatar;
    } catch {
      const cachedUser = getCachedAuthUser();
      const cachedAvatarUrl = getCachedAvatarUrl();

      return {
        avatar_path: cachedUser?.avatar_path ?? null,
        avatar_url: cachedAvatarUrl,
      };
    }
  }, [setCurrentAvatarUrl]);

  useEffect(() => {
    let isActive = true;

    const hydrateAuthState = async () => {
      const cachedUser = getCachedAuthUser();
      const cachedAvatarUrl = getCachedAvatarUrl();

      if (!hasCachedAuthSession()) {
        if (isActive) {
          clearAuthState();
          setIsChecking(false);
        }

        return;
      }

      if (isActive) {
        if (cachedUser) {
          setUserState(cachedUser);
        }

        if (cachedAvatarUrl) {
          setAvatarUrlState(cachedAvatarUrl);
        }

        setIsChecking(true);
      }

      try {
        const currentUser = await authClient.getCurrentUser();

        if (!isActive) {
          return;
        }

        if (!currentUser) {
          clearAuthState();
          return;
        }

        setCurrentUser(currentUser);

        try {
          const avatar = await authClient.getAvatar();

          if (isActive) {
            setCurrentAvatarUrl(avatar.avatar_url);
          }
        } catch {
          if (isActive && cachedAvatarUrl) {
            setAvatarUrlState(cachedAvatarUrl);
          }
        }
      } catch (requestError: unknown) {
        if (!isActive) {
          return;
        }

        if (isInvalidSessionError(requestError)) {
          clearAuthState();
          return;
        }

        if (cachedUser) {
          setUserState(cachedUser);
        }

        if (cachedAvatarUrl) {
          setAvatarUrlState(cachedAvatarUrl);
        }
      } finally {
        if (isActive) {
          setIsChecking(false);
        }
      }
    };

    void hydrateAuthState();

    return () => {
      isActive = false;
    };
  }, [clearAuthState, setCurrentUser, setCurrentAvatarUrl]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      enforceRateLimit();
      setIsLoggingIn(true);
      setError(null);

      try {
        const result = await authClient.login(payload);
        setCurrentUser(result.user);
        void refreshAvatar();
        return result;
      } catch (err: unknown) {
        setError(getErrorMessage(err, "Login failed."));
        throw err;
      } finally {
        setIsLoggingIn(false);
      }
    },
    [enforceRateLimit, getErrorMessage, refreshAvatar, setCurrentUser, setError],
  );

  const forgotPassword = useCallback(
    async (email: string) => {
      enforceRateLimit();
      setIsRequestingPasswordReset(true);
      setError(null);

      try {
        const result = await authClient.forgotPassword(email);
        setPasswordResetEmail(getCachedPasswordResetEmail());
        return result;
      } catch (err: unknown) {
        setError(getErrorMessage(err, "Could not request a password reset."));
        throw err;
      } finally {
        setIsRequestingPasswordReset(false);
      }
    },
    [enforceRateLimit, getErrorMessage, setError],
  );

  const verifyResetOtp = useCallback(
    async (otp: string) => {
      setIsVerifyingResetOtp(true);
      setError(null);

      try {
        return await authClient.verifyResetOtp(otp);
      } catch (err: unknown) {
        setError(
          getErrorMessage(err, "Password reset code verification failed."),
        );
        throw err;
      } finally {
        setIsVerifyingResetOtp(false);
      }
    },
    [getErrorMessage, setError],
  );

  const resetPassword = useCallback(
    async (payload: ResetPasswordPayload) => {
      enforceRateLimit();
      setIsResettingPassword(true);
      setError(null);

      try {
        const result = await authClient.resetPassword(payload);
        clearAuthState();
        setPasswordResetEmail(null);
        return result;
      } catch (err: unknown) {
        setError(getErrorMessage(err, "Password reset failed."));
        throw err;
      } finally {
        setIsResettingPassword(false);
      }
    },
    [clearAuthState, enforceRateLimit, getErrorMessage, setError],
  );

  const logout = useCallback(async () => {
    setError(null);

    try {
      await authClient.logout();
    } finally {
      clearAuthState();
    }
  }, [clearAuthState, setError]);

  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      avatarUrl,
      passwordResetEmail,
      isAuthenticated,
      isChecking,
      isLoggingIn,
      isRequestingPasswordReset,
      isVerifyingResetOtp,
      isResettingPassword,
      error,
      login,
      forgotPassword,
      verifyResetOtp,
      resetPassword,
      logout,
      refreshUser,
      refreshAvatar,
      setCurrentUser,
      setAvatarUrl: setCurrentAvatarUrl,
      clearError,
      getDashboardPath,
    }),
    [
      user,
      avatarUrl,
      passwordResetEmail,
      isAuthenticated,
      isChecking,
      isLoggingIn,
      isRequestingPasswordReset,
      isVerifyingResetOtp,
      isResettingPassword,
      error,
      login,
      forgotPassword,
      verifyResetOtp,
      resetPassword,
      logout,
      refreshUser,
      refreshAvatar,
      setCurrentUser,
      setCurrentAvatarUrl,
      clearError,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
