import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import {
  PAYMENT_METHOD_KNET,
  PAYMENT_TARGET_TYPE_BOOKING,
  PROMO_CODE_STATUS_ACTIVE,
  PROMO_CODE_STATUS_DELETED,
  PROMO_CODE_STATUS_INACTIVE,
  type PromoCodeStatus,
  type PromoDiscountType,
} from '../constants/payment.constants';
import type {
  PromoCodeListQuery,
  PromoCodeRedemptionListQuery,
  PromoCodeRedemptionRecord,
} from '../repositories/promo-code.repository';
import { PromoCodeRepository } from '../repositories/promo-code.repository';
import type {
  PromoCodeCreateRecord,
  PromoCodeRecord,
  PromoCodeUpdateRecord,
} from '../types/payment.types';
import type { CreatePromoCodeDto } from '../dto/create-promo-code.dto';
import type { UpdatePromoCodeDto } from '../dto/update-promo-code.dto';

export interface PromoCodeSummary {
  readonly admin_notes: string | null;
  readonly allowed_payment_methods: readonly string[];
  readonly allowed_target_types: readonly string[];
  readonly code: string;
  readonly created_at: string;
  readonly created_by_admin_id: string | null;
  readonly created_by_role: 'admin';
  readonly currency: 'KWD';
  readonly deleted_at: string | null;
  readonly description: string | null;
  readonly discount_type: PromoDiscountType;
  readonly discount_value: number;
  readonly ends_at: string | null;
  readonly first_time_customer_only: false;
  readonly id: string;
  readonly max_discount_amount: number | null;
  readonly max_redemptions: number | null;
  readonly metadata: Record<string, never>;
  readonly minimum_order_amount: 0;
  readonly per_user_limit: number | null;
  readonly redemption_count: number;
  readonly starts_at: string | null;
  readonly status: PromoCodeStatus;
  readonly targets: {
    readonly class_ids: readonly string[];
    readonly customer_user_ids: readonly string[];
    readonly schedule_ids: readonly string[];
    readonly trainer_staff_profile_ids: readonly string[];
  };
  readonly updated_at: string;
  readonly updated_by_admin_id: string | null;
  readonly usage: {
    readonly max_redemptions: number | null;
    readonly per_user_limit: number | null;
    readonly redemption_count: number;
    readonly remaining_redemptions: number | null;
  };
}

export interface PromoCodeListResponse {
  readonly limit: number;
  readonly offset: number;
  readonly promo_codes: readonly PromoCodeSummary[];
  readonly total: number;
}

export interface PromoCodeRedemptionSummary {
  readonly booking_id: string | null;
  readonly booking_order_id: string | null;
  readonly created_at: string;
  readonly currency: string;
  readonly discount: number;
  readonly final: number | null;
  readonly id: string;
  readonly method: string | null;
  readonly payment_id: string;
  readonly payment_number: string | null;
  readonly private_booking_id: string | null;
  readonly redeemed_at: string;
  readonly status: 'redeemed';
  readonly subtotal: number | null;
  readonly target_type: string | null;
  readonly type: string | null;
  readonly user_id: string | null;
}

export interface PromoCodeRedemptionListResponse {
  readonly limit: number;
  readonly offset: number;
  readonly redemptions: readonly PromoCodeRedemptionSummary[];
  readonly total: number;
}

function mapPromoCodeToSummary(promoCode: PromoCodeRecord): PromoCodeSummary {
  const remainingRedemptions =
    promoCode.max_redemptions === null
      ? null
      : Math.max(0, promoCode.max_redemptions - promoCode.redemption_count);

  return {
    id: promoCode.id,
    code: promoCode.code,
    description: promoCode.description,
    discount_type: promoCode.discount_type,
    discount_value: promoCode.discount_value,
    max_discount_amount: promoCode.max_discount_amount,
    starts_at: promoCode.starts_at,
    ends_at: promoCode.ends_at,
    max_redemptions: promoCode.max_redemptions,
    per_user_limit: promoCode.per_user_limit,
    redemption_count: promoCode.redemption_count,
    status: promoCode.status,
    currency: 'KWD',
    minimum_order_amount: 0,
    first_time_customer_only: false,
    allowed_target_types: [PAYMENT_TARGET_TYPE_BOOKING],
    allowed_payment_methods: [PAYMENT_METHOD_KNET],
    targets: {
      class_ids: [],
      schedule_ids: [],
      trainer_staff_profile_ids: [],
      customer_user_ids: [],
    },
    usage: {
      redemption_count: promoCode.redemption_count,
      max_redemptions: promoCode.max_redemptions,
      per_user_limit: promoCode.per_user_limit,
      remaining_redemptions: remainingRedemptions,
    },
    created_by_admin_id: promoCode.created_by_admin_id,
    updated_by_admin_id: promoCode.updated_by_admin_id,
    created_by_role: 'admin',
    admin_notes: null,
    metadata: {},
    created_at: promoCode.created_at,
    updated_at: promoCode.updated_at,
    deleted_at: promoCode.deleted_at,
  };
}

function mapRedemptionToSummary(
  redemption: PromoCodeRedemptionRecord,
): PromoCodeRedemptionSummary {
  const payment = redemption.payment;

  return {
    id: redemption.discount.id,
    payment_id: redemption.discount.payment_id,
    user_id: payment?.user_id ?? null,
    type: payment?.target_type ?? null,
    target_type: payment?.target_type ?? null,
    payment_number: payment?.payment_number ?? null,
    status: 'redeemed',
    subtotal: payment?.amount ?? null,
    discount: redemption.discount.discount_amount,
    final: payment?.final_amount ?? null,
    currency: payment?.currency ?? 'KWD',
    method: payment?.payment_method ?? null,
    booking_id: payment?.booking_id ?? null,
    private_booking_id: payment?.private_booking_id ?? null,
    booking_order_id: payment?.booking_order_id ?? null,
    created_at: redemption.discount.created_at,
    redeemed_at: redemption.discount.created_at,
  };
}

function hasOwnProperty<TObject extends object>(
  object: TObject,
  key: PropertyKey,
): boolean {
  return key in object;
}

function normalizeDateTime(value: string | null | undefined): string | null {
  if (typeof value === 'undefined') return null;
  if (value === null) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw AppError.invalidRequest('Promo date fields must be valid dates.');
  }

  return date.toISOString();
}

function normalizePromoCode(value: string): string {
  const normalizedCode = value.trim().toUpperCase();

  if (normalizedCode.length === 0) {
    throw AppError.invalidRequest('Promo code is required.');
  }

  return normalizedCode;
}

function mapCreateStatus(
  status: CreatePromoCodeDto['status'],
): PromoCodeRecord['status'] {
  if (status === 'draft' || typeof status === 'undefined') {
    return PROMO_CODE_STATUS_INACTIVE;
  }

  return status;
}

@Injectable()
export class PromoCodeAdminService {
  constructor(private readonly promoCodeRepository: PromoCodeRepository) {}

  async listPromoCodes(
    input: PromoCodeListQuery,
  ): Promise<PromoCodeListResponse> {
    const result = await this.promoCodeRepository.listPromoCodes(input);

    return {
      promo_codes: result.records.map(mapPromoCodeToSummary),
      total: result.total,
      limit: input.limit,
      offset: input.offset,
    };
  }

  async getPromoCode(input: {
    readonly promo_code_id: string;
  }): Promise<PromoCodeSummary> {
    const promoCode = await this.promoCodeRepository.findById(
      input.promo_code_id,
    );

    if (!promoCode) {
      throw AppError.notFound('The requested promo code was not found.', {
        promo_code_id: input.promo_code_id,
      });
    }

    return mapPromoCodeToSummary(promoCode);
  }

  async listPromoCodeRedemptions(input: {
    readonly promo_code_id: string;
    readonly query: PromoCodeRedemptionListQuery;
  }): Promise<PromoCodeRedemptionListResponse> {
    await this.getPromoCode({ promo_code_id: input.promo_code_id });

    const result = await this.promoCodeRepository.listPromoCodeRedemptions(
      input.promo_code_id,
      input.query,
    );

    return {
      redemptions: result.records.map(mapRedemptionToSummary),
      total: result.total,
      limit: input.query.limit,
      offset: input.query.offset,
    };
  }

  async createPromoCode(input: {
    readonly admin_user_id: string;
    readonly payload: CreatePromoCodeDto;
  }): Promise<{ readonly promo_code: PromoCodeSummary }> {
    const payload = input.payload;
    const createRecord: PromoCodeCreateRecord = {
      code: normalizePromoCode(payload.code),
      description: payload.description ?? null,
      discount_type: payload.discount_type,
      discount_value: payload.discount_value,
      max_discount_amount: payload.max_discount_amount ?? null,
      starts_at: normalizeDateTime(payload.starts_at),
      ends_at: normalizeDateTime(payload.ends_at),
      max_redemptions: payload.max_redemptions ?? null,
      per_user_limit: payload.per_user_limit ?? null,
      redemption_count: 0,
      status: mapCreateStatus(payload.status),
      created_by_admin_id: input.admin_user_id,
      updated_by_admin_id: input.admin_user_id,
      deleted_at:
        payload.status === PROMO_CODE_STATUS_DELETED
          ? new Date().toISOString()
          : null,
    };

    const promoCode =
      await this.promoCodeRepository.createPromoCode(createRecord);

    return { promo_code: mapPromoCodeToSummary(promoCode) };
  }

  async activatePromoCode(input: {
    readonly admin_user_id: string;
    readonly promo_code_id: string;
  }): Promise<{ readonly promo_code: PromoCodeSummary }> {
    const promoCode = await this.promoCodeRepository.updatePromoCode(
      input.promo_code_id,
      {
        status: PROMO_CODE_STATUS_ACTIVE,
        deleted_at: null,
        updated_by_admin_id: input.admin_user_id,
        updated_at: new Date().toISOString(),
      },
    );

    return { promo_code: mapPromoCodeToSummary(promoCode) };
  }

  async pausePromoCode(input: {
    readonly admin_user_id: string;
    readonly promo_code_id: string;
  }): Promise<{ readonly promo_code: PromoCodeSummary }> {
    const promoCode = await this.promoCodeRepository.updatePromoCode(
      input.promo_code_id,
      {
        status: PROMO_CODE_STATUS_INACTIVE,
        updated_by_admin_id: input.admin_user_id,
        updated_at: new Date().toISOString(),
      },
    );

    return { promo_code: mapPromoCodeToSummary(promoCode) };
  }

  async softDeletePromoCode(input: {
    readonly admin_user_id: string;
    readonly promo_code_id: string;
  }): Promise<{ readonly promo_code: PromoCodeSummary }> {
    const promoCode = await this.promoCodeRepository.updatePromoCode(
      input.promo_code_id,
      {
        deleted_at: new Date().toISOString(),
        status: PROMO_CODE_STATUS_DELETED,
        updated_by_admin_id: input.admin_user_id,
        updated_at: new Date().toISOString(),
      },
    );

    return { promo_code: mapPromoCodeToSummary(promoCode) };
  }

  async updatePromoCode(input: {
    readonly admin_user_id: string;
    readonly promo_code_id: string;
    readonly payload: UpdatePromoCodeDto;
  }): Promise<{ readonly promo_code: PromoCodeSummary }> {
    const existingPromoCode = await this.promoCodeRepository.findById(
      input.promo_code_id,
    );

    if (!existingPromoCode) {
      throw AppError.notFound('The requested promo code was not found.', {
        promo_code_id: input.promo_code_id,
      });
    }

    if (existingPromoCode.redemption_count > 0) {
      const unsafeFields = [
        'discount_type',
        'discount_value',
        'max_discount_amount',
      ];
      const unsafeField = unsafeFields.find((field) =>
        hasOwnProperty(input.payload, field),
      );

      if (unsafeField) {
        throw AppError.invalidRequest(
          'Discount fields cannot be changed after redemptions exist.',
          { promo_code_id: input.promo_code_id, field: unsafeField },
        );
      }
    }

    const patch: PromoCodeUpdateRecord = {
      updated_by_admin_id: input.admin_user_id,
      updated_at: new Date().toISOString(),
    };

    if (hasOwnProperty(input.payload, 'description')) {
      patch.description = input.payload.description ?? null;
    }

    if (typeof input.payload.discount_type !== 'undefined') {
      patch.discount_type = input.payload.discount_type;
    }

    if (typeof input.payload.discount_value !== 'undefined') {
      patch.discount_value = input.payload.discount_value ?? 0;
    }

    if (hasOwnProperty(input.payload, 'max_discount_amount')) {
      patch.max_discount_amount = input.payload.max_discount_amount ?? null;
    }

    if (hasOwnProperty(input.payload, 'starts_at')) {
      patch.starts_at = normalizeDateTime(input.payload.starts_at);
    }

    if (hasOwnProperty(input.payload, 'ends_at')) {
      patch.ends_at = normalizeDateTime(input.payload.ends_at);
    }

    if (hasOwnProperty(input.payload, 'max_redemptions')) {
      patch.max_redemptions = input.payload.max_redemptions ?? null;
    }

    if (hasOwnProperty(input.payload, 'per_user_limit')) {
      patch.per_user_limit = input.payload.per_user_limit ?? null;
    }

    if (typeof input.payload.status !== 'undefined') {
      patch.status = input.payload.status;
      patch.deleted_at =
        input.payload.status === PROMO_CODE_STATUS_DELETED
          ? new Date().toISOString()
          : null;
    }

    const promoCode = await this.promoCodeRepository.updatePromoCode(
      input.promo_code_id,
      patch,
    );

    return { promo_code: mapPromoCodeToSummary(promoCode) };
  }
}
