// apps/api/src/modules/classes/dto/cancel-pilates-schedule.dto.ts
/**
 * LAFAM cancel Pilates schedule DTO.
 *
 * Role:
 * - Validates admin request body for cancelling a scheduled Pilates class occurrence.
 * - Captures a clear cancellation reason for audit/admin visibility.
 *
 * Important:
 * - This DTO does not delete the schedule.
 * - Cancelled schedules remain in history.
 * - Booking refunds/notifications will be handled later by Booking/Payment/Notification modules.
 */

import { ApiProperty } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

import {
  PILATES_CLASS_CANCELLATION_REASON_MAX_LENGTH,
  PILATES_CLASS_CANCELLATION_REASON_MIN_LENGTH,
} from '../constants/pilates-class.constants';

function requiredTrimmedString({ value }: TransformFnParams): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
}

export class CancelPilatesScheduleDto {
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
