// apps/api/src/modules/classes/dto/update-pilates-class.dto.ts
/**
 * LAFAM update Pilates class DTO.
 *
 * Role:
 * - Validates admin request body for updating reusable Pilates class definitions.
 * - Allows partial updates while keeping deleted state controlled by service logic.
 *
 * Important:
 * - This DTO updates the class template only.
 * - It does not update scheduled occurrences.
 * - Deleted status is not accepted through normal update.
 * - Soft delete must be handled by the dedicated delete endpoint/service method.
 * - Class-level default price and currency are allowed here because schedules can
 *   fall back to class defaults when schedule-level pricing is not provided.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
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
  PILATES_CLASS_ALLOWED_CURRENCIES,
  PILATES_CLASS_DEFAULT_CURRENCY,
  PILATES_CLASS_DESCRIPTION_MAX_LENGTH,
  PILATES_CLASS_DURATION_MAX_MINUTES,
  PILATES_CLASS_DURATION_MIN_MINUTES,
  PILATES_CLASS_LEVELS,
  PILATES_CLASS_PRICE_DECIMAL_PLACES,
  PILATES_CLASS_PRICE_AMOUNT_MIN,
  PILATES_CLASS_TITLE_MAX_LENGTH,
  PILATES_CLASS_TITLE_MIN_LENGTH,
  PILATES_CLASS_UPDATE_ALLOWED_STATUSES,
  type PilatesClassCurrency,
  type PilatesClassLevel,
  type PilatesClassUpdateAllowedStatus,
} from '../constants/pilates-class.constants';

function optionalTrimmedString({ value }: TransformFnParams): unknown {
  if (typeof value === 'undefined') {
    return undefined;
  }

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

  if (normalizedValue === 'true') {
    return true;
  }

  if (normalizedValue === 'false') {
    return false;
  }

  return value;
}

export class UpdatePilatesClassDto {
  @ApiPropertyOptional({
    description: 'Reusable Pilates class title.',
    example: 'Reformer Pilates',
    minLength: PILATES_CLASS_TITLE_MIN_LENGTH,
    maxLength: PILATES_CLASS_TITLE_MAX_LENGTH,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsString({
    message: 'title must be a string.',
  })
  @MinLength(PILATES_CLASS_TITLE_MIN_LENGTH, {
    message: `title must be at least ${PILATES_CLASS_TITLE_MIN_LENGTH} character long.`,
  })
  @MaxLength(PILATES_CLASS_TITLE_MAX_LENGTH, {
    message: `title must not exceed ${PILATES_CLASS_TITLE_MAX_LENGTH} characters.`,
  })
  readonly title?: string;

  @ApiPropertyOptional({
    description:
      'Customer-visible Pilates class description. Send null to clear it.',
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
      'Default duration in minutes. Existing schedules are not automatically changed.',
    example: 60,
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
  readonly default_duration_minutes?: number;

  @ApiPropertyOptional({
    description:
      'Default capacity for new scheduled occurrences. Existing schedules are not automatically changed.',
    example: 8,
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
  readonly default_capacity?: number;

  @ApiPropertyOptional({
    description: 'Default price for new schedules.',
    example: 15,
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
  readonly default_price_amount?: number;

  @ApiPropertyOptional({
    description: 'Class currency. Current Payment Module supports KWD only.',
    enum: PILATES_CLASS_ALLOWED_CURRENCIES,
    example: PILATES_CLASS_DEFAULT_CURRENCY,
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PILATES_CLASS_ALLOWED_CURRENCIES, {
    message: 'currency must be KWD.',
  })
  readonly currency?: PilatesClassCurrency;

  @ApiPropertyOptional({
    description: 'Pilates class difficulty level.',
    enum: PILATES_CLASS_LEVELS,
    example: 'all_levels',
  })
  @Transform(optionalTrimmedStringOrNull)
  @IsOptional()
  @IsIn(PILATES_CLASS_LEVELS, {
    message:
      'level must be one of: beginner, intermediate, advanced, all_levels.',
  })
  readonly level?: PilatesClassLevel;

  @ApiPropertyOptional({
    description: 'Class status. Deleted is not allowed through normal update.',
    enum: PILATES_CLASS_UPDATE_ALLOWED_STATUSES,
    example: 'active',
  })
  @Transform(optionalTrimmedStringOrNull)
  @IsOptional()
  @IsIn(PILATES_CLASS_UPDATE_ALLOWED_STATUSES, {
    message: 'status must be one of: draft, active, inactive.',
  })
  readonly status?: PilatesClassUpdateAllowedStatus;

  @ApiPropertyOptional({
    description:
      'Set to true to remove the existing Pilates class image. Cannot be used together with an uploaded image file.',
    example: false,
    default: false,
  })
  @Transform(optionalBoolean)
  @IsOptional()
  @IsBoolean({
    message: 'remove_image must be a boolean.',
  })
  readonly remove_image?: boolean;
}
