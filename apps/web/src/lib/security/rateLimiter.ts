export function createRateLimiter(windowMs: number) { let lastRun = 0; return { canRun(now = Date.now()) { if (now - lastRun < windowMs) return false; lastRun = now; return true; }, reset() { lastRun = 0; } }; }

