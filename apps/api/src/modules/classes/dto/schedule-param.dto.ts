// apps/api/src/modules/classes/dto/schedule-param.dto.ts
/**
 * LAFAM Pilates schedule route parameter DTO.
 *
 * Role:
 * - Validates Pilates class schedule UUID route params.
 * - Keeps controller route params explicit and type-safe.
 *
 * Used by:
 * - Admin Pilates schedule detail/update/cancel/delete endpoints.
 * - Public Pilates schedule detail endpoint.
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class PilatesScheduleParamDto {
  @ApiProperty({
    description: 'Pilates class schedule identifier.',
    example: 'b4a1fb6a-7a7d-4b3f-a0ef-7f4d5c5e4e91',
    format: 'uuid',
  })
  @IsUUID('4', {
    message: 'scheduleId must be a valid UUID.',
  })
  readonly scheduleId!: string;
}
