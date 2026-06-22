"use client";
import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useAdminAnalyticsDashboard } from "@/modules/dashboard";
import type {
  AnalyticsBookingListItem,
  AnalyticsDashboard,
  AnalyticsPaymentSummary,
  AnalyticsRevenueWeekPoint,
  AnalyticsTopServiceItem,
} from "@/modules/dashboard";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/data-display/DataTable";
import { LoadingState } from "@/components/data-display/LoadingState";

type ChartPoint = {
  axisLabel: string;
  value: number;
  x: number;
  y: number;
};

const DEFAULT_UPCOMING_DAYS = 7;
const DEFAULT_RECENT_LIMIT = 5;
const DEFAULT_TOP_SERVICES_LIMIT = 5;
const DONUT_CIRCUMFERENCE = 276.5;

function SectionHeading({
  action,
  children,
}: {
  action?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-sm font-bold text-txt-primary">{children}</h2>
      {action ? (
        <span className="text-xs font-semibold text-primary">{action}</span>
      ) : null}
    </div>
  );
}

function formatDate(value?: string | null): string {
  if (!value) return "Not scheduled";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatShortDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function formatMoney(value: number, currency: string): string {
  return `${value.toLocaleString()} ${currency}`;
}

function formatAxisMoney(value: number): string {
  if (value >= 1000) {
    return `${Math.round(value / 1000)}K`;
  }

  return Math.round(value).toLocaleString();
}

function formatPaymentStatus(status: string): string {
  return status
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function getCurrentMonthRange() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0);
  const format = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  return {
    from_date: format(from),
    to_date: format(to),
  };
}

function bookingTitle(booking: AnalyticsBookingListItem): string {
  if (booking.booking_type === "private_trainer_booking") {
    return "Private trainer";
  }

  return booking.class?.title ?? "Pilates class";
}

function bookingDateLabel(booking: AnalyticsBookingListItem): string {
  const date =
    booking.schedule.class_date ??
    booking.schedule.session_date ??
    booking.created_at.slice(0, 10);
  const time = booking.schedule.start_time;

  return time ? `${formatDate(date)}, ${time.slice(0, 5)}` : formatDate(date);
}

function statusTone(status: string): "success" | "warning" | "error" | "info" {
  if (status === "confirmed" || status === "paid" || status === "not_required") {
    return "success";
  }

  if (status === "pending" || status === "pending_payment") {
    return "warning";
  }

  if (status === "cancelled" || status === "failed" || status === "expired") {
    return "error";
  }

  return "info";
}

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

function DashboardContent({ dashboard }: { dashboard: AnalyticsDashboard }) {
  const { summary } = dashboard;
  const metrics = [
    {
      icon: "$",
      label: "Total Revenue",
      tone: "text-primary bg-primary/10",
      value: formatMoney(summary.total_revenue, summary.currency),
    },
    {
      icon: "/",
      label: "Total Bookings",
      tone: "text-primary bg-primary/10",
      value: summary.total_bookings.toLocaleString(),
    },
    {
      icon: "+",
      label: "New Customers",
      tone: "text-primary bg-primary/10",
      value: summary.new_customers.toLocaleString(),
    },
    {
      icon: "x",
      label: "Cancelled Bookings",
      tone: "text-error bg-error/10",
      value: summary.cancelled_bookings.toLocaleString(),
    },
  ];

  return (
    <>
      <section
        aria-label="Dashboard metrics"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {metrics.map((metric) => (
          <Card className="p-4" key={metric.label}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-txt-secondary">{metric.label}</p>
                <p className="mt-2 text-2xl font-bold text-txt-primary">
                  {metric.value}
                </p>
               
              </div>
              <span
                aria-hidden="true"
                className={`flex size-9 items-center justify-center rounded-full text-sm font-bold ${metric.tone}`}
              >
                {metric.icon}
              </span>
            </div>
          </Card>
        ))}
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_1fr_0.9fr]">
        <RevenueOverviewChart data={dashboard.revenue_overview} />
        <PaymentSummaryChart summary={dashboard.payment_summary} />
        <UpcomingBookings bookings={dashboard.upcoming_bookings} />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[2.15fr_0.9fr]">
        <RecentBookings bookings={dashboard.recent_bookings} />
        <TopServices services={dashboard.top_services} />
      </section>
    </>
  );
}

function RevenueOverviewChart({ data }: { data: AnalyticsRevenueWeekPoint[] }) {
  const chartPoints = useMemo(() => {
    const maximum = Math.max(
      1,
      ...data.flatMap((item) => [
        item.gross_revenue,
        item.net_revenue,
        item.refund_amount,
      ]),
    );
    const points: ChartPoint[] = data.map((item, index) => {
      const x =
        data.length === 1 ? 286 : 54 + (index * 466) / Math.max(1, data.length - 1);
      const y = 198 - (item.net_revenue / maximum) * 168;

      return {
        axisLabel: formatShortDate(item.week_start),
        value: item.net_revenue,
        x,
        y,
      };
    });

    return {
      maximum,
      path: points
        .map(({ x, y }, index) => `${index === 0 ? "M" : "L"}${x} ${y}`)
        .join(" "),
      points,
      yTicks: [maximum, maximum * 0.75, maximum * 0.5, maximum * 0.25, 0],
    };
  }, [data]);

  return (
    <Card className="min-h-80 p-4">
      <SectionHeading action="Weekly">Revenue Overview</SectionHeading>
      <svg
        aria-label="Weekly revenue line chart"
        className="mt-3 h-64 w-full"
        role="img"
        viewBox="0 0 540 250"
      >
        <g className="text-background-secondary" stroke="currentColor" strokeWidth="1">
          {chartPoints.yTicks.map((tick) => {
            const y = 198 - (tick / chartPoints.maximum) * 168;

            return <path d={`M44 ${y}H528`} key={tick} />;
          })}
        </g>
        <g className="fill-txt-secondary text-[10px]">
          {chartPoints.yTicks.map((tick) => {
            const y = 198 - (tick / chartPoints.maximum) * 168;

            return (
              <text dominantBaseline="middle" key={tick} textAnchor="end" x="36" y={y}>
                {formatAxisMoney(tick)}
              </text>
            );
          })}
          {chartPoints.points.map((point) => (
            <text key={point.axisLabel} textAnchor="middle" x={point.x} y="232">
              {point.axisLabel}
            </text>
          ))}
        </g>
        {data.length === 0 ? null : (
          <>
            <path
              d={chartPoints.path}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="3"
            />
            {chartPoints.points.map(({ axisLabel, value, x, y }) => (
              <circle
                cx={x}
                cy={y}
                fill="var(--primary)"
                key={`${axisLabel}-${value}`}
                r="5"
              />
            ))}
          </>
        )}
      </svg>
    </Card>
  );
}

function PaymentSummaryChart({ summary }: { summary: AnalyticsPaymentSummary }) {
  const segments = [
    { color: "var(--primary)", label: "Paid", value: summary.paid_count },
    { color: "var(--error)", label: "Failed", value: summary.failed_count },
    { color: "var(--chart-refunded)", label: "Refunded", value: summary.refunded_count },
  ];
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  let offset = 0;

  return (
    <Card className="min-h-80 p-4">
      <SectionHeading>Payment Summary</SectionHeading>
      <div className="flex h-72 flex-col items-center justify-center gap-6 sm:flex-row">
        <div className="relative size-52 shrink-0">
          <svg
            aria-label="Payment status donut chart"
            className="-rotate-90"
            role="img"
            viewBox="0 0 120 120"
          >
            <circle
              cx="60"
              cy="60"
              fill="none"
              r="44"
              stroke="var(--background-secondary)"
              strokeWidth="22"
            />
            {segments.map((segment) => {
              const length =
                total > 0 ? (segment.value / total) * DONUT_CIRCUMFERENCE : 0;
              const dashOffset = -offset;
              offset += length;

              return (
                <circle
                  cx="60"
                  cy="60"
                  fill="none"
                  key={segment.label}
                  r="44"
                  stroke={segment.color}
                  strokeDasharray={`${length} ${DONUT_CIRCUMFERENCE}`}
                  strokeDashoffset={dashOffset}
                  strokeWidth="22"
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <strong className="text-2xl text-txt-primary">{total}</strong>
            <span className="text-xs text-txt-secondary">Payments</span>
          </div>
        </div>
        <div className="grid gap-4 text-xs text-txt-secondary">
          {segments.map((segment) => (
            <p key={segment.label}>
              <span
                className={`mr-2 inline-block size-2 rounded-full ${
                  segment.label === "Paid"
                    ? "bg-primary"
                    : segment.label === "Failed"
                      ? "bg-error"
                      : "bg-[var(--chart-refunded)]"
                }`}
              />
              {segment.label}
              <br />
              <strong className="ml-4 text-txt-primary">
                {segment.value} (
                {total > 0 ? Math.round((segment.value / total) * 100) : 0}%)
              </strong>
            </p>
          ))}
          <p>
            Refund amount
            <br />
            <strong className="text-txt-primary">
              {formatMoney(summary.refund_amount, summary.currency)}
            </strong>
          </p>
        </div>
      </div>
    </Card>
  );
}

function UpcomingBookings({
  bookings,
}: {
  bookings: AnalyticsBookingListItem[];
}) {
  return (
    <Card className="p-4">
      <SectionHeading>Upcoming Bookings</SectionHeading>
      <div className="divide-y divide-background-secondary">
        {bookings.length > 0 ? (
          bookings.map((booking) => (
            <div
              className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2 py-3 text-xs"
              key={booking.id}
            >
              <span className="font-semibold text-txt-primary">
                {booking.schedule.start_time?.slice(0, 5) ?? "--:--"}
              </span>
              <span className="text-txt-primary">
                {bookingTitle(booking)}
                <small className="block text-txt-secondary">
                  {booking.customer.full_name ??
                    booking.customer.email ??
                    "No customer"}
                </small>
              </span>
              <Badge tone={statusTone(booking.status)}>
                {formatPaymentStatus(booking.status)}
              </Badge>
            </div>
          ))
        ) : (
          <p className="py-6 text-xs text-txt-secondary">
            No upcoming bookings in this range.
          </p>
        )}
      </div>
      <Link
        className="mt-3 inline-block text-xs font-semibold text-primary"
        href="/bookings"
      >
        View All Bookings +
      </Link>
    </Card>
  );
}

function RecentBookings({ bookings }: { bookings: AnalyticsBookingListItem[] }) {
  return (
    <Card className="overflow-hidden p-4">
      <SectionHeading action="View All">Recent Bookings</SectionHeading>
      <DataTable
        bodyClassName=""
        className="border-0"
        columnHeaderClassName="px-2 py-3 font-semibold"
        columns={[
          { key: "customer", heading: "Customer" },
          { key: "service", heading: "Service" },
          { key: "date-time", heading: "Date & Time" },
          { key: "payment", heading: "Payment" },
          { key: "status", heading: "Status" },
        ]}
        emptyMessage="No recent bookings found."
        headerRowClassName="border-b border-background-secondary text-txt-secondary"
        isEmpty={bookings.length === 0}
        minWidthClassName="min-w-[700px]"
        textSizeClassName="text-xs"
        wrapperClassName="overflow-x-auto"
      >
        {bookings.map((booking) => {
          const customer =
            booking.customer.full_name ?? booking.customer.email ?? "No customer";

          return (
            <tr
              className="border-b border-background-secondary last:border-0"
              key={booking.id}
            >
              <td className="px-2 py-3 font-semibold text-txt-primary">
                <span className="flex items-center gap-2">
                  <Avatar
                    alt={`${customer} avatar`}
                    className="bg-violet-100 text-violet-700"
                    name={customer}
                    size="sm"
                  />
                  {customer}
                </span>
              </td>
              <td className="px-2 py-3 text-txt-secondary">
                {bookingTitle(booking)}
              </td>
              <td className="px-2 py-3 text-txt-secondary">
                {bookingDateLabel(booking)}
              </td>
              <td className="px-2 py-3 text-txt-primary">
                {formatPaymentStatus(booking.payment_status)}
              </td>
              <td className="px-2 py-3">
                <Badge tone={statusTone(booking.status)}>
                  {formatPaymentStatus(booking.status)}
                </Badge>
              </td>
            </tr>
          );
        })}
      </DataTable>
    </Card>
  );
}

function TopServices({ services }: { services: AnalyticsTopServiceItem[] }) {
  const maxBookings = Math.max(1, ...services.map((service) => service.booking_count));

  return (
    <Card className="p-4">
      <SectionHeading>Top Services</SectionHeading>
      <div className="grid gap-6">
        {services.length > 0 ? (
          services.map((service, index) => (
            <div key={service.class_id}>
              <div className="mb-2 flex justify-between gap-3 text-xs">
                <strong className="text-txt-primary">{service.title}</strong>
                <span className="text-txt-secondary">
                  {service.booking_count} Bookings
                </span>
              </div>
              <progress
                aria-label={`${service.title} bookings`}
                className={`h-1.5 w-full overflow-hidden rounded-full ${index === 0 ? "accent-primary" : "accent-error"}`}
                max={maxBookings}
                value={service.booking_count}
              />
              <p className="mt-1 text-xs text-txt-secondary">
                Net {formatMoney(service.net_revenue, service.currency)}
              </p>
            </div>
          ))
        ) : (
          <p className="text-xs text-txt-secondary">No top services found.</p>
        )}
      </div>
    </Card>
  );
}
