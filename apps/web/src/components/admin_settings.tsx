"use client";

import { useState } from "react";
import { BookingExplorer } from "@/app/admin/bookings/page";
import { AdminUserManager } from "./admin_user_manager";
import { ProfileSettings } from "./profile_settings";

type SettingsView = "profile" | "users" | "history";

export function AdminSettings() {
  const [view, setView] = useState<SettingsView>("profile");

  return (
    <div className="grid gap-7 lg:grid-cols-[190px_minmax(0,1fr)]">
      <aside className="self-start overflow-x-auto lg:sticky lg:top-6">
        <nav
          className="flex min-w-max gap-1.5 lg:grid lg:min-w-0"
          aria-label="Settings pages"
        >
          {[
            {
              id: "profile" as const,
              label: "Profile Details",
            },
            {
              id: "users" as const,
              label: "Users",
            },
        
          ].map((item) => (
            <button
              aria-current={view === item.id ? "page" : undefined}
              className={`min-h-11 rounded-xl px-4 py-2.5 text-left text-sm font-semibold transition-colors lg:w-full ${view === item.id ? "bg-primary/15 text-primary" : "text-txt-primary hover:bg-card-bg-primary"}`}
              key={item.id}
              onClick={() => setView(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <section
        className={
          view === "profile"
            ? "min-w-0"
            : "min-w-0 rounded-xl border border-background-secondary bg-card-bg-primary p-5 shadow-sm lg:p-6"
        }
      >
        {view === "profile" ? (
          <ProfileSettings />
        ) : view === "users" ? (
          <>
           
            <AdminUserManager />
          </>
        ) : (
          <>
           
          </>
        )}
      </section>
    </div>
  );
}
