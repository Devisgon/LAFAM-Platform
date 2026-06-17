// apps/api/src/modules/classes/dto/cancel-pilates-schedule.dto.ts
/**
 * LAFAM cancel Pilates schedule DTO.
 *
 * Role:
 * - Validates admin request body for cancelling a scheduled Pilates class occurrence.
 * - Captures a clear cancellation reason for audit/admin visibility.
 * - Accepts update_scope for recurring schedule awareness.
 *
 * Important:
 * - This DTO does not delete the schedule.
 * - Cancelled schedules remain in history.
 * - For now, service logic may enforce occurrence-level cancellation only.
 * - Booking refunds/notifications will be handled later by Booking/Payment/Notification modules.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import {
  PILATES_CLASS_CANCELLATION_REASON_MAX_LENGTH,
  PILATES_CLASS_CANCELLATION_REASON_MIN_LENGTH,
  PILATES_SCHEDULE_DEFAULT_UPDATE_SCOPE,
  PILATES_SCHEDULE_UPDATE_SCOPES,
} from '../constants/pilates-class.constants';
import type { PilatesScheduleUpdateScope } from '../constants/pilates-class.constants';

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

export class CancelPilatesScheduleDto {
  @ApiPropertyOptional({
    description:
      'Recurring cancellation scope. Omit this field for backward-compatible occurrence-level cancellation.',
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

  @ApiProperty({
    description:
      'Reason for cancelling the Pilates schedule. Stored for admin/audit visibility.',
    example: 'Trainer is unavailable due to emergency.',
    minLength: PILATES_CLASS_CANCELLATION_REASON_MIN_LENGTH,
    maxLength: PILATES_CLASS_CANCELLATION_REASON_MAX_LENGTH,
  })
  @Transform(requiredTrimmedString)
  @IsString({
    message: 'cancellation_reason must be a string.',
  })
  @MinLength(PILATES_CLASS_CANCELLATION_REASON_MIN_LENGTH, {
    message: `cancellation_reason must be at least ${PILATES_CLASS_CANCELLATION_REASON_MIN_LENGTH} character long.`,
  })
  @MaxLength(PILATES_CLASS_CANCELLATION_REASON_MAX_LENGTH, {
    message: `cancellation_reason must not exceed ${PILATES_CLASS_CANCELLATION_REASON_MAX_LENGTH} characters.`,
  })
  readonly cancellation_reason!: string;
}
