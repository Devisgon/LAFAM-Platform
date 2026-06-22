import { AdminSettings, UserSettings } from "@/modules/settings";
import { getServerSession, isAdminRole } from "@/lib/auth/session";
export default async function SettingsPage() { const session = await getServerSession(); return isAdminRole(session?.role) ? <AdminSettings /> : <UserSettings />; }
