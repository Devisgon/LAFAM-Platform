"use client";

import { useState } from "react";
import { BookingExplorer, bookingsData } from "@/app/admin/bookings/page";
import { trainers } from "@/app/admin/staff/page";
import { StaffDirectory } from "./staff_directory";

type SettingsView = "users" | "history";

export function AdminSettings() {
  const [view, setView] = useState<SettingsView>("users");

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="self-start rounded-xl border border-background-secondary bg-card-bg-primary p-3 shadow-sm">
        <p className="px-3 pb-3 pt-2 text-xs font-bold uppercase tracking-wider text-text-secondary">Settings</p>
        <nav className="grid gap-1" aria-label="Settings pages">
          {[
            { id: "users" as const, label: "Users", description: "Staff accounts" },
            { id: "history" as const, label: "Booking history", description: "Previous bookings" },
          ].map((item) => (
            <button
              aria-current={view === item.id ? "page" : undefined}
              className={`rounded-lg px-3 py-2.5 text-left transition-colors ${view === item.id ? "bg-primary text-white" : "text-text-primary hover:bg-background-secondary"}`}
              key={item.id}
              onClick={() => setView(item.id)}
              type="button"
            >
              <strong className="block text-sm">{item.label}</strong>
              <span className={`mt-0.5 block text-xs ${view === item.id ? "text-white/75" : "text-text-secondary"}`}>{item.description}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="min-w-0 rounded-xl border border-background-secondary bg-card-bg-primary p-5 shadow-sm lg:p-6">
        {view === "users" ? (
          <>
            <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-background-secondary pb-5">
              <div><h2 className="text-xl font-bold text-text-primary">Users</h2><p className="mt-1 text-sm text-text-secondary">Create and manage staff member accounts.</p></div>
              <a className="rounded-lg bg-button-primary px-4 py-2 text-xs font-bold text-white hover:opacity-90" href="#add-staff">+ Create user</a>
            </header>
            <StaffDirectory initialStaff={trainers} label="Staff member" pluralLabel="staff members" prefix="STF" storageKey="lafam-staff" />
          </>
        ) : (
          <>
            <header className="border-b border-background-secondary pb-5"><h2 className="text-xl font-bold text-text-primary">Booking history</h2><p className="mt-1 text-sm text-text-secondary">Completed and cancelled booking records.</p></header>
            <BookingExplorer bookings={bookingsData} heading="Previous bookings" previousOnly />
          </>
        )}
      </section>
    </div>
  );
}
