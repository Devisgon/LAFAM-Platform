import type { AuthContextData, AuthPermission } from "@/lib/auth/auth-context";

export type AdminRouteKey =
  | "/dashboard"
  | "/bookings"
  | "/calendar"
  | "/services/pilates"
  | "/settings"
  | "/settings/customers"
  | "/staff"
  | "/users"
  | "/payments"
  | "/wallet";

export type AdminRouteAccess = {
  anyPermissions: readonly AuthPermission[];
  lockedLabel: string;
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
  "/settings": {
    anyPermissions: ["profile:read"],
    lockedLabel: "Profile access required",
  },
  "/settings/customers": {
    anyPermissions: ["admin:customers:read"],
    lockedLabel: "Customer access required",
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

export function hasAnyPermission(
  context: Pick<AuthContextData, "permissions">,
  permissions: readonly AuthPermission[],
): boolean {
  if (permissions.length === 0) return true;

  const permissionSet = new Set(context.permissions);

  return permissions.some((permission) => permissionSet.has(permission));
}

export function hasAdminRouteAccess(
  context: AuthContextData,
  route: AdminRouteKey,
): boolean {
  if (context.access.can_access_admin_dashboard) {
    return true;
  }

  return hasAnyPermission(context, ADMIN_ROUTE_ACCESS[route].anyPermissions);
}

export function canEnterDashboardShell(context: AuthContextData): boolean {
  return (
    context.access.can_access_admin_dashboard ||
    context.access.can_access_staff_dashboard
  );
}
