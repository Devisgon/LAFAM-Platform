"use client";

import { type FormEvent, useState } from "react";
import { X } from "lucide-react";

import { FormInput, PasswordInput } from "./CustomerFormControls";

export function CustomerCreateForm({
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
