"use client";

import { useState } from "react";
import { createRateLimiter } from "@/lib/security/rateLimiter";

// React wrapper around the shared rate limiter. The counter lives in the
// limiter instance, not in a second hook-specific implementation.
export function useRateLimit(windowMs = 1_000) {
  const [limiter] = useState(() => createRateLimiter(windowMs));
  return limiter;
}
