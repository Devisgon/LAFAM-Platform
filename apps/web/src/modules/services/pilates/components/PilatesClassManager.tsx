"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { usePilates } from "@/modules/services/pilates";
import type { PilatesSchedule } from "@/modules/services/pilates";
import { ClassCard } from "@/components/data-display/ClassCard";
import { LoadingState } from "@/components/data-display/LoadingState";
import { Toast } from "@/components/ui/Toast";

import {
  bookingSummary,
  classListButtonClass,
  classPayload,
  defaultBookingSummary,
  scheduleStartTimestamp,
} from "../utils/pilatesClassListUtils";
import { CreateClassCard } from "./class-list/CreateClassCard";

export function PilatesClassManager() {
  const api = usePilates();
  const [isCreateMode, setIsCreateMode] = useState(() =>
    typeof window === "undefined" ? false : window.location.hash === "#create-class",
  );
  const [toast, setToast] = useState<{
    message: string;
    title: string;
    tone: "success" | "error";
  } | null>(null);

  useEffect(() => {
    const syncCreateMode = () => {
      setIsCreateMode(window.location.hash === "#create-class");
    };

    window.addEventListener("hashchange", syncCreateMode);
    return () => window.removeEventListener("hashchange", syncCreateMode);
  }, []);

  const upcomingBookingByClassId = useMemo(() => {
    const nextSchedules = new Map<string, PilatesSchedule>();

    api.schedules.forEach((schedule) => {
      if (schedule.status !== "scheduled") return;

      const startsAt = scheduleStartTimestamp(schedule);
      if (!Number.isFinite(startsAt)) return;

      const current = nextSchedules.get(schedule.class_id);
      if (!current || startsAt < scheduleStartTimestamp(current)) {
        nextSchedules.set(schedule.class_id, schedule);
      }
    });

    return nextSchedules;
  }, [api.schedules]);

  const createClass = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const created = await api.createClass(classPayload(form));
      form.reset();
      window.history.replaceState(null, "", window.location.pathname);
      setIsCreateMode(false);
      setToast({
        message: `${created.title} is ready to manage and schedule.`,
        title: "Class created",
        tone: "success",
      });
    } catch (error: unknown) {
      setToast({
        message: error instanceof Error ? error.message : "The class could not be created.",
        title: "Class not created",
        tone: "error",
      });
    }
  };

  if (api.isLoading) {
    return <LoadingState className="p-6" label="Loading Pilates classes" />;
  }

  return (
    <>
      {api.error ? (
        <section className="mb-5 rounded-xl border border-error/30 bg-error/10 p-4">
          <p className="text-sm text-error" role="alert">{api.error}</p>
          <button className={`${classListButtonClass} mt-3`} onClick={() => void api.load()} type="button">Try again</button>
        </section>
      ) : null}

      {isCreateMode ? (
        <section className="px-8">
          <CreateClassCard
            isSaving={api.isMutating}
            onCancel={() => {
              window.history.replaceState(null, "", window.location.pathname);
              setIsCreateMode(false);
            }}
            onSubmit={createClass}
          />
        </section>
      ) : (
        <section className="grid gap-7 px-8" aria-labelledby="pilates-classes-heading">
          <header className="flex min-h-22 items-center justify-between gap-4 rounded-md bg-card-bg-primary px-5 shadow-lg shadow-slate-900/10 md:px-6">
            <h2 className="text-2xl font-medium text-txt-primary" id="pilates-classes-heading">Pilates classes</h2>
            <button
              className="inline-flex min-h-12 items-center rounded-sm bg-button-primary px-5 text-base font-semibold text-txt-primary transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              onClick={() => {
                window.history.replaceState(null, "", "#create-class");
                setIsCreateMode(true);
              }}
              type="button"
            >
              + Create New Class
            </button>
          </header>

          <div className="grid gap-5">
            {api.classes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-background-secondary bg-card-bg-primary p-10 text-center text-sm text-txt-secondary">
                No Pilates classes found. Create a new class to get started.
              </div>
            ) : (
              api.classes.map((item) => {
                const upcomingSchedule = upcomingBookingByClassId.get(item.id);

                return (
                  <ClassCard
                    actionHref={`/services/pilates/${item.id}`}
                    actionLabel="Manage class"
                    bookingSummary={
                      upcomingSchedule
                        ? bookingSummary(upcomingSchedule)
                        : defaultBookingSummary(item.default_capacity)
                    }
                    item={item}
                    key={item.id}
                  />
                );
              })
            )}
          </div>
        </section>
      )}

      {toast ? (
        <div className="fixed right-4 top-4 z-[90]">
          <Toast onDismiss={() => setToast(null)} title={toast.title} tone={toast.tone}>{toast.message}</Toast>
        </div>
      ) : null}
    </>
  );
}
