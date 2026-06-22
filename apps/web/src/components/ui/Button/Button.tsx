import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";
const cn = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  fullWidth?: boolean;
  loading?: boolean;
  size?: Size;
  variant?: ButtonVariant;
}

const variants: Record<ButtonVariant, string> = {
  primary: "bg-button-primary text-txt-primary hover:opacity-90",
  secondary: "bg-button-secondary text-white hover:opacity-90",
  outline: "border-secondary text-txt-primary hover:bg-background-secondary",
  ghost: "text-txt-primary hover:bg-background-secondary",
  danger: "bg-error text-white hover:opacity-90",
};

export function Button({
  children,
  className,
  disabled,
  fullWidth = false,
  loading = false,
  size = "md",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-transparent px-4 py-2 font-semibold transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        size === "sm" && "min-h-8 px-3 py-1 text-sm",
        size === "lg" && "min-h-12 px-5 py-3 text-lg",
        fullWidth && "w-full",
        className,
      )}
      disabled={disabled || loading}
      type={type}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />}
      {children}
    </button>
  );
}
