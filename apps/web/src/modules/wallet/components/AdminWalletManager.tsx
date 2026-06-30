"use client";

import { useMemo, useState } from "react";
import { useAdminUsers, type AdminUserFilters } from "@/modules/users";

import type { WalletAccountSummary } from "../api/adminWalletApi";
import type { WalletView } from "../types/walletUi.types";
import { getUserOptionLabel } from "../utils/walletFormatters";
import { WalletListPanel } from "./wallet-management/WalletListPanel";
import { WalletTransactionsPanel } from "./wallet-management/WalletTransactionsPanel";

export function AdminWalletManager() {
  const userFilters = useMemo<AdminUserFilters>(() => ({}), []);
  const {
    users,
    error: usersError,
    isLoading: areUsersLoading,
  } = useAdminUsers(userFilters);
  const usersById = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users],
  );
  const userOptions = useMemo(
    () => users.map((user) => [user.id, getUserOptionLabel(user)] as const),
    [users],
  );
  const [view, setView] = useState<WalletView>("wallets");
  const [transactionUserId, setTransactionUserId] = useState("");
  const [transactionWalletId, setTransactionWalletId] = useState("");

  const openTransactions = (wallet?: WalletAccountSummary) => {
    setTransactionUserId(wallet?.user_id ?? "");
    setTransactionWalletId(wallet?.id ?? "");
    setView("transactions");
  };

  if (view === "transactions") {
    return (
      <WalletTransactionsPanel
        areUsersLoading={areUsersLoading}
        initialUserId={transactionUserId}
        initialWalletId={transactionWalletId}
        onBack={() => setView("wallets")}
        userOptions={userOptions}
        usersById={usersById}
        usersError={usersError}
      />
    );
  }

  return (
    <WalletListPanel
      areUsersLoading={areUsersLoading}
      onOpenTransactions={openTransactions}
      userOptions={userOptions}
      usersById={usersById}
      usersError={usersError}
    />
  );
}
