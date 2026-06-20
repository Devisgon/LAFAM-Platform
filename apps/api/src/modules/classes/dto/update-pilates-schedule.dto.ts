// apps/api/src/modules/classes/dto/update-pilates-schedule.dto.ts
/**
 * LAFAM update Pilates schedule DTO.
 *
 * Role:
 * - Validates admin request body for updating bookable Pilates class occurrences.
 * - Allows partial schedule updates while keeping lifecycle changes controlled.
 * - Accepts update_scope for recurring schedule awareness.
 *
 * Important:
 * - end_time is not accepted from the client.
 * - Backend recalculates end_time from start_time + duration_minutes.
 * - status is not accepted through normal update.
 * - Cancel, complete, and delete actions must use dedicated endpoints/service methods.
 * - For now, service logic may enforce occurrence-level updates only.
 * - Trainer availability and trainer overlap checks are handled in service/repository logic.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
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
} from 'class-validator';

import {
  PILATES_CLASS_CAPACITY_MAX,
  PILATES_CLASS_CAPACITY_MIN,
  PILATES_CLASS_ALLOWED_CURRENCIES,
  PILATES_CLASS_DATE_PATTERN,
  PILATES_CLASS_DEFAULT_CURRENCY,
  PILATES_CLASS_DEFAULT_STUDIO,
  PILATES_CLASS_DURATION_MAX_MINUTES,
  PILATES_CLASS_DURATION_MIN_MINUTES,
  PILATES_CLASS_PRICE_AMOUNT_MIN,
  PILATES_CLASS_PRICE_DECIMAL_PLACES,
  PILATES_CLASS_STUDIO_MAX_LENGTH,
  PILATES_CLASS_STUDIO_MIN_LENGTH,
  PILATES_CLASS_TIME_VALUE_PATTERN,
  PILATES_SCHEDULE_DEFAULT_UPDATE_SCOPE,
  PILATES_SCHEDULE_UPDATE_SCOPES,
} from '../constants/pilates-class.constants';
import type {
  PilatesClassCurrency,
  PilatesScheduleUpdateScope,
} from '../constants/pilates-class.constants';

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

function optionalInteger({ value }: TransformFnParams): unknown {
  if (typeof value === 'undefined' || value === null || value === '') {
    return undefined;
  }

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

function optionalDecimal({ value }: TransformFnParams): unknown {
  if (typeof value === 'undefined' || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? Number(trimmedValue) : undefined;
}

export class UpdatePilatesScheduleDto {
  @ApiPropertyOptional({
    description:
      'Recurring update scope. Omit this field for backward-compatible occurrence-level updates.',
    enum: PILATES_SCHEDULE_UPDATE_SCOPES,
    default: PILATES_SCHEDULE_DEFAULT_UPDATE_SCOPE,
    example: PILATES_SCHEDULE_DEFAULT_UPDATE_SCOPE,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PILATES_SCHEDULE_UPDATE_SCOPES, {
    message:
      'update_scope must be this_occurrence, this_and_following, or entire_series.',
  })
  readonly update_scope?: PilatesScheduleUpdateScope =
    PILATES_SCHEDULE_DEFAULT_UPDATE_SCOPE;

  @ApiPropertyOptional({
    description:
      'Reusable Pilates class identifier. Changing this moves the schedule to another class template.',
    example: '9b5b8e3e-8e27-4f5d-a4f8-6f85f8b6f9f1',
    format: 'uuid',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsUUID('4', {
    message: 'class_id must be a valid UUID.',
  })
  readonly class_id?: string;

  @ApiPropertyOptional({
    description: 'Trainer staff profile identifier assigned to this schedule.',
    example: '4df33c73-4fd5-46bb-a7a5-f5a9914de18a',
    format: 'uuid',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsUUID('4', {
    message: 'trainer_staff_profile_id must be a valid UUID.',
  })
  readonly trainer_staff_profile_id?: string;

  @ApiPropertyOptional({
    description: 'Studio or room where the Pilates class will take place.',
    example: PILATES_CLASS_DEFAULT_STUDIO,
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
  readonly studio?: string;

  @ApiPropertyOptional({
    description: 'Schedule date. Format: YYYY-MM-DD.',
    example: '2026-06-15',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @Matches(PILATES_CLASS_DATE_PATTERN, {
    message: 'class_date must use YYYY-MM-DD format.',
  })
  readonly class_date?: string;

  @ApiPropertyOptional({
    description: 'Schedule start time in 24-hour HH:mm format.',
    example: '10:00',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @Matches(PILATES_CLASS_TIME_VALUE_PATTERN, {
    message: 'start_time must use HH:mm 24-hour format.',
  })
  readonly start_time?: string;

  @ApiPropertyOptional({
    description:
      'Schedule duration in minutes. Backend recalculates end_time from this value.',
    example: 60,
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
  readonly duration_minutes?: number;

  @ApiPropertyOptional({
    description:
      'Schedule capacity. Existing confirmed bookings will be validated by service logic before update.',
    example: 8,
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
    description: 'Schedule price override.',
    example: 15,
    minimum: PILATES_CLASS_PRICE_AMOUNT_MIN,
  })
  @Transform(optionalDecimal)
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: PILATES_CLASS_PRICE_DECIMAL_PLACES },
    {
      message: `price_amount must be a number with no more than ${PILATES_CLASS_PRICE_DECIMAL_PLACES} decimal places.`,
    },
  )
  @Min(PILATES_CLASS_PRICE_AMOUNT_MIN, {
    message: `price_amount must be at least ${PILATES_CLASS_PRICE_AMOUNT_MIN}.`,
  })
  readonly price_amount?: number;

  @ApiPropertyOptional({
    description: 'Schedule currency. Current Payment Module supports KWD only.',
    enum: PILATES_CLASS_ALLOWED_CURRENCIES,
    example: PILATES_CLASS_DEFAULT_CURRENCY,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PILATES_CLASS_ALLOWED_CURRENCIES, {
    message: 'currency must be KWD.',
  })
  readonly currency?: PilatesClassCurrency;
}
