"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Mail } from "lucide-react";
import {
  PasswordResetError,
  PasswordResetShell,
} from "@/components/password_reset_shell";
import { useAuth } from "@/hooks/useAuth";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { forgotPassword, isRequestingPasswordReset, error, clearError } =
    useAuth();
  const [email, setEmail] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();

    try {
      await forgotPassword(email);
      router.push("/auth/forgot-password/verify");
    } catch {
      // The shared auth error is rendered below.
    }
  };

  return (
    <PasswordResetShell
      title="Forgot password?"
      description="Enter your email and we will send a password reset code."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="email"
            className="text-xs font-semibold text-text-secondary"
          >
            Email Address
          </label>
          <div className="relative flex items-center">
            <Mail className="absolute left-4 h-5 w-5 text-text-secondary/60" />
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-text-secondary/10 bg-background-primary py-4 pl-12 pr-4 text-sm outline-none transition-all focus:border-primary/40 focus:ring-4 focus:ring-primary/10 disabled:opacity-60"
              placeholder="name@example.com"
              disabled={isRequestingPasswordReset}
              required
              autoFocus
            />
          </div>
        </div>

        {error ? <PasswordResetError message={error} /> : null}

        <button
          type="submit"
          disabled={isRequestingPasswordReset}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-button-primary py-4 text-sm font-semibold text-white transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRequestingPasswordReset ? "Sending..." : "Send reset code"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>
    </PasswordResetShell>
  );
}
