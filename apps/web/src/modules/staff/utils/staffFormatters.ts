import type {
  CreateStaffPayload,
  StaffDayOfWeek,
  StaffMember,
  StaffStatus,
} from "../api/staffApi";
import { days } from "../constants/staffUi.constants";

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The request failed.";
}

export function statusLabel(status: string): string {
  return status
    .replace("_", " ")
    .replace(/^\w/, (value) => value.toUpperCase());
}

export function statusTone(status: StaffStatus): "success" | "warning" | "error" {
  if (status === "available") return "success";
  if (status === "deactivated" || status === "deleted") return "error";
  return "warning";
}

export function isActiveStaff(member: StaffMember): boolean {
  return member.staff_status !== "deactivated" && member.staff_status !== "deleted";
}

export function usernameFromEmail(email: string): string {
  return email.split("@")[0] || email;
}

export function availabilitySummary(member: StaffMember): {
  days: string;
  time: string;
} {
  const activeRules = member.availability.filter((rule) => rule.is_available);

  if (activeRules.length === 0) {
    return { days: "No working days", time: "Unavailable" };
  }

  return {
    days: activeRules
      .map(
        (rule) =>
          days.find((day) => day.value === rule.day_of_week)?.short ?? "?",
      )
      .join(", "),
    time: `${activeRules[0].start_time} - ${activeRules[0].end_time}`,
  };
}

export function buildCreatePayload(formData: FormData): CreateStaffPayload {
  const workingDays = formData
    .getAll("working_days")
    .map((value) => Number(value))
    .filter((value): value is StaffDayOfWeek =>
      days.some((day) => day.value === value),
    );

  if (workingDays.length === 0) {
    throw new Error("Select at least one working day.");
  }

  const password = String(formData.get("password"));
  const confirmPassword = String(formData.get("confirm_password"));

  if (password !== confirmPassword) {
    throw new Error("Password and confirmation do not match.");
  }

  const phone = String(formData.get("phone")).replace(/\s+/g, "");
  const specialties = String(formData.get("specialties"))
    .split(",")
    .map((specialty) => specialty.trim())
    .filter(Boolean);

  return {
    display_name: String(formData.get("display_name")).trim(),
    email: String(formData.get("email")).trim().toLowerCase(),
    ...(phone ? { phone } : {}),
    password,
    confirm_password: confirmPassword,
    address: String(formData.get("address")).trim(),
    portal_role:
      formData.get("portal_role") === "trainer" ? "trainer" : "trainer",
    post_title: String(formData.get("post_title")).trim(),
    working_days: workingDays,
    start_time: String(formData.get("start_time")),
    end_time: String(formData.get("end_time")),
    ...(specialties.length > 0 ? { specialties } : {}),
    bio: String(formData.get("bio")).trim(),
    status:
      formData.get("status") === "unavailable"
        ? "unavailable"
        : formData.get("status") === "on_leave"
          ? "on_leave"
          : "available",
  };
}
