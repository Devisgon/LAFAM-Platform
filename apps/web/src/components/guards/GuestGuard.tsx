import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getServerSession } from "@/lib/auth/session";
export async function GuestGuard({ children }: { children: ReactNode }) { const session = await getServerSession(); if (session) redirect("/dashboard"); return children; }

