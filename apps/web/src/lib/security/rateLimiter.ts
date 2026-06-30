// Framework-agnostic rate limiter. React hooks should wrap this instead of
// keeping a separate rate-limit counter.
export type RateLimiter = {
  canRun: (now?: number) => boolean;
  reset: () => void;
};

export function createRateLimiter(windowMs: number): RateLimiter {
  let lastRun = 0;

  return {
    canRun(now = Date.now()) {
      if (now - lastRun < windowMs) return false;
      lastRun = now;
      return true;
    },
    reset() {
      lastRun = 0;
    },
  };
}
