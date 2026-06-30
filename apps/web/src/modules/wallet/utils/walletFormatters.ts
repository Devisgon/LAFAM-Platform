import type { AdminUser } from "@/modules/users";

import type { WalletAccountStatus } from "../api/adminWalletApi";

export function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

export function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat("en", {
    currency: "KWD",
    maximumFractionDigits: 3,
    minimumFractionDigits: 3,
    style: "currency",
  }).format(value);
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The wallet request failed.";
}

export function getUserDisplayName(user?: AdminUser): string {
  if (!user) return "Unknown user";

  return (
    user.full_name ?? user.email ?? user.phone ?? `User ${user.id.slice(0, 8)}`
  );
}

export function getUserOptionLabel(user: AdminUser): string {
  const name = getUserDisplayName(user);

  if (user.email && user.email !== name) return `${name} - ${user.email}`;
  if (user.phone && user.phone !== name) return `${name} - ${user.phone}`;

  return name;
}

export function getWalletUserName(
  userId: string,
  usersById: Map<string, AdminUser>,
): string {
  const user = usersById.get(userId);

  return user ? getUserDisplayName(user) : `User ${userId.slice(0, 8)}`;
}

export function walletStatusTone(
  status: WalletAccountStatus,
): "neutral" | "info" | "success" | "warning" | "error" {
  if (status === "active") return "success";
  if (status === "frozen") return "warning";
  return "neutral";
}
