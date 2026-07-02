import { PermissionGuard } from "@/components/guards/PermissionGuard";
import { AdminPromoCodeManager } from "@/modules/promos";

export default function PromoCodesPage() {
  return (
    <PermissionGuard route="/promos">
      <AdminPromoCodeManager />
    </PermissionGuard>
  );
}
