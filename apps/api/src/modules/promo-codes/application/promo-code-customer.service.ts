// apps/api/src/modules/promo-codes/application/promo-code-customer.service.ts
/**
 * LAFAM Promo Code customer service.
 *
 * Role:
 * - Orchestrates customer-facing promo-code preview, validation, reservation, redemption, release, and expiry-cleanup use cases.
 * - Applies Promo Code domain policy before checkout reservation.
 * - Delegates all database reads/writes and atomic RPC calls to PromoCodeRepository.
 * - Returns backend-owned promo-code pricing results for checkout and payment integration.
 *
 * Important:
 * - This service does not trust frontend-submitted subtotal, discount, final amount, redemption count, or payment truth.
 * - This service does not create payments, confirm bookings, mutate wallets, or process refunds.
 * - Payment/booking modules must resolve the trusted checkout target and subtotal before calling this service.
 * - Preview does not reserve a promo code.
 * - Checkout must always revalidate and reserve the promo code again.
 * - Promo codes apply before payment creation, not after payment is already paid.
 * - Wallet top-up is intentionally excluded from promo-code usage.
 */

import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import type { DatabaseJsonObject } from '../../../database/database.types';
import { PROMO_CODE_RESERVATION_TTL_MINUTES } from '../constants/promo-code.constants';
import type { PromoCodeAllowedPaymentMethod } from '../constants/promo-code.constants';
import { PreviewPromoCodeDto } from '../dto/preview-promo-code.dto';
import { PromoCodePolicy } from '../domain/promo-code.policy';
import { PromoCodeRepository } from '../repositories/promo-code.repository';
import type {
  AttachPromoCodeRedemptionPaymentResult,
  MarkPromoCodeRedemptionRedeemedResult,
  PromoCodeAttachPaymentInput,
  PromoCodeDiscountCalculationResult,
  PromoCodeHydratedRecord,
  PromoCodeMarkRedeemedInput,
  PromoCodePreviewResponse,
  PromoCodeReleaseExpiredInput,
  PromoCodeReleaseInput,
  PromoCodeReservationResult,
  PromoCodeReserveInput,
  PromoCodeResolvedCheckoutTarget,
  PromoCodeValidationInput,
  PromoCodeValidationResult,
  ReleaseExpiredPromoCodeRedemptionsResult,
  ReleasePromoCodeRedemptionResult,
} from '../types/promo-code.types';

const DEFAULT_PREVIEW_PAYMENT_METHOD: PromoCodeAllowedPaymentMethod = 'knet';
const MILLISECONDS_PER_MINUTE = 60 * 1000;

interface PreviewPromoCodeServiceInput {
  readonly user_id: string;
  readonly dto: PreviewPromoCodeDto;
  readonly target: PromoCodeResolvedCheckoutTarget;
}

interface ReleasePromoCodeRedemptionForPaymentInput {
  readonly payment_id: string;
  readonly release_reason: string;
  readonly metadata?: DatabaseJsonObject;
}

interface AttachPromoCodeRedemptionToPaymentInput {
  readonly redemption_id: string;
  readonly payment_id: string;
  readonly metadata?: DatabaseJsonObject;
}

interface MarkPromoCodeRedemptionRedeemedForPaymentInput {
  readonly payment_id: string;
  readonly metadata?: DatabaseJsonObject;
}

function resolveReservationExpiresAt(expiresAt?: string | null): string {
  if (expiresAt !== undefined && expiresAt !== null) {
    return expiresAt;
  }

  return new Date(
    Date.now() + PROMO_CODE_RESERVATION_TTL_MINUTES * MILLISECONDS_PER_MINUTE,
  ).toISOString();
}

function nullableString(value?: string | null): string | null {
  return value ?? null;
}

function assertMatchingNullableString(
  fieldName: string,
  expected?: string | null,
  actual?: string | null,
): void {
  if (nullableString(expected) === nullableString(actual)) {
    return;
  }

  throw AppError.promoCodeTargetInvalid(
    'Promo-code preview target does not match the resolved checkout target.',
    {
      field: fieldName,
      expected: nullableString(expected),
      actual: nullableString(actual),
    },
  );
}

function buildReservationMetadata(
  input: PromoCodeReserveInput,
  pricing: PromoCodeDiscountCalculationResult,
): DatabaseJsonObject {
  const baseMetadata: Record<string, unknown> = {
    target_type: input.target.target_type,
    booking_id: input.target.booking_id ?? null,
    private_booking_id: input.target.private_booking_id ?? null,
    booking_order_id: input.target.booking_order_id ?? null,
    payment_method: input.payment_method,
    subtotal_amount: pricing.subtotal_amount,
    discount_amount: pricing.discount_amount,
    final_amount: pricing.final_amount,
    currency: pricing.currency,
  };

  return {
    ...baseMetadata,
    ...(input.target.metadata ?? {}),
    ...(input.metadata ?? {}),
  } as DatabaseJsonObject;
}

@Injectable()
export class PromoCodeCustomerService {
  constructor(private readonly promoCodeRepository: PromoCodeRepository) {}

  async previewPromoCode(
    input: PreviewPromoCodeServiceInput,
  ): Promise<PromoCodePreviewResponse> {
    PromoCodeCustomerService.assertPreviewTargetMatchesResolvedTarget(
      input.dto,
      input.target,
    );

    const paymentMethod = PromoCodeCustomerService.resolvePreviewPaymentMethod(
      input.dto,
      input.target,
    );

    const validationResult = await this.validatePromoCode({
      code: input.dto.promo_code,
      user_id: input.user_id,
      payment_method: paymentMethod,
      target: {
        ...input.target,
        user_id: input.user_id,
        payment_method: paymentMethod,
      },
    });

    return PromoCodeCustomerService.toPreviewResponse(validationResult);
  }

  async validatePromoCode(
    input: PromoCodeValidationInput,
  ): Promise<PromoCodeValidationResult> {
    PromoCodePolicy.assertResolvedCheckoutTarget(input.target);

    const promoCode = await this.findActivePromoCodeByCodeOrThrow(input.code);
    const targetIds = PromoCodePolicy.extractTargetIds(promoCode);
    const userRedemptionCount =
      await this.promoCodeRepository.countUserActiveRedemptions({
        promo_code_id: promoCode.promo_code.id,
        user_id: input.user_id,
      });
    const hasPriorPaidBooking =
      await this.promoCodeRepository.hasPriorPaidBooking({
        user_id: input.user_id,
      });

    PromoCodePolicy.assertEligibility({
      promo_code: promoCode,
      target: input.target,
      payment_method: input.payment_method,
      user_redemption_count: userRedemptionCount,
      has_prior_paid_booking: hasPriorPaidBooking,
      now: new Date(),
    });

    const pricing = PromoCodePolicy.calculateDiscount({
      discount_type: promoCode.promo_code.discount_type,
      discount_value: promoCode.promo_code.discount_value,
      max_discount_amount: promoCode.promo_code.max_discount_amount,
      subtotal_amount: input.target.subtotal_amount,
      currency: input.target.currency,
    });

    return {
      promo_code: promoCode.promo_code,
      target_ids: targetIds,
      pricing,
    };
  }

  async reservePromoCode(
    input: PromoCodeReserveInput,
  ): Promise<PromoCodeReservationResult> {
    PromoCodePolicy.assertMetadataSafe(input.metadata);

    const validationResult = await this.validatePromoCode(input);
    const reservationMetadata = PromoCodePolicy.sanitizeMetadata(
      buildReservationMetadata(input, validationResult.pricing),
    ).metadata;

    const redemption =
      await this.promoCodeRepository.reservePromoCodeRedemptionAtomic({
        ...input,
        promo_code_id: validationResult.promo_code.id,
        expires_at: resolveReservationExpiresAt(input.expires_at),
        metadata: reservationMetadata,
        pricing: validationResult.pricing,
      });

    return {
      promo_code: validationResult.promo_code,
      target_ids: validationResult.target_ids,
      pricing: validationResult.pricing,
      redemption,
    };
  }

  async attachPromoCodeRedemptionToPayment(
    input: AttachPromoCodeRedemptionToPaymentInput,
  ): Promise<AttachPromoCodeRedemptionPaymentResult> {
    PromoCodePolicy.assertMetadataSafe(input.metadata);

    return this.promoCodeRepository.attachPromoCodeRedemptionPaymentAtomic({
      redemption_id: input.redemption_id,
      payment_id: input.payment_id,
      metadata: input.metadata ?? {},
    });
  }

  async attachPromoCodeRedemptionPayment(
    input: PromoCodeAttachPaymentInput,
  ): Promise<AttachPromoCodeRedemptionPaymentResult> {
    PromoCodePolicy.assertMetadataSafe(input.metadata);

    return this.promoCodeRepository.attachPromoCodeRedemptionPaymentAtomic({
      redemption_id: input.redemption_id,
      payment_id: input.payment_id,
      metadata: input.metadata ?? {},
    });
  }

  async markPromoCodeRedemptionRedeemed(
    input: PromoCodeMarkRedeemedInput,
  ): Promise<MarkPromoCodeRedemptionRedeemedResult> {
    PromoCodePolicy.assertMetadataSafe(input.metadata);

    return this.promoCodeRepository.markPromoCodeRedemptionRedeemedAtomic({
      redemption_id: input.redemption_id ?? null,
      payment_id: input.payment_id ?? null,
      metadata: input.metadata ?? {},
    });
  }

  async markPromoCodeRedemptionRedeemedForPayment(
    input: MarkPromoCodeRedemptionRedeemedForPaymentInput,
  ): Promise<MarkPromoCodeRedemptionRedeemedResult> {
    PromoCodePolicy.assertMetadataSafe(input.metadata);

    return this.promoCodeRepository.markPromoCodeRedemptionRedeemedAtomic({
      payment_id: input.payment_id,
      metadata: input.metadata ?? {},
    });
  }

  async releasePromoCodeRedemption(
    input: PromoCodeReleaseInput,
  ): Promise<ReleasePromoCodeRedemptionResult | null> {
    PromoCodePolicy.assertMetadataSafe(input.metadata);

    return this.promoCodeRepository.releasePromoCodeRedemptionAtomic({
      redemption_id: input.redemption_id ?? null,
      payment_id: input.payment_id ?? null,
      release_reason: input.release_reason ?? null,
      metadata: input.metadata ?? {},
    });
  }

  async releasePromoCodeRedemptionForPayment(
    input: ReleasePromoCodeRedemptionForPaymentInput,
  ): Promise<ReleasePromoCodeRedemptionResult | null> {
    PromoCodePolicy.assertMetadataSafe(input.metadata);

    return this.promoCodeRepository.releasePromoCodeRedemptionAtomic({
      payment_id: input.payment_id,
      release_reason: input.release_reason,
      metadata: input.metadata ?? {},
    });
  }

  async releaseExpiredPromoCodeRedemptions(
    input: PromoCodeReleaseExpiredInput = {},
  ): Promise<ReleaseExpiredPromoCodeRedemptionsResult> {
    return this.promoCodeRepository.releaseExpiredPromoCodeRedemptionsAtomic({
      now: input.now,
      limit: input.limit,
    });
  }

  private async findActivePromoCodeByCodeOrThrow(
    code: string,
  ): Promise<PromoCodeHydratedRecord> {
    const normalizedCode = PromoCodePolicy.normalizeCode(code);

    if (normalizedCode.length === 0) {
      throw AppError.promoCodeInvalid();
    }

    const promoCode =
      await this.promoCodeRepository.findActivePromoCodeByCode(normalizedCode);

    if (!promoCode) {
      throw AppError.promoCodeInvalid(
        'The promo code is invalid or unavailable.',
        {
          code: normalizedCode,
        },
      );
    }

    return promoCode;
  }

  private static assertPreviewTargetMatchesResolvedTarget(
    dto: PreviewPromoCodeDto,
    target: PromoCodeResolvedCheckoutTarget,
  ): void {
    PromoCodePolicy.assertTargetReference(dto);
    PromoCodePolicy.assertTargetReference(target);

    if (dto.target_type !== target.target_type) {
      throw AppError.promoCodeTargetInvalid(
        'Promo-code preview target type does not match the resolved checkout target.',
        {
          requested_target_type: dto.target_type,
          resolved_target_type: target.target_type,
        },
      );
    }

    assertMatchingNullableString(
      'booking_id',
      dto.booking_id,
      target.booking_id,
    );
    assertMatchingNullableString(
      'private_booking_id',
      dto.private_booking_id,
      target.private_booking_id,
    );
    assertMatchingNullableString(
      'booking_order_id',
      dto.booking_order_id,
      target.booking_order_id,
    );
  }

  private static resolvePreviewPaymentMethod(
    dto: PreviewPromoCodeDto,
    target: PromoCodeResolvedCheckoutTarget,
  ): PromoCodeAllowedPaymentMethod {
    return (
      dto.payment_method ??
      target.payment_method ??
      DEFAULT_PREVIEW_PAYMENT_METHOD
    );
  }

  private static toPreviewResponse(
    validationResult: PromoCodeValidationResult,
  ): PromoCodePreviewResponse {
    return {
      promo_code: {
        id: validationResult.promo_code.id,
        code: validationResult.promo_code.code,
        description: validationResult.promo_code.description,
        discount_type: validationResult.promo_code.discount_type,
        discount_value: validationResult.promo_code.discount_value,
        max_discount_amount: validationResult.promo_code.max_discount_amount,
      },
      pricing: validationResult.pricing,
      applies: true,
    };
  }
}
