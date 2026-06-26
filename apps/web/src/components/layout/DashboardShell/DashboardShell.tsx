"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";

const pageDetails: Record<string, { activeItem: string; title: string }> = {
  "/dashboard": { activeItem: "Dashboard", title: "Dashboard" },
  "/bookings": { activeItem: "Bookings", title: "Bookings" },
  "/calendar": { activeItem: "Calendar", title: "Calendar" },
  "/payments": { activeItem: "Payments", title: "Payments" },
  "/services/pilates": { activeItem: "Pilates", title: "Pilates Classes" },
  "/settings": { activeItem: "Settings", title: "Settings" },
  "/staff": { activeItem: "Staff", title: "Staff" },
  "/users": { activeItem: "Users", title: "Users" },
  "/wallet": { activeItem: "Wallet", title: "Wallet" },
};

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const details = pathname.startsWith("/services/pilates/")
    ? pageDetails["/services/pilates"]
    : pageDetails[pathname] ?? pageDetails["/dashboard"];

  return (
    <div className="min-h-screen bg-background-primary">
      <TopBar title={details.title} />
      <div className="md:flex">
        <Sidebar activeItem={details.activeItem} />
        <div className="min-w-0 flex-1">
          <PageHeader homeHref="/dashboard" title={details.title} />
          <main className="p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
