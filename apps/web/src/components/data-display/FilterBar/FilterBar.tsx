import type { HTMLAttributes, ReactNode } from "react";

const cn = (...classes: Array<string | undefined>) => classes.filter(Boolean).join(" ");
export interface FilterbarProps extends HTMLAttributes<HTMLElement> {
  actions?: ReactNode;
  children: ReactNode;
  label?: string;
}

export function Filterbar({ actions, children, className, label = "Filters", ...props }: FilterbarProps) {
  return (
    <section className={cn("flex flex-wrap items-end gap-3 rounded-xl border border-background-secondary bg-card-bg-secondary p-4", className)} aria-label={label} {...props}>
      <div className="min-w-64 flex-1">{children}</div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </section>
  );
}
