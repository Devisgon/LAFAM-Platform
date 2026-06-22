import { AdminDashboard, UserDashboard } from "@/modules/dashboard";
import { getServerSession, isAdminRole } from "@/lib/auth/session";
export default async function DashboardPage() { const session = await getServerSession(); return isAdminRole(session?.role) ? <AdminDashboard /> : <UserDashboard />; }
