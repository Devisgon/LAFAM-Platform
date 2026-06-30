import type { StaffDayOfWeek } from "../api/staffApi";

export const inputClass =
  "min-h-12 w-full rounded-sm border border-background-secondary bg-card-bg-primary px-4 py-2 text-base text-txt-primary outline-none transition placeholder:text-txt-secondary focus:border-primary disabled:cursor-not-allowed disabled:opacity-60";
export const ADD_STAFF_HASH = ["#", "add-staff"].join("");

export const pageSizeOptions = [10, 25, 50];

export const days: Array<{ label: string; short: string; value: StaffDayOfWeek }> = [
  { label: "Sunday", short: "Sun", value: 0 },
  { label: "Monday", short: "Mon", value: 1 },
  { label: "Tuesday", short: "Tue", value: 2 },
  { label: "Wednesday", short: "Wed", value: 3 },
  { label: "Thursday", short: "Thu", value: 4 },
  { label: "Friday", short: "Fri", value: 5 },
  { label: "Saturday", short: "Sat", value: 6 },
];
