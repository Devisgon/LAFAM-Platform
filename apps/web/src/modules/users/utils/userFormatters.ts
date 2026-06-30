import type { AdminUser } from "../api/usersApi";

export function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

export function usernameFromUser(user: AdminUser): string {
  return user.email?.split("@")[0] || user.phone || user.id.slice(0, 8);
}

export function isActiveUser(user: AdminUser): boolean {
  return user.status !== "deactivated" && user.status !== "deleted";
}
