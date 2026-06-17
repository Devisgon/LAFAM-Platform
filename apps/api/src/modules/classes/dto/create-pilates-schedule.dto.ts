// apps/api/src/modules/classes/dto/create-pilates-schedule.dto.ts
/**
 * LAFAM create Pilates schedule DTO.
 *
 * Role:
 * - Validates admin request body for creating bookable Pilates class occurrences.
 * - Supports existing single schedule creation.
 * - Supports recurring weekly/monthly schedule generation through the same endpoint.
 *
 * Important:
 * - This DTO creates scheduled occurrences, not the class template.
 * - For single mode, class_date is required.
 * - For recurring mode, start_date, end_date, and recurrence are required.
 * - end_time is not accepted from the client.
 * - Backend calculates end_time from start_time + duration_minutes.
 * - Trainer availability, trainer overlap, recurrence generation limits, and conflict checks
 *   are handled in service/repository/policy logic.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDefined,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import {
  PILATES_CLASS_CAPACITY_MAX,
  PILATES_CLASS_CAPACITY_MIN,
  PILATES_CLASS_DATE_PATTERN,
  PILATES_CLASS_DEFAULT_CAPACITY,
  PILATES_CLASS_DEFAULT_DURATION_MINUTES,
  PILATES_CLASS_DEFAULT_STUDIO,
  PILATES_CLASS_DURATION_MAX_MINUTES,
  PILATES_CLASS_DURATION_MIN_MINUTES,
  PILATES_CLASS_STUDIO_MAX_LENGTH,
  PILATES_CLASS_STUDIO_MIN_LENGTH,
  PILATES_CLASS_TIME_VALUE_PATTERN,
  PILATES_SCHEDULE_CREATION_MODE_RECURRING,
  PILATES_SCHEDULE_CREATION_MODE_SINGLE,
  PILATES_SCHEDULE_CREATION_MODES,
  PILATES_SCHEDULE_DEFAULT_CREATION_MODE,
  PILATES_SCHEDULE_MONTH_DAY_MAX,
  PILATES_SCHEDULE_MONTH_DAY_MIN,
  PILATES_SCHEDULE_MONTHLY_RULE_DAY_OF_MONTH,
  PILATES_SCHEDULE_MONTHLY_RULES,
  PILATES_SCHEDULE_RECURRENCE_MAX_EXCLUDED_DATES,
  PILATES_SCHEDULE_SERIES_FREQUENCIES,
  PILATES_SCHEDULE_SERIES_FREQUENCY_MONTHLY,
  PILATES_SCHEDULE_SERIES_FREQUENCY_WEEKLY,
  PILATES_SCHEDULE_WEEKDAY_MAX,
  PILATES_SCHEDULE_WEEKDAY_MIN,
  PILATES_SCHEDULE_WEEKDAYS,
} from '../constants/pilates-class.constants';

function requiredTrimmedString({ value }: TransformFnParams): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
}

function optionalTrimmedString({ value }: TransformFnParams): unknown {
  if (typeof value === 'undefined' || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function integerValue(value: unknown): unknown {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();

  if (!/^-?\d+$/u.test(trimmedValue)) {
    return value;
  }

  return Number(trimmedValue);
}

function optionalInteger({ value }: TransformFnParams): unknown {
  if (typeof value === 'undefined' || value === null || value === '') {
    return undefined;
  }

  return integerValue(value);
}

function optionalIntegerArray({ value }: TransformFnParams): unknown {
  if (typeof value === 'undefined' || value === null || value === '') {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return value;
  }

  return value.map(integerValue);
}

function optionalTrimmedDateArray({ value }: TransformFnParams): unknown {
  if (typeof value === 'undefined' || value === null || value === '') {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return value;
  }

  return value.map((item: unknown) => {
    if (typeof item !== 'string') {
      return item;
    }

    return item.trim();
  });
}

function isRecurringSchedule(dto: CreatePilatesScheduleDto): boolean {
  return dto.mode === PILATES_SCHEDULE_CREATION_MODE_RECURRING;
}

function isSingleSchedule(dto: CreatePilatesScheduleDto): boolean {
  return dto.mode !== PILATES_SCHEDULE_CREATION_MODE_RECURRING;
}

function isWeeklyRecurrence(dto: CreatePilatesScheduleRecurrenceDto): boolean {
  return dto.frequency === PILATES_SCHEDULE_SERIES_FREQUENCY_WEEKLY;
}

function isMonthlyRecurrence(dto: CreatePilatesScheduleRecurrenceDto): boolean {
  return dto.frequency === PILATES_SCHEDULE_SERIES_FREQUENCY_MONTHLY;
}

export class CreatePilatesScheduleRecurrenceDto {
  @ApiProperty({
    description: 'Recurring schedule frequency.',
    enum: PILATES_SCHEDULE_SERIES_FREQUENCIES,
    example: PILATES_SCHEDULE_SERIES_FREQUENCY_WEEKLY,
  })
  @Transform(requiredTrimmedString)
  @IsIn(PILATES_SCHEDULE_SERIES_FREQUENCIES, {
    message: 'recurrence.frequency must be weekly or monthly.',
  })
  readonly frequency!:
    | typeof PILATES_SCHEDULE_SERIES_FREQUENCY_WEEKLY
    | typeof PILATES_SCHEDULE_SERIES_FREQUENCY_MONTHLY;

  @ApiPropertyOptional({
    description:
      'Weekly recurrence days. Uses 0 = Sunday through 6 = Saturday. Required when frequency is weekly.',
    enum: PILATES_SCHEDULE_WEEKDAYS,
    isArray: true,
    example: [1, 3, 5],
    minimum: PILATES_SCHEDULE_WEEKDAY_MIN,
    maximum: PILATES_SCHEDULE_WEEKDAY_MAX,
  })
  @ValidateIf(isWeeklyRecurrence)
  @IsDefined({
    message: 'recurrence.days_of_week is required for weekly recurrence.',
  })
  @Transform(optionalIntegerArray)
  @IsArray({
    message: 'recurrence.days_of_week must be an array.',
  })
  @ArrayMinSize(1, {
    message: 'recurrence.days_of_week must include at least one weekday.',
  })
  @ArrayMaxSize(7, {
    message: 'recurrence.days_of_week must not include more than 7 weekdays.',
  })
  @ArrayUnique({
    message: 'recurrence.days_of_week must not contain duplicate weekdays.',
  })
  @IsInt({
    each: true,
    message: 'each recurrence.days_of_week value must be an integer.',
  })
  @Min(PILATES_SCHEDULE_WEEKDAY_MIN, {
    each: true,
    message: `each recurrence.days_of_week value must be at least ${PILATES_SCHEDULE_WEEKDAY_MIN}.`,
  })
  @Max(PILATES_SCHEDULE_WEEKDAY_MAX, {
    each: true,
    message: `each recurrence.days_of_week value must not exceed ${PILATES_SCHEDULE_WEEKDAY_MAX}.`,
  })
  readonly days_of_week?: number[];

  @ApiPropertyOptional({
    description:
      'Monthly recurrence rule. Required when frequency is monthly. Version 1 supports day_of_month only.',
    enum: PILATES_SCHEDULE_MONTHLY_RULES,
    example: PILATES_SCHEDULE_MONTHLY_RULE_DAY_OF_MONTH,
  })
  @ValidateIf(isMonthlyRecurrence)
  @IsDefined({
    message: 'recurrence.monthly_rule is required for monthly recurrence.',
  })
  @Transform(requiredTrimmedString)
  @IsIn(PILATES_SCHEDULE_MONTHLY_RULES, {
    message: 'recurrence.monthly_rule must be day_of_month.',
  })
  readonly monthly_rule?: typeof PILATES_SCHEDULE_MONTHLY_RULE_DAY_OF_MONTH;

  @ApiPropertyOptional({
    description:
      'Month day used for monthly recurrence. Required when frequency is monthly.',
    example: 15,
    minimum: PILATES_SCHEDULE_MONTH_DAY_MIN,
    maximum: PILATES_SCHEDULE_MONTH_DAY_MAX,
  })
  @ValidateIf(isMonthlyRecurrence)
  @IsDefined({
    message: 'recurrence.day_of_month is required for monthly recurrence.',
  })
  @Transform(optionalInteger)
  @IsInt({
    message: 'recurrence.day_of_month must be an integer.',
  })
  @Min(PILATES_SCHEDULE_MONTH_DAY_MIN, {
    message: `recurrence.day_of_month must be at least ${PILATES_SCHEDULE_MONTH_DAY_MIN}.`,
  })
  @Max(PILATES_SCHEDULE_MONTH_DAY_MAX, {
    message: `recurrence.day_of_month must not exceed ${PILATES_SCHEDULE_MONTH_DAY_MAX}.`,
  })
  readonly day_of_month?: number;

  @ApiPropertyOptional({
    description:
      'Dates to skip during recurrence generation. Format for each item: YYYY-MM-DD.',
    example: ['2026-06-21', '2026-06-28'],
    maxItems: PILATES_SCHEDULE_RECURRENCE_MAX_EXCLUDED_DATES,
  })
  @Transform(optionalTrimmedDateArray)
  @IsOptional()
  @IsArray({
    message: 'recurrence.excluded_dates must be an array.',
  })
  @ArrayMaxSize(PILATES_SCHEDULE_RECURRENCE_MAX_EXCLUDED_DATES, {
    message: `recurrence.excluded_dates must not include more than ${PILATES_SCHEDULE_RECURRENCE_MAX_EXCLUDED_DATES} dates.`,
  })
  @Matches(PILATES_CLASS_DATE_PATTERN, {
    each: true,
    message: 'each recurrence.excluded_dates value must use YYYY-MM-DD format.',
  })
  readonly excluded_dates?: string[];
}

export class CreatePilatesScheduleDto {
  @ApiPropertyOptional({
    description:
      'Schedule creation mode. Omit this field for backward-compatible single schedule creation.',
    enum: PILATES_SCHEDULE_CREATION_MODES,
    default: PILATES_SCHEDULE_DEFAULT_CREATION_MODE,
    example: PILATES_SCHEDULE_CREATION_MODE_SINGLE,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PILATES_SCHEDULE_CREATION_MODES, {
    message: 'mode must be single or recurring.',
  })
  readonly mode?:
    | typeof PILATES_SCHEDULE_CREATION_MODE_SINGLE
    | typeof PILATES_SCHEDULE_CREATION_MODE_RECURRING =
    PILATES_SCHEDULE_DEFAULT_CREATION_MODE;

  @ApiProperty({
    description: 'Reusable Pilates class identifier.',
    example: '9b5b8e3e-8e27-4f5d-a4f8-6f85f8b6f9f1',
    format: 'uuid',
  })
  @Transform(requiredTrimmedString)
  @IsUUID('4', {
    message: 'class_id must be a valid UUID.',
  })
  readonly class_id!: string;

  @ApiProperty({
    description: 'Trainer staff profile identifier assigned to this schedule.',
    example: '4df33c73-4fd5-46bb-a7a5-f5a9914de18a',
    format: 'uuid',
  })
  @Transform(requiredTrimmedString)
  @IsUUID('4', {
    message: 'trainer_staff_profile_id must be a valid UUID.',
  })
  readonly trainer_staff_profile_id!: string;

  @ApiPropertyOptional({
    description: 'Studio or room where the Pilates class will take place.',
    example: PILATES_CLASS_DEFAULT_STUDIO,
    default: PILATES_CLASS_DEFAULT_STUDIO,
    minLength: PILATES_CLASS_STUDIO_MIN_LENGTH,
    maxLength: PILATES_CLASS_STUDIO_MAX_LENGTH,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsString({
    message: 'studio must be a string.',
  })
  @MinLength(PILATES_CLASS_STUDIO_MIN_LENGTH, {
    message: `studio must be at least ${PILATES_CLASS_STUDIO_MIN_LENGTH} character long.`,
  })
  @MaxLength(PILATES_CLASS_STUDIO_MAX_LENGTH, {
    message: `studio must not exceed ${PILATES_CLASS_STUDIO_MAX_LENGTH} characters.`,
  })
  readonly studio?: string = PILATES_CLASS_DEFAULT_STUDIO;

  @ApiPropertyOptional({
    description:
      'Single schedule date. Format: YYYY-MM-DD. Required when mode is single or omitted.',
    example: '2026-06-15',
  })
  @ValidateIf(isSingleSchedule)
  @IsDefined({
    message: 'class_date is required for single schedule creation.',
  })
  @Transform(requiredTrimmedString)
  @Matches(PILATES_CLASS_DATE_PATTERN, {
    message: 'class_date must use YYYY-MM-DD format.',
  })
  readonly class_date?: string;

  @ApiPropertyOptional({
    description:
      'Recurring schedule start date. Format: YYYY-MM-DD. Required when mode is recurring.',
    example: '2026-06-15',
  })
  @ValidateIf(isRecurringSchedule)
  @IsDefined({
    message: 'start_date is required for recurring schedule creation.',
  })
  @Transform(requiredTrimmedString)
  @Matches(PILATES_CLASS_DATE_PATTERN, {
    message: 'start_date must use YYYY-MM-DD format.',
  })
  readonly start_date?: string;

  @ApiPropertyOptional({
    description:
      'Recurring schedule end date. Format: YYYY-MM-DD. Required when mode is recurring.',
    example: '2026-09-15',
  })
  @ValidateIf(isRecurringSchedule)
  @IsDefined({
    message: 'end_date is required for recurring schedule creation.',
  })
  @Transform(requiredTrimmedString)
  @Matches(PILATES_CLASS_DATE_PATTERN, {
    message: 'end_date must use YYYY-MM-DD format.',
  })
  readonly end_date?: string;

  @ApiProperty({
    description: 'Schedule start time in 24-hour HH:mm format.',
    example: '10:00',
  })
  @Transform(requiredTrimmedString)
  @Matches(PILATES_CLASS_TIME_VALUE_PATTERN, {
    message: 'start_time must use HH:mm 24-hour format.',
  })
  readonly start_time!: string;

  @ApiPropertyOptional({
    description:
      'Schedule duration in minutes. Backend calculates end_time from this value.',
    example: PILATES_CLASS_DEFAULT_DURATION_MINUTES,
    default: PILATES_CLASS_DEFAULT_DURATION_MINUTES,
    minimum: PILATES_CLASS_DURATION_MIN_MINUTES,
    maximum: PILATES_CLASS_DURATION_MAX_MINUTES,
  })
  @Transform(optionalInteger)
  @IsOptional()
  @IsInt({
    message: 'duration_minutes must be an integer.',
  })
  @Min(PILATES_CLASS_DURATION_MIN_MINUTES, {
    message: `duration_minutes must be at least ${PILATES_CLASS_DURATION_MIN_MINUTES}.`,
  })
  @Max(PILATES_CLASS_DURATION_MAX_MINUTES, {
    message: `duration_minutes must not exceed ${PILATES_CLASS_DURATION_MAX_MINUTES}.`,
  })
  readonly duration_minutes?: number = PILATES_CLASS_DEFAULT_DURATION_MINUTES;

  @ApiPropertyOptional({
    description:
      'Schedule capacity. If omitted, service may use the class default capacity.',
    example: PILATES_CLASS_DEFAULT_CAPACITY,
    default: PILATES_CLASS_DEFAULT_CAPACITY,
    minimum: PILATES_CLASS_CAPACITY_MIN,
    maximum: PILATES_CLASS_CAPACITY_MAX,
  })
  @Transform(optionalInteger)
  @IsOptional()
  @IsInt({
    message: 'capacity must be an integer.',
  })
  @Min(PILATES_CLASS_CAPACITY_MIN, {
    message: `capacity must be at least ${PILATES_CLASS_CAPACITY_MIN}.`,
  })
  @Max(PILATES_CLASS_CAPACITY_MAX, {
    message: `capacity must not exceed ${PILATES_CLASS_CAPACITY_MAX}.`,
  })
  readonly capacity?: number;

  @ApiPropertyOptional({
    description:
      'Recurring schedule rule. Required when mode is recurring. Ignored for single schedule creation.',
    type: CreatePilatesScheduleRecurrenceDto,
    examples: {
      weekly: {
        summary: 'Weekly recurrence',
        value: {
          frequency: PILATES_SCHEDULE_SERIES_FREQUENCY_WEEKLY,
          days_of_week: [1, 3, 5],
          excluded_dates: ['2026-06-21'],
        },
      },
      monthly: {
        summary: 'Monthly recurrence',
        value: {
          frequency: PILATES_SCHEDULE_SERIES_FREQUENCY_MONTHLY,
          monthly_rule: PILATES_SCHEDULE_MONTHLY_RULE_DAY_OF_MONTH,
          day_of_month: 15,
          excluded_dates: ['2026-08-15'],
        },
      },
    },
  })
  @ValidateIf(isRecurringSchedule)
  @IsDefined({
    message: 'recurrence is required for recurring schedule creation.',
  })
  @IsObject({
    message: 'recurrence must be an object.',
  })
  @ValidateNested()
  @Type(() => CreatePilatesScheduleRecurrenceDto)
  readonly recurrence?: CreatePilatesScheduleRecurrenceDto;
}
