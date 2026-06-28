"use client";

import {
  type FormEvent,
  type InputHTMLAttributes,
  useState,
} from "react";
import { Eye, EyeOff, Plus, X } from "lucide-react";
import { Toast } from "@/components/ui/Toast";
import {
  type CreateCustomerPayload,
  adminCustomersClient,
} from "@/modules/customers";

type ResultToast = {
  message: string;
  title: string;
  tone: "success" | "error";
};

const fieldClass =
  "min-h-12 w-full rounded-sm border border-background-secondary bg-card-bg-primary px-4 py-2 text-base text-txt-primary outline-none transition placeholder:text-txt-secondary focus:border-primary disabled:cursor-not-allowed disabled:opacity-60";
const PHONE_PATTERN = /^\+?[1-9]\d{6,15}$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const SYMBOL_PATTERN = /[^A-Za-z0-9]/u;

function getErrorMessage(error: unknown): string {
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

function buildCreatePayload(formData: FormData): CreateCustomerPayload {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");
  const fullName = normalizeText(formData.get("full_name"));
  const email = normalizeText(formData.get("email")).toLowerCase();
  const phone = normalizePhone(formData.get("phone"));
  const civilId = normalizeCivilId(formData.get("civil_id"));

  if (password !== confirmPassword) {
    throw new Error("Password and confirmation do not match.");
  }
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

  validatePassword(password, { email, fullName });

  return {
    full_name: fullName,
    email,
    phone,
    civil_id: civilId,
    password,
    confirm_password: confirmPassword,
    timezone: normalizeOptionalText(formData.get("timezone")),
  };
}

export function AdminCustomerManager() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [toast, setToast] = useState<ResultToast | null>(null);

  const submitCustomer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setIsCreating(true);
    try {
      const created = await adminCustomersClient.create(
        buildCreatePayload(new FormData(event.currentTarget)),
      );

      event.currentTarget.reset();
      setIsCreateOpen(false);
      setToast({
        title: "Customer user created",
        message: `${created.full_name} can log in immediately.`,
        tone: "success",
      });
      window.dispatchEvent(new CustomEvent("lafam:users:changed"));
    } catch (requestError: unknown) {
      setToast({
        title: "Customer user not created",
        message: getErrorMessage(requestError),
        tone: "error",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <section aria-label="Customer user creation" className="grid gap-5">
        {isCreateOpen ? (
          <CustomerCreateForm
            isSaving={isCreating}
            onCancel={() => setIsCreateOpen(false)}
            onSubmit={submitCustomer}
          />
        ) : (
          <section className="flex flex-col gap-4 rounded-md bg-card-bg-primary px-5 py-5 shadow-sm md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-medium">Add Customer User</h2>
              <p className="mt-1 text-sm text-txt-secondary">
                Create a verified customer user account. The user list below remains the single account list.
              </p>
            </div>
            <button
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-sm bg-button-primary px-5 text-base font-semibold text-txt-primary transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              onClick={() => setIsCreateOpen(true)}
              type="button"
            >
              <Plus aria-hidden="true" size={18} />
              Add customer user
            </button>
          </section>
        )}
      </section>

      {toast ? (
        <div className="fixed right-4 top-4 z-[90]">
          <Toast
            onDismiss={() => setToast(null)}
            title={toast.title}
            tone={toast.tone}
          >
            {toast.message}
          </Toast>
        </div>
      ) : null}
    </>
  );
}

function CustomerCreateForm({
  isSaving,
  onCancel,
  onSubmit,
}: {
  isSaving: boolean;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <form
      className="overflow-hidden rounded-md border border-background-secondary bg-card-bg-primary text-txt-primary shadow-sm"
      onSubmit={onSubmit}
    >
      <header className="flex items-start justify-between gap-4 border-b border-background-secondary bg-card-bg-primary px-5 py-5">
        <div>
          <h2 className="text-2xl font-medium">Add Customer User</h2>
          <p className="mt-1 text-sm text-txt-secondary">
            Admin-created customer users are active and verified immediately.
          </p>
        </div>
        <button
          aria-label="Close customer user form"
          className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-background-secondary text-txt-secondary"
          disabled={isSaving}
          onClick={onCancel}
          type="button"
        >
          <X aria-hidden="true" size={17} />
        </button>
      </header>

      <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
        <FormInput
          autoComplete="name"
          disabled={isSaving}
          label="Full name"
          maxLength={120}
          name="full_name"
          required
        />
        <FormInput
          autoComplete="email"
          disabled={isSaving}
          label="Email"
          maxLength={254}
          name="email"
          required
          type="email"
        />
        <FormInput
          autoComplete="tel"
          disabled={isSaving}
          label="Phone"
          maxLength={32}
          name="phone"
          placeholder="+923001234567"
          required
          type="tel"
        />
        <FormInput
          disabled={isSaving}
          label="Civil ID"
          maxLength={32}
          name="civil_id"
          placeholder="2990-1011-2345"
          required
        />
        <PasswordInput
          autoComplete="new-password"
          disabled={isSaving}
          label="Password"
          maxLength={128}
          minLength={8}
          name="password"
          onToggle={() => setShowPassword((value) => !value)}
          required
          showPassword={showPassword}
        />
        <PasswordInput
          autoComplete="new-password"
          disabled={isSaving}
          label="Confirm password"
          maxLength={128}
          minLength={8}
          name="confirm_password"
          onToggle={() => setShowConfirmPassword((value) => !value)}
          required
          showPassword={showConfirmPassword}
        />
        <FormInput
          autoComplete="off"
          defaultValue="Asia/Kuwait"
          disabled={isSaving}
          label="Timezone"
          maxLength={64}
          name="timezone"
          placeholder="Asia/Kuwait"
        />
      </div>

      <footer className="flex justify-start gap-2 border-t border-background-secondary px-5 py-5">
        <button
          className="min-h-11 rounded-sm bg-button-primary px-4 py-3 text-xs font-bold text-txt-primary hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSaving}
          type="submit"
        >
          {isSaving ? "Creating..." : "Create customer user"}
        </button>
        <button
          className="min-h-11 rounded-sm border border-background-secondary px-4 py-3 text-xs font-bold text-txt-secondary transition hover:bg-background-secondary disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSaving}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </footer>
    </form>
  );
}

function PasswordInput({
  className,
  label: inputLabel,
  onToggle,
  showPassword,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  onToggle: () => void;
  showPassword: boolean;
}) {
  const Icon = showPassword ? EyeOff : Eye;

  return (
    <label className={`grid gap-1.5 text-xs font-bold ${className ?? ""}`}>
      {inputLabel}
      <span className="relative">
        <input
          className={`${fieldClass} pr-12`}
          type={showPassword ? "text" : "password"}
          {...props}
        />
        <button
          aria-label={showPassword ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-sm text-txt-secondary transition hover:bg-background-secondary hover:text-txt-primary"
          onClick={onToggle}
          type="button"
        >
          <Icon aria-hidden="true" size={18} />
        </button>
      </span>
    </label>
  );
}

function FormInput({
  className,
  label: inputLabel,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={`grid gap-1.5 text-xs font-bold ${className ?? ""}`}>
      {inputLabel}
      <input className={fieldClass} {...props} />
    </label>
  );
}
