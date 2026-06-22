import { type ApiResponse, authFetch } from "@/lib/auth/auth";

export type WalletEntryType =
  | "wallet_top_up"
  | "booking_payment"
  | "private_booking_payment"
  | "refund_credit"
  | "admin_adjustment_credit"
  | "admin_adjustment_debit";
export type WalletEntryStatus = "pending" | "posted" | "reversed" | "failed";
export type WalletSortField = "created_at" | "amount";
export type WalletSortDirection = "asc" | "desc";

export type UserWallet = {
  id: string;
  user_id: string;
  currency: "KWD";
  available_balance: number;
  pending_balance: number;
  status: "active" | "frozen" | "closed";
  created_at: string;
  updated_at: string;
  realtime_version: number;
};

export type UserWalletTransaction = {
  id: string;
  wallet_account_id: string;
  user_id: string;
  payment_id: string | null;
  booking_id: string | null;
  private_booking_id: string | null;
  entry_type: WalletEntryType;
  entry_status: WalletEntryStatus;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type UserWalletTransactionFilters = {
  entry_type?: WalletEntryType;
  entry_status?: WalletEntryStatus;
  from_date?: string;
  to_date?: string;
  limit: number;
  offset: number;
  sort_by: WalletSortField;
  sort_direction: WalletSortDirection;
};

export type UserWalletTransactionList = {
  items: UserWalletTransaction[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
};

function transactionQuery(filters: UserWalletTransactionFilters): string {
  const query = new URLSearchParams({
    limit: String(filters.limit),
    offset: String(filters.offset),
    sort_by: filters.sort_by,
    sort_direction: filters.sort_direction,
  });

  for (const [key, value] of Object.entries(filters)) {
    if (typeof value === "string" && value.trim()) query.set(key, value.trim());
  }

  return query.toString();
}

export const userWalletClient = {
  async get(signal?: AbortSignal): Promise<UserWallet> {
    const response = await authFetch<ApiResponse<{ wallet: UserWallet }>>(
      "/wallet",
      { method: "GET", signal },
    );
    return response.data.wallet;
  },

  async listTransactions(
    filters: UserWalletTransactionFilters,
    signal?: AbortSignal,
  ): Promise<UserWalletTransactionList> {
    const response = await authFetch<
      ApiResponse<{ transactions: UserWalletTransactionList }>
    >(`/wallet/transactions?${transactionQuery(filters)}`, {
      method: "GET",
      signal,
    });
    return response.data.transactions;
  },

  async getTransaction(id: string, signal?: AbortSignal) {
    const response = await authFetch<
      ApiResponse<{ transaction: UserWalletTransaction }>
    >(`/wallet/transactions/${encodeURIComponent(id)}`, {
      method: "GET",
      signal,
    });
    return response.data.transaction;
  },
};
