import { publicClassesClient } from "@/modules/bookings";
import { PilatesClassDetailManager, UserClassDetail } from "@/modules/services/pilates";
import { getServerSession, isAdminRole } from "@/lib/auth/session";

export default async function PilatesClassPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const session = await getServerSession();
  if (isAdminRole(session?.role)) return <PilatesClassDetailManager classId={classId} />;
  const item = await publicClassesClient.get(classId).catch(() => null);
  if (!item) return <section className="rounded-2xl border border-error/30 bg-card-bg-primary p-8 text-center"><h1 className="text-xl font-bold text-txt-primary">Class unavailable</h1><p className="mt-2 text-sm text-txt-secondary">This class could not be found or is no longer available.</p></section>;
  return <UserClassDetail item={item} />;
}
