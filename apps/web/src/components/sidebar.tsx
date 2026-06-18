"use client";
import Link from "next/link";
import { useState } from "react";
import {CalendarDays,ChevronDown,CreditCard,Gauge, LogOut, Menu,  Settings,  Star, UserRound,ListChecks,type LucideIcon,} from "lucide-react";
type IconName =| "bookings"| "calendar" | "dashboard" | "logout"  | "payments" | "reviews"  | "services"| "settings"| "staff";

type NavItem = {
  href: string;
  icon: IconName;
  label: string;
};

type NavigationChild = {
  href: string;
  label: string;
};

const icons: Record<IconName, LucideIcon> = {
  dashboard: Gauge,
  bookings: CalendarDays,
  calendar: CalendarDays,
  services: ListChecks,
  staff: UserRound,
  payments: CreditCard,
  reviews: Star,
  settings: Settings,
  logout: LogOut,
};

const primaryItems: NavItem[] = [
  { href: "/admin", icon: "dashboard", label: "Dashboard" },
  { href: "/admin/bookings", icon: "bookings", label: "Bookings" },
  { href: "/admin/calendar", icon: "calendar", label: "Calendar" },
];

const managementItems: NavItem[] = [
  { href: "#", icon: "payments", label: "Payments" },
  { href: "#", icon: "reviews", label: "Reviews" },
  { href: "/admin/settings", icon: "settings", label: "Settings" },
];

function Icon({ name }: { name: IconName }) {
  const Component = icons[name];

  return <Component size={20} strokeWidth={3} className="shrink-0" />;
}

function NavigationLink({
  active = false,
  collapsed,
  href,
  icon,
  label,
}: {
  active?: boolean;
  collapsed: boolean;
  href: string;
  icon: IconName;
  label: string;
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-14 w-full items-center text-[14px]  transition hover:bg-black hover:text-white ${
  collapsed ? "justify-center px-0" : "gap-4 px-5"
} ${active ? "bg-black text-white" : ""}`}>
      <Icon name={icon} />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

function NavigationGroup({
  activeItem,
  children,
  collapsed,
  icon,
  label,
}: {
  activeItem?: string;
  children: NavigationChild[];
  collapsed: boolean;
  icon: IconName;
  label: string;
}) {
  const [open, setOpen] = useState(true);

  if (collapsed) {
    return (
      <NavigationLink
        collapsed={collapsed}
        href={children[0]?.href || "#"}
        icon={icon}
        label={label}
      />
    );
  }

  return (
    <div className="w-full">
      <button
        type="button"
        title={label}
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`flex min-h-14 w-full items-center gap-4 px-5 text-[14px]  transition ${
          open
            ? "bg-black text-white"
            : "text-black hover:bg-black hover:text-white"
        }`}
      >
        <Icon name={icon} />

        <span className="flex-1 text-left">{label}</span>

        <ChevronDown
          size={18}
          strokeWidth={3}
          className={`transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="w-full border-b border-black/20 bg-[#f7e5e5] py-3 shadow-sm">
          {children.map((child) => (
            <Link
              key={child.label}
              href={child.href}
              aria-current={child.label === activeItem ? "page" : undefined}
              className={`block w-full px-[72px] py-2 text-[16px] font-medium text-black transition hover:bg-black/10 ${
                child.label === activeItem ? "bg-black/10" : ""
              }`}
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
  const width = collapsed ? "md:w-[72px]" : "md:w-[300px]";

  return (
    <>
      <aside
        className={`relative z-20   flex shrink-0 flex-col bg-foreground py-4 text-black transition-[width] duration-300 md:fixed md:bottom-0 md:left-0 md:top-20 md:overflow-y-auto ${width}`}
      >
        <div
          className={`flex items-center px-5 ${
            collapsed ? "justify-center" : "justify-between"
          }`}
        >
          {!collapsed && (
            <h2 className="text-[16px] ">Navigation</h2>
          )}

          <button
            type="button"
            aria-label="Toggle sidebar"
            onClick={() => setCollapsed((value) => !value)}
            className="rounded-md p-1  transition "
          >
            <Menu size={24} strokeWidth={3} />
          </button>
        </div>

        <nav className="mt-8 grid " aria-label="Main navigation">
          {primaryItems.map((item) => (
            <NavigationLink
              key={item.label}
              active={item.label === activeItem}
              collapsed={collapsed}
              {...item}
            />
          ))}

          <NavigationGroup
            activeItem={activeItem}
            collapsed={collapsed}
            icon="services"
            label="Services"
          >
            {[{ href: "/admin/services/pilates", label: "Pilates" }]}
          </NavigationGroup>

          <NavigationLink
            active={activeItem === "Staff"}
            collapsed={collapsed}
            href="/admin/staff"
            icon="staff"
            label="Staff"
          />

          {managementItems.map((item) => (
            <NavigationLink
              key={item.label}
              active={item.label === activeItem}
              collapsed={collapsed}
              {...item}
            />
          ))}
        </nav>

        <a
          href="#"
          title="Log Out"
          className={`mt-8 flex min-h-10 items-center rounded-lg text-[17px] font-medium text-black transition hover:bg-black/10 md:mt-auto ${
            collapsed ? "justify-center px-2" : "gap-4 px-3"
          }`}
        >
          <Icon name="logout" />
          {!collapsed && <span>Log Out</span>}
        </a>
      </aside>

      <div
        aria-hidden="true"
        className={`hidden shrink-0 transition-[width] duration-300 md:block ${width}`}
      />
    </>
  );
}
