import type { ReactNode } from "react";

export function DetailItem({
  label: itemLabel,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-sm border border-background-secondary p-3">
      <dt className="text-xs font-bold uppercase text-txt-secondary">
        {itemLabel}
      </dt>
      <dd className="mt-1 break-words text-sm font-semibold">{value}</dd>
    </div>
  );
}

export function ActionCard({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="flex min-h-[330px] flex-col rounded-md border border-background-secondary bg-card-bg-secondary p-4">
      <h4 className="mb-4 font-semibold">{title}</h4>
      <div className="flex flex-1 flex-col">{children}</div>
    </section>
  );
}
