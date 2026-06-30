import type { CreateCustomerPayload } from "@/modules/customers";

import {
  BOOKING_EMAIL_PATTERN,
  KUWAIT_PHONE_CODE,
  KUWAIT_PHONE_DIGIT_COUNT,
} from "../constants/bookingUi.constants";
import type { CreatePrivateTrainerBookingPayload } from "../api/adminBookingsApi";
import type { BookingPermission } from "../types/bookingUi.types";

export function hasPermission(
  permissions: readonly BookingPermission[],
  permission: BookingPermission,
): boolean {
  return permissions.includes(permission);
}

export function buildIdempotencyKey(
  payload: CreatePrivateTrainerBookingPayload,
): string {
  return [
    "private-booking",
    payload.session_date,
    payload.start_time.replace(":", "-"),
    payload.user_id.slice(0, 8),
    payload.trainer_staff_profile_id.slice(0, 8),
  ].join("-");
}

export function buildBulkBookingKey(input: {
  customerUserId: string;
  scheduleIds: string[];
}): string {
  return [
    "admin-bulk",
    input.customerUserId.slice(0, 8),
    input.scheduleIds.map((scheduleId) => scheduleId.slice(0, 8)).join("-"),
    Date.now().toString(36),
  ].join("-");
}

export function normalizeBookingText(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

export function normalizeBookingPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  const localDigits = digits.startsWith("965") ? digits.slice(3) : digits;

  return localDigits ? `${KUWAIT_PHONE_CODE}${localDigits}` : "";
}

export function normalizeBookingCivilId(value: string): string {
  return value.trim().replace(/[^\d -]/g, "");
}

export function bookingPhoneLocalValue(value: string): string {
  const digits = value.replace(/\D/g, "");

  return digits.startsWith("965") ? digits.slice(3) : digits;
}

export function isValidKuwaitBookingPhone(value: string): boolean {
  return bookingPhoneLocalValue(value).length === KUWAIT_PHONE_DIGIT_COUNT;
}

function createGeneratedAttendeePassword(): string {
  const bytes = new Uint32Array(2);

  if (typeof window !== "undefined" && window.crypto) {
    window.crypto.getRandomValues(bytes);
  } else {
    bytes[0] = Date.now();
    bytes[1] = Math.floor(Math.random() * 1_000_000);
  }

  return `Lafam-${bytes[0].toString(36)}-${bytes[1].toString(36)}aA1!`;
}

function assertAttendeeInput(input: {
  civilId: string;
  email: string;
  fullName: string;
  phone: string;
}): void {
  if (!input.fullName) {
    throw new Error("Full name is required.");
  }
  if (!BOOKING_EMAIL_PATTERN.test(input.email)) {
    throw new Error("Enter a valid email address.");
  }
  if (!isValidKuwaitBookingPhone(input.phone)) {
    throw new Error("Enter a valid Kuwait phone number.");
  }
  if (input.civilId.replace(/\D/g, "").length !== 12) {
    throw new Error("Invalid Civil ID.");
  }
}

export function buildManualAttendeePayload(
  formData: FormData,
): CreateCustomerPayload {
  const fullName = normalizeBookingText(formData.get("new_customer_full_name"));
  const email = normalizeBookingText(
    formData.get("new_customer_email"),
  ).toLowerCase();
  const phone = normalizeBookingPhone(
    String(formData.get("lookup_phone") ?? ""),
  );
  const civilId = normalizeBookingCivilId(
    String(formData.get("lookup_civil_id") ?? ""),
  );
  const password = createGeneratedAttendeePassword();

  assertAttendeeInput({
    civilId,
    email,
    fullName,
    phone,
  });

  return {
    full_name: fullName,
    email,
    phone,
    civil_id: civilId,
    password,
    confirm_password: password,
    timezone:
      normalizeBookingText(formData.get("new_customer_timezone")) ||
      "Asia/Kuwait",
  };
}
