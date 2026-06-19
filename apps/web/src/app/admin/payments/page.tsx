import { AdminPaymentManager } from "@/components/admin_payment_manager";
import { PageHeader } from "@/components/page_header";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top_bar";

export default function AdminPaymentsPage() {
  return (
    <div className="min-h-screen bg-background-primary">
      <TopBar
        description="Review payments, transaction activity, and refund actions"
        title="Payments"
      />
      <div className="md:flex">
        <Sidebar activeItem="Payments" />
        <div className="min-w-0 flex-1">
          <PageHeader title="Payments" />
          <main className="p-4 lg:p-6">
            <AdminPaymentManager />
          </main>
        </div>
      </div>
    </div>
  );
}
