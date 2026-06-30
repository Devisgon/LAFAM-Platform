"use client";

import { RotateCcw } from "lucide-react";
import { useMemo } from "react";
import { LoadingState } from "@/components/data-display/LoadingState";
import { useAdminAnalyticsDashboard } from "@/modules/dashboard";
import { DEFAULT_RECENT_LIMIT, DEFAULT_TOP_SERVICES_LIMIT, DEFAULT_UPCOMING_DAYS, getCurrentMonthRange } from "../utils/dashboardFormatters";
import { DashboardContent } from "./dashboard-management/DashboardContent";

export function AdminDashboard() {
  const range = useMemo(() => getCurrentMonthRange(), []);
  const filters = useMemo(
    () => ({
      ...range,
      recent_limit: DEFAULT_RECENT_LIMIT,
      top_services_limit: DEFAULT_TOP_SERVICES_LIMIT,
      upcoming_days: DEFAULT_UPCOMING_DAYS,
    }),
    [range],
  );
  const { data: dashboard, error, isInitialLoading, isRefreshing, refetch } =
    useAdminAnalyticsDashboard(filters);

  if (isInitialLoading) {
    return <LoadingState className="p-6" label="Loading dashboard analytics" />;
  }

  if (error && !dashboard.generated_at) {
    return (
      <div className="rounded-md bg-card-bg-primary p-6 text-txt-primary shadow-sm">
        <p className="text-sm" role="alert">
          {error}
        </p>
        <button
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-button-primary px-4 py-2 text-xs font-bold text-txt-primary"
          onClick={() => void refetch().catch(() => undefined)}
          type="button"
        >
          <RotateCcw aria-hidden="true" size={14} />
          Try again
        </button>
      </div>
    );
  }

  return (
    <>
      {isRefreshing ? (
        <p className="mb-3 text-xs font-semibold text-txt-secondary" role="status">
          Refreshing dashboard...
        </p>
      ) : null}
      <DashboardContent dashboard={dashboard} />
    </>
  );
}
