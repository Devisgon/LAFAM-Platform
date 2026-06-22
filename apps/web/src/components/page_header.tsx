import { House } from "lucide-react";
import Link from "next/link";

export function PageHeader({
  homeHref = "/admin",
  title,
}: {
  homeHref?: string;
  title: string;
}) {
  return (
    <header className="relative flex min-h-16 items-center justify-between gap-4 border-b-4 border-slate-300 bg-black px-5 py-3 text-white">
      <span
        aria-hidden="true"
        className="absolute -bottom-1 left-0 h-1 w-44 bg-foreground"
      />

      <h1 className="text-xl font-medium">{title}</h1>

      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-3 text-sm font-medium"
      >
        <Link
          aria-label="Home"
          className="transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
          href={homeHref}
        >
          <House aria-hidden="true" className="size-7" strokeWidth={2.5} />
        </Link>
        <span aria-hidden="true" className="text-foreground">
          /
        </span>
        <span>{title}</span>
      </nav>
    </header>
  );
}
