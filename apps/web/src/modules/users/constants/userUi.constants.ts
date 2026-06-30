import type { AdminUserRole, AdminUserStatus } from "../api/usersApi";

export const fieldClass =
  "min-h-12 w-full rounded-sm border border-background-secondary bg-card-bg-primary px-4 text-base text-txt-primary outline-none transition placeholder:text-txt-secondary focus:border-primary";

export const pageSizeOptions = [10, 25, 50];

export const roles: AdminUserRole[] = [
  "customer",
  "guest",
  "trainer",
  "stylist",
  "staff",
  "admin",
  "super_admin",
  "user",
];

export const statuses: AdminUserStatus[] = [
  "active",
  "pending_email_verification",
  "guest_active",
  "deactivated",
];
