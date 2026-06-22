import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { getServerSession } from "@/lib/auth/session";
export default async function DashboardLayout({ children }: { children: ReactNode }) { const session = await getServerSession(); if (!session) redirect("/login"); return <DashboardShell role={session.role}>{children}</DashboardShell>; }

