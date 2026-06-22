import { type ApiResponse, authFetch } from "@/modules/auth";

export type PilatesClassLevel =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "all_levels";
export type PilatesClassStatus = "draft" | "active" | "inactive" | "deleted";
export type PilatesCurrency = "KWD";
export type PilatesScheduleStatus =
  | "scheduled"
  | "cancelled"
  | "completed"
  | "deleted";

export type PilatesClassDefinition = {
  id: string;
  title: string;
  description: string | null;
  default_duration_minutes: number;
  default_capacity: number;
  default_price_amount: number;
  currency: PilatesCurrency;
  level: PilatesClassLevel;
  status: PilatesClassStatus;
  image_path: string | null;
  image_url: string | null;
  created_by_admin_id: string | null;
  updated_by_admin_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  realtime_version: number;
};

export type PilatesTrainerSummary = {
  id: string;
  app_user_id: string;
  display_name: string;
  post_title: string;
  bio: string | null;
  specialties: string[];
  status: string;
};

export type PilatesAvailability = {
  capacity: number;
  booked_count: number;
  available_seats: number;
  waitlist_count: number;
  waitlist_available: boolean;
  realtime_version: number;
};

export type PilatesSchedule = {
  id: string;
  class_id: string;
  trainer_staff_profile_id: string;
  studio: string;
  class_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  capacity: number;
  price_amount: number | null;
  currency: PilatesCurrency | null;
  status: PilatesScheduleStatus;
  cancellation_reason: string | null;
  created_by_admin_id: string | null;
  updated_by_admin_id: string | null;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  completed_at: string | null;
  deleted_at: string | null;
  realtime_version: number;
  class?: PilatesClassDefinition;
  trainer?: PilatesTrainerSummary;
  availability: PilatesAvailability;
};

export type PilatesClassDetail = PilatesClassDefinition & {
  schedules?: PilatesSchedule[];
};

export type PilatesScheduleDetail = PilatesSchedule & {
  class: PilatesClassDefinition;
  trainer: PilatesTrainerSummary;
};

export type CreatePilatesClassPayload = {
  title: string;
  description?: string | null;
  default_duration_minutes: number;
  default_capacity: number;
  default_price_amount: number;
  currency: PilatesCurrency;
  level: PilatesClassLevel;
  status: Exclude<PilatesClassStatus, "deleted">;
  image?: File | null;
};

export type UpdatePilatesClassPayload = Partial<
  Omit<CreatePilatesClassPayload, "image">
> & {
  image?: File | null;
  remove_image?: boolean;
};

export type CreateSinglePilatesSchedulePayload = {
  mode?: "single";
  class_id: string;
  trainer_staff_profile_id: string;
  studio: string;
  class_date: string;
  start_time: string;
  duration_minutes: number;
  capacity: number;
  price_amount: number;
  currency: PilatesCurrency;
};

export type WeeklyPilatesRecurrence = {
  frequency: "weekly";
  days_of_week: number[];
  excluded_dates?: string[];
};

export type PilatesScheduleTimeSlot = {
  start_time: string;
  duration_minutes: number;
  capacity: number;
  studio: string;
};

export type CreateRecurringPilatesSchedulePayload = {
  mode: "recurring";
  class_id: string;
  trainer_staff_profile_id: string;
  studio: string;
  start_date: string;
  end_date: string;
  start_time: string;
  duration_minutes: number;
  capacity: number;
  price_amount: number;
  currency: PilatesCurrency;
  time_slots: PilatesScheduleTimeSlot[];
  recurrence: WeeklyPilatesRecurrence;
};

export type CreatePilatesSchedulePayload =
  | CreateSinglePilatesSchedulePayload
  | CreateRecurringPilatesSchedulePayload;

export type UpdatePilatesSchedulePayload =
  Partial<Omit<CreateSinglePilatesSchedulePayload, "mode">>;

type PaginatedResult<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
};

type ClassMutationResult = { class: PilatesClassDefinition };
type ClassDetailResult = { class: PilatesClassDetail };
type ScheduleMutationResult = { schedule: PilatesSchedule };
type ScheduleDetailResult = { schedule: PilatesScheduleDetail };
type DeleteResult = { deleted: true; id: string };

function classBody(
  payload: CreatePilatesClassPayload | UpdatePilatesClassPayload,
): BodyInit {
  if (!payload.image) {
    const json = { ...payload };
    delete json.image;
    return JSON.stringify(json);
  }

  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    formData.append(key, value instanceof File ? value : String(value));
  });
  return formData;
}

export const pilatesClient = {
  async listClasses(): Promise<PaginatedResult<PilatesClassDefinition>> {
    const response = await authFetch<
      ApiResponse<PaginatedResult<PilatesClassDefinition>>
    >("/admin/pilates/classes?limit=100&offset=0&sort_by=updated_at&sort_direction=desc", {
      method: "GET",
    });
    return response.data;
  },

  async createClass(
    payload: CreatePilatesClassPayload,
  ): Promise<PilatesClassDefinition> {
    const response = await authFetch<ApiResponse<ClassMutationResult>>(
      "/admin/pilates/classes",
      { method: "POST", body: classBody(payload) },
    );
    return response.data.class;
  },

  async getClass(classId: string): Promise<PilatesClassDetail> {
    const response = await authFetch<ApiResponse<ClassDetailResult>>(
      `/admin/pilates/classes/${encodeURIComponent(classId)}`,
      { method: "GET" },
    );
    return response.data.class;
  },

  async updateClass(
    classId: string,
    payload: UpdatePilatesClassPayload,
  ): Promise<PilatesClassDefinition> {
    const response = await authFetch<ApiResponse<ClassMutationResult>>(
      `/admin/pilates/classes/${encodeURIComponent(classId)}`,
      { method: "PATCH", body: classBody(payload) },
    );
    return response.data.class;
  },

  async deleteClass(classId: string): Promise<DeleteResult> {
    const response = await authFetch<ApiResponse<DeleteResult>>(
      `/admin/pilates/classes/${encodeURIComponent(classId)}`,
      { method: "DELETE" },
    );
    return response.data;
  },

  async listSchedules(): Promise<PaginatedResult<PilatesSchedule>> {
    const response = await authFetch<ApiResponse<PaginatedResult<PilatesSchedule>>>(
      "/admin/pilates/schedules?limit=100&offset=0&sort_by=class_date&sort_direction=asc",
      { method: "GET" },
    );
    return response.data;
  },

  async createSchedule(
    payload: CreatePilatesSchedulePayload,
  ): Promise<PilatesSchedule> {
    const response = await authFetch<ApiResponse<ScheduleMutationResult>>(
      "/admin/pilates/schedules",
      { method: "POST", body: JSON.stringify(payload) },
    );
    return response.data.schedule;
  },

  async getSchedule(scheduleId: string): Promise<PilatesScheduleDetail> {
    const response = await authFetch<ApiResponse<ScheduleDetailResult>>(
      `/admin/pilates/schedules/${encodeURIComponent(scheduleId)}`,
      { method: "GET" },
    );
    return response.data.schedule;
  },

  async updateSchedule(
    scheduleId: string,
    payload: UpdatePilatesSchedulePayload,
  ): Promise<PilatesSchedule> {
    const response = await authFetch<ApiResponse<ScheduleMutationResult>>(
      `/admin/pilates/schedules/${encodeURIComponent(scheduleId)}`,
      { method: "PATCH", body: JSON.stringify(payload) },
    );
    return response.data.schedule;
  },

  async cancelSchedule(
    scheduleId: string,
    cancellationReason: string,
  ): Promise<PilatesSchedule> {
    const response = await authFetch<ApiResponse<ScheduleMutationResult>>(
      `/admin/pilates/schedules/${encodeURIComponent(scheduleId)}/cancel`,
      {
        method: "POST",
        body: JSON.stringify({ cancellation_reason: cancellationReason }),
      },
    );
    return response.data.schedule;
  },

  async completeSchedule(scheduleId: string): Promise<PilatesSchedule> {
    const response = await authFetch<ApiResponse<ScheduleMutationResult>>(
      `/admin/pilates/schedules/${encodeURIComponent(scheduleId)}/complete`,
      { method: "POST" },
    );
    return response.data.schedule;
  },

  async deleteSchedule(scheduleId: string): Promise<DeleteResult> {
    const response = await authFetch<ApiResponse<DeleteResult>>(
      `/admin/pilates/schedules/${encodeURIComponent(scheduleId)}`,
      { method: "DELETE" },
    );
    return response.data;
  },
};
