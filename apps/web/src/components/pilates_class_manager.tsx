"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { Badge } from "./reuseable_ui_components/badge";
import { Toast } from "./reuseable_ui_components/toast";

export type PilatesCourse = {
  capacity: number;
  description: string;
  duration: number;
  id: string;
  level: "Beginner" | "Intermediate" | "Advanced" | "All levels";
  name: string;
};

export type PilatesClass = {
  bookings: number;
  courseId: string;
  date: string;
  id: string;
  status: "Scheduled" | "Full" | "Cancelled";
  studio: string;
  time: string;
  trainer: string;
};

type ResultToast = {
  message: string;
  title: string;
  tone: "success" | "error";
};

const trainers = ["Sara Hassan", "Lina Ahmad", "Nour Al Salem", "Rania Khalid"];
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

export function PilatesClassManager({
  initialClasses,
  initialCourses,
}: {
  initialClasses: PilatesClass[];
  initialCourses: PilatesCourse[];
}) {
  const customCourses = useStoredItems<PilatesCourse>("lafam-pilates-courses");
  const classChanges = useStoredItems<PilatesClass>("lafam-pilates-classes");
  const addedTrainers = useStoredItems<{ name?: string }>("lafam-trainers");
  const [rescheduling, setRescheduling] = useState<PilatesClass | null>(null);
  const [toast, setToast] = useState<ResultToast | null>(null);
  const courses = [...initialCourses, ...customCourses];
  const classes = [
    ...initialClasses.map((item) => classChanges.find((changed) => changed.id === item.id) ?? item),
    ...classChanges.filter((item) => !initialClasses.some((initial) => initial.id === item.id)),
  ];
  const trainerOptions = [...new Set([...trainers, ...addedTrainers.map((trainer) => trainer.name).filter((name): name is string => Boolean(name))])];

  function createCourse(formData: FormData) {
    try {
      const name = String(formData.get("name")).trim();
      if (courses.some((course) => course.name.toLowerCase() === name.toLowerCase())) {
        setToast({ message: `${name} already exists in the course catalog.`, title: "Course not created", tone: "error" });
        return;
      }
      const course: PilatesCourse = {
        id: `CRS-${String(courses.length + 1).padStart(3, "0")}`,
        name,
        description: String(formData.get("description")).trim(),
        level: String(formData.get("level")) as PilatesCourse["level"],
        duration: Number(formData.get("duration")),
        capacity: Number(formData.get("capacity")),
      };
      saveItems("lafam-pilates-courses", [...customCourses, course]);
      (document.getElementById("create-course-form") as HTMLFormElement | null)?.reset();
      window.history.replaceState(null, "", window.location.pathname);
      setToast({ message: `${course.name} is now available for class scheduling.`, title: "Course created", tone: "success" });
    } catch {
      setToast({ message: "The course could not be saved. Please try again.", title: "Course not created", tone: "error" });
    }
  }

  function createClass(formData: FormData) {
    try {
      const trainer = String(formData.get("trainer"));
      const date = String(formData.get("date"));
      const time = String(formData.get("time"));
      const hasConflict = classes.some((item) => item.status !== "Cancelled" && item.trainer === trainer && item.date === date && item.time === time);
      if (hasConflict) {
        setToast({ message: `${trainer} already has a class at ${time} on ${date}.`, title: "Class not scheduled", tone: "error" });
        return;
      }
      const scheduledClass: PilatesClass = {
        id: `CLS-${String(classes.length + 1).padStart(3, "0")}`,
        courseId: String(formData.get("courseId")),
        trainer,
        date,
        time,
        studio: String(formData.get("studio")).trim(),
        bookings: 0,
        status: "Scheduled",
      };
      saveItems("lafam-pilates-classes", [...classChanges, scheduledClass]);
      (document.getElementById("create-class-form") as HTMLFormElement | null)?.reset();
      window.history.replaceState(null, "", window.location.pathname);
      setToast({ message: `${courseName(scheduledClass.courseId)} was assigned to ${trainer} on ${date} at ${time}.`, title: "Class scheduled", tone: "success" });
    } catch {
      setToast({ message: "The class could not be scheduled. Please try again.", title: "Class not scheduled", tone: "error" });
    }
  }

  function rescheduleClass(formData: FormData) {
    if (!rescheduling) {
      setToast({ message: "Select a class before attempting to reschedule it.", title: "Class not updated", tone: "error" });
      return;
    }
    try {
      const trainer = String(formData.get("trainer"));
      const date = String(formData.get("date"));
      const time = String(formData.get("time"));
      const hasConflict = classes.some((item) => item.id !== rescheduling.id && item.status !== "Cancelled" && item.trainer === trainer && item.date === date && item.time === time);
      if (hasConflict) {
        setToast({ message: `${trainer} already has a class at ${time} on ${date}.`, title: "Class not updated", tone: "error" });
        return;
      }
      const updatedClass: PilatesClass = { ...rescheduling, date, time, trainer, studio: String(formData.get("studio")).trim() };
      saveItems("lafam-pilates-classes", [...classChanges.filter((item) => item.id !== updatedClass.id), updatedClass]);
      setRescheduling(null);
      setToast({ message: `${courseName(updatedClass.courseId)} was moved to ${date} at ${time}.`, title: "Class rescheduled", tone: "success" });
    } catch {
      setToast({ message: "The class schedule could not be updated. Please try again.", title: "Class not updated", tone: "error" });
    }
  }

  const courseName = (courseId: string) => courses.find((course) => course.id === courseId)?.name ?? "Unknown course";

  return (
    <>
      <section className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Pilates courses and classes</h2>
          <p className="mt-1 text-sm text-text-secondary">{courses.length} courses | {classes.filter((item) => item.status !== "Cancelled").length} scheduled classes</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="rounded-lg border border-primary px-4 py-2 text-xs font-bold text-primary hover:bg-primary/10" href="#create-course">+ New course</a>
          <a className="rounded-lg bg-button-primary px-4 py-2 text-xs font-bold text-white hover:opacity-90" href="#create-class">+ Schedule class</a>
        </div>
      </section>

      <section className="mb-6 overflow-hidden rounded-xl border border-background-secondary bg-card-bg-primary shadow-sm" aria-labelledby="courses-heading">
        <header className="border-b border-background-secondary bg-card-bg-secondary px-5 py-4">
          <h3 className="font-bold text-text-primary" id="courses-heading">Course catalog</h3>
          <p className="mt-0.5 text-xs text-text-secondary">Reusable Pilates programs available for class scheduling.</p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <thead><tr className="border-b border-background-secondary text-text-secondary">{["Course", "Course ID", "Level", "Duration", "Capacity", "Description"].map((heading) => <th className="px-5 py-3 font-bold" key={heading}>{heading}</th>)}</tr></thead>
            <tbody>
              {courses.map((course) => (
                <tr className="border-b border-background-secondary last:border-0 hover:bg-card-bg-secondary" key={course.id}>
                  <td className="px-5 py-4 font-bold text-text-primary">{course.name}</td>
                  <td className="px-5 py-4 font-mono text-text-secondary">{course.id}</td>
                  <td className="px-5 py-4"><Badge tone="info">{course.level}</Badge></td>
                  <td className="px-5 py-4 text-text-primary">{course.duration} min</td>
                  <td className="px-5 py-4 text-text-primary">{course.capacity} members</td>
                  <td className="max-w-80 px-5 py-4 text-text-secondary">{course.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-background-secondary bg-card-bg-primary shadow-sm" aria-labelledby="classes-heading">
        <header className="border-b border-background-secondary bg-card-bg-secondary px-5 py-4">
          <h3 className="font-bold text-text-primary" id="classes-heading">Scheduled classes</h3>
          <p className="mt-0.5 text-xs text-text-secondary">Assign trainers and manage upcoming class times.</p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-xs">
            <thead><tr className="border-b border-background-secondary text-text-secondary">{["Class", "Class ID", "Trainer", "Date and time", "Studio", "Bookings", "Status", "Actions"].map((heading) => <th className="px-5 py-3 font-bold" key={heading}>{heading}</th>)}</tr></thead>
            <tbody>
              {classes.map((item) => {
                const course = courses.find((candidate) => candidate.id === item.courseId);
                return (
                  <tr className="border-b border-background-secondary last:border-0 hover:bg-card-bg-secondary" key={item.id}>
                    <td className="px-5 py-4 font-bold text-text-primary">{courseName(item.courseId)}</td>
                    <td className="px-5 py-4 font-mono text-text-secondary">{item.id}</td>
                    <td className="px-5 py-4 text-text-primary">{item.trainer}</td>
                    <td className="px-5 py-4 text-text-primary"><strong>{item.date}</strong><span className="mt-0.5 block text-text-secondary">{item.time}</span></td>
                    <td className="px-5 py-4 text-text-secondary">{item.studio}</td>
                    <td className="px-5 py-4 text-text-primary">{item.bookings}/{course?.capacity ?? 0}</td>
                    <td className="px-5 py-4"><Badge tone={item.status === "Full" ? "warning" : item.status === "Cancelled" ? "error" : "success"}>{item.status}</Badge></td>
                    <td className="px-5 py-4"><button className="font-bold text-primary hover:underline" onClick={() => setRescheduling(item)} type="button">Reschedule</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="create-course-title" aria-modal="true" className="fixed inset-0 z-50 hidden items-center justify-center overflow-y-auto bg-slate-950/60 p-4 target:flex" id="create-course" role="dialog">
        <a aria-label="Close course form" className="absolute inset-0 cursor-default" href="#courses-heading" />
        <form action={createCourse} className="relative z-10 my-auto w-full max-w-2xl rounded-2xl border border-background-secondary bg-card-bg-primary p-6 text-text-primary shadow-2xl" id="create-course-form">
          <a aria-label="Close course form" className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full bg-background-secondary text-text-secondary" href="#courses-heading">X</a>
          <h2 className="text-xl font-bold" id="create-course-title">Create Pilates course</h2>
          <p className="mt-1 text-sm text-text-secondary">Define a reusable course before scheduling its classes.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-bold sm:col-span-2">Course name<input className={fieldClass} maxLength={80} name="name" required /></label>
            <label className="grid gap-1.5 text-xs font-bold">Level<select className={fieldClass} name="level"><option>Beginner</option><option>Intermediate</option><option>Advanced</option><option>All levels</option></select></label>
            <label className="grid gap-1.5 text-xs font-bold">Duration in minutes<input className={fieldClass} max="180" min="15" name="duration" required type="number" /></label>
            <label className="grid gap-1.5 text-xs font-bold">Class capacity<input className={fieldClass} max="50" min="1" name="capacity" required type="number" /></label>
            <label className="grid gap-1.5 text-xs font-bold sm:col-span-2">Description<textarea className={`${fieldClass} min-h-24 resize-y`} maxLength={300} name="description" required /></label>
          </div>
          <footer className="mt-6 flex justify-end gap-2 border-t border-background-secondary pt-4"><a className="rounded-lg border border-background-secondary px-4 py-2 text-xs font-bold" href="#courses-heading">Cancel</a><button className="rounded-lg bg-button-primary px-4 py-2 text-xs font-bold text-white" type="submit">Create course</button></footer>
        </form>
      </section>

      <section aria-labelledby="create-class-title" aria-modal="true" className="fixed inset-0 z-50 hidden items-center justify-center overflow-y-auto bg-slate-950/60 p-4 target:flex" id="create-class" role="dialog">
        <a aria-label="Close class form" className="absolute inset-0 cursor-default" href="#classes-heading" />
        <form action={createClass} className="relative z-10 my-auto w-full max-w-2xl rounded-2xl border border-background-secondary bg-card-bg-primary p-6 text-text-primary shadow-2xl" id="create-class-form">
          <a aria-label="Close class form" className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full bg-background-secondary text-text-secondary" href="#classes-heading">X</a>
          <h2 className="text-xl font-bold" id="create-class-title">Schedule Pilates class</h2>
          <p className="mt-1 text-sm text-text-secondary">Choose a course, assign its trainer, and set the class schedule.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-bold">Course<select className={fieldClass} name="courseId" required>{courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label>
            <label className="grid gap-1.5 text-xs font-bold">Assigned trainer<select className={fieldClass} name="trainer" required>{trainerOptions.map((trainer) => <option key={trainer}>{trainer}</option>)}</select></label>
            <label className="grid gap-1.5 text-xs font-bold">Date<input className={fieldClass} min="2026-06-08" name="date" required type="date" /></label>
            <label className="grid gap-1.5 text-xs font-bold">Time<input className={fieldClass} name="time" required type="time" /></label>
            <label className="grid gap-1.5 text-xs font-bold sm:col-span-2">Studio<input className={fieldClass} maxLength={50} name="studio" placeholder="Studio A" required /></label>
          </div>
          <footer className="mt-6 flex justify-end gap-2 border-t border-background-secondary pt-4"><a className="rounded-lg border border-background-secondary px-4 py-2 text-xs font-bold" href="#classes-heading">Cancel</a><button className="rounded-lg bg-button-primary px-4 py-2 text-xs font-bold text-white" type="submit">Schedule class</button></footer>
        </form>
      </section>

      {rescheduling && (
        <section aria-labelledby="reschedule-title" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4" role="dialog">
          <button aria-label="Close reschedule form" className="absolute inset-0 cursor-default" onClick={() => setRescheduling(null)} type="button" />
          <form action={rescheduleClass} className="relative z-10 my-auto w-full max-w-xl rounded-2xl border border-background-secondary bg-card-bg-primary p-6 text-text-primary shadow-2xl">
            <button aria-label="Close reschedule form" className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full bg-background-secondary text-text-secondary" onClick={() => setRescheduling(null)} type="button">X</button>
            <h2 className="text-xl font-bold" id="reschedule-title">Reschedule {courseName(rescheduling.courseId)}</h2>
            <p className="mt-1 text-sm text-text-secondary">Update the class time, studio, or assigned trainer.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-xs font-bold">Date<input className={fieldClass} defaultValue={rescheduling.date} min="2026-06-08" name="date" required type="date" /></label>
              <label className="grid gap-1.5 text-xs font-bold">Time<input className={fieldClass} defaultValue={rescheduling.time} name="time" required type="time" /></label>
              <label className="grid gap-1.5 text-xs font-bold">Assigned trainer<select className={fieldClass} defaultValue={rescheduling.trainer} name="trainer">{trainerOptions.map((trainer) => <option key={trainer}>{trainer}</option>)}</select></label>
              <label className="grid gap-1.5 text-xs font-bold">Studio<input className={fieldClass} defaultValue={rescheduling.studio} maxLength={50} name="studio" required /></label>
            </div>
            <footer className="mt-6 flex justify-end gap-2 border-t border-background-secondary pt-4"><button className="rounded-lg border border-background-secondary px-4 py-2 text-xs font-bold" onClick={() => setRescheduling(null)} type="button">Cancel</button><button className="rounded-lg bg-button-primary px-4 py-2 text-xs font-bold text-white" type="submit">Save new schedule</button></footer>
          </form>
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
