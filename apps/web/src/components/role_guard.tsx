import { redirect } from "next/navigation";
import { getAuthenticatedRole, roleHomes, type UserRole } from "@/lib/auth";

export async function RoleGuard({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  requiredRole: UserRole;
}) {
  const role = await getAuthenticatedRole();

  if (role !== requiredRole) {
    redirect(roleHomes[role]);
  }

  return children;
}
