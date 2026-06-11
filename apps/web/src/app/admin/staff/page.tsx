import { Sidebar } from "@/components/sidebar";
import { StaffDirectory } from "@/components/staff_directory";
import { TopBar } from "@/components/top_bar";

export default function StaffPage() {
  return (
    <div className="min-h-screen bg-background-primary md:flex">
      <Sidebar activeItem="Staff" />
      <div className="min-w-0 flex-1">
        <TopBar
          actionHref="#add-staff"
          actionLabel="+ Add staff"
          dateLabel="8 Jun 2026"
          description="Create staff accounts and manage availability"
          title="Staff"
        />
        <main className="p-4 lg:p-6">
          <StaffDirectory />
        </main>
      </div>
    </div>
  );
}
