"use client";
import { useState } from "react";
import { createRateLimiter } from "@/lib/security/rateLimiter";
export function useRateLimit(windowMs = 1_000) {
  const [limiter] = useState(() => createRateLimiter(windowMs));
  return limiter;
}
