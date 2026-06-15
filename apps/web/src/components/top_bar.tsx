"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Avatar } from "./reuseable_ui_components/avatar";
import { Button } from "./reuseable_ui_components/button";
import { ThemeSwitcher } from "./theme_switcher";

export function TopBar({
  actionHref,
  actionLabel = "+ Add New",
  description = "Welcome back, Admin!",
  title = "Dashboard",
}: {
  actionHref?: string;
  actionLabel?: string;
  dateLabel?: string;
  description?: string;
  title?: string;
}) {
  const { avatarUrl, user } = useAuth();

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-background-secondary bg-card-bg-primary px-5 py-4">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
        <p className="text-xs text-text-secondary">{description}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {actionHref ? (
          <a
            className="inline-flex min-h-8 items-center justify-center rounded-lg bg-button-primary px-3 py-1 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            href={actionHref}
          >
            {actionLabel}
          </a>
        ) : (
          <Button size="sm">{actionLabel}</Button>
        )}
        <ThemeSwitcher />
        <button
          aria-label="Notifications"
          className="rounded-lg p-2 text-text-secondary hover:bg-background-secondary"
          type="button"
        >
          <svg
            aria-hidden="true"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            viewBox="0 0 24 24"
          >
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
          </svg>
        </button>
        <Link
          aria-label="Open profile settings"
          className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          href="/admin/settings"
        >
          <Avatar
            alt={`${user?.full_name ?? "Account"} profile`}
            name={user?.full_name ?? user?.email ?? "Account"}
            size="sm"
            src={avatarUrl ?? undefined}
          />
        </Link>
      </div>
    </header>
  );
}
