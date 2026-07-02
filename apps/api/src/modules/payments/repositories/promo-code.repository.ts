import { Inject, Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { SUPABASE_ADMIN_CLIENT } from '../../../database/database.constants';
import type { LAFAMSupabaseClient } from '../../../database/database.types';
import type {
  PromoCodeSortDirection,
  PromoCodeSortField,
} from '../dto/list-promo-codes-query.dto';
import type {
  PromoCodeRedemptionSortDirection,
  PromoCodeRedemptionSortField,
  PromoCodeRedemptionStatus,
} from '../dto/list-promo-code-redemptions-query.dto';
import type {
  PaymentDiscountRecord,
  PaymentRepositoryListResult,
  PaymentRecord,
  PromoCodeCreateRecord,
  PromoCodeRecord,
  PromoCodeUpdateRecord,
} from '../types/payment.types';

interface ProviderDatabaseError {
  readonly code?: string;
  readonly details?: string;
  readonly hint?: string;
  readonly message?: string;
}

export interface PromoCodeListQuery {
  readonly created_by_admin_id?: string;
  readonly discount_type?: PromoCodeRecord['discount_type'];
  readonly ends_from?: string;
  readonly ends_to?: string;
  readonly include_deleted: boolean;
  readonly limit: number;
  readonly offset: number;
  readonly search?: string;
  readonly sort_by: PromoCodeSortField;
  readonly sort_direction: PromoCodeSortDirection;
  readonly starts_from?: string;
  readonly starts_to?: string;
  readonly status?: PromoCodeRecord['status'];
}

export interface PromoCodeRedemptionListQuery {
  readonly booking_id?: string;
  readonly booking_order_id?: string;
  readonly from_date?: string;
  readonly limit: number;
  readonly offset: number;
  readonly payment_id?: string;
  readonly private_booking_id?: string;
  readonly sort_by: PromoCodeRedemptionSortField;
  readonly sort_direction: PromoCodeRedemptionSortDirection;
  readonly status?: PromoCodeRedemptionStatus;
  readonly target_type?: PaymentRecord['target_type'];
  readonly to_date?: string;
  readonly user_id?: string;
}

export interface PromoCodeRedemptionRecord {
  readonly discount: PaymentDiscountRecord;
  readonly payment: PaymentRecord | null;
}

function isProviderDatabaseError(
  error: unknown,
): error is ProviderDatabaseError {
  return typeof error === 'object' && error !== null;
}

function mapDatabaseError(error: unknown): AppError {
  if (!isProviderDatabaseError(error)) {
    return AppError.databaseOperationFailed(error);
  }

  if (error.code === '23505') {
    return AppError.conflict('Promo code already exists.', {
      provider_code: error.code,
      provider_details: error.details,
    });
  }

  if (error.code === '23503' || error.code === '23514') {
    return AppError.invalidRequest(
      'The submitted promo-code data is invalid.',
      {
        provider_code: error.code,
        provider_details: error.details,
        provider_hint: error.hint,
      },
    );
  }

  return AppError.databaseOperationFailed(error);
}

function resolveLimit(value: number): number {
  if (!Number.isFinite(value)) return 20;

  return Math.min(Math.max(1, Math.floor(value)), 100);
}

function resolveOffset(value: number): number {
  if (!Number.isFinite(value)) return 0;

  return Math.max(0, Math.floor(value));
}

function resolveRangeEnd(offset: number, limit: number): number {
  return offset + limit - 1;
}

function resolveTotal(count: number | null): number {
  return typeof count === 'number' && Number.isFinite(count) ? count : 0;
}

function normalizeSearch(value: string): string {
  return value.trim().replaceAll(',', ' ');
}

function hasPaymentRedemptionFilters(
  input: PromoCodeRedemptionListQuery,
): boolean {
  return Boolean(
    input.booking_id ||
    input.booking_order_id ||
    input.payment_id ||
    input.private_booking_id ||
    input.target_type ||
    input.user_id,
  );
}

function resolvePaymentIds(
  payments: readonly Pick<PaymentRecord, 'id'>[],
): string[] {
  return payments.map((payment) => payment.id);
}

@Injectable()
export class PromoCodeRepository {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly adminClient: LAFAMSupabaseClient,
  ) {}

  async createPromoCode(
    payload: PromoCodeCreateRecord,
  ): Promise<PromoCodeRecord> {
    const { data, error } = await this.adminClient
      .from('promo_codes')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data;
  }

  async findById(promoCodeId: string): Promise<PromoCodeRecord | null> {
    const { data, error } = await this.adminClient
      .from('promo_codes')
      .select('*')
      .eq('id', promoCodeId)
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data;
  }

  async listPromoCodes(
    input: PromoCodeListQuery,
  ): Promise<PaymentRepositoryListResult<PromoCodeRecord>> {
    const limit = resolveLimit(input.limit);
    const offset = resolveOffset(input.offset);

    let query = this.adminClient
      .from('promo_codes')
      .select('*', { count: 'exact' });

    if (!input.include_deleted) {
      query = query.is('deleted_at', null).neq('status', 'deleted');
    }

    if (input.search) {
      const search = normalizeSearch(input.search);
      query = query.or(`code.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (input.status) {
      query = query.eq('status', input.status);
    }

    if (input.discount_type) {
      query = query.eq('discount_type', input.discount_type);
    }

    if (input.created_by_admin_id) {
      query = query.eq('created_by_admin_id', input.created_by_admin_id);
    }

    if (input.starts_from) {
      query = query.gte('starts_at', input.starts_from);
    }

    if (input.starts_to) {
      query = query.lte('starts_at', input.starts_to);
    }

    if (input.ends_from) {
      query = query.gte('ends_at', input.ends_from);
    }

    if (input.ends_to) {
      query = query.lte('ends_at', input.ends_to);
    }

    const { data, error, count } = await query
      .order(input.sort_by, {
        ascending: input.sort_direction === 'asc',
        nullsFirst: false,
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

  async listPromoCodeRedemptions(
    promoCodeId: string,
    input: PromoCodeRedemptionListQuery,
  ): Promise<PaymentRepositoryListResult<PromoCodeRedemptionRecord>> {
    if (input.status && input.status !== 'redeemed') {
      return { records: [], total: 0 };
    }

    const limit = resolveLimit(input.limit);
    const offset = resolveOffset(input.offset);
    let paymentIdsFilter: string[] | null = null;

    if (hasPaymentRedemptionFilters(input)) {
      let paymentsQuery = this.adminClient.from('payments').select('id');

      if (input.payment_id) {
        paymentsQuery = paymentsQuery.eq('id', input.payment_id);
      }

      if (input.user_id) {
        paymentsQuery = paymentsQuery.eq('user_id', input.user_id);
      }

      if (input.target_type) {
        paymentsQuery = paymentsQuery.eq('target_type', input.target_type);
      }

      if (input.booking_id) {
        paymentsQuery = paymentsQuery.eq('booking_id', input.booking_id);
      }

      if (input.private_booking_id) {
        paymentsQuery = paymentsQuery.eq(
          'private_booking_id',
          input.private_booking_id,
        );
      }

      if (input.booking_order_id) {
        paymentsQuery = paymentsQuery.eq(
          'booking_order_id',
          input.booking_order_id,
        );
      }

      const { data: paymentIds, error: paymentIdsError } = await paymentsQuery;

      if (paymentIdsError) {
        throw mapDatabaseError(paymentIdsError);
      }

      paymentIdsFilter = resolvePaymentIds(paymentIds ?? []);

      if (paymentIdsFilter.length === 0) {
        return { records: [], total: 0 };
      }
    }

    let discountsQuery = this.adminClient
      .from('payment_discounts')
      .select('*', { count: 'exact' })
      .eq('promo_code_id', promoCodeId);

    if (paymentIdsFilter) {
      discountsQuery = discountsQuery.in('payment_id', paymentIdsFilter);
    }

    if (input.from_date) {
      discountsQuery = discountsQuery.gte('created_at', input.from_date);
    }

    if (input.to_date) {
      discountsQuery = discountsQuery.lte('created_at', input.to_date);
    }

    const {
      data: discounts,
      error,
      count,
    } = await discountsQuery
      .order('created_at', {
        ascending: input.sort_direction === 'asc',
        nullsFirst: false,
      })
      .range(offset, resolveRangeEnd(offset, limit));

    if (error) {
      throw mapDatabaseError(error);
    }

    const paymentIds = [
      ...new Set((discounts ?? []).map((discount) => discount.payment_id)),
    ];

    if (paymentIds.length === 0) {
      return { records: [], total: resolveTotal(count) };
    }

    const { data: payments, error: paymentsError } = await this.adminClient
      .from('payments')
      .select('*')
      .in('id', paymentIds);

    if (paymentsError) {
      throw mapDatabaseError(paymentsError);
    }

    const paymentById = new Map(
      (payments ?? []).map((payment) => [payment.id, payment] as const),
    );

    return {
      records: (discounts ?? []).map((discount) => ({
        discount,
        payment: paymentById.get(discount.payment_id) ?? null,
      })),
      total: resolveTotal(count),
    };
  }

  async updatePromoCode(
    promoCodeId: string,
    patch: PromoCodeUpdateRecord,
  ): Promise<PromoCodeRecord> {
    const { data, error } = await this.adminClient
      .from('promo_codes')
      .update(patch)
      .eq('id', promoCodeId)
      .select('*')
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    if (!data) {
      throw AppError.notFound('The requested promo code was not found.', {
        promo_code_id: promoCodeId,
      });
    }

    return data;
  }
}
