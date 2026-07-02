import { type ApiResponse, authFetch } from "@/modules/auth";

export type PromoCodeStatus =
  | "active"
  | "inactive"
  | "expired"
  | "deleted";

export type PromoDiscountType = "percentage" | "fixed_amount";
export type PromoTargetType = "booking" | "private_booking" | "booking_order";
export type PromoPaymentMethod = "knet" | "card" | "wallet";
export type PromoCreatedByRole = "super_admin" | "admin" | "staff" | "system";
export type PromoSortField =
  | "created_at"
  | "updated_at"
  | "code"
  | "status"
  | "starts_at"
  | "ends_at"
  | "redemption_count";
export type PromoSortDirection = "asc" | "desc";
export type PromoRedemptionStatus =
  | "reserved"
  | "redeemed"
  | "released"
  | "voided";
export type PromoRedemptionSortField =
  | "created_at"
  | "reserved_at"
  | "redeemed_at"
  | "released_at"
  | "expires_at";

export type PromoTargets = {
  class_ids?: string[];
  customer_user_ids?: string[];
  schedule_ids?: string[];
  trainer_staff_profile_ids?: string[];
};

export type PromoUsage = {
  max_redemptions: number | null;
  per_user_limit: number | null;
  redemption_count: number;
  remaining_redemptions: number | null;
};

export type PromoCode = {
  admin_notes: string | null;
  allowed_payment_methods: PromoPaymentMethod[];
  allowed_target_types: PromoTargetType[];
  code: string;
  created_at: string;
  created_by_admin_id: string | null;
  created_by_role: PromoCreatedByRole | string | null;
  currency: "KWD";
  deleted_at: string | null;
  description: string | null;
  discount_type: PromoDiscountType;
  discount_value: number;
  ends_at: string | null;
  first_time_customer_only: boolean;
  id: string;
  max_discount_amount: number | null;
  max_redemptions: number | null;
  metadata: Record<string, unknown>;
  minimum_order_amount: number;
  per_user_limit: number | null;
  redemption_count: number;
  starts_at: string | null;
  status: PromoCodeStatus;
  targets: PromoTargets;
  updated_at: string;
  updated_by_admin_id: string | null;
  usage?: PromoUsage;
};

export type PromoCodeFilters = {
  created_by_admin_id?: string;
  created_by_role?: PromoCreatedByRole;
  discount_type?: PromoDiscountType;
  ends_from?: string;
  ends_to?: string;
  include_deleted?: boolean;
  limit: number;
  offset: number;
  payment_method?: PromoPaymentMethod;
  search?: string;
  sort_by: PromoSortField;
  sort_direction: PromoSortDirection;
  starts_from?: string;
  starts_to?: string;
  status?: PromoCodeStatus;
  target_type?: PromoTargetType;
};

export type PromoCodeListResult = {
  limit: number;
  offset: number;
  promo_codes: PromoCode[];
  total: number;
};

export type PromoCodeRedemption = {
  booking_id: string | null;
  booking_order_id: string | null;
  created_at: string;
  currency: string;
  discount: number;
  final: number | null;
  id: string;
  method: PromoPaymentMethod | string | null;
  payment_id: string;
  payment_number: string | null;
  private_booking_id: string | null;
  redeemed_at: string;
  status: "redeemed";
  subtotal: number | null;
  target_type: PromoTargetType | string | null;
  type: PromoTargetType | string | null;
  user_id: string | null;
};

export type PromoCodeRedemptionFilters = {
  booking_id?: string;
  booking_order_id?: string;
  from_date?: string;
  limit: number;
  offset: number;
  payment_id?: string;
  private_booking_id?: string;
  sort_by: PromoRedemptionSortField;
  sort_direction: PromoSortDirection;
  status?: PromoRedemptionStatus;
  target_type?: PromoTargetType;
  to_date?: string;
  user_id?: string;
};

export type PromoCodeRedemptionListResult = {
  limit: number;
  offset: number;
  redemptions: PromoCodeRedemption[];
  total: number;
};

export type UpdatePromoCodePayload = Partial<{
  admin_notes: string | null;
  allowed_payment_methods: PromoPaymentMethod[];
  allowed_target_types: PromoTargetType[];
  description: string | null;
  discount_type: PromoDiscountType;
  discount_value: number;
  ends_at: string | null;
  first_time_customer_only: boolean;
  max_discount_amount: number | null;
  max_redemptions: number | null;
  minimum_order_amount: number;
  per_user_limit: number | null;
  starts_at: string | null;
  status: PromoCodeStatus;
}>;

export type CreatePromoCodePayload = {
  admin_notes?: string | null;
  allowed_payment_methods?: PromoPaymentMethod[];
  allowed_target_types?: PromoTargetType[];
  code: string;
  currency?: "KWD";
  description?: string | null;
  discount_type: PromoDiscountType;
  discount_value: number;
  ends_at?: string | null;
  first_time_customer_only?: boolean;
  max_discount_amount?: number | null;
  max_redemptions?: number | null;
  metadata?: Record<string, unknown>;
  minimum_order_amount?: number | null;
  per_user_limit?: number | null;
  starts_at?: string | null;
  status?: PromoCodeStatus | "draft";
  target_ids?: PromoTargets;
};

type PromoListResponse = {
  limit: number;
  offset: number;
  promo_codes: PromoCode[];
  total: number;
};

type PromoMutationResponse = {
  promo_code: PromoCode;
};

function appendOptionalParams(
  params: URLSearchParams,
  filters: Array<[string, string | undefined]>,
): void {
  filters.forEach(([key, value]) => {
    if (value?.trim()) {
      params.set(key, value.trim());
    }
  });
}

function buildPromoCodeQuery(filters: PromoCodeFilters): string {
  const params = new URLSearchParams({
    limit: String(filters.limit),
    offset: String(filters.offset),
    sort_by: filters.sort_by,
    sort_direction: filters.sort_direction,
  });

  appendOptionalParams(params, [
    ["search", filters.search],
    ["status", filters.status],
    ["discount_type", filters.discount_type],
    ["target_type", filters.target_type],
    ["payment_method", filters.payment_method],
    ["created_by_admin_id", filters.created_by_admin_id],
    ["created_by_role", filters.created_by_role],
    ["starts_from", filters.starts_from],
    ["starts_to", filters.starts_to],
    ["ends_from", filters.ends_from],
    ["ends_to", filters.ends_to],
  ]);

  if (typeof filters.include_deleted === "boolean") {
    params.set("include_deleted", String(filters.include_deleted));
  }

  return params.toString();
}

function buildPromoCodeRedemptionsQuery(
  filters: PromoCodeRedemptionFilters,
): string {
  const params = new URLSearchParams({
    limit: String(filters.limit),
    offset: String(filters.offset),
    sort_by: filters.sort_by,
    sort_direction: filters.sort_direction,
  });

  appendOptionalParams(params, [
    ["booking_id", filters.booking_id],
    ["booking_order_id", filters.booking_order_id],
    ["from_date", filters.from_date],
    ["payment_id", filters.payment_id],
    ["private_booking_id", filters.private_booking_id],
    ["status", filters.status],
    ["target_type", filters.target_type],
    ["to_date", filters.to_date],
    ["user_id", filters.user_id],
  ]);

  return params.toString();
}

export const adminPromoCodesClient = {
  async activate(promoCodeId: string): Promise<PromoCode> {
    const response = await authFetch<ApiResponse<PromoMutationResponse>>(
      `/admin/promo-codes/${encodeURIComponent(promoCodeId)}/activate`,
      { method: "POST" },
    );

    return response.data.promo_code;
  },

  async delete(promoCodeId: string): Promise<void> {
    await authFetch<ApiResponse<unknown>>(
      `/admin/promo-codes/${encodeURIComponent(promoCodeId)}`,
      { method: "DELETE" },
    );
  },

  async create(payload: CreatePromoCodePayload): Promise<PromoCode> {
    const response = await authFetch<ApiResponse<PromoMutationResponse>>(
      "/admin/promo-codes",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );

    return response.data.promo_code;
  },

  async get(promoCodeId: string): Promise<PromoCode> {
    const response = await authFetch<ApiResponse<PromoCode>>(
      `/admin/promo-codes/${encodeURIComponent(promoCodeId)}`,
      { method: "GET" },
    );

    return response.data;
  },

  async list(filters: PromoCodeFilters): Promise<PromoCodeListResult> {
    const response = await authFetch<ApiResponse<PromoListResponse>>(
      `/admin/promo-codes?${buildPromoCodeQuery(filters)}`,
      { method: "GET" },
    );

    return response.data;
  },

  async listRedemptions(
    promoCodeId: string,
    filters: PromoCodeRedemptionFilters,
  ): Promise<PromoCodeRedemptionListResult> {
    const query = buildPromoCodeRedemptionsQuery(filters);
    const response = await authFetch<ApiResponse<PromoCodeRedemptionListResult>>(
      `/admin/promo-codes/${encodeURIComponent(promoCodeId)}/redemptions?${query}`,
      { method: "GET" },
    );

    return response.data;
  },

  async pause(promoCodeId: string): Promise<PromoCode> {
    const response = await authFetch<ApiResponse<PromoMutationResponse>>(
      `/admin/promo-codes/${encodeURIComponent(promoCodeId)}/pause`,
      { method: "POST" },
    );

    return response.data.promo_code;
  },

  async update(
    promoCodeId: string,
    payload: UpdatePromoCodePayload,
  ): Promise<PromoCode> {
    const response = await authFetch<ApiResponse<PromoMutationResponse>>(
      `/admin/promo-codes/${encodeURIComponent(promoCodeId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );

    return response.data.promo_code;
  },
};
