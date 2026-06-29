// apps/api/src/modules/customers/dto/customer-invite-param.dto.ts
/**
 * LAFAM Customer invite param DTO.
 *
 * Role:
 * - Validates customer invitation route parameters.
 * - Keeps admin invitation resend/revoke routes explicit and safe.
 *
 * Important:
 * - invitationId refers to public.customer_invitations.id.
 * - invitationId is not app_users.id.
 * - invitationId is not customer_profiles.id.
 * - invitationId is not auth.users.id.
 * - This DTO validates route parameter shape only.
 * - Service logic must verify invitation existence, status, ownership, expiry,
 *   and admin authorization.
 */

import { ApiProperty } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsUUID } from 'class-validator';

import { CUSTOMER_INVITATION_ID_PARAM } from '../constants/customer.constants';

function trimRouteParam({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CustomerInviteParamDto {
  @ApiProperty({
    description:
      'Customer invitation ID. This is public.customer_invitations.id, not app_users.id, customer_profiles.id, or auth.users.id.',
    example: '6f7a8d55-2d98-4b85-b9c7-1c9b8d4e5f10',
    format: 'uuid',
    name: CUSTOMER_INVITATION_ID_PARAM,
  })
  @Transform(trimRouteParam)
  @IsUUID('4', {
    message: `${CUSTOMER_INVITATION_ID_PARAM} must be a valid UUID.`,
  })
  readonly [CUSTOMER_INVITATION_ID_PARAM]!: string;
}
