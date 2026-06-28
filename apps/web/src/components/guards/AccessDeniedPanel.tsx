import { LockKeyhole } from "lucide-react";

export function AccessDeniedPanel({
  description = "This screen is not available for your account permissions.",
  title = "Access locked",
}: {
  description?: string;
  title?: string;
}) {
  return (
    <section
      className="rounded-md border border-error/20 bg-card-bg-primary p-6 text-txt-primary shadow-sm"
      role="alert"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-sm bg-error/10 text-error">
          <LockKeyhole aria-hidden="true" size={21} strokeWidth={2.5} />
        </span>
        <div>
          <p className="text-xs font-bold uppercase text-error">Unauthorized</p>
          <h2 className="mt-1 text-2xl font-semibold">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-txt-secondary">
            {description}
          </p>
        </div>
      </div>
    </section>
  );
}
