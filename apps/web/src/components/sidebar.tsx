"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { ReactNode } from "react";

type IconName =
  | "bookings"
  | "calendar"
  | "customers"
  | "dashboard"
  | "logout"
  | "payments"
  | "promotions"
  | "reports"
  | "reviews"
  | "services"
  | "settings"
  | "staff";

const primaryItems: Array<{ href: string; icon: IconName; label: string }> = [
  { href: "/admin", icon: "dashboard", label: "Dashboard" },
  { href: "/admin/bookings", icon: "bookings", label: "Bookings" },
];

const managementItems: Array<{ href: string; icon: IconName; label: string }> = [
  { href: "#", icon: "payments", label: "Payments" },
  { href: "#", icon: "reviews", label: "Reviews" },
  { href: "/admin/settings", icon: "settings", label: "Settings" },
];

type NavigationChild = {
  href: string;
  label: string;
};

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    dashboard: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10.5V20h13v-9.5M9 20v-6h6v6" /></>,
    bookings: <><rect x="4" y="4.5" width="16" height="16" rx="3" /><path d="M8 3v4M16 3v4M7 10h10M8 14h3M8 17h5" /></>,
    calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2.5" /><path d="M8 3v4M16 3v4M3.5 10h17M8 14h2M14 14h2M8 17h2M14 17h2" /></>,
    customers: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.5-4.5 3-7 7-7s6.5 2.5 7 7" /><path d="M5 9H3m18 0h-2" /></>,
    services: <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M8 9h8M8 13h8M8 17h5" /></>,
    staff: <><circle cx="12" cy="7.5" r="3.5" /><path d="M5 20c.6-4.7 3-7 7-7s6.4 2.3 7 7" /></>,
    payments: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3 9h18M7 15h4" /></>,
    promotions: <><path d="m4 14 3-3 6 6-3 3zM8 10l8-5c2-1 3 0 2 2l-5 8M15 8l3 3M5 5l2 2M12 3v3M3 12h3" /></>,
    reviews: <><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z" /></>,
    reports: <><path d="M5 3h10l4 4v14H5zM15 3v5h5M9 17v-5M12 17V9M15 17v-3" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5L9 6a7 7 0 0 0-1.7 1L5 6 3 9.5 5.1 11a7 7 0 0 0 0 2L3 14.5 5 18l2.3-1a7 7 0 0 0 1.7 1l.5 3h5l.5-3a7 7 0 0 0 1.7-1l2.3 1 2-3.5-2.1-1.5a7 7 0 0 0 .1-1Z" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3M21 3v18" /></>,
  };

  return (
    <svg aria-hidden="true" className="size-[18px] shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
      {paths[name]}
    </svg>
  );
}

function Tooltip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-full z-30 ml-3 hidden whitespace-nowrap rounded-md bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg group-hover:block group-focus-visible:block">
      {label}
    </span>
  );
}

function NavigationLink({ active = false, collapsed, href, icon, label }: { active?: boolean; collapsed: boolean; href: string; icon: IconName; label: string }) {
  return (
    <Link
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`group relative flex min-h-10 items-center rounded-lg py-2 text-sm font-medium transition-colors ${collapsed ? "justify-center px-2" : "gap-3 px-3"} ${active ? "bg-primary text-white shadow-sm" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}
      href={href}
    >
      <Icon name={icon} />
      {!collapsed && label}
      {collapsed && <Tooltip label={label} />}
    </Link>
  );
}

function NavigationGroup({
  activeItem,
  children,
  collapsed,
  icon,
  label,
  open,
  setOpen,
}: {
  activeItem?: string;
  children: NavigationChild[];
  collapsed: boolean;
  icon: IconName;
  label: string;
  open: boolean;
  setOpen: () => void;
}) {
  return (
    <div>
      <button
        aria-expanded={open}
        aria-label={label}
        className={`group relative flex min-h-10 w-full items-center rounded-lg py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white ${collapsed ? "justify-center px-2" : "gap-3 px-3"}`}
        onClick={setOpen}
        type="button"
      >
        <Icon name={icon} />
        {!collapsed && (
          <>
            <span className="flex-1 text-left">{label}</span>
            <svg aria-hidden="true" className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="m7 10 5 5 5-5" />
            </svg>
          </>
        )}
        {collapsed && <Tooltip label={label} />}
      </button>
      {!collapsed && open && (
        <div className="ml-[30px] grid border-l border-white/10 pl-3">
          {children.map((child) => (
            <Link
              aria-current={child.label === activeItem ? "page" : undefined}
              className={`rounded-md px-2 py-1.5 text-sm ${
                child.label === activeItem
                  ? "bg-white/10 font-semibold text-white"
                  : "text-slate-400 hover:bg-white/10 hover:text-white"
              }`}
              href={child.href}
              key={child.label}
            >
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ activeItem = "Dashboard" }: { activeItem?: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(true);
  const width = collapsed ? "md:w-20" : "md:w-56";

  return (
    <>
      <aside className={`relative z-20 flex w-full shrink-0 flex-col bg-[#06243a] p-4 text-white transition-[width] duration-200 md:fixed md:inset-y-0 md:left-0 md:h-screen ${collapsed ? "md:overflow-visible" : "md:overflow-y-auto"} ${width}`}>
        <button
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`group mb-6 flex min-h-12 w-full items-center rounded-xl text-left transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 ${
            collapsed ? "justify-center px-2" : "gap-3 px-3"
          }`}
          onClick={() => setCollapsed((current) => !current)}
          type="button"
        >
          <span className="relative flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary">
            <Image
              alt=""
              className="size-7 object-contain transition-opacity group-hover:opacity-0"
              height={28}
              priority
              src="/logo.png"
              width={28}
            />
            <svg
              aria-hidden="true"
              className="absolute size-5 opacity-0 transition-opacity group-hover:opacity-100"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
              viewBox="0 0 24 24"
            >
              <rect height="16" rx="2" width="18" x="3" y="4" />
              <path d="M9 4v16M14 9l-3 3 3 3" />
            </svg>
          </span>
          {!collapsed && (
            <span>
              <strong className="block text-base tracking-[0.18em]">LAFAM</strong>
              <span className="block text-[10px] font-medium tracking-wide text-slate-400">
                Wellness portal
              </span>
            </span>
          )}
          {collapsed && <Tooltip label="Expand sidebar" />}
        </button>

        <nav className="grid gap-1" aria-label="Main navigation">
          {primaryItems.map((item) => <NavigationLink active={item.label === activeItem} collapsed={collapsed} key={item.label} {...item} />)}
          <NavigationGroup activeItem={activeItem} collapsed={collapsed} icon="services" label="Services" open={servicesOpen} setOpen={() => setServicesOpen((current) => !current)}>
            {[{ href: "/admin/services/pilates", label: "Pilates" }]}
          </NavigationGroup>
          <NavigationLink active={activeItem === "Staff"} collapsed={collapsed} href="/admin/staff" icon="staff" label="Staff" />
          {managementItems.map((item) => <NavigationLink collapsed={collapsed} key={item.label} {...item} />)}
        </nav>

        <a className={`group relative mt-6 flex min-h-10 items-center rounded-lg bg-error/15 py-2 text-sm font-semibold text-red-300 hover:bg-error hover:text-white md:mt-auto ${collapsed ? "justify-center px-2" : "gap-3 px-3"}`} href="#">
          <Icon name="logout" />
          {!collapsed && "Log Out"}
          {collapsed && <Tooltip label="Log Out" />}
        </a>
      </aside>
      <div aria-hidden="true" className={`hidden shrink-0 transition-[width] duration-200 md:block ${width}`} />
    </>
  );
}
