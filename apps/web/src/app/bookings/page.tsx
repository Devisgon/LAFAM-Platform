"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/components/reuseable_ui_components/avatar";
import { Badge } from "@/components/reuseable_ui_components/badge";
import { Card } from "@/components/reuseable_ui_components/cards";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top_bar";

export type BookingCategory = "Pilates" | "Salon";
export type BookingStatus = "Upcoming" | "Pending" | "Completed" | "Cancelled";

export interface Booking {
  avatarTone: string;
  category: BookingCategory;
  customer: string;
  date: string;
  day: string;
  id: string;
  service: string;
  staff: string;
  status: BookingStatus;
  time: string;
}

type CategoryFilter = "All" | BookingCategory;
type RecordFilter = "All bookings" | "Upcoming" | "Previous";


const bookingsData: Booking[] = [
  {
    id: "BK-1048",
    customer: "Noora Al Sabah",
    service: "Reformer Pilates",
    category: "Pilates",
    staff: "Sara Hassan",
    date: "8 Jun 2026",
    day: "Monday",
    time: "9:00 AM",
    status: "Upcoming",
    avatarTone: "bg-violet-100 text-violet-700",
  },
  {
    id: "BK-1049",
    customer: "Fatima Al-Khalid",
    service: "Hair Coloring",
    category: "Salon",
    staff: "Mona Ali",
    date: "8 Jun 2026",
    day: "Monday",
    time: "11:30 AM",
    status: "Pending",
    avatarTone: "bg-rose-100 text-rose-700",
  },
  {
    id: "BK-1050",
    customer: "Mariam Hassan",
    service: "Mat Pilates",
    category: "Pilates",
    staff: "Lina Ahmad",
    date: "9 Jun 2026",
    day: "Tuesday",
    time: "10:00 AM",
    status: "Upcoming",
    avatarTone: "bg-sky-100 text-sky-700",
  },
  {
    id: "BK-1051",
    customer: "Huda Ahmad",
    service: "Facial Treatment",
    category: "Salon",
    staff: "Hala Omar",
    date: "10 Jun 2026",
    day: "Wednesday",
    time: "3:00 PM",
    status: "Upcoming",
    avatarTone: "bg-amber-100 text-amber-700",
  },
  {
    id: "BK-1044",
    customer: "Dana Yousef",
    service: "Reformer Pilates",
    category: "Pilates",
    staff: "Sara Hassan",
    date: "4 Jun 2026",
    day: "Thursday",
    time: "4:30 PM",
    status: "Completed",
    avatarTone: "bg-emerald-100 text-emerald-700",
  },
  {
    id: "BK-1042",
    customer: "Layla Salem",
    service: "Hair Styling",
    category: "Salon",
    staff: "Mona Ali",
    date: "3 Jun 2026",
    day: "Wednesday",
    time: "1:00 PM",
    status: "Completed",
    avatarTone: "bg-fuchsia-100 text-fuchsia-700",
  },
  {
    id: "BK-1039",
    customer: "Amal Rashid",
    service: "Mat Pilates",
    category: "Pilates",
    staff: "Lina Ahmad",
    date: "1 Jun 2026",
    day: "Monday",
    time: "8:30 AM",
    status: "Cancelled",
    avatarTone: "bg-slate-200 text-slate-700",
  },
];

const statusTone = {
  Upcoming: "info",
  Pending: "warning",
  Completed: "success",
  Cancelled: "error",
} as const;


function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
        active
          ? "bg-primary text-white"
          : "bg-background text-text-secondary hover:bg-background-secondary hover:text-text-primary"
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function BookingExplorer({ bookings }: { bookings: Booking[] }) {
  const [category, setCategory] = useState<CategoryFilter>("All");
  const [record, setRecord] = useState<RecordFilter>("All bookings");

  const filteredBookings = useMemo(
    () =>
      bookings.filter((booking) => {
        const matchesCategory = category === "All" || booking.category === category;
        const matchesRecord =
          record === "All bookings" ||
          (record === "Upcoming" && (booking.status === "Upcoming" || booking.status === "Pending")) ||
          (record === "Previous" && (booking.status === "Completed" || booking.status === "Cancelled"));

        return matchesCategory && matchesRecord;
      }),
    [bookings, category, record]
  );

  return (
    <section className="mt-7" aria-labelledby="all-bookings-heading">
      <div className="mb-4">
        <h2 className="mt-1 text-xl font-bold text-text-primary" id="all-bookings-heading">
          All bookings
        </h2>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-background-secondary bg-card-bg-secondary p-4">
          <div className="flex flex-wrap gap-2" aria-label="Filter bookings by category">
            {(["All", "Salon", "Pilates"] as CategoryFilter[]).map((option) => (
              <FilterButton active={category === option} key={option} onClick={() => setCategory(option)}>
                {option}
              </FilterButton>
            ))}
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Filter booking record">
            {(["All bookings", "Upcoming", "Previous"] as RecordFilter[]).map((option) => (
              <FilterButton active={record === option} key={option} onClick={() => setRecord(option)}>
                {option}
              </FilterButton>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-background-secondary text-text-secondary">
                {["Customer", "Category", "Service & staff", "Date & time", "Status", "Booking ID"].map((heading) => (
                  <th className="px-5 py-3 font-semibold" key={heading}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredBookings.map((booking) => (
                <tr
                  className="border-b border-background-secondary last:border-0 hover:bg-card-bg-secondary"
                  key={booking.id}
                >
                  <td className="px-5 py-4">
                    <span className="flex items-center gap-3 font-bold text-text-primary">
                      <Avatar
                        alt={`${booking.customer} avatar`}
                        className={booking.avatarTone}
                        name={booking.customer}
                        size="sm"
                      />
                      {booking.customer}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-text-secondary">{booking.category}</td>
                  <td className="px-5 py-4 text-text-primary">
                    <strong>{booking.service}</strong>
                    <span className="mt-0.5 block text-text-secondary">{booking.staff}</span>
                  </td>
                  <td className="px-5 py-4 text-text-primary">
                    <strong>
                      {booking.day}, {booking.date}
                    </strong>
                    <span className="mt-0.5 block text-text-secondary">{booking.time}</span>
                  </td>
                  <td className="px-5 py-4">
                    <Badge tone={statusTone[booking.status]}>{booking.status}</Badge>
                  </td>
                  <td className="px-5 py-4 font-mono text-text-secondary">{booking.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredBookings.length === 0 && (
          <p className="p-8 text-center text-sm text-text-secondary">No bookings match these filters.</p>
        )}
        <footer className="border-t border-background-secondary px-5 py-3 text-xs text-text-secondary">
          Showing {filteredBookings.length} of {bookings.length} bookings
        </footer>
      </Card>
    </section>
  );
}

// ==========================================
// Main Page Component
// ==========================================
export default function BookingsPage() {
  return (
    <div className="min-h-screen bg-background-primary md:flex">
      <Sidebar activeItem="Bookings" />

      <div className="min-w-0 flex-1">
        <TopBar
          dateLabel="8 Jun - 14 Jun 2026"
          description="Manage upcoming and previous appointments"
          title="Bookings"
        />

        <main className="p-4 lg:p-6">
          <BookingExplorer bookings={bookingsData} />
        </main>
      </div>
    </div>
  );
}