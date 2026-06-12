import { type ApiResponse, authFetch, type AuthRole } from "@/lib/auth";

export type AdminUserStatus =
  | "guest_active"
  | "pending_email_verification"
  | "active"
  | "deactivated"
  | "deleted";

export type AdminUserRole = AuthRole | "stylist";

export type AdminUser = {
  id: string;
  auth_user_id: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  role: AdminUserRole;
  status: AdminUserStatus;
  is_guest: boolean;
  avatar_path: string | null;
  timezone: string | null;
  guest_expires_at: string | null;
  converted_from_guest_at: string | null;
  created_at: string;
  updated_at: string;
  deactivated_at: string | null;
  deleted_at: string | null;
};

export type AdminUserFilters = {
  search?: string;
  role?: AdminUserRole;
  status?: AdminUserStatus;
  is_guest?: boolean;
};

export type AdminUserListResult = {
  users: AdminUser[];
  total: number;
  limit: number;
  offset: number;
};

type AdminUserMutationResult = {
  user: AdminUser;
};

type HardDeleteResult = {
  hard_deleted: true;
  user_id: string;
};

function buildQuery(filters: AdminUserFilters): string {
  const params = new URLSearchParams({ limit: "200", offset: "0" });

  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.role) params.set("role", filters.role);
  if (filters.status) params.set("status", filters.status);
  if (typeof filters.is_guest === "boolean") {
    params.set("is_guest", String(filters.is_guest));
  }

  return params.toString();
}

export const adminUsersClient = {
  async list(filters: AdminUserFilters): Promise<AdminUserListResult> {
    const response = await authFetch<ApiResponse<AdminUserListResult>>(
      `/auth/admin/users?${buildQuery(filters)}`,
      { method: "GET" },
    );

    return response.data;
  },

  async deactivate(userId: string): Promise<AdminUser> {
    const response = await authFetch<ApiResponse<AdminUserMutationResult>>(
      `/auth/admin/users/${encodeURIComponent(userId)}/deactivate`,
      { method: "POST" },
    );

    return response.data.user;
  },

  async reactivate(userId: string): Promise<AdminUser> {
    const response = await authFetch<ApiResponse<AdminUserMutationResult>>(
      `/auth/admin/users/${encodeURIComponent(userId)}/reactivate`,
      { method: "POST" },
    );

    return response.data.user;
  },

  async hardDelete(userId: string): Promise<HardDeleteResult> {
    const response = await authFetch<ApiResponse<HardDeleteResult>>(
      `/auth/admin/users/${encodeURIComponent(userId)}/hard-delete`,
      { method: "DELETE" },
    );

    return response.data;
  },
};
