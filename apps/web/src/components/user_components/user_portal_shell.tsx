"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/page_header";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top_bar";

const pageDetails: Record<string, { activeItem: string; title: string }> = {
  "/user": { activeItem: "Home", title: "Home" },
  "/user/classes": { activeItem: "Classes", title: "Classes" },
  "/user/bookings": { activeItem: "Booking", title: "Booking" },
  "/user/wallet": { activeItem: "Wallet", title: "Wallet" },
  "/user/payments": { activeItem: "Payment", title: "Payment" },
  "/user/profile": { activeItem: "Profile", title: "Profile" },
};

export function UserPortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const details = pathname.startsWith("/user/classes/")
    ? pageDetails["/user/classes"]
    : pageDetails[pathname] ?? pageDetails["/user"];

  return (
    <div className="min-h-screen bg-background-primary">
      <TopBar title={details.title} />
      <div className="md:flex">
        <Sidebar activeItem={details.activeItem} variant="user" />
        <div className="min-w-0 flex-1">
          <PageHeader homeHref="/user" title={details.title} />
          <main className="p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
