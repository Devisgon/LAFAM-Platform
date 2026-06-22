type CreateActionBarProps = {
  actionHref: string;
  actionLabel: string;
  title: string;
};

export function CreateActionBar({
  actionHref,
  actionLabel,
  title,
}: CreateActionBarProps) {
  return (
    <header className="flex min-h-22 items-center justify-between gap-4 rounded-md bg-card-bg-primary px-5 shadow-lg shadow-slate-900/10 md:px-6">
      <h2 className="text-2xl font-medium text-txt-primary">{title}</h2>
      <a
        className="inline-flex min-h-12 items-center rounded-sm bg-button-primary px-5 text-base font-semibold text-txt-primary transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        href={actionHref}
      >
        {actionLabel}
      </a>
    </header>
  );
}
