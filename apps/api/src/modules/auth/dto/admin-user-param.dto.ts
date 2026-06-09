// apps/api/src/modules/auth/dto/admin-user-param.dto.ts
/**
 * LAFAM Auth admin-user param DTO.
 *
 * Role:
 * - Validates the userId route parameter for admin user-management endpoints.
 * - Keeps admin route-param validation explicit and controller-safe.
 *
 * Important:
 * - This DTO validates only the route parameter shape.
 * - Auth admin service must enforce role permissions.
 * - Admin users must not be allowed to deactivate, reactivate, or hard-delete users without proper authorization.
 */

import { IsUUID } from 'class-validator';

export class AdminUserParamDto {
  @IsUUID('4', {
    message: 'userId must be a valid UUID.',
  })
  readonly userId!: string;
}
