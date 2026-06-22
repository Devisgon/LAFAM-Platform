import { cookies } from "next/headers";
import { isAdminRole } from "@/constants/permissions";
import type { AppRole, AppSession } from "@/types/auth.types";
const ROLES: ReadonlySet<string> = new Set(["super_admin", "admin", "trainer", "stylist", "staff", "customer", "user", "guest"]);
export async function getServerSession(): Promise<AppSession | null> { const store = await cookies(); const accessToken = store.get("lafam_access_token")?.value; const role = store.get("lafam_role")?.value; if (!accessToken || !role || !ROLES.has(role)) return null; return { accessToken, role: role as AppRole }; }
export function getDashboardPath(): string { return "/dashboard"; }
export { isAdminRole };

