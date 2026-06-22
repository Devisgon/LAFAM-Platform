import { UserPortalShell } from "@/components/user_components/user_portal_shell";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <UserPortalShell>{children}</UserPortalShell>;
}
