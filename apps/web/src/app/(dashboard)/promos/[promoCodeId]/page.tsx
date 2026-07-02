import { PermissionGuard } from "@/components/guards/PermissionGuard";
import { PromoCodeDetailPage } from "@/modules/promos";

export default async function PromoCodeDetailRoute({
  params,
}: {
  params: Promise<{ promoCodeId: string }>;
}) {
  const { promoCodeId } = await params;

  return (
    <PermissionGuard route="/promos">
      <PromoCodeDetailPage promoCodeId={promoCodeId} />
    </PermissionGuard>
  );
}
