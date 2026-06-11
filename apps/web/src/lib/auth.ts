export type AuthRole =
  | "super_admin"
  | "admin"
  | "trainer"
  | "staff"
  | "customer"
  | "user"
  | "guest";

export type AuthUser = {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  role: AuthRole;
  status: string;
  is_guest: boolean;
  avatar_path: string | null;
  timezone: string | null;
  created_at: string;
  updated_at: string;
};

export type AuthSession = {
  id: string;
  type: string;
  device_id: string | null;
  device_name: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  converted_at: string | null;
};

export type ApiResponse<TData> = {
  status: number;
  message: string;
  data: TData;
  timestamp_ms: number;
};

export type LoginPayload = {
  email: string;
  password: string;
  device_id?: string;
  device_name?: string;
};

export type LoginResult = {
  authenticated: boolean;
  user: AuthUser;
  session: AuthSession;
};

export type SignUpPayload = {
  email: string;
  phone?: string | null;
  full_name: string;
  password: string;
  confirm_password: string;
  timezone?: string | null;
  device_id?: string | null;
  device_name?: string | null;
};

export type SignUpResult = {
  user: AuthUser;
  email_verification_required: boolean;
};

export type VerifyEmailResult = {
  user: AuthUser;
  verified: true;
};

export type ResendVerificationResult = {
  email: string;
  sent: true;
};

export type ForgotPasswordResult = {
  email: string;
  reset_otp_sent: true;
};

export type VerifyResetOtpResult = {
  email: string;
  reset_token: string;
  reset_token_expires_at: string;
};

export type ResetPasswordPayload = {
  password: string;
  confirm_password: string;
};

export type ResetPasswordResult = {
  password_reset: true;
};

type LoginApiData = {
  authenticated: boolean;
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number | null;
  user: AuthUser;
  session: AuthSession;
};

type RefreshApiData = {
  authenticated: boolean;
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number | null;
  user?: AuthUser;
  session?: AuthSession;
};

export class AuthClientError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "AuthClientError";
    this.status = status;
    this.payload = payload;
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_BASE_URL is missing.");
}

const AUTH_COOKIE_NAMES = {
  accessToken: "lafam_access_token",
  refreshToken: "lafam_refresh_token",
  role: "lafam_role",
  sessionId: "lafam_session_id",
} as const;

const PENDING_VERIFICATION_EMAIL_KEY = "lafam_pending_verification_email";
const PASSWORD_RESET_EMAIL_KEY = "lafam_password_reset_email";
const PASSWORD_RESET_TOKEN_KEY = "lafam_password_reset_token";
const REFRESH_TOKEN_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function getApiUrl(path: string): string {
  return `${API_BASE_URL!.replace(/\/$/, "")}${path}`;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function shouldUseSecureCookie(): boolean {
  if (!isBrowser()) return false;

  return window.location.protocol === "https:";
}

function getCookie(name: string): string | null {
  if (!isBrowser()) return null;

  const cookies = document.cookie.split("; ");

  const cookie = cookies.find((item) => item.startsWith(`${name}=`));

  if (!cookie) return null;

  return decodeURIComponent(cookie.split("=")[1] ?? "");
}

function setCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (!isBrowser()) return;

  const attributes = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
    "SameSite=Lax",
  ];

  if (shouldUseSecureCookie()) {
    attributes.push("Secure");
  }

  document.cookie = attributes.join("; ");
}

function deleteCookie(name: string): void {
  if (!isBrowser()) return;

  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function setAuthCookies(data: {
  access_token: string;
  refresh_token?: string;
  expires_in: number | null;
  user?: AuthUser;
  session?: AuthSession;
}): void {
  setCookie(
    AUTH_COOKIE_NAMES.accessToken,
    data.access_token,
    data.expires_in ?? 3600,
  );

  if (data.refresh_token) {
    setCookie(
      AUTH_COOKIE_NAMES.refreshToken,
      data.refresh_token,
      REFRESH_TOKEN_MAX_AGE_SECONDS,
    );
  }

  if (data.user?.role) {
    setCookie(
      AUTH_COOKIE_NAMES.role,
      data.user.role,
      REFRESH_TOKEN_MAX_AGE_SECONDS,
    );
  }

  if (data.session?.id) {
    setCookie(
      AUTH_COOKIE_NAMES.sessionId,
      data.session.id,
      REFRESH_TOKEN_MAX_AGE_SECONDS,
    );
  }
}

export function clearAuthCookies(): void {
  deleteCookie(AUTH_COOKIE_NAMES.accessToken);
  deleteCookie(AUTH_COOKIE_NAMES.refreshToken);
  deleteCookie(AUTH_COOKIE_NAMES.role);
  deleteCookie(AUTH_COOKIE_NAMES.sessionId);
}

function getAccessToken(): string | null {
  return getCookie(AUTH_COOKIE_NAMES.accessToken);
}

function getRefreshToken(): string | null {
  return getCookie(AUTH_COOKIE_NAMES.refreshToken);
}

export function hasCachedAuthSession(): boolean {
  return Boolean(getAccessToken() || getRefreshToken());
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function cachePendingVerificationEmail(email: string): void {
  if (!isBrowser()) return;

  window.sessionStorage.setItem(
    PENDING_VERIFICATION_EMAIL_KEY,
    normalizeEmail(email),
  );
}

export function getCachedVerificationEmail(): string | null {
  if (!isBrowser()) return null;

  return window.sessionStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY);
}

export function clearCachedVerificationEmail(): void {
  if (!isBrowser()) return;

  window.sessionStorage.removeItem(PENDING_VERIFICATION_EMAIL_KEY);
}

function cachePasswordResetEmail(email: string): void {
  if (!isBrowser()) return;

  window.sessionStorage.setItem(
    PASSWORD_RESET_EMAIL_KEY,
    normalizeEmail(email),
  );
}

export function getCachedPasswordResetEmail(): string | null {
  if (!isBrowser()) return null;

  return window.sessionStorage.getItem(PASSWORD_RESET_EMAIL_KEY);
}

function cachePasswordResetToken(token: string): void {
  if (!isBrowser()) return;

  window.sessionStorage.setItem(PASSWORD_RESET_TOKEN_KEY, token);
}

export function hasCachedPasswordResetToken(): boolean {
  if (!isBrowser()) return false;

  return Boolean(window.sessionStorage.getItem(PASSWORD_RESET_TOKEN_KEY));
}

function getCachedPasswordResetToken(): string | null {
  if (!isBrowser()) return null;

  return window.sessionStorage.getItem(PASSWORD_RESET_TOKEN_KEY);
}

export function clearCachedPasswordReset(): void {
  if (!isBrowser()) return;

  window.sessionStorage.removeItem(PASSWORD_RESET_EMAIL_KEY);
  window.sessionStorage.removeItem(PASSWORD_RESET_TOKEN_KEY);
}

async function readJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getApiErrorMessage(payload: unknown): string {
  const error = (payload as { error?: unknown } | null)?.error;

  if (error && typeof error === "object") {
    const validationErrors = (
      error as {
        details?: { validationErrors?: unknown };
      }
    ).details?.validationErrors;

    if (Array.isArray(validationErrors)) {
      const messages = validationErrors.filter(
        (message): message is string => typeof message === "string",
      );

      if (messages.length > 0) {
        return messages.join(" ");
      }
    }

    const message = (error as { message?: unknown }).message;

    if (typeof message === "string") {
      return message;
    }
  }

  const message = (payload as { message?: unknown } | null)?.message;
  return typeof message === "string" ? message : "Request failed.";
}

export function getDashboardPath(role?: string | null): string {
  switch (role) {
    case "super_admin":
    case "admin":
      return "/admin";

    case "staff":
    case "trainer":
      return "/staff";

    case "customer":
    case "user":
      return "/user";

    case "guest":
      return "/guest";

    default:
      return "/";
  }
}

function getSafeRedirectPath(path: string | null): string | null {
  if (!path) return null;

  if (!path.startsWith("/") || path.startsWith("//")) {
    return null;
  }

  return path;
}

export function resolvePostLoginRedirect(
  role: string | null | undefined,
  redirectPath: string | null,
): string {
  return getSafeRedirectPath(redirectPath) ?? getDashboardPath(role);
}

export function getBrowserDeviceInfo() {
  if (!isBrowser()) {
    return {
      device_id: "server",
      device_name: "Server",
    };
  }

  const userAgent = window.navigator.userAgent;

  let deviceName = "Web Browser";

  if (userAgent.includes("Edg")) {
    deviceName = "Microsoft Edge";
  } else if (userAgent.includes("Chrome")) {
    deviceName = "Chrome on Windows";
  } else if (userAgent.includes("Firefox")) {
    deviceName = "Firefox Browser";
  } else if (userAgent.includes("Safari")) {
    deviceName = "Safari Browser";
  }

  return {
    device_id: "web-browser",
    device_name: deviceName,
  };
}

async function refreshSession(): Promise<boolean> {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    clearAuthCookies();
    return false;
  }

  const response = await fetch(getApiUrl("/auth/refresh-token"), {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      refresh_token: refreshToken,
    }),
  });

  const payload = await readJsonSafe(response);

  if (!response.ok) {
    clearAuthCookies();
    return false;
  }

  const data = (payload as { data?: RefreshApiData } | null)?.data;

  if (!data?.access_token) {
    clearAuthCookies();
    return false;
  }

  setAuthCookies({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in ?? 3600,
    user: data.user,
    session: data.session,
  });

  return true;
}

export async function authFetch<T>(
  path: string,
  init: RequestInit = {},
  retryOnUnauthorized = true,
): Promise<T> {
  const accessToken = getAccessToken();

  const response = await fetch(getApiUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });

  const payload = await readJsonSafe(response);

  if (response.status === 401 && retryOnUnauthorized) {
    const refreshed = await refreshSession();

    if (refreshed) {
      return authFetch<T>(path, init, false);
    }

    clearAuthCookies();

    if (isBrowser()) {
      window.location.href = "/";
    }

    throw new AuthClientError(
      "Session expired. Please login again.",
      401,
      payload,
    );
  }

  if (!response.ok) {
    throw new AuthClientError(
      getApiErrorMessage(payload),
      response.status,
      payload,
    );
  }

  return payload as T;
}

function extractCurrentUser(payload: unknown): AuthUser | null {
  const data = (payload as { data?: unknown } | null)?.data;

  if (!data || typeof data !== "object") return null;

  if ("user" in data && data.user) {
    return data.user as AuthUser;
  }

  if ("id" in data && "email" in data) {
    return data as AuthUser;
  }

  return null;
}

export const authClient = {
  async forgotPassword(emailInput: string): Promise<ForgotPasswordResult> {
    const email = normalizeEmail(emailInput);
    const response = await authFetch<ApiResponse<ForgotPasswordResult>>(
      "/auth/forgot-password",
      {
        method: "POST",
        body: JSON.stringify({ email }),
      },
      false,
    );

    clearCachedPasswordReset();
    cachePasswordResetEmail(email);
    return response.data;
  },

  async verifyResetOtp(otp: string): Promise<VerifyResetOtpResult> {
    const email = getCachedPasswordResetEmail();

    if (!email) {
      throw new AuthClientError(
        "Your password reset email is missing. Please request a new code.",
        400,
        null,
      );
    }

    const response = await authFetch<ApiResponse<VerifyResetOtpResult>>(
      "/auth/verify-reset-otp",
      {
        method: "POST",
        body: JSON.stringify({ email, otp }),
      },
      false,
    );

    cachePasswordResetToken(response.data.reset_token);
    return response.data;
  },

  async resetPassword(
    payload: ResetPasswordPayload,
  ): Promise<ResetPasswordResult> {
    const email = getCachedPasswordResetEmail();
    const resetToken = getCachedPasswordResetToken();

    if (!email || !resetToken) {
      throw new AuthClientError(
        "Your password reset session is missing or expired. Please request a new code.",
        400,
        null,
      );
    }

    const response = await authFetch<ApiResponse<ResetPasswordResult>>(
      "/auth/reset-password",
      {
        method: "POST",
        body: JSON.stringify({
          email,
          reset_token: resetToken,
          ...payload,
        }),
      },
      false,
    );

    clearCachedPasswordReset();
    clearAuthCookies();
    return response.data;
  },

  async signUp(payload: SignUpPayload): Promise<SignUpResult> {
    const deviceInfo = getBrowserDeviceInfo();
    const email = normalizeEmail(payload.email);

    const response = await authFetch<ApiResponse<SignUpResult>>(
      "/auth/sign-up",
      {
        method: "POST",
        body: JSON.stringify({
          ...deviceInfo,
          ...payload,
          email,
        }),
      },
      false,
    );

    cachePendingVerificationEmail(email);
    return response.data;
  },

  async verifyEmail(otp: string): Promise<VerifyEmailResult> {
    const email = getCachedVerificationEmail();

    if (!email) {
      throw new AuthClientError(
        "Your verification email is missing. Please create your account again.",
        400,
        null,
      );
    }

    const response = await authFetch<ApiResponse<VerifyEmailResult>>(
      "/auth/verify-email",
      {
        method: "POST",
        body: JSON.stringify({ email, otp }),
      },
      false,
    );

    clearCachedVerificationEmail();
    return response.data;
  },

  async resendVerificationOtp(): Promise<ResendVerificationResult> {
    const email = getCachedVerificationEmail();

    if (!email) {
      throw new AuthClientError(
        "Your verification email is missing. Please create your account again.",
        400,
        null,
      );
    }

    const response = await authFetch<ApiResponse<ResendVerificationResult>>(
      "/auth/resend-verification-otp",
      {
        method: "POST",
        body: JSON.stringify({ email }),
      },
      false,
    );

    return response.data;
  },

  async login(payload: LoginPayload): Promise<LoginResult> {
    const deviceInfo = getBrowserDeviceInfo();

    const response = await authFetch<ApiResponse<LoginApiData>>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({
          ...deviceInfo,
          ...payload,
        }),
      },
      false,
    );

    setAuthCookies({
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_in: response.data.expires_in ?? 3600,
      user: response.data.user,
      session: response.data.session,
    });

    return {
      authenticated: response.data.authenticated,
      user: response.data.user,
      session: response.data.session,
    };
  },

  async getCurrentUser(): Promise<AuthUser | null> {
    if (!hasCachedAuthSession()) {
      return null;
    }

    const response = await authFetch<ApiResponse<unknown>>("/auth/me", {
      method: "GET",
    });

    return extractCurrentUser(response);
  },

  async logout(): Promise<void> {
    try {
      await authFetch<ApiResponse<unknown>>(
        "/auth/logout",
        {
          method: "POST",
        },
        false,
      );
    } finally {
      clearAuthCookies();
    }
  },
};
