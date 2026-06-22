export const LEGACY_AUTH_SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

export function resolveSessionCookieMaxAgeSeconds(
  expiresAt: string | null | undefined,
  nowMs: number = Date.now(),
): number | null {
  if (expiresAt == null) {
    // Temporary compatibility for successful responses from the older API shape.
    return LEGACY_AUTH_SESSION_MAX_AGE_SECONDS;
  }

  const expiresAtMs = Date.parse(expiresAt);

  if (!Number.isFinite(expiresAtMs)) {
    return null;
  }

  const maxAgeSeconds = Math.floor((expiresAtMs - nowMs) / 1000);

  return maxAgeSeconds > 0 ? maxAgeSeconds : null;
}
