import { ROUTES } from "./routes";
import type { AppRole } from "@/types/auth.types";
export const ADMIN_ROLES: ReadonlySet<AppRole> = new Set(["admin", "super_admin"]);
export const ADMIN_ONLY_ROUTES = [ROUTES.CALENDAR, ROUTES.PAYMENTS, ROUTES.STAFF, ROUTES.USERS] as const;
export const ROLE_PERMISSIONS: Readonly<Record<AppRole, readonly string[]>> = {
  super_admin: [...ADMIN_ONLY_ROUTES], admin: [...ADMIN_ONLY_ROUTES], trainer: [], stylist: [], staff: [], customer: [], user: [], guest: [],
};
export function isAdminRole(role: string | null | undefined): role is "admin" | "super_admin" { return role === "admin" || role === "super_admin"; }

