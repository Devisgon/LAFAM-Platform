// apps/api/src/modules/auth/dto/revoke-session-param.dto.ts
/**
 * LAFAM Auth revoke-session param DTO.
 *
 * Role:
 * - Validates the sessionId route parameter for session revocation.
 * - Keeps route-param validation explicit and controller-safe.
 *
 * Important:
 * - This DTO validates only the route parameter shape.
 * - The Auth session service must verify ownership and revocation eligibility.
 * - Users must not be allowed to revoke sessions that do not belong to them.
 */

import { IsUUID } from 'class-validator';

export class RevokeSessionParamDto {
  @IsUUID('4', {
    message: 'sessionId must be a valid UUID.',
  })
  readonly sessionId!: string;
}
