// apps/api/src/modules/classes/dto/create-pilates-schedule.dto.ts
/**
 * LAFAM create Pilates schedule DTO.
 *
 * Role:
 * - Validates admin request body for creating bookable Pilates class occurrences.
 * - Links a reusable Pilates class to a trainer, studio, date, time, duration, and capacity.
 *
 * Important:
 * - This DTO creates a scheduled occurrence, not the class template.
 * - end_time is not accepted from the client.
 * - Backend calculates end_time from start_time + duration_minutes.
 * - Trainer availability and trainer overlap checks are handled in service/repository logic.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsInt,
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
  PILATES_CLASS_DATE_PATTERN,
  PILATES_CLASS_DEFAULT_CAPACITY,
  PILATES_CLASS_DEFAULT_DURATION_MINUTES,
  PILATES_CLASS_DEFAULT_STUDIO,
  PILATES_CLASS_DURATION_MAX_MINUTES,
  PILATES_CLASS_DURATION_MIN_MINUTES,
  PILATES_CLASS_STUDIO_MAX_LENGTH,
  PILATES_CLASS_STUDIO_MIN_LENGTH,
  PILATES_CLASS_TIME_VALUE_PATTERN,
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

  @ApiProperty({
    description: 'Schedule date. Format: YYYY-MM-DD.',
    example: '2026-06-15',
  })
  @Transform(requiredTrimmedString)
  @Matches(PILATES_CLASS_DATE_PATTERN, {
    message: 'class_date must use YYYY-MM-DD format.',
  })
  readonly class_date!: string;

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
}
