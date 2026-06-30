import { fallbackTimezones } from "../constants/settingsUi.constants";
import type { Confirmation } from "../types/settingsUi.types";

export function formatDate(value: string | null): string {
  if (!value) return "Not available";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

export function getTimezoneOptions(currentTimezone?: string | null): string[] {
  let supportedTimezones = fallbackTimezones;

  try {
    supportedTimezones = Intl.supportedValuesOf("timeZone");
  } catch {
    // Keep the stable fallback list when runtime enumeration is unavailable.
  }

  return Array.from(
    new Set([
      ...supportedTimezones,
      ...fallbackTimezones,
      ...(currentTimezone ? [currentTimezone] : []),
    ]),
  ).sort((left, right) => left.localeCompare(right));
}

export function getConfirmationCopy(confirmation: Confirmation | null) {
  if (!confirmation) return null;

  if (confirmation.action === "revoke") {
    return {
      title: "Revoke this session?",
      description: `${confirmation.session.device_name ?? "This device"} will be signed out and must authenticate again.`,
      confirmLabel: "Yes, revoke session",
    };
  }

  if (confirmation.action === "logout-all") {
    return {
      title: "Logout all sessions?",
      description:
        "Every active device, including this one, will be signed out of your account.",
      confirmLabel: "Yes, logout all",
    };
  }

  if (confirmation.action === "delete-account") {
    return {
      title: "Delete your account?",
      description:
        "Your account will be soft-deleted and every active session will be revoked. This action cannot be undone from the portal.",
      confirmLabel: "Yes, delete my account",
    };
  }

  return {
    title: "Logout current session?",
    description: "You will be signed out of this device.",
    confirmLabel: "Yes, logout",
  };
}
