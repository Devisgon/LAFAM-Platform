"use client";

import { useState } from "react";
import { LockKeyhole } from "lucide-react";
import { AccessDeniedPanel } from "@/components/guards/AccessDeniedPanel";
import { AdminUserManager } from "@/modules/users";
import { ProfileSettings } from "./ProfileSettings";

type SettingsView = "profile" | "users";

function hasPermission(
  permissions: readonly string[],
  permission: string,
): boolean {
  return permissions.includes(permission);
}

export function AdminSettings({
  initialView = "profile",
  permissions = [],
}: {
  initialView?: SettingsView;
  permissions?: readonly string[];
}) {
  const canManageUsers = hasPermission(permissions, "admin:users:read");
  const [view, setView] = useState<SettingsView>(
    initialView === "users" && !canManageUsers ? "profile" : initialView,
  );

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
              disabled: !canManageUsers,
            },
          ].map((item) => (
            <button
              aria-current={view === item.id ? "page" : undefined}
              aria-disabled={item.disabled ? "true" : undefined}
              className={`flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-left text-sm font-semibold transition-colors lg:w-full ${item.disabled ? "cursor-not-allowed opacity-55" : view === item.id ? "bg-primary/15 text-primary" : "text-txt-primary hover:bg-card-bg-primary"}`}
              disabled={item.disabled}
              key={item.id}
              onClick={() => setView(item.id)}
              type="button"
            >
              <span className="flex-1">{item.label}</span>
              {item.disabled ? (
                <LockKeyhole aria-hidden="true" size={15} strokeWidth={2.5} />
              ) : null}
            </button>
          ))}
        </nav>
      </aside>

      <section
        className="min-w-0"
      >
        {view === "profile" ? (
          <ProfileSettings />
        ) : canManageUsers ? (
          <AdminUserManager showViewAction={false} />
        ) : (
          <AccessDeniedPanel
            description="Admin user management is available only to admin accounts."
            title="User list locked"
          />
        )}
      </section>
    </div>
  );
}
