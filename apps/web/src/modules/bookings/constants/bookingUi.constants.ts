import type {
  AdminBookingStatus,
  AdminWaitlistEntryStatus,
} from "../api/adminBookingsApi";

export const fieldClass =
  "min-h-12 w-full rounded-sm border border-background-secondary bg-card-bg-primary px-4 text-base text-txt-primary outline-none transition placeholder:text-txt-secondary focus:border-primary";

export const KUWAIT_PHONE_CODE = "+965";
export const KUWAIT_PHONE_DIGIT_COUNT = 8;
export const BOOKING_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export const pageSizeOptions = [10, 25, 50];

export const bookingStatuses: AdminBookingStatus[] = [
  "pending_payment",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
  "expired",
  "rescheduled",
  "deleted",
];

export const waitlistStatuses: AdminWaitlistEntryStatus[] = [
  "waiting",
  "promoted",
  "converted",
  "cancelled",
  "expired",
  "removed",
];
