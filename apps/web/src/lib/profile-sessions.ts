import {
  type ApiResponse,
  type AvatarResult,
  type AuthUser,
  authFetch,
  clearAuthCookies,
} from "@/lib/auth";

export type ActiveSession = {
  id: string;
  type: string;
  device_id: string | null;
  device_name: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string | null;
  expires_at: string | null;
  is_current: boolean;
};

export type UpdateProfilePayload = {
  full_name?: string | null;
  phone?: string | null;
  timezone?: string | null;
};

export type ChangePasswordPayload = {
  current_password: string;
  password: string;
  confirm_password: string;
};

type ProfileResult = {
  user: AuthUser;
};

export type SessionListResult = {
  sessions: ActiveSession[];
  total: number;
};

type RevokeSessionResult = {
  revoked: true;
  session_id: string;
};

type LogoutAllResult = {
  logged_out_all: true;
  revoked_sessions: number;
};

type ChangePasswordResult = {
  password_changed: true;
  sessions_revoked: true;
};

type DeleteAccountResult = {
  account_deleted: true;
  user_id: string;
};

export const profileSessionsClient = {
  async updateProfile(payload: UpdateProfilePayload): Promise<AuthUser> {
    const response = await authFetch<ApiResponse<ProfileResult>>(
      "/auth/profile",
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );

    return response.data.user;
  },

  async listSessions(): Promise<SessionListResult> {
    const response = await authFetch<ApiResponse<SessionListResult>>(
      "/auth/sessions",
      { method: "GET" },
    );

    return response.data;
  },

  async uploadAvatar(file: File): Promise<AvatarResult> {
    const formData = new FormData();
    formData.append("avatar", file);

    const response = await authFetch<ApiResponse<AvatarResult>>(
      "/auth/avatar",
      {
        method: "POST",
        body: formData,
      },
    );

    return response.data;
  },

  async changePassword(
    payload: ChangePasswordPayload,
  ): Promise<ChangePasswordResult> {
    const response = await authFetch<ApiResponse<ChangePasswordResult>>(
      "/auth/change-password",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      false,
    );

    clearAuthCookies();
    return response.data;
  },

  async deleteAccount(): Promise<DeleteAccountResult> {
    const response = await authFetch<ApiResponse<DeleteAccountResult>>(
      "/auth/delete-account",
      { method: "DELETE" },
      false,
    );

    clearAuthCookies();
    return response.data;
  },

  async revokeSession(sessionId: string): Promise<RevokeSessionResult> {
    const response = await authFetch<ApiResponse<RevokeSessionResult>>(
      `/auth/sessions/${encodeURIComponent(sessionId)}`,
      { method: "DELETE" },
    );

    return response.data;
  },

  async logoutAll(): Promise<LogoutAllResult> {
    try {
      const response = await authFetch<ApiResponse<LogoutAllResult>>(
        "/auth/logout-all",
        { method: "POST" },
        false,
      );

      return response.data;
    } finally {
      clearAuthCookies();
    }
  },
};
