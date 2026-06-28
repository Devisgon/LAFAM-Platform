import { PermissionGuard } from "@/components/guards/PermissionGuard";
import { PilatesClassDetailManager } from "@/modules/services/pilates";

export default async function PilatesClassPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;

  return (
    <PermissionGuard route="/services/pilates">
      <PilatesClassDetailManager classId={classId} />
    </PermissionGuard>
  );
}
