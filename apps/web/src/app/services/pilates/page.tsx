import { PilatesClassManager, type PilatesClass, type PilatesCourse } from "@/components/pilates_class_manager";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top_bar";

const courses: PilatesCourse[] = [
  { id: "CRS-001", name: "Reformer Foundations", level: "Beginner", duration: 50, capacity: 10, description: "Core reformer techniques, control, and safe movement foundations." },
  { id: "CRS-002", name: "Mat Pilates Flow", level: "All levels", duration: 45, capacity: 18, description: "A balanced full-body mat sequence focused on mobility and core strength." },
  { id: "CRS-003", name: "Reformer Strength", level: "Intermediate", duration: 55, capacity: 8, description: "Progressive resistance training for experienced reformer members." },
];

const classes: PilatesClass[] = [
  { id: "CLS-001", courseId: "CRS-001", trainer: "Sara Hassan", date: "2026-06-09", time: "09:00", studio: "Reformer Studio", bookings: 7, status: "Scheduled" },
  { id: "CLS-002", courseId: "CRS-002", trainer: "Lina Ahmad", date: "2026-06-09", time: "11:00", studio: "Movement Studio", bookings: 18, status: "Full" },
  { id: "CLS-003", courseId: "CRS-003", trainer: "Rania Khalid", date: "2026-06-10", time: "16:30", studio: "Reformer Studio", bookings: 5, status: "Scheduled" },
  { id: "CLS-004", courseId: "CRS-001", trainer: "Sara Hassan", date: "2026-06-11", time: "10:00", studio: "Reformer Studio", bookings: 3, status: "Scheduled" },
];

export default function PilatesServicesPage() {
  return (
    <div className="min-h-screen bg-background-primary md:flex">
      <Sidebar activeItem="Pilates" />
      <div className="min-w-0 flex-1">
        <TopBar actionHref="#create-class" actionLabel="+ Schedule class" dateLabel="8 Jun 2026" description="Create courses, assign trainers, and manage class schedules" title="Pilates Services" />
        <main className="p-4 lg:p-6">
          <PilatesClassManager initialClasses={classes} initialCourses={courses} />
        </main>
      </div>
    </div>
  );
}
