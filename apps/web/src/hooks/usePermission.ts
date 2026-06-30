import {
  ADMIN_ROUTE_ACCESS,
  ROLE_PERMISSIONS,
  type AdminRouteKey,
} from "@/constants/permissions";
import type { AppRole } from "@/types/auth.types";

type PermissionContext = {
  access: {
    can_access_admin_dashboard: boolean;
    can_access_staff_dashboard: boolean;
  };
  permissions: readonly string[];
};

export function usePermission(
  role: AppRole | null | undefined,
  permission: string,
): boolean {
  return role ? ROLE_PERMISSIONS[role].includes(permission) : false;
}

export function hasAnyPermission(
  context: Pick<PermissionContext, "permissions">,
  permissions: readonly string[],
): boolean {
  if (permissions.length === 0) return true;

  const permissionSet = new Set(context.permissions);

  return permissions.some((permission) => permissionSet.has(permission));
}

export function hasRoutePermission(
  context: PermissionContext,
  route: AdminRouteKey,
): boolean {
  if (context.access.can_access_admin_dashboard) return true;

  return hasAnyPermission(context, ADMIN_ROUTE_ACCESS[route].anyPermissions);
}

export function canEnterDashboardShell(context: PermissionContext): boolean {
  return (
    context.access.can_access_admin_dashboard ||
    context.access.can_access_staff_dashboard
  );
}
