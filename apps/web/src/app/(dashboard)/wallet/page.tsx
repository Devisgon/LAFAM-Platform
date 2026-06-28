import { PermissionGuard } from "@/components/guards/PermissionGuard";
import { AdminWalletManager } from "@/modules/wallet";

export default function WalletPage() {
  return (
    <PermissionGuard route="/wallet">
      <AdminWalletManager />
    </PermissionGuard>
  );
}
