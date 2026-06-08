"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { Avatar } from "./reuseable_ui_components/avatar";
import { Badge } from "./reuseable_ui_components/badge";
import { Toast } from "./reuseable_ui_components/toast";

export type StaffMember = {
  avatarTone: string;
  availability: string;
  bio: string;
  days: string;
  id: string;
  name: string;
  specialties: string[];
  status: "Available" | "On leave";
};

type ResultToast = {
  message: string;
  title: string;
  tone: "success" | "error";
};

const inputClass =
  "min-h-10 w-full rounded-lg border border-background-secondary bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-primary";

export function StaffDirectory({
  initialStaff,
  label,
  pluralLabel,
  storageKey,
  prefix,
}: {
  initialStaff: StaffMember[];
  label: string;
  pluralLabel: string;
  storageKey: string;
  prefix: string;
}) {
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [toast, setToast] = useState<ResultToast | null>(null);
  const subscribe = useCallback((onStoreChange: () => void) => {
    window.addEventListener("storage", onStoreChange);
    window.addEventListener(storageKey, onStoreChange);

    return () => {
      window.removeEventListener("storage", onStoreChange);
      window.removeEventListener(storageKey, onStoreChange);
    };
  }, [storageKey]);
  const savedStaff = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(storageKey) ?? "[]",
    () => "[]",
  );
  const customStaff = useMemo(() => {
    try {
      const parsedStaff = JSON.parse(savedStaff) as unknown;
      return Array.isArray(parsedStaff) ? parsedStaff as StaffMember[] : [];
    } catch {
      return [];
    }
  }, [savedStaff]);
  const staff = [...initialStaff, ...customStaff];

  function createStaff(formData: FormData) {
    try {
      const name = String(formData.get("name")).trim();
      if (staff.some((member) => member.name.toLowerCase() === name.toLowerCase())) {
        setToast({ message: `${name} already exists in the ${label.toLowerCase()} directory.`, title: "Staff not created", tone: "error" });
        return;
      }
      const createdStaff: StaffMember = {
        id: `${prefix}-${String(staff.length + 1).padStart(3, "0")}`,
        name,
        bio: String(formData.get("bio")).trim(),
        specialties: String(formData.get("specialties")).split(",").map((specialty) => specialty.trim()).filter(Boolean),
        availability: `${String(formData.get("startTime"))} - ${String(formData.get("endTime"))}`,
        days: String(formData.get("days")).trim(),
        status: formData.get("status") === "On leave" ? "On leave" : "Available",
        avatarTone: "bg-primary/10 text-primary",
      };

      window.localStorage.setItem(storageKey, JSON.stringify([...customStaff, createdStaff]));
      window.dispatchEvent(new Event(storageKey));
      (document.getElementById("add-staff-form") as HTMLFormElement | null)?.reset();
      window.history.replaceState(null, "", window.location.pathname);
      setToast({ message: `${createdStaff.name} was added with staff ID ${createdStaff.id}.`, title: `${label} created`, tone: "success" });
    } catch {
      setToast({ message: "The staff record could not be saved. Please try again.", title: "Staff not created", tone: "error" });
    }
  }

  return (
    <>
      <section className="mb-5" aria-labelledby="staff-directory-heading">
        <h2 className="mt-1 text-xl font-bold text-text-primary" id="staff-directory-heading">{label} directory</h2>
        <p className="mt-1 text-sm text-text-secondary">
          {staff.length} {pluralLabel} | {staff.filter((member) => member.status === "Available").length} available today
        </p>
      </section>

      <section className="overflow-hidden rounded-xl border border-background-secondary bg-card-bg-primary shadow-sm" aria-label={`${label} staff list`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-background-secondary bg-card-bg-secondary text-text-secondary">
                {["Staff member", "Staff ID", "Bio", "Available time", "Status", "Actions"].map((heading) => (
                  <th className="px-5 py-3 font-bold" key={heading}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => (
                <tr className="border-b border-background-secondary last:border-0 hover:bg-card-bg-secondary" key={member.id}>
                  <td className="px-5 py-4">
                    <span className="flex items-center gap-3 font-bold text-text-primary">
                      <Avatar alt={`${member.name} avatar`} className={member.avatarTone} name={member.name} size="sm" />
                      {member.name}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-mono text-text-secondary">{member.id}</td>
                  <td className="max-w-72 px-5 py-4 leading-5 text-text-secondary">{member.bio}</td>
                  <td className="px-5 py-4 text-text-primary">
                    <strong>{member.availability}</strong>
                    <span className="mt-0.5 block text-text-secondary">{member.days}</span>
                  </td>
                  <td className="px-5 py-4">
                    <Badge tone={member.status === "Available" ? "success" : "warning"}>{member.status}</Badge>
                  </td>
                  <td className="px-5 py-4">
                    <button className="font-bold text-primary hover:underline" onClick={() => setSelectedStaff(member)} type="button">
                      View profile
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="border-t border-background-secondary px-5 py-3 text-xs text-text-secondary">
          Showing all {staff.length} {pluralLabel}
        </footer>
      </section>

      <section
        aria-labelledby="add-staff-title"
        aria-modal="true"
        className="fixed inset-0 z-50 hidden items-center justify-center overflow-y-auto bg-slate-950/60 p-4 target:flex"
        id="add-staff"
        role="dialog"
      >
        <a aria-label="Close add staff form" className="absolute inset-0 cursor-default" href="#staff-directory-heading" />
        <form
          action={createStaff}
          className="relative z-10 my-auto w-full max-w-2xl rounded-2xl border border-background-secondary bg-card-bg-primary p-6 text-text-primary shadow-2xl"
          id="add-staff-form"
        >
          <a aria-label="Close add staff form" className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full bg-background-secondary text-text-secondary hover:text-text-primary" href="#staff-directory-heading">X</a>
          <h2 className="text-xl font-bold" id="add-staff-title">Add new {label.toLowerCase()}</h2>
          <p className="mt-1 text-sm text-text-secondary">Enter the staff member&apos;s profile and availability details.</p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-bold">Full name<input autoComplete="name" className={inputClass} maxLength={80} name="name" required /></label>
            <label className="grid gap-1.5 text-xs font-bold">Working days<input className={inputClass} maxLength={40} name="days" placeholder="Sun - Thu" required /></label>
            <label className="grid gap-1.5 text-xs font-bold">Start time<input className={inputClass} name="startTime" required type="time" /></label>
            <label className="grid gap-1.5 text-xs font-bold">End time<input className={inputClass} name="endTime" required type="time" /></label>
            <label className="grid gap-1.5 text-xs font-bold sm:col-span-2">Specialties<input className={inputClass} maxLength={120} name="specialties" placeholder="Separate specialties with commas" required /></label>
            <label className="grid gap-1.5 text-xs font-bold sm:col-span-2">Bio<textarea className={`${inputClass} min-h-24 resize-y`} maxLength={300} name="bio" required /></label>
            <label className="grid gap-1.5 text-xs font-bold">Status
              <select className={inputClass} defaultValue="Available" name="status">
                <option>Available</option>
                <option>On leave</option>
              </select>
            </label>
          </div>

          <footer className="mt-6 flex justify-end gap-2 border-t border-background-secondary pt-4">
            <a className="rounded-lg border border-background-secondary px-4 py-2 text-xs font-bold hover:bg-background-secondary" href="#staff-directory-heading">Cancel</a>
            <button className="rounded-lg bg-button-primary px-4 py-2 text-xs font-bold text-white hover:opacity-90" type="submit">Create {label.toLowerCase()}</button>
          </footer>
        </form>
      </section>

      {selectedStaff && (
        <section aria-labelledby="profile-title" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog">
          <button aria-label="Close profile" className="absolute inset-0 cursor-default" onClick={() => setSelectedStaff(null)} type="button" />
          <article className="relative z-10 w-full max-w-xl rounded-2xl border border-background-secondary bg-card-bg-primary p-6 text-text-primary shadow-2xl">
            <button aria-label="Close profile" className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full bg-background-secondary text-text-secondary hover:text-text-primary" onClick={() => setSelectedStaff(null)} type="button">X</button>
            <header className="flex items-start gap-4 pr-10">
              <Avatar alt={`${selectedStaff.name} avatar`} className={selectedStaff.avatarTone} name={selectedStaff.name} size="lg" />
              <div>
                <h3 className="text-xl font-bold" id="profile-title">{selectedStaff.name}</h3>
                <p className="mt-1 font-mono text-xs text-text-secondary">{selectedStaff.id}</p>
                <Badge className="mt-3" tone={selectedStaff.status === "Available" ? "success" : "warning"}>{selectedStaff.status}</Badge>
              </div>
            </header>
            <p className="mt-5 border-y border-background-secondary py-4 text-sm leading-6 text-text-secondary">{selectedStaff.bio}</p>
            <dl className="mt-5 grid gap-5 sm:grid-cols-2">
              <div><dt className="text-xs font-bold uppercase tracking-wide text-text-secondary">Available time</dt><dd className="mt-2 text-sm font-bold">{selectedStaff.availability}</dd><dd className="mt-1 text-xs text-text-secondary">{selectedStaff.days}</dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-wide text-text-secondary">Specialties</dt><dd className="mt-2 flex flex-wrap gap-2">{selectedStaff.specialties.map((specialty) => <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary" key={specialty}>{specialty}</span>)}</dd></div>
            </dl>
          </article>
        </section>
      )}
      {toast && (
        <div className="fixed right-4 top-4 z-[70]">
          <Toast onDismiss={() => setToast(null)} title={toast.title} tone={toast.tone}>{toast.message}</Toast>
        </div>
      )}
    </>
  );
}
