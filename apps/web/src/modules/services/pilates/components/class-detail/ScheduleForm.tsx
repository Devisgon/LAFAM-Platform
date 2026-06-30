"use client";

import { type FormEvent, useMemo, useState } from "react";
import type { StaffMember } from "@/modules/staff";

import type { PilatesClassDefinition, PilatesSchedule } from "../../api/pilatesApi";
import type { MonthlySchedulePlan, TimeSlotOption } from "../../utils/pilatesDetailUtils";
import { dayFromDate, dayOccursInInterval, defaultMonth, fieldClass, label, monthDateRange, scheduleWeekDays, trainerDaySlots, trainerSlots } from "../../utils/pilatesDetailUtils";
import { FormInput, ModalFooter } from "./PilatesDetailControls";

export function ScheduleForm({
  detail,
  isSaving,
  item,
  onClose,
  onSubmit,
  trainers,
}: {
  detail: PilatesClassDefinition;
  isSaving: boolean;
  item?: PilatesSchedule;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  trainers: StaffMember[];
}) {
  const isEditing = Boolean(item);
  const [selectedTrainerId, setSelectedTrainerId] = useState(
    item?.trainer_staff_profile_id ?? "",
  );
  const [startTime, setStartTime] = useState(
    item?.start_time?.slice(0, 5) ?? "10:00",
  );
  const [classDate, setClassDate] = useState(item?.class_date ?? "");
  const defaultScheduleRange = useMemo(
    () => monthDateRange(item?.class_date?.slice(0, 7) ?? defaultMonth()),
    [item?.class_date],
  );
  const [scheduleStartDate, setScheduleStartDate] = useState(
    defaultScheduleRange.fromDate,
  );
  const [scheduleEndDate, setScheduleEndDate] = useState(
    defaultScheduleRange.toDate,
  );
  const [selectedScheduleDay, setSelectedScheduleDay] = useState(1);
  const [monthlyPlan, setMonthlyPlan] = useState<MonthlySchedulePlan>({});
  const [durationMinutes, setDurationMinutes] = useState(
    item?.duration_minutes ?? detail.default_duration_minutes,
  );
  const [capacity, setCapacity] = useState(
    item?.capacity ?? detail.default_capacity,
  );
  const [priceAmount, setPriceAmount] = useState(
    item?.price_amount ?? detail.default_price_amount,
  );
  const selectedTrainer = useMemo(
    () => trainers.find((trainer) => trainer.id === selectedTrainerId),
    [selectedTrainerId, trainers],
  );
  const singleSlots = useMemo(
    () =>
      trainerSlots(selectedTrainer, dayFromDate(classDate), durationMinutes),
    [classDate, durationMinutes, selectedTrainer],
  );
  const singleSlotsWithCurrent = useMemo(() => {
    if (
      !isEditing ||
      !startTime ||
      singleSlots.some((option) => option.startTime === startTime)
    ) {
      return singleSlots;
    }

    const endTime = item?.end_time?.slice(0, 5) ?? "";

    return [
      {
        endTime,
        label: endTime
          ? `${startTime} - ${endTime} (current)`
          : `${startTime} (current)`,
        startTime,
      },
      ...singleSlots,
    ];
  }, [isEditing, item?.end_time, singleSlots, startTime]);

  const validMonthlyPlan = useMemo(() => {
    if (isEditing) return monthlyPlan;

    if (!selectedTrainer || durationMinutes < 15 || durationMinutes > 240) {
      return {};
    }

    const next: MonthlySchedulePlan = {};

    Object.entries(monthlyPlan).forEach(([day, selectedSlots]) => {
      const dayNumber = Number(day);

      if (!dayOccursInInterval(dayNumber, scheduleStartDate, scheduleEndDate)) {
        return;
      }

      const availableStarts = new Set(
        trainerDaySlots(selectedTrainer, dayNumber, durationMinutes)
          .filter((slot) => slot.available)
          .map((slot) => slot.startTime),
      );
      const validSlots = selectedSlots.filter((slot) =>
        availableStarts.has(slot),
      );

      if (validSlots.length > 0) {
        next[day] = validSlots;
      }
    });

    return next;
  }, [
    durationMinutes,
    isEditing,
    monthlyPlan,
    scheduleEndDate,
    scheduleStartDate,
    selectedTrainer,
  ]);

  const toggleMonthlySlot = (
    dayOfWeek: number,
    slotStartTime: string,
    available: boolean,
  ) => {
    if (!available) return;
    if (!dayOccursInInterval(dayOfWeek, scheduleStartDate, scheduleEndDate)) {
      return;
    }

    setMonthlyPlan((current) => {
      const key = String(dayOfWeek);
      const selectedSlots = new Set(current[key] ?? []);

      if (selectedSlots.has(slotStartTime)) {
        selectedSlots.delete(slotStartTime);
      } else {
        selectedSlots.add(slotStartTime);
      }

      const next = { ...current };
      const sortedSlots = Array.from(selectedSlots).sort();

      if (sortedSlots.length > 0) {
        next[key] = sortedSlots;
      } else {
        delete next[key];
      }

      return next;
    });
  };

  const copyMonthlySlots = (targetDay: number, sourceDay: number) => {
    if (!selectedTrainer) return;
    if (!dayOccursInInterval(targetDay, scheduleStartDate, scheduleEndDate)) {
      return;
    }

    setMonthlyPlan((current) => {
      const sourceSlots = current[String(sourceDay)] ?? [];
      const availableStarts = new Set(
        trainerDaySlots(selectedTrainer, targetDay, durationMinutes)
          .filter((slot) => slot.available)
          .map((slot) => slot.startTime),
      );
      const copiedSlots = sourceSlots
        .filter((slot) => availableStarts.has(slot))
        .sort();
      const next = { ...current };

      if (copiedSlots.length > 0) {
        next[String(targetDay)] = copiedSlots;
      } else {
        delete next[String(targetDay)];
      }

      return next;
    });
  };

  return (
    <form onSubmit={onSubmit}>
      <input
        name="mode"
        type="hidden"
        value={isEditing ? "single" : "monthly"}
      />
      {!isEditing ? (
        <input
          name="monthly_schedule_plan"
          type="hidden"
          value={JSON.stringify(validMonthlyPlan)}
        />
      ) : null}
      <div className="px-5 py-5">
        <div className="rounded-sm bg-primary/10 p-3 text-sm text-primary">
          {isEditing ? "Update this occurrence for" : "Create schedules for"}{" "}
          <strong>{detail.title}</strong>.
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-bold md:col-span-2">
            Trainer
            <select
              className={fieldClass}
              disabled={isSaving}
              name="trainer_staff_profile_id"
              onChange={(event) => setSelectedTrainerId(event.target.value)}
              required
              value={selectedTrainerId}
            >
              <option value="">Select a trainer</option>
              {trainers.map((trainer) => (
                <option key={trainer.id} value={trainer.id}>
                  {trainer.display_name} ({label(trainer.staff_status)})
                </option>
              ))}
            </select>
          </label>
          <FormInput
            defaultValue={item?.studio ?? "LAFAM Pilates Studio"}
            label="Studio"
            maxLength={120}
            name="studio"
            required
          />
          <FormInput
            label="Duration (minutes)"
            max={240}
            min={15}
            name="duration_minutes"
            onChange={(event) => setDurationMinutes(Number(event.target.value))}
            required
            type="number"
            value={durationMinutes}
          />
          {isEditing ? (
            <FormInput
              label="Class date"
              name="class_date"
              onChange={(event) => setClassDate(event.target.value)}
              required
              type="date"
              value={classDate}
            />
          ) : null}
          {!isEditing ? (
            <>
              <FormInput
                label="Start date"
                name="start_date"
                onChange={(event) => setScheduleStartDate(event.target.value)}
                required
                type="date"
                value={scheduleStartDate}
              />
              <FormInput
                label="End date"
                min={scheduleStartDate}
                name="end_date"
                onChange={(event) => setScheduleEndDate(event.target.value)}
                required
                type="date"
                value={scheduleEndDate}
              />
            </>
          ) : null}
          {isEditing ? (
            <>
              <TimeSlotPicker
                className="md:col-span-2"
                disabled={isSaving}
                emptyLabel={
                  selectedTrainerId && classDate
                    ? "No trainer availability fits this duration on the selected day."
                    : "Select a trainer and class date to show available time slots."
                }
                name="start_time"
                onChange={setStartTime}
                options={singleSlotsWithCurrent}
                required
                value={startTime}
              />
              <FormInput
                label="Capacity"
                max={100}
                min={1}
                name="capacity"
                onChange={(event) => setCapacity(Number(event.target.value))}
                required
                type="number"
                value={capacity}
              />
            </>
          ) : (
            <FormInput
              label="Default capacity"
              max={100}
              min={1}
              name="capacity"
              onChange={(event) => setCapacity(Number(event.target.value))}
              required
              type="number"
              value={capacity}
            />
          )}
          <FormInput
            label="Price (KWD)"
            min={0}
            name="price_amount"
            onChange={(event) => setPriceAmount(Number(event.target.value))}
            required
            step="0.001"
            type="number"
            value={priceAmount}
          />
          <FormInput
            defaultValue="KWD"
            disabled
            label="Currency"
            readOnly
            type="text"
          />
        </div>

        {!isEditing ? (
          <MonthlySchedulePlanner
            durationMinutes={durationMinutes}
            onCopySlots={copyMonthlySlots}
            onSelectedDayChange={setSelectedScheduleDay}
            onToggleSlot={toggleMonthlySlot}
            plan={validMonthlyPlan}
            scheduleEndDate={scheduleEndDate}
            scheduleStartDate={scheduleStartDate}
            selectedDay={selectedScheduleDay}
            selectedTrainer={selectedTrainer}
          />
        ) : null}
      </div>

      <ModalFooter
        isSaving={isSaving}
        onClose={onClose}
        submitLabel={item ? "Save schedule" : "Create schedule plan"}
      />
    </form>
  );
}

function TimeSlotPicker({
  className,
  disabled,
  emptyLabel,
  name,
  onChange,
  options,
  required,
  value,
}: {
  className?: string;
  disabled?: boolean;
  emptyLabel: string;
  name: string;
  onChange: (value: string) => void;
  options: TimeSlotOption[];
  required?: boolean;
  value: string;
}) {
  const selectedValue = options.some((option) => option.startTime === value)
    ? value
    : "";

  return (
    <fieldset className={`grid gap-2 text-xs font-bold ${className ?? ""}`}>
      <legend>Time slot</legend>
      {options.length > 0 ? (
        <select
          className={fieldClass}
          disabled={disabled}
          name={name}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          value={selectedValue}
        >
          <option value="">Select available time</option>
          {options.map((option) => {
            return (
              <option key={option.startTime} value={option.startTime}>
                {option.label}
              </option>
            );
          })}
        </select>
      ) : (
        <p className="rounded-sm border border-dashed border-background-secondary bg-background px-3 py-3 text-xs font-semibold text-txt-secondary">
          {emptyLabel}
        </p>
      )}
      {required && options.length > 0 ? (
        <span className="font-normal text-txt-secondary">
          Select one available trainer time slot.
        </span>
      ) : null}
    </fieldset>
  );
}

function MonthlySchedulePlanner({
  durationMinutes,
  onCopySlots,
  onSelectedDayChange,
  onToggleSlot,
  plan,
  scheduleEndDate,
  scheduleStartDate,
  selectedDay,
  selectedTrainer,
}: {
  durationMinutes: number;
  onCopySlots: (targetDay: number, sourceDay: number) => void;
  onSelectedDayChange: (value: number) => void;
  onToggleSlot: (
    dayOfWeek: number,
    slotStartTime: string,
    available: boolean,
  ) => void;
  plan: MonthlySchedulePlan;
  scheduleEndDate: string;
  scheduleStartDate: string;
  selectedDay: number;
  selectedTrainer: StaffMember | undefined;
}) {
  const slots = useMemo(
    () => trainerDaySlots(selectedTrainer, selectedDay, durationMinutes),
    [durationMinutes, selectedDay, selectedTrainer],
  );
  const availableSlotCountByDay = useMemo(
    () =>
      Object.fromEntries(
        Array.from({ length: 7 }, (_, day) => [
          day,
          trainerDaySlots(selectedTrainer, day, durationMinutes).filter(
            (slot) => slot.available,
          ).length,
        ]),
      ) as Record<number, number>,
    [durationMinutes, selectedTrainer],
  );
  const selectedDayLabel =
    scheduleWeekDays.find((day) => day.value === selectedDay)?.label ??
    "Selected day";
  const selectedDayIncluded = dayOccursInInterval(
    selectedDay,
    scheduleStartDate,
    scheduleEndDate,
  );
  const selectedStarts = new Set(plan[String(selectedDay)] ?? []);

  return (
    <section className="mt-6 overflow-hidden rounded-sm border border-background-secondary bg-card-bg-primary">
      <header className="border-b border-background-secondary bg-background-secondary/40 px-4 py-4">
        <h3 className="text-lg font-bold text-txt-primary">Schedule days</h3>
      </header>
      <div className="border-b border-background-secondary bg-card-bg-secondary px-4 py-4">
        <div
          aria-label="Select schedule day"
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7"
        >
          {scheduleWeekDays.map((day) => {
            const dayIncluded = dayOccursInInterval(
              day.value,
              scheduleStartDate,
              scheduleEndDate,
            );
            const selectedCount = dayIncluded
              ? (plan[String(day.value)]?.length ?? 0)
              : 0;
            const hasAvailable =
              dayIncluded && availableSlotCountByDay[day.value] > 0;
            const active = selectedDay === day.value;

            return (
              <button
                className={`relative min-h-24 w-full rounded-sm border px-3 py-2 text-left text-black transition ${
                  active && dayIncluded
                    ? "border-primary bg-primary shadow-sm ring-2 ring-primary/30"
                    : active
                      ? "border-warning/40 bg-warning/10 shadow-sm ring-2 ring-warning/20"
                      : dayIncluded
                        ? "border-primary/20 bg-primary/20 hover:bg-primary/30"
                        : "border-background-secondary bg-background text-txt-secondary hover:bg-card-bg-secondary"
                }`}
                key={day.value}
                onClick={() => onSelectedDayChange(day.value)}
                type="button"
              >
                <span className="block text-xs font-bold uppercase text-inherit">
                  {day.shortLabel}
                </span>
                <span className="mt-1 block break-words text-base font-bold leading-tight text-inherit 2xl:text-lg">
                  {day.label}
                </span>
                <span className="mt-2 block text-[11px] font-semibold text-inherit opacity-75">
                  {!dayIncluded
                    ? "Not in interval"
                    : hasAvailable
                      ? `${availableSlotCountByDay[day.value]} available`
                      : "No slots"}
                </span>
                {selectedCount > 0 ? (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {selectedCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      <div className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h4 className="text-sm font-bold text-txt-primary">
            {selectedDayLabel} slots
          </h4>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-bold text-txt-secondary">
              Copy from
              <select
                className="min-h-9 rounded-sm border border-background-secondary bg-card-bg-primary px-2 text-xs text-txt-primary outline-none focus:border-primary"
                disabled={!selectedDayIncluded}
                onChange={(event) => {
                  const sourceDay = Number(event.target.value);

                  if (Number.isInteger(sourceDay)) {
                    onCopySlots(selectedDay, sourceDay);
                  }

                  event.target.value = "";
                }}
                value=""
              >
                <option value="">Select day</option>
                {scheduleWeekDays
                  .filter((day) => day.value !== selectedDay)
                  .map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
              </select>
            </label>
            <span className="text-xs font-semibold text-txt-secondary">
              {selectedStarts.size} selected
            </span>
          </div>
        </div>
        {!selectedDayIncluded ? (
          <p className="rounded-sm border border-dashed border-warning/40 bg-warning/10 px-3 py-3 text-xs font-semibold text-txt-primary">
            {selectedDayLabel} is not included in this date interval.
          </p>
        ) : slots.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {slots.map((slot) => {
              const checked = selectedStarts.has(slot.startTime);

              return (
                <label
                  aria-disabled={!slot.available}
                  className={`flex min-h-12 items-center gap-3 rounded-sm border px-3 py-2 text-sm font-semibold transition ${
                    checked
                      ? "border-primary bg-primary/10 text-primary"
                      : slot.available
                        ? "cursor-pointer border-background-secondary bg-card-bg-primary text-txt-primary hover:bg-card-bg-secondary"
                        : "cursor-not-allowed border-background-secondary bg-background-secondary/45 text-txt-secondary"
                  }`}
                  key={slot.startTime}
                >
                  <input
                    checked={checked}
                    className="size-4 accent-primary disabled:opacity-70"
                    disabled={!slot.available}
                    onChange={() =>
                      onToggleSlot(selectedDay, slot.startTime, slot.available)
                    }
                    type="checkbox"
                  />
                  <span className="text-inherit">{slot.label}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="rounded-sm border border-dashed border-background-secondary bg-background px-3 py-3 text-xs font-semibold text-txt-secondary">
            Select a valid duration to show slots.
          </p>
        )}
      </div>
    </section>
  );
}
