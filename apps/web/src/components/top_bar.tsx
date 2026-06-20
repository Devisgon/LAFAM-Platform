"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Menu, UserRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Avatar } from "./reuseable_ui_components/avatar";

type TopBarProps = {
  actionHref?: string;
  actionLabel?: string;
  dateLabel?: string;
  description?: string;
  title?: string;
};

const MOBILE_SIDEBAR_EVENT = "lafam:open-mobile-sidebar";

export function TopBar({ actionHref, actionLabel, title }: TopBarProps) {
  const router = useRouter();
  const { avatarUrl, logout, user } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const profileHref = isAdmin ? "/admin/settings" : "/user";
  const accountName = user?.full_name ?? user?.email ?? "Account";

  useEffect(() => {
    if (!isAccountMenuOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsAccountMenuOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isAccountMenuOpen]);

  const openMobileSidebar = () => {
    window.dispatchEvent(new Event(MOBILE_SIDEBAR_EVENT));
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);

    try {
      await logout();
      router.replace("/");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header
      aria-label={title ? `${title} page header` : "Page header"}
      className="sticky top-0 z-30 flex h-20 w-full items-center justify-between gap-4 border-b border-white bg-foreground px-5"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Open sidebar"
          onClick={openMobileSidebar}
          className="rounded-md p-1 text-black transition hover:bg-black/10 md:hidden"
        >
          <Menu size={26} strokeWidth={3} />
        </button>

        <Image
          alt="logo"
          className="size-12 object-contain"
          height={36}
          priority
          src="/logo.svg"
          width={28}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        
        <div className="relative" ref={accountMenuRef}>
          <button
            aria-expanded={isAccountMenuOpen}
            aria-haspopup="menu"
            aria-label="Open account menu"
            className="flex min-h-12 items-center gap-3 rounded-sm px-2 text-sm font-medium text-txt-primary transition hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            onClick={() => setIsAccountMenuOpen((isOpen) => !isOpen)}
            type="button"
          >
            <Avatar
              alt={`${accountName} profile`}
              name={accountName}
              size="md"
              src={avatarUrl ?? undefined}
            />
            <span className="hidden max-w-40 truncate sm:block">{accountName}</span>
            <ChevronDown
              aria-hidden="true"
              className={`hidden transition-transform sm:block ${isAccountMenuOpen ? "rotate-180" : ""}`}
              size={16}
            />
          </button>

          <div
            className={`absolute right-0 top-full z-50 w-48 pt-2 transition-[opacity,visibility] ${
              isAccountMenuOpen
                ? "visible opacity-100"
                : "invisible opacity-0"
            }`}
          >
            <div
              aria-label="Account menu"
              className="overflow-hidden rounded-md border border-background-secondary bg-card-bg-primary py-1 text-sm text-txt-primary shadow-lg"
              role="menu"
            >
              <Link
                className="flex min-h-11 items-center gap-3 px-4 transition hover:bg-background-secondary focus-visible:bg-background-secondary focus-visible:outline-none"
                href={profileHref}
                onClick={() => setIsAccountMenuOpen(false)}
                role="menuitem"
              >
                <UserRound aria-hidden="true" size={18} />
                Profile
              </Link>
              <button
                className="flex min-h-11 w-full items-center gap-3 px-4 text-left text-error transition hover:bg-background-secondary focus-visible:bg-background-secondary focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
                disabled={isLoggingOut}
                onClick={handleLogout}
                role="menuitem"
                type="button"
              >
                <LogOut aria-hidden="true" size={18} />
                {isLoggingOut ? "Logging out…" : "Logout"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
