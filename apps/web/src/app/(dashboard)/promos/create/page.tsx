import { PermissionGuard } from "@/components/guards/PermissionGuard";
import { PromoCodeCreatePage } from "@/modules/promos/components/promo-code-management/PromoCodeCreatePage";

export default function CreatePromoCodePage() {
  return (
    <PermissionGuard route="/promos">
      <PromoCodeCreatePage />
    </PermissionGuard>
  );
}
