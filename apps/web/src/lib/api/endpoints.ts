export const ENDPOINTS = {
  AUTH: { LOGIN: "/auth/login", ME: "/auth/me", REFRESH: "/auth/refresh-token", LOGOUT: "/auth/logout" },
  DASHBOARD: "/admin/analytics/dashboard", BOOKINGS: "/admin/bookings", CALENDAR: "/admin/bookings/calendar", PAYMENTS: "/admin/payments",
  PILATES: "/admin/pilates", STAFF: "/admin/staff", USERS: "/auth/admin/users", WALLETS: "/admin/wallets", PUBLIC_CLASSES: "/classes",
  WALLET: {
    GET: "/wallet",
    TOP_UP: "/wallet/top-up",
    TRANSACTIONS: "/wallet/transactions",
    TRANSACTION: (id: string) => `/wallet/transactions/${encodeURIComponent(id)}`,
  },
} as const;
