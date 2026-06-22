import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getServerSession } from "@/lib/auth/session";
import type { AppRole } from "@/types/auth.types";
export async function RoleGuard({ allowedRoles, children }: { allowedRoles: readonly AppRole[]; children: ReactNode }) { const session = await getServerSession(); if (!session) redirect("/login"); if (!allowedRoles.includes(session.role)) redirect("/unauthorized"); return children; }

