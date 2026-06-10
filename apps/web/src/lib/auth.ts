import "server-only";

import { cookies } from "next/headers";

export type UserRole = "admin" | "staff" | "user";

export const roleHomes: Record<UserRole, string> = {
  admin: "/admin",
  staff: "/staff",
  user: "/user",
};

function isUserRole(value: string | undefined): value is UserRole {
  return value === "admin" || value === "staff" || value === "user";
}

export async function getAuthenticatedRole(): Promise<UserRole> {
  const cookieStore = await cookies();
  const role = cookieStore.get("lafam-role")?.value;

  // Replace this fallback when the auth provider starts issuing verified sessions.
  return isUserRole(role) ? role : "admin";
}

export async function getAuthenticatedHome() {
  return roleHomes[await getAuthenticatedRole()];
}
