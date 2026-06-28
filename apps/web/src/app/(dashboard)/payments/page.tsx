import { PermissionGuard } from "@/components/guards/PermissionGuard";
import { AdminPaymentManager } from "@/modules/payments";

export default function PaymentsPage() {
  return (
    <PermissionGuard route="/payments">
      <AdminPaymentManager />
    </PermissionGuard>
  );
}
