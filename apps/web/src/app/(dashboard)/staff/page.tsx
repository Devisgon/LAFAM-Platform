import { RoleGuard } from "@/components/guards";
import { StaffDirectory } from "@/modules/staff";
export default function StaffPage() { return <RoleGuard allowedRoles={["admin", "super_admin"]}><StaffDirectory /></RoleGuard>; }
