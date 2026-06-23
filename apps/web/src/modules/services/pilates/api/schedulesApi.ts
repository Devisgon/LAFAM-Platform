import type { ApiResponse } from "@/modules/auth";
import { apiClient } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { PublicPilatesClass } from "./classesApi";

export type PublicScheduleStatus = "scheduled" | "cancelled" | "completed" | "deleted";
export type PublicScheduleGenerationSource = "single" | "recurring";
export type PublicScheduleSortField =
  | "class_date"
  | "start_time"
  | "status"
  | "generation_source"
  | "created_at"
  | "updated_at";
export type PublicScheduleSortDirection = "asc" | "desc";

export type PublicScheduleTrainer = {
  id: string;
  app_user_id: string;
  display_name: string;
  post_title: string;
  bio: string | null;
  specialties: string[];
  status: string;
};

export type PublicScheduleAvailability = {
  capacity: number;
  booked_count: number;
  available_seats: number;
  waitlist_count: number;
  waitlist_available: boolean;
  realtime_version: number;
};

export type PublicPilatesSchedule = {
  id: string;
  class: PublicPilatesClass;
  trainer: PublicScheduleTrainer;
  studio: string;
  class_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  capacity: number;
  price_amount?: number | null;
  currency?: "KWD" | null;
  status: PublicScheduleStatus;
  availability: PublicScheduleAvailability;
  realtime_version: number;
  series_id?: string | null;
  series_occurrence_index?: number | null;
  series_time_slot_id?: string | null;
  series_date_index?: number | null;
  series_slot_index?: number | null;
  generation_source?: PublicScheduleGenerationSource;
};

export type PublicScheduleFilters = {
  class_id?: string;
  trainer_staff_profile_id?: string;
  studio?: string;
  series_id?: string;
  generation_source?: PublicScheduleGenerationSource;
  from_date?: string;
  to_date?: string;
  only_available?: boolean;
  limit?: number;
  offset?: number;
  sort_by?: PublicScheduleSortField;
  sort_direction?: PublicScheduleSortDirection;
};

export type PublicScheduleList = {
  items: PublicPilatesSchedule[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
};

type PublicScheduleDetail = { schedule: PublicPilatesSchedule };

async function readResponse<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await apiClient.get<ApiResponse<T>>(path, { signal });
  return response.data;
}

function appendStringParams(
  query: URLSearchParams,
  filters: Array<[string, string | undefined]>,
): void {
  filters.forEach(([key, value]) => {
    if (value?.trim()) {
      query.set(key, value.trim());
    }
  });
}

function scheduleQuery(filters: PublicScheduleFilters): string {
  const query = new URLSearchParams({
    limit: String(filters.limit ?? 100),
    offset: String(filters.offset ?? 0),
    sort_by: filters.sort_by ?? "class_date",
    sort_direction: filters.sort_direction ?? "asc",
  });

  appendStringParams(query, [
    ["class_id", filters.class_id],
    ["trainer_staff_profile_id", filters.trainer_staff_profile_id],
    ["studio", filters.studio],
    ["series_id", filters.series_id],
    ["generation_source", filters.generation_source],
    ["from_date", filters.from_date],
    ["to_date", filters.to_date],
  ]);

  if (typeof filters.only_available === "boolean") {
    query.set("only_available", String(filters.only_available));
  }

  return query.toString();
}

export const publicSchedulesClient = {
  list(filters: PublicScheduleFilters = {}, signal?: AbortSignal) {
    return readResponse<PublicScheduleList>(
      `${ENDPOINTS.PUBLIC_PILATES.SCHEDULES}?${scheduleQuery(filters)}`,
      signal,
    );
  },

  async get(scheduleId: string, signal?: AbortSignal) {
    const result = await readResponse<PublicScheduleDetail>(
      ENDPOINTS.PUBLIC_PILATES.SCHEDULE(scheduleId),
      signal,
    );
    return result.schedule;
  },
};
