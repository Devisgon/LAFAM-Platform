import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, KeyRound } from "lucide-react";

type PasswordResetShellProps = {
  title: string;
  description: ReactNode;
  children: ReactNode;
};

export function PasswordResetShell({
  title,
  description,
  children,
}: PasswordResetShellProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12 text-text-primary">
      <section className="w-full max-w-md rounded-3xl border border-text-secondary/10 bg-card-bg-primary p-7 shadow-xl sm:p-10">
        <KeyRound className="mb-5 h-9 w-9 text-primary" aria-hidden="true" />
        <h1 className="mb-2 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mb-7 text-sm leading-relaxed text-text-secondary">
          {description}
        </p>

        {children}

        <Link
          href="/"
          className="mt-7 flex items-center justify-center gap-2 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
      </section>
    </main>
  );
}

export function PasswordResetError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error"
    >
      {message}
    </p>
  );
}
