export type ResultToast = {
  message: string;
  title: string;
  tone: "success" | "error";
};

export type BookingPermission = string;
export type BookingMode = "class" | "private" | "waitlist";
export type CreateBookingMode = "class" | "private";

export type LookupStatus = {
  tone: "idle" | "loading" | "success" | "warning" | "error";
  message: string;
};

export type CustomerDraft = {
  civilId: string;
  email: string;
  fullName: string;
  phone: string;
  timezone: string;
};
