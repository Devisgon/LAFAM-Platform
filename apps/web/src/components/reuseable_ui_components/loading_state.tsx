import type { HTMLAttributes } from "react";

const cn = (...classes: Array<string | undefined>) => classes.filter(Boolean).join(" ");
export interface LoadingStateProps extends HTMLAttributes<HTMLDivElement> {
  label?: string;
  lines?: number;
  variant?: "spinner" | "skeleton";
}

export function LoadingState({
  className,
  label = "Loading",
  lines = 3,
  variant = "spinner",
  ...props
}: LoadingStateProps) {
  if (variant === "skeleton") {
    return (
      <div className={cn("grid gap-3", className)} aria-busy="true" aria-label={label} {...props}>
        {Array.from({ length: lines }, (_, index) => <span className="h-4 w-full animate-pulse rounded bg-background-secondary" key={index} />)}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3 text-text-secondary", className)} aria-busy="true" role="status" {...props}>
      <span className="size-5 animate-spin rounded-full border-2 border-background-secondary border-t-primary" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
