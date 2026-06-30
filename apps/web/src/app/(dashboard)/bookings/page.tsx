import { PermissionGuard } from "@/components/guards/PermissionGuard";
import { getServerAuthContext } from "@/lib/auth/auth-context";
import { AdminBookingManager } from "@/modules/bookings";

export default async function BookingsPage() {
  const context = await getServerAuthContext();

  return (
    <PermissionGuard route="/bookings">
      <AdminBookingManager permissions={context?.permissions ?? []} />
    </PermissionGuard>
  );
}
