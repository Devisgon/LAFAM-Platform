import type { HTMLAttributes, ReactNode } from "react";
import { Button } from "./button";

type ConfirmationTone = "default" | "danger";
const cn = (...classes: Array<string | undefined>) => classes.filter(Boolean).join(" ");

export interface ConfirmationCardProps extends HTMLAttributes<HTMLElement> {
  cancelLabel?: string;
  confirmLabel?: string;
  description: string;
  icon?: ReactNode;
  title: string;
  tone?: ConfirmationTone;
}

export function ConfirmationCard({
  cancelLabel = "Cancel",
  className,
  confirmLabel = "Confirm",
  description,
  icon = "?",
  title,
  tone = "default",
  ...props
}: ConfirmationCardProps) {
  return (
    <article className={cn("max-w-lg rounded-xl border border-background-secondary bg-card-bg-primary p-5 text-center text-text-primary shadow-sm", className)} {...props}>
      <span className="mb-3 inline-flex size-12 items-center justify-center rounded-full bg-background-secondary text-xl text-primary" aria-hidden="true">{icon}</span>
      <h3 className="m-0 text-lg font-bold">{title}</h3>
      <p className="mt-2 text-text-secondary">{description}</p>
      <div className="mt-5 flex justify-center gap-3">
        <Button variant="outline">{cancelLabel}</Button>
        <Button variant={tone === "danger" ? "danger" : "primary"}>{confirmLabel}</Button>
      </div>
    </article>
  );
}
