// apps/api/src/modules/classes/domain/pilates-schedule-recurrence.policy.ts
/**
 * LAFAM Pilates weekly schedule plan policy.
 *
 * Role:
 * - Generates concrete bookable Pilates schedule occurrences from one weekly plan.
 * - Keeps schedule date/time math outside DTOs, controllers, and repositories.
 * - Applies backend safety limits before database writes happen.
 * - Carries backend-owned price/currency snapshots into generated occurrences.
 *
 * Important:
 * - This policy does not write to the database.
 * - This policy does not check trainer availability or trainer conflicts.
 * - Repository/service logic validates generated occurrences against existing schedules.
 * - Customers still book generated pilates_class_schedules rows, not plan templates.
 */

import { AppError } from '../../../common/errors/app-error';
import {
  PILATES_CLASS_ALLOWED_CURRENCIES,
  PILATES_CLASS_CAPACITY_MIN,
  PILATES_CLASS_PRICE_AMOUNT_MIN,
  PILATES_SCHEDULE_RECURRENCE_MAX_OCCURRENCES,
  PILATES_SCHEDULE_RECURRENCE_MAX_RANGE_MONTHS,
  PILATES_SCHEDULE_TIME_SLOT_MAX_COUNT,
  PILATES_SCHEDULE_TIME_SLOT_MIN_COUNT,
  PILATES_SCHEDULE_WEEKDAY_MAX,
  PILATES_SCHEDULE_WEEKDAY_MIN,
  type PilatesClassCurrency,
  type PilatesScheduleWeekday,
} from '../constants/pilates-class.constants';
import type {
  PilatesScheduleGeneratedOccurrence,
  PilatesWeeklySchedulePlanDayInput,
  PilatesWeeklySchedulePlanGenerationInput,
  PilatesWeeklySchedulePlanGenerationResult,
  PilatesScheduleTimeSlotInput,
} from '../types/pilates-class.types';

interface ParsedIsoDateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

interface NormalizedScheduleTimeSlot {
  readonly slotIndex: number;
  readonly dayOfWeek: PilatesScheduleWeekday;
  readonly startTime: string;
  readonly endTime: string;
  readonly durationMinutes: number;
  readonly capacity: number;
  readonly startTotalMinutes: number;
  readonly endTotalMinutes: number;
}

interface NormalizedScheduleDay {
  readonly dayOfWeek: PilatesScheduleWeekday;
  readonly timeSlots: readonly NormalizedScheduleTimeSlot[];
}

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

export class PilatesScheduleRecurrencePolicy {
  private static readonly ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;

  private static readonly TIME_VALUE_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/u;

  static generateOccurrences(
    input: PilatesWeeklySchedulePlanGenerationInput,
  ): PilatesWeeklySchedulePlanGenerationResult {
    const startDate = this.parseIsoDate(input.start_date, 'start_date');
    const endDate = this.parseIsoDate(input.end_date, 'end_date');

    this.assertDateRangeAllowed(startDate, endDate, input);
    this.assertCapacity(input.default_capacity, 'default_capacity');
    this.assertPriceAmount(input.price_amount);
    this.assertCurrency(input.currency);

    const scheduleDays = this.normalizeScheduleDays(input.schedule_days, input);
    const scheduleDaysByWeekday = new Map<
      PilatesScheduleWeekday,
      NormalizedScheduleDay
    >(scheduleDays.map((scheduleDay) => [scheduleDay.dayOfWeek, scheduleDay]));
    const occurrences: PilatesScheduleGeneratedOccurrence[] = [];

    let cursor = new Date(startDate.getTime());
    let generatedDateIndex = 0;

    while (cursor.getTime() <= endDate.getTime()) {
      const dayOfWeek = cursor.getUTCDay() as PilatesScheduleWeekday;
      const scheduleDay = scheduleDaysByWeekday.get(dayOfWeek);

      if (typeof scheduleDay !== 'undefined') {
        generatedDateIndex += 1;

        this.appendOccurrencesForDate(occurrences, {
          classDate: this.formatIsoDate(cursor),
          generatedDateIndex,
          scheduleDay,
          input,
        });
      }

      cursor = this.addDays(cursor, 1);
    }

    this.assertGeneratedAtLeastOneOccurrence(occurrences, input);

    return {
      occurrences,
      skipped_dates: [],
    };
  }

  private static normalizeScheduleDays(
    scheduleDays: readonly PilatesWeeklySchedulePlanDayInput[],
    input: PilatesWeeklySchedulePlanGenerationInput,
  ): readonly NormalizedScheduleDay[] {
    if (scheduleDays.length === 0) {
      throw AppError.invalidRequest(
        'schedule_days must include at least one weekday plan.',
      );
    }

    if (scheduleDays.length > PILATES_SCHEDULE_WEEKDAY_MAX + 1) {
      throw AppError.invalidRequest(
        'schedule_days must not include more than 7 weekday plans.',
        {
          schedule_day_count: scheduleDays.length,
        },
      );
    }

    const seenWeekdays = new Set<PilatesScheduleWeekday>();
    let nextSlotIndex = 1;

    return [...scheduleDays]
      .sort(
        (firstDay, secondDay) => firstDay.day_of_week - secondDay.day_of_week,
      )
      .map((scheduleDay) => {
        const dayOfWeek = this.normalizeWeekday(scheduleDay.day_of_week);

        if (seenWeekdays.has(dayOfWeek)) {
          throw AppError.invalidRequest(
            'schedule_days must not contain duplicate day_of_week values.',
            {
              day_of_week: dayOfWeek,
            },
          );
        }

        seenWeekdays.add(dayOfWeek);

        const normalizedTimeSlots = this.normalizeTimeSlots(
          scheduleDay,
          input,
          nextSlotIndex,
        );

        nextSlotIndex += normalizedTimeSlots.length;

        return {
          dayOfWeek,
          timeSlots: normalizedTimeSlots,
        };
      });
  }

  private static normalizeTimeSlots(
    scheduleDay: PilatesWeeklySchedulePlanDayInput,
    input: PilatesWeeklySchedulePlanGenerationInput,
    firstSlotIndex: number,
  ): readonly NormalizedScheduleTimeSlot[] {
    const rawTimeSlots = scheduleDay.time_slots;

    if (
      rawTimeSlots.length < PILATES_SCHEDULE_TIME_SLOT_MIN_COUNT ||
      rawTimeSlots.length > PILATES_SCHEDULE_TIME_SLOT_MAX_COUNT
    ) {
      throw AppError.pilatesScheduleTimeSlotInvalid(
        `schedule_days.time_slots must include between ${PILATES_SCHEDULE_TIME_SLOT_MIN_COUNT} and ${PILATES_SCHEDULE_TIME_SLOT_MAX_COUNT} slots.`,
        {
          day_of_week: scheduleDay.day_of_week,
          time_slot_count: rawTimeSlots.length,
          min_time_slots: PILATES_SCHEDULE_TIME_SLOT_MIN_COUNT,
          max_time_slots: PILATES_SCHEDULE_TIME_SLOT_MAX_COUNT,
        },
      );
    }

    const normalizedTimeSlots = rawTimeSlots.map((timeSlot, index) =>
      this.normalizeTimeSlot(timeSlot, {
        dayOfWeek: scheduleDay.day_of_week,
        defaultCapacity: input.default_capacity,
        slotIndex: firstSlotIndex + index,
      }),
    );

    this.assertNoDuplicateTimeSlotWindows(
      scheduleDay.day_of_week,
      normalizedTimeSlots,
    );
    this.assertTimeSlotsDoNotOverlap(
      scheduleDay.day_of_week,
      normalizedTimeSlots,
    );

    return normalizedTimeSlots;
  }

  private static normalizeTimeSlot(
    input: PilatesScheduleTimeSlotInput,
    context: {
      readonly dayOfWeek: PilatesScheduleWeekday;
      readonly defaultCapacity: number;
      readonly slotIndex: number;
    },
  ): NormalizedScheduleTimeSlot {
    this.assertDuration(input.duration_minutes);

    const capacity = input.capacity ?? context.defaultCapacity;

    this.assertCapacity(capacity, 'time_slots.capacity');

    const endTime = this.calculateEndTime(
      input.start_time,
      input.duration_minutes,
    );

    return {
      slotIndex: context.slotIndex,
      dayOfWeek: context.dayOfWeek,
      startTime: input.start_time,
      endTime,
      durationMinutes: input.duration_minutes,
      capacity,
      startTotalMinutes: this.timeToMinutes(
        input.start_time,
        'time_slots.start_time',
      ),
      endTotalMinutes: this.timeToMinutes(endTime, 'time_slots.end_time'),
    };
  }

  private static appendOccurrencesForDate(
    occurrences: PilatesScheduleGeneratedOccurrence[],
    input: {
      readonly classDate: string;
      readonly generatedDateIndex: number;
      readonly scheduleDay: NormalizedScheduleDay;
      readonly input: PilatesWeeklySchedulePlanGenerationInput;
    },
  ): void {
    for (const timeSlot of input.scheduleDay.timeSlots) {
      occurrences.push({
        occurrence_index: occurrences.length + 1,
        class_date: input.classDate,
        day_of_week: timeSlot.dayOfWeek,
        start_time: timeSlot.startTime,
        end_time: timeSlot.endTime,
        duration_minutes: timeSlot.durationMinutes,
        capacity: timeSlot.capacity,
        studio: input.input.studio,
        price_amount: input.input.price_amount,
        currency: input.input.currency,
        series_time_slot_id: null,
        series_date_index: input.generatedDateIndex,
        series_slot_index: timeSlot.slotIndex,
      });

      this.assertOccurrenceLimit(occurrences.length);
    }
  }

  private static normalizeWeekday(weekday: number): PilatesScheduleWeekday {
    if (
      !Number.isInteger(weekday) ||
      weekday < PILATES_SCHEDULE_WEEKDAY_MIN ||
      weekday > PILATES_SCHEDULE_WEEKDAY_MAX
    ) {
      throw AppError.invalidRequest(
        `schedule_days.day_of_week must be between ${PILATES_SCHEDULE_WEEKDAY_MIN} and ${PILATES_SCHEDULE_WEEKDAY_MAX}.`,
        {
          day_of_week: weekday,
        },
      );
    }

    return weekday as PilatesScheduleWeekday;
  }

  private static assertNoDuplicateTimeSlotWindows(
    dayOfWeek: PilatesScheduleWeekday,
    timeSlots: readonly NormalizedScheduleTimeSlot[],
  ): void {
    const seenTimeWindows = new Set<string>();

    for (const timeSlot of timeSlots) {
      const timeWindowKey = `${timeSlot.startTime}|${timeSlot.endTime}`;

      if (seenTimeWindows.has(timeWindowKey)) {
        throw AppError.pilatesScheduleDuplicateTimeSlot(
          'schedule_days.time_slots must not contain duplicate time windows for the same weekday.',
          {
            day_of_week: dayOfWeek,
            start_time: timeSlot.startTime,
            end_time: timeSlot.endTime,
          },
        );
      }

      seenTimeWindows.add(timeWindowKey);
    }
  }

  private static assertTimeSlotsDoNotOverlap(
    dayOfWeek: PilatesScheduleWeekday,
    timeSlots: readonly NormalizedScheduleTimeSlot[],
  ): void {
    const sortedTimeSlots = [...timeSlots].sort(
      (firstTimeSlot, secondTimeSlot) =>
        firstTimeSlot.startTotalMinutes - secondTimeSlot.startTotalMinutes,
    );

    for (let index = 1; index < sortedTimeSlots.length; index += 1) {
      const previousTimeSlot = sortedTimeSlots[index - 1];
      const currentTimeSlot = sortedTimeSlots[index];

      if (
        typeof previousTimeSlot === 'undefined' ||
        typeof currentTimeSlot === 'undefined'
      ) {
        continue;
      }

      if (
        previousTimeSlot.endTotalMinutes > currentTimeSlot.startTotalMinutes
      ) {
        throw AppError.pilatesScheduleTimeSlotInvalid(
          'schedule_days.time_slots must not overlap for the same weekday.',
          {
            day_of_week: dayOfWeek,
            previous_slot_index: previousTimeSlot.slotIndex,
            previous_start_time: previousTimeSlot.startTime,
            previous_end_time: previousTimeSlot.endTime,
            current_slot_index: currentTimeSlot.slotIndex,
            current_start_time: currentTimeSlot.startTime,
            current_end_time: currentTimeSlot.endTime,
          },
        );
      }
    }
  }

  private static assertDateRangeAllowed(
    startDate: Date,
    endDate: Date,
    input: PilatesWeeklySchedulePlanGenerationInput,
  ): void {
    if (startDate.getTime() > endDate.getTime()) {
      throw AppError.invalidRequest(
        'Schedule start_date must be before or equal to end_date.',
        {
          start_date: input.start_date,
          end_date: input.end_date,
        },
      );
    }

    const maxEndDate = this.addMonths(
      startDate,
      PILATES_SCHEDULE_RECURRENCE_MAX_RANGE_MONTHS,
    );

    if (endDate.getTime() > maxEndDate.getTime()) {
      throw AppError.recurrenceRangeTooLarge(
        `Schedule plan cannot span more than ${PILATES_SCHEDULE_RECURRENCE_MAX_RANGE_MONTHS} months.`,
        {
          start_date: input.start_date,
          end_date: input.end_date,
          max_range_months: PILATES_SCHEDULE_RECURRENCE_MAX_RANGE_MONTHS,
        },
      );
    }
  }

  private static assertCapacity(capacity: number, fieldName: string): void {
    if (!Number.isInteger(capacity) || capacity < PILATES_CLASS_CAPACITY_MIN) {
      throw AppError.invalidRequest(`${fieldName} must be positive.`, {
        [fieldName]: capacity,
      });
    }
  }

  private static assertDuration(durationMinutes: number): void {
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1) {
      throw AppError.invalidRequest(
        'time_slots.duration_minutes must be positive.',
        {
          duration_minutes: durationMinutes,
        },
      );
    }
  }

  private static assertPriceAmount(priceAmount: number): void {
    if (
      typeof priceAmount !== 'number' ||
      !Number.isFinite(priceAmount) ||
      priceAmount < PILATES_CLASS_PRICE_AMOUNT_MIN
    ) {
      throw AppError.paymentAmountInvalid(
        `price_amount must be at least ${PILATES_CLASS_PRICE_AMOUNT_MIN}.`,
        {
          price_amount: priceAmount,
          min_price_amount: PILATES_CLASS_PRICE_AMOUNT_MIN,
        },
      );
    }
  }

  private static assertCurrency(currency: PilatesClassCurrency): void {
    if (!PILATES_CLASS_ALLOWED_CURRENCIES.includes(currency)) {
      throw AppError.paymentCurrencyUnsupported('currency must be KWD.', {
        currency,
        allowed_currencies: [...PILATES_CLASS_ALLOWED_CURRENCIES],
      });
    }
  }

  private static assertOccurrenceLimit(generatedCount: number): void {
    if (generatedCount > PILATES_SCHEDULE_RECURRENCE_MAX_OCCURRENCES) {
      throw AppError.recurrenceGeneratedTooManyOccurrences(
        `Schedule plan generation cannot exceed ${PILATES_SCHEDULE_RECURRENCE_MAX_OCCURRENCES} occurrences.`,
        {
          generated_count: generatedCount,
          max_occurrences: PILATES_SCHEDULE_RECURRENCE_MAX_OCCURRENCES,
        },
      );
    }
  }

  private static assertGeneratedAtLeastOneOccurrence(
    occurrences: readonly PilatesScheduleGeneratedOccurrence[],
    input: PilatesWeeklySchedulePlanGenerationInput,
  ): void {
    if (occurrences.length > 0) {
      return;
    }

    throw AppError.invalidRequest(
      'The schedule plan did not generate any schedule occurrences.',
      {
        start_date: input.start_date,
        end_date: input.end_date,
      },
    );
  }

  private static calculateEndTime(
    startTime: string,
    durationMinutes: number,
  ): string {
    const startTotalMinutes = this.timeToMinutes(
      startTime,
      'time_slots.start_time',
    );
    const endTotalMinutes = startTotalMinutes + durationMinutes;

    if (endTotalMinutes >= MINUTES_PER_DAY) {
      throw AppError.invalidRequest(
        'Schedule end time must stay on the same calendar day.',
        {
          start_time: startTime,
          duration_minutes: durationMinutes,
        },
      );
    }

    if (endTotalMinutes <= startTotalMinutes) {
      throw AppError.invalidRequest(
        'Schedule end time must be after start_time.',
        {
          start_time: startTime,
          duration_minutes: durationMinutes,
        },
      );
    }

    const endHour = Math.floor(endTotalMinutes / MINUTES_PER_HOUR);
    const endMinute = endTotalMinutes % MINUTES_PER_HOUR;

    return `${this.pad2(endHour)}:${this.pad2(endMinute)}`;
  }

  private static timeToMinutes(value: string, fieldName: string): number {
    const match = this.TIME_VALUE_PATTERN.exec(value);

    if (!match) {
      throw AppError.invalidRequest(
        `${fieldName} must use HH:mm 24-hour format.`,
        {
          [fieldName]: value,
        },
      );
    }

    const hourText = match[1];
    const minuteText = match[2];

    if (typeof hourText !== 'string' || typeof minuteText !== 'string') {
      throw AppError.invalidRequest(
        `${fieldName} must use HH:mm 24-hour format.`,
        {
          [fieldName]: value,
        },
      );
    }

    return Number(hourText) * MINUTES_PER_HOUR + Number(minuteText);
  }

  private static parseIsoDate(value: string, fieldName: string): Date {
    const parts = this.parseIsoDateParts(value, fieldName);

    if (!this.isValidDateParts(parts.year, parts.month, parts.day)) {
      throw AppError.invalidRequest(`${fieldName} must be a real date.`, {
        [fieldName]: value,
      });
    }

    return this.createUtcDate(parts.year, parts.month, parts.day);
  }

  private static parseIsoDateParts(
    value: string,
    fieldName: string,
  ): ParsedIsoDateParts {
    const match = this.ISO_DATE_PATTERN.exec(value);

    if (!match) {
      throw AppError.invalidRequest(
        `${fieldName} must use YYYY-MM-DD format.`,
        {
          [fieldName]: value,
        },
      );
    }

    const yearText = match[1];
    const monthText = match[2];
    const dayText = match[3];

    if (
      typeof yearText !== 'string' ||
      typeof monthText !== 'string' ||
      typeof dayText !== 'string'
    ) {
      throw AppError.invalidRequest(
        `${fieldName} must use YYYY-MM-DD format.`,
        {
          [fieldName]: value,
        },
      );
    }

    return {
      year: Number(yearText),
      month: Number(monthText),
      day: Number(dayText),
    };
  }

  private static isValidDateParts(
    year: number,
    month: number,
    day: number,
  ): boolean {
    const date = this.createUtcDate(year, month, day);

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }

  private static createUtcDate(year: number, month: number, day: number): Date {
    return new Date(Date.UTC(year, month - 1, day));
  }

  private static addDays(date: Date, days: number): Date {
    const nextDate = new Date(date.getTime());

    nextDate.setUTCDate(nextDate.getUTCDate() + days);

    return nextDate;
  }

  private static addMonths(date: Date, months: number): Date {
    const nextDate = new Date(date.getTime());

    nextDate.setUTCMonth(nextDate.getUTCMonth() + months);

    return nextDate;
  }

  private static formatIsoDate(date: Date): string {
    return [
      date.getUTCFullYear(),
      this.pad2(date.getUTCMonth() + 1),
      this.pad2(date.getUTCDate()),
    ].join('-');
  }

  private static pad2(value: number): string {
    return String(value).padStart(2, '0');
  }
}
