import { publicClassesClient, UserClasses } from "@/modules/bookings";
import { PilatesClassManager } from "@/modules/services/pilates";
import { getServerSession, isAdminRole } from "@/lib/auth/session";
export default async function PilatesPage() {
  const session = await getServerSession();
  if (isAdminRole(session?.role)) return <PilatesClassManager />;
  const initialResult = await publicClassesClient.list().catch(() => undefined);
  return <UserClasses filters={{}} initialResult={initialResult} />;
}
