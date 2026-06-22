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
  getCachedVerificationEmail,
  hasCachedAuthSession,
  isEmailVerificationRequiredError,
  type AuthUser,
  type ForgotPasswordResult,
  type LoginPayload,
  type LoginResult,
  type ResetPasswordPayload,
  type ResetPasswordResult,
  type ResendVerificationResult,
  type SignUpPayload,
  type SignUpResult,
  type VerifyEmailResult,
  type VerifyResetOtpResult,
} from "@/lib/auth/auth";

type AuthContextValue = {
  user: AuthUser | null;
  avatarUrl: string | null;
  pendingVerificationEmail: string | null;
  passwordResetEmail: string | null;
  isAuthenticated: boolean;
  isChecking: boolean;
  isLoggingIn: boolean;
  isSigningUp: boolean;
  isVerifyingEmail: boolean;
  isResendingVerification: boolean;
  isRequestingPasswordReset: boolean;
  isVerifyingResetOtp: boolean;
  isResettingPassword: boolean;
  error: string | null;
  login: (payload: LoginPayload) => Promise<LoginResult>;
  signUp: (payload: SignUpPayload) => Promise<SignUpResult>;
  verifyEmail: (otp: string) => Promise<VerifyEmailResult>;
  resendVerificationOtp: () => Promise<ResendVerificationResult>;
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
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<
    string | null
  >(null);
  const [passwordResetEmail, setPasswordResetEmail] = useState<string | null>(
    null,
  );
  const [isChecking, setIsChecking] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [isRequestingPasswordReset, setIsRequestingPasswordReset] =
    useState(false);
  const [isVerifyingResetOtp, setIsVerifyingResetOtp] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [storedError, setStoredError] = useState<{
    message: string;
    pathname: string;
  } | null>(null);

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
    return err instanceof Error ? err.message : fallback;
  }, []);

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
      setIsLoggingIn(true);
      setError(null);

      try {
        const result = await authClient.login(payload);
        setCurrentUser(result.user);
        void refreshAvatar();
        return result;
      } catch (err: unknown) {
        if (isEmailVerificationRequiredError(err)) {
          setPendingVerificationEmail(getCachedVerificationEmail());
          setError(null);
        } else {
          setError(getErrorMessage(err, "Login failed."));
        }

        throw err;
      } finally {
        setIsLoggingIn(false);
      }
    },
    [getErrorMessage, refreshAvatar, setCurrentUser, setError],
  );

  const signUp = useCallback(
    async (payload: SignUpPayload) => {
      setIsSigningUp(true);
      setError(null);

      try {
        const result = await authClient.signUp(payload);
        setPendingVerificationEmail(getCachedVerificationEmail());
        return result;
      } catch (err: unknown) {
        setError(getErrorMessage(err, "Account creation failed."));
        throw err;
      } finally {
        setIsSigningUp(false);
      }
    },
    [getErrorMessage, setError],
  );

  const verifyEmail = useCallback(
    async (otp: string) => {
      setIsVerifyingEmail(true);
      setError(null);

      try {
        const result = await authClient.verifyEmail(otp);
        setPendingVerificationEmail(null);
        return result;
      } catch (err: unknown) {
        setError(getErrorMessage(err, "Email verification failed."));
        throw err;
      } finally {
        setIsVerifyingEmail(false);
      }
    },
    [getErrorMessage, setError],
  );

  const resendVerificationOtp = useCallback(async () => {
    setIsResendingVerification(true);
    setError(null);

    try {
      return await authClient.resendVerificationOtp();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not resend verification code."));
      throw err;
    } finally {
      setIsResendingVerification(false);
    }
  }, [getErrorMessage, setError]);

  const forgotPassword = useCallback(
    async (email: string) => {
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
    [getErrorMessage, setError],
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
    [clearAuthState, getErrorMessage, setError],
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
      pendingVerificationEmail,
      passwordResetEmail,
      isAuthenticated,
      isChecking,
      isLoggingIn,
      isSigningUp,
      isVerifyingEmail,
      isResendingVerification,
      isRequestingPasswordReset,
      isVerifyingResetOtp,
      isResettingPassword,
      error,
      login,
      signUp,
      verifyEmail,
      resendVerificationOtp,
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
      pendingVerificationEmail,
      passwordResetEmail,
      isAuthenticated,
      isChecking,
      isLoggingIn,
      isSigningUp,
      isVerifyingEmail,
      isResendingVerification,
      isRequestingPasswordReset,
      isVerifyingResetOtp,
      isResettingPassword,
      error,
      login,
      signUp,
      verifyEmail,
      resendVerificationOtp,
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
