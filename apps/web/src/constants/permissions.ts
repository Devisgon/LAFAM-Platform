import { ROUTES } from "./routes";
import type { AppRole } from "@/types/auth.types";

export type AdminRouteKey =
  | "/dashboard"
  | "/bookings"
  | "/calendar"
  | "/services/pilates"
  | "/settings/customers"
  | "/settings"
  | "/staff"
  | "/users"
  | "/payments"
  | "/wallet";

export type AdminRouteAccess = {
  anyPermissions: readonly string[];
  lockedLabel: string;
};

export const ADMIN_ROLES: ReadonlySet<AppRole> = new Set([
  "admin",
  "super_admin",
]);

export const ADMIN_ONLY_ROUTES = [
  ROUTES.CALENDAR,
  ROUTES.PAYMENTS,
  ROUTES.STAFF,
  ROUTES.USERS,
] as const;

export const ROLE_PERMISSIONS: Readonly<Record<AppRole, readonly string[]>> = {
  super_admin: [...ADMIN_ONLY_ROUTES],
  admin: [...ADMIN_ONLY_ROUTES],
  trainer: [],
  stylist: [],
  staff: [],
  customer: [],
  user: [],
  guest: [],
};

export const ADMIN_ROUTE_ACCESS: Record<AdminRouteKey, AdminRouteAccess> = {
  "/dashboard": {
    anyPermissions: ["admin:access_dashboard"],
    lockedLabel: "Admin dashboard access required",
  },
  "/bookings": {
    anyPermissions: ["admin:bookings:read"],
    lockedLabel: "Booking access required",
  },
  "/calendar": {
    anyPermissions: ["admin:bookings:calendar"],
    lockedLabel: "Booking calendar access required",
  },
  "/services/pilates": {
    anyPermissions: ["admin:access_dashboard"],
    lockedLabel: "Admin service access required",
  },
  "/settings/customers": {
    anyPermissions: ["admin:customers:read"],
    lockedLabel: "Customer access required",
  },
  "/settings": {
    anyPermissions: ["profile:read"],
    lockedLabel: "Profile access required",
  },
  "/staff": {
    anyPermissions: ["admin:access_dashboard"],
    lockedLabel: "Admin staff access required",
  },
  "/users": {
    anyPermissions: ["admin:users:read"],
    lockedLabel: "User management access required",
  },
  "/payments": {
    anyPermissions: ["admin:access_dashboard"],
    lockedLabel: "Admin payment access required",
  },
  "/wallet": {
    anyPermissions: ["admin:access_dashboard"],
    lockedLabel: "Admin wallet access required",
  },
};

export function isAdminRole(
  role: string | null | undefined,
): role is "admin" | "super_admin" {
  return role === "admin" || role === "super_admin";
}
