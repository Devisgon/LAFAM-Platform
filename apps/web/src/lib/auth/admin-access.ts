export {
  ADMIN_ROUTE_ACCESS,
  type AdminRouteAccess,
  type AdminRouteKey,
} from "@/constants/permissions";
export {
  canEnterDashboardShell,
  hasAnyPermission,
  hasRoutePermission as hasAdminRouteAccess,
} from "@/hooks/usePermission";
