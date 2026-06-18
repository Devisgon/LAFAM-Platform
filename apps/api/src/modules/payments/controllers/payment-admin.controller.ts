// apps/api/src/modules/payments/controllers/payment-admin.controller.ts
/**
 * LAFAM admin payment controller.
 *
 * Role:
 * - Exposes protected admin Payment Module endpoints.
 * - Allows admin/super-admin users to list all payments.
 * - Allows admin/super-admin users to read payment details.
 * - Allows admin/super-admin users to inspect payment transactions.
 * - Allows admin/super-admin users to request refunds with audit reason.
 * - Allows admin/super-admin users to expire unpaid payment intents.
 *
 * Important:
 * - AuthGuard resolves the Bearer token and attaches Auth context.
 * - ActiveSessionGuard rejects revoked, expired, deleted, deactivated, and invalid sessions.
 * - RolesGuard restricts these endpoints to admin/super-admin users.
 * - PaymentRateLimitGuard applies route-specific payment throttling.
 * - Admin refund must always include an audit reason.
 * - Controller does not directly mutate payment, wallet, booking, or provider state.
 * - Refund mutation remains inside PaymentAdminService and atomic database RPCs.
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import {
  createApiSuccessResponse,
  type ApiSuccessResponse,
} from '../../../common/responses/api-response';
import type {
  DatabaseJson,
  DatabaseJsonObject,
} from '../../../database/database.types';
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
import { PaymentAdminService } from '../application/payment-admin.service';
import {
  PAYMENT_ADMIN_ROUTE_PREFIX,
  PAYMENT_RATE_LIMIT_ADMIN_REFUND,
  PAYMENT_RATE_LIMIT_PAYMENT_READ,
} from '../constants/payment.constants';
import { ListPaymentsQueryDto } from '../dto/list-payments-query.dto';
import { ListPaymentTransactionsQueryDto } from '../dto/list-payments-query.dto';
import { PaymentParamDto } from '../dto/payment-param.dto';
import { RefundPaymentDto } from '../dto/refund-payment.dto';
import {
  PaymentRateLimit,
  PaymentRateLimitGuard,
} from '../guards/payment-rate-limit.guard';
import type {
  PaymentDetailResponse,
  PaymentListResponse,
  PaymentPaginatedResult,
  PaymentRefundResponse,
  PaymentSummary,
  PaymentTransactionSummary,
} from '../types/payment.types';

interface ExpireUnpaidPaymentsResponse {
  readonly expired_payments: readonly PaymentSummary[];
}

function resolveAuthContext(
  auth: AuthInternalContext | undefined,
): AuthInternalContext {
  if (!auth) {
    throw AppError.authenticationRequired('Authentication is required.');
  }

  return auth;
}

function resolveAuthenticatedAdminId(
  auth: AuthInternalContext | undefined,
): string {
  return resolveAuthContext(auth).profile.id;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDatabaseJson(value: unknown): value is DatabaseJson {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isDatabaseJson);
  }

  if (!isPlainRecord(value)) {
    return false;
  }

  return Object.values(value).every(
    (entry) => typeof entry === 'undefined' || isDatabaseJson(entry),
  );
}

function toDatabaseJsonObject(
  metadata: Record<string, unknown> | undefined,
): DatabaseJsonObject | undefined {
  if (typeof metadata === 'undefined') {
    return undefined;
  }

  const result: DatabaseJsonObject = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === 'undefined') {
      continue;
    }

    if (isDatabaseJson(value)) {
      result[key] = value;
    }
  }

  return result;
}

@Controller(PAYMENT_ADMIN_ROUTE_PREFIX)
@UseGuards(AuthGuard, ActiveSessionGuard, RolesGuard, PaymentRateLimitGuard)
@Roles(AUTH_ADMIN_ROLE, AUTH_SUPER_ADMIN_ROLE)
export class PaymentAdminController {
  constructor(private readonly paymentAdminService: PaymentAdminService) {}

  @Get()
  @PaymentRateLimit(PAYMENT_RATE_LIMIT_PAYMENT_READ)
  async listPayments(
    @Query() query: ListPaymentsQueryDto,
  ): Promise<ApiSuccessResponse<PaymentListResponse>> {
    const data = await this.paymentAdminService.listAdminPayments({
      user_id: query.user_id,
      target_type: query.target_type,
      booking_id: query.booking_id,
      private_booking_id: query.private_booking_id,
      payment_method: query.payment_method,
      payment_provider: query.payment_provider,
      status: query.status,
      from_date: query.from_date,
      to_date: query.to_date,
      limit: query.limit,
      offset: query.offset,
      sort_by: query.sort_by,
      sort_direction: query.sort_direction,
    });

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Admin payments retrieved successfully.',
      data,
    });
  }

  @Post('expire-unpaid')
  @HttpCode(HttpStatus.OK)
  @PaymentRateLimit(PAYMENT_RATE_LIMIT_PAYMENT_READ)
  async expireUnpaidPaymentIntents(): Promise<
    ApiSuccessResponse<ExpireUnpaidPaymentsResponse>
  > {
    const expiredPayments =
      await this.paymentAdminService.expireUnpaidPaymentIntents();

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Unpaid payment intents expired successfully.',
      data: {
        expired_payments: expiredPayments,
      },
    });
  }

  @Get(':paymentId')
  @PaymentRateLimit(PAYMENT_RATE_LIMIT_PAYMENT_READ)
  async getPaymentById(
    @Param() params: PaymentParamDto,
  ): Promise<ApiSuccessResponse<PaymentDetailResponse>> {
    const data = await this.paymentAdminService.getAdminPaymentById({
      payment_id: params.paymentId,
      include_transactions: true,
      include_discounts: true,
    });

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Admin payment retrieved successfully.',
      data,
    });
  }

  @Get(':paymentId/transactions')
  @PaymentRateLimit(PAYMENT_RATE_LIMIT_PAYMENT_READ)
  async listPaymentTransactions(
    @Param() params: PaymentParamDto,
    @Query() query: ListPaymentTransactionsQueryDto,
  ): Promise<
    ApiSuccessResponse<PaymentPaginatedResult<PaymentTransactionSummary>>
  > {
    const data = await this.paymentAdminService.listAdminPaymentTransactions({
      payment_id: params.paymentId,
      transaction_type: query.transaction_type,
      transaction_status: query.transaction_status,
      limit: query.limit,
      offset: query.offset,
      sort_by: query.sort_by,
      sort_direction: query.sort_direction,
    });

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Admin payment transactions retrieved successfully.',
      data,
    });
  }

  @Post(':paymentId/refund')
  @HttpCode(HttpStatus.OK)
  @PaymentRateLimit(PAYMENT_RATE_LIMIT_ADMIN_REFUND)
  async refundPayment(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: PaymentParamDto,
    @Body() body: RefundPaymentDto,
  ): Promise<ApiSuccessResponse<PaymentRefundResponse>> {
    const data = await this.paymentAdminService.refundPayment({
      payment_id: params.paymentId,
      actor_admin_id: resolveAuthenticatedAdminId(auth),
      reason: body.reason,
      refund_amount: body.refund_amount,
      idempotency_key: body.idempotency_key,
      metadata: toDatabaseJsonObject(body.metadata),
    });

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Payment refund request processed successfully.',
      data,
    });
  }
}
