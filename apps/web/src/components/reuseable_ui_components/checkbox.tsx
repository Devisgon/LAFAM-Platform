import type { InputHTMLAttributes } from "react";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  description?: string;
  label: string;
}

export function Checkbox({ description, label, ...props }: CheckboxProps) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-text-primary">
      <input className="mt-1 size-4 accent-primary" type="checkbox" {...props} />
      <span className="grid gap-0.5">
        <span className="text-sm font-semibold">{label}</span>
        {description && <span className="text-xs text-text-secondary">{description}</span>}
      </span>
    </label>
  );
}
