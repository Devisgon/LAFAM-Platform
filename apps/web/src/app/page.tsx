"use client";

import { Suspense, type FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, UserRound } from "lucide-react";
import { useAuth } from "@/hooks/auth/useAuth";
import {
  isEmailVerificationRequiredError,
  resolvePostLoginRedirect,
} from "@/lib/auth/auth";

export default function LoginScreen() {
  return (
    <Suspense fallback={<LoginScreenFallback />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const emailVerified = searchParams.get("verified") === "1";
  const passwordReset = searchParams.get("passwordReset") === "1";

  const { login, isLoggingIn, error, clearError } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    clearError();

    try {
      const result = await login({
        email,
        password,
      });

      const redirectPath = searchParams.get("redirect");
      const nextPath = resolvePostLoginRedirect(result.user.role, redirectPath);

      router.replace(nextPath);
    } catch (error: unknown) {
      if (isEmailVerificationRequiredError(error)) {
        const verificationUrl = new URL(
          "/auth/verify-email",
          window.location.origin,
        );
        const redirectPath = searchParams.get("redirect");

        if (redirectPath) {
          verificationUrl.searchParams.set("redirect", redirectPath);
        }

        router.replace(`${verificationUrl.pathname}${verificationUrl.search}`);
      }
    }
  };

  return (
    <main className="relative flex h-screen w-full items-center justify-center overflow-hidden px-4 py-10 font-sans text-black">
      <div
        className="absolute inset-0 bg-cover bg-center bg-blur blur-sm scale-100"
        style={{
          backgroundImage: "url('/login_bg.jpg')",
        }}
      />

      <div className="absolute inset-0 bg-black/55" />

      <section className="relative z-10 flex w-full flex-col items-center">
        <div className="mb-10 flex bg-foreground rounded-lg  flex-col items-center text-center">
          <Image
            src="/login-logo.svg"
            alt="LA FORME"
            width={200}
            height={200}
            priority
            className="h-auto w-[200px] clear object-contain"
          />
        </div>

        <div className="w-full max-w-[500px] overflow-hidden rounded-md bg-white shadow-2xl">
          <div className="flex h-16 items-center justify-center gap-3 bg-[#e9caca] text-black">
            <UserRound size={30} strokeWidth={2.5} />
            <h1 className="text-xl font-bold uppercase tracking-wide">
              Sign In
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 px-10 py-6">
            {emailVerified ? (
              <p className="border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm font-medium text-green-700">
                Email verified. You can sign in now.
              </p>
            ) : null}

            {passwordReset ? (
              <p className="border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm font-medium text-green-700">
                Password updated. Sign in with your new password.
              </p>
            ) : null}

            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-[16px] font-medium text-gray-500"
              >
                Username
              </label>

              <div className="flex h-[48px] overflow-hidden rounded border border-gray-300 bg-white">
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoggingIn}
                  required
                  className="h-full flex-1 px-4 text-base text-black outline-none disabled:cursor-not-allowed disabled:opacity-60"
                />

                <span className="flex h-full w-14 items-center justify-center border-l border-gray-300 bg-gray-100 text-black">
                  <UserRound size={24} strokeWidth={2} />
                </span>
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-[16px] font-medium text-gray-500"
                >
                  Password
                </label>

                <Link
                  href="/auth/forgot-password"
                  className="text-[15px] font-medium text-[#e9caca] transition hover:text-black"
                >
                  Lost Password?
                </Link>
              </div>

              <div className="flex h-[48px] overflow-hidden rounded border border-gray-300 bg-white">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoggingIn}
                  required
                  className="h-full flex-1 px-4 text-base text-black outline-none disabled:cursor-not-allowed disabled:opacity-60"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  disabled={isLoggingIn}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="flex h-full w-14 items-center justify-center border-l border-gray-300 bg-gray-100 text-black transition hover:bg-black hover:text-white focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {showPassword ? (
                    <EyeOff size={22} strokeWidth={2} />
                  ) : (
                    <Eye size={22} strokeWidth={2} />
                  )}
                </button>
              </div>
            </div>

            {error ? (
              <p className="border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600">
                {error}
              </p>
            ) : null}

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-3 text-[17px] font-medium text-gray-500">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isLoggingIn}
                  className="size-5 rounded border-gray-300 accent-black"
                />
                Remember Me
              </label>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="min-w-[86px] rounded bg-[#e9caca] px-5 py-3 text-[16px] font-semibold text-black transition hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoggingIn ? "Signing..." : "Sign In"}
              </button>
            </div>

            <p className="pt-2 text-center text-[15px] text-gray-500">
              Don&apos;t have an account?{" "}
              <Link
                href="/auth/signup"
                className="font-semibold text-[#d8abab] transition hover:text-black"
              >
                Sign Up
              </Link>
            </p>
          </form>
        </div>

        <p className="mt-7 text-center text-[16px] text-white/60">
          © Copyright 2026. All Rights Reserved.
        </p>
      </section>
    </main>
  );
}

function LoginScreenFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-txt-primary">
      <p className="text-sm text-txt-secondary">Loading sign in...</p>
    </main>
  );
}
