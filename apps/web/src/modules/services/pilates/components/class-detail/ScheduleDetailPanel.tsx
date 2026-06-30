"use client";

import { Badge } from "@/components/ui/Badge";

import type { PilatesSchedule } from "../../api/pilatesApi";
import { buttonClass, formatDate, formatTime, label, scheduleTone } from "../../utils/pilatesDetailUtils";
import { DetailLine } from "./PilatesDetailControls";

export function ScheduleDetailPanel({
  item,
  onCancel,
  onComplete,
  onClose,
  onDelete,
  onEdit,
}: {
  item: PilatesSchedule;
  onCancel: () => void;
  onComplete: () => void;
  onClose: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const active = item.status === "scheduled";
  return (
    <aside className="self-start rounded-md border border-background-secondary bg-card-bg-secondary p-5 shadow-sm">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={scheduleTone(item.status)}>{label(item.status)}</Badge>
          <span className="text-xs font-semibold text-txt-secondary">
            {item.studio}
          </span>
        </div>
        <button
          aria-label="Close schedule details"
          className="flex size-8 items-center justify-center rounded-sm bg-card-bg-primary text-txt-secondary transition hover:bg-background-secondary hover:text-txt-primary"
          onClick={onClose}
          type="button"
        >
          X
        </button>
      </header>
      <h3 className="mt-4 text-xl font-bold text-txt-primary">
        {formatDate(item.class_date)}
      </h3>
      <p className="mt-1 text-sm text-txt-secondary">
        Trainer:{" "}
        <strong className="text-txt-primary">
          {item.trainer?.display_name ?? "Assigned trainer"}
        </strong>
      </p>
      <dl className="mt-5 grid gap-3 text-sm">
        <DetailLine
          label="Time"
          value={`${formatTime(item.start_time)} - ${formatTime(item.end_time)}`}
        />
        <DetailLine label="Duration" value={`${item.duration_minutes} min`} />
        <DetailLine
          label="Booked"
          value={`${item.availability.booked_count}/${item.capacity}`}
        />
        <DetailLine
          label="Seats left"
          value={String(item.availability.available_seats)}
        />
        <DetailLine
          label="Price"
          value={`${(item.price_amount ?? 0).toFixed(3)} ${item.currency ?? "KWD"}`}
        />
      </dl>
      {item.cancellation_reason ? (
        <p className="mt-4 text-xs text-error">{item.cancellation_reason}</p>
      ) : null}
      <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        <button className={buttonClass} onClick={onEdit} type="button">
          Reschedule
        </button>
        <button
          className={buttonClass}
          disabled={!active}
          onClick={onComplete}
          type="button"
        >
          Complete
        </button>
        <button
          className={`${buttonClass} text-error`}
          disabled={!active}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        <button
          className={`${buttonClass} text-error`}
          onClick={onDelete}
          type="button"
        >
          Delete
        </button>
      </div>
    </aside>
  );
}
