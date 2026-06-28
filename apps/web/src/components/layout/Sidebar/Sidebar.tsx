"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  CreditCard,
  Dumbbell,
  Gauge,
  LockKeyhole,
  Menu,
  Settings,
  UserRound,
  ListChecks,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  type AdminRouteKey,
  hasAdminRouteAccess,
} from "@/lib/auth/admin-access";
import type { AuthContextData } from "@/lib/auth/auth-context";

type IconName =
  | "bookings"
  | "calendar"
  | "classes"
  | "dashboard"
  | "payments"
  | "services"
  | "settings"
  | "staff"
  | "wallet";

type NavItem = {
  accessRoute: AdminRouteKey;
  href: string;
  icon: IconName;
  label: string;
};

type NavigationChild = {
  accessRoute: AdminRouteKey;
  href: string;
  label: string;
};

const MOBILE_SIDEBAR_EVENT = "lafam:open-mobile-sidebar";

const icons: Record<IconName, LucideIcon> = {
  bookings: CalendarDays,
  calendar: CalendarDays,
  classes: Dumbbell,
  dashboard: Gauge,
  payments: CreditCard,
  services: ListChecks,
  settings: Settings,
  staff: UserRound,
  wallet: WalletCards,
};

const primaryItems: NavItem[] = [
  { accessRoute: "/dashboard", href: "/dashboard", icon: "dashboard", label: "Dashboard" },
  { accessRoute: "/bookings", href: "/bookings", icon: "bookings", label: "Bookings" },
  { accessRoute: "/calendar", href: "/calendar", icon: "calendar", label: "Calendar" },
];

const managementItems: NavItem[] = [
  { accessRoute: "/payments", href: "/payments", icon: "payments", label: "Payments" },
  { accessRoute: "/settings", href: "/settings", icon: "settings", label: "Settings" },
];

function Icon({ name }: { name: IconName }) {
  const Component = icons[name];

  return <Component size={20} strokeWidth={3} className="shrink-0" />;
}

function NavigationLink({
  active = false,
  collapsed,
  disabled = false,
  href,
  icon,
  label,
  onNavigate,
}: {
  active?: boolean;
  collapsed: boolean;
  disabled?: boolean;
  href: string;
  icon: IconName;
  label: string;
  onNavigate?: () => void;
}) {
  const className = `flex min-h-14 w-full items-center text-[14px] transition ${
    collapsed ? "justify-center px-0" : "gap-4 px-5"
  } ${
    disabled
      ? "cursor-not-allowed opacity-55"
      : "hover:bg-black hover:text-white"
  } ${active ? "bg-black text-white" : ""}`;

  if (disabled) {
    return (
      <button
        aria-disabled="true"
        aria-label={`${label} locked`}
        className={className}
        title={`${label} locked`}
        type="button"
      >
        <Icon name={icon} />
        {!collapsed && <span className="flex-1 text-left">{label}</span>}
        {!collapsed && (
          <LockKeyhole aria-hidden="true" size={15} strokeWidth={2.5} />
        )}
      </button>
    );
  }

  return (
    <Link
      aria-current={active ? "page" : undefined}
      aria-label={label}
      className={className}
      href={href}
      onClick={onNavigate}
      title={label}
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
  resolveAccess,
}: {
  activeItem?: string;
  children: NavigationChild[];
  collapsed: boolean;
  icon: IconName;
  label: string;
  onNavigate?: () => void;
  resolveAccess: (route: AdminRouteKey) => boolean;
}) {
  const [open, setOpen] = useState(true);
  const firstChild = children[0];
  const firstChildLocked = firstChild ? !resolveAccess(firstChild.accessRoute) : true;

  if (collapsed) {
    return (
      <NavigationLink
        collapsed={collapsed}
        disabled={firstChildLocked}
        href={firstChild?.href || "#"}
        icon={icon}
        label={label}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div className="w-full">
      <button
        aria-expanded={open}
        aria-label={label}
        className={`flex min-h-14 w-full items-center gap-4 px-5 text-[14px] transition ${
          open
            ? "bg-black text-white"
            : "text-black hover:bg-black hover:text-white"
        }`}
        onClick={() => setOpen((value) => !value)}
        title={label}
        type="button"
      >
        <Icon name={icon} />
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown
          className={`transition ${open ? "rotate-180" : ""}`}
          size={18}
          strokeWidth={3}
        />
      </button>

      {open ? (
        <div className="w-full border-b border-black/20 bg-sidebar-header py-3 shadow-sm">
          {children.map((child) => (
            <NavigationChildLink
              active={child.label === activeItem}
              child={child}
              disabled={!resolveAccess(child.accessRoute)}
              key={child.label}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SidebarContent({
  activeItem,
  authContext,
  collapsed,
  isMobile = false,
  onClose,
  onToggleCollapse,
}: {
  activeItem: string;
  authContext: AuthContextData;
  collapsed: boolean;
  isMobile?: boolean;
  onClose?: () => void;
  onToggleCollapse?: () => void;
}) {
  const resolveAccess = (route: AdminRouteKey) =>
    hasAdminRouteAccess(authContext, route);

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
            aria-label="Close sidebar"
            className="rounded-md p-1 transition"
            onClick={onClose}
            type="button"
          >
            <X size={24} strokeWidth={3} />
          </button>
        ) : (
          <button
            aria-label="Toggle sidebar"
            className="rounded-md p-1 transition"
            onClick={onToggleCollapse}
            type="button"
          >
            <Menu size={24} strokeWidth={3} />
          </button>
        )}
      </div>

      <nav className="mt-8 grid" aria-label="Main navigation">
        {primaryItems.map((item) => (
          <NavigationLink
            active={item.label === activeItem}
            collapsed={collapsed}
            disabled={!resolveAccess(item.accessRoute)}
            key={item.label}
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
          resolveAccess={resolveAccess}
        >
          {[
            {
              accessRoute: "/services/pilates",
              href: "/services/pilates",
              label: "Pilates",
            },
          ]}
        </NavigationGroup>

        <NavigationLink
          active={activeItem === "Staff"}
          collapsed={collapsed}
          disabled={!resolveAccess("/staff")}
          href="/staff"
          icon="staff"
          label="Staff"
          onNavigate={onClose}
        />

        <NavigationLink
          active={activeItem === "Wallet"}
          collapsed={collapsed}
          disabled={!resolveAccess("/wallet")}
          href="/wallet"
          icon="wallet"
          label="Wallet"
          onNavigate={onClose}
        />

        {managementItems.map((item) => (
          <NavigationLink
            active={item.label === activeItem}
            collapsed={collapsed}
            disabled={!resolveAccess(item.accessRoute)}
            key={item.label}
            onNavigate={onClose}
            {...item}
          />
        ))}
      </nav>
    </>
  );
}

function NavigationChildLink({
  active,
  child,
  disabled,
  onNavigate,
}: {
  active: boolean;
  child: NavigationChild;
  disabled: boolean;
  onNavigate?: () => void;
}) {
  const className = `flex w-full items-center gap-2 px-[72px] py-2 text-left text-[16px] font-medium text-black transition ${
    disabled
      ? "cursor-not-allowed opacity-55"
      : "hover:bg-black/10"
  } ${active ? "bg-black/10" : ""}`;

  if (disabled) {
    return (
      <button
        aria-disabled="true"
        className={className}
        title={`${child.label} locked`}
        type="button"
      >
        <span className="flex-1">{child.label}</span>
        <LockKeyhole aria-hidden="true" size={14} strokeWidth={2.5} />
      </button>
    );
  }

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={className}
      href={child.href}
      onClick={onNavigate}
    >
      {child.label}
    </Link>
  );
}

export function Sidebar({
  activeItem = "Dashboard",
  authContext,
}: {
  activeItem?: string;
  authContext: AuthContextData;
}) {
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
      {mobileOpen ? (
        <button
          aria-label="Close sidebar overlay"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
          type="button"
        />
      ) : null}

      <aside
        className={`fixed bottom-0 left-0 top-0 z-50 flex w-[280px] shrink-0 flex-col bg-foreground py-4 text-black shadow-xl transition-transform duration-300 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent
          activeItem={activeItem}
          authContext={authContext}
          collapsed={false}
          isMobile
          onClose={() => setMobileOpen(false)}
        />
      </aside>

      <aside
        className={`relative z-20 hidden shrink-0 flex-col bg-foreground py-4 text-black transition-[width] duration-300 md:fixed md:bottom-0 md:left-0 md:top-20 md:flex md:overflow-y-auto ${width}`}
      >
        <SidebarContent
          activeItem={activeItem}
          authContext={authContext}
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
