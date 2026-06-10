"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { Badge } from "./reuseable_ui_components/badge";
import { Toast } from "./reuseable_ui_components/toast";

export type PilatesClass = {
  bookings: number;
  capacity: number;
  date: string;
  duration: number;
  id: string;
  name: string;
  status: "Scheduled" | "Full" | "Cancelled";
  studio: string;
  time: string;
  trainer: string;
};

const defaultTrainers = ["Sara Hassan", "Lina Ahmad", "Nour Al Salem", "Rania Khalid"];
const fieldClass = "min-h-10 w-full rounded-lg border border-background-secondary bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-primary";

function useStoredItems<T>(storageKey: string) {
  const subscribe = useCallback((onStoreChange: () => void) => {
    window.addEventListener("storage", onStoreChange);
    window.addEventListener(storageKey, onStoreChange);
    return () => {
      window.removeEventListener("storage", onStoreChange);
      window.removeEventListener(storageKey, onStoreChange);
    };
  }, [storageKey]);
  const savedItems = useSyncExternalStore(subscribe, () => window.localStorage.getItem(storageKey) ?? "[]", () => "[]");
  return useMemo(() => {
    try {
      const parsed = JSON.parse(savedItems) as unknown;
      return Array.isArray(parsed) ? parsed as T[] : [];
    } catch {
      return [];
    }
  }, [savedItems]);
}

function saveItems<T>(storageKey: string, items: T[]) {
  window.localStorage.setItem(storageKey, JSON.stringify(items));
  window.dispatchEvent(new Event(storageKey));
}

export function PilatesClassManager({ initialClasses }: { initialClasses: PilatesClass[] }) {
  const classChanges = useStoredItems<PilatesClass>("lafam-pilates-classes");
  const addedStaff = useStoredItems<{ name?: string }>("lafam-staff");
  const [editing, setEditing] = useState<PilatesClass | null>(null);
  const [toast, setToast] = useState<{ message: string; title: string; tone: "success" | "error" } | null>(null);
  const classes = [
    ...initialClasses.map((item) => classChanges.find((changed) => changed.id === item.id) ?? item),
    ...classChanges.filter((item) => !initialClasses.some((initial) => initial.id === item.id)),
  ];
  const trainerOptions = [...new Set([...defaultTrainers, ...addedStaff.map((staff) => staff.name).filter((name): name is string => Boolean(name))])];

  function hasConflict(trainer: string, date: string, time: string, ignoredId?: string) {
    return classes.some((item) => item.id !== ignoredId && item.status !== "Cancelled" && item.trainer === trainer && item.date === date && item.time === time);
  }

  function createClass(formData: FormData) {
    const trainer = String(formData.get("trainer"));
    const date = String(formData.get("date"));
    const time = String(formData.get("time"));
    if (hasConflict(trainer, date, time)) {
      setToast({ message: `${trainer} already has a class at this time.`, title: "Class not created", tone: "error" });
      return;
    }
    const item: PilatesClass = {
      id: `CLS-${String(classes.length + 1).padStart(3, "0")}`,
      name: String(formData.get("name")).trim(),
      trainer,
      date,
      time,
      studio: String(formData.get("studio")).trim(),
      duration: Number(formData.get("duration")),
      capacity: Number(formData.get("capacity")),
      bookings: 0,
      status: "Scheduled",
    };
    saveItems("lafam-pilates-classes", [...classChanges, item]);
    (document.getElementById("create-class-form") as HTMLFormElement | null)?.reset();
    window.history.replaceState(null, "", window.location.pathname);
    setToast({ message: `${item.name} was scheduled successfully.`, title: "Class created", tone: "success" });
  }

  function updateClass(formData: FormData) {
    if (!editing) return;
    const trainer = String(formData.get("trainer"));
    const date = String(formData.get("date"));
    const time = String(formData.get("time"));
    if (hasConflict(trainer, date, time, editing.id)) {
      setToast({ message: `${trainer} already has a class at this time.`, title: "Class not updated", tone: "error" });
      return;
    }
    const updated: PilatesClass = {
      ...editing,
      name: String(formData.get("name")).trim(),
      trainer,
      date,
      time,
      studio: String(formData.get("studio")).trim(),
      duration: Number(formData.get("duration")),
      capacity: Number(formData.get("capacity")),
    };
    saveItems("lafam-pilates-classes", [...classChanges.filter((item) => item.id !== updated.id), updated]);
    setEditing(null);
    setToast({ message: `${updated.name} was updated.`, title: "Class updated", tone: "success" });
  }

  function cancelClass(item: PilatesClass) {
    if (!window.confirm(`Cancel ${item.name}?`)) return;
    saveItems("lafam-pilates-classes", [...classChanges.filter((entry) => entry.id !== item.id), { ...item, status: "Cancelled" }]);
  }

  const classForm = (item?: PilatesClass) => (
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="grid gap-1.5 text-xs font-bold sm:col-span-2">Class name<input className={fieldClass} defaultValue={item?.name} maxLength={80} name="name" required /></label>
      <label className="grid gap-1.5 text-xs font-bold">Assigned trainer<select className={fieldClass} defaultValue={item?.trainer} name="trainer" required>{trainerOptions.map((trainer) => <option key={trainer}>{trainer}</option>)}</select></label>
      <label className="grid gap-1.5 text-xs font-bold">Studio<input className={fieldClass} defaultValue={item?.studio} maxLength={50} name="studio" required /></label>
      <label className="grid gap-1.5 text-xs font-bold">Date<input className={fieldClass} defaultValue={item?.date} min="2026-06-08" name="date" required type="date" /></label>
      <label className="grid gap-1.5 text-xs font-bold">Time<input className={fieldClass} defaultValue={item?.time} name="time" required type="time" /></label>
      <label className="grid gap-1.5 text-xs font-bold">Duration in minutes<input className={fieldClass} defaultValue={item?.duration} max="180" min="15" name="duration" required type="number" /></label>
      <label className="grid gap-1.5 text-xs font-bold">Capacity<input className={fieldClass} defaultValue={item?.capacity} max="50" min="1" name="capacity" required type="number" /></label>
    </div>
  );

  return (
    <>
      <section className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div ><p className="mt-1 text-sm text-text-secondary">{classes.filter((item) => item.status !== "Cancelled").length} active classes</p></div>
      </section>
      <section className="overflow-hidden rounded-xl border border-background-secondary bg-card-bg-primary shadow-sm" aria-labelledby="classes-heading">
        <header className="border-b border-background-secondary bg-card-bg-secondary px-5 py-4"><h3 className="font-bold text-text-primary" id="classes-heading">Scheduled classes</h3><p className="mt-0.5 text-xs text-text-secondary">Create and manage class schedules directly.</p></header>
        <div className="overflow-x-auto"><table className="w-full min-w-[950px] border-collapse text-left text-xs">
          <thead><tr className="border-b border-background-secondary text-text-secondary">{["Class", "Trainer", "Date and time", "Studio", "Duration", "Bookings", "Status", "Actions"].map((heading) => <th className="px-5 py-3 font-bold" key={heading}>{heading}</th>)}</tr></thead>
          <tbody>{classes.map((item) => <tr className="border-b border-background-secondary last:border-0 hover:bg-card-bg-secondary" key={item.id}>
            <td className="px-5 py-4"><strong className="text-text-primary">{item.name}</strong><span className="mt-0.5 block font-mono text-text-secondary">{item.id}</span></td>
            <td className="px-5 py-4 text-text-primary">{item.trainer}</td><td className="px-5 py-4 text-text-primary"><strong>{item.date}</strong><span className="block text-text-secondary">{item.time}</span></td>
            <td className="px-5 py-4 text-text-secondary">{item.studio}</td><td className="px-5 py-4 text-text-primary">{item.duration} min</td><td className="px-5 py-4 text-text-primary">{item.bookings}/{item.capacity}</td>
            <td className="px-5 py-4"><Badge tone={item.status === "Full" ? "warning" : item.status === "Cancelled" ? "error" : "success"}>{item.status}</Badge></td>
            <td className="px-5 py-4"><div className="flex gap-3"><button className="font-bold text-primary" onClick={() => setEditing(item)} type="button">Edit</button>{item.status !== "Cancelled" && <button className="font-bold text-error" onClick={() => cancelClass(item)} type="button">Cancel</button>}</div></td>
          </tr>)}</tbody>
        </table></div>
      </section>
      <section aria-labelledby="create-class-title" aria-modal="true" className="fixed inset-0 z-50 hidden items-center justify-center bg-slate-950/60 p-4 target:flex" id="create-class" role="dialog">
        <a aria-label="Close class form" className="absolute inset-0" href="#classes-heading" /><form action={createClass} className="relative z-10 w-full max-w-2xl rounded-2xl border border-background-secondary bg-card-bg-primary p-6 text-text-primary shadow-2xl" id="create-class-form"><a className="absolute right-4 top-4" href="#classes-heading">X</a><h2 className="text-xl font-bold" id="create-class-title">Create Pilates class</h2>{classForm()}<footer className="mt-6 flex justify-end gap-2 border-t border-background-secondary pt-4"><a className="rounded-lg border border-background-secondary px-4 py-2 text-xs font-bold" href="#classes-heading">Cancel</a><button className="rounded-lg bg-button-primary px-4 py-2 text-xs font-bold text-white" type="submit">Create class</button></footer></form>
      </section>
      {editing && <section aria-labelledby="edit-class-title" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog"><button className="absolute inset-0" onClick={() => setEditing(null)} type="button" /><form action={updateClass} className="relative z-10 w-full max-w-2xl rounded-2xl border border-background-secondary bg-card-bg-primary p-6 text-text-primary shadow-2xl"><button className="absolute right-4 top-4" onClick={() => setEditing(null)} type="button">X</button><h2 className="text-xl font-bold" id="edit-class-title">Edit class</h2>{classForm(editing)}<footer className="mt-6 flex justify-end gap-2 border-t border-background-secondary pt-4"><button className="rounded-lg border border-background-secondary px-4 py-2 text-xs font-bold" onClick={() => setEditing(null)} type="button">Close</button><button className="rounded-lg bg-button-primary px-4 py-2 text-xs font-bold text-white" type="submit">Save class</button></footer></form></section>}
      {toast && <div className="fixed right-4 top-4 z-[70]"><Toast onDismiss={() => setToast(null)} title={toast.title} tone={toast.tone}>{toast.message}</Toast></div>}
    </>
  );
}
