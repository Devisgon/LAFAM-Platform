import { PermissionGuard } from "@/components/guards/PermissionGuard";
import { AdminUserManager } from "@/modules/users";

export default function UsersPage() {
  return (
    <PermissionGuard route="/users">
      <AdminUserManager />
    </PermissionGuard>
  );
}

