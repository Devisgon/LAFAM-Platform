import { AdminSettings } from "@/components/admin_settings";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top_bar";
import { PageHeader } from "@/components/page_header";

export default function AdminSettingsPage() {
  return (
    <div className="min-h-screen bg-background-primary">
      <TopBar
        description="Manage your profile, security, users, and booking records"
        title="Settings"
      />
      <div className="md:flex">
        <Sidebar activeItem="Settings" />
        <div className="min-w-0 flex-1">
          <PageHeader title="Settings" />
          <main className="p-4 lg:p-6">
            <AdminSettings />
          </main>
        </div>
      </div>
    </div>
  );
}
