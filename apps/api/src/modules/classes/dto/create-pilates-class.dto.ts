// apps/api/src/modules/classes/dto/create-pilates-class.dto.ts
/**
 * LAFAM create Pilates class DTO.
 *
 * Role:
 * - Validates admin request body for creating reusable Pilates class definitions.
 * - Keeps class definition separate from scheduled bookable class occurrences.
 *
 * Important:
 * - This DTO creates the class template only.
 * - It does not create schedules.
 * - It does not assign trainer/time/date directly.
 * - Trainer/date/time belong to pilates_class_schedules.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import {
  PILATES_CLASS_CAPACITY_MAX,
  PILATES_CLASS_CAPACITY_MIN,
  PILATES_CLASS_CREATE_ALLOWED_STATUSES,
  PILATES_CLASS_DEFAULT_CAPACITY,
  PILATES_CLASS_DEFAULT_CURRENCY,
  PILATES_CLASS_DEFAULT_DURATION_MINUTES,
  PILATES_CLASS_DEFAULT_PRICE_AMOUNT,
  PILATES_CLASS_DEFAULT_LEVEL,
  PILATES_CLASS_DESCRIPTION_MAX_LENGTH,
  PILATES_CLASS_DURATION_MAX_MINUTES,
  PILATES_CLASS_DURATION_MIN_MINUTES,
  PILATES_CLASS_LEVELS,
  PILATES_CLASS_ALLOWED_CURRENCIES,
  PILATES_CLASS_PRICE_AMOUNT_MIN,
  PILATES_CLASS_PRICE_DECIMAL_PLACES,
  PILATES_CLASS_STATUS_DRAFT,
  PILATES_CLASS_TITLE_MAX_LENGTH,
  PILATES_CLASS_TITLE_MIN_LENGTH,
  type PilatesClassCreateAllowedStatus,
  type PilatesClassLevel,
  type PilatesClassCurrency,
} from '../constants/pilates-class.constants';

function requiredTrimmedString({ value }: TransformFnParams): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
}

function optionalTrimmedStringOrNull({ value }: TransformFnParams): unknown {
  if (typeof value === 'undefined') {
    return undefined;
  }

  if (value === null) {
    return null;
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

export class CreatePilatesClassDto {
  @ApiProperty({
    description: 'Reusable Pilates class title.',
    example: 'Reformer Pilates',
    minLength: PILATES_CLASS_TITLE_MIN_LENGTH,
    maxLength: PILATES_CLASS_TITLE_MAX_LENGTH,
  })
  @Transform(requiredTrimmedString)
  @IsString({
    message: 'title must be a string.',
  })
  @MinLength(PILATES_CLASS_TITLE_MIN_LENGTH, {
    message: `title must be at least ${PILATES_CLASS_TITLE_MIN_LENGTH} character long.`,
  })
  @MaxLength(PILATES_CLASS_TITLE_MAX_LENGTH, {
    message: `title must not exceed ${PILATES_CLASS_TITLE_MAX_LENGTH} characters.`,
  })
  readonly title!: string;

  @ApiPropertyOptional({
    description: 'Customer-visible Pilates class description.',
    example:
      'A low-impact full-body reformer session focused on strength and balance.',
    maxLength: PILATES_CLASS_DESCRIPTION_MAX_LENGTH,
    nullable: true,
  })
  @Transform(optionalTrimmedStringOrNull)
  @IsOptional()
  @IsString({
    message: 'description must be a string.',
  })
  @MaxLength(PILATES_CLASS_DESCRIPTION_MAX_LENGTH, {
    message: `description must not exceed ${PILATES_CLASS_DESCRIPTION_MAX_LENGTH} characters.`,
  })
  readonly description?: string | null;

  @ApiPropertyOptional({
    description:
      'Default duration in minutes. Schedules can override this value when needed.',
    example: PILATES_CLASS_DEFAULT_DURATION_MINUTES,
    default: PILATES_CLASS_DEFAULT_DURATION_MINUTES,
    minimum: PILATES_CLASS_DURATION_MIN_MINUTES,
    maximum: PILATES_CLASS_DURATION_MAX_MINUTES,
  })
  @Transform(optionalInteger)
  @IsOptional()
  @IsInt({
    message: 'default_duration_minutes must be an integer.',
  })
  @Min(PILATES_CLASS_DURATION_MIN_MINUTES, {
    message: `default_duration_minutes must be at least ${PILATES_CLASS_DURATION_MIN_MINUTES}.`,
  })
  @Max(PILATES_CLASS_DURATION_MAX_MINUTES, {
    message: `default_duration_minutes must not exceed ${PILATES_CLASS_DURATION_MAX_MINUTES}.`,
  })
  readonly default_duration_minutes?: number =
    PILATES_CLASS_DEFAULT_DURATION_MINUTES;

  @ApiPropertyOptional({
    description:
      'Default capacity for scheduled occurrences. Schedules can override this value when needed.',
    example: PILATES_CLASS_DEFAULT_CAPACITY,
    default: PILATES_CLASS_DEFAULT_CAPACITY,
    minimum: PILATES_CLASS_CAPACITY_MIN,
    maximum: PILATES_CLASS_CAPACITY_MAX,
  })
  @Transform(optionalInteger)
  @IsOptional()
  @IsInt({
    message: 'default_capacity must be an integer.',
  })
  @Min(PILATES_CLASS_CAPACITY_MIN, {
    message: `default_capacity must be at least ${PILATES_CLASS_CAPACITY_MIN}.`,
  })
  @Max(PILATES_CLASS_CAPACITY_MAX, {
    message: `default_capacity must not exceed ${PILATES_CLASS_CAPACITY_MAX}.`,
  })
  readonly default_capacity?: number = PILATES_CLASS_DEFAULT_CAPACITY;

  @ApiPropertyOptional({
    description: 'Default price for new schedules.',
    example: 15,
    default: PILATES_CLASS_DEFAULT_PRICE_AMOUNT,
    minimum: PILATES_CLASS_PRICE_AMOUNT_MIN,
  })
  @Transform(optionalDecimal)
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: PILATES_CLASS_PRICE_DECIMAL_PLACES },
    {
      message: `default_price_amount must be a number with no more than ${PILATES_CLASS_PRICE_DECIMAL_PLACES} decimal places.`,
    },
  )
  @Min(PILATES_CLASS_PRICE_AMOUNT_MIN, {
    message: `default_price_amount must be at least ${PILATES_CLASS_PRICE_AMOUNT_MIN}.`,
  })
  readonly default_price_amount?: number = PILATES_CLASS_DEFAULT_PRICE_AMOUNT;

  @ApiPropertyOptional({
    description: 'Class currency. Current Payment Module supports KWD only.',
    enum: PILATES_CLASS_ALLOWED_CURRENCIES,
    example: PILATES_CLASS_DEFAULT_CURRENCY,
    default: PILATES_CLASS_DEFAULT_CURRENCY,
  })
  @Transform(optionalTrimmedStringOrNull)
  @IsOptional()
  @IsIn(PILATES_CLASS_ALLOWED_CURRENCIES, {
    message: 'currency must be KWD.',
  })
  readonly currency?: PilatesClassCurrency = PILATES_CLASS_DEFAULT_CURRENCY;

  @ApiPropertyOptional({
    description: 'Pilates class difficulty level.',
    enum: PILATES_CLASS_LEVELS,
    example: PILATES_CLASS_DEFAULT_LEVEL,
    default: PILATES_CLASS_DEFAULT_LEVEL,
  })
  @Transform(optionalTrimmedStringOrNull)
  @IsOptional()
  @IsIn(PILATES_CLASS_LEVELS, {
    message:
      'level must be one of: beginner, intermediate, advanced, all_levels.',
  })
  readonly level?: PilatesClassLevel = PILATES_CLASS_DEFAULT_LEVEL;

  @ApiPropertyOptional({
    description:
      'Initial class status. Deleted is not allowed during creation.',
    enum: PILATES_CLASS_CREATE_ALLOWED_STATUSES,
    example: PILATES_CLASS_STATUS_DRAFT,
    default: PILATES_CLASS_STATUS_DRAFT,
  })
  @Transform(optionalTrimmedStringOrNull)
  @IsOptional()
  @IsIn(PILATES_CLASS_CREATE_ALLOWED_STATUSES, {
    message: 'status must be one of: draft, active, inactive.',
  })
  readonly status?: PilatesClassCreateAllowedStatus =
    PILATES_CLASS_STATUS_DRAFT;
}
