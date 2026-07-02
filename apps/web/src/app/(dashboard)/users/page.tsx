import { PermissionGuard } from "@/components/guards/PermissionGuard";
import { AdminCustomerManager } from "@/modules/customers";

export default function UsersPage() {
  return (
    <PermissionGuard route="/users">
      <AdminCustomerManager />
    </PermissionGuard>
  );
}

