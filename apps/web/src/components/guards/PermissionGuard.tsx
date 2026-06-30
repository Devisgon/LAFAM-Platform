import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  ADMIN_ROUTE_ACCESS,
  type AdminRouteKey,
} from "@/constants/permissions";
import { hasRoutePermission } from "@/hooks/usePermission";
import { getServerAuthContext } from "@/lib/auth/auth-context";
import { AccessDeniedPanel } from "./AccessDeniedPanel";

export async function PermissionGuard({
  children,
  route,
}: {
  children: ReactNode;
  route: AdminRouteKey;
}) {
  const context = await getServerAuthContext();

  if (!context) {
    redirect("/login");
  }

  if (!hasRoutePermission(context, route)) {
    return (
      <AccessDeniedPanel
        description={ADMIN_ROUTE_ACCESS[route].lockedLabel}
        title="You do not have access to this page"
      />
    );
  }

  return children;
}
