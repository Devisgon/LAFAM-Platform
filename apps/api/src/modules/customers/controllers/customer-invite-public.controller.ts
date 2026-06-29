// apps/api/src/modules/customers/controllers/customer-invite-public.controller.ts
/**
 * LAFAM Customer invitation public controller.
 *
 * Role:
 * - Exposes the public customer invite acceptance endpoint.
 * - Accepts the raw invite token from the customer-facing invite link.
 * - Delegates all invite validation, password policy checks, Supabase password
 *   setting, customer activation, and invitation acceptance to CustomerInviteService.
 *
 * Important:
 * - This controller is intentionally public because invited customers do not have
 *   an authenticated session yet.
 * - Public does not mean permissive. DTO validation and service-level token checks
 *   still apply.
 * - Controllers must stay thin and must not hash tokens, set passwords, mutate
 *   app_users, or update invitation state directly.
 * - Raw invite tokens, passwords, token hashes, Civil ID values, access tokens,
 *   refresh tokens, and provider secrets must never be logged.
 */

import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

import {
  createApiSuccessResponse,
  type ApiSuccessResponse,
} from '../../../common/responses/api-response';
import { PublicRoute } from '../../auth/decorators/public-route.decorator';
import { CustomerInviteService } from '../application/customer-invite.service';
import {
  CUSTOMER_INVITATION_ACCEPT_ROUTE_SEGMENT,
  CUSTOMER_INVITATION_PUBLIC_ROUTE_PREFIX,
} from '../constants/customer.constants';
import { AcceptCustomerInviteDto } from '../dto/accept-customer-invite.dto';
import type { CustomerInvitationAcceptResult } from '../types/customer.types';

@PublicRoute()
@Controller(CUSTOMER_INVITATION_PUBLIC_ROUTE_PREFIX)
export class CustomerInvitePublicController {
  constructor(private readonly customerInviteService: CustomerInviteService) {}

  @Post(CUSTOMER_INVITATION_ACCEPT_ROUTE_SEGMENT)
  @HttpCode(HttpStatus.OK)
  async acceptCustomerInvitation(
    @Body() body: AcceptCustomerInviteDto,
  ): Promise<ApiSuccessResponse<CustomerInvitationAcceptResult>> {
    const data =
      await this.customerInviteService.acceptCustomerInvitation(body);

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Customer invitation accepted successfully.',
      data,
    });
  }
}
