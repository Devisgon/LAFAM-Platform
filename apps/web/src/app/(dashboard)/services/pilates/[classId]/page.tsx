import { PilatesClassDetailManager } from "@/components/admin_components/pilates_class_detail_manager";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top_bar";
import { PageHeader } from "@/components/page_header";

export default async function AdminPilatesClassPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;

  return (
    <div className="min-h-screen bg-background-primary">
      <TopBar
        description="Edit this class and manage its bookable schedules"
        title="Pilates Class"
      />
      <div className="md:flex">
        <Sidebar activeItem="Pilates" />
        <div className="min-w-0 flex-1">
          <PageHeader title="Pilates Class" />
          <main className="p-4 lg:p-6">
            <PilatesClassDetailManager classId={classId} />
          </main>
        </div>
      </div>
    </div>
  );
}
