"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { LoadingState } from "@/components/data-display/LoadingState";
import { Toast } from "@/components/ui/Toast";
import { usePilates } from "@/modules/services/pilates";
import type { PilatesClassDefinition, PilatesSchedule } from "../api/pilatesApi";

import { buttonClass, classPayload, createSchedulePayloads, readDetailCache, updateSchedulePayload, writeDetailCache } from "../utils/pilatesDetailUtils";
import { ClassDetailCard } from "./class-detail/ClassDetailCard";
import { ClassEditForm } from "./class-detail/ClassEditForm";
import { InlineCard } from "./class-detail/PilatesDetailControls";
import { ScheduleForm } from "./class-detail/ScheduleForm";
import { ScheduleScreen } from "./class-detail/ScheduleScreen";

export function PilatesClassDetailManager({ classId }: { classId: string }) {
  const api = usePilates();
  const getClass = api.getClass;
  const [cachedDetail] = useState(() => readDetailCache(classId));
  const [detail, setDetail] = useState<PilatesClassDefinition | null>(
    cachedDetail,
  );
  const [isDetailLoading, setIsDetailLoading] = useState(!cachedDetail);
  const [editingClass, setEditingClass] = useState(false);
  const [editingSchedule, setEditingSchedule] =
    useState<PilatesSchedule | null>(null);
  const [creatingSchedule, setCreatingSchedule] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    title: string;
    tone: "success" | "error";
  } | null>(null);

  const schedules = api.schedules.filter((item) => item.class_id === classId);

  useEffect(() => {
    const request = window.setTimeout(async () => {
      if (!cachedDetail) setIsDetailLoading(true);
      try {
        const freshDetail = await getClass(classId);
        setDetail(freshDetail);
        writeDetailCache(classId, freshDetail);
      } catch (error: unknown) {
        if (!cachedDetail) {
          setToast({
            message:
              error instanceof Error
                ? error.message
                : "Class details could not be loaded.",
            title: "Class not loaded",
            tone: "error",
          });
        }
      } finally {
        setIsDetailLoading(false);
      }
    }, 0);
    return () => window.clearTimeout(request);
  }, [cachedDetail, classId, getClass]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const reloadDetail = async () => {
    const freshDetail = await getClass(classId);
    setDetail(freshDetail);
    writeDetailCache(classId, freshDetail);
  };

  const run = async (
    request: () => Promise<unknown>,
    title: string,
    message: string,
    close?: () => void,
  ) => {
    try {
      await request();
      await reloadDetail();
      close?.();
      setToast({ message, title, tone: "success" });
    } catch (error: unknown) {
      setToast({
        message: error instanceof Error ? error.message : "The action failed.",
        title: "Pilates action failed",
        tone: "error",
      });
    }
  };

  const updateClass = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = classPayload(event.currentTarget);
    void run(
      () => api.updateClass(classId, payload),
      "Class updated",
      `${payload.title} was updated.`,
      () => setEditingClass(false),
    );
  };

  const saveSchedule = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const current = editingSchedule;

    try {
      if (current) {
        const payload = updateSchedulePayload(event.currentTarget);
        void run(
          () => api.updateSchedule(current.id, payload),
          "Schedule updated",
          "The class schedule was updated.",
          () => {
            setEditingSchedule(null);
            setCreatingSchedule(false);
          },
        );
        return;
      }

      const payloads = createSchedulePayloads(event.currentTarget, classId);
      void run(
        () => api.createSchedules(payloads),
        "Schedule created",
        `${payloads.length} schedule series added to this class.`,
        () => {
          setEditingSchedule(null);
          setCreatingSchedule(false);
        },
      );
    } catch (error: unknown) {
      setToast({
        message:
          error instanceof Error
            ? error.message
            : "The schedule is incomplete.",
        title: "Schedule not ready",
        tone: "error",
      });
    }
  };

  const cancelSchedule = (item: PilatesSchedule) => {
    const reason = window.prompt("Why is this schedule being cancelled?");
    if (!reason?.trim()) return;
    void run(
      () => api.cancelSchedule(item.id, reason.trim()),
      "Schedule cancelled",
      "The schedule and cancellation reason were saved.",
    );
  };

  const completeSchedule = (item: PilatesSchedule) => {
    if (!window.confirm("Mark this schedule as completed?")) return;
    void run(
      () => api.completeSchedule(item.id),
      "Schedule completed",
      "The schedule was marked completed.",
    );
  };

  const deleteSchedule = (item: PilatesSchedule) => {
    if (!window.confirm("Delete this schedule?")) return;
    void run(
      () => api.deleteSchedule(item.id),
      "Schedule deleted",
      "The schedule was deleted.",
    );
  };

  if (api.isLoading || isDetailLoading) {
    return (
      <LoadingState className="p-6" label="Loading class management page" />
    );
  }

  if (!detail) {
    return (
      <section className="rounded-xl border border-error/30 bg-error/10 p-6">
        <p className="text-sm text-error">
          This Pilates class could not be loaded.
        </p>
        <Link className={`${buttonClass} mt-4`} href="/services/pilates">
          Back to classes
        </Link>
      </section>
    );
  }

  return (
    <>
      <nav className="mb-5 text-sm text-txt-secondary" aria-label="Breadcrumb">
        <Link
          className="inline-flex items-center gap-2 font-semibold text-primary hover:underline"
          href="/services/pilates"
        >
          <span aria-hidden="true">&larr;</span>
          Back to Pilates classes
        </Link>
      </nav>

      {editingClass ? (
        <InlineCard
          onClose={() => setEditingClass(false)}
          title={`Edit ${detail.title}`}
        >
          <ClassEditForm
            detail={detail}
            isSaving={api.isMutating}
            onClose={() => setEditingClass(false)}
            onSubmit={updateClass}
          />
        </InlineCard>
      ) : creatingSchedule || editingSchedule ? (
        <ScheduleScreen
          onClose={() => {
            setCreatingSchedule(false);
            setEditingSchedule(null);
          }}
          title={editingSchedule ? "Edit schedule" : `Schedule ${detail.title}`}
        >
          <ScheduleForm
            detail={detail}
            isSaving={api.isMutating}
            item={editingSchedule ?? undefined}
            onClose={() => {
              setCreatingSchedule(false);
              setEditingSchedule(null);
            }}
            onSubmit={saveSchedule}
            trainers={api.trainers}
          />
        </ScheduleScreen>
      ) : (
        <>
          <ClassDetailCard
            detail={detail}
            onCreateSchedule={() => setCreatingSchedule(true)}
            onEdit={() => setEditingClass(true)}
            schedules={schedules}
            onCancelSchedule={cancelSchedule}
            onCompleteSchedule={completeSchedule}
            onDeleteSchedule={deleteSchedule}
            onEditSchedule={setEditingSchedule}
          />
        </>
      )}

      {toast ? (
        <div className="fixed bottom-4 right-4 z-[90]">
          <Toast
            onDismiss={() => setToast(null)}
            title={toast.title}
            tone={toast.tone}
          >
            {toast.message}
          </Toast>
        </div>
      ) : null}
    </>
  );
}
