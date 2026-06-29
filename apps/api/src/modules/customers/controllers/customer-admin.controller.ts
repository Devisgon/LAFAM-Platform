// apps/api/src/modules/customers/controllers/customer-admin.controller.ts
/**
 * LAFAM Customer admin controller.
 *
 * Role:
 * - Exposes protected admin Customer Module endpoints.
 * - Allows admins, super-admins, staff, and trainers to create, list, lookup,
 *   read, update, deactivate, reactivate, soft-delete, resend invitations, and
 *   revoke invitations.
 * - Keeps controller logic thin and delegates business rules to services.
 *
 * Important:
 * - AuthGuard resolves the Bearer token and attaches Auth context.
 * - ActiveSessionGuard rejects revoked, expired, deleted, deactivated, invited,
 *   and invalid guest sessions.
 * - RolesGuard enforces route-level admin/staff/trainer customer-management access.
 * - CustomerAdminService performs Customer Module business validation.
 * - CustomerInviteService performs customer invitation lifecycle validation.
 * - Controllers must not log raw access tokens, refresh tokens, passwords, OTPs,
 *   invite tokens, token hashes, or Civil ID values.
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import {
  createApiSuccessResponse,
  type ApiSuccessResponse,
} from '../../../common/responses/api-response';
import {
  AUTH_ADMIN_ROLE,
  AUTH_STAFF_ROLE,
  AUTH_SUPER_ADMIN_ROLE,
  AUTH_TRAINER_ROLE,
} from '../../auth/constants/auth-role.constants';
import { CurrentAuth } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ActiveSessionGuard } from '../../auth/guards/active-session.guard';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthInternalContext } from '../../auth/types/auth-context.types';
import { CustomerAdminService } from '../application/customer-admin.service';
import { CustomerInviteService } from '../application/customer-invite.service';
import {
  CUSTOMER_INVITATION_ID_PARAM,
  CUSTOMER_INVITATION_RESEND_ROUTE_SEGMENT,
  CUSTOMER_INVITATION_REVOKE_ROUTE_SEGMENT,
  CUSTOMER_INVITATION_ROUTE_SEGMENT,
} from '../constants/customer.constants';
import { CreateCustomerDto } from '../dto/create-customer.dto';
import { CustomerInviteParamDto } from '../dto/customer-invite-param.dto';
import { CustomerParamDto } from '../dto/customer-param.dto';
import { ListCustomersQueryDto } from '../dto/list-customers-query.dto';
import { LookupCustomerQueryDto } from '../dto/lookup-customer-query.dto';
import { UpdateCustomerDto } from '../dto/update-customer.dto';
import type {
  CustomerDeleteResult,
  CustomerInvitationMutationResult,
  CustomerListResult,
  CustomerLookupResult,
  CustomerMutationResult,
} from '../types/customer.types';

const CUSTOMER_ADMIN_ROUTE_PREFIX = 'admin/customers' as const;
const CUSTOMER_LOOKUP_ROUTE_SEGMENT = 'lookup' as const;

function resolveAuthContext(
  auth: AuthInternalContext | undefined,
): AuthInternalContext {
  if (!auth) {
    throw AppError.authenticationRequired('Authentication is required.');
  }

  return auth;
}

function resolveAdminActorId(auth: AuthInternalContext | undefined): string {
  return resolveAuthContext(auth).profile.id;
}

function resolveInvitationId(params: CustomerInviteParamDto): string {
  return params[CUSTOMER_INVITATION_ID_PARAM];
}

function resolveCreateCustomerMessage(
  data: CustomerMutationResult | CustomerInvitationMutationResult,
): string {
  if ('invitation' in data) {
    return 'Customer invitation created successfully.';
  }

  return 'Customer created successfully. The customer can log in immediately.';
}

@Controller(CUSTOMER_ADMIN_ROUTE_PREFIX)
@UseGuards(AuthGuard, ActiveSessionGuard, RolesGuard)
@Roles(
  AUTH_ADMIN_ROLE,
  AUTH_SUPER_ADMIN_ROLE,
  AUTH_STAFF_ROLE,
  AUTH_TRAINER_ROLE,
)
export class CustomerAdminController {
  constructor(
    private readonly customerAdminService: CustomerAdminService,
    private readonly customerInviteService: CustomerInviteService,
  ) {}

  @Get()
  async listCustomers(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Query() query: ListCustomersQueryDto,
  ): Promise<ApiSuccessResponse<CustomerListResult>> {
    const data = await this.customerAdminService.listCustomers(
      resolveAuthContext(auth),
      query,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Customers retrieved successfully.',
      data,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createCustomer(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Body() body: CreateCustomerDto,
  ): Promise<
    ApiSuccessResponse<
      CustomerMutationResult | CustomerInvitationMutationResult
    >
  > {
    const data = await this.customerAdminService.createCustomer(
      resolveAuthContext(auth),
      body,
    );

    return createApiSuccessResponse({
      status: HttpStatus.CREATED,
      message: resolveCreateCustomerMessage(data),
      data,
    });
  }

  @Get(CUSTOMER_LOOKUP_ROUTE_SEGMENT)
  async lookupCustomer(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Query() query: LookupCustomerQueryDto,
  ): Promise<ApiSuccessResponse<CustomerLookupResult>> {
    const data = await this.customerAdminService.lookupCustomer(
      resolveAuthContext(auth),
      query,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Customer lookup completed successfully.',
      data,
    });
  }

  @Post(
    `${CUSTOMER_INVITATION_ROUTE_SEGMENT}/:${CUSTOMER_INVITATION_ID_PARAM}/${CUSTOMER_INVITATION_RESEND_ROUTE_SEGMENT}`,
  )
  @HttpCode(HttpStatus.OK)
  async resendCustomerInvitation(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: CustomerInviteParamDto,
  ): Promise<ApiSuccessResponse<CustomerInvitationMutationResult>> {
    const data = await this.customerInviteService.resendCustomerInvitation({
      invitation_id: resolveInvitationId(params),
      resent_by_admin_id: resolveAdminActorId(auth),
    });

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Customer invitation resent successfully.',
      data,
    });
  }

  @Post(
    `${CUSTOMER_INVITATION_ROUTE_SEGMENT}/:${CUSTOMER_INVITATION_ID_PARAM}/${CUSTOMER_INVITATION_REVOKE_ROUTE_SEGMENT}`,
  )
  @HttpCode(HttpStatus.OK)
  async revokeCustomerInvitation(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: CustomerInviteParamDto,
  ): Promise<ApiSuccessResponse<CustomerInvitationMutationResult>> {
    const data = await this.customerInviteService.revokeCustomerInvitation({
      invitation_id: resolveInvitationId(params),
      revoked_by_admin_id: resolveAdminActorId(auth),
    });

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Customer invitation revoked successfully.',
      data,
    });
  }

  @Get(':customerId')
  async getCustomerById(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: CustomerParamDto,
  ): Promise<ApiSuccessResponse<CustomerMutationResult>> {
    const data = await this.customerAdminService.getCustomerById(
      resolveAuthContext(auth),
      params.customerId,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Customer retrieved successfully.',
      data,
    });
  }

  @Patch(':customerId')
  async updateCustomer(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: CustomerParamDto,
    @Body() body: UpdateCustomerDto,
  ): Promise<ApiSuccessResponse<CustomerMutationResult>> {
    const data = await this.customerAdminService.updateCustomer(
      resolveAuthContext(auth),
      params.customerId,
      body,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Customer updated successfully.',
      data,
    });
  }

  @Post(':customerId/deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivateCustomer(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: CustomerParamDto,
  ): Promise<ApiSuccessResponse<CustomerMutationResult>> {
    const data = await this.customerAdminService.deactivateCustomer(
      resolveAuthContext(auth),
      params.customerId,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Customer deactivated successfully.',
      data,
    });
  }

  @Post(':customerId/reactivate')
  @HttpCode(HttpStatus.OK)
  async reactivateCustomer(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: CustomerParamDto,
  ): Promise<ApiSuccessResponse<CustomerMutationResult>> {
    const data = await this.customerAdminService.reactivateCustomer(
      resolveAuthContext(auth),
      params.customerId,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Customer reactivated successfully.',
      data,
    });
  }

  @Delete(':customerId')
  @HttpCode(HttpStatus.OK)
  async deleteCustomer(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: CustomerParamDto,
  ): Promise<ApiSuccessResponse<CustomerDeleteResult>> {
    const data = await this.customerAdminService.deleteCustomer(
      resolveAuthContext(auth),
      params.customerId,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Customer deleted successfully.',
      data,
    });
  }
}
