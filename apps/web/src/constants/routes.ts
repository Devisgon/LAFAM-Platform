export const ROUTES = {
  ROOT: "/", LOGIN: "/login", SIGNUP: "/signup", FORGOT_PASSWORD: "/forgot-password", VERIFY_EMAIL: "/verify-email",
  DASHBOARD: "/dashboard", BOOKINGS: "/bookings", CALENDAR: "/calendar", PAYMENTS: "/payments", PILATES: "/services/pilates",
  SETTINGS: "/settings", STAFF: "/staff", USERS: "/users", WALLET: "/wallet", UNAUTHORIZED: "/unauthorized",
} as const;
export const AUTH_ROUTES = [ROUTES.LOGIN, ROUTES.SIGNUP, ROUTES.FORGOT_PASSWORD, ROUTES.VERIFY_EMAIL] as const;
export const PROTECTED_ROUTES = [ROUTES.DASHBOARD, ROUTES.BOOKINGS, ROUTES.CALENDAR, ROUTES.PAYMENTS, ROUTES.PILATES, ROUTES.SETTINGS, ROUTES.STAFF, ROUTES.USERS, ROUTES.WALLET] as const;

