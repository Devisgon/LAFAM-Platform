import { RoleGuard } from "@/components/guards";
import { AdminUserManager } from "@/modules/users";
export default function UsersPage() { return <RoleGuard allowedRoles={["admin", "super_admin"]}><AdminUserManager /></RoleGuard>; }

