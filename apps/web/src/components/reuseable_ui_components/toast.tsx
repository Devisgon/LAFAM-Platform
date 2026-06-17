import type { HTMLAttributes, ReactNode } from "react";

type Tone = "neutral" | "info" | "success" | "warning" | "error";
const cn = (...classes: Array<string | undefined>) => classes.filter(Boolean).join(" ");
export interface ToastProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  onDismiss?: () => void;
  title: string;
  tone?: Tone;
}

export function Toast({ children, className, onDismiss, title, tone = "info", ...props }: ToastProps) {
  const tones: Record<Tone, string> = {
    neutral: "border-secondary text-txt-secondary",
    info: "border-primary text-primary",
    success: "border-success text-success",
    warning: "border-warning text-txt-primary",
    error: "border-error text-error",
  };

  return (
    <div
      className={cn("flex max-w-sm gap-3 rounded-lg border-l-4 bg-card-bg-primary p-4 shadow-lg", tones[tone], className)}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      {...props}
    >
      <div className="flex-1">
        <strong>{title}</strong>
        <p className="m-0">{children}</p>
      </div>
      {onDismiss && (
        <button
          aria-label="Dismiss notification"
          className="flex size-6 shrink-0 items-center justify-center rounded text-txt-secondary hover:bg-background-secondary hover:text-txt-primary"
          onClick={onDismiss}
          type="button"
        >
          X
        </button>
      )}
    </div>
  );
}
