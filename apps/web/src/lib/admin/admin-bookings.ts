import { type ApiResponse, authFetch } from "@/lib/auth/auth";

export type AdminBookingStatus =
  | "pending_payment"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show"
  | "expired"
  | "rescheduled"
  | "deleted";

export type AdminBookingPaymentStatus =
  | "not_required"
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "expired";

export type AdminBookingSortField =
  | "created_at"
  | "schedule_date"
  | "start_time"
  | "status";

export type AdminBookingSortDirection = "asc" | "desc";
export type AdminPrivateBookingSortField =
  | "created_at"
  | "session_date"
  | "start_time"
  | "status";
export type AdminBookingCalendarSortField =
  | "start_at"
  | "event_type"
  | "status";
export type AdminBookingCalendarEventType =
  | "pilates_schedule"
  | "pilates_booking"
  | "waitlist_entry"
  | "private_trainer_booking";

export type AdminBookingFilters = {
  class_id?: string;
  from_date?: string;
  limit: number;
  offset: number;
  payment_status?: AdminBookingPaymentStatus;
  schedule_id?: string;
  search?: string;
  sort_by: AdminBookingSortField;
  sort_direction: AdminBookingSortDirection;
  status?: AdminBookingStatus;
  to_date?: string;
  trainer_staff_profile_id?: string;
  user_id?: string;
};

export type AdminPrivateBookingFilters = {
  from_date?: string;
  limit: number;
  offset: number;
  payment_status?: AdminBookingPaymentStatus;
  search?: string;
  sort_by: AdminPrivateBookingSortField;
  sort_direction: AdminBookingSortDirection;
  status?: AdminBookingStatus;
  to_date?: string;
  trainer_staff_profile_id?: string;
  user_id?: string;
};

export type AdminBookingCustomer = {
  avatar_path: string | null;
  email: string | null;
  full_name: string | null;
  id: string;
  is_guest: boolean;
  phone: string | null;
  role: string;
  status: string;
};

export type AdminBookingClass = {
  capacity: number;
  cover_image_path: string | null;
  description: string | null;
  duration_minutes: number;
  id: string;
  level: string;
  status: string;
  title: string;
};

export type AdminBookingSchedule = {
  cancellation_reason: string | null;
  cancelled_at: string | null;
  capacity: number;
  class_date: string;
  class_id: string;
  completed_at: string | null;
  duration_minutes: number;
  end_time: string;
  id: string;
  realtime_version: number;
  start_time: string;
  status: string;
  studio: string;
  trainer_staff_profile_id: string;
};

export type AdminBookingTrainer = {
  app_user_id: string;
  avatar_path: string | null;
  display_name: string;
  email: string | null;
  phone: string | null;
  post_title: string;
  staff_profile_id: string;
};

export type AdminBookingPrice = {
  amount: number | null;
  currency: string | null;
  source:
    | "schedule_override"
    | "class_default"
    | "private_booking"
    | "not_configured";
};

export type AdminBooking = {
  admin_notes: string | null;
  booking_number: string;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  class: AdminBookingClass | null;
  class_id: string;
  completed_at: string | null;
  confirmed_at: string | null;
  created_at: string;
  customer: AdminBookingCustomer | null;
  id: string;
  no_show_at: string | null;
  payment_required: boolean;
  payment_status: AdminBookingPaymentStatus;
  price?: AdminBookingPrice | null;
  realtime_version: number;
  rescheduled_from_booking_id: string | null;
  schedule: AdminBookingSchedule | null;
  schedule_id: string;
  seat_hold_expires_at: string | null;
  source: string;
  status: AdminBookingStatus;
  trainer: AdminBookingTrainer | null;
  trainer_staff_profile_id: string;
  updated_at: string;
  user_id: string;
};

export type AdminBookingAvailability = {
  available_seats: number;
  booked_count: number;
  capacity: number;
  pending_hold_count: number;
  schedule_id: string;
  schedule_realtime_version: number;
  waitlist_available: boolean;
  waitlist_count: number;
};

export type AdminBookingHistoryEntry = {
  action: string;
  actor_admin_id: string | null;
  actor_role: string | null;
  actor_user_id: string | null;
  booking_id: string;
  created_at: string;
  from_status: AdminBookingStatus | null;
  id: string;
  metadata: Record<string, unknown>;
  notes: string | null;
  to_status: AdminBookingStatus | null;
};

export type AdminBookingDetail = AdminBooking & {
  availability: AdminBookingAvailability | null;
  history: AdminBookingHistoryEntry[];
};

export type AdminBookingListResult = {
  bookings: AdminBooking[];
  limit: number;
  offset: number;
  total: number;
};

export type AdminBookingCalendarFilters = {
  class_id?: string;
  from_date: string;
  include_class_bookings?: boolean;
  include_class_schedules?: boolean;
  include_private_bookings?: boolean;
  include_waitlist?: boolean;
  sort_by: AdminBookingCalendarSortField;
  sort_direction: AdminBookingSortDirection;
  to_date: string;
  trainer_staff_profile_id?: string;
  user_id?: string;
};

export type AdminBookingCalendarEvent = {
  booking_id: string | null;
  class_id: string | null;
  date: string;
  end_time: string;
  ends_at: string;
  event_type: AdminBookingCalendarEventType;
  id: string;
  private_booking_id: string | null;
  schedule_id: string | null;
  source: Record<string, string | null>;
  start_time: string;
  starts_at: string;
  status: AdminBookingStatus | string;
  title: string;
  trainer_staff_profile_id: string | null;
  user_id: string | null;
  waitlist_id: string | null;
};

export type AdminBookingCalendarResult = {
  events: AdminBookingCalendarEvent[];
  from_date: string;
  to_date: string;
  total: number;
};

export type CreatePrivateTrainerBookingPayload = {
  currency: "KWD";
  duration_minutes?: number;
  idempotency_key?: string;
  payment_required?: boolean;
  price_amount: number;
  session_date: string;
  start_time: string;
  studio?: string;
  trainer_staff_profile_id: string;
  user_id: string;
};

export type PrivateTrainerSlotAvailability = {
  trainer_staff_profile_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  available: boolean;
  unavailable_reason: string | null;
};

export type PrivateTrainerBooking = {
  admin_notes: string | null;
  booking_number: string;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  completed_at: string | null;
  confirmed_at: string | null;
  created_at: string;
  customer: AdminBookingCustomer | null;
  duration_minutes: number;
  end_time: string;
  id: string;
  no_show_at: string | null;
  payment_required: boolean;
  payment_status: AdminBookingPaymentStatus;
  price?: AdminBookingPrice | null;
  realtime_version: number;
  rescheduled_at: string | null;
  rescheduled_from_private_booking_id: string | null;
  rescheduled_to_private_booking_id: string | null;
  session_date: string;
  seat_hold_expires_at: string | null;
  source: string;
  start_time: string;
  status: AdminBookingStatus;
  studio: string;
  trainer: AdminBookingTrainer | null;
  trainer_staff_profile_id: string;
  updated_at: string;
  user_id: string;
};

export type PrivateTrainerBookingHistoryEntry = {
  action: string;
  actor_admin_id: string | null;
  actor_role: string | null;
  actor_user_id: string | null;
  created_at: string;
  from_status: AdminBookingStatus | null;
  id: string;
  metadata: Record<string, unknown>;
  notes: string | null;
  private_booking_id: string;
  to_status: AdminBookingStatus | null;
};

export type PrivateTrainerBookingDetail = PrivateTrainerBooking & {
  history: PrivateTrainerBookingHistoryEntry[];
};

export type AdminPrivateBookingListResult = {
  limit: number;
  offset: number;
  private_bookings: PrivateTrainerBooking[];
  total: number;
};

export type CreatePrivateTrainerBookingResult = {
  private_booking: PrivateTrainerBooking;
};

export type AdminCancelBookingPayload = {
  reason: string;
};

export type AdminRescheduleBookingPayload = {
  join_waitlist_if_full?: boolean;
  reason?: string;
  target_schedule_id: string;
};

export type AdminOverrideBookingPayload = {
  admin_notes?: string;
  reason: string;
  target_status: AdminBookingStatus;
};

export type AdminReschedulePrivateBookingPayload = {
  idempotency_key?: string;
  payment_required?: boolean;
  reason?: string;
  studio?: string;
  target_duration_minutes?: number;
  target_session_date: string;
  target_start_time: string;
};

function appendOptionalParams(
  params: URLSearchParams,
  filters: Array<[string, string | undefined]>,
): void {
  filters.forEach(([key, value]) => {
    if (value?.trim()) {
      params.set(key, value.trim());
    }
  });
}

function appendBooleanParams(
  params: URLSearchParams,
  filters: Array<[string, boolean | undefined]>,
): void {
  filters.forEach(([key, value]) => {
    if (typeof value === "boolean") {
      params.set(key, String(value));
    }
  });
}

function buildListQuery(filters: AdminBookingFilters): string {
  const params = new URLSearchParams({
    limit: String(filters.limit),
    offset: String(filters.offset),
    sort_by: filters.sort_by,
    sort_direction: filters.sort_direction,
  });

  appendOptionalParams(params, [
    ["search", filters.search],
    ["status", filters.status],
    ["payment_status", filters.payment_status],
    ["schedule_id", filters.schedule_id],
    ["class_id", filters.class_id],
    ["trainer_staff_profile_id", filters.trainer_staff_profile_id],
    ["user_id", filters.user_id],
    ["from_date", filters.from_date],
    ["to_date", filters.to_date],
  ]);

  return params.toString();
}

function buildPrivateListQuery(filters: AdminPrivateBookingFilters): string {
  const params = new URLSearchParams({
    limit: String(filters.limit),
    offset: String(filters.offset),
    sort_by: filters.sort_by,
    sort_direction: filters.sort_direction,
  });

  appendOptionalParams(params, [
    ["search", filters.search],
    ["status", filters.status],
    ["payment_status", filters.payment_status],
    ["trainer_staff_profile_id", filters.trainer_staff_profile_id],
    ["user_id", filters.user_id],
    ["from_date", filters.from_date],
    ["to_date", filters.to_date],
  ]);

  return params.toString();
}

function buildCalendarQuery(filters: AdminBookingCalendarFilters): string {
  const params = new URLSearchParams({
    from_date: filters.from_date,
    sort_by: filters.sort_by,
    sort_direction: filters.sort_direction,
    to_date: filters.to_date,
  });

  appendOptionalParams(params, [
    ["trainer_staff_profile_id", filters.trainer_staff_profile_id],
    ["class_id", filters.class_id],
    ["user_id", filters.user_id],
  ]);

  appendBooleanParams(params, [
    ["include_class_schedules", filters.include_class_schedules],
    ["include_class_bookings", filters.include_class_bookings],
    ["include_waitlist", filters.include_waitlist],
    ["include_private_bookings", filters.include_private_bookings],
  ]);

  return params.toString();
}

export const adminBookingsClient = {
  async list(filters: AdminBookingFilters): Promise<AdminBookingListResult> {
    const response = await authFetch<ApiResponse<AdminBookingListResult>>(
      `/admin/bookings?${buildListQuery(filters)}`,
      { method: "GET" },
    );

    return response.data;
  },

  async calendar(
    filters: AdminBookingCalendarFilters,
  ): Promise<AdminBookingCalendarResult> {
    const response = await authFetch<ApiResponse<AdminBookingCalendarResult>>(
      `/admin/bookings/calendar?${buildCalendarQuery(filters)}`,
      { method: "GET" },
    );

    return response.data;
  },

  async getBooking(bookingId: string): Promise<AdminBookingDetail> {
    const response = await authFetch<ApiResponse<AdminBookingDetail>>(
      `/admin/bookings/${encodeURIComponent(bookingId)}`,
      { method: "GET" },
    );

    return response.data;
  },

  async cancelBooking(
    bookingId: string,
    payload: AdminCancelBookingPayload,
  ): Promise<void> {
    await authFetch<ApiResponse<unknown>>(
      `/admin/bookings/${encodeURIComponent(bookingId)}/cancel`,
      { method: "POST", body: JSON.stringify(payload) },
    );
  },

  async rescheduleBooking(
    bookingId: string,
    payload: AdminRescheduleBookingPayload,
  ): Promise<void> {
    await authFetch<ApiResponse<unknown>>(
      `/admin/bookings/${encodeURIComponent(bookingId)}/reschedule`,
      { method: "POST", body: JSON.stringify(payload) },
    );
  },

  async overrideBooking(
    bookingId: string,
    payload: AdminOverrideBookingPayload,
  ): Promise<AdminBookingDetail> {
    const response = await authFetch<ApiResponse<AdminBookingDetail>>(
      `/admin/bookings/${encodeURIComponent(bookingId)}/override`,
      { method: "POST", body: JSON.stringify(payload) },
    );

    return response.data;
  },

  async createPrivateTrainer(
    payload: CreatePrivateTrainerBookingPayload,
  ): Promise<CreatePrivateTrainerBookingResult> {
    const response = await authFetch<
      ApiResponse<CreatePrivateTrainerBookingResult>
    >("/admin/bookings/private-trainer", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return response.data;
  },

  async checkPrivateTrainerAvailability(
    trainerStaffProfileId: string,
    input: {
      session_date: string;
      start_time: string;
      duration_minutes: number;
    },
    signal?: AbortSignal,
  ): Promise<PrivateTrainerSlotAvailability> {
    const query = new URLSearchParams({
      session_date: input.session_date,
      start_time: input.start_time,
      duration_minutes: String(input.duration_minutes),
    });
    const response = await authFetch<
      ApiResponse<PrivateTrainerSlotAvailability>
    >(
      `/admin/bookings/private-trainer/availability/${encodeURIComponent(trainerStaffProfileId)}?${query.toString()}`,
      { method: "GET", signal },
    );

    return response.data;
  },

  async listPrivateTrainer(
    filters: AdminPrivateBookingFilters,
  ): Promise<AdminPrivateBookingListResult> {
    const response = await authFetch<
      ApiResponse<AdminPrivateBookingListResult>
    >(`/admin/bookings/private-trainer?${buildPrivateListQuery(filters)}`, {
      method: "GET",
    });

    return response.data;
  },

  async getPrivateTrainerBooking(
    privateBookingId: string,
  ): Promise<PrivateTrainerBookingDetail> {
    const response = await authFetch<ApiResponse<PrivateTrainerBookingDetail>>(
      `/admin/bookings/private-trainer/${encodeURIComponent(privateBookingId)}`,
      { method: "GET" },
    );

    return response.data;
  },

  async cancelPrivateTrainerBooking(
    privateBookingId: string,
    payload: AdminCancelBookingPayload,
  ): Promise<void> {
    await authFetch<ApiResponse<unknown>>(
      `/admin/bookings/private-trainer/${encodeURIComponent(privateBookingId)}/cancel`,
      { method: "POST", body: JSON.stringify(payload) },
    );
  },

  async reschedulePrivateTrainerBooking(
    privateBookingId: string,
    payload: AdminReschedulePrivateBookingPayload,
  ): Promise<void> {
    await authFetch<ApiResponse<unknown>>(
      `/admin/bookings/private-trainer/${encodeURIComponent(privateBookingId)}/reschedule`,
      { method: "POST", body: JSON.stringify(payload) },
    );
  },
};
