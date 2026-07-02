import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-txt-primary">
      <section className="w-full max-w-lg rounded-lg bg-card-bg-primary p-8 text-center shadow-lg shadow-slate-900/10">
        <p className="text-sm font-bold uppercase tracking-wide text-error">
          Unauthorized
        </p>
        <h1 className="mt-3 text-3xl font-bold">Page not available</h1>
        <p className="mt-3 text-sm leading-6 text-txt-secondary">
          This screen is not available for your account role. Use the dashboard
          assigned to your account.
        </p>
        <Link
          className="mt-6 inline-flex min-h-11 items-center rounded-sm border border-background-secondary bg-button-primary px-5 text-sm font-semibold text-txt-primary transition hover:opacity-90"
          href="/"
        >
          Go to sign in
        </Link>
      </section>
    </main>
  );
}
