// apps/api/src/modules/staff/dto/staff-param.dto.ts
/**
 * LAFAM Staff param DTO.
 *
 * Role:
 * - Validates the staffId route parameter for Staff admin endpoints.
 * - Keeps route-param validation explicit and controller-safe.
 *
 * Important:
 * - This DTO validates only the route parameter shape.
 * - This DTO does not check whether the staff record exists.
 * - This DTO does not decide authorization.
 * - The Staff admin service must verify staff existence.
 * - Auth guards and role guards must enforce admin-only access.
 */

import { IsUUID } from 'class-validator';

export class StaffParamDto {
  @IsUUID('4', {
    message: 'staffId must be a valid UUID.',
  })
  readonly staffId!: string;
}
