"use client";

import React, { Suspense, type FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { resolvePostLoginRedirect } from "@/lib/auth";

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

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
    } catch {}
  };

  return (
    <div className="flex min-h-screen w-full bg-background font-sans antialiased text-text-primary transition-colors duration-300">
      <div
        className="relative hidden w-2/2 flex-col items-center justify-center border-r border-text-secondary/10 p-8 lg:flex"
        style={{
          backgroundImage: `linear-gradient(to bottom, color-mix(in srgb, var(--primary) 30%, transparent), color-mix(in srgb, var(--background-secondary) 80%, transparent)), url('/login_screen_side_image.png')`,
          backgroundSize: "contain",
          backgroundPosition: "center",
        }}
      >
        <div className="relative z-10 flex w-full max-w-md flex-col items-center justify-center rounded-3xl border border-text-secondary/10 bg-card-bg-primary/80 p-12 text-center shadow-xl backdrop-blur-md">
          <div className="mb-5 flex size-24 items-center justify-center rounded-3xl bg-primary shadow-lg shadow-primary/20">
            <Image
              alt="LAFAM"
              className="size-20 object-contain"
              height={80}
              priority
              src="/logo.png"
              width={80}
            />
          </div>
          <h1 className="mb-3 font-serif text-4xl font-bold tracking-[0.18em] text-primary">
            LAFAM
          </h1>

          <p className="text-lg font-medium italic text-text-secondary">
            Elevate your practice. Nourish your soul.
          </p>
        </div>
      </div>

      <div className="flex w-full flex-col justify-center bg-background px-6 py-12 sm:px-16 lg:w-1/2 lg:px-24 xl:px-32">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-10">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary">
                <Image alt="" className="size-9 object-contain" height={36} priority src="/logo.png" width={36} />
              </span>
              <strong className="tracking-[0.16em] text-primary">LAFAM</strong>
            </div>
            <h2 className="mb-3 text-4xl font-semibold tracking-tight text-text-primary">
              Welcome Back
            </h2>

            <p className="text-sm leading-relaxed text-text-secondary">
              Sign in to book sessions, manage your wellness wallet, and access
              your profile.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {emailVerified ? (
              <p className="rounded-xl border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">
                Email verified. You can sign in now.
              </p>
            ) : null}
            {passwordReset ? (
              <p className="rounded-xl border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">
                Password updated. Sign in with your new password.
              </p>
            ) : null}
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
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border border-text-secondary/10 bg-background-primary py-4 pl-12 pr-4 text-sm text-text-primary outline-none transition-all placeholder:text-text-secondary/50 focus:border-primary/40 focus:bg-card-bg-primary focus:ring-4 focus:ring-primary/10"
                  placeholder="name@example.com"
                  disabled={isLoggingIn}
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-xs font-semibold text-text-secondary"
                >
                  Password
                </label>

                <Link
                  href="/auth/forgot-password"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Forgot Password?
                </Link>
              </div>

              <div className="relative flex items-center">
                <Lock className="absolute left-4 h-5 w-5 text-text-secondary/60" />

                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-text-secondary/10 bg-background-primary py-4 pl-12 pr-12 text-sm text-text-primary outline-none transition-all placeholder:text-text-secondary/50 focus:border-primary/40 focus:bg-card-bg-primary focus:ring-4 focus:ring-primary/10"
                  placeholder="••••••••"
                  disabled={isLoggingIn}
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-4 text-text-secondary/60 transition-colors hover:text-text-primary"
                  disabled={isLoggingIn}
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

            {error ? (
              <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-button-primary py-4 text-sm font-semibold text-white shadow-md shadow-primary/10 transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoggingIn ? "Signing In..." : "Sign In"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <p className="mt-10 text-center text-sm text-text-secondary">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-semibold text-primary hover:underline"
            >
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function LoginScreenFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-text-primary">
      <p className="text-sm text-text-secondary">Loading sign in...</p>
    </main>
  );
}
