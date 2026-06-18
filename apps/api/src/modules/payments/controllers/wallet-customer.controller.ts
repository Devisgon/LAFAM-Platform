// apps/api/src/modules/payments/controllers/wallet-customer.controller.ts
/**
 * LAFAM customer wallet controller.
 *
 * Role:
 * - Exposes protected customer Wallet Module endpoints.
 * - Allows authenticated customers to read their own wallet balance.
 * - Allows authenticated customers to read their own wallet transaction history.
 * - Allows authenticated customers to read one owned wallet transaction.
 * - Allows authenticated customers to start a hosted wallet top-up checkout.
 *
 * Important:
 * - user_id is always taken from Auth context.
 * - Guest users are blocked by WalletService.
 * - Wallet top-up must use hosted payment methods only.
 * - Wallet top-up cannot use wallet balance.
 * - Controller does not directly mutate wallet balances.
 * - Controller does not directly create wallet ledger rows.
 * - Wallet mutation remains inside service/repository/database RPC boundaries.
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
import { WalletService } from '../application/wallet.service';
import {
  PAYMENT_DEFAULT_CURRENCY,
  PAYMENT_RATE_LIMIT_WALLET_READ,
  PAYMENT_RATE_LIMIT_WALLET_TOP_UP,
  PAYMENT_TARGET_TYPE_WALLET_TOP_UP,
  WALLET_CUSTOMER_ROUTE_PREFIX,
  isPaymentCurrency,
  isPaymentHostedRedirectMethod,
  type PaymentCurrency,
  type PaymentHostedRedirectMethod,
} from '../constants/payment.constants';
import { CreateCheckoutPaymentDto } from '../dto/create-checkout-payment.dto';
import { ListWalletLedgerQueryDto } from '../dto/list-payments-query.dto';
import { WalletLedgerEntryParamDto } from '../dto/payment-param.dto';
import {
  PaymentRateLimit,
  PaymentRateLimitGuard,
} from '../guards/payment-rate-limit.guard';
import type {
  WalletAccountResponse,
  WalletLedgerEntrySummary,
  WalletLedgerListResponse,
  WalletTopUpResponse,
} from '../types/payment.types';

interface WalletLedgerEntryResponse {
  readonly transaction: WalletLedgerEntrySummary;
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

  throw AppError.paymentCurrencyUnsupported('Wallet currency must be KWD.', {
    currency: normalizedCurrency,
  });
}

function resolveWalletTopUpAmount(body: CreateCheckoutPaymentDto): number {
  if (typeof body.wallet_top_up_amount === 'number') {
    return body.wallet_top_up_amount;
  }

  throw AppError.paymentAmountInvalid(
    'wallet_top_up_amount is required for wallet top-up.',
    {
      target_type: body.target_type,
    },
  );
}

function resolveWalletTopUpPaymentMethod(
  body: CreateCheckoutPaymentDto,
): PaymentHostedRedirectMethod {
  if (isPaymentHostedRedirectMethod(body.payment_method)) {
    return body.payment_method;
  }

  throw AppError.paymentMethodUnsupported(
    'Wallet top-up must use a hosted payment method.',
    {
      payment_method: body.payment_method,
    },
  );
}

function assertWalletTopUpPayload(body: CreateCheckoutPaymentDto): void {
  if (body.target_type !== PAYMENT_TARGET_TYPE_WALLET_TOP_UP) {
    throw AppError.paymentTargetInvalid(
      'Wallet top-up endpoint only accepts wallet_top_up target type.',
      {
        target_type: body.target_type,
      },
    );
  }

  if (typeof body.booking_id !== 'undefined') {
    throw AppError.paymentTargetInvalid(
      'booking_id is not allowed for wallet top-up.',
      {
        target_type: body.target_type,
        booking_id: body.booking_id,
      },
    );
  }

  if (typeof body.private_booking_id !== 'undefined') {
    throw AppError.paymentTargetInvalid(
      'private_booking_id is not allowed for wallet top-up.',
      {
        target_type: body.target_type,
        private_booking_id: body.private_booking_id,
      },
    );
  }

  if (typeof body.promo_code !== 'undefined') {
    throw AppError.promoCodeInvalid(
      'Promo codes are not supported for wallet top-up.',
      {
        target_type: body.target_type,
        promo_code: body.promo_code,
      },
    );
  }
}

@Controller(WALLET_CUSTOMER_ROUTE_PREFIX)
@UseGuards(AuthGuard, ActiveSessionGuard, RolesGuard, PaymentRateLimitGuard)
@Roles(AUTH_CUSTOMER_ROLE)
export class WalletCustomerController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @PaymentRateLimit(PAYMENT_RATE_LIMIT_WALLET_READ)
  async getWallet(
    @CurrentAuth() auth: AuthInternalContext | undefined,
  ): Promise<ApiSuccessResponse<WalletAccountResponse>> {
    const data = await this.walletService.getCustomerWallet({
      user_id: resolveAuthenticatedCustomerId(auth),
      currency: PAYMENT_DEFAULT_CURRENCY,
      is_guest: resolveAuthenticatedCustomerIsGuest(auth),
    });

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Wallet retrieved successfully.',
      data,
    });
  }

  @Get('transactions')
  @PaymentRateLimit(PAYMENT_RATE_LIMIT_WALLET_READ)
  async listWalletTransactions(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Query() query: ListWalletLedgerQueryDto,
  ): Promise<ApiSuccessResponse<WalletLedgerListResponse>> {
    const data = await this.walletService.listCustomerWalletTransactions({
      user_id: resolveAuthenticatedCustomerId(auth),
      wallet_account_id: query.wallet_account_id,
      entry_type: query.entry_type,
      entry_status: query.entry_status,
      from_date: query.from_date,
      to_date: query.to_date,
      limit: query.limit,
      offset: query.offset,
      sort_by: query.sort_by,
      sort_direction: query.sort_direction,
      is_guest: resolveAuthenticatedCustomerIsGuest(auth),
    });

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Wallet transactions retrieved successfully.',
      data,
    });
  }

  @Get('transactions/:ledgerEntryId')
  @PaymentRateLimit(PAYMENT_RATE_LIMIT_WALLET_READ)
  async getWalletTransactionById(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: WalletLedgerEntryParamDto,
  ): Promise<ApiSuccessResponse<WalletLedgerEntryResponse>> {
    const transaction = await this.walletService.getCustomerWalletTransaction({
      user_id: resolveAuthenticatedCustomerId(auth),
      ledger_entry_id: params.ledgerEntryId,
      is_guest: resolveAuthenticatedCustomerIsGuest(auth),
    });

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Wallet transaction retrieved successfully.',
      data: {
        transaction,
      },
    });
  }

  @Post('top-up')
  @HttpCode(HttpStatus.CREATED)
  @PaymentRateLimit(PAYMENT_RATE_LIMIT_WALLET_TOP_UP)
  async createWalletTopUp(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Body() body: CreateCheckoutPaymentDto,
  ): Promise<ApiSuccessResponse<WalletTopUpResponse>> {
    assertWalletTopUpPayload(body);

    const data = await this.walletService.createWalletTopUp({
      user_id: resolveAuthenticatedCustomerId(auth),
      amount: resolveWalletTopUpAmount(body),
      currency: normalizePaymentCurrency(body.currency),
      payment_method: resolveWalletTopUpPaymentMethod(body),
      idempotency_key: body.idempotency_key ?? null,
      metadata: toDatabaseJsonObject(body.metadata),
      is_guest: resolveAuthenticatedCustomerIsGuest(auth),
    });

    return createApiSuccessResponse({
      status: HttpStatus.CREATED,
      message: 'Wallet top-up checkout created successfully.',
      data,
    });
  }
}
