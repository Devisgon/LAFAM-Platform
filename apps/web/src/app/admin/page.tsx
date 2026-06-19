import { AdminDashboard } from "@/components/admin-dashboard/admin_dashboard";
import { PageHeader } from "@/components/page_header";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top_bar";

export default function AdminDashboardPage() {
  return (
    <div className="min-h-screen bg-background-primary">
      <TopBar />
      <div className="md:flex">
        <Sidebar activeItem="Dashboard" />
        <div className="min-w-0 flex-1">
          <PageHeader title="Dashboard" />
          <main className="p-4 lg:p-5">
            <AdminDashboard />
          </main>
        </div>
      </div>
    </div>
  );
}
