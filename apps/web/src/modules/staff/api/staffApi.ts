import { type ApiResponse, authFetch } from "@/modules/auth";

export type StaffDayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type StaffPortalRole = "trainer";
export type StaffStatus =
  | "available"
  | "unavailable"
  | "on_leave"
  | "deactivated"
  | "deleted";

export type StaffAvailability = {
  id: string;
  day_of_week: StaffDayOfWeek;
  start_time: string;
  end_time: string;
  is_available: boolean;
  created_at: string;
  updated_at: string;
};

export type StaffMember = {
  id: string;
  app_user_id: string;
  auth_user_id: string;
  email: string;
  phone: string | null;
  display_name: string;
  portal_role: StaffPortalRole;
  post_title: string;
  address: string | null;
  bio: string | null;
  specialties: string[];
  staff_status: StaffStatus;
  auth_status: string;
  email_verification_required: boolean;
  availability: StaffAvailability[];
  created_at: string;
  updated_at: string;
  deactivated_at: string | null;
  deleted_at: string | null;
};

export type StaffListResult = {
  staff: StaffMember[];
  total: number;
  limit: number;
  offset: number;
};

export type CreateStaffPayload = {
  display_name: string;
  email: string;
  phone?: string;
  password: string;
  confirm_password: string;
  address?: string;
  portal_role: StaffPortalRole;
  post_title: string;
  working_days: StaffDayOfWeek[];
  start_time: string;
  end_time: string;
  specialties?: string[];
  bio?: string;
  status: Extract<StaffStatus, "available" | "unavailable" | "on_leave">;
};

export type UpdateStaffPayload = {
  display_name?: string;
  phone?: string | null;
  address?: string | null;
  post_title?: string;
  specialties?: string[];
  bio?: string | null;
  status?: Extract<StaffStatus, "available" | "unavailable" | "on_leave">;
};

export type UpdateStaffAvailabilityPayload = {
  availability: Array<{
    day_of_week: StaffDayOfWeek;
    start_time: string;
    end_time: string;
    is_available: boolean;
  }>;
};

type StaffMutationResult = {
  staff: StaffMember;
};

type StaffDeleteResult = {
  deleted: true;
  staff_id: string;
};

export const staffClient = {
  async list(): Promise<StaffListResult> {
    const response = await authFetch<ApiResponse<StaffListResult>>(
      "/admin/staff?limit=100&offset=0",
      { method: "GET" },
    );

    return response.data;
  },

  async create(payload: CreateStaffPayload): Promise<StaffMember> {
    const response = await authFetch<ApiResponse<StaffMutationResult>>(
      "/admin/staff",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );

    return response.data.staff;
  },

  async getById(staffId: string): Promise<StaffMember> {
    const response = await authFetch<ApiResponse<StaffMutationResult>>(
      `/admin/staff/${encodeURIComponent(staffId)}`,
      { method: "GET" },
    );

    return response.data.staff;
  },

  async update(
    staffId: string,
    payload: UpdateStaffPayload,
  ): Promise<StaffMember> {
    const response = await authFetch<ApiResponse<StaffMutationResult>>(
      `/admin/staff/${encodeURIComponent(staffId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );

    return response.data.staff;
  },

  async updateAvailability(
    staffId: string,
    payload: UpdateStaffAvailabilityPayload,
  ): Promise<StaffMember> {
    const response = await authFetch<ApiResponse<StaffMutationResult>>(
      `/admin/staff/${encodeURIComponent(staffId)}/availability`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );

    return response.data.staff;
  },

  async deactivate(staffId: string): Promise<StaffMember> {
    const response = await authFetch<ApiResponse<StaffMutationResult>>(
      `/admin/staff/${encodeURIComponent(staffId)}/deactivate`,
      { method: "POST" },
    );

    return response.data.staff;
  },

  async reactivate(staffId: string): Promise<StaffMember> {
    const response = await authFetch<ApiResponse<StaffMutationResult>>(
      `/admin/staff/${encodeURIComponent(staffId)}/reactivate`,
      { method: "POST" },
    );

    return response.data.staff;
  },

  async delete(staffId: string): Promise<StaffDeleteResult> {
    const response = await authFetch<ApiResponse<StaffDeleteResult>>(
      `/admin/staff/${encodeURIComponent(staffId)}`,
      { method: "DELETE" },
    );

    return response.data;
  },
};
