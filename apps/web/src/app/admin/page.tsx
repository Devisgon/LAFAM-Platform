import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top_bar";
import { PageHeader } from "@/components/page_header";
import { Avatar } from "@/components/reuseable_ui_components/avatar";
import { Badge } from "@/components/reuseable_ui_components/badge";
import { Card } from "@/components/reuseable_ui_components/cards";
import Link from "next/link";
const upcomingBookings = [
  ["10:00 AM", "Reformer Pilates", "Sara"],
  ["11:30 AM", "Hair Coloring", "Mona"],
  ["12:00 PM", "Mat Pilates", "Lina"],
  ["3:00 PM", "Facial Treatment", "Hala"],
];

const recentBookings = [
  ["Fatima Al-Khalid", "Reformer Pilates", "20 May 2024, 10:00 AM", "15 KWD", "Confirmed", "bg-violet-100 text-violet-700"],
  ["Noora Al Sabah", "Hair Styling", "20 May 2024, 11:30 AM", "20 KWD", "Confirmed", "bg-rose-100 text-rose-700"],
  ["Mariam Hassan", "Mat Pilates", "20 May 2024, 02:00 PM", "12 KWD", "Confirmed", "bg-blue-100 text-blue-700"],
  ["Huda Ahmad", "Facial Treatment", "20 May 2024, 03:00 PM", "25 KWD", "Pending", "bg-amber-100 text-amber-700"],
];

const stats = {
  cancelled: 18,
  customers: 156,
  pilates: 160,
  revenue: 7850,
  revenuePoints: [2100, 4900, 4300, 6700, 4700, 6900, 8500],
  salon: 140,
  services: [120, 95, 65],
};

function SectionHeading({ action, children }: { action?: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-sm font-bold text-text-primary">{children}</h2>
      {action && <button className="text-xs font-semibold text-primary" type="button">{action}</button>}
    </div>
  );
}

export default function AdminDashboardPage() {
  const totalBookings = stats.pilates + stats.salon;
  const chartMaximum = Math.max(...stats.revenuePoints, 10000);
  const chartPoints = stats.revenuePoints.map((value, index) => ({
    value,
    x: 10 + index * 80,
    y: 210 - (value / chartMaximum) * 180,
  }));
  const linePath = chartPoints.map(({ x, y }, index) => `${index === 0 ? "M" : "L"}${x} ${y}`).join(" ");
  const circumference = 276.5;
  const pilatesArc = (stats.pilates / totalBookings) * circumference;
  const salonArc = (stats.salon / totalBookings) * circumference;

  const metrics = [
    { label: "Total Revenue", value: `${stats.revenue.toLocaleString()} KWD`, change: "+12.5%", icon: "$", tone: "text-primary bg-primary/10" },
    { label: "Total Bookings", value: totalBookings.toLocaleString(), change: "+8.3%", icon: "/", tone: "text-primary bg-primary/10" },
    { label: "New Customers", value: stats.customers.toLocaleString(), change: "+15.2%", icon: "+", tone: "text-primary bg-primary/10" },
    { label: "Cancelled Bookings", value: stats.cancelled.toLocaleString(), change: "-2.1%", icon: "x", tone: "text-error bg-error/10" },
  ];
  const services = [
    ["Reformer Pilates", stats.services[0]],
    ["Hair Styling", stats.services[1]],
    ["Facial Treatment", stats.services[2]],
  ] as const;

  return (
    <div className="min-h-screen bg-background-primary">
      <TopBar />
      <div className="md:flex">
        <Sidebar activeItem="Dashboard" />
        <div className="min-w-0 flex-1">
          <PageHeader title="Dashboard" />
          <main className="p-4 lg:p-5">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Dashboard metrics">
            {metrics.map((metric) => (
              <Card className="p-4" key={metric.label}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-text-secondary">{metric.label}</p>
                    <p className="mt-2 text-2xl font-bold text-text-primary">{metric.value}</p>
                    <p className={`mt-1 text-xs font-semibold ${metric.change.startsWith("-") ? "text-error" : "text-success"}`}>
                      {metric.change} <span className="font-normal text-text-secondary">vs last week</span>
                    </p>
                  </div>
                  <span className={`flex size-9 items-center justify-center rounded-full text-sm font-bold ${metric.tone}`} aria-hidden="true">{metric.icon}</span>
                </div>
              </Card>
            ))}
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_1fr_0.9fr]">
            <Card className="min-h-80 p-4">
              <SectionHeading action="This Week">Revenue Overview</SectionHeading>
              <div className="mt-3">
                <div className="flex h-52 gap-3">
                  <div className="flex flex-col justify-between pb-5 text-[10px] text-text-secondary">
                    <span>{Math.round(chartMaximum / 1000)}K</span><span>8K</span><span>6K</span><span>4K</span><span>2K</span><span>0</span>
                  </div>
                  <svg aria-label="Weekly revenue line chart" className="h-full min-w-0 flex-1" role="img" viewBox="0 0 500 220">
                    <g stroke="currentColor" className="text-background-secondary" strokeWidth="1">
                      <path d="M0 20H500M0 60H500M0 100H500M0 140H500M0 180H500M0 220H500" />
                    </g>
                    <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth="3" />
                    {chartPoints.map(({ value, x, y }) => <circle cx={x} cy={y} fill="var(--primary)" key={`${x}-${value}`} r="5" />)}
                  </svg>
                </div>
                <div className="ml-8 grid grid-cols-7 text-center text-[10px] text-text-secondary">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}
                </div>
              </div>
            </Card>

            <Card className="min-h-80 p-4">
              <SectionHeading>Bookings by Category</SectionHeading>
              <div className="flex h-60 flex-col items-center justify-center gap-6 sm:flex-row">
                <div className="relative size-40 shrink-0">
                  <svg aria-label="Bookings category donut chart" className="-rotate-90" role="img" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" fill="none" r="44" stroke="var(--background-secondary)" strokeWidth="22" />
                    <circle cx="60" cy="60" fill="none" r="44" stroke="var(--primary)"  strokeDasharray={`${pilatesArc} ${circumference}`} strokeWidth="22" />
                    <circle cx="60" cy="60" fill="none" r="44" stroke="#f43f5e" strokeDasharray={`${salonArc} ${circumference}`} strokeDashoffset={-pilatesArc} strokeWidth="22" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <strong className="text-2xl text-text-primary">{totalBookings}</strong>
                    <span className="text-xs text-text-secondary">Total</span>
                  </div>
                </div>
                <div className="grid gap-4 text-xs text-text-secondary">
                  <p><span className="mr-2 inline-block size-2 rounded-full bg-primary" />Pilates Studio<br /><strong className="ml-4 text-text-primary">{stats.pilates} ({Math.round(stats.pilates / totalBookings * 100)}%)</strong></p>
                  <p><span className="mr-2 inline-block size-2 rounded-full bg-[#f43f5e]" />Ladies Salon<br /><strong className="ml-4 text-text-primary">{stats.salon} ({Math.round(stats.salon / totalBookings * 100)}%)</strong></p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <SectionHeading>Upcoming Bookings</SectionHeading>
              <div className="divide-y divide-background-secondary">
                {upcomingBookings.map(([time, service, customer]) => (
                  <div className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2 py-3 text-xs" key={`${time}-${customer}`}>
                    <span className="font-semibold text-text-primary">{time}</span>
                    <span className="text-text-primary">{service}<small className="block text-text-secondary">{customer}</small></span>
                    <Badge tone="success">Confirmed</Badge>
                  </div>
                ))}
              </div>
              <Link className="mt-3 inline-block text-xs font-semibold text-primary" href="/admin/bookings">
                View All Bookings +
              </Link>
            </Card>
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-[2.15fr_0.9fr]">
            <Card className="overflow-hidden p-4">
              <SectionHeading action="View All">Recent Bookings</SectionHeading>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-background-secondary text-text-secondary">
                      {["Customer", "Service", "Date & Time", "Amount", "Status"].map((heading) => <th className="px-2 py-3 font-semibold" key={heading}>{heading}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {recentBookings.map(([customer, service, date, amount, status, avatarStyle]) => (
                      <tr className="border-b border-background-secondary last:border-0" key={`${customer}-${date}`}>
                        <td className="px-2 py-3 font-semibold text-text-primary">
                          <span className="flex items-center gap-2">
                            <Avatar alt={`${customer} avatar`} className={avatarStyle} name={customer} size="sm" />
                            {customer}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-text-secondary">{service}</td>
                        <td className="px-2 py-3 text-text-secondary">{date}</td>
                        <td className="px-2 py-3 text-text-primary">{amount}</td>
                        <td className="px-2 py-3"><Badge tone={status === "Pending" ? "warning" : "success"}>{status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="p-4">
              <SectionHeading>Top Services</SectionHeading>
              <div className="grid gap-6">
                {services.map(([service, count], index) => (
                  <div key={service}>
                    <div className="mb-2 flex justify-between gap-3 text-xs">
                      <strong className="text-text-primary">{service}</strong>
                      <span className="text-text-secondary">{count} Bookings</span>
                    </div>
                    <progress
                      aria-label={`${service} bookings`}
                      className={`h-1.5 w-full overflow-hidden rounded-full ${index === 0 ? "accent-primary" : "accent-error"}`}
                      max={Math.max(...stats.services)}
                      value={count}
                    />
                  </div>
                ))}
              </div>
            </Card>
          </section>
          </main>
        </div>
      </div>
    </div>
  );
}
