import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { canEnterDashboardShell } from "@/lib/auth/admin-access";
import { getServerAuthContext } from "@/lib/auth/auth-context";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const context = await getServerAuthContext();

  if (!context) redirect("/login");
  if (!canEnterDashboardShell(context)) redirect("/unauthorized");

  return <DashboardShell authContext={context}>{children}</DashboardShell>;
}
