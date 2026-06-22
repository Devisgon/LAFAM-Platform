"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, type FormEvent, useState } from "react";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";
import { useAuth } from "@/modules/auth";
import {
  cachePendingVerificationEmail,
  getCachedVerificationEmail,
} from "@/modules/auth";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailFallback />}>
      <VerifyEmailForm />
    </Suspense>
  );
}

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    pendingVerificationEmail,
    verifyEmail,
    resendVerificationOtp,
    isVerifyingEmail,
    isResendingVerification,
    error,
    clearError,
  } = useAuth();
  const [email, setEmail] = useState(
    () => pendingVerificationEmail ?? getCachedVerificationEmail() ?? "",
  );
  const [otp, setOtp] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const isBusy = isVerifyingEmail || isResendingVerification;

  const cacheEmail = (): string | null => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setLocalError("Enter the email address for this account.");
      return null;
    }

    cachePendingVerificationEmail(normalizedEmail);
    setEmail(normalizedEmail);
    return normalizedEmail;
  };

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();
    setLocalError(null);
    setResendMessage(null);

    if (!cacheEmail()) return;

    try {
      await verifyEmail(otp);
      const redirectPath = searchParams.get("redirect");
      const params = new URLSearchParams({ verified: "1" });

      if (redirectPath) {
        params.set("redirect", redirectPath);
      }

      router.replace(`/login?${params.toString()}`);
    } catch {
      // The shared auth error is rendered below.
    }
  };

  const handleResend = async () => {
    clearError();
    setLocalError(null);
    setResendMessage(null);

    if (!cacheEmail()) return;

    try {
      await resendVerificationOtp();
      setResendMessage("A new verification code was sent.");
    } catch {
      // The shared auth error is rendered below.
    }
  };

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4 py-10 font-sans text-black">
      <div
        className="auth-page-background absolute inset-0 scale-105 bg-cover bg-center"
      />
      <div className="absolute inset-0 bg-black/55" />

      <section className="relative z-10 flex w-full flex-col items-center">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src="/login-logo.svg"
            alt="LA FORME"
            width={170}
            height={170}
            priority
            className="h-auto w-[170px] object-contain"
          />
        </div>

        <div className="w-full max-w-[500px] overflow-hidden rounded-md bg-white shadow-2xl">
          <div className="flex h-16 items-center justify-center gap-3 bg-primary text-black">
            <ShieldCheck size={30} strokeWidth={2.5} />
            <h1 className="text-xl font-bold uppercase tracking-wide">
              Verify Email
            </h1>
          </div>

          <form onSubmit={handleVerify} className="space-y-5 px-10 py-6">
            <p className="text-center text-[15px] font-medium leading-relaxed text-gray-500">
              Verify your email before signing in.
            </p>

            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-[16px] font-medium text-gray-500"
              >
                Email Address
              </label>
              <div className="flex h-[48px] overflow-hidden rounded border border-gray-300 bg-white">
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={isBusy}
                  required
                  className="h-full flex-1 px-4 text-base text-black outline-none disabled:cursor-not-allowed disabled:opacity-60"
                />
                <span className="flex h-full w-14 items-center justify-center border-l border-gray-300 bg-gray-100 text-black">
                  <Mail size={22} strokeWidth={2} />
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="otp"
                className="mb-1 block text-[16px] font-medium text-gray-500"
              >
                Verification Code
              </label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                minLength={4}
                maxLength={15}
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                disabled={isBusy}
                required
                className="h-[48px] w-full rounded border border-gray-300 bg-white px-4 text-center text-lg font-semibold tracking-[0.35em] text-black outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            {localError || error ? (
              <p className="border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600">
                {localError ?? error}
              </p>
            ) : null}

            {resendMessage ? (
              <p className="border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm font-medium text-green-700">
                {resendMessage}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isBusy}
              className="w-full rounded bg-primary px-5 py-3.5 text-[16px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isVerifyingEmail ? "Verifying..." : "Verify Email"}
            </button>

            <button
              type="button"
              onClick={handleResend}
              disabled={isBusy}
              className="w-full text-center text-[15px] font-semibold text-primary transition hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isResendingVerification ? "Sending..." : "Resend Code"}
            </button>

            <Link
              href="/"
              className="flex items-center justify-center gap-2 text-[15px] font-semibold text-gray-500 transition hover:text-black"
            >
              <ArrowLeft size={16} />
              Back to sign in
            </Link>
          </form>
        </div>

        <p className="mt-7 text-center text-[16px] text-white/60">
          Copyright 2026. All Rights Reserved.
        </p>
      </section>
    </main>
  );
}

function VerifyEmailFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-txt-primary">
      <p className="text-sm text-txt-secondary">Loading verification...</p>
    </main>
  );
}
