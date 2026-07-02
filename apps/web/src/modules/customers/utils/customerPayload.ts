import type { CreateCustomerPayload } from "../api/customersApi";
import {
  EMAIL_PATTERN,
  PHONE_PATTERN,
  SYMBOL_PATTERN,
} from "../constants/customerUi.constants";

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The request failed.";
}

function normalizeText(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function normalizeOptionalText(value: FormDataEntryValue | null): string | null {
  const normalized = normalizeText(value);
  return normalized ? normalized : null;
}

function normalizePhone(value: FormDataEntryValue | null): string {
  return normalizeText(value).replace(/\s+/g, "");
}

function normalizeCivilId(value: FormDataEntryValue | null): string {
  return normalizeText(value).replace(/[^\d -]/g, "");
}

function validatePassword(password: string, input: {
  email: string;
  fullName: string;
}): void {
  const normalized = password.toLowerCase();
  const emailName = input.email.split("@")[0]?.toLowerCase() ?? "";
  const nameParts = input.fullName
    .toLowerCase()
    .split(/\s+/u)
    .filter((part) => part.length >= 3);

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters long.");
  }
  if (!/[a-z]/u.test(password)) {
    throw new Error("Password must include at least one lowercase letter.");
  }
  if (!/[A-Z]/u.test(password)) {
    throw new Error("Password must include at least one uppercase letter.");
  }
  if (!/[0-9]/u.test(password)) {
    throw new Error("Password must include at least one number.");
  }
  if (!SYMBOL_PATTERN.test(password)) {
    throw new Error("Password must include at least one symbol.");
  }
  if (/\s/u.test(password)) {
    throw new Error("Password must not contain spaces.");
  }
  if (emailName.length >= 3 && normalized.includes(emailName)) {
    throw new Error("Password must not contain the email name.");
  }
  if (nameParts.some((part) => normalized.includes(part))) {
    throw new Error("Password must not contain the customer name.");
  }
}

export function buildCreatePayload(formData: FormData): CreateCustomerPayload {
  const createMode = normalizeText(formData.get("create_mode"));
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");
  const fullName = normalizeText(formData.get("full_name"));
  const email = normalizeText(formData.get("email")).toLowerCase();
  const phone = normalizePhone(formData.get("phone"));
  const civilId = normalizeCivilId(formData.get("civil_id"));

  if (!fullName) {
    throw new Error("Full name is required.");
  }
  if (!EMAIL_PATTERN.test(email)) {
    throw new Error("Enter a valid email address.");
  }
  if (!PHONE_PATTERN.test(phone)) {
    throw new Error("Phone must be international format, like +923001234567.");
  }
  if (civilId.replace(/\D/g, "").length !== 12) {
    throw new Error("Civil ID must contain exactly 12 digits.");
  }

  const payload: CreateCustomerPayload = {
    full_name: fullName,
    email,
    phone,
    civil_id: civilId,
    timezone: normalizeOptionalText(formData.get("timezone")),
  };

  if (createMode !== "invite") {
    if (password !== confirmPassword) {
      throw new Error("Password and confirmation do not match.");
    }

    validatePassword(password, { email, fullName });
    payload.password = password;
    payload.confirm_password = confirmPassword;
  }

  return payload;
}
