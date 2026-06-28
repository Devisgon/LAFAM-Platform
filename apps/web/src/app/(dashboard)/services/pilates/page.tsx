import { PermissionGuard } from "@/components/guards/PermissionGuard";
import { PilatesClassManager } from "@/modules/services/pilates";

export default function PilatesPage() {
  return (
    <PermissionGuard route="/services/pilates">
      <PilatesClassManager />
    </PermissionGuard>
  );
}
