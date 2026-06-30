"use client";

import type { InputHTMLAttributes, ReactNode } from "react";

import { inputClass } from "../../constants/staffUi.constants";

type FormInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function FormInput({ className, label, ...props }: FormInputProps) {
  return (
    <label className={`grid gap-1.5 text-xs font-bold ${className ?? ""}`}>
      {label}
      <input className={inputClass} {...props} />
    </label>
  );
}

export function ConfirmationOverlay({ children }: { children: ReactNode }) {
  return (
    <section
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-background p-4"
      role="dialog"
    >
      {children}
    </section>
  );
}
