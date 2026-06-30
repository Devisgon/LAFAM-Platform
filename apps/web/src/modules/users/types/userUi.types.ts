import type { AdminUser } from "../api/usersApi";

export type Confirmation = {
  action: "deactivate" | "reactivate" | "delete";
  user: AdminUser;
};

export type ResultToast = {
  message: string;
  title: string;
  tone: "success" | "error";
};
