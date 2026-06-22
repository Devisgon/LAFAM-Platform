import { AdminBookingManager, publicClassesClient, UserClasses } from "@/modules/bookings";
import { getServerSession, isAdminRole } from "@/lib/auth/session";
export default async function BookingsPage() {
  const session = await getServerSession();
  if (isAdminRole(session?.role)) return <AdminBookingManager />;
  const initialResult = await publicClassesClient.list().catch(() => undefined);
  return <UserClasses filters={{}} initialResult={initialResult} />;
}
