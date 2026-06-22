import type { ApiResponse } from "@/lib/auth/auth";
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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

function apiUrl(path: string): string {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is missing.");
  }

  return `${API_BASE_URL.replace(/\/$/, "")}${path}`;
}

async function readResponse<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(apiUrl(path), {
    headers: { Accept: "application/json" },
    signal,
  });
  const payload = (await response.json().catch(() => null)) as
    | ApiResponse<T>
    | { message?: string }
    | null;

  if (!response.ok || !payload || !("data" in payload)) {
    throw new Error(payload?.message ?? "The class request failed.");
  }

  return payload.data;
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
      `/pilates/classes?${listQuery(filters)}`,
      signal,
    );
  },

  async get(classId: string, signal?: AbortSignal) {
    const result = await readResponse<PublicClassDetail>(
      `/pilates/classes/${encodeURIComponent(classId)}`,
      signal,
    );
    return result.class;
  },
};
