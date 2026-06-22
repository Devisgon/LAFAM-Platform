import type { HTMLAttributes, ReactNode } from "react";

type CardVariant = "primary" | "secondary" | "outlined";
const cn = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

export interface CardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  description?: string;
  footer?: ReactNode;
  interactive?: boolean;
  title?: string;
  variant?: CardVariant;
}

export function Card({
  children,
  className,
  description,
  footer,
  interactive = false,
  title,
  variant = "primary",
  ...props
}: CardProps) {
  return (
    <article
      className={cn(
        "rounded-xl border border-background-secondary bg-card-bg-primary p-5 text-txt-primary shadow-sm",
        variant === "secondary" && "bg-card-bg-secondary",
        variant === "outlined" && "bg-transparent shadow-none",
        interactive && "transition-transform hover:-translate-y-0.5",
        className,
      )}
      {...props}
    >
      {title && <h3 className="m-0 text-lg font-bold">{title}</h3>}
      {description && <p className="mt-2 text-txt-secondary">{description}</p>}
      <div className={title || description ? "mt-4" : undefined}>{children}</div>
      {footer && <footer className="mt-5 flex items-center gap-3">{footer}</footer>}
    </article>
  );
}
