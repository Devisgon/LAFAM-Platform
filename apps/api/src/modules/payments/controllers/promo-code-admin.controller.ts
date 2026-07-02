import {
  Body,
  Controller,
  Delete,
  Get,
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
  AUTH_SUPER_ADMIN_ROLE,
} from '../../auth/constants/auth-role.constants';
import { CurrentAuth } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ActiveSessionGuard } from '../../auth/guards/active-session.guard';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthInternalContext } from '../../auth/types/auth-context.types';
import {
  PromoCodeAdminService,
  type PromoCodeListResponse,
  type PromoCodeRedemptionListResponse,
  type PromoCodeSummary,
} from '../application/promo-code-admin.service';
import { CreatePromoCodeDto } from '../dto/create-promo-code.dto';
import { ListPromoCodeRedemptionsQueryDto } from '../dto/list-promo-code-redemptions-query.dto';
import { ListPromoCodesQueryDto } from '../dto/list-promo-codes-query.dto';
import { PromoCodeParamDto } from '../dto/promo-code-param.dto';
import { UpdatePromoCodeDto } from '../dto/update-promo-code.dto';
import {
  PaymentRateLimit,
  PaymentRateLimitGuard,
} from '../guards/payment-rate-limit.guard';
import { PAYMENT_RATE_LIMIT_PAYMENT_READ } from '../constants/payment.constants';

interface PromoCodeMutationResponse {
  readonly promo_code: PromoCodeSummary;
}

function resolveAuthenticatedAdminId(
  auth: AuthInternalContext | undefined,
): string {
  if (!auth) {
    throw AppError.authenticationRequired('Authentication is required.');
  }

  return auth.profile.id;
}

@Controller('admin/promo-codes')
@UseGuards(AuthGuard, ActiveSessionGuard, RolesGuard, PaymentRateLimitGuard)
@Roles(AUTH_ADMIN_ROLE, AUTH_SUPER_ADMIN_ROLE)
export class PromoCodeAdminController {
  constructor(private readonly promoCodeAdminService: PromoCodeAdminService) {}

  @Get()
  @PaymentRateLimit(PAYMENT_RATE_LIMIT_PAYMENT_READ)
  async listPromoCodes(
    @Query() query: ListPromoCodesQueryDto,
  ): Promise<ApiSuccessResponse<PromoCodeListResponse>> {
    const data = await this.promoCodeAdminService.listPromoCodes({
      created_by_admin_id: query.created_by_admin_id,
      discount_type: query.discount_type,
      ends_from: query.ends_from,
      ends_to: query.ends_to,
      include_deleted: query.include_deleted,
      limit: query.limit,
      offset: query.offset,
      search: query.search,
      sort_by: query.sort_by,
      sort_direction: query.sort_direction,
      starts_from: query.starts_from,
      starts_to: query.starts_to,
      status: query.status,
    });

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Promo codes retrieved successfully.',
      data,
    });
  }

  @Post()
  @PaymentRateLimit(PAYMENT_RATE_LIMIT_PAYMENT_READ)
  async createPromoCode(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Body() body: CreatePromoCodeDto,
  ): Promise<ApiSuccessResponse<PromoCodeMutationResponse>> {
    const data = await this.promoCodeAdminService.createPromoCode({
      admin_user_id: resolveAuthenticatedAdminId(auth),
      payload: body,
    });

    return createApiSuccessResponse({
      status: HttpStatus.CREATED,
      message: 'Promo code created successfully.',
      data,
    });
  }

  @Get(':promoCodeId/redemptions')
  @PaymentRateLimit(PAYMENT_RATE_LIMIT_PAYMENT_READ)
  async listPromoCodeRedemptions(
    @Param() params: PromoCodeParamDto,
    @Query() query: ListPromoCodeRedemptionsQueryDto,
  ): Promise<ApiSuccessResponse<PromoCodeRedemptionListResponse>> {
    const data = await this.promoCodeAdminService.listPromoCodeRedemptions({
      promo_code_id: params.promoCodeId,
      query: {
        booking_id: query.booking_id,
        booking_order_id: query.booking_order_id,
        from_date: query.from_date,
        limit: query.limit,
        offset: query.offset,
        payment_id: query.payment_id,
        private_booking_id: query.private_booking_id,
        sort_by: query.sort_by,
        sort_direction: query.sort_direction,
        status: query.status,
        target_type: query.target_type,
        to_date: query.to_date,
        user_id: query.user_id,
      },
    });

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Promo code redemptions retrieved successfully.',
      data,
    });
  }

  @Get(':promoCodeId')
  @PaymentRateLimit(PAYMENT_RATE_LIMIT_PAYMENT_READ)
  async getPromoCode(
    @Param() params: PromoCodeParamDto,
  ): Promise<ApiSuccessResponse<PromoCodeSummary>> {
    const data = await this.promoCodeAdminService.getPromoCode({
      promo_code_id: params.promoCodeId,
    });

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Promo code retrieved successfully.',
      data,
    });
  }

  @Patch(':promoCodeId')
  @PaymentRateLimit(PAYMENT_RATE_LIMIT_PAYMENT_READ)
  async updatePromoCode(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: PromoCodeParamDto,
    @Body() body: UpdatePromoCodeDto,
  ): Promise<ApiSuccessResponse<PromoCodeMutationResponse>> {
    const data = await this.promoCodeAdminService.updatePromoCode({
      admin_user_id: resolveAuthenticatedAdminId(auth),
      promo_code_id: params.promoCodeId,
      payload: body,
    });

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Promo code updated successfully.',
      data,
    });
  }

  @Post(':promoCodeId/activate')
  @PaymentRateLimit(PAYMENT_RATE_LIMIT_PAYMENT_READ)
  async activatePromoCode(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: PromoCodeParamDto,
  ): Promise<ApiSuccessResponse<PromoCodeMutationResponse>> {
    const data = await this.promoCodeAdminService.activatePromoCode({
      admin_user_id: resolveAuthenticatedAdminId(auth),
      promo_code_id: params.promoCodeId,
    });

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Promo code activated successfully.',
      data,
    });
  }

  @Post(':promoCodeId/pause')
  @PaymentRateLimit(PAYMENT_RATE_LIMIT_PAYMENT_READ)
  async pausePromoCode(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: PromoCodeParamDto,
  ): Promise<ApiSuccessResponse<PromoCodeMutationResponse>> {
    const data = await this.promoCodeAdminService.pausePromoCode({
      admin_user_id: resolveAuthenticatedAdminId(auth),
      promo_code_id: params.promoCodeId,
    });

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Promo code paused successfully.',
      data,
    });
  }

  @Delete(':promoCodeId')
  @PaymentRateLimit(PAYMENT_RATE_LIMIT_PAYMENT_READ)
  async deletePromoCode(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: PromoCodeParamDto,
  ): Promise<ApiSuccessResponse<PromoCodeMutationResponse>> {
    const data = await this.promoCodeAdminService.softDeletePromoCode({
      admin_user_id: resolveAuthenticatedAdminId(auth),
      promo_code_id: params.promoCodeId,
    });

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Promo code deleted successfully.',
      data,
    });
  }
}
