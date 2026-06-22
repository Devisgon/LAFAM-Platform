"use client";

import Image from "next/image";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { PasswordResetError } from "@/components/password_reset_shell";
import { useAuth } from "@/hooks/auth/useAuth";

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
    <main className="flex h-screen w-full items-center justify-center bg-[#f4dddd] px-4 py-10 font-sans text-black">
      <section className="flex w-full flex-col items-center">
        <div className="mb-10 flex flex-col items-center text-center">
          <Image
            src="/login-logo.svg"
            alt="LA FORME"
            width={150}
            height={150}
            priority
            className="h-auto w-[150px] object-contain"
          />
        </div>

        <div className="w-full max-w-[560px] overflow-hidden rounded-md bg-white shadow-2xl">
          <div className="flex h-20 items-center justify-center gap-3 bg-[#e9caca] text-black">
            <ShieldCheck size={30} strokeWidth={2.5} />

            <h1 className="text-xl font-bold uppercase tracking-wide">
              Enter Reset Code
            </h1>
          </div>

          {passwordResetEmail ? (
            <form onSubmit={handleSubmit} className="space-y-5 px-10 py-12">
              <p className="text-center text-[15px] font-medium leading-relaxed text-gray-500">
                Enter the code sent to{" "}
                <strong className="text-black">{passwordResetEmail}</strong>.
              </p>

              <div>
                <label
                  htmlFor="otp"
                  className="mb-1 block text-[16px] font-medium text-gray-500"
                >
                  Reset Code
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
                  disabled={isVerifyingResetOtp}
                  required
                  autoFocus
                  className="h-[58px] w-full rounded border border-gray-300 bg-white px-4 text-center text-lg font-semibold tracking-[0.35em] text-black outline-none disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              {error ? <PasswordResetError message={error} /> : null}

              <button
                type="submit"
                disabled={isVerifyingResetOtp}
                className="flex w-full items-center justify-center gap-2 rounded bg-[#e9caca] px-5 py-3.5 text-[16px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isVerifyingResetOtp ? "Verifying..." : "Verify Reset Code"}
                <ArrowRight size={18} />
              </button>

              <p className="pt-2 text-center text-[15px] text-gray-500">
                Wrong email?{" "}
                <Link
                  href="/auth/forgot-password"
                  className="font-semibold text-[#d8abab] transition hover:text-black"
                >
                  Request New Code
                </Link>
              </p>
            </form>
          ) : (
            <div className="space-y-5 px-10 py-12">
              <p className="text-center text-[15px] font-medium leading-relaxed text-gray-500">
                Request a password reset code before continuing.
              </p>

              <Link
                href="/auth/forgot-password"
                className="block w-full rounded bg-[#e9caca] px-5 py-3.5 text-center text-[16px] font-semibold text-white transition hover:bg-black"
              >
                Request New Code
              </Link>
            </div>
          )}
        </div>

        <p className="mt-7 text-center text-[16px] text-black/45">
          © Copyright 2026. All Rights Reserved.
        </p>
      </section>
    </main>
  );
}