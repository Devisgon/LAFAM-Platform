import { type ApiResponse, authFetch } from "@/modules/auth";

export type CustomerAuthStatus =
  | "guest_active"
  | "invited"
  | "active"
  | "pending_email_verification"
  | "deactivated"
  | "deleted";

export type CustomerInvitationStatus =
  | "pending"
  | "accepted"
  | "expired"
  | "revoked";

export type CustomerInvitation = {
  accepted_at: string | null;
  accepted_by_app_user_id: string | null;
  app_user_id: string;
  created_at: string;
  created_by_admin_id: string;
  email: string;
  expires_at: string;
  expired_at: string | null;
  id: string;
  revoked_at: string | null;
  revoked_by_admin_id: string | null;
  status: CustomerInvitationStatus;
  updated_at: string;
};

export type CustomerProfile = {
  id: string;
  app_user_id: string;
  auth_user_id: string;
  email: string;
  phone: string;
  full_name: string;
  civil_id: string;
  role: "customer";
  auth_status: CustomerAuthStatus;
  is_guest: false;
  avatar_path: string | null;
  timezone: string | null;
  created_by_admin_id: string | null;
  updated_by_admin_id: string | null;
  created_at: string;
  updated_at: string;
  deactivated_at: string | null;
  deleted_at: string | null;
  latest_invitation?: CustomerInvitation | null;
};

export type CustomerFilters = {
  search?: string;
  auth_status?: CustomerAuthStatus;
  include_deleted?: boolean;
  limit?: number;
  offset?: number;
};

export type CustomerListResult = {
  customers: CustomerProfile[];
  total: number;
  limit: number;
  offset: number;
};

export type CustomerLookupResult = {
  customer: CustomerProfile | null;
  matched_by: "phone" | "civil_id" | "phone_and_civil_id" | null;
};

export type CreateCustomerPayload = {
  full_name: string;
  email: string;
  phone: string;
  civil_id: string;
  password?: string;
  confirm_password?: string;
  timezone?: string | null;
};

export type UpdateCustomerPayload = {
  full_name?: string;
  phone?: string;
  civil_id?: string;
  timezone?: string | null;
};

type CustomerMutationResult = {
  customer: CustomerProfile;
};

type CustomerInvitationMutationResult = {
  customer: CustomerProfile;
  invitation: CustomerInvitation;
};

function buildQuery(filters: CustomerFilters): string {
  const params = new URLSearchParams({
    limit: String(filters.limit ?? 50),
    offset: String(filters.offset ?? 0),
  });

  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }

  if (filters.auth_status) {
    params.set("auth_status", filters.auth_status);
  }

  if (typeof filters.include_deleted === "boolean") {
    params.set("include_deleted", String(filters.include_deleted));
  }

  return params.toString();
}

export const adminCustomersClient = {
  async list(filters: CustomerFilters): Promise<CustomerListResult> {
    const response = await authFetch<ApiResponse<CustomerListResult>>(
      `/admin/customers?${buildQuery(filters)}`,
      { method: "GET" },
    );

    return response.data;
  },

  async create(payload: CreateCustomerPayload): Promise<CustomerProfile> {
    const response = await authFetch<
      ApiResponse<CustomerMutationResult | CustomerInvitationMutationResult>
    >(
      "/admin/customers",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );

    return response.data.customer;
  },

  async delete(customerId: string): Promise<{ customer_id: string; deleted: true }> {
    const response = await authFetch<
      ApiResponse<{ customer_id: string; deleted: true }>
    >(`/admin/customers/${encodeURIComponent(customerId)}`, {
      method: "DELETE",
    });

    return response.data;
  },

  async get(customerId: string): Promise<CustomerProfile> {
    const response = await authFetch<ApiResponse<CustomerMutationResult>>(
      `/admin/customers/${encodeURIComponent(customerId)}`,
      { method: "GET" },
    );

    return response.data.customer;
  },

  async lookup(input: {
    phone?: string;
    civil_id?: string;
  }, signal?: AbortSignal): Promise<CustomerLookupResult> {
    const params = new URLSearchParams();

    if (input.phone?.trim()) {
      params.set("phone", input.phone.trim());
    }

    if (input.civil_id?.trim()) {
      params.set("civil_id", input.civil_id.trim());
    }

    const response = await authFetch<ApiResponse<CustomerLookupResult>>(
      `/admin/customers/lookup?${params.toString()}`,
      { method: "GET", signal },
    );

    return response.data;
  },

  async update(
    customerId: string,
    payload: UpdateCustomerPayload,
  ): Promise<CustomerProfile> {
    const response = await authFetch<ApiResponse<CustomerMutationResult>>(
      `/admin/customers/${encodeURIComponent(customerId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );

    return response.data.customer;
  },

  async deactivate(customerId: string): Promise<CustomerProfile> {
    const response = await authFetch<ApiResponse<CustomerMutationResult>>(
      `/admin/customers/${encodeURIComponent(customerId)}/deactivate`,
      { method: "POST" },
    );

    return response.data.customer;
  },

  async reactivate(customerId: string): Promise<CustomerProfile> {
    const response = await authFetch<ApiResponse<CustomerMutationResult>>(
      `/admin/customers/${encodeURIComponent(customerId)}/reactivate`,
      { method: "POST" },
    );

    return response.data.customer;
  },

  async resendInvitation(invitationId: string): Promise<CustomerProfile> {
    const response = await authFetch<
      ApiResponse<CustomerInvitationMutationResult>
    >(
      `/admin/customers/invitations/${encodeURIComponent(invitationId)}/resend`,
      { method: "POST" },
    );

    return {
      ...response.data.customer,
      latest_invitation: response.data.invitation,
    };
  },
};
