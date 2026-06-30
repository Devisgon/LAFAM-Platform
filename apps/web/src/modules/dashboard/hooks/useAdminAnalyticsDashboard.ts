"use client";

import { useCallback } from "react";
import { CACHE_KEYS } from "@/lib/cache/cacheKeys";
import { useCachedQuery } from "@/hooks/useCachedQuery";
import {
  adminAnalyticsClient,
  type AnalyticsDashboard,
  type AnalyticsDashboardFilters,
} from "@/modules/dashboard";

const EMPTY_DASHBOARD: AnalyticsDashboard = {
  calendar_events: null,
  generated_at: "",
  payment_summary: {
    currency: "KWD",
    failed_count: 0,
    paid_count: 0,
    refund_amount: 0,
    refunded_count: 0,
  },
  range: {
    from_date: "",
    revenue_granularity: "weekly",
    to_date: "",
  },
  recent_bookings: [],
  revenue_overview: [],
  summary: {
    active_users: 0,
    cancelled_bookings: 0,
    currency: "KWD",
    new_customers: 0,
    total_bookings: 0,
    total_revenue: 0,
  },
  top_services: [],
  upcoming_bookings: [],
  wallet_summary: null,
};

export function useAdminAnalyticsDashboard(filters: AnalyticsDashboardFilters) {
  const queryFn = useCallback(
    () => adminAnalyticsClient.getDashboard(filters),
    [filters],
  );

  return useCachedQuery({
    initialData: EMPTY_DASHBOARD,
    queryKey: [...CACHE_KEYS.dashboard.analytics, filters],
    queryFn,
  });
}
