import type { InputHTMLAttributes } from "react";

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  description?: string;
  label: string;
}

export function Switch({ description, label, ...props }: SwitchProps) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-text-primary">
      <input className="mt-1 size-4 accent-primary" role="switch" type="checkbox" {...props} />
      <span className="grid gap-0.5">
        <span className="text-sm font-semibold">{label}</span>
        {description && <span className="text-xs text-text-secondary">{description}</span>}
      </span>
    </label>
  );
}
