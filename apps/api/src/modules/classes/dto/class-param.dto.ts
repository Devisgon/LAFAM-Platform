// apps/api/src/modules/classes/dto/class-param.dto.ts
/**
 * LAFAM Pilates class route parameter DTO.
 *
 * Role:
 * - Validates Pilates class UUID route params.
 * - Keeps controller route params explicit and type-safe.
 *
 * Used by:
 * - Admin Pilates class detail/update/delete endpoints.
 * - Public Pilates class detail endpoint.
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class PilatesClassParamDto {
  @ApiProperty({
    description: 'Pilates class identifier.',
    example: '9b5b8e3e-8e27-4f5d-a4f8-6f85f8b6f9f1',
    format: 'uuid',
  })
  @IsUUID('4', {
    message: 'classId must be a valid UUID.',
  })
  readonly classId!: string;
}
