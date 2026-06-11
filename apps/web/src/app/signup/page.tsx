"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  User,
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
      // The shared auth error is rendered below the form.
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
      // The shared auth error is rendered below the form.
    }
  };

  const handleResend = async () => {
    clearError();
    setResendMessage(null);

    try {
      await resendVerificationOtp();
      setResendMessage("A new verification code was sent.");
    } catch {
      // The shared auth error is rendered below the form.
    }
  };

  return (
    <main className="relative flex min-h-screen w-full font-sans text-text-primary">
      <section
        aria-label="LAFAM introduction"
        className="relative hidden flex-col items-center justify-center border-r border-text-secondary/10 p-12 lg:flex lg:w-[70%]"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, color-mix(in srgb, var(--primary) 20%, transparent), color-mix(in srgb, var(--background-secondary) 60%, transparent)), url('/signup_screen_bg_image.png')",
          backgroundSize: "cover",
          backgroundPosition: "center right",
        }}
      >
        <div className="relative z-10 flex w-full max-w-lg flex-col items-center px-6 text-center text-white">
          <h1 className="font-serif text-5xl font-bold leading-tight tracking-tight drop-shadow-sm">
            Begin Your
            <br />
            Journey.
          </h1>
        </div>
      </section>

      <section className="relative z-10 ml-auto flex w-full flex-col justify-center px-6 py-12 sm:px-16 lg:w-[30%] lg:bg-background lg:px-8 xl:px-12">
        <div className="mx-auto w-full max-w-md rounded-3xl border border-text-secondary/5 bg-card-bg-primary/95 p-6 shadow-xl backdrop-blur-md sm:p-10 lg:rounded-none lg:border-none lg:p-0 lg:shadow-none lg:backdrop-blur-none">
          {pendingVerificationEmail ? (
            <>
              <div className="mb-7 text-center lg:text-left">
                <ShieldCheck className="mb-4 h-9 w-9 text-primary" />
                <h2 className="mb-2 text-3xl font-semibold tracking-tight">
                  Verify your email
                </h2>
                <p className="text-xs leading-relaxed text-text-secondary">
                  Enter the code sent to{" "}
                  <strong className="text-text-primary">
                    {pendingVerificationEmail}
                  </strong>
                  .
                </p>
              </div>

              <form onSubmit={handleVerify} className="space-y-4">
                <label
                  htmlFor="otp"
                  className="block text-xs font-semibold text-text-secondary"
                >
                  Verification code
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
                  className="w-full rounded-2xl border border-text-secondary/10 bg-background-primary px-4 py-3.5 text-center text-lg font-semibold tracking-[0.3em] outline-none transition-all focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                  disabled={isBusy}
                  required
                  autoFocus
                />

                {error ? <AuthError message={error} /> : null}
                {resendMessage ? (
                  <p className="rounded-xl border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">
                    {resendMessage}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={isBusy}
                  className="flex w-full items-center justify-center rounded-2xl bg-button-primary py-3.5 text-sm font-semibold text-white transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isVerifyingEmail ? "Verifying..." : "Verify Email"}
                </button>
              </form>

              <button
                type="button"
                onClick={handleResend}
                disabled={isBusy}
                className="mt-4 w-full text-center text-xs font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isResendingVerification ? "Sending..." : "Resend code"}
              </button>
            </>
          ) : (
            <>
              <div className="mb-6 text-center lg:text-left">
                <span className="mb-2 inline-block font-serif text-xl font-bold tracking-wider text-primary">
                  LAFAM
                </span>
                <h2 className="mb-1.5 text-3xl font-semibold tracking-tight">
                  Create an Account
                </h2>
                <p className="text-xs leading-relaxed text-text-secondary">
                  Please fill in your details to get started.
                </p>
              </div>

              <form onSubmit={handleSignUp} className="space-y-4">
                <AuthInput
                  id="name"
                  label="Full Name"
                  type="text"
                  value={name}
                  onChange={setName}
                  autoComplete="name"
                  placeholder="Sarah Sanctuary"
                  icon={<User className="h-4 w-4" />}
                  disabled={isBusy}
                />
                <AuthInput
                  id="email"
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  autoComplete="email"
                  placeholder="sarah@example.com"
                  icon={<Mail className="h-4 w-4" />}
                  disabled={isBusy}
                />
                <AuthInput
                  id="phone"
                  label="Phone Number"
                  type="tel"
                  value={phone}
                  onChange={setPhone}
                  autoComplete="tel"
                  placeholder="+96550000000"
                  icon={<Phone className="h-4 w-4" />}
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
                    className="mt-0.5 h-4 w-4 accent-primary"
                    disabled={isBusy}
                    required
                  />
                  <label
                    htmlFor="terms"
                    className="select-none text-xs leading-normal text-text-secondary"
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
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-button-primary py-3.5 text-sm font-semibold text-white shadow-md shadow-primary/10 transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSigningUp ? "Creating Account..." : "Create Account"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              <p className="mt-8 text-center text-sm text-text-secondary">
                Already have an account?{" "}
                <Link
                  href="/"
                  className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                >
                  Sign In <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </p>
            </>
          )}
        </div>
      </section>
    </main>
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
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-semibold text-text-secondary">
        {label}
      </label>
      <div className="relative flex items-center">
        <span className="absolute left-4 text-text-secondary/60">{icon}</span>
        <input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full rounded-2xl border border-text-secondary/10 bg-background-primary py-3.5 pl-12 pr-4 text-sm outline-none transition-all placeholder:text-text-secondary/40 focus:border-primary/40 focus:bg-card-bg-primary focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
          required
        />
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
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-semibold text-text-secondary">
        {label}
      </label>
      <div className="relative flex items-center">
        <Lock className="absolute left-4 h-4 w-4 text-text-secondary/60" />
        <input
          id={id}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          minLength={8}
          maxLength={128}
          disabled={disabled}
          className="w-full rounded-2xl border border-text-secondary/10 bg-background-primary py-3.5 pl-12 pr-12 text-sm outline-none transition-all focus:border-primary/40 focus:bg-card-bg-primary focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
          required
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-4 text-text-secondary/60 transition-colors hover:text-text-primary"
          disabled={disabled}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
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
      className="rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error"
    >
      {message}
    </p>
  );
}
