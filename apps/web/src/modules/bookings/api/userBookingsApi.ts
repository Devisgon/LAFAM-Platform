import { type ApiResponse, authFetch } from "@/modules/auth";
import { ENDPOINTS } from "@/lib/api/endpoints";

export type UserBookingStatus =
  | "pending_payment"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show"
  | "expired"
  | "rescheduled"
  | "deleted";

export type UserBookingPaymentStatus =
  | "not_required"
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "expired";

export type UserBookingSortField =
  | "created_at"
  | "schedule_date"
  | "start_time"
  | "status";
export type UserBookingSortDirection = "asc" | "desc";
export type UserPrivateBookingSortField =
  | "created_at"
  | "session_date"
  | "start_time"
  | "status";

export type UserBookingFilters = {
  status?: UserBookingStatus;
  from_date?: string;
  to_date?: string;
  limit: number;
  offset: number;
  sort_by: UserBookingSortField;
  sort_direction: UserBookingSortDirection;
};

export type UserPrivateBookingFilters = {
  status?: UserBookingStatus;
  trainer_staff_profile_id?: string;
  from_date?: string;
  to_date?: string;
  limit: number;
  offset: number;
  sort_by: UserPrivateBookingSortField;
  sort_direction: UserBookingSortDirection;
};

export type UserBookingCustomer = {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  role: string;
  status: string;
  is_guest: boolean;
  avatar_path: string | null;
};

export type UserBookingClass = {
  id: string;
  title: string;
  description: string | null;
  level: string;
  status: string;
  duration_minutes: number;
  capacity: number;
  default_price_amount?: number | null;
  currency?: string | null;
  cover_image_path: string | null;
};

export type UserBookingSchedule = {
  id: string;
  class_id: string;
  trainer_staff_profile_id: string;
  studio: string;
  class_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  capacity: number;
  price_amount?: number | null;
  default_price_amount?: number | null;
  currency?: string | null;
  status: string;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  completed_at: string | null;
  realtime_version: number;
};

export type UserBookingTrainer = {
  staff_profile_id: string | null;
  app_user_id: string | null;
  display_name: string | null;
  post_title: string | null;
  email: string | null;
  phone: string | null;
  avatar_path: string | null;
};

export type UserBookingPrice = {
  amount: number | null;
  currency: string | null;
  source: "schedule_override" | "class_default" | "private_booking" | "not_configured";
};

export type UserBookingPayment = {
  id: string;
  payment_number: string;
  receipt_number: string | null;
  target_kind: "booking" | "private_booking";
  booking_id: string | null;
  private_booking_id: string | null;
  amount: number;
  discount_amount: number;
  final_amount: number;
  currency: string;
  payment_method: string;
  payment_provider: string;
  status: string;
  redirect_url: string | null;
  paid_at: string | null;
  failed_at: string | null;
  cancelled_at: string | null;
  expired_at: string | null;
  refunded_at: string | null;
  refunded_amount: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UserBookingPaymentState = {
  payment_required: boolean;
  payment_status: UserBookingPaymentStatus;
  seat_hold_expires_at: string | null;
  is_pending_payment: boolean;
  is_payable: boolean;
  is_retryable: boolean;
  is_settled: boolean;
  is_failed: boolean;
  is_terminal: boolean;
  is_refundable: boolean;
  confirms_booking: boolean;
  checkout_required: boolean;
  hold_expires_at: string | null;
  latest_payment: UserBookingPayment | null;
};

export type UserBookingHistoryEntry = {
  id: string;
  booking_id: string;
  actor_user_id: string | null;
  actor_admin_id: string | null;
  actor_role: string | null;
  action: string;
  from_status: UserBookingStatus | null;
  to_status: UserBookingStatus | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type UserBookingAvailability = {
  schedule_id: string;
  capacity: number;
  booked_count: number;
  pending_hold_count: number;
  available_seats: number;
  waitlist_count: number;
  waitlist_available: boolean;
  schedule_realtime_version: number;
};

export type UserBookingWaitlist = {
  id: string;
  schedule_id: string;
  class_id: string;
  user_id: string;
  position: number;
  status: string;
  joined_at: string;
  promoted_at: string | null;
  expired_at: string | null;
  cancelled_at: string | null;
  promotion_expires_at: string | null;
  converted_booking_id: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  realtime_version: number;
  customer: UserBookingCustomer | null;
  class: UserBookingClass | null;
  schedule: UserBookingSchedule | null;
  trainer: UserBookingTrainer | null;
};

export type UserBooking = {
  id: string;
  booking_number: string;
  user_id: string;
  schedule_id: string;
  class_id: string;
  trainer_staff_profile_id: string | null;
  status: UserBookingStatus;
  source: string;
  payment_status: UserBookingPaymentStatus;
  payment_required: boolean;
  seat_hold_expires_at: string | null;
  price?: UserBookingPrice | null;
  payment_state?: UserBookingPaymentState;
  latest_payment?: UserBookingPayment | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  completed_at: string | null;
  no_show_at: string | null;
  rescheduled_from_booking_id: string | null;
  cancellation_reason: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  realtime_version: number;
  customer: UserBookingCustomer | null;
  class: UserBookingClass | null;
  schedule: UserBookingSchedule | null;
  trainer: UserBookingTrainer | null;
};

export type UserBookingDetail = UserBooking & {
  history: UserBookingHistoryEntry[];
  availability: UserBookingAvailability | null;
};

export type UserPrivateBookingHistoryEntry = {
  id: string;
  private_booking_id: string;
  actor_user_id: string | null;
  actor_admin_id: string | null;
  actor_role: string | null;
  action: string;
  from_status: UserBookingStatus | null;
  to_status: UserBookingStatus | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type UserPrivateBooking = {
  id: string;
  booking_number: string;
  user_id: string;
  trainer_staff_profile_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  studio: string;
  price_amount?: number | null;
  currency?: string | null;
  price?: UserBookingPrice | null;
  status: UserBookingStatus;
  source: string;
  payment_status: UserBookingPaymentStatus;
  payment_required: boolean;
  seat_hold_expires_at: string | null;
  payment_state?: UserBookingPaymentState;
  latest_payment?: UserBookingPayment | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  completed_at: string | null;
  no_show_at: string | null;
  rescheduled_at: string | null;
  rescheduled_from_private_booking_id: string | null;
  rescheduled_to_private_booking_id: string | null;
  cancellation_reason: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  realtime_version: number;
  customer: UserBookingCustomer | null;
  trainer: UserBookingTrainer | null;
};

export type UserPrivateBookingDetail = UserPrivateBooking & {
  history: UserPrivateBookingHistoryEntry[];
};

export type UserBookingListResult = {
  bookings: UserBooking[];
  total: number;
  limit: number;
  offset: number;
};

export type UserPrivateBookingListResult = {
  private_bookings: UserPrivateBooking[];
  total: number;
  limit: number;
  offset: number;
};

export type CancelUserBookingPayload = {
  reason?: string;
};

export type RescheduleUserBookingPayload = {
  target_schedule_id: string;
  join_waitlist_if_full?: boolean;
  reason?: string;
};

export type RescheduleUserPrivateBookingPayload = {
  target_session_date: string;
  target_start_time: string;
  target_duration_minutes?: number;
  studio?: string;
  reason?: string;
  idempotency_key?: string;
  payment_required?: boolean;
};

export type CreateUserPrivateBookingPayload = {
  trainer_staff_profile_id: string;
  session_date: string;
  start_time: string;
  duration_minutes?: number;
  studio?: string;
  payment_required?: boolean;
  idempotency_key?: string;
};

export type CreateUserBookingPayload = {
  schedule_id: string;
  payment_required: boolean;
  idempotency_key?: string;
};

export type CreateUserBookingResult = {
  result: "existing_booking" | "booked" | "waitlisted";
  booking: UserBooking | null;
  waitlist: UserBookingWaitlist | null;
  availability: UserBookingAvailability;
  payment_state?: UserBookingPaymentState | null;
  checkout_required?: boolean;
};

export type CreateUserPrivateBookingResult = {
  result: "existing_private_booking" | "private_booked";
  private_booking: UserPrivateBooking;
  payment_state?: UserBookingPaymentState | null;
  checkout_required?: boolean;
};

export type CancelUserBookingResult = {
  result: string;
  cancelled_booking: UserBooking;
  promoted_booking: UserBooking | null;
  promoted_waitlist: unknown | null;
  availability: UserBookingAvailability;
};

export type RescheduleUserBookingResult = {
  result: string;
  old_booking: UserBooking;
  new_booking: UserBooking | null;
  waitlist: unknown | null;
  availability: UserBookingAvailability;
};

export type CancelUserPrivateBookingResult = {
  result: string;
  private_booking: UserPrivateBooking;
};

export type RescheduleUserPrivateBookingResult = {
  result: string;
  old_private_booking: UserPrivateBooking;
  new_private_booking: UserPrivateBooking;
};

export type UserPrivateTrainerAvailabilitySlot = {
  trainer_staff_profile_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  available: boolean;
  unavailable_reason: string | null;
};

export type UserPrivateTrainerAvailabilityFilters = {
  from_date: string;
  to_date: string;
  duration_minutes?: number;
  studio?: string;
};

export type UserPrivateTrainerAvailabilityResult = {
  trainer_staff_profile_id: string;
  from_date: string;
  to_date: string;
  duration_minutes: number;
  slots: UserPrivateTrainerAvailabilitySlot[];
};

function bookingQuery(filters: UserBookingFilters): string {
  const query = new URLSearchParams({
    limit: String(filters.limit),
    offset: String(filters.offset),
    sort_by: filters.sort_by,
    sort_direction: filters.sort_direction,
  });

  if (filters.status) query.set("status", filters.status);
  if (filters.from_date?.trim()) query.set("from_date", filters.from_date.trim());
  if (filters.to_date?.trim()) query.set("to_date", filters.to_date.trim());

  return query.toString();
}

function privateBookingQuery(filters: UserPrivateBookingFilters): string {
  const query = new URLSearchParams({
    limit: String(filters.limit),
    offset: String(filters.offset),
    sort_by: filters.sort_by,
    sort_direction: filters.sort_direction,
  });

  if (filters.status) query.set("status", filters.status);
  if (filters.trainer_staff_profile_id?.trim()) {
    query.set("trainer_staff_profile_id", filters.trainer_staff_profile_id.trim());
  }
  if (filters.from_date?.trim()) query.set("from_date", filters.from_date.trim());
  if (filters.to_date?.trim()) query.set("to_date", filters.to_date.trim());

  return query.toString();
}

function privateAvailabilityQuery(
  filters: UserPrivateTrainerAvailabilityFilters,
): string {
  const query = new URLSearchParams({
    from_date: filters.from_date,
    to_date: filters.to_date,
  });

  if (filters.duration_minutes) {
    query.set("duration_minutes", String(filters.duration_minutes));
  }

  if (filters.studio?.trim()) {
    query.set("studio", filters.studio.trim());
  }

  return query.toString();
}

export const userBookingsClient = {
  async create(payload: CreateUserBookingPayload): Promise<CreateUserBookingResult> {
    const response = await authFetch<ApiResponse<CreateUserBookingResult>>(
      ENDPOINTS.CUSTOMER_BOOKINGS.CREATE,
      { method: "POST", body: JSON.stringify(payload) },
    );

    return response.data;
  },

  async list(filters: UserBookingFilters): Promise<UserBookingListResult> {
    const response = await authFetch<ApiResponse<UserBookingListResult>>(
      `${ENDPOINTS.CUSTOMER_BOOKINGS.LIST}?${bookingQuery(filters)}`,
      { method: "GET" },
    );

    return response.data;
  },

  async get(bookingId: string): Promise<UserBookingDetail> {
    const response = await authFetch<ApiResponse<UserBookingDetail>>(
      ENDPOINTS.CUSTOMER_BOOKINGS.DETAIL(bookingId),
      { method: "GET" },
    );

    return response.data;
  },

  async cancel(
    bookingId: string,
    payload: CancelUserBookingPayload,
  ): Promise<CancelUserBookingResult> {
    const response = await authFetch<ApiResponse<CancelUserBookingResult>>(
      ENDPOINTS.CUSTOMER_BOOKINGS.CANCEL(bookingId),
      { method: "POST", body: JSON.stringify(payload) },
    );

    return response.data;
  },

  async reschedule(
    bookingId: string,
    payload: RescheduleUserBookingPayload,
  ): Promise<RescheduleUserBookingResult> {
    const response = await authFetch<ApiResponse<RescheduleUserBookingResult>>(
      ENDPOINTS.CUSTOMER_BOOKINGS.RESCHEDULE(bookingId),
      { method: "POST", body: JSON.stringify(payload) },
    );

    return response.data;
  },
};

export const userPrivateBookingsClient = {
  async create(
    payload: CreateUserPrivateBookingPayload,
  ): Promise<CreateUserPrivateBookingResult> {
    const response = await authFetch<ApiResponse<CreateUserPrivateBookingResult>>(
      ENDPOINTS.CUSTOMER_PRIVATE_BOOKINGS.CREATE,
      { method: "POST", body: JSON.stringify(payload) },
    );

    return response.data;
  },

  async availability(
    trainerStaffProfileId: string,
    filters: UserPrivateTrainerAvailabilityFilters,
    signal?: AbortSignal,
  ): Promise<UserPrivateTrainerAvailabilityResult> {
    const response = await authFetch<ApiResponse<UserPrivateTrainerAvailabilityResult>>(
      `${ENDPOINTS.CUSTOMER_PRIVATE_BOOKINGS.AVAILABILITY(trainerStaffProfileId)}?${privateAvailabilityQuery(filters)}`,
      { method: "GET", signal },
    );

    return response.data;
  },

  async list(
    filters: UserPrivateBookingFilters,
  ): Promise<UserPrivateBookingListResult> {
    const response = await authFetch<ApiResponse<UserPrivateBookingListResult>>(
      `${ENDPOINTS.CUSTOMER_PRIVATE_BOOKINGS.LIST}?${privateBookingQuery(filters)}`,
      { method: "GET" },
    );

    return response.data;
  },

  async get(privateBookingId: string): Promise<UserPrivateBookingDetail> {
    const response = await authFetch<ApiResponse<UserPrivateBookingDetail>>(
      ENDPOINTS.CUSTOMER_PRIVATE_BOOKINGS.DETAIL(privateBookingId),
      { method: "GET" },
    );

    return response.data;
  },

  async cancel(
    privateBookingId: string,
    payload: CancelUserBookingPayload,
  ): Promise<CancelUserPrivateBookingResult> {
    const response = await authFetch<ApiResponse<CancelUserPrivateBookingResult>>(
      ENDPOINTS.CUSTOMER_PRIVATE_BOOKINGS.CANCEL(privateBookingId),
      { method: "POST", body: JSON.stringify(payload) },
    );

    return response.data;
  },

  async reschedule(
    privateBookingId: string,
    payload: RescheduleUserPrivateBookingPayload,
  ): Promise<RescheduleUserPrivateBookingResult> {
    const response = await authFetch<ApiResponse<RescheduleUserPrivateBookingResult>>(
      ENDPOINTS.CUSTOMER_PRIVATE_BOOKINGS.RESCHEDULE(privateBookingId),
      { method: "POST", body: JSON.stringify(payload) },
    );

    return response.data;
  },
};
