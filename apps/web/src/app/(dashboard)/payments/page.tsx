import { RoleGuard } from "@/components/guards";
import { AdminPaymentManager } from "@/modules/payments";
export default function PaymentsPage() { return <RoleGuard allowedRoles={["admin", "super_admin"]}><AdminPaymentManager /></RoleGuard>; }
