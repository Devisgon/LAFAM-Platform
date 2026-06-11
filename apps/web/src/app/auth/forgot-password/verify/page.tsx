"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import {
  PasswordResetError,
  PasswordResetShell,
} from "@/components/password_reset_shell";
import { useAuth } from "@/hooks/useAuth";

export default function VerifyResetOtpPage() {
  const router = useRouter();
  const {
    passwordResetEmail,
    verifyResetOtp,
    isVerifyingResetOtp,
    error,
    clearError,
  } = useAuth();
  const [otp, setOtp] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();

    try {
      await verifyResetOtp(otp);
      router.push("/auth/forgot-password/reset");
    } catch {
      // The shared auth error is rendered below.
    }
  };

  return (
    <PasswordResetShell
      title="Enter reset code"
      description={
        passwordResetEmail ? (
          <>
            Enter the code sent to{" "}
            <strong className="text-text-primary">{passwordResetEmail}</strong>.
          </>
        ) : (
          "Request a password reset code before continuing."
        )
      }
    >
      {passwordResetEmail ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="otp"
              className="text-xs font-semibold text-text-secondary"
            >
              Reset code
            </label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              minLength={4}
              maxLength={10}
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              className="w-full rounded-2xl border border-text-secondary/10 bg-background-primary px-4 py-4 text-center text-lg font-semibold tracking-[0.3em] outline-none transition-all focus:border-primary/40 focus:ring-4 focus:ring-primary/10 disabled:opacity-60"
              disabled={isVerifyingResetOtp}
              required
              autoFocus
            />
          </div>

          {error ? <PasswordResetError message={error} /> : null}

          <button
            type="submit"
            disabled={isVerifyingResetOtp}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-button-primary py-4 text-sm font-semibold text-white transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isVerifyingResetOtp ? "Verifying..." : "Verify reset code"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      ) : (
        <Link
          href="/auth/forgot-password"
          className="block rounded-2xl bg-button-primary py-4 text-center text-sm font-semibold text-white"
        >
          Request a new code
        </Link>
      )}
    </PasswordResetShell>
  );
}
