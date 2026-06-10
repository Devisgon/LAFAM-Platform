"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { Avatar } from "@/components/reuseable_ui_components/avatar";
import { Badge } from "@/components/reuseable_ui_components/badge";
import { Card } from "@/components/reuseable_ui_components/cards";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top_bar";

export type BookingCategory = "Pilates" ;
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

export const bookingsData: Booking[] = [
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
    category: "Pilates",
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
    category: "Pilates",
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
    category: "Pilates",
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

const bookingStorageKey = "lafam-booking-changes";

function useBookingChanges() {
  const subscribe = useCallback((onStoreChange: () => void) => {
    window.addEventListener("storage", onStoreChange);
    window.addEventListener(bookingStorageKey, onStoreChange);
    return () => {
      window.removeEventListener("storage", onStoreChange);
      window.removeEventListener(bookingStorageKey, onStoreChange);
    };
  }, []);
  const saved = useSyncExternalStore(subscribe, () => window.localStorage.getItem(bookingStorageKey) ?? "[]", () => "[]");
  return useMemo(() => {
    try {
      const parsed = JSON.parse(saved) as unknown;
      return Array.isArray(parsed) ? parsed as Booking[] : [];
    } catch {
      return [];
    }
  }, [saved]);
}

function saveBookingChanges(bookings: Booking[]) {
  window.localStorage.setItem(bookingStorageKey, JSON.stringify(bookings));
  window.dispatchEvent(new Event(bookingStorageKey));
}

export function BookingExplorer({
  bookings,
  heading = "Bookings",
  previousOnly = false,
}: {
  bookings: Booking[];
  heading?: string;
  previousOnly?: boolean;
}) {
  const bookingChanges = useBookingChanges();
  const [editing, setEditing] = useState<Booking | null>(null);
  const managedBookings = [
    ...bookings.map((booking) => bookingChanges.find((changed) => changed.id === booking.id) ?? booking),
    ...bookingChanges.filter((changed) => !bookings.some((booking) => booking.id === changed.id)),
  ];

  const filteredBookings = managedBookings.filter((booking) => {
    const isPrevious = booking.status === "Completed" || booking.status === "Cancelled";
    return previousOnly ? isPrevious : !isPrevious;
  });

  function cancelBooking(booking: Booking) {
    if (!window.confirm(`Cancel booking ${booking.id} for ${booking.customer}?`)) return;
    saveBookingChanges([...bookingChanges.filter((item) => item.id !== booking.id), { ...booking, status: "Cancelled" }]);
  }

  function updateBooking(formData: FormData) {
    if (!editing) return;
    const updated: Booking = {
      ...editing,
      customer: String(formData.get("customer")).trim(),
      service: String(formData.get("service")).trim(),
      staff: String(formData.get("staff")).trim(),
      date: String(formData.get("dateLabel")).trim(),
      day: String(formData.get("day")).trim(),
      time: String(formData.get("timeLabel")).trim(),
      status: formData.get("status") === "Pending" ? "Pending" : "Upcoming",
    };
    saveBookingChanges([...bookingChanges.filter((item) => item.id !== updated.id), updated]);
    setEditing(null);
  }

  return (
    <section className="mt-7" aria-labelledby="all-bookings-heading">
      <div className="mb-4">
        <h2 className="mt-1 text-xl font-bold text-text-primary" id="all-bookings-heading">
          {heading}
        </h2>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-background-secondary text-text-secondary">
                {["Customer", "Service & staff", "Date & time", "Status", "Booking ID", ...(previousOnly ? [] : ["Actions"])].map((heading) => (
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
                  {!previousOnly && (
                    <td className="px-5 py-4">
                      <div className="flex gap-3">
                        <button className="font-bold text-primary hover:underline" onClick={() => setEditing(booking)} type="button">Edit / reschedule</button>
                        <button className="font-bold text-error hover:underline" onClick={() => cancelBooking(booking)} type="button">Cancel</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredBookings.length === 0 && (
          <p className="p-8 text-center text-sm text-text-secondary">No bookings match these filters.</p>
        )}
     
      </Card>

      {editing && (
        <section aria-labelledby="edit-booking-title" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog">
          <button aria-label="Close booking editor" className="absolute inset-0" onClick={() => setEditing(null)} type="button" />
          <form action={updateBooking} className="relative z-10 w-full max-w-2xl rounded-2xl border border-background-secondary bg-card-bg-primary p-6 text-text-primary shadow-2xl">
            <button aria-label="Close booking editor" className="absolute right-4 top-4 size-8 rounded-full bg-background-secondary" onClick={() => setEditing(null)} type="button">X</button>
            <h2 className="text-xl font-bold" id="edit-booking-title">Edit or reschedule booking</h2>
            <p className="mt-1 text-sm text-text-secondary">{editing.id} | Update booking details and timing.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-xs font-bold">Customer<input className="min-h-10 rounded-lg border border-background-secondary bg-background px-3" defaultValue={editing.customer} name="customer" required /></label>
              <label className="grid gap-1.5 text-xs font-bold">Service<input className="min-h-10 rounded-lg border border-background-secondary bg-background px-3" defaultValue={editing.service} name="service" required /></label>
              <label className="grid gap-1.5 text-xs font-bold">Assigned staff<input className="min-h-10 rounded-lg border border-background-secondary bg-background px-3" defaultValue={editing.staff} name="staff" required /></label>
              <label className="grid gap-1.5 text-xs font-bold">Status<select className="min-h-10 rounded-lg border border-background-secondary bg-background px-3" defaultValue={editing.status} name="status"><option>Upcoming</option><option>Pending</option></select></label>
              <label className="grid gap-1.5 text-xs font-bold">Day<input className="min-h-10 rounded-lg border border-background-secondary bg-background px-3" defaultValue={editing.day} name="day" required /></label>
              <label className="grid gap-1.5 text-xs font-bold">Date<input className="min-h-10 rounded-lg border border-background-secondary bg-background px-3" defaultValue={editing.date} name="dateLabel" required /></label>
              <label className="grid gap-1.5 text-xs font-bold sm:col-span-2">Time<input className="min-h-10 rounded-lg border border-background-secondary bg-background px-3" defaultValue={editing.time} name="timeLabel" required /></label>
            </div>
            <footer className="mt-6 flex justify-end gap-2 border-t border-background-secondary pt-4"><button className="rounded-lg border border-background-secondary px-4 py-2 text-xs font-bold" onClick={() => setEditing(null)} type="button">Close</button><button className="rounded-lg bg-button-primary px-4 py-2 text-xs font-bold text-white" type="submit">Save booking</button></footer>
          </form>
        </section>
      )}
    </section>
  );
}


export default function BookingsPage() {
  return (
    <div className="min-h-screen bg-background-primary md:flex">
      <Sidebar activeItem="Bookings" />

      <div className="min-w-0 flex-1">
        <TopBar
          dateLabel="8 Jun - 14 Jun 2026"
          description="Manage appointments"
          title="Bookings"
        />

        <main className="p-4 lg:p-6">
          <BookingExplorer bookings={bookingsData}  />
        </main>
      </div>
    </div>
  );
}
