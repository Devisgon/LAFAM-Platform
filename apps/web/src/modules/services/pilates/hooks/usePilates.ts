"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  pilatesClient,
  type CreatePilatesClassPayload,
  type CreatePilatesSchedulePayload,
  type PilatesClassDefinition,
  type PilatesSchedule,
  type UpdatePilatesClassPayload,
  type UpdatePilatesSchedulePayload,
} from "@/modules/services/pilates";
import { staffClient, type StaffMember } from "@/modules/staff";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "The Pilates request failed.";
}

type PilatesCache = {
  classes: PilatesClassDefinition[];
  schedules: PilatesSchedule[];
  trainers: StaffMember[];
};

const cacheKey = "lafam:admin:pilates";

function isPilatesCache(value: unknown): value is PilatesCache {
  if (!value || typeof value !== "object") return false;

  const cache = value as Partial<PilatesCache>;

  return (
    Array.isArray(cache.classes) &&
    Array.isArray(cache.schedules) &&
    Array.isArray(cache.trainers)
  );
}

function readCache(): PilatesCache | null {
  if (typeof window === "undefined") return null;

  try {
    const cached: unknown = JSON.parse(
      window.sessionStorage.getItem(cacheKey) ?? "null",
    );

    if (!isPilatesCache(cached)) {
      window.sessionStorage.removeItem(cacheKey);
      return null;
    }

    return cached;
  } catch {
    window.sessionStorage.removeItem(cacheKey);
    return null;
  }
}

function writeCache(cache: PilatesCache): void {
  try {
    window.sessionStorage.setItem(cacheKey, JSON.stringify(cache));
  } catch {
    // Cached data is an enhancement; requests still work when storage is unavailable.
  }
}

export function usePilates() {
  const [classes, setClasses] = useState<PilatesClassDefinition[]>([]);
  const [schedules, setSchedules] = useState<PilatesSchedule[]>([]);
  const [trainers, setTrainers] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasData = useRef(false);

  const load = useCallback(async () => {
    if (!hasData.current) setIsLoading(true);
    setError(null);
    try {
      const [classResult, scheduleResult, staffResult] = await Promise.all([
        pilatesClient.listClasses(),
        pilatesClient.listSchedules(),
        staffClient.list(),
      ]);
      const activeTrainers = staffResult.staff.filter(
        (member) =>
          member.portal_role === "trainer" &&
          member.staff_status !== "deleted" &&
          member.staff_status !== "deactivated",
      );
      setClasses(classResult.items);
      setSchedules(scheduleResult.items);
      setTrainers(activeTrainers);
      hasData.current = true;
      writeCache({
        classes: classResult.items,
        schedules: scheduleResult.items,
        trainers: activeTrainers,
      });
    } catch (requestError: unknown) {
      setError(message(requestError));
      throw requestError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const request = window.setTimeout(() => {
      const cached = readCache();

      if (cached) {
        setClasses(cached.classes);
        setSchedules(cached.schedules);
        setTrainers(cached.trainers);
        setIsLoading(false);
        hasData.current = true;
      }

      void load().catch(() => undefined);
    }, 0);

    return () => window.clearTimeout(request);
  }, [load]);

  const mutate = useCallback(async <T,>(request: () => Promise<T>) => {
    setIsMutating(true);
    setError(null);
    try {
      const result = await request();
      await load();
      return result;
    } catch (requestError: unknown) {
      setError(message(requestError));
      throw requestError;
    } finally {
      setIsMutating(false);
    }
  }, [load]);

  return {
    classes,
    schedules,
    trainers,
    isLoading,
    isMutating,
    error,
    load,
    getClass: pilatesClient.getClass,
    getSchedule: pilatesClient.getSchedule,
    createClass: (payload: CreatePilatesClassPayload) =>
      mutate(() => pilatesClient.createClass(payload)),
    updateClass: (id: string, payload: UpdatePilatesClassPayload) =>
      mutate(() => pilatesClient.updateClass(id, payload)),
    deleteClass: (id: string) => mutate(() => pilatesClient.deleteClass(id)),
    createSchedule: (payload: CreatePilatesSchedulePayload) =>
      mutate(() => pilatesClient.createSchedule(payload)),
    createSchedules: (payloads: CreatePilatesSchedulePayload[]) =>
      mutate(() => Promise.all(payloads.map((payload) => pilatesClient.createSchedule(payload)))),
    updateSchedule: (id: string, payload: UpdatePilatesSchedulePayload) =>
      mutate(() => pilatesClient.updateSchedule(id, payload)),
    cancelSchedule: (id: string, reason: string) =>
      mutate(() => pilatesClient.cancelSchedule(id, reason)),
    completeSchedule: (id: string) =>
      mutate(() => pilatesClient.completeSchedule(id)),
    deleteSchedule: (id: string) =>
      mutate(() => pilatesClient.deleteSchedule(id)),
  };
}
