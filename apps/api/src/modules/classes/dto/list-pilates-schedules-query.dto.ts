// apps/api/src/modules/classes/dto/list-pilates-schedules-query.dto.ts
/**
 * LAFAM Pilates schedule list query DTOs.
 *
 * Role:
 * - Validates admin Pilates schedule list filters.
 * - Validates public/customer Pilates schedule list filters.
 * - Applies safe defaults for pagination and sorting.
 * - Supports filtering schedules by recurrence series and generation source.
 *
 * Important:
 * - Admin query can include cancelled, completed, deleted, and scheduled records.
 * - Public query must only be used by service logic to expose future scheduled/customer-safe schedules.
 * - Availability is returned by service layer, not trusted from query params.
 * - series_id and generation_source are query filters only; clients must not mutate recurrence metadata directly.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  PILATES_CLASS_DATE_PATTERN,
  PILATES_CLASS_LIST_DEFAULT_OFFSET,
  PILATES_CLASS_SCHEDULE_DEFAULT_SORT_DIRECTION,
  PILATES_CLASS_SCHEDULE_DEFAULT_SORT_FIELD,
  PILATES_CLASS_SCHEDULE_LIST_DEFAULT_LIMIT,
  PILATES_CLASS_SCHEDULE_LIST_DEFAULT_OFFSET,
  PILATES_CLASS_SCHEDULE_LIST_MAX_LIMIT,
  PILATES_CLASS_SCHEDULE_PUBLIC_LIST_DEFAULT_LIMIT,
  PILATES_CLASS_SCHEDULE_PUBLIC_LIST_MAX_LIMIT,
  PILATES_CLASS_SCHEDULE_SORT_FIELDS,
  PILATES_CLASS_SCHEDULE_STATUSES,
  PILATES_CLASS_SORT_DIRECTIONS,
  PILATES_CLASS_STUDIO_MAX_LENGTH,
  PILATES_SCHEDULE_GENERATION_SOURCES,
  type PilatesClassScheduleSortField,
  type PilatesClassScheduleStatus,
  type PilatesClassSortDirection,
  type PilatesScheduleGenerationSource,
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

function optionalBoolean({ value }: TransformFnParams): unknown {
  if (typeof value === 'undefined' || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (['true', '1', 'yes'].includes(normalizedValue)) {
    return true;
  }

  if (['false', '0', 'no'].includes(normalizedValue)) {
    return false;
  }

  return value;
}

export class ListPilatesSchedulesQueryDto {
  @ApiPropertyOptional({
    description: 'Filter schedules by Pilates class identifier.',
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
    description: 'Filter schedules by trainer staff profile identifier.',
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
    description: 'Filter schedules by recurring schedule series identifier.',
    example: 'e3a30cb2-47d5-49e7-900e-2a34b6a9ef4d',
    format: 'uuid',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsUUID('4', {
    message: 'series_id must be a valid UUID.',
  })
  readonly series_id?: string;

  @ApiPropertyOptional({
    description: 'Filter schedules by generation source.',
    enum: PILATES_SCHEDULE_GENERATION_SOURCES,
    example: 'recurring',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PILATES_SCHEDULE_GENERATION_SOURCES, {
    message: 'generation_source must be either single or recurring.',
  })
  readonly generation_source?: PilatesScheduleGenerationSource;

  @ApiPropertyOptional({
    description: 'Filter schedules by status.',
    enum: PILATES_CLASS_SCHEDULE_STATUSES,
    example: 'scheduled',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PILATES_CLASS_SCHEDULE_STATUSES, {
    message: 'status must be one of: scheduled, cancelled, completed, deleted.',
  })
  readonly status?: PilatesClassScheduleStatus;

  @ApiPropertyOptional({
    description: 'Filter schedules by studio name.',
    example: 'Main Studio',
    maxLength: PILATES_CLASS_STUDIO_MAX_LENGTH,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsString({
    message: 'studio must be a string.',
  })
  @MaxLength(PILATES_CLASS_STUDIO_MAX_LENGTH, {
    message: `studio must not exceed ${PILATES_CLASS_STUDIO_MAX_LENGTH} characters.`,
  })
  readonly studio?: string;

  @ApiPropertyOptional({
    description: 'Start date for schedule filtering. Format: YYYY-MM-DD.',
    example: '2026-06-15',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @Matches(PILATES_CLASS_DATE_PATTERN, {
    message: 'from_date must use YYYY-MM-DD format.',
  })
  readonly from_date?: string;

  @ApiPropertyOptional({
    description: 'End date for schedule filtering. Format: YYYY-MM-DD.',
    example: '2026-06-30',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @Matches(PILATES_CLASS_DATE_PATTERN, {
    message: 'to_date must use YYYY-MM-DD format.',
  })
  readonly to_date?: string;

  @ApiPropertyOptional({
    description: 'Whether deleted schedules should be included.',
    example: false,
    default: false,
  })
  @Transform(optionalBoolean)
  @IsOptional()
  @IsBoolean({
    message: 'include_deleted must be a boolean.',
  })
  readonly include_deleted?: boolean = false;

  @ApiPropertyOptional({
    description: 'Maximum number of schedules to return.',
    example: PILATES_CLASS_SCHEDULE_LIST_DEFAULT_LIMIT,
    default: PILATES_CLASS_SCHEDULE_LIST_DEFAULT_LIMIT,
    minimum: 1,
    maximum: PILATES_CLASS_SCHEDULE_LIST_MAX_LIMIT,
  })
  @Transform(optionalInteger)
  @IsOptional()
  @IsInt({
    message: 'limit must be an integer.',
  })
  @Min(1, {
    message: 'limit must be at least 1.',
  })
  @Max(PILATES_CLASS_SCHEDULE_LIST_MAX_LIMIT, {
    message: `limit must not exceed ${PILATES_CLASS_SCHEDULE_LIST_MAX_LIMIT}.`,
  })
  readonly limit: number = PILATES_CLASS_SCHEDULE_LIST_DEFAULT_LIMIT;

  @ApiPropertyOptional({
    description: 'Number of schedules to skip.',
    example: PILATES_CLASS_SCHEDULE_LIST_DEFAULT_OFFSET,
    default: PILATES_CLASS_SCHEDULE_LIST_DEFAULT_OFFSET,
    minimum: 0,
  })
  @Transform(optionalInteger)
  @IsOptional()
  @IsInt({
    message: 'offset must be an integer.',
  })
  @Min(0, {
    message: 'offset must be at least 0.',
  })
  readonly offset: number = PILATES_CLASS_SCHEDULE_LIST_DEFAULT_OFFSET;

  @ApiPropertyOptional({
    description: 'Field used to sort Pilates schedules.',
    enum: PILATES_CLASS_SCHEDULE_SORT_FIELDS,
    example: PILATES_CLASS_SCHEDULE_DEFAULT_SORT_FIELD,
    default: PILATES_CLASS_SCHEDULE_DEFAULT_SORT_FIELD,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PILATES_CLASS_SCHEDULE_SORT_FIELDS, {
    message:
      'sort_by must be one of: class_date, start_time, status, generation_source, created_at, updated_at.',
  })
  readonly sort_by: PilatesClassScheduleSortField =
    PILATES_CLASS_SCHEDULE_DEFAULT_SORT_FIELD;

  @ApiPropertyOptional({
    description: 'Sort direction.',
    enum: PILATES_CLASS_SORT_DIRECTIONS,
    example: PILATES_CLASS_SCHEDULE_DEFAULT_SORT_DIRECTION,
    default: PILATES_CLASS_SCHEDULE_DEFAULT_SORT_DIRECTION,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PILATES_CLASS_SORT_DIRECTIONS, {
    message: 'sort_direction must be either asc or desc.',
  })
  readonly sort_direction: PilatesClassSortDirection =
    PILATES_CLASS_SCHEDULE_DEFAULT_SORT_DIRECTION;
}

export class ListPublicPilatesSchedulesQueryDto {
  @ApiPropertyOptional({
    description: 'Filter public schedules by Pilates class identifier.',
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
    description: 'Filter public schedules by trainer staff profile identifier.',
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
    description:
      'Filter public schedules by recurring schedule series identifier.',
    example: 'e3a30cb2-47d5-49e7-900e-2a34b6a9ef4d',
    format: 'uuid',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsUUID('4', {
    message: 'series_id must be a valid UUID.',
  })
  readonly series_id?: string;

  @ApiPropertyOptional({
    description: 'Filter public schedules by generation source.',
    enum: PILATES_SCHEDULE_GENERATION_SOURCES,
    example: 'recurring',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PILATES_SCHEDULE_GENERATION_SOURCES, {
    message: 'generation_source must be either single or recurring.',
  })
  readonly generation_source?: PilatesScheduleGenerationSource;

  @ApiPropertyOptional({
    description: 'Filter public schedules by studio name.',
    example: 'Main Studio',
    maxLength: PILATES_CLASS_STUDIO_MAX_LENGTH,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsString({
    message: 'studio must be a string.',
  })
  @MaxLength(PILATES_CLASS_STUDIO_MAX_LENGTH, {
    message: `studio must not exceed ${PILATES_CLASS_STUDIO_MAX_LENGTH} characters.`,
  })
  readonly studio?: string;

  @ApiPropertyOptional({
    description:
      'Start date for public schedule filtering. Format: YYYY-MM-DD.',
    example: '2026-06-15',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @Matches(PILATES_CLASS_DATE_PATTERN, {
    message: 'from_date must use YYYY-MM-DD format.',
  })
  readonly from_date?: string;

  @ApiPropertyOptional({
    description: 'End date for public schedule filtering. Format: YYYY-MM-DD.',
    example: '2026-06-30',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @Matches(PILATES_CLASS_DATE_PATTERN, {
    message: 'to_date must use YYYY-MM-DD format.',
  })
  readonly to_date?: string;

  @ApiPropertyOptional({
    description:
      'Whether only schedules with available seats should be returned. Prepared for booking module availability.',
    example: false,
    default: false,
  })
  @Transform(optionalBoolean)
  @IsOptional()
  @IsBoolean({
    message: 'only_available must be a boolean.',
  })
  readonly only_available?: boolean = false;

  @ApiPropertyOptional({
    description: 'Maximum number of public schedules to return.',
    example: PILATES_CLASS_SCHEDULE_PUBLIC_LIST_DEFAULT_LIMIT,
    default: PILATES_CLASS_SCHEDULE_PUBLIC_LIST_DEFAULT_LIMIT,
    minimum: 1,
    maximum: PILATES_CLASS_SCHEDULE_PUBLIC_LIST_MAX_LIMIT,
  })
  @Transform(optionalInteger)
  @IsOptional()
  @IsInt({
    message: 'limit must be an integer.',
  })
  @Min(1, {
    message: 'limit must be at least 1.',
  })
  @Max(PILATES_CLASS_SCHEDULE_PUBLIC_LIST_MAX_LIMIT, {
    message: `limit must not exceed ${PILATES_CLASS_SCHEDULE_PUBLIC_LIST_MAX_LIMIT}.`,
  })
  readonly limit: number = PILATES_CLASS_SCHEDULE_PUBLIC_LIST_DEFAULT_LIMIT;

  @ApiPropertyOptional({
    description: 'Number of public schedules to skip.',
    example: PILATES_CLASS_LIST_DEFAULT_OFFSET,
    default: PILATES_CLASS_LIST_DEFAULT_OFFSET,
    minimum: 0,
  })
  @Transform(optionalInteger)
  @IsOptional()
  @IsInt({
    message: 'offset must be an integer.',
  })
  @Min(0, {
    message: 'offset must be at least 0.',
  })
  readonly offset: number = PILATES_CLASS_LIST_DEFAULT_OFFSET;

  @ApiPropertyOptional({
    description: 'Field used to sort public Pilates schedules.',
    enum: PILATES_CLASS_SCHEDULE_SORT_FIELDS,
    example: PILATES_CLASS_SCHEDULE_DEFAULT_SORT_FIELD,
    default: PILATES_CLASS_SCHEDULE_DEFAULT_SORT_FIELD,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PILATES_CLASS_SCHEDULE_SORT_FIELDS, {
    message:
      'sort_by must be one of: class_date, start_time, status, generation_source, created_at, updated_at.',
  })
  readonly sort_by: PilatesClassScheduleSortField =
    PILATES_CLASS_SCHEDULE_DEFAULT_SORT_FIELD;

  @ApiPropertyOptional({
    description: 'Sort direction.',
    enum: PILATES_CLASS_SORT_DIRECTIONS,
    example: PILATES_CLASS_SCHEDULE_DEFAULT_SORT_DIRECTION,
    default: PILATES_CLASS_SCHEDULE_DEFAULT_SORT_DIRECTION,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PILATES_CLASS_SORT_DIRECTIONS, {
    message: 'sort_direction must be either asc or desc.',
  })
  readonly sort_direction: PilatesClassSortDirection =
    PILATES_CLASS_SCHEDULE_DEFAULT_SORT_DIRECTION;
}
