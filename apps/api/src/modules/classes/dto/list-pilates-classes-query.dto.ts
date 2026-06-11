// apps/api/src/modules/classes/dto/list-pilates-classes-query.dto.ts
/**
 * LAFAM Pilates class list query DTOs.
 *
 * Role:
 * - Validates admin Pilates class list filters.
 * - Validates public/customer Pilates class list filters.
 * - Applies safe defaults for pagination and sorting.
 *
 * Important:
 * - Admin query can include inactive, draft, and deleted records when explicitly requested.
 * - Public query must only be used by service logic to expose active/customer-safe classes.
 * - Date range filtering is prepared for schedule-aware public class browsing.
 */

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
import { ApiPropertyOptional } from '@nestjs/swagger';

import {
  PILATES_CLASS_DATE_PATTERN,
  PILATES_CLASS_DEFAULT_SORT_DIRECTION,
  PILATES_CLASS_DEFAULT_SORT_FIELD,
  PILATES_CLASS_LEVELS,
  PILATES_CLASS_LIST_DEFAULT_LIMIT,
  PILATES_CLASS_LIST_DEFAULT_OFFSET,
  PILATES_CLASS_LIST_MAX_LIMIT,
  PILATES_CLASS_PUBLIC_LIST_DEFAULT_LIMIT,
  PILATES_CLASS_PUBLIC_LIST_MAX_LIMIT,
  PILATES_CLASS_SORT_DIRECTIONS,
  PILATES_CLASS_SORT_FIELDS,
  PILATES_CLASS_STATUSES,
  PILATES_CLASS_TITLE_MAX_LENGTH,
  type PilatesClassLevel,
  type PilatesClassSortDirection,
  type PilatesClassSortField,
  type PilatesClassStatus,
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

export class ListPilatesClassesQueryDto {
  @ApiPropertyOptional({
    description: 'Search text for Pilates class title or description.',
    example: 'reformer',
    maxLength: PILATES_CLASS_TITLE_MAX_LENGTH,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsString({
    message: 'search must be a string.',
  })
  @MaxLength(PILATES_CLASS_TITLE_MAX_LENGTH, {
    message: `search must not exceed ${PILATES_CLASS_TITLE_MAX_LENGTH} characters.`,
  })
  readonly search?: string;

  @ApiPropertyOptional({
    description: 'Filter Pilates classes by status.',
    enum: PILATES_CLASS_STATUSES,
    example: 'active',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PILATES_CLASS_STATUSES, {
    message: 'status must be one of: draft, active, inactive, deleted.',
  })
  readonly status?: PilatesClassStatus;

  @ApiPropertyOptional({
    description: 'Filter Pilates classes by level.',
    enum: PILATES_CLASS_LEVELS,
    example: 'all_levels',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PILATES_CLASS_LEVELS, {
    message:
      'level must be one of: beginner, intermediate, advanced, all_levels.',
  })
  readonly level?: PilatesClassLevel;

  @ApiPropertyOptional({
    description: 'Whether deleted Pilates classes should be included.',
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
    description: 'Maximum number of Pilates classes to return.',
    example: PILATES_CLASS_LIST_DEFAULT_LIMIT,
    default: PILATES_CLASS_LIST_DEFAULT_LIMIT,
    minimum: 1,
    maximum: PILATES_CLASS_LIST_MAX_LIMIT,
  })
  @Transform(optionalInteger)
  @IsOptional()
  @IsInt({
    message: 'limit must be an integer.',
  })
  @Min(1, {
    message: 'limit must be at least 1.',
  })
  @Max(PILATES_CLASS_LIST_MAX_LIMIT, {
    message: `limit must not exceed ${PILATES_CLASS_LIST_MAX_LIMIT}.`,
  })
  readonly limit: number = PILATES_CLASS_LIST_DEFAULT_LIMIT;

  @ApiPropertyOptional({
    description: 'Number of Pilates classes to skip.',
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
    description: 'Field used to sort Pilates classes.',
    enum: PILATES_CLASS_SORT_FIELDS,
    example: PILATES_CLASS_DEFAULT_SORT_FIELD,
    default: PILATES_CLASS_DEFAULT_SORT_FIELD,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PILATES_CLASS_SORT_FIELDS, {
    message:
      'sort_by must be one of: title, status, level, created_at, updated_at.',
  })
  readonly sort_by: PilatesClassSortField = PILATES_CLASS_DEFAULT_SORT_FIELD;

  @ApiPropertyOptional({
    description: 'Sort direction.',
    enum: PILATES_CLASS_SORT_DIRECTIONS,
    example: PILATES_CLASS_DEFAULT_SORT_DIRECTION,
    default: PILATES_CLASS_DEFAULT_SORT_DIRECTION,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PILATES_CLASS_SORT_DIRECTIONS, {
    message: 'sort_direction must be either asc or desc.',
  })
  readonly sort_direction: PilatesClassSortDirection =
    PILATES_CLASS_DEFAULT_SORT_DIRECTION;
}

export class ListPublicPilatesClassesQueryDto {
  @ApiPropertyOptional({
    description: 'Search text for Pilates class title or description.',
    example: 'reformer',
    maxLength: PILATES_CLASS_TITLE_MAX_LENGTH,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsString({
    message: 'search must be a string.',
  })
  @MaxLength(PILATES_CLASS_TITLE_MAX_LENGTH, {
    message: `search must not exceed ${PILATES_CLASS_TITLE_MAX_LENGTH} characters.`,
  })
  readonly search?: string;

  @ApiPropertyOptional({
    description: 'Filter public Pilates classes by level.',
    enum: PILATES_CLASS_LEVELS,
    example: 'all_levels',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PILATES_CLASS_LEVELS, {
    message:
      'level must be one of: beginner, intermediate, advanced, all_levels.',
  })
  readonly level?: PilatesClassLevel;

  @ApiPropertyOptional({
    description:
      'Filter public Pilates classes by trainer staff profile identifier.',
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
      'Start date for schedule-aware public class filtering. Format: YYYY-MM-DD.',
    example: '2026-06-15',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @Matches(PILATES_CLASS_DATE_PATTERN, {
    message: 'from_date must use YYYY-MM-DD format.',
  })
  readonly from_date?: string;

  @ApiPropertyOptional({
    description:
      'End date for schedule-aware public class filtering. Format: YYYY-MM-DD.',
    example: '2026-06-30',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @Matches(PILATES_CLASS_DATE_PATTERN, {
    message: 'to_date must use YYYY-MM-DD format.',
  })
  readonly to_date?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of public Pilates classes to return.',
    example: PILATES_CLASS_PUBLIC_LIST_DEFAULT_LIMIT,
    default: PILATES_CLASS_PUBLIC_LIST_DEFAULT_LIMIT,
    minimum: 1,
    maximum: PILATES_CLASS_PUBLIC_LIST_MAX_LIMIT,
  })
  @Transform(optionalInteger)
  @IsOptional()
  @IsInt({
    message: 'limit must be an integer.',
  })
  @Min(1, {
    message: 'limit must be at least 1.',
  })
  @Max(PILATES_CLASS_PUBLIC_LIST_MAX_LIMIT, {
    message: `limit must not exceed ${PILATES_CLASS_PUBLIC_LIST_MAX_LIMIT}.`,
  })
  readonly limit: number = PILATES_CLASS_PUBLIC_LIST_DEFAULT_LIMIT;

  @ApiPropertyOptional({
    description: 'Number of public Pilates classes to skip.',
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
    description: 'Field used to sort public Pilates classes.',
    enum: PILATES_CLASS_SORT_FIELDS,
    example: PILATES_CLASS_DEFAULT_SORT_FIELD,
    default: PILATES_CLASS_DEFAULT_SORT_FIELD,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PILATES_CLASS_SORT_FIELDS, {
    message:
      'sort_by must be one of: title, status, level, created_at, updated_at.',
  })
  readonly sort_by: PilatesClassSortField = PILATES_CLASS_DEFAULT_SORT_FIELD;

  @ApiPropertyOptional({
    description: 'Sort direction.',
    enum: PILATES_CLASS_SORT_DIRECTIONS,
    example: PILATES_CLASS_DEFAULT_SORT_DIRECTION,
    default: PILATES_CLASS_DEFAULT_SORT_DIRECTION,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PILATES_CLASS_SORT_DIRECTIONS, {
    message: 'sort_direction must be either asc or desc.',
  })
  readonly sort_direction: PilatesClassSortDirection =
    PILATES_CLASS_DEFAULT_SORT_DIRECTION;
}
