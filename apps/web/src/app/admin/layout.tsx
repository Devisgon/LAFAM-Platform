import { RoleGuard } from "@/components/role_guard";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <RoleGuard requiredRole="admin">{children}</RoleGuard>;
}
