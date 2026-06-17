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

export function TopBar({ title }: TopBarProps) {
  const { avatarUrl, user } = useAuth();

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
        <Link
          aria-label="Open profile settings"
          className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          href="/admin/settings"
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
