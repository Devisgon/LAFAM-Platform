// apps/api/src/modules/classes/domain/pilates-schedule-recurrence.policy.ts
/**
 * LAFAM Pilates schedule recurrence policy.
 *
 * Role:
 * - Generates concrete bookable Pilates schedule occurrences from recurrence input.
 * - Keeps recurrence date math outside DTOs, controllers, and repositories.
 * - Applies backend safety limits before database writes happen.
 * - Supports single-time recurrence and multi-time recurrence.
 * - Carries backend-owned price/currency snapshots into generated occurrences.
 *
 * Important:
 * - This policy does not write to the database.
 * - This policy does not check trainer availability or trainer conflicts.
 * - Repository/service logic must validate generated occurrences against existing schedules.
 * - Customers still book generated pilates_class_schedules rows, not recurrence templates.
 * - For multi-time recurrence, every recurrence date produces one schedule row per time slot.
 */

import { AppError } from '../../../common/errors/app-error';
import {
  PILATES_CLASS_ALLOWED_CURRENCIES,
  PILATES_CLASS_PRICE_AMOUNT_MIN,
  PILATES_SCHEDULE_MONTH_DAY_MAX,
  PILATES_SCHEDULE_MONTH_DAY_MIN,
  PILATES_SCHEDULE_MONTHLY_RULE_DAY_OF_MONTH,
  PILATES_SCHEDULE_RECURRENCE_MAX_OCCURRENCES,
  PILATES_SCHEDULE_RECURRENCE_MAX_RANGE_MONTHS,
  PILATES_SCHEDULE_SERIES_FREQUENCY_MONTHLY,
  PILATES_SCHEDULE_SERIES_FREQUENCY_WEEKLY,
  PILATES_SCHEDULE_TIME_SLOT_INDEX_MIN,
  PILATES_SCHEDULE_TIME_SLOT_MAX_COUNT,
  PILATES_SCHEDULE_TIME_SLOT_MIN_COUNT,
  PILATES_SCHEDULE_WEEKDAY_MAX,
  PILATES_SCHEDULE_WEEKDAY_MIN,
  type PilatesClassCurrency,
  type PilatesScheduleWeekday,
} from '../constants/pilates-class.constants';
import type {
  PilatesScheduleGeneratedOccurrence,
  PilatesScheduleRecurrenceGenerationInput,
  PilatesScheduleRecurrenceGenerationResult,
  PilatesScheduleSeriesTimeSlotCreateInput,
} from '../types/pilates-class.types';

interface ParsedIsoDateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

interface NormalizedScheduleTimeSlot {
  readonly slotIndex: number | null;
  readonly studio?: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly durationMinutes: number;
  readonly capacity: number;
  readonly priceAmount: number | null;
  readonly currency: PilatesClassCurrency | null;
  readonly startTotalMinutes: number;
  readonly endTotalMinutes: number;
}

interface OccurrenceGenerationContext {
  readonly startDate: Date;
  readonly endDate: Date;
  readonly excludedDates: ReadonlySet<string>;
  readonly timeSlots: readonly NormalizedScheduleTimeSlot[];
  readonly usesMultipleTimeSlots: boolean;
}

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

export class PilatesScheduleRecurrencePolicy {
  private static readonly ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;

  private static readonly TIME_VALUE_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/u;

  static generateOccurrences(
    input: PilatesScheduleRecurrenceGenerationInput,
  ): PilatesScheduleRecurrenceGenerationResult {
    const startDate = this.parseIsoDate(input.start_date, 'start_date');
    const endDate = this.parseIsoDate(input.end_date, 'end_date');

    this.assertDateRangeAllowed(startDate, endDate, input);
    this.assertCapacity(input.capacity);
    this.assertDuration(input.duration_minutes);
    this.assertPriceAmount(input.price_amount ?? null);
    this.assertCurrency(input.currency ?? null);

    const excludedDates = this.normalizeExcludedDates(
      input.excluded_dates ?? [],
    );
    const timeSlots = this.normalizeTimeSlots(input);
    const usesMultipleTimeSlots = this.usesMultipleTimeSlots(input);

    const context: OccurrenceGenerationContext = {
      startDate,
      endDate,
      excludedDates,
      timeSlots,
      usesMultipleTimeSlots,
    };

    if (input.frequency === PILATES_SCHEDULE_SERIES_FREQUENCY_WEEKLY) {
      return this.generateWeeklyOccurrences(input, context);
    }

    if (input.frequency === PILATES_SCHEDULE_SERIES_FREQUENCY_MONTHLY) {
      return this.generateMonthlyOccurrences(input, context);
    }

    throw AppError.invalidRequest('Unsupported Pilates schedule frequency.', {
      frequency: input.frequency,
    });
  }

  private static generateWeeklyOccurrences(
    input: PilatesScheduleRecurrenceGenerationInput,
    context: OccurrenceGenerationContext,
  ): PilatesScheduleRecurrenceGenerationResult {
    const weekdays = this.normalizeWeekdays(input.days_of_week);
    const weekdaySet = new Set<number>(weekdays);
    const occurrences: PilatesScheduleGeneratedOccurrence[] = [];
    const skippedDates = new Set<string>();

    let cursor = new Date(context.startDate.getTime());
    let generatedDateIndex = 0;

    while (cursor.getTime() <= context.endDate.getTime()) {
      const classDate = this.formatIsoDate(cursor);

      if (weekdaySet.has(cursor.getUTCDay())) {
        if (context.excludedDates.has(classDate)) {
          skippedDates.add(classDate);
        } else {
          generatedDateIndex += 1;

          this.appendOccurrencesForDate(occurrences, {
            classDate,
            generatedDateIndex,
            context,
          });
        }
      }

      cursor = this.addDays(cursor, 1);
    }

    this.assertGeneratedAtLeastOneOccurrence(occurrences, input);

    return {
      occurrences,
      skipped_dates: [...skippedDates],
    };
  }

  private static generateMonthlyOccurrences(
    input: PilatesScheduleRecurrenceGenerationInput,
    context: OccurrenceGenerationContext,
  ): PilatesScheduleRecurrenceGenerationResult {
    this.assertMonthlyRule(input);

    const dayOfMonth = input.day_of_month;
    const occurrences: PilatesScheduleGeneratedOccurrence[] = [];
    const skippedDates = new Set<string>();

    if (typeof dayOfMonth !== 'number') {
      throw AppError.invalidRequest(
        'day_of_month is required for monthly recurrence.',
      );
    }

    let cursor = this.firstDayOfMonth(context.startDate);
    const lastMonth = this.firstDayOfMonth(context.endDate);
    let generatedDateIndex = 0;

    while (cursor.getTime() <= lastMonth.getTime()) {
      const year = cursor.getUTCFullYear();
      const month = cursor.getUTCMonth() + 1;

      if (!this.isValidDateParts(year, month, dayOfMonth)) {
        cursor = this.addMonths(cursor, 1);
        continue;
      }

      const candidateDate = this.createUtcDate(year, month, dayOfMonth);

      if (
        candidateDate.getTime() >= context.startDate.getTime() &&
        candidateDate.getTime() <= context.endDate.getTime()
      ) {
        const classDate = this.formatIsoDate(candidateDate);

        if (context.excludedDates.has(classDate)) {
          skippedDates.add(classDate);
        } else {
          generatedDateIndex += 1;

          this.appendOccurrencesForDate(occurrences, {
            classDate,
            generatedDateIndex,
            context,
          });
        }
      }

      cursor = this.addMonths(cursor, 1);
    }

    this.assertGeneratedAtLeastOneOccurrence(occurrences, input);

    return {
      occurrences,
      skipped_dates: [...skippedDates],
    };
  }

  private static appendOccurrencesForDate(
    occurrences: PilatesScheduleGeneratedOccurrence[],
    input: {
      readonly classDate: string;
      readonly generatedDateIndex: number;
      readonly context: OccurrenceGenerationContext;
    },
  ): void {
    for (const timeSlot of input.context.timeSlots) {
      occurrences.push(
        this.createOccurrence({
          occurrenceIndex: occurrences.length + 1,
          classDate: input.classDate,
          generatedDateIndex: input.generatedDateIndex,
          timeSlot,
          usesMultipleTimeSlots: input.context.usesMultipleTimeSlots,
        }),
      );

      this.assertOccurrenceLimit(occurrences.length);
    }
  }

  private static createOccurrence(input: {
    readonly occurrenceIndex: number;
    readonly classDate: string;
    readonly generatedDateIndex: number;
    readonly timeSlot: NormalizedScheduleTimeSlot;
    readonly usesMultipleTimeSlots: boolean;
  }): PilatesScheduleGeneratedOccurrence {
    return {
      occurrence_index: input.occurrenceIndex,
      class_date: input.classDate,
      start_time: input.timeSlot.startTime,
      end_time: input.timeSlot.endTime,
      duration_minutes: input.timeSlot.durationMinutes,
      capacity: input.timeSlot.capacity,
      ...(typeof input.timeSlot.studio === 'string'
        ? {
            studio: input.timeSlot.studio,
          }
        : {}),
      ...(input.timeSlot.priceAmount !== null
        ? {
            price_amount: input.timeSlot.priceAmount,
          }
        : {}),
      ...(input.timeSlot.currency !== null
        ? {
            currency: input.timeSlot.currency,
          }
        : {}),
      ...(input.usesMultipleTimeSlots
        ? {
            series_time_slot_id: null,
            series_date_index: input.generatedDateIndex,
            series_slot_index: input.timeSlot.slotIndex,
          }
        : {}),
    };
  }

  private static normalizeTimeSlots(
    input: PilatesScheduleRecurrenceGenerationInput,
  ): readonly NormalizedScheduleTimeSlot[] {
    if (!this.usesMultipleTimeSlots(input)) {
      const endTime = this.calculateEndTime(
        input.start_time,
        input.duration_minutes,
      );

      return [
        {
          slotIndex: null,
          startTime: input.start_time,
          endTime,
          durationMinutes: input.duration_minutes,
          capacity: input.capacity,
          priceAmount: input.price_amount ?? null,
          currency: input.currency ?? null,
          startTotalMinutes: this.timeToMinutes(input.start_time, 'start_time'),
          endTotalMinutes: this.timeToMinutes(endTime, 'end_time'),
        },
      ];
    }

    const rawTimeSlots = input.time_slots ?? [];

    if (
      rawTimeSlots.length < PILATES_SCHEDULE_TIME_SLOT_MIN_COUNT ||
      rawTimeSlots.length > PILATES_SCHEDULE_TIME_SLOT_MAX_COUNT
    ) {
      throw AppError.pilatesScheduleTimeSlotInvalid(
        `Recurring schedule time_slots must include between ${PILATES_SCHEDULE_TIME_SLOT_MIN_COUNT} and ${PILATES_SCHEDULE_TIME_SLOT_MAX_COUNT} slots.`,
        {
          time_slot_count: rawTimeSlots.length,
          min_time_slots: PILATES_SCHEDULE_TIME_SLOT_MIN_COUNT,
          max_time_slots: PILATES_SCHEDULE_TIME_SLOT_MAX_COUNT,
        },
      );
    }

    const normalizedTimeSlots = rawTimeSlots.map((timeSlot) =>
      this.normalizeTimeSlot(timeSlot),
    );

    this.assertUniqueTimeSlotIndexes(normalizedTimeSlots);
    this.assertNoDuplicateTimeSlotWindows(normalizedTimeSlots);
    this.assertTimeSlotsDoNotOverlap(normalizedTimeSlots);

    return normalizedTimeSlots;
  }

  private static normalizeTimeSlot(
    input: PilatesScheduleSeriesTimeSlotCreateInput,
  ): NormalizedScheduleTimeSlot {
    this.assertTimeSlotIndex(input.slot_index);
    this.assertDuration(input.duration_minutes);
    this.assertCapacity(input.capacity);
    this.assertPriceAmount(input.price_amount ?? null);
    this.assertCurrency(input.currency ?? null);

    const calculatedEndTime = this.calculateEndTime(
      input.start_time,
      input.duration_minutes,
    );

    if (input.end_time !== calculatedEndTime) {
      throw AppError.pilatesScheduleTimeSlotInvalid(
        'Time-slot end_time must match start_time plus duration_minutes.',
        {
          slot_index: input.slot_index,
          start_time: input.start_time,
          duration_minutes: input.duration_minutes,
          expected_end_time: calculatedEndTime,
          received_end_time: input.end_time,
        },
      );
    }

    return {
      slotIndex: input.slot_index,
      studio: input.studio,
      startTime: input.start_time,
      endTime: input.end_time,
      durationMinutes: input.duration_minutes,
      capacity: input.capacity,
      priceAmount: input.price_amount ?? null,
      currency: input.currency ?? null,
      startTotalMinutes: this.timeToMinutes(
        input.start_time,
        'time_slot.start_time',
      ),
      endTotalMinutes: this.timeToMinutes(input.end_time, 'time_slot.end_time'),
    };
  }

  private static usesMultipleTimeSlots(
    input: PilatesScheduleRecurrenceGenerationInput,
  ): boolean {
    return Array.isArray(input.time_slots) && input.time_slots.length > 0;
  }

  private static assertTimeSlotIndex(slotIndex: number): void {
    if (
      !Number.isInteger(slotIndex) ||
      slotIndex < PILATES_SCHEDULE_TIME_SLOT_INDEX_MIN
    ) {
      throw AppError.pilatesScheduleTimeSlotInvalid(
        `Time-slot slot_index must be an integer greater than or equal to ${PILATES_SCHEDULE_TIME_SLOT_INDEX_MIN}.`,
        {
          slot_index: slotIndex,
          min_slot_index: PILATES_SCHEDULE_TIME_SLOT_INDEX_MIN,
        },
      );
    }
  }

  private static assertUniqueTimeSlotIndexes(
    timeSlots: readonly NormalizedScheduleTimeSlot[],
  ): void {
    const seenSlotIndexes = new Set<number>();

    for (const timeSlot of timeSlots) {
      if (timeSlot.slotIndex === null) {
        continue;
      }

      if (seenSlotIndexes.has(timeSlot.slotIndex)) {
        throw AppError.pilatesScheduleDuplicateTimeSlot(
          'Recurring schedule time_slots must not contain duplicate slot_index values.',
          {
            slot_index: timeSlot.slotIndex,
          },
        );
      }

      seenSlotIndexes.add(timeSlot.slotIndex);
    }
  }

  private static assertNoDuplicateTimeSlotWindows(
    timeSlots: readonly NormalizedScheduleTimeSlot[],
  ): void {
    const seenTimeWindows = new Set<string>();

    for (const timeSlot of timeSlots) {
      const timeWindowKey = [
        timeSlot.studio ?? '',
        timeSlot.startTime,
        timeSlot.endTime,
      ].join('|');

      if (seenTimeWindows.has(timeWindowKey)) {
        throw AppError.pilatesScheduleDuplicateTimeSlot(
          'Recurring schedule time_slots must not contain duplicate time windows.',
          {
            studio: timeSlot.studio ?? null,
            start_time: timeSlot.startTime,
            end_time: timeSlot.endTime,
          },
        );
      }

      seenTimeWindows.add(timeWindowKey);
    }
  }

  private static assertTimeSlotsDoNotOverlap(
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
          'Recurring schedule time_slots must not overlap.',
          {
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
    input: PilatesScheduleRecurrenceGenerationInput,
  ): void {
    if (startDate.getTime() > endDate.getTime()) {
      throw AppError.invalidRequest(
        'Recurrence start_date must be before or equal to end_date.',
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
        `Recurring schedules cannot span more than ${PILATES_SCHEDULE_RECURRENCE_MAX_RANGE_MONTHS} months.`,
        {
          start_date: input.start_date,
          end_date: input.end_date,
          max_range_months: PILATES_SCHEDULE_RECURRENCE_MAX_RANGE_MONTHS,
        },
      );
    }
  }

  private static assertCapacity(capacity: number): void {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw AppError.invalidRequest('Schedule capacity must be positive.', {
        capacity,
      });
    }
  }

  private static assertDuration(durationMinutes: number): void {
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1) {
      throw AppError.invalidRequest(
        'Schedule duration_minutes must be positive.',
        {
          duration_minutes: durationMinutes,
        },
      );
    }
  }

  private static assertPriceAmount(priceAmount: number | null): void {
    if (priceAmount === null) {
      return;
    }

    if (
      typeof priceAmount !== 'number' ||
      !Number.isFinite(priceAmount) ||
      priceAmount < PILATES_CLASS_PRICE_AMOUNT_MIN
    ) {
      throw AppError.paymentAmountInvalid(
        `Schedule price_amount must be at least ${PILATES_CLASS_PRICE_AMOUNT_MIN}.`,
        {
          price_amount: priceAmount,
          min_price_amount: PILATES_CLASS_PRICE_AMOUNT_MIN,
        },
      );
    }
  }

  private static assertCurrency(currency: PilatesClassCurrency | null): void {
    if (currency === null) {
      return;
    }

    if (!PILATES_CLASS_ALLOWED_CURRENCIES.includes(currency)) {
      throw AppError.paymentCurrencyUnsupported(
        'Schedule currency must be KWD.',
        {
          currency,
          allowed_currencies: [...PILATES_CLASS_ALLOWED_CURRENCIES],
        },
      );
    }
  }

  private static assertOccurrenceLimit(generatedCount: number): void {
    if (generatedCount > PILATES_SCHEDULE_RECURRENCE_MAX_OCCURRENCES) {
      throw AppError.recurrenceGeneratedTooManyOccurrences(
        `Recurring schedule generation cannot exceed ${PILATES_SCHEDULE_RECURRENCE_MAX_OCCURRENCES} occurrences.`,
        {
          generated_count: generatedCount,
          max_occurrences: PILATES_SCHEDULE_RECURRENCE_MAX_OCCURRENCES,
        },
      );
    }
  }

  private static assertGeneratedAtLeastOneOccurrence(
    occurrences: readonly PilatesScheduleGeneratedOccurrence[],
    input: PilatesScheduleRecurrenceGenerationInput,
  ): void {
    if (occurrences.length > 0) {
      return;
    }

    throw AppError.invalidRequest(
      'The recurrence rule did not generate any schedule occurrences.',
      {
        frequency: input.frequency,
        start_date: input.start_date,
        end_date: input.end_date,
      },
    );
  }

  private static assertMonthlyRule(
    input: PilatesScheduleRecurrenceGenerationInput,
  ): void {
    if (input.monthly_rule !== PILATES_SCHEDULE_MONTHLY_RULE_DAY_OF_MONTH) {
      throw AppError.invalidRequest(
        'Monthly recurrence requires monthly_rule to be day_of_month.',
        {
          monthly_rule: input.monthly_rule ?? null,
        },
      );
    }

    if (
      typeof input.day_of_month !== 'number' ||
      !Number.isInteger(input.day_of_month) ||
      input.day_of_month < PILATES_SCHEDULE_MONTH_DAY_MIN ||
      input.day_of_month > PILATES_SCHEDULE_MONTH_DAY_MAX
    ) {
      throw AppError.invalidRequest(
        `Monthly recurrence day_of_month must be between ${PILATES_SCHEDULE_MONTH_DAY_MIN} and ${PILATES_SCHEDULE_MONTH_DAY_MAX}.`,
        {
          day_of_month: input.day_of_month ?? null,
        },
      );
    }
  }

  private static normalizeWeekdays(
    weekdays: readonly PilatesScheduleWeekday[] | undefined,
  ): readonly PilatesScheduleWeekday[] {
    if (typeof weekdays === 'undefined' || weekdays.length === 0) {
      throw AppError.invalidRequest(
        'Weekly recurrence requires at least one weekday.',
      );
    }

    const normalizedWeekdays = new Set<PilatesScheduleWeekday>();

    for (const weekday of weekdays) {
      if (
        !Number.isInteger(weekday) ||
        weekday < PILATES_SCHEDULE_WEEKDAY_MIN ||
        weekday > PILATES_SCHEDULE_WEEKDAY_MAX
      ) {
        throw AppError.invalidRequest(
          `Weekly recurrence weekdays must be between ${PILATES_SCHEDULE_WEEKDAY_MIN} and ${PILATES_SCHEDULE_WEEKDAY_MAX}.`,
          {
            weekday,
          },
        );
      }

      normalizedWeekdays.add(weekday);
    }

    if (normalizedWeekdays.size !== weekdays.length) {
      throw AppError.invalidRequest(
        'Weekly recurrence days_of_week must not contain duplicate weekdays.',
      );
    }

    return [...normalizedWeekdays];
  }

  private static normalizeExcludedDates(
    excludedDates: readonly string[],
  ): ReadonlySet<string> {
    const normalizedExcludedDates = new Set<string>();

    for (const excludedDate of excludedDates) {
      const parsedDate = this.parseIsoDate(
        excludedDate,
        'recurrence.excluded_dates',
      );

      normalizedExcludedDates.add(this.formatIsoDate(parsedDate));
    }

    return normalizedExcludedDates;
  }

  private static calculateEndTime(
    startTime: string,
    durationMinutes: number,
  ): string {
    const startTotalMinutes = this.timeToMinutes(startTime, 'start_time');
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

  private static firstDayOfMonth(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
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
