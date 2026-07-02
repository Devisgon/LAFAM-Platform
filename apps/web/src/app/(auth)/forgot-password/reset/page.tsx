"use client";

import Image from "next/image";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useAuth } from "@/modules/auth";

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
    <main className="flex h-screen w-full items-center justify-center bg-auth-surface px-4 py-10 font-sans text-black">
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

        <div className="w-full max-w-[500px] overflow-hidden rounded-md bg-white shadow-2xl">
          <div className="flex h-20 items-center justify-center gap-3 bg-primary text-black">
            <LockKeyhole size={30} strokeWidth={2.5} />

            <h1 className="text-xl font-bold uppercase tracking-wide">
              Set New Password
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 px-10 py-12">
            <p className="text-center text-[15px] font-medium leading-relaxed text-gray-500">
              {passwordResetEmail ? (
                <>
                  Create a new password for{" "}
                  <strong className="text-black">{passwordResetEmail}</strong>.
                </>
              ) : (
                "Verify your password reset code before setting a new password."
              )}
            </p>

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
              <ResetPasswordError message={formError ?? error ?? ""} />
            ) : null}

            <button
              type="submit"
              disabled={isResettingPassword}
              className="w-full rounded bg-primary px-5 py-3.5 text-[16px] font-semibold text-txt-primary transition hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isResettingPassword ? "Updating Password..." : "Update Password"}
            </button>

            <p className="pt-2 text-center text-[15px] text-gray-500">
              Back to{" "}
              <Link
                href="/"
                className="font-semibold text-auth-link transition hover:text-black"
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
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-[16px] font-medium text-gray-500"
      >
        {label}
      </label>

      <div className="flex h-[48px] overflow-hidden rounded border border-gray-300 bg-white">
        <input
          id={id}
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          required
          className="h-full flex-1 px-4 text-base text-black outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />

        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          disabled={disabled}
          aria-label={showPassword ? "Hide password" : "Show password"}
          className="flex h-full w-14 items-center justify-center border-l border-gray-300 bg-gray-100 text-black transition hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {showPassword ? (
            <EyeOff size={22} strokeWidth={2} />
          ) : (
            <Eye size={22} strokeWidth={2} />
          )}
        </button>
      </div>
    </div>
  );
}

function ResetPasswordError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600"
    >
      {message}
    </p>
  );
}
