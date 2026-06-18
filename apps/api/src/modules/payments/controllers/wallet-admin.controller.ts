// apps/api/src/modules/payments/controllers/wallet-admin.controller.ts
/**
 * LAFAM admin wallet controller.
 *
 * Role:
 * - Exposes protected admin Wallet Module endpoints.
 * - Allows admin/super-admin users to list customer wallets.
 * - Allows admin/super-admin users to read a wallet by user id.
 * - Allows admin/super-admin users to read a wallet by wallet account id.
 * - Allows admin/super-admin users to inspect wallet ledger entries.
 * - Exposes admin wallet adjustment endpoint through WalletService.
 *
 * Important:
 * - AuthGuard resolves the Bearer token and attaches Auth context.
 * - ActiveSessionGuard rejects revoked, expired, deleted, deactivated, and invalid sessions.
 * - RolesGuard restricts these endpoints to admin/super-admin users.
 * - PaymentRateLimitGuard applies wallet-specific throttling.
 * - Controller does not directly mutate wallet balances.
 * - Controller does not directly create wallet ledger rows.
 * - Admin wallet adjustment is blocked inside WalletService until an atomic RPC exists.
 * - Admin id is always taken from Auth context, not from request body.
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
import { WalletService } from '../application/wallet.service';
import {
  PAYMENT_DEFAULT_CURRENCY,
  PAYMENT_RATE_LIMIT_ADMIN_WALLET_ADJUST,
  PAYMENT_RATE_LIMIT_WALLET_READ,
  WALLET_ADMIN_ROUTE_PREFIX,
} from '../constants/payment.constants';
import {
  ListAdminWalletsQueryDto,
  ListWalletLedgerQueryDto,
} from '../dto/list-payments-query.dto';
import {
  WalletAccountParamDto,
  WalletUserParamDto,
} from '../dto/payment-param.dto';
import { AdminWalletAdjustmentDto } from '../dto/refund-payment.dto';
import {
  PaymentRateLimit,
  PaymentRateLimitGuard,
} from '../guards/payment-rate-limit.guard';
import type {
  AdminWalletAdjustmentResponse,
  PaymentPaginatedResult,
  WalletAccountResponse,
  WalletAccountSummary,
  WalletLedgerListResponse,
} from '../types/payment.types';

interface AdminWalletListResponse {
  readonly wallets: PaymentPaginatedResult<WalletAccountSummary>;
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

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
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

function buildAdminWalletAdjustmentMetadata(
  body: AdminWalletAdjustmentDto,
): DatabaseJsonObject | undefined {
  const metadata = toDatabaseJsonObject(body.metadata) ?? {};

  if (hasText(body.idempotency_key)) {
    metadata.idempotency_key = body.idempotency_key.trim();
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

@Controller(WALLET_ADMIN_ROUTE_PREFIX)
@UseGuards(AuthGuard, ActiveSessionGuard, RolesGuard, PaymentRateLimitGuard)
@Roles(AUTH_ADMIN_ROLE, AUTH_SUPER_ADMIN_ROLE)
export class WalletAdminController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @PaymentRateLimit(PAYMENT_RATE_LIMIT_WALLET_READ)
  async listWallets(
    @Query() query: ListAdminWalletsQueryDto,
  ): Promise<ApiSuccessResponse<AdminWalletListResponse>> {
    const wallets = await this.walletService.listAdminWallets({
      user_id: query.user_id,
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
      message: 'Admin wallets retrieved successfully.',
      data: {
        wallets,
      },
    });
  }

  @Get('users/:userId')
  @PaymentRateLimit(PAYMENT_RATE_LIMIT_WALLET_READ)
  async getWalletByUserId(
    @Param() params: WalletUserParamDto,
  ): Promise<ApiSuccessResponse<WalletAccountResponse>> {
    const data = await this.walletService.getAdminWalletByUserId({
      user_id: params.userId,
      currency: PAYMENT_DEFAULT_CURRENCY,
    });

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Admin wallet retrieved successfully.',
      data,
    });
  }

  @Get('users/:userId/transactions')
  @PaymentRateLimit(PAYMENT_RATE_LIMIT_WALLET_READ)
  async listWalletTransactionsByUserId(
    @Param() params: WalletUserParamDto,
    @Query() query: ListWalletLedgerQueryDto,
  ): Promise<ApiSuccessResponse<WalletLedgerListResponse>> {
    const data = await this.walletService.listAdminWalletTransactions({
      user_id: params.userId,
      wallet_account_id: query.wallet_account_id,
      entry_type: query.entry_type,
      entry_status: query.entry_status,
      from_date: query.from_date,
      to_date: query.to_date,
      limit: query.limit,
      offset: query.offset,
      sort_by: query.sort_by,
      sort_direction: query.sort_direction,
    });

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Admin wallet transactions retrieved successfully.',
      data,
    });
  }

  @Post('users/:userId/adjust')
  @HttpCode(HttpStatus.OK)
  @PaymentRateLimit(PAYMENT_RATE_LIMIT_ADMIN_WALLET_ADJUST)
  async adjustWalletByUserId(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: WalletUserParamDto,
    @Body() body: AdminWalletAdjustmentDto,
  ): Promise<ApiSuccessResponse<AdminWalletAdjustmentResponse>> {
    const data = await this.walletService.adjustWalletAsAdmin({
      admin_user_id: resolveAuthenticatedAdminId(auth),
      target_user_id: params.userId,
      amount: body.amount,
      currency: PAYMENT_DEFAULT_CURRENCY,
      entry_type: body.entry_type,
      reason: body.reason,
      metadata: buildAdminWalletAdjustmentMetadata(body),
    });

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Admin wallet adjustment processed successfully.',
      data,
    });
  }

  @Get(':walletAccountId')
  @PaymentRateLimit(PAYMENT_RATE_LIMIT_WALLET_READ)
  async getWalletByWalletAccountId(
    @Param() params: WalletAccountParamDto,
  ): Promise<ApiSuccessResponse<WalletAccountResponse>> {
    const data = await this.walletService.getAdminWalletByWalletAccountId({
      wallet_account_id: params.walletAccountId,
    });

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Admin wallet retrieved successfully.',
      data,
    });
  }
}
