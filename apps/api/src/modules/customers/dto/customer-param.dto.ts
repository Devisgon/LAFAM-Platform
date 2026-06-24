// apps/api/src/modules/customers/dto/customer-param.dto.ts
/**
 * LAFAM Customer route param DTO.
 *
 * Role:
 * - Validates customer profile route parameters for admin customer endpoints.
 * - Keeps controller param validation explicit and consistent.
 *
 * Important:
 * - customerId refers to public.customer_profiles.id.
 * - customerId is not app_users.id.
 * - customerId is not auth.users.id.
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CustomerParamDto {
  @ApiProperty({
    description:
      'Customer profile ID. This is public.customer_profiles.id, not app_users.id or auth.users.id.',
    example: '0a5f9d6f-3e8b-4b9f-9f1a-2f6b7c8d9e10',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'customerId must be a valid UUID.' })
  readonly customerId!: string;
}
