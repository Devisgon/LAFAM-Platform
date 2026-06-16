// apps/api/src/modules/bookings/dto/private-booking-param.dto.ts
/**
 * LAFAM private booking param DTOs.
 *
 * Role:
 * - Validates route parameters for private trainer booking endpoints.
 * - Keeps private booking id and trainer id validation centralized.
 *
 * Important:
 * - These DTOs validate route params only.
 * - They do not perform ownership checks.
 * - They do not check booking status.
 * - Authorization and business rules belong in service logic.
 */

import { ApiProperty } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsUUID } from 'class-validator';

import {
  BOOKING_UUID_VERSION,
  PRIVATE_BOOKING_ID_PARAM_NAME,
  PRIVATE_BOOKING_TRAINER_ID_PARAM_NAME,
} from '../constants/booking.constants';

function requiredTrimmedString({ value }: TransformFnParams): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
}

export class PrivateBookingParamDto {
  @ApiProperty({
    description: 'Private trainer booking identifier.',
    example: 'd45d7b45-f5e9-45e4-85da-0e68f1c9a700',
    format: 'uuid',
    name: PRIVATE_BOOKING_ID_PARAM_NAME,
  })
  @Transform(requiredTrimmedString)
  @IsUUID(BOOKING_UUID_VERSION, {
    message: `${PRIVATE_BOOKING_ID_PARAM_NAME} must be a valid UUID.`,
  })
  readonly [PRIVATE_BOOKING_ID_PARAM_NAME]!: string;
}

export class PrivateBookingTrainerParamDto {
  @ApiProperty({
    description: 'Trainer staff profile identifier.',
    example: '4df33c73-4fd5-46bb-a7a5-f5a9914de18a',
    format: 'uuid',
    name: PRIVATE_BOOKING_TRAINER_ID_PARAM_NAME,
  })
  @Transform(requiredTrimmedString)
  @IsUUID(BOOKING_UUID_VERSION, {
    message: `${PRIVATE_BOOKING_TRAINER_ID_PARAM_NAME} must be a valid UUID.`,
  })
  readonly [PRIVATE_BOOKING_TRAINER_ID_PARAM_NAME]!: string;
}
