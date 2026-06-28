import { PermissionGuard } from "@/components/guards/PermissionGuard";
import { AdminBookingManager } from "@/modules/bookings";

export default function BookingsPage() {
  return (
    <PermissionGuard route="/bookings">
      <AdminBookingManager />
    </PermissionGuard>
  );
}
