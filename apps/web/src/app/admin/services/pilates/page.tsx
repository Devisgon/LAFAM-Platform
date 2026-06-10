import { PilatesClassManager, type PilatesClass } from "@/components/pilates_class_manager";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top_bar";

const classes: PilatesClass[] = [
  { id: "CLS-001", name: "Reformer Foundations", trainer: "Sara Hassan", date: "2026-06-09", time: "09:00", studio: "Reformer Studio", duration: 50, capacity: 10, bookings: 7, status: "Scheduled" },
  { id: "CLS-002", name: "Mat Pilates Flow", trainer: "Lina Ahmad", date: "2026-06-09", time: "11:00", studio: "Movement Studio", duration: 45, capacity: 18, bookings: 18, status: "Full" },
  { id: "CLS-003", name: "Reformer Strength", trainer: "Rania Khalid", date: "2026-06-10", time: "16:30", studio: "Reformer Studio", duration: 55, capacity: 8, bookings: 5, status: "Scheduled" },
];

export default function AdminPilatesServicesPage() {
  return (
    <div className="min-h-screen bg-background-primary md:flex">
      <Sidebar activeItem="Pilates" />
      <div className="min-w-0 flex-1">
        <TopBar actionHref="#create-class" actionLabel="+ Create class" dateLabel="8 Jun 2026" description="Create classes, assign trainers, and manage schedules" title="Pilates Classes" />
        <main className="p-4 lg:p-6">
          <PilatesClassManager initialClasses={classes} />
        </main>
      </div>
    </div>
  );
}
