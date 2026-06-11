"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock } from "lucide-react";
import {
  PasswordResetError,
  PasswordResetShell,
} from "@/components/password_reset_shell";
import { useAuth } from "@/hooks/useAuth";

export default function ResetPasswordPage() {
  const router = useRouter();
  const {
    passwordResetEmail,
    resetPassword,
    isResettingPassword,
    error,
    clearError,
  } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();
    setFormError(null);

    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    try {
      await resetPassword({
        password,
        confirm_password: confirmPassword,
      });
      router.replace("/?passwordReset=1");
    } catch {
      // The shared auth error is rendered below.
    }
  };

  return (
    <PasswordResetShell
      title="Set a new password"
      description={
        passwordResetEmail ? (
          <>
            Create a new password for{" "}
            <strong className="text-text-primary">{passwordResetEmail}</strong>.
          </>
        ) : (
          "Verify your password reset code before setting a new password."
        )
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <ResetPasswordInput
          id="password"
          label="New Password"
          value={password}
          onChange={setPassword}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          disabled={isResettingPassword}
        />
        <ResetPasswordInput
          id="confirmPassword"
          label="Confirm New Password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          disabled={isResettingPassword}
        />

        {formError || error ? (
          <PasswordResetError message={formError ?? error ?? ""} />
        ) : null}

        <button
          type="submit"
          disabled={isResettingPassword}
          className="flex w-full items-center justify-center rounded-2xl bg-button-primary py-4 text-sm font-semibold text-white transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isResettingPassword ? "Updating Password..." : "Update Password"}
        </button>
      </form>
    </PasswordResetShell>
  );
}

type ResetPasswordInputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  disabled: boolean;
};

function ResetPasswordInput({
  id,
  label,
  value,
  onChange,
  showPassword,
  setShowPassword,
  disabled,
}: ResetPasswordInputProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-xs font-semibold text-text-secondary">
        {label}
      </label>
      <div className="relative flex items-center">
        <Lock className="absolute left-4 h-5 w-5 text-text-secondary/60" />
        <input
          id={id}
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-2xl border border-text-secondary/10 bg-background-primary py-4 pl-12 pr-12 text-sm outline-none transition-all focus:border-primary/40 focus:ring-4 focus:ring-primary/10 disabled:opacity-60"
          disabled={disabled}
          required
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-4 text-text-secondary/60 hover:text-text-primary"
          disabled={disabled}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? (
            <EyeOff className="h-5 w-5" />
          ) : (
            <Eye className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  );
}
