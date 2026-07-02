// apps/api/src/modules/promo-codes/repositories/promo-code.repository.ts
/**
 * LAFAM Promo Code repository.
 *
 * Role:
 * - Owns Promo Code Module database access.
 * - Persists promo-code definitions, target restrictions, redemption records, and payment-discount audit links.
 * - Wraps atomic PostgreSQL RPC calls for reservation, payment attachment, redemption finalization, release, and expiry cleanup.
 * - Hydrates promo codes with class, schedule, trainer, and customer target records.
 * - Converts database/RPC failures into frontend-safe AppError instances.
 *
 * Important:
 * - This repository does not perform authorization.
 * - This repository does not decide promo-code business rules.
 * - This repository does not calculate trusted discount amounts.
 * - This repository does not create payments, confirm bookings, mutate wallets, or process refunds.
 * - Services and domain policies remain the business-rule authority.
 * - Atomic database RPCs own reservation/redeem/release mutation safety.
 */

import { Inject, Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { SUPABASE_ADMIN_CLIENT } from '../../../database/database.constants';
import type {
  DatabaseJsonObject,
  LAFAMSupabaseClient,
} from '../../../database/database.types';
import {
  PROMO_CODE_ACTIVE_REDEMPTION_STATUSES,
  PROMO_CODE_ALLOWED_TARGET_TYPES,
  PROMO_CODE_DEFAULT_SORT_DIRECTION,
  PROMO_CODE_DEFAULT_SORT_FIELD,
  PROMO_CODE_LIST_DEFAULT_LIMIT,
  PROMO_CODE_LIST_DEFAULT_OFFSET,
  PROMO_CODE_LIST_MAX_LIMIT,
  PROMO_CODE_REDEMPTION_DEFAULT_SORT_DIRECTION,
  PROMO_CODE_REDEMPTION_DEFAULT_SORT_FIELD,
  PROMO_CODE_REDEMPTION_LIST_DEFAULT_LIMIT,
  PROMO_CODE_REDEMPTION_LIST_DEFAULT_OFFSET,
  PROMO_CODE_REDEMPTION_LIST_MAX_LIMIT,
  PROMO_CODE_RPC,
} from '../constants/promo-code.constants';
import { PromoCodePolicy } from '../domain/promo-code.policy';
import type {
  AttachPromoCodeRedemptionPaymentResult,
  MarkPromoCodeRedemptionRedeemedResult,
  PromoCodeAttachPaymentInput,
  PromoCodeCreateRepositoryInput,
  PromoCodeHydratedRecord,
  PromoCodeListFilters,
  PromoCodeListResult,
  PromoCodeRecord,
  PromoCodeRedemptionListFilters,
  PromoCodeRedemptionListResult,
  PromoCodeRedemptionRecord,
  PromoCodeReleaseExpiredInput,
  PromoCodeReleaseInput,
  PromoCodeReserveInput,
  PromoCodeTargetIds,
  PromoCodeTargetRecords,
  PromoCodeUpdateRepositoryInput,
  ReleaseExpiredPromoCodeRedemptionsResult,
  ReleasePromoCodeRedemptionResult,
  ReservePromoCodeRedemptionResult,
} from '../types/promo-code.types';

const POSTGRES_UNIQUE_VIOLATION_CODE = '23505';
const POSTGRES_FOREIGN_KEY_VIOLATION_CODE = '23503';
const POSTGRES_CHECK_VIOLATION_CODE = '23514';
const POSTGRES_NOT_NULL_VIOLATION_CODE = '23502';
const POSTGRES_RAISE_EXCEPTION_CODE = 'P0001';

interface DatabaseErrorShape {
  readonly code?: string;
  readonly message?: string;
  readonly details?: string | null;
  readonly hint?: string | null;
}

interface PromoCodeStatusUpdateInput {
  readonly promo_code_id: string;
  readonly status: PromoCodeRecord['status'];
  readonly updated_by_admin_id: string;
}

interface PromoCodeSoftDeleteInput {
  readonly promo_code_id: string;
  readonly updated_by_admin_id: string;
}

interface PromoCodeCodeLookupInput {
  readonly code: string;
  readonly include_deleted?: boolean;
}

interface PromoCodeRedemptionCountInput {
  readonly promo_code_id: string;
  readonly user_id?: string;
  readonly statuses?: readonly PromoCodeRedemptionRecord['status'][];
}

interface PromoCodePriorPaidBookingInput {
  readonly user_id: string;
}

function isDatabaseError(value: unknown): value is DatabaseErrorShape {
  return typeof value === 'object' && value !== null;
}

function databaseErrorText(error: DatabaseErrorShape): string {
  return [error.code, error.message, error.details, error.hint]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
}

function createDatabaseErrorDetails(
  error: DatabaseErrorShape,
): Record<string, unknown> {
  return {
    ...(error.code ? { provider_code: error.code } : {}),
    ...(error.details ? { provider_details: error.details } : {}),
    ...(error.hint ? { provider_hint: error.hint } : {}),
  };
}

function databaseMessageIncludes(
  error: DatabaseErrorShape,
  searchValue: string,
): boolean {
  return databaseErrorText(error).includes(searchValue.toLowerCase());
}

function mapPromoCodeDatabaseError(error: unknown): AppError {
  if (!isDatabaseError(error)) {
    return AppError.databaseOperationFailed(error);
  }

  const details = createDatabaseErrorDetails(error);
  const errorText = databaseErrorText(error);

  if (error.code === POSTGRES_RAISE_EXCEPTION_CODE) {
    if (databaseMessageIncludes(error, 'promo code was not found')) {
      return AppError.promoCodeNotFound(undefined, details);
    }

    if (databaseMessageIncludes(error, 'promo-code redemption was not found')) {
      return AppError.promoCodeRedemptionNotFound(undefined, details);
    }

    if (databaseMessageIncludes(error, 'payment was not found')) {
      return AppError.paymentNotFound('Payment was not found.', details);
    }

    if (databaseMessageIncludes(error, 'promo code is not active')) {
      return AppError.promoCodeNotActive(undefined, details);
    }

    if (databaseMessageIncludes(error, 'promo code is deleted')) {
      return AppError.promoCodeAlreadyDeleted(undefined, details);
    }

    if (databaseMessageIncludes(error, 'promo code has not started')) {
      return AppError.promoCodeNotStarted(undefined, details);
    }

    if (databaseMessageIncludes(error, 'promo code has expired')) {
      return AppError.promoCodeExpired(undefined, details);
    }

    if (
      databaseMessageIncludes(error, 'minimum order amount') ||
      databaseMessageIncludes(error, 'does not meet')
    ) {
      return AppError.promoCodeMinimumOrderNotMet(undefined, details);
    }

    if (
      databaseMessageIncludes(error, 'not allowed for this checkout target') ||
      databaseMessageIncludes(error, 'target reference is invalid') ||
      databaseMessageIncludes(error, 'wallet top-up')
    ) {
      return AppError.promoCodeTargetNotAllowed(undefined, details);
    }

    if (databaseMessageIncludes(error, 'not allowed for this payment method')) {
      return AppError.promoCodePaymentMethodNotAllowed(undefined, details);
    }

    if (databaseMessageIncludes(error, 'per-user redemption limit')) {
      return AppError.promoCodePerUserLimitReached(undefined, details);
    }

    if (databaseMessageIncludes(error, 'global redemption limit')) {
      return AppError.promoCodeGlobalLimitReached(undefined, details);
    }

    if (
      databaseMessageIncludes(error, 'already attached') ||
      databaseMessageIncludes(error, 'does not match') ||
      databaseMessageIncludes(error, 'cannot be redeemed') ||
      databaseMessageIncludes(error, 'can only be finalized') ||
      databaseMessageIncludes(error, 'only reserved or redeemed')
    ) {
      return AppError.promoCodeRedemptionConflict(undefined, details);
    }

    return AppError.promoCodeRedemptionFailed(error);
  }

  if (error.code === POSTGRES_UNIQUE_VIOLATION_CODE) {
    if (
      errorText.includes('promo_codes_code') ||
      errorText.includes('(code)')
    ) {
      return AppError.promoCodeAlreadyExists(undefined, {
        field: 'code',
      });
    }

    if (
      errorText.includes('promo_code_redemptions') ||
      errorText.includes('payment_discounts')
    ) {
      return AppError.promoCodeRedemptionConflict(
        'Duplicate promo-code redemption or payment-discount audit record was detected.',
        details,
      );
    }

    return AppError.conflict(
      'The promo-code record conflicts with an existing database record.',
      details,
    );
  }

  if (error.code === POSTGRES_FOREIGN_KEY_VIOLATION_CODE) {
    return AppError.invalidRequest(
      'A related promo code, class, schedule, trainer, customer, payment, booking, private booking, or booking order record was not found.',
      details,
    );
  }

  if (
    error.code === POSTGRES_CHECK_VIOLATION_CODE ||
    error.code === POSTGRES_NOT_NULL_VIOLATION_CODE
  ) {
    return AppError.invalidRequest(
      'The submitted promo-code data violates database constraints.',
      details,
    );
  }

  return AppError.databaseOperationFailed(error);
}

function normalizeLimit(
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

function normalizeOffset(value: number, defaultValue: number): number {
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

function sanitizePostgrestSearchTerm(value: string): string {
  return value.replace(/[%,()]/gu, '').trim();
}

function hasObjectKeys(value: Record<string, unknown>): boolean {
  return Object.keys(value).length > 0;
}

function getRequiredRpcRow<TRow>(
  rows: readonly TRow[] | null,
  operation: string,
): TRow {
  const row = rows?.[0];

  if (typeof row !== 'undefined') {
    return row;
  }

  throw AppError.promoCodeRedemptionFailed(
    new Error(`${operation} did not return a result row.`),
  );
}

function getOptionalRpcRow<TRow>(rows: readonly TRow[] | null): TRow | null {
  return rows?.[0] ?? null;
}

function normalizePromoCodeListFilters(
  input: PromoCodeListFilters,
): PromoCodeListFilters {
  return {
    ...input,
    include_deleted: input.include_deleted === true,
    limit: normalizeLimit(
      input.limit,
      PROMO_CODE_LIST_DEFAULT_LIMIT,
      PROMO_CODE_LIST_MAX_LIMIT,
    ),
    offset: normalizeOffset(input.offset, PROMO_CODE_LIST_DEFAULT_OFFSET),
    sort_by: input.sort_by ?? PROMO_CODE_DEFAULT_SORT_FIELD,
    sort_direction: input.sort_direction ?? PROMO_CODE_DEFAULT_SORT_DIRECTION,
  };
}

function normalizePromoCodeRedemptionListFilters(
  input: PromoCodeRedemptionListFilters,
): PromoCodeRedemptionListFilters {
  return {
    ...input,
    limit: normalizeLimit(
      input.limit,
      PROMO_CODE_REDEMPTION_LIST_DEFAULT_LIMIT,
      PROMO_CODE_REDEMPTION_LIST_MAX_LIMIT,
    ),
    offset: normalizeOffset(
      input.offset,
      PROMO_CODE_REDEMPTION_LIST_DEFAULT_OFFSET,
    ),
    sort_by: input.sort_by ?? PROMO_CODE_REDEMPTION_DEFAULT_SORT_FIELD,
    sort_direction:
      input.sort_direction ?? PROMO_CODE_REDEMPTION_DEFAULT_SORT_DIRECTION,
  };
}

function buildTargetRecordsByPromoCodeId<
  TRecord extends { promo_code_id: string },
>(records: readonly TRecord[]): Map<string, TRecord[]> {
  const recordsByPromoCodeId = new Map<string, TRecord[]>();

  for (const record of records) {
    const existingRecords =
      recordsByPromoCodeId.get(record.promo_code_id) ?? [];

    existingRecords.push(record);
    recordsByPromoCodeId.set(record.promo_code_id, existingRecords);
  }

  return recordsByPromoCodeId;
}

@Injectable()
export class PromoCodeRepository {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly adminClient: LAFAMSupabaseClient,
  ) {}

  async createPromoCode(
    input: PromoCodeCreateRepositoryInput,
  ): Promise<PromoCodeHydratedRecord> {
    const { data, error } = await this.adminClient
      .from('promo_codes')
      .insert(input.promo_code)
      .select('*')
      .single();

    if (error) {
      throw mapPromoCodeDatabaseError(error);
    }

    try {
      await this.insertAllTargetRecords(data.id, input.target_ids);

      return this.getPromoCodeByIdOrThrow(data.id);
    } catch (targetError: unknown) {
      await this.rollbackCreatedPromoCode(data.id);

      throw targetError;
    }
  }

  async updatePromoCode(
    input: PromoCodeUpdateRepositoryInput,
  ): Promise<PromoCodeHydratedRecord> {
    if (hasObjectKeys(input.promo_code)) {
      const { error } = await this.adminClient
        .from('promo_codes')
        .update(input.promo_code)
        .eq('id', input.promo_code_id);

      if (error) {
        throw mapPromoCodeDatabaseError(error);
      }
    }

    if (input.target_ids !== undefined) {
      await this.replaceSelectedTargetRecords(
        input.promo_code_id,
        input.target_ids,
      );
    }

    return this.getPromoCodeByIdOrThrow(input.promo_code_id);
  }

  async setPromoCodeStatus(
    input: PromoCodeStatusUpdateInput,
  ): Promise<PromoCodeHydratedRecord> {
    const { data, error } = await this.adminClient
      .from('promo_codes')
      .update({
        status: input.status,
        updated_by_admin_id: input.updated_by_admin_id,
      })
      .eq('id', input.promo_code_id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw mapPromoCodeDatabaseError(error);
    }

    if (!data) {
      throw AppError.promoCodeNotFound(undefined, {
        promo_code_id: input.promo_code_id,
      });
    }

    return this.hydratePromoCodeRecord(data);
  }

  async softDeletePromoCode(
    input: PromoCodeSoftDeleteInput,
  ): Promise<PromoCodeHydratedRecord> {
    const { data, error } = await this.adminClient
      .from('promo_codes')
      .update({
        status: 'deleted',
        deleted_at: new Date().toISOString(),
        updated_by_admin_id: input.updated_by_admin_id,
      })
      .eq('id', input.promo_code_id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw mapPromoCodeDatabaseError(error);
    }

    if (!data) {
      throw AppError.promoCodeNotFound(undefined, {
        promo_code_id: input.promo_code_id,
      });
    }

    return this.hydratePromoCodeRecord(data);
  }

  async markPromoCodeExhausted(
    promoCodeId: string,
  ): Promise<PromoCodeRecord | null> {
    const { data, error } = await this.adminClient
      .from('promo_codes')
      .update({
        status: 'exhausted',
      })
      .eq('id', promoCodeId)
      .select('*')
      .maybeSingle();

    if (error) {
      throw mapPromoCodeDatabaseError(error);
    }

    return data;
  }

  async findPromoCodeById(
    promoCodeId: string,
  ): Promise<PromoCodeHydratedRecord | null> {
    const { data, error } = await this.adminClient
      .from('promo_codes')
      .select('*')
      .eq('id', promoCodeId)
      .maybeSingle();

    if (error) {
      throw mapPromoCodeDatabaseError(error);
    }

    return data ? this.hydratePromoCodeRecord(data) : null;
  }

  async getPromoCodeByIdOrThrow(
    promoCodeId: string,
  ): Promise<PromoCodeHydratedRecord> {
    const promoCode = await this.findPromoCodeById(promoCodeId);

    if (!promoCode) {
      throw AppError.promoCodeNotFound(undefined, {
        promo_code_id: promoCodeId,
      });
    }

    return promoCode;
  }

  async findPromoCodeRecordById(
    promoCodeId: string,
  ): Promise<PromoCodeRecord | null> {
    const { data, error } = await this.adminClient
      .from('promo_codes')
      .select('*')
      .eq('id', promoCodeId)
      .maybeSingle();

    if (error) {
      throw mapPromoCodeDatabaseError(error);
    }

    return data;
  }

  async findPromoCodeByCode(
    input: PromoCodeCodeLookupInput,
  ): Promise<PromoCodeHydratedRecord | null> {
    const normalizedCode = PromoCodePolicy.normalizeCode(input.code);

    if (normalizedCode.length === 0) {
      return null;
    }

    let query = this.adminClient
      .from('promo_codes')
      .select('*')
      .eq('code', normalizedCode);

    if (input.include_deleted !== true) {
      query = query.is('deleted_at', null);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw mapPromoCodeDatabaseError(error);
    }

    return data ? this.hydratePromoCodeRecord(data) : null;
  }

  async findActivePromoCodeByCode(
    code: string,
  ): Promise<PromoCodeHydratedRecord | null> {
    const normalizedCode = PromoCodePolicy.normalizeCode(code);

    if (normalizedCode.length === 0) {
      return null;
    }

    const { data, error } = await this.adminClient
      .from('promo_codes')
      .select('*')
      .eq('code', normalizedCode)
      .eq('status', 'active')
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      throw mapPromoCodeDatabaseError(error);
    }

    return data ? this.hydratePromoCodeRecord(data) : null;
  }

  async listPromoCodes(
    input: PromoCodeListFilters,
  ): Promise<PromoCodeListResult> {
    const filters = normalizePromoCodeListFilters(input);

    let query = this.adminClient
      .from('promo_codes')
      .select('*', { count: 'exact' });

    if (filters.include_deleted !== true) {
      query = query.is('deleted_at', null);
    }

    if (filters.search) {
      const searchTerm = sanitizePostgrestSearchTerm(filters.search);

      if (searchTerm.length > 0) {
        query = query.or(
          `code.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`,
        );
      }
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.discount_type) {
      query = query.eq('discount_type', filters.discount_type);
    }

    if (filters.target_type) {
      query = query.contains('allowed_target_types', [filters.target_type]);
    }

    if (filters.payment_method) {
      query = query.contains('allowed_payment_methods', [
        filters.payment_method,
      ]);
    }

    if (filters.created_by_admin_id) {
      query = query.eq('created_by_admin_id', filters.created_by_admin_id);
    }

    if (filters.created_by_role) {
      query = query.eq('created_by_role', filters.created_by_role);
    }

    if (filters.starts_from) {
      query = query.gte('starts_at', filters.starts_from);
    }

    if (filters.starts_to) {
      query = query.lte('starts_at', filters.starts_to);
    }

    if (filters.ends_from) {
      query = query.gte('ends_at', filters.ends_from);
    }

    if (filters.ends_to) {
      query = query.lte('ends_at', filters.ends_to);
    }

    const { data, error, count } = await query
      .order(filters.sort_by, {
        ascending: filters.sort_direction === 'asc',
      })
      .range(filters.offset, resolveRangeEnd(filters.offset, filters.limit));

    if (error) {
      throw mapPromoCodeDatabaseError(error);
    }

    const records = await this.hydratePromoCodeRecords(data ?? []);

    return {
      records,
      total: resolveTotal(count),
    };
  }

  async listRedemptions(
    input: PromoCodeRedemptionListFilters,
  ): Promise<PromoCodeRedemptionListResult> {
    const filters = normalizePromoCodeRedemptionListFilters(input);

    let query = this.adminClient
      .from('promo_code_redemptions')
      .select('*', { count: 'exact' });

    if (filters.promo_code_id) {
      query = query.eq('promo_code_id', filters.promo_code_id);
    }

    if (filters.user_id) {
      query = query.eq('user_id', filters.user_id);
    }

    if (filters.payment_id) {
      query = query.eq('payment_id', filters.payment_id);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.target_type) {
      query = query.eq('target_type', filters.target_type);
    }

    if (filters.booking_id) {
      query = query.eq('booking_id', filters.booking_id);
    }

    if (filters.private_booking_id) {
      query = query.eq('private_booking_id', filters.private_booking_id);
    }

    if (filters.booking_order_id) {
      query = query.eq('booking_order_id', filters.booking_order_id);
    }

    if (filters.from_date) {
      query = query.gte('created_at', filters.from_date);
    }

    if (filters.to_date) {
      query = query.lte('created_at', filters.to_date);
    }

    const { data, error, count } = await query
      .order(filters.sort_by, {
        ascending: filters.sort_direction === 'asc',
      })
      .range(filters.offset, resolveRangeEnd(filters.offset, filters.limit));

    if (error) {
      throw mapPromoCodeDatabaseError(error);
    }

    return {
      records: data ?? [],
      total: resolveTotal(count),
    };
  }

  async findRedemptionById(
    redemptionId: string,
  ): Promise<PromoCodeRedemptionRecord | null> {
    const { data, error } = await this.adminClient
      .from('promo_code_redemptions')
      .select('*')
      .eq('id', redemptionId)
      .maybeSingle();

    if (error) {
      throw mapPromoCodeDatabaseError(error);
    }

    return data;
  }

  async findRedemptionByPaymentId(
    paymentId: string,
  ): Promise<PromoCodeRedemptionRecord | null> {
    const { data, error } = await this.adminClient
      .from('promo_code_redemptions')
      .select('*')
      .eq('payment_id', paymentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw mapPromoCodeDatabaseError(error);
    }

    return data;
  }

  async countRedemptions(
    input: PromoCodeRedemptionCountInput,
  ): Promise<number> {
    let query = this.adminClient
      .from('promo_code_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('promo_code_id', input.promo_code_id);

    if (input.user_id) {
      query = query.eq('user_id', input.user_id);
    }

    if (input.statuses && input.statuses.length > 0) {
      query = query.in('status', [...input.statuses]);
    }

    const { error, count } = await query;

    if (error) {
      throw mapPromoCodeDatabaseError(error);
    }

    return resolveTotal(count);
  }

  async countUserActiveRedemptions(input: {
    readonly promo_code_id: string;
    readonly user_id: string;
  }): Promise<number> {
    return this.countRedemptions({
      promo_code_id: input.promo_code_id,
      user_id: input.user_id,
      statuses: [...PROMO_CODE_ACTIVE_REDEMPTION_STATUSES],
    });
  }

  async hasAnyRedemptionsForPromoCode(promoCodeId: string): Promise<boolean> {
    const count = await this.countRedemptions({
      promo_code_id: promoCodeId,
    });

    return count > 0;
  }

  async hasPriorPaidBooking(
    input: PromoCodePriorPaidBookingInput,
  ): Promise<boolean> {
    const { error, count } = await this.adminClient
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', input.user_id)
      .eq('status', 'paid')
      .in('target_type', [...PROMO_CODE_ALLOWED_TARGET_TYPES]);

    if (error) {
      throw mapPromoCodeDatabaseError(error);
    }

    return resolveTotal(count) > 0;
  }

  async reservePromoCodeRedemptionAtomic(
    input: PromoCodeReserveInput & {
      readonly promo_code_id: string;
      readonly pricing: {
        readonly subtotal_amount: number;
        readonly discount_amount: number;
        readonly final_amount: number;
        readonly currency: string;
      };
    },
  ): Promise<ReservePromoCodeRedemptionResult> {
    const { data, error } = await this.adminClient.rpc(
      PROMO_CODE_RPC.reserveRedemption,
      {
        p_promo_code_id: input.promo_code_id,
        p_user_id: input.user_id,
        p_payment_method: input.payment_method,
        p_target_type: input.target.target_type,
        p_booking_id: input.target.booking_id ?? null,
        p_private_booking_id: input.target.private_booking_id ?? null,
        p_booking_order_id: input.target.booking_order_id ?? null,
        p_idempotency_key: input.idempotency_key,
        p_subtotal_amount: input.pricing.subtotal_amount,
        p_discount_amount: input.pricing.discount_amount,
        p_final_amount: input.pricing.final_amount,
        p_currency: input.pricing.currency,
        p_expires_at: input.expires_at ?? null,
        p_metadata: input.metadata ?? {},
      },
    );

    if (error) {
      throw mapPromoCodeDatabaseError(error);
    }

    return getRequiredRpcRow<ReservePromoCodeRedemptionResult>(
      data,
      PROMO_CODE_RPC.reserveRedemption,
    );
  }

  async attachPromoCodeRedemptionPaymentAtomic(
    input: PromoCodeAttachPaymentInput,
  ): Promise<AttachPromoCodeRedemptionPaymentResult> {
    const { data, error } = await this.adminClient.rpc(
      PROMO_CODE_RPC.attachPayment,
      {
        p_redemption_id: input.redemption_id,
        p_payment_id: input.payment_id,
        p_metadata: input.metadata ?? {},
      },
    );

    if (error) {
      throw mapPromoCodeDatabaseError(error);
    }

    return getRequiredRpcRow<AttachPromoCodeRedemptionPaymentResult>(
      data,
      PROMO_CODE_RPC.attachPayment,
    );
  }

  async markPromoCodeRedemptionRedeemedAtomic(input: {
    readonly redemption_id?: string | null;
    readonly payment_id?: string | null;
    readonly metadata?: DatabaseJsonObject;
  }): Promise<MarkPromoCodeRedemptionRedeemedResult> {
    const { data, error } = await this.adminClient.rpc(
      PROMO_CODE_RPC.markRedeemed,
      {
        p_redemption_id: input.redemption_id ?? null,
        p_payment_id: input.payment_id ?? null,
        p_metadata: input.metadata ?? {},
      },
    );

    if (error) {
      throw mapPromoCodeDatabaseError(error);
    }

    return getRequiredRpcRow<MarkPromoCodeRedemptionRedeemedResult>(
      data,
      PROMO_CODE_RPC.markRedeemed,
    );
  }

  async releasePromoCodeRedemptionAtomic(
    input: PromoCodeReleaseInput,
  ): Promise<ReleasePromoCodeRedemptionResult | null> {
    const { data, error } = await this.adminClient.rpc(
      PROMO_CODE_RPC.releaseRedemption,
      {
        p_redemption_id: input.redemption_id ?? null,
        p_payment_id: input.payment_id ?? null,
        p_release_reason: input.release_reason ?? null,
        p_metadata: input.metadata ?? {},
      },
    );

    if (error) {
      throw mapPromoCodeDatabaseError(error);
    }

    return getOptionalRpcRow<ReleasePromoCodeRedemptionResult>(data);
  }

  async releaseExpiredPromoCodeRedemptionsAtomic(
    input: PromoCodeReleaseExpiredInput = {},
  ): Promise<ReleaseExpiredPromoCodeRedemptionsResult> {
    const { data, error } = await this.adminClient.rpc(
      PROMO_CODE_RPC.releaseExpiredRedemptions,
      {
        p_now: input.now,
        p_limit: input.limit,
      },
    );

    if (error) {
      throw mapPromoCodeDatabaseError(error);
    }

    return getRequiredRpcRow<ReleaseExpiredPromoCodeRedemptionsResult>(
      data,
      PROMO_CODE_RPC.releaseExpiredRedemptions,
    );
  }

  private async hydratePromoCodeRecord(
    record: PromoCodeRecord,
  ): Promise<PromoCodeHydratedRecord> {
    const hydratedRecords = await this.hydratePromoCodeRecords([record]);
    const hydratedRecord = hydratedRecords[0];

    if (!hydratedRecord) {
      throw AppError.promoCodeNotFound(undefined, {
        promo_code_id: record.id,
      });
    }

    return hydratedRecord;
  }

  private async hydratePromoCodeRecords(
    records: readonly PromoCodeRecord[],
  ): Promise<readonly PromoCodeHydratedRecord[]> {
    if (records.length === 0) {
      return [];
    }

    const promoCodeIds = [...new Set(records.map((record) => record.id))];
    const targetRecords =
      await this.findTargetRecordsByPromoCodeIds(promoCodeIds);

    const classTargetsByPromoCodeId = buildTargetRecordsByPromoCodeId(
      targetRecords.class_targets,
    );
    const scheduleTargetsByPromoCodeId = buildTargetRecordsByPromoCodeId(
      targetRecords.schedule_targets,
    );
    const trainerTargetsByPromoCodeId = buildTargetRecordsByPromoCodeId(
      targetRecords.trainer_targets,
    );
    const customerTargetsByPromoCodeId = buildTargetRecordsByPromoCodeId(
      targetRecords.customer_targets,
    );

    return records.map((record) => ({
      promo_code: record,
      class_targets: classTargetsByPromoCodeId.get(record.id) ?? [],
      schedule_targets: scheduleTargetsByPromoCodeId.get(record.id) ?? [],
      trainer_targets: trainerTargetsByPromoCodeId.get(record.id) ?? [],
      customer_targets: customerTargetsByPromoCodeId.get(record.id) ?? [],
    }));
  }

  private async findTargetRecordsByPromoCodeIds(
    promoCodeIds: readonly string[],
  ): Promise<PromoCodeTargetRecords> {
    if (promoCodeIds.length === 0) {
      return {
        class_targets: [],
        schedule_targets: [],
        trainer_targets: [],
        customer_targets: [],
      };
    }

    const [classTargets, scheduleTargets, trainerTargets, customerTargets] =
      await Promise.all([
        this.findClassTargetRecords(promoCodeIds),
        this.findScheduleTargetRecords(promoCodeIds),
        this.findTrainerTargetRecords(promoCodeIds),
        this.findCustomerTargetRecords(promoCodeIds),
      ]);

    return {
      class_targets: classTargets,
      schedule_targets: scheduleTargets,
      trainer_targets: trainerTargets,
      customer_targets: customerTargets,
    };
  }

  private async findClassTargetRecords(promoCodeIds: readonly string[]) {
    const { data, error } = await this.adminClient
      .from('promo_code_class_targets')
      .select('*')
      .in('promo_code_id', [...promoCodeIds])
      .order('created_at', { ascending: true });

    if (error) {
      throw mapPromoCodeDatabaseError(error);
    }

    return data ?? [];
  }

  private async findScheduleTargetRecords(promoCodeIds: readonly string[]) {
    const { data, error } = await this.adminClient
      .from('promo_code_schedule_targets')
      .select('*')
      .in('promo_code_id', [...promoCodeIds])
      .order('created_at', { ascending: true });

    if (error) {
      throw mapPromoCodeDatabaseError(error);
    }

    return data ?? [];
  }

  private async findTrainerTargetRecords(promoCodeIds: readonly string[]) {
    const { data, error } = await this.adminClient
      .from('promo_code_trainer_targets')
      .select('*')
      .in('promo_code_id', [...promoCodeIds])
      .order('created_at', { ascending: true });

    if (error) {
      throw mapPromoCodeDatabaseError(error);
    }

    return data ?? [];
  }

  private async findCustomerTargetRecords(promoCodeIds: readonly string[]) {
    const { data, error } = await this.adminClient
      .from('promo_code_customer_targets')
      .select('*')
      .in('promo_code_id', [...promoCodeIds])
      .order('created_at', { ascending: true });

    if (error) {
      throw mapPromoCodeDatabaseError(error);
    }

    return data ?? [];
  }

  private async insertAllTargetRecords(
    promoCodeId: string,
    targetIds: PromoCodeTargetIds,
  ): Promise<void> {
    await Promise.all([
      this.insertClassTargetRecords(promoCodeId, targetIds.class_ids),
      this.insertScheduleTargetRecords(promoCodeId, targetIds.schedule_ids),
      this.insertTrainerTargetRecords(
        promoCodeId,
        targetIds.trainer_staff_profile_ids,
      ),
      this.insertCustomerTargetRecords(
        promoCodeId,
        targetIds.customer_user_ids,
      ),
    ]);
  }

  private async replaceSelectedTargetRecords(
    promoCodeId: string,
    targetIds: {
      readonly class_ids?: readonly string[];
      readonly schedule_ids?: readonly string[];
      readonly trainer_staff_profile_ids?: readonly string[];
      readonly customer_user_ids?: readonly string[];
    },
  ): Promise<void> {
    if (targetIds.class_ids !== undefined) {
      await this.replaceClassTargetRecords(promoCodeId, targetIds.class_ids);
    }

    if (targetIds.schedule_ids !== undefined) {
      await this.replaceScheduleTargetRecords(
        promoCodeId,
        targetIds.schedule_ids,
      );
    }

    if (targetIds.trainer_staff_profile_ids !== undefined) {
      await this.replaceTrainerTargetRecords(
        promoCodeId,
        targetIds.trainer_staff_profile_ids,
      );
    }

    if (targetIds.customer_user_ids !== undefined) {
      await this.replaceCustomerTargetRecords(
        promoCodeId,
        targetIds.customer_user_ids,
      );
    }
  }

  private async replaceClassTargetRecords(
    promoCodeId: string,
    classIds: readonly string[],
  ): Promise<void> {
    await this.deleteClassTargetRecords(promoCodeId);
    await this.insertClassTargetRecords(promoCodeId, classIds);
  }

  private async replaceScheduleTargetRecords(
    promoCodeId: string,
    scheduleIds: readonly string[],
  ): Promise<void> {
    await this.deleteScheduleTargetRecords(promoCodeId);
    await this.insertScheduleTargetRecords(promoCodeId, scheduleIds);
  }

  private async replaceTrainerTargetRecords(
    promoCodeId: string,
    trainerStaffProfileIds: readonly string[],
  ): Promise<void> {
    await this.deleteTrainerTargetRecords(promoCodeId);
    await this.insertTrainerTargetRecords(promoCodeId, trainerStaffProfileIds);
  }

  private async replaceCustomerTargetRecords(
    promoCodeId: string,
    customerUserIds: readonly string[],
  ): Promise<void> {
    await this.deleteCustomerTargetRecords(promoCodeId);
    await this.insertCustomerTargetRecords(promoCodeId, customerUserIds);
  }

  private async insertClassTargetRecords(
    promoCodeId: string,
    classIds: readonly string[],
  ): Promise<void> {
    const normalizedClassIds = [...new Set(classIds)];

    if (normalizedClassIds.length === 0) {
      return;
    }

    const { error } = await this.adminClient
      .from('promo_code_class_targets')
      .insert(
        normalizedClassIds.map((classId) => ({
          promo_code_id: promoCodeId,
          class_id: classId,
        })),
      );

    if (error) {
      throw mapPromoCodeDatabaseError(error);
    }
  }

  private async insertScheduleTargetRecords(
    promoCodeId: string,
    scheduleIds: readonly string[],
  ): Promise<void> {
    const normalizedScheduleIds = [...new Set(scheduleIds)];

    if (normalizedScheduleIds.length === 0) {
      return;
    }

    const { error } = await this.adminClient
      .from('promo_code_schedule_targets')
      .insert(
        normalizedScheduleIds.map((scheduleId) => ({
          promo_code_id: promoCodeId,
          schedule_id: scheduleId,
        })),
      );

    if (error) {
      throw mapPromoCodeDatabaseError(error);
    }
  }

  private async insertTrainerTargetRecords(
    promoCodeId: string,
    trainerStaffProfileIds: readonly string[],
  ): Promise<void> {
    const normalizedTrainerStaffProfileIds = [
      ...new Set(trainerStaffProfileIds),
    ];

    if (normalizedTrainerStaffProfileIds.length === 0) {
      return;
    }

    const { error } = await this.adminClient
      .from('promo_code_trainer_targets')
      .insert(
        normalizedTrainerStaffProfileIds.map((trainerStaffProfileId) => ({
          promo_code_id: promoCodeId,
          trainer_staff_profile_id: trainerStaffProfileId,
        })),
      );

    if (error) {
      throw mapPromoCodeDatabaseError(error);
    }
  }

  private async insertCustomerTargetRecords(
    promoCodeId: string,
    customerUserIds: readonly string[],
  ): Promise<void> {
    const normalizedCustomerUserIds = [...new Set(customerUserIds)];

    if (normalizedCustomerUserIds.length === 0) {
      return;
    }

    const { error } = await this.adminClient
      .from('promo_code_customer_targets')
      .insert(
        normalizedCustomerUserIds.map((customerUserId) => ({
          promo_code_id: promoCodeId,
          customer_user_id: customerUserId,
        })),
      );

    if (error) {
      throw mapPromoCodeDatabaseError(error);
    }
  }

  private async deleteClassTargetRecords(promoCodeId: string): Promise<void> {
    const { error } = await this.adminClient
      .from('promo_code_class_targets')
      .delete()
      .eq('promo_code_id', promoCodeId);

    if (error) {
      throw mapPromoCodeDatabaseError(error);
    }
  }

  private async deleteScheduleTargetRecords(
    promoCodeId: string,
  ): Promise<void> {
    const { error } = await this.adminClient
      .from('promo_code_schedule_targets')
      .delete()
      .eq('promo_code_id', promoCodeId);

    if (error) {
      throw mapPromoCodeDatabaseError(error);
    }
  }

  private async deleteTrainerTargetRecords(promoCodeId: string): Promise<void> {
    const { error } = await this.adminClient
      .from('promo_code_trainer_targets')
      .delete()
      .eq('promo_code_id', promoCodeId);

    if (error) {
      throw mapPromoCodeDatabaseError(error);
    }
  }

  private async deleteCustomerTargetRecords(
    promoCodeId: string,
  ): Promise<void> {
    const { error } = await this.adminClient
      .from('promo_code_customer_targets')
      .delete()
      .eq('promo_code_id', promoCodeId);

    if (error) {
      throw mapPromoCodeDatabaseError(error);
    }
  }

  private async rollbackCreatedPromoCode(promoCodeId: string): Promise<void> {
    try {
      await this.adminClient.from('promo_codes').delete().eq('id', promoCodeId);
    } catch (cleanupError: unknown) {
      void cleanupError;
    }
  }
}
