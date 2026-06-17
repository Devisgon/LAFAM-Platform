"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function UserPage() {
  const router = useRouter();
  const { isChecking, logout, user } = useAuth();

  const signOut = async () => {
    await logout();
    router.replace("/");
  };

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-txt-primary">
      <section className="mx-auto w-full max-w-4xl rounded-lg bg-card-bg-primary p-8 shadow-lg shadow-slate-900/10">
        <p className="text-sm font-bold uppercase tracking-wide text-primary">
          User Area
        </p>
        <h1 className="mt-3 text-3xl font-bold">
          {isChecking ? "Loading account..." : `Welcome, ${user?.full_name ?? "User"}`}
        </h1>
        <p className="mt-3 text-sm leading-6 text-txt-secondary">
          Your account is signed in with the{" "}
          <span className="font-semibold text-txt-primary">
            {user?.role ?? "user"}
          </span>{" "}
          role. Admin dashboard screens are restricted to admin and super admin
          accounts.
        </p>
        <button
          className="mt-6 inline-flex min-h-11 items-center rounded-sm bg-button-primary px-5 text-sm font-semibold text-white transition hover:opacity-90"
          onClick={() => void signOut()}
          type="button"
        >
          Sign out
        </button>
      </section>
    </main>
  );
}
