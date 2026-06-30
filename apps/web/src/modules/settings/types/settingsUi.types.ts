import type { ActiveSession } from "@/modules/auth";

export type Confirmation =
  | { action: "revoke"; session: ActiveSession }
  | { action: "logout-current" | "logout-all" | "delete-account" };

export type ResultToast = {
  title: string;
  message: string;
  tone: "success" | "error";
};

export type IconName = "camera" | "chevron" | "edit" | "key";
