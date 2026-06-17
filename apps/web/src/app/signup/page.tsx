"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "Asia/Kuwait";
  }
}

function normalizePhone(phone: string): string | undefined {
  const normalized = phone.replace(/[^\d+]/g, "");
  return normalized || undefined;
}

export default function RegisterScreen() {
  const router = useRouter();

  const {
    pendingVerificationEmail,
    isSigningUp,
    isVerifyingEmail,
    isResendingVerification,
    error,
    signUp,
    verifyEmail,
    resendVerificationOtp,
    clearError,
  } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const isBusy = isSigningUp || isVerifyingEmail || isResendingVerification;

  const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();
    setFormError(null);
    setResendMessage(null);

    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    try {
      await signUp({
        email,
        phone: normalizePhone(phone),
        full_name: name,
        password,
        confirm_password: confirmPassword,
        timezone: getBrowserTimezone(),
      });
    } catch {
      // useAuth handles the error state
    }
  };

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();
    setResendMessage(null);

    try {
      await verifyEmail(otp);
      router.replace("/?verified=1");
    } catch {
      // useAuth handles the error state
    }
  };

  const handleResend = async () => {
    clearError();
    setResendMessage(null);

    try {
      await resendVerificationOtp();
      setResendMessage("A new verification code was sent.");
    } catch {
      // useAuth handles the error state
    }
  };

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4 py-10 font-sans text-black">
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center"
        style={{
          backgroundImage: "url('/login_bg.jpg')",
        }}
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
          {pendingVerificationEmail ? (
            <VerificationForm
              email={pendingVerificationEmail}
              otp={otp}
              setOtp={setOtp}
              error={error}
              resendMessage={resendMessage}
              isBusy={isBusy}
              isVerifyingEmail={isVerifyingEmail}
              isResendingVerification={isResendingVerification}
              onVerify={handleVerify}
              onResend={handleResend}
            />
          ) : (
            <>
              <div className="flex h-15 items-center justify-center gap-3 bg-[#e9caca] text-black">
                <UserRound size={30} strokeWidth={2.5} />
                <h1 className="text-xl font-bold uppercase tracking-wide">
                  Create Account
                </h1>
              </div>

              <form onSubmit={handleSignUp} className="space-y-4 px-10 py-4">
                <AuthInput
                  id="name"
                  label="Full Name"
                  type="text"
                  value={name}
                  onChange={setName}
                  autoComplete="name"
                  placeholder=""
                  icon={<UserRound size={22} strokeWidth={2} />}
                  disabled={isBusy}
                />

                <AuthInput
                  id="email"
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  autoComplete="email"
                  placeholder=""
                  icon={<Mail size={22} strokeWidth={2} />}
                  disabled={isBusy}
                />

                <AuthInput
                  id="phone"
                  label="Phone Number"
                  type="tel"
                  value={phone}
                  onChange={setPhone}
                  autoComplete="tel"
                  placeholder=""
                  icon={<Phone size={22} strokeWidth={2} />}
                  disabled={isBusy}
                />

                <PasswordInput
                  id="password"
                  label="Password"
                  value={password}
                  onChange={setPassword}
                  autoComplete="new-password"
                  showPassword={showPassword}
                  setShowPassword={setShowPassword}
                  disabled={isBusy}
                />

                <PasswordInput
                  id="confirmPassword"
                  label="Confirm Password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  autoComplete="new-password"
                  showPassword={showPassword}
                  setShowPassword={setShowPassword}
                  disabled={isBusy}
                />

                <div className="flex items-start gap-3 pt-1">
                  <input
                    id="terms"
                    type="checkbox"
                    checked={agreeToTerms}
                    onChange={(event) => setAgreeToTerms(event.target.checked)}
                    className="mt-1 size-5 rounded border-gray-300 accent-black"
                    disabled={isBusy}
                    required
                  />

                  <label
                    htmlFor="terms"
                    className="select-none text-[15px] font-medium leading-normal text-gray-500"
                  >
                    I agree to the Terms of Service and Privacy Policy.
                  </label>
                </div>

                {formError || error ? (
                  <AuthError message={formError ?? error ?? ""} />
                ) : null}

                <button
                  type="submit"
                  disabled={isBusy}
                  className="flex w-full items-center justify-center gap-2 rounded bg-[#e9caca] px-5 py-3.5 text-[16px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSigningUp ? "Creating Account..." : "Create Account"}
                  <ArrowRight size={18} />
                </button>

                <p className="pt-2 text-center text-[15px] text-gray-500">
                  Already have an account?{" "}
                  <Link
                    href="/"
                    className="font-semibold text-[#e9caca] transition hover:text-black"
                  >
                    Sign In
                  </Link>
                </p>
              </form>
            </>
          )}
        </div>

        <p className="mt-7 text-center text-[16px] text-white/60">
          © Copyright 2026. All Rights Reserved.
        </p>
      </section>
    </main>
  );
}

function VerificationForm({
  email,
  otp,
  setOtp,
  error,
  resendMessage,
  isBusy,
  isVerifyingEmail,
  isResendingVerification,
  onVerify,
  onResend,
}: {
  email: string;
  otp: string;
  setOtp: (value: string) => void;
  error: string | null;
  resendMessage: string | null;
  isBusy: boolean;
  isVerifyingEmail: boolean;
  isResendingVerification: boolean;
  onVerify: (event: FormEvent<HTMLFormElement>) => void;
  onResend: () => void;
}) {
  return (
    <>
      <div className="flex h-16 items-center justify-center gap-3 bg-[#e9caca] text-black">
        <ShieldCheck size={30} strokeWidth={2.5} />
        <h1 className="text-xl font-bold uppercase tracking-wide">
          Verify Email
        </h1>
      </div>

      <form onSubmit={onVerify} className="space-y-5 px-10 py-6">
        <p className="text-center text-[15px] font-medium leading-relaxed text-gray-500">
          Enter the verification code sent to{" "}
          <strong className="text-black">{email}</strong>.
        </p>

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
            autoFocus
            className="h-[48px] w-full rounded border border-gray-300 bg-white px-4 text-center text-lg font-semibold tracking-[0.35em] text-black outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        {error ? <AuthError message={error} /> : null}

        {resendMessage ? (
          <p className="border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm font-medium text-green-700">
            {resendMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isBusy}
          className="w-full rounded bg-[#e9caca] px-5 py-3.5 text-[16px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isVerifyingEmail ? "Verifying..." : "Verify Email"}
        </button>

        <button
          type="button"
          onClick={onResend}
          disabled={isBusy}
          className="w-full text-center text-[15px] font-semibold text-[#e9caca] transition hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isResendingVerification ? "Sending..." : "Resend Code"}
        </button>
      </form>
    </>
  );
}

type AuthInputProps = {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  placeholder: string;
  icon: ReactNode;
  disabled: boolean;
};

function AuthInput({
  id,
  label,
  type,
  value,
  onChange,
  autoComplete,
  placeholder,
  icon,
  disabled,
}: AuthInputProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-[16px] font-medium text-gray-500"
      >
        {label}
      </label>

      <div className="flex h-[54px] overflow-hidden rounded border border-gray-300 bg-white">
        <input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          disabled={disabled}
          required
          className="h-full flex-1 px-4 text-base text-black outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />

        <span className="flex h-full w-14 items-center justify-center border-l border-gray-300 bg-gray-100 text-black">
          {icon}
        </span>
      </div>
    </div>
  );
}

type PasswordInputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  disabled: boolean;
};

function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
  showPassword,
  setShowPassword,
  disabled,
}: PasswordInputProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-[16px] font-medium text-gray-500"
      >
        {label}
      </label>

      <div className="flex h-[54px] overflow-hidden rounded border border-gray-300 bg-white">
        <input
          id={id}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          minLength={8}
          maxLength={128}
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
            <LockKeyhole size={22} strokeWidth={2} />
          )}
        </button>
      </div>
    </div>
  );
}

function AuthError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600"
    >
      {message}
    </p>
  );
}