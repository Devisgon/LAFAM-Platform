// apps/api/src/modules/classes/dto/create-pilates-schedule.dto.ts
/**
 * LAFAM create Pilates schedule DTO.
 *
 * Role:
 * - Validates admin request body for creating one weekly Pilates schedule plan.
 * - Accepts weekday-owned time slots under schedule_days.
 * - Keeps price, currency, studio, and default capacity as backend-owned plan fields.
 *
 * Important:
 * - This DTO creates generated schedule occurrences from one weekly plan.
 * - end_time is not accepted from the client.
 * - Backend calculates end_time from start_time + duration_minutes.
 * - Trainer availability, trainer overlap, date generation limits, price resolution,
 *   and conflict checks are handled in service/repository/policy logic.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import {
  PILATES_CLASS_ALLOWED_CURRENCIES,
  PILATES_CLASS_CAPACITY_MAX,
  PILATES_CLASS_CAPACITY_MIN,
  PILATES_CLASS_DATE_PATTERN,
  PILATES_CLASS_DEFAULT_CAPACITY,
  PILATES_CLASS_DEFAULT_CURRENCY,
  PILATES_CLASS_DEFAULT_DURATION_MINUTES,
  PILATES_CLASS_DEFAULT_PRICE_AMOUNT,
  PILATES_CLASS_DEFAULT_STUDIO,
  PILATES_CLASS_DURATION_MAX_MINUTES,
  PILATES_CLASS_DURATION_MIN_MINUTES,
  PILATES_CLASS_PRICE_AMOUNT_MIN,
  PILATES_CLASS_PRICE_DECIMAL_PLACES,
  PILATES_CLASS_STUDIO_MAX_LENGTH,
  PILATES_CLASS_STUDIO_MIN_LENGTH,
  PILATES_CLASS_TIME_VALUE_PATTERN,
  PILATES_SCHEDULE_TIME_SLOT_MAX_COUNT,
  PILATES_SCHEDULE_TIME_SLOT_MIN_COUNT,
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

function uppercaseTrimmedString({ value }: TransformFnParams): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().toUpperCase();
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

function decimalValue(value: unknown): unknown {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();

  if (!/^-?\d+(?:\.\d+)?$/u.test(trimmedValue)) {
    return value;
  }

  return Number(trimmedValue);
}

function requiredInteger({ value }: TransformFnParams): unknown {
  return integerValue(value);
}

function optionalInteger({ value }: TransformFnParams): unknown {
  if (typeof value === 'undefined' || value === null || value === '') {
    return undefined;
  }

  return integerValue(value);
}

function requiredDecimal({ value }: TransformFnParams): unknown {
  return decimalValue(value);
}

function scheduleDayIdentity(value: { day_of_week?: unknown }): unknown {
  return value.day_of_week;
}

export class CreatePilatesScheduleTimeSlotDto {
  @ApiProperty({
    description: 'Time-slot start time in 24-hour HH:mm format.',
    example: '09:00',
  })
  @Transform(requiredTrimmedString)
  @Matches(PILATES_CLASS_TIME_VALUE_PATTERN, {
    message:
      'schedule_days.time_slots.start_time must use HH:mm 24-hour format.',
  })
  readonly start_time!: string;

  @ApiProperty({
    description:
      'Time-slot duration in minutes. Backend calculates end_time from start_time + duration_minutes.',
    example: PILATES_CLASS_DEFAULT_DURATION_MINUTES,
    minimum: PILATES_CLASS_DURATION_MIN_MINUTES,
    maximum: PILATES_CLASS_DURATION_MAX_MINUTES,
  })
  @Transform(requiredInteger)
  @IsInt({
    message: 'schedule_days.time_slots.duration_minutes must be an integer.',
  })
  @Min(PILATES_CLASS_DURATION_MIN_MINUTES, {
    message: `schedule_days.time_slots.duration_minutes must be at least ${PILATES_CLASS_DURATION_MIN_MINUTES}.`,
  })
  @Max(PILATES_CLASS_DURATION_MAX_MINUTES, {
    message: `schedule_days.time_slots.duration_minutes must not exceed ${PILATES_CLASS_DURATION_MAX_MINUTES}.`,
  })
  readonly duration_minutes!: number;

  @ApiPropertyOptional({
    description:
      'Optional capacity override for this time slot. If omitted, default_capacity is used.',
    example: PILATES_CLASS_DEFAULT_CAPACITY,
    minimum: PILATES_CLASS_CAPACITY_MIN,
    maximum: PILATES_CLASS_CAPACITY_MAX,
  })
  @Transform(optionalInteger)
  @IsOptional()
  @IsInt({
    message: 'schedule_days.time_slots.capacity must be an integer.',
  })
  @Min(PILATES_CLASS_CAPACITY_MIN, {
    message: `schedule_days.time_slots.capacity must be at least ${PILATES_CLASS_CAPACITY_MIN}.`,
  })
  @Max(PILATES_CLASS_CAPACITY_MAX, {
    message: `schedule_days.time_slots.capacity must not exceed ${PILATES_CLASS_CAPACITY_MAX}.`,
  })
  readonly capacity?: number;
}

export class CreatePilatesScheduleDayDto {
  @ApiProperty({
    description:
      'Weekday for this schedule day. Uses 0 = Sunday through 6 = Saturday.',
    enum: PILATES_SCHEDULE_WEEKDAYS,
    example: 1,
    minimum: PILATES_SCHEDULE_WEEKDAY_MIN,
    maximum: PILATES_SCHEDULE_WEEKDAY_MAX,
  })
  @Transform(requiredInteger)
  @IsInt({
    message: 'schedule_days.day_of_week must be an integer.',
  })
  @Min(PILATES_SCHEDULE_WEEKDAY_MIN, {
    message: `schedule_days.day_of_week must be at least ${PILATES_SCHEDULE_WEEKDAY_MIN}.`,
  })
  @Max(PILATES_SCHEDULE_WEEKDAY_MAX, {
    message: `schedule_days.day_of_week must not exceed ${PILATES_SCHEDULE_WEEKDAY_MAX}.`,
  })
  readonly day_of_week!: number;

  @ApiProperty({
    description: 'Time slots to generate for this weekday.',
    type: [CreatePilatesScheduleTimeSlotDto],
    minItems: PILATES_SCHEDULE_TIME_SLOT_MIN_COUNT,
    maxItems: PILATES_SCHEDULE_TIME_SLOT_MAX_COUNT,
    example: [
      {
        start_time: '09:00',
        duration_minutes: 50,
        capacity: 8,
      },
      {
        start_time: '18:00',
        duration_minutes: 50,
      },
    ],
  })
  @IsArray({
    message: 'schedule_days.time_slots must be an array.',
  })
  @ArrayMinSize(PILATES_SCHEDULE_TIME_SLOT_MIN_COUNT, {
    message: `schedule_days.time_slots must include at least ${PILATES_SCHEDULE_TIME_SLOT_MIN_COUNT} time slot.`,
  })
  @ArrayMaxSize(PILATES_SCHEDULE_TIME_SLOT_MAX_COUNT, {
    message: `schedule_days.time_slots must not include more than ${PILATES_SCHEDULE_TIME_SLOT_MAX_COUNT} time slots.`,
  })
  @ValidateNested({ each: true })
  @Type(() => CreatePilatesScheduleTimeSlotDto)
  readonly time_slots!: CreatePilatesScheduleTimeSlotDto[];
}

export class CreatePilatesScheduleDto {
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
    description:
      'Trainer staff profile identifier assigned to this schedule plan.',
    example: '4df33c73-4fd5-46bb-a7a5-f5a9914de18a',
    format: 'uuid',
  })
  @Transform(requiredTrimmedString)
  @IsUUID('4', {
    message: 'trainer_staff_profile_id must be a valid UUID.',
  })
  readonly trainer_staff_profile_id!: string;

  @ApiProperty({
    description: 'Studio or room where generated Pilates classes take place.',
    example: PILATES_CLASS_DEFAULT_STUDIO,
    minLength: PILATES_CLASS_STUDIO_MIN_LENGTH,
    maxLength: PILATES_CLASS_STUDIO_MAX_LENGTH,
  })
  @Transform(requiredTrimmedString)
  @IsString({
    message: 'studio must be a string.',
  })
  @MinLength(PILATES_CLASS_STUDIO_MIN_LENGTH, {
    message: `studio must be at least ${PILATES_CLASS_STUDIO_MIN_LENGTH} character long.`,
  })
  @MaxLength(PILATES_CLASS_STUDIO_MAX_LENGTH, {
    message: `studio must not exceed ${PILATES_CLASS_STUDIO_MAX_LENGTH} characters.`,
  })
  readonly studio!: string;

  @ApiProperty({
    description: 'Schedule plan start date. Format: YYYY-MM-DD.',
    example: '2026-07-01',
  })
  @Transform(requiredTrimmedString)
  @Matches(PILATES_CLASS_DATE_PATTERN, {
    message: 'start_date must use YYYY-MM-DD format.',
  })
  readonly start_date!: string;

  @ApiProperty({
    description: 'Schedule plan end date. Format: YYYY-MM-DD.',
    example: '2026-09-30',
  })
  @Transform(requiredTrimmedString)
  @Matches(PILATES_CLASS_DATE_PATTERN, {
    message: 'end_date must use YYYY-MM-DD format.',
  })
  readonly end_date!: string;

  @ApiProperty({
    description:
      'Default generated schedule capacity. Slot capacity overrides may narrow or expand this value.',
    example: PILATES_CLASS_DEFAULT_CAPACITY,
    minimum: PILATES_CLASS_CAPACITY_MIN,
    maximum: PILATES_CLASS_CAPACITY_MAX,
  })
  @Transform(requiredInteger)
  @IsInt({
    message: 'default_capacity must be an integer.',
  })
  @Min(PILATES_CLASS_CAPACITY_MIN, {
    message: `default_capacity must be at least ${PILATES_CLASS_CAPACITY_MIN}.`,
  })
  @Max(PILATES_CLASS_CAPACITY_MAX, {
    message: `default_capacity must not exceed ${PILATES_CLASS_CAPACITY_MAX}.`,
  })
  readonly default_capacity!: number;

  @ApiProperty({
    description: 'Price snapshot for generated schedules.',
    example: PILATES_CLASS_DEFAULT_PRICE_AMOUNT,
    minimum: PILATES_CLASS_PRICE_AMOUNT_MIN,
  })
  @Transform(requiredDecimal)
  @IsNumber(
    {
      maxDecimalPlaces: PILATES_CLASS_PRICE_DECIMAL_PLACES,
    },
    {
      message: `price_amount must be a number with no more than ${PILATES_CLASS_PRICE_DECIMAL_PLACES} decimal places.`,
    },
  )
  @Min(PILATES_CLASS_PRICE_AMOUNT_MIN, {
    message: `price_amount must be at least ${PILATES_CLASS_PRICE_AMOUNT_MIN}.`,
  })
  readonly price_amount!: number;

  @ApiProperty({
    description:
      'Currency snapshot for generated schedules. Current Payment Module supports KWD only.',
    enum: PILATES_CLASS_ALLOWED_CURRENCIES,
    example: PILATES_CLASS_DEFAULT_CURRENCY,
  })
  @Transform(uppercaseTrimmedString)
  @IsIn(PILATES_CLASS_ALLOWED_CURRENCIES, {
    message: 'currency must be KWD.',
  })
  readonly currency!: typeof PILATES_CLASS_DEFAULT_CURRENCY;

  @ApiProperty({
    description:
      'Weekly schedule days to generate between start_date and end_date.',
    type: [CreatePilatesScheduleDayDto],
    minItems: 1,
    maxItems: 7,
    example: [
      {
        day_of_week: 1,
        time_slots: [
          {
            start_time: '09:00',
            duration_minutes: 50,
            capacity: 8,
          },
        ],
      },
      {
        day_of_week: 3,
        time_slots: [
          {
            start_time: '18:00',
            duration_minutes: 50,
          },
        ],
      },
    ],
  })
  @IsArray({
    message: 'schedule_days must be an array.',
  })
  @ArrayMinSize(1, {
    message: 'schedule_days must include at least one weekday plan.',
  })
  @ArrayMaxSize(7, {
    message: 'schedule_days must not include more than 7 weekday plans.',
  })
  @ArrayUnique(scheduleDayIdentity, {
    message: 'schedule_days must not contain duplicate day_of_week values.',
  })
  @ValidateNested({ each: true })
  @Type(() => CreatePilatesScheduleDayDto)
  readonly schedule_days!: CreatePilatesScheduleDayDto[];
}
