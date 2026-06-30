// apps/web/src/constants/permissions.ts
/**
 * LAFAM frontend permission and route-access constants.
 *
 * Role:
 * - Defines dashboard route access used by PermissionGuard, Sidebar, and admin-access helpers.
 * - Keeps frontend route visibility aligned with backend /auth/context permissions.
 * - Allows staff and trainer to access approved operational dashboard routes.
 * - Keeps payment, wallet, and user-management routes locked until backend access is explicitly expanded.
 *
 * Important:
 * - Frontend permissions are usability gates only.
 * - Backend guards and services remain the real authorization authority.
 * - Do not open a route here unless the backend route is already implemented for that role.
 * - Staff and trainer are not treated as admin roles.
 * - Staff and trainer access must come from granular permissions returned by /auth/context.
 */

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

export const OPERATIONAL_DASHBOARD_ROUTES = [
  ROUTES.DASHBOARD,
  ROUTES.BOOKINGS,
  ROUTES.CALENDAR,
  ROUTES.PILATES,
  ROUTES.STAFF,
  ROUTES.SETTINGS,
] as const;

export const ADMIN_ONLY_ROUTES = [
  ROUTES.PAYMENTS,
  ROUTES.USERS,
  ROUTES.WALLET,
] as const;

export const ROLE_PERMISSIONS: Readonly<Record<AppRole, readonly string[]>> = {
  super_admin: [...OPERATIONAL_DASHBOARD_ROUTES, ...ADMIN_ONLY_ROUTES],
  admin: [...OPERATIONAL_DASHBOARD_ROUTES, ...ADMIN_ONLY_ROUTES],
  trainer: [...OPERATIONAL_DASHBOARD_ROUTES],
  staff: [...OPERATIONAL_DASHBOARD_ROUTES],
  stylist: [],
  customer: [],
  user: [],
  guest: [],
};

export const ADMIN_ROUTE_ACCESS: Record<AdminRouteKey, AdminRouteAccess> = {
  "/dashboard": {
    anyPermissions: ["admin:analytics:read"],
    lockedLabel: "Analytics dashboard access required",
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
    anyPermissions: [
      "admin:pilates:classes:read",
      "admin:pilates:schedules:read",
    ],
    lockedLabel: "Pilates management access required",
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
    anyPermissions: ["admin:staff:read"],
    lockedLabel: "Staff directory access required",
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
