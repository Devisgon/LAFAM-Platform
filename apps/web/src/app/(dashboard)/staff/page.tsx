import { PermissionGuard } from "@/components/guards/PermissionGuard";
import { getServerAuthContext } from "@/lib/auth/auth-context";
import { StaffDirectory } from "@/modules/staff";

export default async function StaffPage() {
  const context = await getServerAuthContext();

  return (
    <PermissionGuard route="/staff">
      <StaffDirectory currentRole={context?.user.role ?? null} />
    </PermissionGuard>
  );
}
