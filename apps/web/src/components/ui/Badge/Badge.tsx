import type { HTMLAttributes, ReactNode } from "react";

type Tone = "neutral" | "info" | "success" | "warning" | "error";
const cn = (...classes: Array<string | undefined>) => classes.filter(Boolean).join(" ");
export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  tone?: Tone;
}

export function Badge({ children, className, tone = "neutral", ...props }: BadgeProps) {
  const tones: Record<Tone, string> = {
    neutral: "bg-background-secondary text-txt-secondary",
    info: "bg-primary/15 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-txt-primary",
    error: "bg-error/15 text-error",
  };

  return <span className={cn("inline-flex rounded-full px-2 py-1 text-xs font-bold", tones[tone], className)} {...props}>{children}</span>;
}
