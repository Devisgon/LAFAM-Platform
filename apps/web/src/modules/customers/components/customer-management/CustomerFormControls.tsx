"use client";

import type { InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

import { fieldClass } from "../../constants/customerUi.constants";

export function PasswordInput({
  className,
  label: inputLabel,
  onToggle,
  showPassword,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  onToggle: () => void;
  showPassword: boolean;
}) {
  const Icon = showPassword ? EyeOff : Eye;

  return (
    <label className={`grid gap-1.5 text-xs font-bold ${className ?? ""}`}>
      {inputLabel}
      <span className="relative">
        <input
          className={`${fieldClass} pr-12`}
          type={showPassword ? "text" : "password"}
          {...props}
        />
        <button
          aria-label={showPassword ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-sm text-txt-secondary transition hover:bg-background-secondary hover:text-txt-primary"
          onClick={onToggle}
          type="button"
        >
          <Icon aria-hidden="true" size={18} />
        </button>
      </span>
    </label>
  );
}

export function FormInput({
  className,
  label: inputLabel,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={`grid gap-1.5 text-xs font-bold ${className ?? ""}`}>
      {inputLabel}
      <input className={fieldClass} {...props} />
    </label>
  );
}
