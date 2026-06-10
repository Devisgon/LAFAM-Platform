import { AdminSettings } from "@/components/admin_settings";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top_bar";

export default function AdminSettingsPage() {
  return (
    <div className="min-h-screen bg-background-primary md:flex">
      <Sidebar activeItem="Settings" />
      <div className="min-w-0 flex-1">
        <TopBar description="Manage platform users and booking records" title="Settings" />
        <main className="p-4 lg:p-6">
          <AdminSettings />
        </main>
      </div>
    </div>
  );
}
