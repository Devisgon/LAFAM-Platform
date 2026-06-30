// Shared app-level auth types used outside the auth module.
export type AppRole =
  | "super_admin"
  | "admin"
  | "trainer"
  | "stylist"
  | "staff"
  | "customer"
  | "user"
  | "guest";

export type AppSession = {
  accessToken: string;
  role: AppRole;
};
