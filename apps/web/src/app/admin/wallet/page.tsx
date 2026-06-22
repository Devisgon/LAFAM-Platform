import { AdminWalletManager } from "@/components/admin_components/admin_wallet_manager";
import { PageHeader } from "@/components/page_header";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top_bar";

export default function AdminWalletPage() {
  return (
    <div className="min-h-screen bg-background-primary">
      <TopBar
        description="Review wallet balances and transaction ledger activity"
        title="Wallet"
      />
      <div className="md:flex">
        <Sidebar activeItem="Wallet" />
        <div className="min-w-0 flex-1">
          <PageHeader title="Wallet" />
          <main className="p-4 lg:p-6">
            <AdminWalletManager />
          </main>
        </div>
      </div>
    </div>
  );
}
