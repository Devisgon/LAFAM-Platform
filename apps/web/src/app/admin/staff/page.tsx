import { Sidebar } from "@/components/sidebar";
import { StaffDirectory } from "@/components/staff_directory";
import { TopBar } from "@/components/top_bar";
import { PageHeader } from "@/components/page_header";

export default function StaffPage() {
  return (
    <div className="min-h-screen bg-background-primary">
      <TopBar
        actionHref="#add-staff"
        actionLabel="+ Add staff"
        dateLabel="8 Jun 2026"
        description="Create staff accounts and manage availability"
        title="Staff"
      />
      <div className="md:flex">
        <Sidebar activeItem="Staff" />
        <div className="min-w-0 flex-1">
          <PageHeader title="Staff" />
          <main className="p-4 lg:p-6">
            <StaffDirectory />
          </main>
        </div>
      </div>
    </div>
  );
}
