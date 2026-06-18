// apps/api/src/modules/payments/controllers/payment-customer.controller.ts
/**
 * LAFAM customer payment controller.
 *
 * Role:
 * - Exposes protected customer Payment Module endpoints.
 * - Allows authenticated customers to create checkout payments.
 * - Allows authenticated customers to list their own payments.
 * - Allows authenticated customers to read their own payment details.
 * - Allows authenticated customers to list transactions for their own payments.
 * - Allows authenticated customers to request provider verification for their own payment.
 *
 * Important:
 * - AuthGuard resolves the Bearer token and attaches Auth context.
 * - ActiveSessionGuard rejects revoked, expired, deleted, deactivated, and invalid sessions.
 * - RolesGuard restricts these endpoints to customer users.
 * - PaymentRateLimitGuard applies route-specific payment throttling.
 * - Controllers must not trust user_id from request body or query params.
 * - Customer ownership must be enforced before returning payment details.
 * - Browser callback and webhook settlement remain owned by PaymentCallbackService.
 * - Controllers must stay thin and delegate business logic to services/repositories.
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
import { AUTH_CUSTOMER_ROLE } from '../../auth/constants/auth-role.constants';
import { CurrentAuth } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ActiveSessionGuard } from '../../auth/guards/active-session.guard';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthInternalContext } from '../../auth/types/auth-context.types';
import { PaymentCallbackService } from '../application/payment-callback.service';
import { PaymentCheckoutService } from '../application/payment-checkout.service';
import {
  PAYMENT_CUSTOMER_ROUTE_PREFIX,
  PAYMENT_DEFAULT_CURRENCY,
  PAYMENT_RATE_LIMIT_CHECKOUT_CREATE,
  PAYMENT_RATE_LIMIT_PAYMENT_READ,
  PAYMENT_RATE_LIMIT_PAYMENT_VERIFY,
  PAYMENT_STATUS_PAID,
  isPaymentCurrency,
  type PaymentCurrency,
} from '../constants/payment.constants';
import { CreateCheckoutPaymentDto } from '../dto/create-checkout-payment.dto';
import { ListCustomerPaymentsQueryDto } from '../dto/list-payments-query.dto';
import { PaymentCallbackQueryDto } from '../dto/payment-callback-query.dto';
import { PaymentParamDto } from '../dto/payment-param.dto';
import {
  PaymentRateLimitGuard,
  PaymentRateLimit,
} from '../guards/payment-rate-limit.guard';
import { PaymentRepository } from '../repositories/payment.repository';
import type {
  PaymentCheckoutResponse,
  PaymentCheckoutResult,
  PaymentDetail,
  PaymentDetailResponse,
  PaymentDiscountRecord,
  PaymentDiscountSummary,
  PaymentListResponse,
  PaymentPaginatedResult,
  PaymentReceiptSummary,
  PaymentRecord,
  PaymentRepositoryListResult,
  PaymentSummary,
  PaymentTransactionListQuery,
  PaymentTransactionRecord,
  PaymentTransactionSummary,
  PaymentVerificationResponse,
} from '../types/payment.types';

interface CustomerPaymentTransactionListQuery {
  readonly transaction_type?: PaymentTransactionListQuery['transaction_type'];
  readonly transaction_status?: PaymentTransactionListQuery['transaction_status'];
  readonly limit: number;
  readonly offset: number;
  readonly sort_by: PaymentTransactionListQuery['sort_by'];
  readonly sort_direction: PaymentTransactionListQuery['sort_direction'];
}

interface PaymentTransactionListResponse {
  readonly transactions: PaymentPaginatedResult<PaymentTransactionSummary>;
}

function resolveAuthContext(
  auth: AuthInternalContext | undefined,
): AuthInternalContext {
  if (!auth) {
    throw AppError.authenticationRequired('Authentication is required.');
  }

  return auth;
}

function resolveAuthenticatedCustomerId(
  auth: AuthInternalContext | undefined,
): string {
  return resolveAuthContext(auth).profile.id;
}

function resolveAuthenticatedCustomerIsGuest(
  auth: AuthInternalContext | undefined,
): boolean {
  return resolveAuthContext(auth).profile.isGuest;
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

function normalizePaymentCurrency(
  currency: string | null | undefined,
): PaymentCurrency {
  const normalizedCurrency =
    typeof currency === 'string' && currency.trim().length > 0
      ? currency.trim().toUpperCase()
      : PAYMENT_DEFAULT_CURRENCY;

  if (isPaymentCurrency(normalizedCurrency)) {
    return normalizedCurrency;
  }

  throw AppError.paymentCurrencyUnsupported('Payment currency must be KWD.', {
    currency: normalizedCurrency,
  });
}

function buildPaginatedResult<TItem>(input: {
  readonly records: readonly TItem[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}): PaymentPaginatedResult<TItem> {
  return {
    items: input.records,
    total: input.total,
    limit: input.limit,
    offset: input.offset,
    has_more: input.offset + input.records.length < input.total,
  };
}

function mapPaymentToSummary(payment: PaymentRecord): PaymentSummary {
  return {
    id: payment.id,
    payment_number: payment.payment_number,
    receipt_number: payment.receipt_number,
    user_id: payment.user_id,
    target_type: payment.target_type,
    booking_id: payment.booking_id,
    private_booking_id: payment.private_booking_id,
    amount: payment.amount,
    discount_amount: payment.discount_amount,
    final_amount: payment.final_amount,
    currency: normalizePaymentCurrency(payment.currency),
    payment_method: payment.payment_method,
    payment_provider: payment.payment_provider,
    status: payment.status,
    redirect_url: payment.redirect_url,
    paid_at: payment.paid_at,
    failed_at: payment.failed_at,
    cancelled_at: payment.cancelled_at,
    expired_at: payment.expired_at,
    refunded_at: payment.refunded_at,
    refunded_amount: payment.refunded_amount,
    expires_at: payment.expires_at,
    created_at: payment.created_at,
    updated_at: payment.updated_at,
    realtime_version: payment.realtime_version,
  };
}

function mapPaymentTransactionToSummary(
  transaction: PaymentTransactionRecord,
): PaymentTransactionSummary {
  return {
    id: transaction.id,
    payment_id: transaction.payment_id,
    transaction_type: transaction.transaction_type,
    transaction_status: transaction.transaction_status,
    provider: transaction.provider,
    provider_reference: transaction.provider_reference,
    failure_code: transaction.failure_code,
    failure_message: transaction.failure_message,
    metadata: transaction.metadata,
    processed_at: transaction.processed_at,
    created_at: transaction.created_at,
  };
}

function mapPaymentDiscountToSummary(
  discount: PaymentDiscountRecord,
): PaymentDiscountSummary {
  return {
    id: discount.id,
    payment_id: discount.payment_id,
    promo_code_id: discount.promo_code_id,
    code: discount.code,
    discount_amount: discount.discount_amount,
    metadata: discount.metadata,
    created_at: discount.created_at,
  };
}

function mapPaymentToDetail(input: {
  readonly payment: PaymentRecord;
  readonly transactions: readonly PaymentTransactionSummary[];
  readonly discounts: readonly PaymentDiscountSummary[];
}): PaymentDetail {
  return {
    ...mapPaymentToSummary(input.payment),
    gateway_reference: input.payment.gateway_reference,
    gateway_payment_id: input.payment.gateway_payment_id,
    gateway_invoice_id: input.payment.gateway_invoice_id,
    webhook_verified_at: input.payment.webhook_verified_at,
    failure_code: input.payment.failure_code,
    failure_message: input.payment.failure_message,
    metadata: input.payment.metadata,
    transactions: input.transactions,
    discounts: input.discounts,
  };
}

function mapPaymentListResponse(input: {
  readonly result: PaymentRepositoryListResult<PaymentRecord>;
  readonly limit: number;
  readonly offset: number;
}): PaymentListResponse {
  return {
    payments: buildPaginatedResult({
      records: input.result.records.map(mapPaymentToSummary),
      total: input.result.total,
      limit: input.limit,
      offset: input.offset,
    }),
  };
}

function mapTransactionListResponse(input: {
  readonly result: PaymentRepositoryListResult<PaymentTransactionRecord>;
  readonly limit: number;
  readonly offset: number;
}): PaymentTransactionListResponse {
  return {
    transactions: buildPaginatedResult({
      records: input.result.records.map(mapPaymentTransactionToSummary),
      total: input.result.total,
      limit: input.limit,
      offset: input.offset,
    }),
  };
}

function mapCheckoutResultToResponse(
  result: PaymentCheckoutResult,
): PaymentCheckoutResponse {
  return {
    payment: mapPaymentToSummary(result.payment),
    requires_redirect: result.requires_redirect,
    redirect_url: result.requires_redirect ? result.redirect_url : null,
  };
}

function buildReceiptSummary(
  payment: PaymentRecord,
): PaymentReceiptSummary | null {
  if (
    payment.status !== PAYMENT_STATUS_PAID ||
    payment.receipt_number === null ||
    payment.paid_at === null
  ) {
    return null;
  }

  return {
    payment_id: payment.id,
    payment_number: payment.payment_number,
    receipt_number: payment.receipt_number,
    user_id: payment.user_id,
    target_type: payment.target_type,
    amount: payment.amount,
    discount_amount: payment.discount_amount,
    final_amount: payment.final_amount,
    currency: normalizePaymentCurrency(payment.currency),
    payment_method: payment.payment_method,
    payment_provider: payment.payment_provider,
    paid_at: payment.paid_at,
  };
}

@Controller(PAYMENT_CUSTOMER_ROUTE_PREFIX)
@UseGuards(AuthGuard, ActiveSessionGuard, RolesGuard, PaymentRateLimitGuard)
@Roles(AUTH_CUSTOMER_ROLE)
export class PaymentCustomerController {
  constructor(
    private readonly paymentCheckoutService: PaymentCheckoutService,
    private readonly paymentCallbackService: PaymentCallbackService,
    private readonly paymentRepository: PaymentRepository,
  ) {}

  @Post('checkout')
  @HttpCode(HttpStatus.CREATED)
  @PaymentRateLimit(PAYMENT_RATE_LIMIT_CHECKOUT_CREATE)
  async createCheckoutPayment(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Body() body: CreateCheckoutPaymentDto,
  ): Promise<ApiSuccessResponse<PaymentCheckoutResponse>> {
    const data = mapCheckoutResultToResponse(
      await this.paymentCheckoutService.createCheckoutPayment({
        user_id: resolveAuthenticatedCustomerId(auth),
        target_type: body.target_type,
        booking_id: body.booking_id ?? null,
        private_booking_id: body.private_booking_id ?? null,
        wallet_top_up_amount: body.wallet_top_up_amount,
        payment_method: body.payment_method,
        currency: body.currency,
        idempotency_key: body.idempotency_key ?? null,
        promo_code: body.promo_code,
        metadata: toDatabaseJsonObject(body.metadata),
        is_guest: resolveAuthenticatedCustomerIsGuest(auth),
      }),
    );

    return createApiSuccessResponse({
      status: HttpStatus.CREATED,
      message: 'Checkout payment created successfully.',
      data,
    });
  }

  @Get()
  @PaymentRateLimit(PAYMENT_RATE_LIMIT_PAYMENT_READ)
  async listPayments(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Query() query: ListCustomerPaymentsQueryDto,
  ): Promise<ApiSuccessResponse<PaymentListResponse>> {
    const result = await this.paymentRepository.listCustomerPayments({
      user_id: resolveAuthenticatedCustomerId(auth),
      target_type: query.target_type,
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
      message: 'Payments retrieved successfully.',
      data: mapPaymentListResponse({
        result,
        limit: query.limit,
        offset: query.offset,
      }),
    });
  }

  @Post(':paymentId/verify')
  @HttpCode(HttpStatus.OK)
  @PaymentRateLimit(PAYMENT_RATE_LIMIT_PAYMENT_VERIFY)
  async verifyPayment(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: PaymentParamDto,
    @Query() query: PaymentCallbackQueryDto,
  ): Promise<ApiSuccessResponse<PaymentVerificationResponse>> {
    const payment = await this.paymentCallbackService.verifyPaymentForCustomer({
      payment_id: params.paymentId,
      user_id: resolveAuthenticatedCustomerId(auth),
      provider_reference:
        query.provider_reference ?? query.reference_id ?? null,
      gateway_payment_id:
        query.gateway_payment_id ?? query.transaction_id ?? null,
      gateway_invoice_id: query.gateway_invoice_id ?? query.invoice_id ?? null,
    });

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Payment verification completed successfully.',
      data: {
        payment: mapPaymentToSummary(payment),
        receipt: buildReceiptSummary(payment),
      },
    });
  }

  @Get(':paymentId/transactions')
  @PaymentRateLimit(PAYMENT_RATE_LIMIT_PAYMENT_READ)
  async listPaymentTransactions(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: PaymentParamDto,
    @Query() query: CustomerPaymentTransactionListQuery,
  ): Promise<ApiSuccessResponse<PaymentTransactionListResponse>> {
    await this.getOwnedPaymentOrThrow({
      payment_id: params.paymentId,
      user_id: resolveAuthenticatedCustomerId(auth),
    });

    const result = await this.paymentRepository.listPaymentTransactions({
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
      message: 'Payment transactions retrieved successfully.',
      data: mapTransactionListResponse({
        result,
        limit: query.limit,
        offset: query.offset,
      }),
    });
  }

  @Get(':paymentId')
  @PaymentRateLimit(PAYMENT_RATE_LIMIT_PAYMENT_READ)
  async getPaymentById(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: PaymentParamDto,
  ): Promise<ApiSuccessResponse<PaymentDetailResponse>> {
    const payment = await this.getOwnedPaymentOrThrow({
      payment_id: params.paymentId,
      user_id: resolveAuthenticatedCustomerId(auth),
    });

    const [transactions, discounts] = await Promise.all([
      this.paymentRepository.findPaymentTransactions(payment.id),
      this.paymentRepository.findPaymentDiscounts(payment.id),
    ]);

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Payment retrieved successfully.',
      data: {
        payment: mapPaymentToDetail({
          payment,
          transactions: transactions.map(mapPaymentTransactionToSummary),
          discounts: discounts.map(mapPaymentDiscountToSummary),
        }),
      },
    });
  }

  private async getOwnedPaymentOrThrow(input: {
    readonly payment_id: string;
    readonly user_id: string;
  }): Promise<PaymentRecord> {
    const payment = await this.paymentRepository.findPaymentByIdForUser(
      input.payment_id,
      input.user_id,
    );

    if (!payment) {
      throw AppError.paymentNotFound('The requested payment was not found.', {
        payment_id: input.payment_id,
        user_id: input.user_id,
      });
    }

    return payment;
  }
}
