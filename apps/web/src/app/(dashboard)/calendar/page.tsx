import { RoleGuard } from "@/components/guards";
import { AdminCalendar } from "@/modules/calendar";
export default function CalendarPage() { return <RoleGuard allowedRoles={["admin", "super_admin"]}><AdminCalendar /></RoleGuard>; }

