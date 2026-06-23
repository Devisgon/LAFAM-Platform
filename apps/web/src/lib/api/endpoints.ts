export const ENDPOINTS = {
  AUTH: { LOGIN: "/auth/login", ME: "/auth/me", REFRESH: "/auth/refresh-token", LOGOUT: "/auth/logout" },
  DASHBOARD: "/admin/analytics/dashboard", BOOKINGS: "/admin/bookings", CALENDAR: "/admin/bookings/calendar", PAYMENTS: "/admin/payments",
  PILATES: "/admin/pilates", STAFF: "/admin/staff", USERS: "/auth/admin/users", WALLETS: "/admin/wallets", PUBLIC_CLASSES: "/pilates/classes",
  PUBLIC_PILATES: {
    CLASSES: "/pilates/classes",
    CLASS: (id: string) => `/pilates/classes/${encodeURIComponent(id)}`,
    SCHEDULES: "/pilates/schedules",
    SCHEDULE: (id: string) => `/pilates/schedules/${encodeURIComponent(id)}`,
  },
  CUSTOMER_BOOKINGS: {
    CREATE: "/bookings",
    LIST: "/bookings",
    DETAIL: (id: string) => `/bookings/${encodeURIComponent(id)}`,
    CANCEL: (id: string) => `/bookings/${encodeURIComponent(id)}/cancel`,
    RESCHEDULE: (id: string) => `/bookings/${encodeURIComponent(id)}/reschedule`,
  },
  CUSTOMER_PRIVATE_BOOKINGS: {
    CREATE: "/bookings/private-trainer",
    LIST: "/bookings/private-trainer",
    AVAILABILITY: (trainerId: string) =>
      `/bookings/private-trainer/availability/${encodeURIComponent(trainerId)}`,
    DETAIL: (id: string) => `/bookings/private-trainer/${encodeURIComponent(id)}`,
    CANCEL: (id: string) => `/bookings/private-trainer/${encodeURIComponent(id)}/cancel`,
    RESCHEDULE: (id: string) => `/bookings/private-trainer/${encodeURIComponent(id)}/reschedule`,
  },
  CUSTOMER_PAYMENTS: {
    CHECKOUT: "/payments/checkout",
    DETAIL: (id: string) => `/payments/${encodeURIComponent(id)}`,
    LIST: "/payments",
    TRANSACTIONS: (id: string) => `/payments/${encodeURIComponent(id)}/transactions`,
    VERIFY: (id: string) => `/payments/${encodeURIComponent(id)}/verify`,
  },
  WALLET: {
    GET: "/wallet",
    TOP_UP: "/wallet/top-up",
    TRANSACTIONS: "/wallet/transactions",
    TRANSACTION: (id: string) => `/wallet/transactions/${encodeURIComponent(id)}`,
  },
} as const;
