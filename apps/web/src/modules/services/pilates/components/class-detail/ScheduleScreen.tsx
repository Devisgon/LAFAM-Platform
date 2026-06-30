"use client";

import type { ReactNode } from "react";

import { buttonClass } from "../../utils/pilatesDetailUtils";

export function ScheduleScreen({
  children,
  onClose,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <section className="overflow-hidden rounded-md border border-background-secondary bg-card-bg-primary text-txt-primary shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-background-secondary bg-card-bg-primary px-5 py-5">
        <div>
          <p className="text-xs font-bold uppercase text-txt-secondary">
            Scheduling
          </p>
          <h2 className="mt-1 text-2xl font-medium">{title}</h2>
        </div>
        <button className={buttonClass} onClick={onClose} type="button">
          Back to class
        </button>
      </header>
      {children}
    </section>
  );
}
