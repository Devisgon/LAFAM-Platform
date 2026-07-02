// apps/api/src/modules/promo-codes/controllers/promo-code-admin.controller.ts
/**
 * LAFAM Promo Code admin controller.
 *
 * Role:
 * - Exposes protected admin/staff Promo Code Module endpoints.
 * - Allows admin/super-admin users to manage promo codes.
 * - Allows staff users to manage only promo codes permitted by PromoCodeAdminService and PromoCodePolicy.
 * - Allows authorized users to inspect promo-code redemption history.
 *
 * Important:
 * - AuthGuard resolves the Bearer token and attaches Auth context.
 * - ActiveSessionGuard rejects revoked, expired, deleted, deactivated, and invalid sessions.
 * - RolesGuard restricts these endpoints to admin, super-admin, and staff users.
 * - Controller does not calculate discounts.
 * - Controller does not reserve, redeem, or release promo-code redemptions.
 * - Controller does not create payments, confirm bookings, mutate wallets, or process refunds.
 * - Promo-code ownership, staff limits, and lifecycle rules remain inside services/domain policies.
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
} from '../../auth/constants/auth-role.constants';
import { CurrentAuth } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ActiveSessionGuard } from '../../auth/guards/active-session.guard';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthInternalContext } from '../../auth/types/auth-context.types';
import { PromoCodeAdminService } from '../application/promo-code-admin.service';
import { PROMO_CODE_ADMIN_ROUTE_PREFIX } from '../constants/promo-code.constants';
import { CreatePromoCodeDto } from '../dto/create-promo-code.dto';
import { ListPromoCodesQueryDto } from '../dto/list-promo-codes-query.dto';
import { ListPromoRedemptionsQueryDto } from '../dto/list-promo-redemptions-query.dto';
import { PromoCodeParamDto } from '../dto/promo-code-param.dto';
import { UpdatePromoCodeDto } from '../dto/update-promo-code.dto';
import type {
  PromoCodeActor,
  PromoCodeListResponse,
  PromoCodeRedemptionListResponse,
  PromoCodeResponse,
} from '../types/promo-code.types';

function resolveAuthContext(
  auth: AuthInternalContext | undefined,
): AuthInternalContext {
  if (!auth) {
    throw AppError.authenticationRequired('Authentication is required.');
  }

  return auth;
}

function resolveAuthenticatedPromoCodeActor(
  auth: AuthInternalContext | undefined,
): PromoCodeActor {
  const authContext = resolveAuthContext(auth);
  const role = authContext.profile.role;

  if (
    role === AUTH_ADMIN_ROLE ||
    role === AUTH_SUPER_ADMIN_ROLE ||
    role === AUTH_STAFF_ROLE
  ) {
    return {
      user_id: authContext.profile.id,
      role,
    };
  }

  throw AppError.promoCodeStaffLimitExceeded(
    'This role cannot access promo-code admin APIs.',
    {
      actor_user_id: authContext.profile.id,
      actor_role: role,
    },
  );
}

@Controller(PROMO_CODE_ADMIN_ROUTE_PREFIX)
@UseGuards(AuthGuard, ActiveSessionGuard, RolesGuard)
@Roles(AUTH_ADMIN_ROLE, AUTH_SUPER_ADMIN_ROLE, AUTH_STAFF_ROLE)
export class PromoCodeAdminController {
  constructor(private readonly promoCodeAdminService: PromoCodeAdminService) {}

  @Get()
  async listPromoCodes(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Query() query: ListPromoCodesQueryDto,
  ): Promise<ApiSuccessResponse<PromoCodeListResponse>> {
    const data = await this.promoCodeAdminService.listPromoCodes(
      resolveAuthenticatedPromoCodeActor(auth),
      query,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Promo codes retrieved successfully.',
      data,
    });
  }

  @Post()
  async createPromoCode(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Body() body: CreatePromoCodeDto,
  ): Promise<ApiSuccessResponse<PromoCodeResponse>> {
    const data = await this.promoCodeAdminService.createPromoCode(
      resolveAuthenticatedPromoCodeActor(auth),
      body,
    );

    return createApiSuccessResponse({
      status: HttpStatus.CREATED,
      message: 'Promo code created successfully.',
      data,
    });
  }

  @Get('redemptions')
  async listAllPromoCodeRedemptions(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Query() query: ListPromoRedemptionsQueryDto,
  ): Promise<ApiSuccessResponse<PromoCodeRedemptionListResponse>> {
    const data = await this.promoCodeAdminService.listPromoCodeRedemptions(
      resolveAuthenticatedPromoCodeActor(auth),
      query,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Promo-code redemptions retrieved successfully.',
      data,
    });
  }

  @Get(':promoCodeId')
  async getPromoCode(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: PromoCodeParamDto,
  ): Promise<ApiSuccessResponse<PromoCodeResponse>> {
    const data = await this.promoCodeAdminService.getPromoCode(
      resolveAuthenticatedPromoCodeActor(auth),
      params.promoCodeId,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Promo code retrieved successfully.',
      data,
    });
  }

  @Patch(':promoCodeId')
  async updatePromoCode(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: PromoCodeParamDto,
    @Body() body: UpdatePromoCodeDto,
  ): Promise<ApiSuccessResponse<PromoCodeResponse>> {
    const data = await this.promoCodeAdminService.updatePromoCode(
      resolveAuthenticatedPromoCodeActor(auth),
      params.promoCodeId,
      body,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Promo code updated successfully.',
      data,
    });
  }

  @Post(':promoCodeId/activate')
  @HttpCode(HttpStatus.OK)
  async activatePromoCode(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: PromoCodeParamDto,
  ): Promise<ApiSuccessResponse<PromoCodeResponse>> {
    const data = await this.promoCodeAdminService.activatePromoCode({
      promo_code_id: params.promoCodeId,
      actor: resolveAuthenticatedPromoCodeActor(auth),
    });

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Promo code activated successfully.',
      data,
    });
  }

  @Post(':promoCodeId/pause')
  @HttpCode(HttpStatus.OK)
  async pausePromoCode(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: PromoCodeParamDto,
  ): Promise<ApiSuccessResponse<PromoCodeResponse>> {
    const data = await this.promoCodeAdminService.pausePromoCode({
      promo_code_id: params.promoCodeId,
      actor: resolveAuthenticatedPromoCodeActor(auth),
    });

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Promo code paused successfully.',
      data,
    });
  }

  @Delete(':promoCodeId')
  @HttpCode(HttpStatus.OK)
  async deletePromoCode(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: PromoCodeParamDto,
  ): Promise<ApiSuccessResponse<PromoCodeResponse>> {
    const data = await this.promoCodeAdminService.deletePromoCode({
      promo_code_id: params.promoCodeId,
      actor: resolveAuthenticatedPromoCodeActor(auth),
    });

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Promo code deleted successfully.',
      data,
    });
  }

  @Get(':promoCodeId/redemptions')
  async listPromoCodeRedemptions(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: PromoCodeParamDto,
    @Query() query: ListPromoRedemptionsQueryDto,
  ): Promise<ApiSuccessResponse<PromoCodeRedemptionListResponse>> {
    const data = await this.promoCodeAdminService.listPromoCodeRedemptions(
      resolveAuthenticatedPromoCodeActor(auth),
      query,
      params.promoCodeId,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Promo-code redemptions retrieved successfully.',
      data,
    });
  }
}
