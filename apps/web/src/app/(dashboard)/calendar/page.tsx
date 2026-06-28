import { PermissionGuard } from "@/components/guards/PermissionGuard";
import { AdminCalendar } from "@/modules/calendar";

export default function CalendarPage() {
  return (
    <PermissionGuard route="/calendar">
      <AdminCalendar />
    </PermissionGuard>
  );
}
