import { type ApiResponse, authFetch } from "@/modules/auth";
import { ENDPOINTS } from "@/lib/api/endpoints";

export type PaymentCurrency = "KWD";
export type PaymentTargetType = "booking" | "private_booking" | "wallet_top_up";
export type PaymentMethod = "knet" | "card" | "wallet";
export type PaymentProvider =
  | "mock"
  | "knet"
  | "tap"
  | "myfatoorah"
  | "checkout"
  | "wallet"
  | "manual";

export type PaymentStatus =
  | "pending"
  | "requires_redirect"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled"
  | "expired"
  | "refund_requested"
  | "refund_processing"
  | "manual_refund_required"
  | "refunded";

export type PaymentTransactionType =
  | "intent_created"
  | "provider_request"
  | "provider_response"
  | "callback_received"
  | "webhook_received"
  | "verification"
  | "status_change"
  | "wallet_debit"
  | "wallet_credit"
  | "refund_requested"
  | "refund_processed"
  | "refund_failed";

export type PaymentTransactionStatus =
  | "pending"
  | "succeeded"
  | "failed"
  | "ignored";

export type PaymentSortField =
  | "created_at"
  | "updated_at"
  | "final_amount"
  | "paid_at";

export type PaymentTransactionSortField = "created_at" | "processed_at";
export type PaymentSortDirection = "asc" | "desc";

export type AdminPaymentFilters = {
  booking_id?: string;
  from_date?: string;
  limit: number;
  offset: number;
  payment_method?: PaymentMethod;
  payment_provider?: PaymentProvider;
  private_booking_id?: string;
  sort_by: PaymentSortField;
  sort_direction: PaymentSortDirection;
  status?: PaymentStatus;
  target_type?: PaymentTargetType;
  to_date?: string;
  user_id?: string;
};

export type AdminPaymentTransactionFilters = {
  limit: number;
  offset: number;
  sort_by: PaymentTransactionSortField;
  sort_direction: PaymentSortDirection;
  transaction_status?: PaymentTransactionStatus;
  transaction_type?: PaymentTransactionType;
};

export type PaymentPaginatedResult<TItem> = {
  has_more: boolean;
  items: TItem[];
  limit: number;
  offset: number;
  total: number;
};

export type PaymentSummary = {
  amount: number;
  booking_id: string | null;
  cancelled_at: string | null;
  created_at: string;
  currency: PaymentCurrency;
  discount_amount: number;
  expired_at: string | null;
  expires_at: string | null;
  failed_at: string | null;
  final_amount: number;
  id: string;
  paid_at: string | null;
  payment_method: PaymentMethod;
  payment_number: string;
  payment_provider: PaymentProvider;
  private_booking_id: string | null;
  receipt_number: string | null;
  realtime_version: number;
  redirect_url: string | null;
  refunded_amount: number;
  refunded_at: string | null;
  status: PaymentStatus;
  target_type: PaymentTargetType;
  updated_at: string;
  user_id: string;
};

export type PaymentTransactionSummary = {
  created_at: string;
  failure_code: string | null;
  failure_message: string | null;
  id: string;
  metadata: Record<string, unknown>;
  payment_id: string;
  processed_at: string | null;
  provider: PaymentProvider;
  provider_reference: string | null;
  transaction_status: PaymentTransactionStatus;
  transaction_type: PaymentTransactionType;
};

export type PaymentDiscountSummary = {
  code: string;
  created_at: string;
  discount_amount: number;
  id: string;
  metadata: Record<string, unknown>;
  payment_id: string;
  promo_code_id: string | null;
};

export type PaymentDetail = PaymentSummary & {
  discounts?: PaymentDiscountSummary[];
  failure_code: string | null;
  failure_message: string | null;
  gateway_invoice_id: string | null;
  gateway_payment_id: string | null;
  gateway_reference: string | null;
  metadata: Record<string, unknown>;
  transactions?: PaymentTransactionSummary[];
  webhook_verified_at: string | null;
};

export type AdminPaymentListResult = PaymentPaginatedResult<PaymentSummary>;
export type AdminPaymentTransactionListResult =
  PaymentPaginatedResult<PaymentTransactionSummary>;

export type RefundPaymentPayload = {
  idempotency_key?: string;
  metadata?: Record<string, unknown>;
  reason: string;
  refund_amount?: number;
};

export type CustomerCheckoutPaymentPayload = {
  booking_id?: string;
  idempotency_key?: string;
  payment_method: PaymentMethod;
  private_booking_id?: string;
  target_type: PaymentTargetType;
};

export type CustomerPaymentSortField =
  | "created_at"
  | "updated_at"
  | "final_amount"
  | "paid_at";

export type CustomerPaymentTransactionSortField = "created_at" | "processed_at";

export type CustomerPaymentFilters = {
  from_date?: string;
  limit: number;
  offset: number;
  sort_by: CustomerPaymentSortField;
  sort_direction: PaymentSortDirection;
  status?: PaymentStatus;
  target_type?: PaymentTargetType;
  to_date?: string;
};

export type CustomerPaymentTransactionFilters = {
  limit: number;
  offset: number;
  sort_by: CustomerPaymentTransactionSortField;
  sort_direction: PaymentSortDirection;
  transaction_status?: PaymentTransactionStatus;
  transaction_type?: PaymentTransactionType;
};

export type CustomerWalletAccount = {
  available_balance: number;
  created_at: string;
  currency: PaymentCurrency;
  id: string;
  pending_balance: number;
  realtime_version: number;
  status: string;
  updated_at: string;
  user_id: string;
};

export type CustomerPaymentReceipt = {
  amount: number;
  currency: PaymentCurrency;
  discount_amount: number;
  final_amount: number;
  paid_at: string | null;
  payment_id: string;
  payment_method: PaymentMethod;
  payment_number: string;
  payment_provider: PaymentProvider;
  receipt_number: string | null;
  target_type: PaymentTargetType;
  user_id: string;
};

export type CustomerCheckoutPaymentResult = {
  payment: PaymentSummary;
  redirect_url: string | null;
  requires_redirect: boolean;
  wallet_account?: CustomerWalletAccount | null;
};

export type CustomerVerifyPaymentResult = {
  payment: PaymentSummary;
  receipt?: CustomerPaymentReceipt | null;
};

export type CustomerPaymentDetail = PaymentSummary &
  Partial<Omit<PaymentDetail, keyof PaymentSummary>> & {
    receipt?: CustomerPaymentReceipt | null;
  };

export type CustomerPaymentListResult =
  PaymentPaginatedResult<PaymentSummary>;
export type CustomerPaymentTransactionListResult =
  PaymentPaginatedResult<PaymentTransactionSummary>;

type PaymentListResponse = {
  payments: AdminPaymentListResult;
};

type PaymentDetailResponse = {
  payment: PaymentDetail;
};

type PaymentRefundResponse = {
  payment: PaymentSummary;
};

type ExpireUnpaidResponse = {
  expired_payments: PaymentSummary[];
};

type CustomerCheckoutPaymentResponse = CustomerCheckoutPaymentResult;
type CustomerPaymentDetailResponse = {
  payment: CustomerPaymentDetail;
};
type CustomerPaymentListResponse = {
  payments: CustomerPaymentListResult;
};
type CustomerPaymentTransactionListResponse = {
  transactions: CustomerPaymentTransactionListResult;
};
type CustomerVerifyPaymentResponse = CustomerVerifyPaymentResult;

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

function buildPaymentListQuery(filters: AdminPaymentFilters): string {
  const params = new URLSearchParams({
    limit: String(filters.limit),
    offset: String(filters.offset),
    sort_by: filters.sort_by,
    sort_direction: filters.sort_direction,
  });

  appendOptionalParams(params, [
    ["user_id", filters.user_id],
    ["target_type", filters.target_type],
    ["booking_id", filters.booking_id],
    ["private_booking_id", filters.private_booking_id],
    ["payment_method", filters.payment_method],
    ["payment_provider", filters.payment_provider],
    ["status", filters.status],
    ["from_date", filters.from_date],
    ["to_date", filters.to_date],
  ]);

  return params.toString();
}

function buildPaymentTransactionQuery(
  filters: AdminPaymentTransactionFilters,
): string {
  const params = new URLSearchParams({
    limit: String(filters.limit),
    offset: String(filters.offset),
    sort_by: filters.sort_by,
    sort_direction: filters.sort_direction,
  });

  appendOptionalParams(params, [
    ["transaction_type", filters.transaction_type],
    ["transaction_status", filters.transaction_status],
  ]);

  return params.toString();
}

function buildCustomerPaymentListQuery(filters: CustomerPaymentFilters): string {
  const params = new URLSearchParams({
    limit: String(filters.limit),
    offset: String(filters.offset),
    sort_by: filters.sort_by,
    sort_direction: filters.sort_direction,
  });

  appendOptionalParams(params, [
    ["target_type", filters.target_type],
    ["status", filters.status],
    ["from_date", filters.from_date],
    ["to_date", filters.to_date],
  ]);

  return params.toString();
}

function buildCustomerPaymentTransactionQuery(
  filters: CustomerPaymentTransactionFilters,
): string {
  const params = new URLSearchParams({
    limit: String(filters.limit),
    offset: String(filters.offset),
    sort_by: filters.sort_by,
    sort_direction: filters.sort_direction,
  });

  appendOptionalParams(params, [
    ["transaction_type", filters.transaction_type],
    ["transaction_status", filters.transaction_status],
  ]);

  return params.toString();
}

export const adminPaymentsClient = {
  async expireUnpaid(): Promise<PaymentSummary[]> {
    const response = await authFetch<ApiResponse<ExpireUnpaidResponse>>(
      "/admin/payments/expire-unpaid",
      { method: "POST" },
    );

    return response.data.expired_payments;
  },

  async get(paymentId: string): Promise<PaymentDetail> {
    const response = await authFetch<ApiResponse<PaymentDetailResponse>>(
      `/admin/payments/${encodeURIComponent(paymentId)}`,
      { method: "GET" },
    );

    return response.data.payment;
  },

  async list(filters: AdminPaymentFilters): Promise<AdminPaymentListResult> {
    const response = await authFetch<ApiResponse<PaymentListResponse>>(
      `/admin/payments?${buildPaymentListQuery(filters)}`,
      { method: "GET" },
    );

    return response.data.payments;
  },

  async listTransactions(
    paymentId: string,
    filters: AdminPaymentTransactionFilters,
  ): Promise<AdminPaymentTransactionListResult> {
    const response = await authFetch<
      ApiResponse<AdminPaymentTransactionListResult>
    >(
      `/admin/payments/${encodeURIComponent(paymentId)}/transactions?${buildPaymentTransactionQuery(filters)}`,
      { method: "GET" },
    );

    return response.data;
  },

  async refund(
    paymentId: string,
    payload: RefundPaymentPayload,
  ): Promise<PaymentSummary> {
    const response = await authFetch<ApiResponse<PaymentRefundResponse>>(
      `/admin/payments/${encodeURIComponent(paymentId)}/refund`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );

    return response.data.payment;
  },
};

export const customerPaymentsClient = {
  async checkout(
    payload: CustomerCheckoutPaymentPayload,
  ): Promise<CustomerCheckoutPaymentResult> {
    const response = await authFetch<ApiResponse<CustomerCheckoutPaymentResponse>>(
      ENDPOINTS.CUSTOMER_PAYMENTS.CHECKOUT,
      { method: "POST", body: JSON.stringify(payload) },
    );

    return response.data;
  },

  async get(paymentId: string): Promise<CustomerPaymentDetail> {
    const response = await authFetch<ApiResponse<CustomerPaymentDetailResponse>>(
      ENDPOINTS.CUSTOMER_PAYMENTS.DETAIL(paymentId),
      { method: "GET" },
    );

    return response.data.payment;
  },

  async list(filters: CustomerPaymentFilters): Promise<CustomerPaymentListResult> {
    const response = await authFetch<ApiResponse<CustomerPaymentListResponse>>(
      `${ENDPOINTS.CUSTOMER_PAYMENTS.LIST}?${buildCustomerPaymentListQuery(filters)}`,
      { method: "GET" },
    );

    return response.data.payments;
  },

  async listTransactions(
    paymentId: string,
    filters: CustomerPaymentTransactionFilters,
  ): Promise<CustomerPaymentTransactionListResult> {
    const response = await authFetch<
      ApiResponse<CustomerPaymentTransactionListResponse>
    >(
      `${ENDPOINTS.CUSTOMER_PAYMENTS.TRANSACTIONS(paymentId)}?${buildCustomerPaymentTransactionQuery(filters)}`,
      { method: "GET" },
    );

    return response.data.transactions;
  },

  async verify(paymentId: string): Promise<CustomerVerifyPaymentResult> {
    const response = await authFetch<ApiResponse<CustomerVerifyPaymentResponse>>(
      ENDPOINTS.CUSTOMER_PAYMENTS.VERIFY(paymentId),
      { method: "POST" },
    );

    return response.data;
  },
};
