import { type ApiResponse, authFetch } from "@/modules/auth";

export type WalletAccountStatus = "active" | "frozen" | "closed";

export type WalletLedgerEntryType =
  | "wallet_top_up"
  | "booking_payment"
  | "private_booking_payment"
  | "refund_credit"
  | "admin_adjustment_credit"
  | "admin_adjustment_debit";

export type AdminWalletAdjustmentEntryType =
  | "admin_adjustment_credit"
  | "admin_adjustment_debit";

export type WalletLedgerEntryStatus =
  | "pending"
  | "posted"
  | "reversed"
  | "failed";

export type AdminWalletSortField =
  | "created_at"
  | "updated_at"
  | "available_balance";

export type AdminWalletLedgerSortField = "created_at" | "amount";
export type AdminWalletSortDirection = "asc" | "desc";
export type WalletCurrency = "KWD";

export type AdminWalletFilters = {
  from_date?: string;
  limit: number;
  offset: number;
  sort_by: AdminWalletSortField;
  sort_direction: AdminWalletSortDirection;
  status?: WalletAccountStatus;
  to_date?: string;
  user_id?: string;
};

export type AdminWalletTransactionFilters = {
  entry_status?: WalletLedgerEntryStatus;
  entry_type?: WalletLedgerEntryType;
  from_date?: string;
  limit: number;
  offset: number;
  sort_by: AdminWalletLedgerSortField;
  sort_direction: AdminWalletSortDirection;
  to_date?: string;
  wallet_account_id?: string;
};

export type PaymentPaginatedResult<TItem> = {
  has_more: boolean;
  items: TItem[];
  limit: number;
  offset: number;
  total: number;
};

export type WalletAccountSummary = {
  available_balance: number;
  created_at: string;
  currency: WalletCurrency;
  id: string;
  pending_balance: number;
  realtime_version: number;
  status: WalletAccountStatus;
  updated_at: string;
  user_id: string;
};

export type WalletLedgerEntrySummary = {
  amount: number;
  balance_after: number;
  balance_before: number;
  booking_id: string | null;
  created_at: string;
  description: string | null;
  entry_status: WalletLedgerEntryStatus;
  entry_type: WalletLedgerEntryType;
  id: string;
  metadata: Record<string, unknown>;
  payment_id: string | null;
  private_booking_id: string | null;
  user_id: string;
  wallet_account_id: string;
};

export type AdminWalletAdjustmentPayload = {
  amount: number;
  entry_type: AdminWalletAdjustmentEntryType;
  idempotency_key?: string;
  metadata?: Record<string, unknown>;
  reason: string;
};

export type AdminWalletAdjustmentResult = {
  ledger_entry: WalletLedgerEntrySummary;
  wallet: WalletAccountSummary;
};

export type AdminWalletListResult = PaymentPaginatedResult<WalletAccountSummary>;
export type AdminWalletTransactionListResult =
  PaymentPaginatedResult<WalletLedgerEntrySummary>;

type AdminWalletListResponse = {
  wallets: AdminWalletListResult;
};

type AdminWalletResponse = {
  wallet: WalletAccountSummary;
};

type AdminWalletTransactionsResponse = {
  transactions: AdminWalletTransactionListResult;
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

function buildWalletListQuery(filters: AdminWalletFilters): string {
  const params = new URLSearchParams({
    limit: String(filters.limit),
    offset: String(filters.offset),
    sort_by: filters.sort_by,
    sort_direction: filters.sort_direction,
  });

  appendOptionalParams(params, [
    ["user_id", filters.user_id],
    ["status", filters.status],
    ["from_date", filters.from_date],
    ["to_date", filters.to_date],
  ]);

  return params.toString();
}

function buildTransactionListQuery(
  filters: AdminWalletTransactionFilters,
): string {
  const params = new URLSearchParams({
    limit: String(filters.limit),
    offset: String(filters.offset),
    sort_by: filters.sort_by,
    sort_direction: filters.sort_direction,
  });

  appendOptionalParams(params, [
    ["wallet_account_id", filters.wallet_account_id],
    ["entry_type", filters.entry_type],
    ["entry_status", filters.entry_status],
    ["from_date", filters.from_date],
    ["to_date", filters.to_date],
  ]);

  return params.toString();
}

export const adminWalletsClient = {
  async adjustByUserId(
    userId: string,
    payload: AdminWalletAdjustmentPayload,
  ): Promise<AdminWalletAdjustmentResult> {
    const response = await authFetch<ApiResponse<AdminWalletAdjustmentResult>>(
      `/admin/wallets/users/${encodeURIComponent(userId)}/adjust`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );

    return response.data;
  },

  async getByUserId(userId: string): Promise<WalletAccountSummary> {
    const response = await authFetch<ApiResponse<AdminWalletResponse>>(
      `/admin/wallets/users/${encodeURIComponent(userId)}`,
      { method: "GET" },
    );

    return response.data.wallet;
  },

  async getByWalletAccountId(
    walletAccountId: string,
  ): Promise<WalletAccountSummary> {
    const response = await authFetch<ApiResponse<AdminWalletResponse>>(
      `/admin/wallets/${encodeURIComponent(walletAccountId)}`,
      { method: "GET" },
    );

    return response.data.wallet;
  },

  async list(filters: AdminWalletFilters): Promise<AdminWalletListResult> {
    const response = await authFetch<ApiResponse<AdminWalletListResponse>>(
      `/admin/wallets?${buildWalletListQuery(filters)}`,
      { method: "GET" },
    );

    return response.data.wallets;
  },

  async listTransactionsByUserId(
    userId: string,
    filters: AdminWalletTransactionFilters,
  ): Promise<AdminWalletTransactionListResult> {
    const response = await authFetch<ApiResponse<AdminWalletTransactionsResponse>>(
      `/admin/wallets/users/${encodeURIComponent(userId)}/transactions?${buildTransactionListQuery(filters)}`,
      { method: "GET" },
    );

    return response.data.transactions;
  },
};
