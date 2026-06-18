"use client";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Avatar } from "./reuseable_ui_components/avatar";

type TopBarProps = {
  actionHref?: string;
  actionLabel?: string;
  dateLabel?: string;
  description?: string;
  title?: string;
};

export function TopBar({ actionHref, actionLabel, title }: TopBarProps) {
  const { avatarUrl, user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  return (
    <header
      aria-label={title ? `${title} page header` : "Page header"}
      className="sticky top-0 z-30 flex h-20 w-full items-center justify-between gap-4 border-b border-white bg-foreground px-5"
    >
      <Image
        alt="logo"
        className="size-12 object-contain"
        height={36}
        priority
        src="/logo.svg"
        width={28}
      />

      <div className="flex flex-wrap items-center gap-3">
        {actionHref && actionLabel ? (
          <Link
            className="inline-flex min-h-11 items-center rounded-sm bg-button-primary px-4 text-sm font-semibold text-txt-primary transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            href={actionHref}
          >
            {actionLabel}
          </Link>
        ) : null}
        <Link
          aria-label="Open profile settings"
          className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          href={isAdmin ? "/admin/settings" : "/user"}
        >
          <Avatar
            alt={`${user?.full_name ?? "Account"} profile`}
            name={user?.full_name ?? user?.email ?? "Account"}
            size="md"
            src={avatarUrl ?? undefined}
          />
        </Link>
      </div>
    </header>
  );
}
