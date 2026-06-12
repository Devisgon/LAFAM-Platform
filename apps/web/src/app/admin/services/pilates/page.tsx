import { PilatesClassManager } from "@/components/pilates_class_manager";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top_bar";

export default function AdminPilatesServicesPage() {
  return (
    <div className="min-h-screen bg-background-primary md:flex">
      <Sidebar activeItem="Pilates" />
      <div className="min-w-0 flex-1">
        <TopBar actionHref="#create-class" actionLabel="+ Create class" dateLabel="8 Jun 2026" description="Create classes, assign trainers, and manage schedules" title="Pilates Classes" />
        <main className="p-4 lg:p-6">
          <PilatesClassManager />
        </main>
      </div>
    </div>
  );
}
