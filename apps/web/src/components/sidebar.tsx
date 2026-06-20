"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  CreditCard,
  Gauge,
  Menu,
  Settings,
  UserRound,
  ListChecks,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";

type IconName =
  | "bookings"
  | "calendar"
  | "dashboard"
  | "payments"
  | "services"
  | "settings"
  | "staff"
  | "wallet";

type NavItem = {
  href: string;
  icon: IconName;
  label: string;
};

type NavigationChild = {
  href: string;
  label: string;
};

const MOBILE_SIDEBAR_EVENT = "lafam:open-mobile-sidebar";

const icons: Record<IconName, LucideIcon> = {
  dashboard: Gauge,
  bookings: CalendarDays,
  calendar: CalendarDays,
  services: ListChecks,
  staff: UserRound,
  wallet: WalletCards,
  payments: CreditCard,
  settings: Settings,
};

const primaryItems: NavItem[] = [
  { href: "/admin", icon: "dashboard", label: "Dashboard" },
  { href: "/admin/bookings", icon: "bookings", label: "Bookings" },
  { href: "/admin/calendar", icon: "calendar", label: "Calendar" },
];

const managementItems: NavItem[] = [
  { href: "/admin/payments", icon: "payments", label: "Payments" },
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
  onNavigate,
}: {
  active?: boolean;
  collapsed: boolean;
  href: string;
  icon: IconName;
  label: string;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={`flex min-h-14 w-full items-center text-[14px] transition hover:bg-black hover:text-white ${
        collapsed ? "justify-center px-0" : "gap-4 px-5"
      } ${active ? "bg-black text-white" : ""}`}
    >
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
  onNavigate,
}: {
  activeItem?: string;
  children: NavigationChild[];
  collapsed: boolean;
  icon: IconName;
  label: string;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(true);

  if (collapsed) {
    return (
      <NavigationLink
        collapsed={collapsed}
        href={children[0]?.href || "#"}
        icon={icon}
        label={label}
        onNavigate={onNavigate}
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
        className={`flex min-h-14 w-full items-center gap-4 px-5 text-[14px] transition ${
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
              onClick={onNavigate}
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

function SidebarContent({
  activeItem,
  collapsed,
  isMobile = false,
  onClose,
  onToggleCollapse,
}: {
  activeItem: string;
  collapsed: boolean;
  isMobile?: boolean;
  onClose?: () => void;
  onToggleCollapse?: () => void;
}) {
  return (
    <>
      <div
        className={`flex items-center px-5 ${
          collapsed ? "justify-center" : "justify-between"
        }`}
      >
        {!collapsed && <h2 className="text-[16px]">Navigation</h2>}

        {isMobile ? (
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={onClose}
            className="rounded-md p-1 transition"
          >
            <X size={24} strokeWidth={3} />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Toggle sidebar"
            onClick={onToggleCollapse}
            className="rounded-md p-1 transition"
          >
            <Menu size={24} strokeWidth={3} />
          </button>
        )}
      </div>

      <nav className="mt-8 grid" aria-label="Main navigation">
        {primaryItems.map((item) => (
          <NavigationLink
            key={item.label}
            active={item.label === activeItem}
            collapsed={collapsed}
            onNavigate={onClose}
            {...item}
          />
        ))}

        <NavigationGroup
          activeItem={activeItem}
          collapsed={collapsed}
          icon="services"
          label="Services"
          onNavigate={onClose}
        >
          {[{ href: "/admin/services/pilates", label: "Pilates" }]}
        </NavigationGroup>

        <NavigationLink
          active={activeItem === "Staff"}
          collapsed={collapsed}
          href="/admin/staff"
          icon="staff"
          label="Staff"
          onNavigate={onClose}
        />

        <NavigationLink
          active={activeItem === "Wallet"}
          collapsed={collapsed}
          href="/admin/wallet"
          icon="wallet"
          label="Wallet"
          onNavigate={onClose}
        />

        {managementItems.map((item) => (
          <NavigationLink
            key={item.label}
            active={item.label === activeItem}
            collapsed={collapsed}
            onNavigate={onClose}
            {...item}
          />
        ))}
      </nav>
    </>
  );
}

export function Sidebar({ activeItem = "Dashboard" }: { activeItem?: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const width = collapsed ? "md:w-[72px]" : "md:w-[300px]";

  useEffect(() => {
    const openMobileSidebar = () => setMobileOpen(true);

    window.addEventListener(MOBILE_SIDEBAR_EVENT, openMobileSidebar);

    return () => {
      window.removeEventListener(MOBILE_SIDEBAR_EVENT, openMobileSidebar);
    };
  }, []);

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed bottom-0 left-0 top-0 z-50 flex w-[280px] shrink-0 flex-col bg-foreground py-4 text-black shadow-xl transition-transform duration-300 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent
          activeItem={activeItem}
          collapsed={false}
          isMobile
          onClose={() => setMobileOpen(false)}
        />
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={`relative z-20 hidden shrink-0 flex-col bg-foreground py-4 text-black transition-[width] duration-300 md:fixed md:bottom-0 md:left-0 md:top-20 md:flex md:overflow-y-auto ${width}`}
      >
        <SidebarContent
          activeItem={activeItem}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((value) => !value)}
        />
      </aside>

      <div
        aria-hidden="true"
        className={`hidden shrink-0 transition-[width] duration-300 md:block ${width}`}
      />
    </>
  );
}
