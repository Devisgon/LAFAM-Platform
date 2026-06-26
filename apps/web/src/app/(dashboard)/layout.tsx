import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { getServerSession, isAdminRole } from "@/lib/auth/session";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession();

  if (!session) redirect("/login");
  if (!isAdminRole(session.role)) redirect("/unauthorized");

  return <DashboardShell>{children}</DashboardShell>;
}
