// apps/api/src/modules/promo-codes/dto/promo-code-param.dto.ts
/**
 * LAFAM Promo Code Module route-parameter DTOs.
 *
 * Role:
 * - Validates promo-code route parameters at the controller boundary.
 * - Keeps route identifiers explicit and aligned with Swagger path parameter names.
 *
 * Important:
 * - Route params are not trusted input.
 * - Controllers must use this DTO before passing IDs into services.
 * - Services and repositories must still enforce ownership, role, and lifecycle rules.
 */

import { IsUUID } from 'class-validator';

export class PromoCodeParamDto {
  @IsUUID('4', {
    message: 'promoCodeId must be a valid UUID.',
  })
  promoCodeId!: string;
}
