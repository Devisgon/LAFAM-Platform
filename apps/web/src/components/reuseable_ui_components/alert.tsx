import type { HTMLAttributes, ReactNode } from "react";

type Tone = "neutral" | "info" | "success" | "warning" | "error";
const cn = (...classes: Array<string | undefined>) => classes.filter(Boolean).join(" ");
export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  title?: string;
  tone?: Tone;
}

export function Alert({ children, className, title, tone = "info", ...props }: AlertProps) {
  const tones: Record<Tone, string> = {
    neutral: "border-secondary text-text-secondary",
    info: "border-primary text-primary",
    success: "border-success text-success",
    warning: "border-warning text-text-primary",
    error: "border-error text-error",
  };

  return (
    <div
      className={cn("grid gap-1 rounded-lg border p-4", tones[tone], className)}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      {...props}
    >
      {title && <strong>{title}</strong>}
      <p className="m-0">{children}</p>
    </div>
  );
}
