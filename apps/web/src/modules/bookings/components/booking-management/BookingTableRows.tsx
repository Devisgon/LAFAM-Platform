"use client";

import { Badge } from "@/components/ui/Badge";

import type {
  AdminBooking,
  AdminWaitlistEntry,
  PrivateTrainerBooking,
} from "../../api/adminBookingsApi";
import {
  formatDate,
  formatDateTime,
  formatPrice,
  formatTime,
  label,
  paymentTone,
  sourceLabel,
  statusTone,
} from "../../utils/bookingFormatters";

export function BookingRecordRow({
  booking,
  onView,
}: {
  booking: AdminBooking;
  onView: () => void;
}) {
  const customerName =
    booking.customer?.full_name ?? booking.customer?.email ?? "No customer";
  const trainerName =
    booking.trainer?.display_name ?? booking.trainer_staff_profile_id;
  const classTitle = booking.class?.title ?? "No class";
  const bookingDate =
    booking.schedule?.class_date ?? booking.created_at.slice(0, 10);

  return (
    <tr className="divide-x divide-background-secondary bg-background-secondary/40 transition hover:bg-card-bg-secondary">
      <td className="px-4 py-4 align-top">
        <strong className="block text-txt-primary">
          {booking.booking_number}
        </strong>
      </td>
      <td className="px-4 py-4 align-top">
        <strong className="block text-txt-primary">{customerName}</strong>
        <span className="mt-1 block text-sm text-txt-secondary">
          {booking.customer?.phone ?? booking.customer?.email ?? "No contact"}
        </span>
      </td>
      <td className="px-4 py-4 align-top text-txt-primary">{classTitle}</td>
      <td className="px-4 py-4 align-top text-txt-primary">{trainerName}</td>
      <td className="px-4 py-4 align-top">
        <strong className="block text-txt-primary">
          {formatDate(bookingDate)}
        </strong>
        <span className="mt-1 block text-sm text-txt-secondary">
          {booking.schedule?.start_time && booking.schedule.end_time
            ? `${booking.schedule.start_time} - ${booking.schedule.end_time}`
            : formatDateTime(booking.created_at)}
        </span>
      </td>
      <td className="px-4 py-4 align-top">
        <Badge tone={statusTone(booking.status)}>{label(booking.status)}</Badge>
      </td>
      <td className="px-4 py-4 align-top">
        <Badge tone={paymentTone(booking.payment_status)}>
          {label(booking.payment_status)}
        </Badge>
      </td>
      <td className="px-4 py-4 align-top text-sm font-semibold text-txt-primary">
        {sourceLabel(booking.source)}
      </td>
      <td className="px-4 py-4 align-top font-semibold text-txt-primary">
        {formatPrice(booking.price?.amount, booking.price?.currency)}
      </td>
      <td className="px-4 py-4 align-top">
        <button
          className="min-h-10 rounded-sm bg-button-primary px-4 text-sm font-semibold text-txt-primary transition hover:opacity-90"
          onClick={onView}
          type="button"
        >
          View booking
        </button>
      </td>
    </tr>
  );
}

export function PrivateBookingRecordRow({
  booking,
  onView,
}: {
  booking: PrivateTrainerBooking;
  onView: () => void;
}) {
  const customerName =
    booking.customer?.full_name ?? booking.customer?.email ?? "No customer";
  const trainerName =
    booking.trainer?.display_name ?? booking.trainer_staff_profile_id;

  return (
    <tr className="divide-x divide-background-secondary bg-background-secondary/40 transition hover:bg-card-bg-secondary">
      <td className="px-4 py-4 align-top">
        <strong className="block text-txt-primary">
          {booking.booking_number}
        </strong>
        <span className="mt-1 block font-mono text-xs text-txt-secondary">
          {booking.id}
        </span>
      </td>
      <td className="px-4 py-4 align-top">
        <strong className="block text-txt-primary">{customerName}</strong>
        <span className="mt-1 block text-sm text-txt-secondary">
          {booking.customer?.phone ?? booking.customer?.email ?? "No contact"}
        </span>
      </td>
      <td className="px-4 py-4 align-top text-txt-primary">
        Private trainer
        <span className="mt-1 block text-sm text-txt-secondary">
          {booking.studio}
        </span>
      </td>
      <td className="px-4 py-4 align-top text-txt-primary">{trainerName}</td>
      <td className="px-4 py-4 align-top">
        <strong className="block text-txt-primary">
          {formatDate(booking.session_date)}
        </strong>
        <span className="mt-1 block text-sm text-txt-secondary">
          {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
        </span>
      </td>
      <td className="px-4 py-4 align-top">
        <Badge tone={statusTone(booking.status)}>{label(booking.status)}</Badge>
      </td>
      <td className="px-4 py-4 align-top">
        <Badge tone={paymentTone(booking.payment_status)}>
          {label(booking.payment_status)}
        </Badge>
      </td>
      <td className="px-4 py-4 align-top text-sm font-semibold text-txt-primary">
        {sourceLabel(booking.source)}
      </td>
      <td className="px-4 py-4 align-top font-semibold text-txt-primary">
        {formatPrice(booking.price?.amount, booking.price?.currency)}
      </td>
      <td className="px-4 py-4 align-top">
        <button
          className="min-h-10 rounded-sm bg-button-primary px-4 text-sm font-semibold text-txt-primary transition hover:opacity-90"
          onClick={onView}
          type="button"
        >
          View booking
        </button>
      </td>
    </tr>
  );
}

export function WaitlistRecordRow({
  canManage,
  entry,
  isRemoving,
  onRemove,
}: {
  canManage: boolean;
  entry: AdminWaitlistEntry;
  isRemoving: boolean;
  onRemove: () => void;
}) {
  const customerName =
    entry.customer?.full_name ?? entry.customer?.email ?? "No customer";
  const trainerName =
    entry.trainer?.display_name ??
    entry.schedule?.trainer_staff_profile_id ??
    entry.trainer_staff_profile_id ??
    "No trainer";
  const classTitle = entry.class?.title ?? "No class";
  const scheduleDate =
    entry.schedule?.class_date ?? entry.joined_at.slice(0, 10);
  const canRemove = entry.status === "waiting" || entry.status === "promoted";

  return (
    <tr className="divide-x divide-background-secondary bg-background-secondary/40 transition hover:bg-card-bg-secondary">
      <td className="px-4 py-4 align-top">
        <strong className="block text-txt-primary">#{entry.position}</strong>
        <span className="mt-1 block font-mono text-xs text-txt-secondary">
          {entry.id}
        </span>
      </td>
      <td className="px-4 py-4 align-top">
        <strong className="block text-txt-primary">{customerName}</strong>
        <span className="mt-1 block text-sm text-txt-secondary">
          {entry.customer?.phone ?? entry.customer?.email ?? "No contact"}
        </span>
      </td>
      <td className="px-4 py-4 align-top text-txt-primary">
        {classTitle}
        <span className="mt-1 block text-sm text-txt-secondary">
          {entry.schedule?.studio ?? entry.schedule_id}
        </span>
      </td>
      <td className="px-4 py-4 align-top text-txt-primary">{trainerName}</td>
      <td className="px-4 py-4 align-top">
        <strong className="block text-txt-primary">
          {formatDate(scheduleDate)}
        </strong>
        <span className="mt-1 block text-sm text-txt-secondary">
          {entry.schedule?.start_time && entry.schedule.end_time
            ? `${formatTime(entry.schedule.start_time)} - ${formatTime(entry.schedule.end_time)}`
            : "Schedule time unavailable"}
        </span>
      </td>
      <td className="px-4 py-4 align-top">
        <Badge tone={statusTone(entry.status)}>{label(entry.status)}</Badge>
      </td>
      <td className="px-4 py-4 align-top text-sm font-semibold text-txt-primary">
        {formatDateTime(entry.joined_at)}
      </td>
      <td className="px-4 py-4 align-top text-sm text-txt-primary">
        <span className="block">
          {entry.promoted_at
            ? formatDateTime(entry.promoted_at)
            : "Not promoted"}
        </span>
        <span className="mt-1 block text-txt-secondary">
          Expires {formatDateTime(entry.promotion_expires_at)}
        </span>
      </td>
      {canManage ? (
        <td className="px-4 py-4 align-top">
          <button
            className="min-h-10 rounded-sm bg-error px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canRemove || isRemoving}
            onClick={onRemove}
            type="button"
          >
            {isRemoving ? "Removing..." : canRemove ? "Remove" : "Closed"}
          </button>
        </td>
      ) : null}
    </tr>
  );
}
