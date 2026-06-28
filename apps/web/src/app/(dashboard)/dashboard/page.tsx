import { PermissionGuard } from "@/components/guards/PermissionGuard";
import { AdminDashboard } from "@/modules/dashboard";

export default function DashboardPage() {
  return (
    <PermissionGuard route="/dashboard">
      <AdminDashboard />
    </PermissionGuard>
  );
}
