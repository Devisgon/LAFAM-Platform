// apps/api/src/modules/payments/repositories/payment.repository.ts
/**
 * LAFAM Payment repository.
 *
 * Role:
 * - Owns Payment Module database access for payments, payment transactions, discounts, and promo codes.
 * - Wraps payment atomic RPC calls.
 * - Provides customer/admin payment lookup and list helpers.
 * - Converts provider/database failures into frontend-safe AppError instances.
 *
 * Important:
 * - This repository does not perform authorization.
 * - This repository does not decide payment lifecycle rules.
 * - This repository does not verify KNET/provider signatures.
 * - This repository does not calculate trusted payment amounts.
 * - This repository does not mutate wallet balances directly.
 * - Services and domain policies remain the business-rule authority.
 */

import { Inject, Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { SUPABASE_ADMIN_CLIENT } from '../../../database/database.constants';
import type {
  DatabaseJsonObject,
  LAFAMSupabaseClient,
} from '../../../database/database.types';
import {
  PAYMENT_LIST_DEFAULT_LIMIT,
  PAYMENT_LIST_DEFAULT_OFFSET,
  PAYMENT_LIST_MAX_LIMIT,
  PAYMENT_STATUS_CANCELLED,
  PAYMENT_STATUS_FAILED,
  PAYMENT_STATUS_PAID,
  PAYMENT_TRANSACTION_LIST_DEFAULT_LIMIT,
  PAYMENT_TRANSACTION_LIST_DEFAULT_OFFSET,
  PAYMENT_TRANSACTION_LIST_MAX_LIMIT,
  type PaymentCurrency,
  type PaymentMethod,
  type PaymentProvider,
  type PaymentStatus,
  type PaymentTargetType,
} from '../constants/payment.constants';
import type {
  CreatePaymentIntentAtomicResult,
  CustomerPaymentListQuery,
  ExpirePaymentIntentsAtomicResult,
  MarkPaymentCancelledAtomicResult,
  MarkPaymentFailedAtomicResult,
  MarkPaymentPaidAtomicResult,
  PaymentCreateRecord,
  PaymentDiscountCreateRecord,
  PaymentDiscountRecord,
  PaymentListQuery,
  PaymentRecord,
  PaymentRepositoryListResult,
  PaymentTransactionCreateRecord,
  PaymentTransactionListQuery,
  PaymentTransactionRecord,
  PaymentUpdateRecord,
  PromoCodeRecord,
  RefundPaymentAtomicResult,
} from '../types/payment.types';

interface ProviderDatabaseError {
  readonly code?: string;
  readonly message?: string;
  readonly details?: string;
  readonly hint?: string;
}

interface PaymentReferenceLookupInput {
  readonly payment_id?: string | null;
  readonly provider_reference?: string | null;
  readonly gateway_payment_id?: string | null;
  readonly gateway_invoice_id?: string | null;
}

interface CreatePaymentIntentAtomicInput {
  readonly user_id: string;
  readonly target_type: PaymentTargetType;
  readonly booking_id: string | null;
  readonly private_booking_id: string | null;
  readonly amount: number;
  readonly discount_amount: number;
  readonly final_amount: number;
  readonly currency: PaymentCurrency;
  readonly payment_method: PaymentMethod;
  readonly payment_provider: PaymentProvider;
  readonly status: PaymentStatus;
  readonly redirect_url: string | null;
  readonly callback_url: string | null;
  readonly gateway_reference: string | null;
  readonly gateway_payment_id: string | null;
  readonly gateway_invoice_id: string | null;
  readonly expires_at: string | null;
  readonly idempotency_key: string | null;
  readonly metadata: DatabaseJsonObject;
}

interface MarkPaymentPaidAtomicInput {
  readonly payment_id: string;
  readonly provider_reference?: string | null;
  readonly gateway_payment_id?: string | null;
  readonly gateway_invoice_id?: string | null;
  readonly gateway_response?: DatabaseJsonObject;
  readonly webhook_verified?: boolean;
}

interface MarkPaymentFailedAtomicInput {
  readonly payment_id: string;
  readonly failure_code?: string | null;
  readonly failure_message?: string | null;
  readonly gateway_response?: DatabaseJsonObject;
}

interface MarkPaymentCancelledAtomicInput {
  readonly payment_id: string;
  readonly reason?: string | null;
  readonly gateway_response?: DatabaseJsonObject;
}

interface RefundPaymentAtomicInput {
  readonly payment_id: string;
  readonly actor_admin_id: string;
  readonly reason: string;
  readonly refund_amount?: number | null;
  readonly gateway_response?: DatabaseJsonObject;
}

function isProviderDatabaseError(
  error: unknown,
): error is ProviderDatabaseError {
  return typeof error === 'object' && error !== null;
}

function createProviderErrorDetails(
  error: ProviderDatabaseError,
): Record<string, unknown> {
  return {
    ...(error.code ? { provider_code: error.code } : {}),
    ...(error.details ? { provider_details: error.details } : {}),
    ...(error.hint ? { provider_hint: error.hint } : {}),
  };
}

function mapDatabaseError(error: unknown): AppError {
  if (!isProviderDatabaseError(error)) {
    return AppError.databaseOperationFailed(error);
  }

  const details = createProviderErrorDetails(error);
  const message = error.message ?? '';

  if (
    error.code === '23505' &&
    (message.includes('payments_idempotency') ||
      message.includes('payments_idempotency_key') ||
      message.includes('payments_gateway_reference') ||
      message.includes('payment_transactions_provider_reference'))
  ) {
    return AppError.invalidRequest(
      'Duplicate payment idempotency or provider reference was detected.',
      details,
    );
  }

  if (error.code === '23503') {
    return AppError.invalidRequest(
      'A related payment, booking, customer, promo, or admin record was not found.',
      details,
    );
  }

  if (error.code === '23514') {
    return AppError.invalidRequest(
      'The submitted payment data violates database constraints.',
      details,
    );
  }

  return AppError.databaseOperationFailed(error);
}

function resolveLimit(
  value: number,
  defaultValue: number,
  maxValue: number,
): number {
  if (!Number.isFinite(value)) {
    return defaultValue;
  }

  const normalizedValue = Math.floor(value);

  if (normalizedValue < 1) {
    return defaultValue;
  }

  return Math.min(normalizedValue, maxValue);
}

function resolveOffset(value: number, defaultValue: number): number {
  if (!Number.isFinite(value)) {
    return defaultValue;
  }

  const normalizedValue = Math.floor(value);

  return normalizedValue >= 0 ? normalizedValue : defaultValue;
}

function resolveRangeEnd(offset: number, limit: number): number {
  return offset + limit - 1;
}

function resolveTotal(count: number | null): number {
  return typeof count === 'number' && Number.isFinite(count) ? count : 0;
}

function startOfIsoDate(value: string): string {
  return `${value}T00:00:00.000Z`;
}

function endOfIsoDate(value: string): string {
  return `${value}T23:59:59.999Z`;
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function firstRpcRow<TRecord>(
  data: readonly TRecord[] | null,
  fallbackMessage: string,
): TRecord {
  const firstRecord = data?.[0];

  if (typeof firstRecord !== 'undefined') {
    return firstRecord;
  }

  throw AppError.databaseOperationFailed(new Error(fallbackMessage));
}

@Injectable()
export class PaymentRepository {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly adminClient: LAFAMSupabaseClient,
  ) {}

  async createPayment(payload: PaymentCreateRecord): Promise<PaymentRecord> {
    const { data, error } = await this.adminClient
      .from('payments')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data;
  }

  async createPaymentIntentAtomic(
    input: CreatePaymentIntentAtomicInput,
  ): Promise<CreatePaymentIntentAtomicResult> {
    const { data, error } = await this.adminClient.rpc(
      'create_payment_intent_atomic',
      {
        p_user_id: input.user_id,
        p_target_type: input.target_type,
        p_booking_id: input.booking_id,
        p_private_booking_id: input.private_booking_id,
        p_amount: input.amount,
        p_discount_amount: input.discount_amount,
        p_final_amount: input.final_amount,
        p_currency: input.currency,
        p_payment_method: input.payment_method,
        p_payment_provider: input.payment_provider,
        p_status: input.status,
        p_redirect_url: input.redirect_url,
        p_callback_url: input.callback_url,
        p_gateway_reference: input.gateway_reference,
        p_gateway_payment_id: input.gateway_payment_id,
        p_gateway_invoice_id: input.gateway_invoice_id,
        p_expires_at: input.expires_at,
        p_idempotency_key: input.idempotency_key,
        p_metadata: input.metadata,
      },
    );

    if (error) {
      throw mapDatabaseError(error);
    }

    return firstRpcRow<CreatePaymentIntentAtomicResult>(
      data,
      'create_payment_intent_atomic did not return a payment result.',
    );
  }

  async updatePayment(
    paymentId: string,
    patch: PaymentUpdateRecord,
  ): Promise<PaymentRecord> {
    const { data, error } = await this.adminClient
      .from('payments')
      .update(patch)
      .eq('id', paymentId)
      .select('*')
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    if (!data) {
      throw AppError.paymentNotFound('The requested payment was not found.', {
        payment_id: paymentId,
      });
    }

    return data;
  }

  async findPaymentById(paymentId: string): Promise<PaymentRecord | null> {
    const { data, error } = await this.adminClient
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data;
  }

  async findPaymentByIdForUser(
    paymentId: string,
    userId: string,
  ): Promise<PaymentRecord | null> {
    const { data, error } = await this.adminClient
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data;
  }

  async findPaymentByReferences(
    input: PaymentReferenceLookupInput,
  ): Promise<PaymentRecord | null> {
    if (hasText(input.payment_id)) {
      return this.findPaymentById(input.payment_id);
    }

    if (hasText(input.provider_reference)) {
      const { data, error } = await this.adminClient
        .from('payments')
        .select('*')
        .eq('gateway_reference', input.provider_reference)
        .maybeSingle();

      if (error) {
        throw mapDatabaseError(error);
      }

      return data;
    }

    if (hasText(input.gateway_payment_id)) {
      const { data, error } = await this.adminClient
        .from('payments')
        .select('*')
        .eq('gateway_payment_id', input.gateway_payment_id)
        .maybeSingle();

      if (error) {
        throw mapDatabaseError(error);
      }

      return data;
    }

    if (hasText(input.gateway_invoice_id)) {
      const { data, error } = await this.adminClient
        .from('payments')
        .select('*')
        .eq('gateway_invoice_id', input.gateway_invoice_id)
        .maybeSingle();

      if (error) {
        throw mapDatabaseError(error);
      }

      return data;
    }

    return null;
  }

  async listPayments(
    input: PaymentListQuery,
  ): Promise<PaymentRepositoryListResult<PaymentRecord>> {
    const limit = resolveLimit(
      input.limit,
      PAYMENT_LIST_DEFAULT_LIMIT,
      PAYMENT_LIST_MAX_LIMIT,
    );
    const offset = resolveOffset(input.offset, PAYMENT_LIST_DEFAULT_OFFSET);

    let query = this.adminClient
      .from('payments')
      .select('*', { count: 'exact' });

    if (input.user_id) {
      query = query.eq('user_id', input.user_id);
    }

    if (input.target_type) {
      query = query.eq('target_type', input.target_type);
    }

    if (input.booking_id) {
      query = query.eq('booking_id', input.booking_id);
    }

    if (input.private_booking_id) {
      query = query.eq('private_booking_id', input.private_booking_id);
    }

    if (input.payment_method) {
      query = query.eq('payment_method', input.payment_method);
    }

    if (input.payment_provider) {
      query = query.eq('payment_provider', input.payment_provider);
    }

    if (input.status) {
      query = query.eq('status', input.status);
    }

    if (input.from_date) {
      query = query.gte('created_at', startOfIsoDate(input.from_date));
    }

    if (input.to_date) {
      query = query.lte('created_at', endOfIsoDate(input.to_date));
    }

    const { data, error, count } = await query
      .order(input.sort_by, {
        ascending: input.sort_direction === 'asc',
      })
      .range(offset, resolveRangeEnd(offset, limit));

    if (error) {
      throw mapDatabaseError(error);
    }

    return {
      records: data ?? [],
      total: resolveTotal(count),
    };
  }

  async listCustomerPayments(
    input: CustomerPaymentListQuery,
  ): Promise<PaymentRepositoryListResult<PaymentRecord>> {
    const limit = resolveLimit(
      input.limit,
      PAYMENT_LIST_DEFAULT_LIMIT,
      PAYMENT_LIST_MAX_LIMIT,
    );
    const offset = resolveOffset(input.offset, PAYMENT_LIST_DEFAULT_OFFSET);

    let query = this.adminClient
      .from('payments')
      .select('*', { count: 'exact' })
      .eq('user_id', input.user_id);

    if (input.target_type) {
      query = query.eq('target_type', input.target_type);
    }

    if (input.status) {
      query = query.eq('status', input.status);
    }

    if (input.from_date) {
      query = query.gte('created_at', startOfIsoDate(input.from_date));
    }

    if (input.to_date) {
      query = query.lte('created_at', endOfIsoDate(input.to_date));
    }

    const { data, error, count } = await query
      .order(input.sort_by, {
        ascending: input.sort_direction === 'asc',
      })
      .range(offset, resolveRangeEnd(offset, limit));

    if (error) {
      throw mapDatabaseError(error);
    }

    return {
      records: data ?? [],
      total: resolveTotal(count),
    };
  }

  async createPaymentTransaction(
    payload: PaymentTransactionCreateRecord,
  ): Promise<PaymentTransactionRecord> {
    const { data, error } = await this.adminClient
      .from('payment_transactions')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data;
  }

  async listPaymentTransactions(
    input: PaymentTransactionListQuery,
  ): Promise<PaymentRepositoryListResult<PaymentTransactionRecord>> {
    const limit = resolveLimit(
      input.limit,
      PAYMENT_TRANSACTION_LIST_DEFAULT_LIMIT,
      PAYMENT_TRANSACTION_LIST_MAX_LIMIT,
    );
    const offset = resolveOffset(
      input.offset,
      PAYMENT_TRANSACTION_LIST_DEFAULT_OFFSET,
    );

    let query = this.adminClient
      .from('payment_transactions')
      .select('*', { count: 'exact' })
      .eq('payment_id', input.payment_id);

    if (input.transaction_type) {
      query = query.eq('transaction_type', input.transaction_type);
    }

    if (input.transaction_status) {
      query = query.eq('transaction_status', input.transaction_status);
    }

    const { data, error, count } = await query
      .order(input.sort_by, {
        ascending: input.sort_direction === 'asc',
      })
      .range(offset, resolveRangeEnd(offset, limit));

    if (error) {
      throw mapDatabaseError(error);
    }

    return {
      records: data ?? [],
      total: resolveTotal(count),
    };
  }

  async findPaymentTransactions(
    paymentId: string,
  ): Promise<readonly PaymentTransactionRecord[]> {
    const { data, error } = await this.adminClient
      .from('payment_transactions')
      .select('*')
      .eq('payment_id', paymentId)
      .order('created_at', { ascending: false });

    if (error) {
      throw mapDatabaseError(error);
    }

    return data ?? [];
  }

  async createPaymentDiscount(
    payload: PaymentDiscountCreateRecord,
  ): Promise<PaymentDiscountRecord> {
    const { data, error } = await this.adminClient
      .from('payment_discounts')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data;
  }

  async findPaymentDiscounts(
    paymentId: string,
  ): Promise<readonly PaymentDiscountRecord[]> {
    const { data, error } = await this.adminClient
      .from('payment_discounts')
      .select('*')
      .eq('payment_id', paymentId)
      .order('created_at', { ascending: true });

    if (error) {
      throw mapDatabaseError(error);
    }

    return data ?? [];
  }

  async findActivePromoCodeByCode(
    code: string,
  ): Promise<PromoCodeRecord | null> {
    const normalizedCode = code.trim().toUpperCase();

    if (normalizedCode.length === 0) {
      return null;
    }

    const { data, error } = await this.adminClient
      .from('promo_codes')
      .select('*')
      .eq('code', normalizedCode)
      .eq('status', 'active')
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data;
  }

  async markPaymentPaidAtomic(
    input: MarkPaymentPaidAtomicInput,
  ): Promise<MarkPaymentPaidAtomicResult> {
    const { data, error } = await this.adminClient.rpc(
      'mark_payment_paid_atomic',
      {
        p_payment_id: input.payment_id,
        p_provider_reference: input.provider_reference ?? null,
        p_gateway_payment_id: input.gateway_payment_id ?? null,
        p_gateway_invoice_id: input.gateway_invoice_id ?? null,
        p_gateway_response: input.gateway_response ?? {},
        p_webhook_verified: input.webhook_verified ?? false,
        p_next_status: PAYMENT_STATUS_PAID,
      },
    );

    if (error) {
      throw mapDatabaseError(error);
    }

    return firstRpcRow<MarkPaymentPaidAtomicResult>(
      data,
      'mark_payment_paid_atomic did not return a payment result.',
    );
  }

  async markPaymentFailedAtomic(
    input: MarkPaymentFailedAtomicInput,
  ): Promise<MarkPaymentFailedAtomicResult> {
    const { data, error } = await this.adminClient.rpc(
      'mark_payment_failed_atomic',
      {
        p_payment_id: input.payment_id,
        p_failure_code: input.failure_code ?? null,
        p_failure_message: input.failure_message ?? null,
        p_gateway_response: input.gateway_response ?? {},
        p_next_status: PAYMENT_STATUS_FAILED,
      },
    );

    if (error) {
      throw mapDatabaseError(error);
    }

    return firstRpcRow<MarkPaymentFailedAtomicResult>(
      data,
      'mark_payment_failed_atomic did not return a payment result.',
    );
  }

  async markPaymentCancelledAtomic(
    input: MarkPaymentCancelledAtomicInput,
  ): Promise<MarkPaymentCancelledAtomicResult> {
    const { data, error } = await this.adminClient.rpc(
      'mark_payment_cancelled_atomic',
      {
        p_payment_id: input.payment_id,
        p_reason: input.reason ?? null,
        p_gateway_response: input.gateway_response ?? {},
        p_next_status: PAYMENT_STATUS_CANCELLED,
      },
    );

    if (error) {
      throw mapDatabaseError(error);
    }

    return firstRpcRow<MarkPaymentCancelledAtomicResult>(
      data,
      'mark_payment_cancelled_atomic did not return a payment result.',
    );
  }

  async expirePaymentIntentsAtomic(): Promise<
    readonly ExpirePaymentIntentsAtomicResult[]
  > {
    const { data, error } = await this.adminClient.rpc(
      'expire_payment_intents_atomic',
    );

    if (error) {
      throw mapDatabaseError(error);
    }

    return data ?? [];
  }

  async refundPaymentAtomic(
    input: RefundPaymentAtomicInput,
  ): Promise<RefundPaymentAtomicResult> {
    const { data, error } = await this.adminClient.rpc(
      'refund_payment_atomic',
      {
        p_payment_id: input.payment_id,
        p_actor_admin_id: input.actor_admin_id,
        p_reason: input.reason,
        p_refund_amount: input.refund_amount ?? null,
        p_gateway_response: input.gateway_response ?? {},
      },
    );

    if (error) {
      throw mapDatabaseError(error);
    }

    return firstRpcRow<RefundPaymentAtomicResult>(
      data,
      'refund_payment_atomic did not return a payment result.',
    );
  }
}
