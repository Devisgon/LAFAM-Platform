// apps/api/src/modules/payments/dto/list-payments-query.dto.ts
/**
 * LAFAM Payment list query DTOs.
 *
 * Role:
 * - Validates payment, payment transaction, wallet ledger, and admin wallet list queries.
 * - Applies safe pagination defaults and maximum limits.
 * - Restricts sort fields to known database-backed fields.
 * - Keeps customer query filters narrower than admin query filters.
 *
 * Important:
 * - Query validation is not authorization.
 * - Customer payment/wallet services must still enforce ownership.
 * - Admin payment/wallet services must still enforce admin/super-admin role.
 * - List endpoints must stay paginated to prevent resource-exhaustion attacks.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

import {
  ADMIN_WALLET_LIST_DEFAULT_LIMIT,
  ADMIN_WALLET_LIST_DEFAULT_OFFSET,
  ADMIN_WALLET_LIST_MAX_LIMIT,
  PAYMENT_LIST_DEFAULT_LIMIT,
  PAYMENT_LIST_DEFAULT_OFFSET,
  PAYMENT_LIST_MAX_LIMIT,
  PAYMENT_METHODS,
  PAYMENT_PROVIDERS,
  PAYMENT_STATUSES,
  PAYMENT_TARGET_TYPES,
  PAYMENT_TRANSACTION_LIST_DEFAULT_LIMIT,
  PAYMENT_TRANSACTION_LIST_DEFAULT_OFFSET,
  PAYMENT_TRANSACTION_LIST_MAX_LIMIT,
  PAYMENT_TRANSACTION_STATUSES,
  PAYMENT_TRANSACTION_TYPES,
  WALLET_ACCOUNT_STATUSES,
  WALLET_LEDGER_ENTRY_STATUSES,
  WALLET_LEDGER_ENTRY_TYPES,
  WALLET_LEDGER_LIST_DEFAULT_LIMIT,
  WALLET_LEDGER_LIST_DEFAULT_OFFSET,
  WALLET_LEDGER_LIST_MAX_LIMIT,
} from '../constants/payment.constants';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

const PAYMENT_SORT_FIELDS = [
  'created_at',
  'updated_at',
  'final_amount',
  'paid_at',
] as const;

const PAYMENT_TRANSACTION_SORT_FIELDS = ['created_at', 'processed_at'] as const;

const WALLET_LEDGER_SORT_FIELDS = ['created_at', 'amount'] as const;

const ADMIN_WALLET_SORT_FIELDS = [
  'created_at',
  'updated_at',
  'available_balance',
] as const;

const SORT_DIRECTIONS = ['asc', 'desc'] as const;

type PaymentSortField = (typeof PAYMENT_SORT_FIELDS)[number];
type PaymentTransactionSortField =
  (typeof PAYMENT_TRANSACTION_SORT_FIELDS)[number];
type WalletLedgerSortField = (typeof WALLET_LEDGER_SORT_FIELDS)[number];
type AdminWalletSortField = (typeof ADMIN_WALLET_SORT_FIELDS)[number];
type SortDirection = (typeof SORT_DIRECTIONS)[number];

function optionalTrimmedString(params: TransformFnParams): unknown {
  const value: unknown = params.value;

  if (typeof value === 'undefined' || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function integerWithDefault(defaultValue: number) {
  return (params: TransformFnParams): unknown => {
    const value: unknown = params.value;

    if (typeof value === 'undefined' || value === null || value === '') {
      return defaultValue;
    }

    if (typeof value === 'number') {
      return value;
    }

    if (typeof value !== 'string') {
      return value;
    }

    const trimmedValue = value.trim();

    if (!/^\d+$/u.test(trimmedValue)) {
      return value;
    }

    return Number(trimmedValue);
  };
}

class PaymentPaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Maximum number of payment records to return.',
    example: PAYMENT_LIST_DEFAULT_LIMIT,
    default: PAYMENT_LIST_DEFAULT_LIMIT,
    minimum: 1,
    maximum: PAYMENT_LIST_MAX_LIMIT,
  })
  @Transform(integerWithDefault(PAYMENT_LIST_DEFAULT_LIMIT))
  @IsInt({
    message: 'limit must be an integer.',
  })
  @Min(1, {
    message: 'limit must be at least 1.',
  })
  @Max(PAYMENT_LIST_MAX_LIMIT, {
    message: `limit must not exceed ${PAYMENT_LIST_MAX_LIMIT}.`,
  })
  readonly limit: number = PAYMENT_LIST_DEFAULT_LIMIT;

  @ApiPropertyOptional({
    description: 'Number of payment records to skip.',
    example: PAYMENT_LIST_DEFAULT_OFFSET,
    default: PAYMENT_LIST_DEFAULT_OFFSET,
    minimum: 0,
  })
  @Transform(integerWithDefault(PAYMENT_LIST_DEFAULT_OFFSET))
  @IsInt({
    message: 'offset must be an integer.',
  })
  @Min(0, {
    message: 'offset must be at least 0.',
  })
  readonly offset: number = PAYMENT_LIST_DEFAULT_OFFSET;
}

class PaymentDateRangeQueryDto extends PaymentPaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter records created on or after this date.',
    example: '2026-06-17',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @Matches(ISO_DATE_PATTERN, {
    message: 'from_date must use YYYY-MM-DD format.',
  })
  readonly from_date?: string;

  @ApiPropertyOptional({
    description: 'Filter records created on or before this date.',
    example: '2026-06-30',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @Matches(ISO_DATE_PATTERN, {
    message: 'to_date must use YYYY-MM-DD format.',
  })
  readonly to_date?: string;
}

export class ListPaymentsQueryDto extends PaymentDateRangeQueryDto {
  @ApiPropertyOptional({
    description: 'Filter payments by owning application user.',
    example: '302d9725-1dd4-460c-b6aa-e42b5e429fb8',
    format: 'uuid',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsUUID('4', {
    message: 'user_id must be a valid UUID.',
  })
  readonly user_id?: string;

  @ApiPropertyOptional({
    description: 'Filter payments by target type.',
    enum: PAYMENT_TARGET_TYPES,
    example: 'booking',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PAYMENT_TARGET_TYPES, {
    message: 'target_type must be booking, private_booking, or wallet_top_up.',
  })
  readonly target_type?: (typeof PAYMENT_TARGET_TYPES)[number];

  @ApiPropertyOptional({
    description: 'Filter payments by Pilates booking identifier.',
    example: '7d7eb3a7-4a75-4ed4-9c65-34d740a56aa4',
    format: 'uuid',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsUUID('4', {
    message: 'booking_id must be a valid UUID.',
  })
  readonly booking_id?: string;

  @ApiPropertyOptional({
    description: 'Filter payments by private trainer booking identifier.',
    example: '81a0fbd2-f9e1-41d4-a7d8-60a6099c1d08',
    format: 'uuid',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsUUID('4', {
    message: 'private_booking_id must be a valid UUID.',
  })
  readonly private_booking_id?: string;

  @ApiPropertyOptional({
    description: 'Filter payments by selected payment method.',
    enum: PAYMENT_METHODS,
    example: 'knet',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PAYMENT_METHODS, {
    message: 'payment_method must be knet, card, or wallet.',
  })
  readonly payment_method?: (typeof PAYMENT_METHODS)[number];

  @ApiPropertyOptional({
    description: 'Filter payments by payment provider.',
    enum: PAYMENT_PROVIDERS,
    example: 'mock',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PAYMENT_PROVIDERS, {
    message: 'payment_provider must be a supported payment provider.',
  })
  readonly payment_provider?: (typeof PAYMENT_PROVIDERS)[number];

  @ApiPropertyOptional({
    description: 'Filter payments by payment status.',
    enum: PAYMENT_STATUSES,
    example: 'paid',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PAYMENT_STATUSES, {
    message: 'status must be a supported payment status.',
  })
  readonly status?: (typeof PAYMENT_STATUSES)[number];

  @ApiPropertyOptional({
    description: 'Payment list sort field.',
    enum: PAYMENT_SORT_FIELDS,
    example: 'created_at',
    default: 'created_at',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PAYMENT_SORT_FIELDS, {
    message:
      'sort_by must be created_at, updated_at, final_amount, or paid_at.',
  })
  readonly sort_by: PaymentSortField = 'created_at';

  @ApiPropertyOptional({
    description: 'Payment list sort direction.',
    enum: SORT_DIRECTIONS,
    example: 'desc',
    default: 'desc',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(SORT_DIRECTIONS, {
    message: 'sort_direction must be asc or desc.',
  })
  readonly sort_direction: SortDirection = 'desc';
}

export class ListCustomerPaymentsQueryDto extends PaymentDateRangeQueryDto {
  @ApiPropertyOptional({
    description: 'Filter own payments by target type.',
    enum: PAYMENT_TARGET_TYPES,
    example: 'booking',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PAYMENT_TARGET_TYPES, {
    message: 'target_type must be booking, private_booking, or wallet_top_up.',
  })
  readonly target_type?: (typeof PAYMENT_TARGET_TYPES)[number];

  @ApiPropertyOptional({
    description: 'Filter own payments by payment status.',
    enum: PAYMENT_STATUSES,
    example: 'paid',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PAYMENT_STATUSES, {
    message: 'status must be a supported payment status.',
  })
  readonly status?: (typeof PAYMENT_STATUSES)[number];

  @ApiPropertyOptional({
    description: 'Customer payment list sort field.',
    enum: PAYMENT_SORT_FIELDS,
    example: 'created_at',
    default: 'created_at',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PAYMENT_SORT_FIELDS, {
    message:
      'sort_by must be created_at, updated_at, final_amount, or paid_at.',
  })
  readonly sort_by: PaymentSortField = 'created_at';

  @ApiPropertyOptional({
    description: 'Customer payment list sort direction.',
    enum: SORT_DIRECTIONS,
    example: 'desc',
    default: 'desc',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(SORT_DIRECTIONS, {
    message: 'sort_direction must be asc or desc.',
  })
  readonly sort_direction: SortDirection = 'desc';
}

export class ListPaymentTransactionsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter payment transactions by transaction type.',
    enum: PAYMENT_TRANSACTION_TYPES,
    example: 'webhook_received',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PAYMENT_TRANSACTION_TYPES, {
    message: 'transaction_type must be a supported payment transaction type.',
  })
  readonly transaction_type?: (typeof PAYMENT_TRANSACTION_TYPES)[number];

  @ApiPropertyOptional({
    description: 'Filter payment transactions by transaction status.',
    enum: PAYMENT_TRANSACTION_STATUSES,
    example: 'succeeded',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PAYMENT_TRANSACTION_STATUSES, {
    message:
      'transaction_status must be a supported payment transaction status.',
  })
  readonly transaction_status?: (typeof PAYMENT_TRANSACTION_STATUSES)[number];

  @ApiPropertyOptional({
    description: 'Maximum number of payment transaction records to return.',
    example: PAYMENT_TRANSACTION_LIST_DEFAULT_LIMIT,
    default: PAYMENT_TRANSACTION_LIST_DEFAULT_LIMIT,
    minimum: 1,
    maximum: PAYMENT_TRANSACTION_LIST_MAX_LIMIT,
  })
  @Transform(integerWithDefault(PAYMENT_TRANSACTION_LIST_DEFAULT_LIMIT))
  @IsInt({
    message: 'limit must be an integer.',
  })
  @Min(1, {
    message: 'limit must be at least 1.',
  })
  @Max(PAYMENT_TRANSACTION_LIST_MAX_LIMIT, {
    message: `limit must not exceed ${PAYMENT_TRANSACTION_LIST_MAX_LIMIT}.`,
  })
  readonly limit: number = PAYMENT_TRANSACTION_LIST_DEFAULT_LIMIT;

  @ApiPropertyOptional({
    description: 'Number of payment transaction records to skip.',
    example: PAYMENT_TRANSACTION_LIST_DEFAULT_OFFSET,
    default: PAYMENT_TRANSACTION_LIST_DEFAULT_OFFSET,
    minimum: 0,
  })
  @Transform(integerWithDefault(PAYMENT_TRANSACTION_LIST_DEFAULT_OFFSET))
  @IsInt({
    message: 'offset must be an integer.',
  })
  @Min(0, {
    message: 'offset must be at least 0.',
  })
  readonly offset: number = PAYMENT_TRANSACTION_LIST_DEFAULT_OFFSET;

  @ApiPropertyOptional({
    description: 'Payment transaction list sort field.',
    enum: PAYMENT_TRANSACTION_SORT_FIELDS,
    example: 'created_at',
    default: 'created_at',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(PAYMENT_TRANSACTION_SORT_FIELDS, {
    message: 'sort_by must be created_at or processed_at.',
  })
  readonly sort_by: PaymentTransactionSortField = 'created_at';

  @ApiPropertyOptional({
    description: 'Payment transaction list sort direction.',
    enum: SORT_DIRECTIONS,
    example: 'desc',
    default: 'desc',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(SORT_DIRECTIONS, {
    message: 'sort_direction must be asc or desc.',
  })
  readonly sort_direction: SortDirection = 'desc';
}

export class ListWalletLedgerQueryDto {
  @ApiPropertyOptional({
    description: 'Filter own wallet ledger by wallet account identifier.',
    example: '38142cfa-2c40-4210-ad2a-e186a4259030',
    format: 'uuid',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsUUID('4', {
    message: 'wallet_account_id must be a valid UUID.',
  })
  readonly wallet_account_id?: string;

  @ApiPropertyOptional({
    description: 'Filter wallet ledger entries by entry type.',
    enum: WALLET_LEDGER_ENTRY_TYPES,
    example: 'booking_payment',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(WALLET_LEDGER_ENTRY_TYPES, {
    message: 'entry_type must be a supported wallet ledger entry type.',
  })
  readonly entry_type?: (typeof WALLET_LEDGER_ENTRY_TYPES)[number];

  @ApiPropertyOptional({
    description: 'Filter wallet ledger entries by entry status.',
    enum: WALLET_LEDGER_ENTRY_STATUSES,
    example: 'posted',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(WALLET_LEDGER_ENTRY_STATUSES, {
    message: 'entry_status must be a supported wallet ledger entry status.',
  })
  readonly entry_status?: (typeof WALLET_LEDGER_ENTRY_STATUSES)[number];

  @ApiPropertyOptional({
    description: 'Filter wallet ledger entries created on or after this date.',
    example: '2026-06-17',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @Matches(ISO_DATE_PATTERN, {
    message: 'from_date must use YYYY-MM-DD format.',
  })
  readonly from_date?: string;

  @ApiPropertyOptional({
    description: 'Filter wallet ledger entries created on or before this date.',
    example: '2026-06-30',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @Matches(ISO_DATE_PATTERN, {
    message: 'to_date must use YYYY-MM-DD format.',
  })
  readonly to_date?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of wallet ledger entries to return.',
    example: WALLET_LEDGER_LIST_DEFAULT_LIMIT,
    default: WALLET_LEDGER_LIST_DEFAULT_LIMIT,
    minimum: 1,
    maximum: WALLET_LEDGER_LIST_MAX_LIMIT,
  })
  @Transform(integerWithDefault(WALLET_LEDGER_LIST_DEFAULT_LIMIT))
  @IsInt({
    message: 'limit must be an integer.',
  })
  @Min(1, {
    message: 'limit must be at least 1.',
  })
  @Max(WALLET_LEDGER_LIST_MAX_LIMIT, {
    message: `limit must not exceed ${WALLET_LEDGER_LIST_MAX_LIMIT}.`,
  })
  readonly limit: number = WALLET_LEDGER_LIST_DEFAULT_LIMIT;

  @ApiPropertyOptional({
    description: 'Number of wallet ledger entries to skip.',
    example: WALLET_LEDGER_LIST_DEFAULT_OFFSET,
    default: WALLET_LEDGER_LIST_DEFAULT_OFFSET,
    minimum: 0,
  })
  @Transform(integerWithDefault(WALLET_LEDGER_LIST_DEFAULT_OFFSET))
  @IsInt({
    message: 'offset must be an integer.',
  })
  @Min(0, {
    message: 'offset must be at least 0.',
  })
  readonly offset: number = WALLET_LEDGER_LIST_DEFAULT_OFFSET;

  @ApiPropertyOptional({
    description: 'Wallet ledger list sort field.',
    enum: WALLET_LEDGER_SORT_FIELDS,
    example: 'created_at',
    default: 'created_at',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(WALLET_LEDGER_SORT_FIELDS, {
    message: 'sort_by must be created_at or amount.',
  })
  readonly sort_by: WalletLedgerSortField = 'created_at';

  @ApiPropertyOptional({
    description: 'Wallet ledger list sort direction.',
    enum: SORT_DIRECTIONS,
    example: 'desc',
    default: 'desc',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(SORT_DIRECTIONS, {
    message: 'sort_direction must be asc or desc.',
  })
  readonly sort_direction: SortDirection = 'desc';
}

export class ListAdminWalletsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter wallets by owning application user.',
    example: '302d9725-1dd4-460c-b6aa-e42b5e429fb8',
    format: 'uuid',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsUUID('4', {
    message: 'user_id must be a valid UUID.',
  })
  readonly user_id?: string;

  @ApiPropertyOptional({
    description: 'Filter wallets by wallet account status.',
    enum: WALLET_ACCOUNT_STATUSES,
    example: 'active',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(WALLET_ACCOUNT_STATUSES, {
    message: 'status must be a supported wallet account status.',
  })
  readonly status?: (typeof WALLET_ACCOUNT_STATUSES)[number];

  @ApiPropertyOptional({
    description: 'Filter wallets created on or after this date.',
    example: '2026-06-17',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @Matches(ISO_DATE_PATTERN, {
    message: 'from_date must use YYYY-MM-DD format.',
  })
  readonly from_date?: string;

  @ApiPropertyOptional({
    description: 'Filter wallets created on or before this date.',
    example: '2026-06-30',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @Matches(ISO_DATE_PATTERN, {
    message: 'to_date must use YYYY-MM-DD format.',
  })
  readonly to_date?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of wallets to return.',
    example: ADMIN_WALLET_LIST_DEFAULT_LIMIT,
    default: ADMIN_WALLET_LIST_DEFAULT_LIMIT,
    minimum: 1,
    maximum: ADMIN_WALLET_LIST_MAX_LIMIT,
  })
  @Transform(integerWithDefault(ADMIN_WALLET_LIST_DEFAULT_LIMIT))
  @IsInt({
    message: 'limit must be an integer.',
  })
  @Min(1, {
    message: 'limit must be at least 1.',
  })
  @Max(ADMIN_WALLET_LIST_MAX_LIMIT, {
    message: `limit must not exceed ${ADMIN_WALLET_LIST_MAX_LIMIT}.`,
  })
  readonly limit: number = ADMIN_WALLET_LIST_DEFAULT_LIMIT;

  @ApiPropertyOptional({
    description: 'Number of wallets to skip.',
    example: ADMIN_WALLET_LIST_DEFAULT_OFFSET,
    default: ADMIN_WALLET_LIST_DEFAULT_OFFSET,
    minimum: 0,
  })
  @Transform(integerWithDefault(ADMIN_WALLET_LIST_DEFAULT_OFFSET))
  @IsInt({
    message: 'offset must be an integer.',
  })
  @Min(0, {
    message: 'offset must be at least 0.',
  })
  readonly offset: number = ADMIN_WALLET_LIST_DEFAULT_OFFSET;

  @ApiPropertyOptional({
    description: 'Admin wallet list sort field.',
    enum: ADMIN_WALLET_SORT_FIELDS,
    example: 'created_at',
    default: 'created_at',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(ADMIN_WALLET_SORT_FIELDS, {
    message: 'sort_by must be created_at, updated_at, or available_balance.',
  })
  readonly sort_by: AdminWalletSortField = 'created_at';

  @ApiPropertyOptional({
    description: 'Admin wallet list sort direction.',
    enum: SORT_DIRECTIONS,
    example: 'desc',
    default: 'desc',
  })
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsIn(SORT_DIRECTIONS, {
    message: 'sort_direction must be asc or desc.',
  })
  readonly sort_direction: SortDirection = 'desc';
}
