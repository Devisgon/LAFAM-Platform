export type AppRole = "super_admin" | "admin" | "trainer" | "stylist" | "staff" | "customer" | "user" | "guest";
export type AppSession = { role: AppRole; accessToken: string };

