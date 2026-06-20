import type { InputHTMLAttributes } from "react";

type InputState = "default" | "success" | "error";
const cn = (...classes: Array<string | false | undefined>) =>
  classes.filter(Boolean).join(" ");

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hint?: string;
  label: string;
  state?: InputState;
  stateMessage?: string;
}

export function Input({
  className,
  hint,
  id,
  label,
  state = "default",
  stateMessage,
  ...props
}: InputProps) {
  const inputId = id ?? props.name;
  const messageId = inputId ? `${inputId}-message` : undefined;

  return (
    <label className="grid gap-2" htmlFor={inputId}>
      <span className="text-sm font-semibold text-txt-primary">{label}</span>
      <input
        className={cn(
          "min-h-11 w-full rounded-sm border border-background-secondary px-3 py-2 text-txt-primary outline-none focus:border-primary",
          state === "error" && "border-error",
          state === "success" && "border-success",
          className,
        )}
        id={inputId}
        aria-invalid={state === "error" || undefined}
        aria-describedby={stateMessage || hint ? messageId : undefined}
        {...props}
      />
      {stateMessage ? (
        <p
          className={
            state === "error"
              ? "m-0 text-xs text-error"
              : "m-0 text-xs text-txt-secondary"
          }
          id={messageId}
        >
          {stateMessage}
        </p>
      ) : hint ? (
        <p className="m-0 text-xs text-txt-secondary" id={messageId}>
          {hint}
        </p>
      ) : null}
    </label>
  );
}
