"use client";

import Image from "next/image";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Mail } from "lucide-react";
import { PasswordResetError } from "@/components/password_reset_shell";
import { useAuth } from "@/hooks/auth/useAuth";

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
            <Mail size={30} strokeWidth={2.5} />
            <h1 className="text-xl font-bold uppercase tracking-wide">
              Forgot Password
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 px-10 py-12">
            <p className="text-center text-[15px] font-medium leading-relaxed text-gray-500">
              Enter your email address and we will send you a password reset
              code.
            </p>

            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-[16px] font-medium text-gray-500"
              >
                Email Address
              </label>

              <div className="flex h-[58px] overflow-hidden rounded border border-gray-300 bg-white">
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={isRequestingPasswordReset}
                  required
                  autoFocus
                  className="h-full flex-1 px-4 text-base text-black outline-none disabled:cursor-not-allowed disabled:opacity-60"
                />

                <span className="flex h-full w-14 items-center justify-center border-l border-gray-300 bg-gray-100 text-black">
                  <Mail size={23} strokeWidth={2} />
                </span>
              </div>
            </div>

            {error ? <PasswordResetError message={error} /> : null}

            <button
              type="submit"
              disabled={isRequestingPasswordReset}
              className="flex w-full items-center justify-center gap-2 rounded bg-[#e9caca] px-5 py-3.5 text-[16px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRequestingPasswordReset ? "Sending..." : "Send Reset Code"}
              <ArrowRight size={18} />
            </button>

            <p className="pt-2 text-center text-[15px] text-gray-500">
              Remember your password?{" "}
              <Link
                href="/"
                className="font-semibold text-[#d8abab] transition hover:text-black"
              >
                Sign In
              </Link>
            </p>
          </form>
        </div>

        <p className="mt-7 text-center text-[16px] text-black/45">
          © Copyright 2026. All Rights Reserved.
        </p>
      </section>
    </main>
  );
}