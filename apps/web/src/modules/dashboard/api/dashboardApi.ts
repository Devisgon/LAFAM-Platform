import { type ApiResponse, authFetch } from "@/modules/auth";

export type AnalyticsDashboardFilters = {
  from_date: string;
  include_calendar_events?: boolean;
  include_wallet_summary?: boolean;
  recent_limit?: number;
  to_date: string;
  top_services_limit?: number;
  upcoming_days?: number;
};

export type AnalyticsCurrency = "KWD";

export type AnalyticsRevenueWeekPoint = {
  currency: AnalyticsCurrency;
  gross_revenue: number;
  net_revenue: number;
  paid_payment_count: number;
  refund_amount: number;
  refund_count: number;
  week_end: string;
  week_start: string;
};

export type AnalyticsPaymentSummary = {
  currency: AnalyticsCurrency;
  failed_count: number;
  paid_count: number;
  refund_amount: number;
  refunded_count: number;
};

export type AnalyticsBookingListItem = {
  booking_number: string;
  booking_type: "class_booking" | "private_trainer_booking";
  cancelled_at: string | null;
  class: {
    id: string | null;
    level: string | null;
    status: string | null;
    title: string | null;
  } | null;
  confirmed_at: string | null;
  created_at: string;
  customer: {
    email: string | null;
    full_name: string | null;
    id: string;
    phone: string | null;
  };
  id: string;
  payment_status: string;
  schedule: {
    class_date: string | null;
    end_time: string | null;
    id: string | null;
    session_date: string | null;
    start_time: string | null;
    status: string | null;
    studio: string | null;
  };
  status: string;
  trainer: {
    app_user_id: string | null;
    display_name: string | null;
    id: string | null;
    post_title: string | null;
  };
  user_id: string;
};

export type AnalyticsTopServiceItem = {
  booking_count: number;
  class_id: string;
  currency: AnalyticsCurrency;
  gross_revenue: number;
  level: string | null;
  net_revenue: number;
  refund_amount: number;
  title: string;
};

export type AnalyticsDashboard = {
  calendar_events: unknown[] | null;
  generated_at: string;
  payment_summary: AnalyticsPaymentSummary;
  range: {
    from_date: string;
    revenue_granularity: "weekly";
    to_date: string;
  };
  recent_bookings: AnalyticsBookingListItem[];
  revenue_overview: AnalyticsRevenueWeekPoint[];
  summary: {
    active_users: number;
    cancelled_bookings: number;
    currency: AnalyticsCurrency;
    new_customers: number;
    total_bookings: number;
    total_revenue: number;
  };
  top_services: AnalyticsTopServiceItem[];
  upcoming_bookings: AnalyticsBookingListItem[];
  wallet_summary: unknown | null;
};

export type AnalyticsDashboardResult = {
  dashboard: AnalyticsDashboard;
};

function appendOptionalParams(
  params: URLSearchParams,
  filters: Array<[string, string | number | boolean | undefined]>,
): void {
  filters.forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  });
}

function buildDashboardQuery(filters: AnalyticsDashboardFilters): string {
  const params = new URLSearchParams({
    from_date: filters.from_date,
    to_date: filters.to_date,
  });

  appendOptionalParams(params, [
    ["upcoming_days", filters.upcoming_days],
    ["recent_limit", filters.recent_limit],
    ["top_services_limit", filters.top_services_limit],
    ["include_wallet_summary", filters.include_wallet_summary],
    ["include_calendar_events", filters.include_calendar_events],
  ]);

  return params.toString();
}

export const adminAnalyticsClient = {
  async getDashboard(
    filters: AnalyticsDashboardFilters,
  ): Promise<AnalyticsDashboard> {
    const response = await authFetch<ApiResponse<AnalyticsDashboardResult>>(
      `/admin/analytics/dashboard?${buildDashboardQuery(filters)}`,
      { method: "GET" },
    );

    return response.data.dashboard;
  },
};
