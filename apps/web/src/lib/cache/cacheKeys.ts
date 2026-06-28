export const CACHE_KEYS = {
  auth: { me: ["auth", "me"] as const }, dashboard: { analytics: ["dashboard", "analytics"] as const }, bookings: { all: ["bookings"] as const, user: ["bookings", "user"] as const, userPrivate: ["bookings", "user", "private"] as const, detail: ["bookings", "detail"] as const, privateDetail: ["bookings", "private", "detail"] as const },
  calendar: { all: ["calendar"] as const }, payments: { all: ["payments"] as const, user: ["payments", "user"] as const, detail: ["payments", "detail"] as const, transactions: ["payments", "transactions"] as const }, pilates: { all: ["pilates"] as const, publicClasses: ["pilates", "public"] as const, publicSchedules: ["pilates", "public", "schedules"] as const },
  staff: { all: ["staff"] as const }, users: { all: ["users"] as const }, wallet: { all: ["wallet"] as const, userWallet: ["wallet", "user"] as const, transactions: ["wallet", "transactions"] as const, transaction: ["wallet", "transaction"] as const },
} as const;
