import { PermissionGuard } from "@/components/guards/PermissionGuard";
import { StaffDirectory } from "@/modules/staff";

export default function StaffPage() {
  return (
    <PermissionGuard route="/staff">
      <StaffDirectory />
    </PermissionGuard>
  );
}
