import type { ApiResponse } from "@/modules/auth";
import { apiClient } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";

export type PublicClassLevel =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "all_levels";

export type PublicPilatesClass = {
  id: string;
  title: string;
  description: string | null;
  default_duration_minutes: number;
  default_capacity: number;
  default_price_amount?: number;
  currency?: "KWD";
  level: PublicClassLevel;
  image_url: string | null;
  realtime_version: number;
};

export type PublicClassFilters = {
  search?: string;
  level?: PublicClassLevel;
  from_date?: string;
  to_date?: string;
};

export type PublicClassList = {
  items: PublicPilatesClass[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
};

type PublicClassDetail = { class: PublicPilatesClass };

async function readResponse<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await apiClient.get<ApiResponse<T>>(path, { signal });
  return response.data;
}

function listQuery(filters: PublicClassFilters): string {
  const query = new URLSearchParams({
    limit: "100",
    offset: "0",
    sort_by: "title",
    sort_direction: "asc",
  });

  for (const [key, value] of Object.entries(filters)) {
    if (value?.trim()) query.set(key, value.trim());
  }

  return query.toString();
}

export const publicClassesClient = {
  list(filters: PublicClassFilters = {}, signal?: AbortSignal) {
    return readResponse<PublicClassList>(
      `${ENDPOINTS.PUBLIC_PILATES.CLASSES}?${listQuery(filters)}`,
      signal,
    );
  },

  async get(classId: string, signal?: AbortSignal) {
    const result = await readResponse<PublicClassDetail>(
      ENDPOINTS.PUBLIC_PILATES.CLASS(classId),
      signal,
    );
    return result.class;
  },
};
