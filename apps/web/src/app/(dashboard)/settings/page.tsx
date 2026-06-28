import { PermissionGuard } from "@/components/guards/PermissionGuard";
import { getServerAuthContext } from "@/lib/auth/auth-context";
import { AdminSettings } from "@/modules/settings";

type SettingsPageSearchParams = {
  view?: string;
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<SettingsPageSearchParams>;
}) {
  const { view } = await searchParams;
  const context = await getServerAuthContext();

  return (
    <PermissionGuard route="/settings">
      <AdminSettings
        initialView={view === "users" ? "users" : "profile"}
        permissions={context?.permissions ?? []}
      />
    </PermissionGuard>
  );
}
