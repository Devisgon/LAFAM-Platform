export const CACHE_KEYS = {
  auth: { me: ["auth", "me"] as const }, dashboard: { analytics: ["dashboard", "analytics"] as const }, bookings: { all: ["bookings"] as const },
  calendar: { all: ["calendar"] as const }, payments: { all: ["payments"] as const }, pilates: { all: ["pilates"] as const, publicClasses: ["pilates", "public"] as const },
  staff: { all: ["staff"] as const }, users: { all: ["users"] as const }, wallet: { all: ["wallet"] as const, userWallet: ["wallet", "user"] as const, transactions: ["wallet", "transactions"] as const, transaction: ["wallet", "transaction"] as const },
} as const;
