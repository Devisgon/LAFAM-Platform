import { AdminWalletManager, UserWalletScreen } from "@/modules/wallet";
import { getServerSession, isAdminRole } from "@/lib/auth/session";
export default async function WalletPage() { const session = await getServerSession(); return isAdminRole(session?.role) ? <AdminWalletManager /> : <UserWalletScreen />; }
