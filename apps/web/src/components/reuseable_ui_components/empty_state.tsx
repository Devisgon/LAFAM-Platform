import type { ReactNode } from "react";

export function EmptyState({
  action,
  description,
  icon,
  title,
}: {
  action?: ReactNode;
  description: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <section className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-secondary/30 bg-card-bg-primary px-6 py-12 text-center">
      <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-primary/20 text-txt-primary">
        {icon}
      </span>
      <h2 className="mt-5 text-lg font-bold text-txt-primary">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-txt-secondary">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}
