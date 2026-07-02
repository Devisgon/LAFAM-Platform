// apps/api/src/modules/promo-codes/domain/promo-code.policy.ts
/**
 * LAFAM Promo Code Module domain policy.
 *
 * Role:
 * - Owns pure promo-code business rules.
 * - Validates discount math, date windows, status lifecycle, staff limits, checkout target references, targeting restrictions, and metadata safety.
 * - Calculates backend-owned promo-code discount results before checkout payment creation.
 *
 * Important:
 * - This file must not call Supabase.
 * - This file must not call payment providers.
 * - This file must not create, confirm, refund, or expire payments.
 * - This file must not mutate bookings, wallet balances, or payment records.
 * - Promo codes apply before payment creation, not after payment is already paid.
 * - Wallet top-up is intentionally excluded from promo-code usage.
 */

import { AppError } from '../../../common/errors/app-error';
import type { DatabaseJsonObject } from '../../../database/database.types';
import {
  PROMO_CODE_ACTIVE_REDEMPTION_STATUSES,
  PROMO_CODE_ALLOWED_PAYMENT_METHODS,
  PROMO_CODE_ALLOWED_TARGET_TYPES,
  PROMO_CODE_AMOUNT_DECIMAL_PLACES,
  PROMO_CODE_DEFAULT_CURRENCY,
  PROMO_CODE_DISCOUNT_TYPES,
  PROMO_CODE_FIXED_AMOUNT_MIN_VALUE,
  PROMO_CODE_FORBIDDEN_METADATA_KEYS,
  PROMO_CODE_MAX_REDEMPTIONS_MIN_VALUE,
  PROMO_CODE_MINIMUM_ORDER_MIN_AMOUNT,
  PROMO_CODE_MUTABLE_STATUSES,
  PROMO_CODE_PATTERN,
  PROMO_CODE_PERCENTAGE_MAX_VALUE,
  PROMO_CODE_PERCENTAGE_MIN_VALUE,
  PROMO_CODE_PER_USER_LIMIT_MIN_VALUE,
  PROMO_CODE_STAFF_MAX_FIXED_DISCOUNT_AMOUNT,
  PROMO_CODE_STAFF_MAX_MAX_DISCOUNT_AMOUNT,
  PROMO_CODE_STAFF_MAX_PERCENTAGE_DISCOUNT,
  PROMO_CODE_STAFF_MAX_PER_USER_LIMIT,
  PROMO_CODE_STAFF_MAX_REDEMPTIONS,
  PROMO_CODE_STAFF_MAX_VALIDITY_DAYS,
  PROMO_CODE_USABLE_STATUSES,
} from '../constants/promo-code.constants';
import type {
  PromoCodeAllowedPaymentMethod,
  PromoCodeAllowedTargetType,
  PromoCodeDiscountType,
  PromoCodeRedemptionStatus,
  PromoCodeStatus,
} from '../constants/promo-code.constants';
import type {
  PromoCodeActor,
  PromoCodeCheckoutTargetReference,
  PromoCodeCreateInput,
  PromoCodeDiscountCalculationInput,
  PromoCodeDiscountCalculationResult,
  PromoCodeEligibilityContext,
  PromoCodeHydratedRecord,
  PromoCodeMetadataSanitizationResult,
  PromoCodeRecord,
  PromoCodeRedemptionRecord,
  PromoCodeResolvedCheckoutTarget,
  PromoCodeTargetIdMutationInput,
  PromoCodeTargetIds,
  PromoCodeUpdateInput,
} from '../types/promo-code.types';

const ZERO_AMOUNT = 0;
const ONE_DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const AMOUNT_MULTIPLIER = 10 ** PROMO_CODE_AMOUNT_DECIMAL_PLACES;

const EMPTY_TARGET_IDS: PromoCodeTargetIds = {
  class_ids: [],
  schedule_ids: [],
  trainer_staff_profile_ids: [],
  customer_user_ids: [],
};

const REDEEMED_LOCKED_UPDATE_FIELDS = [
  'discount_type',
  'discount_value',
  'max_discount_amount',
  'minimum_order_amount',
  'first_time_customer_only',
  'allowed_target_types',
  'allowed_payment_methods',
  'target_ids',
] as const satisfies readonly (keyof PromoCodeUpdateInput)[];

const UPDATE_MUTATION_FIELDS = [
  'description',
  'discount_type',
  'discount_value',
  'max_discount_amount',
  'starts_at',
  'ends_at',
  'max_redemptions',
  'per_user_limit',
  'status',
  'minimum_order_amount',
  'first_time_customer_only',
  'allowed_target_types',
  'allowed_payment_methods',
  'target_ids',
  'admin_notes',
  'metadata',
] as const satisfies readonly (keyof PromoCodeUpdateInput)[];

export class PromoCodePolicy {
  private constructor() {}

  static normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }

  static assertCodeFormat(code: string): void {
    const normalizedCode = PromoCodePolicy.normalizeCode(code);

    if (!PROMO_CODE_PATTERN.test(normalizedCode)) {
      throw AppError.promoCodeInvalid(
        'Promo code may contain only uppercase letters, numbers, underscores, and hyphens, and must start and end with a letter or number.',
        {
          code,
        },
      );
    }
  }

  static assertCreateInput(input: PromoCodeCreateInput): void {
    PromoCodePolicy.assertActorCanCreate(input.actor);
    PromoCodePolicy.assertCodeFormat(input.code);
    PromoCodePolicy.assertDiscountDefinition({
      discount_type: input.discount_type,
      discount_value: input.discount_value,
      max_discount_amount: input.max_discount_amount,
    });
    PromoCodePolicy.assertDateRange(input.starts_at, input.ends_at);
    PromoCodePolicy.assertRedemptionLimits(
      input.max_redemptions,
      input.per_user_limit,
    );
    PromoCodePolicy.assertMinimumOrderAmount(input.minimum_order_amount);
    PromoCodePolicy.assertAllowedTargetTypes(input.allowed_target_types);
    PromoCodePolicy.assertAllowedPaymentMethods(input.allowed_payment_methods);
    PromoCodePolicy.assertMetadataSafe(input.metadata);

    if (input.actor.role === 'staff') {
      PromoCodePolicy.assertStaffCreateLimits(input);
    }
  }

  static assertUpdateInput(input: PromoCodeUpdateInput): void {
    const hasMutation = UPDATE_MUTATION_FIELDS.some(
      (field) => input[field] !== undefined,
    );

    if (!hasMutation) {
      throw AppError.promoCodeEmptyUpdate();
    }

    if (
      input.discount_type !== undefined ||
      input.discount_value !== undefined
    ) {
      if (
        input.discount_type === undefined ||
        input.discount_value === undefined
      ) {
        throw AppError.promoCodeDiscountInvalid(
          'discount_type and discount_value must be updated together.',
        );
      }

      PromoCodePolicy.assertDiscountDefinition({
        discount_type: input.discount_type,
        discount_value: input.discount_value,
        max_discount_amount: input.max_discount_amount,
      });
    }

    if (input.max_discount_amount !== undefined) {
      PromoCodePolicy.assertOptionalPositiveAmount(
        input.max_discount_amount,
        'max_discount_amount',
      );
    }

    PromoCodePolicy.assertDateRange(input.starts_at, input.ends_at);
    PromoCodePolicy.assertRedemptionLimits(
      input.max_redemptions,
      input.per_user_limit,
    );
    PromoCodePolicy.assertMinimumOrderAmount(input.minimum_order_amount);

    if (input.allowed_target_types !== undefined) {
      PromoCodePolicy.assertAllowedTargetTypes(input.allowed_target_types);
    }

    if (input.allowed_payment_methods !== undefined) {
      PromoCodePolicy.assertAllowedPaymentMethods(
        input.allowed_payment_methods,
      );
    }

    PromoCodePolicy.assertMetadataSafe(input.metadata);
  }

  static assertUpdateAllowedAfterRedemptions(
    input: PromoCodeUpdateInput,
    hasActiveOrFinalRedemptions: boolean,
  ): void {
    if (!hasActiveOrFinalRedemptions) {
      return;
    }

    const lockedField = REDEEMED_LOCKED_UPDATE_FIELDS.find(
      (field) => input[field] !== undefined,
    );

    if (lockedField !== undefined) {
      throw AppError.promoCodeRedemptionConflict(
        'Promo-code discount rules and targeting rules cannot be changed after redemption records exist.',
        {
          locked_field: lockedField,
        },
      );
    }
  }

  static assertStatusTransition(
    currentStatus: PromoCodeStatus,
    nextStatus: PromoCodeStatus,
  ): void {
    if (currentStatus === nextStatus) {
      return;
    }

    if (currentStatus === 'deleted') {
      throw AppError.promoCodeAlreadyDeleted();
    }

    if (nextStatus === 'deleted') {
      throw AppError.promoCodeInvalidStatus(
        'Use the delete endpoint to delete a promo code.',
      );
    }

    if (!PromoCodePolicy.isMutableStatus(currentStatus)) {
      throw AppError.promoCodeInvalidStatus(
        'This promo-code status cannot be changed manually.',
        {
          current_status: currentStatus,
          next_status: nextStatus,
        },
      );
    }

    if (!PromoCodePolicy.isMutableStatus(nextStatus)) {
      throw AppError.promoCodeInvalidStatus(
        'This promo-code status is system-owned and cannot be set manually.',
        {
          current_status: currentStatus,
          next_status: nextStatus,
        },
      );
    }
  }

  static assertTargetReference(target: PromoCodeCheckoutTargetReference): void {
    const hasBookingId = Boolean(target.booking_id);
    const hasPrivateBookingId = Boolean(target.private_booking_id);
    const hasBookingOrderId = Boolean(target.booking_order_id);

    if (
      target.target_type === 'booking' &&
      hasBookingId &&
      !hasPrivateBookingId &&
      !hasBookingOrderId
    ) {
      return;
    }

    if (
      target.target_type === 'private_booking' &&
      !hasBookingId &&
      hasPrivateBookingId &&
      !hasBookingOrderId
    ) {
      return;
    }

    if (
      target.target_type === 'booking_order' &&
      !hasBookingId &&
      !hasPrivateBookingId &&
      hasBookingOrderId
    ) {
      return;
    }

    throw AppError.promoCodeTargetInvalid(
      'Promo-code checkout target reference is invalid.',
      {
        target_type: target.target_type,
        booking_id: target.booking_id ?? null,
        private_booking_id: target.private_booking_id ?? null,
        booking_order_id: target.booking_order_id ?? null,
      },
    );
  }

  static assertResolvedCheckoutTarget(
    target: PromoCodeResolvedCheckoutTarget,
  ): void {
    PromoCodePolicy.assertTargetReference(target);

    PromoCodePolicy.assertPositiveAmount(
      target.subtotal_amount,
      'subtotal_amount',
    );

    if (target.currency !== PROMO_CODE_DEFAULT_CURRENCY) {
      throw AppError.promoCodeInvalid(
        'Promo codes currently support KWD checkout only.',
        {
          currency: target.currency,
        },
      );
    }
  }

  static assertEligibility(context: PromoCodeEligibilityContext): void {
    const promoCode = context.promo_code.promo_code;

    PromoCodePolicy.assertPromoCodeUsable(promoCode, context.now);
    PromoCodePolicy.assertResolvedCheckoutTarget(context.target);
    PromoCodePolicy.assertTargetTypeAllowed(
      context.target.target_type,
      promoCode.allowed_target_types,
    );
    PromoCodePolicy.assertPaymentMethodAllowed(
      context.payment_method,
      promoCode.allowed_payment_methods,
    );
    PromoCodePolicy.assertMinimumOrderMet(
      context.target.subtotal_amount,
      promoCode.minimum_order_amount,
    );
    PromoCodePolicy.assertPerUserLimit(
      context.user_redemption_count,
      promoCode.per_user_limit,
    );
    PromoCodePolicy.assertGlobalLimit(
      promoCode.redemption_count,
      promoCode.max_redemptions,
    );
    PromoCodePolicy.assertFirstTimeCustomerEligibility(
      promoCode.first_time_customer_only,
      context.has_prior_paid_booking,
    );
    PromoCodePolicy.assertTargetRestrictions(
      context.promo_code,
      context.target,
    );
  }

  static assertPromoCodeUsable(promoCode: PromoCodeRecord, now: Date): void {
    if (promoCode.deleted_at !== null) {
      throw AppError.promoCodeAlreadyDeleted();
    }

    if (promoCode.status === 'deleted') {
      throw AppError.promoCodeAlreadyDeleted();
    }

    if (promoCode.status === 'expired') {
      throw AppError.promoCodeExpired();
    }

    if (promoCode.status === 'exhausted') {
      throw AppError.promoCodeExhausted();
    }

    if (!PromoCodePolicy.isUsableStatus(promoCode.status)) {
      throw AppError.promoCodeNotActive(undefined, {
        status: promoCode.status,
      });
    }

    const startsAt = PromoCodePolicy.parseOptionalDate(promoCode.starts_at);

    if (startsAt !== null && now < startsAt) {
      throw AppError.promoCodeNotStarted(undefined, {
        starts_at: promoCode.starts_at,
      });
    }

    const endsAt = PromoCodePolicy.parseOptionalDate(promoCode.ends_at);

    if (endsAt !== null && now > endsAt) {
      throw AppError.promoCodeExpired(undefined, {
        ends_at: promoCode.ends_at,
      });
    }
  }

  static calculateDiscount(
    input: PromoCodeDiscountCalculationInput,
  ): PromoCodeDiscountCalculationResult {
    PromoCodePolicy.assertDiscountDefinition({
      discount_type: input.discount_type,
      discount_value: input.discount_value,
      max_discount_amount: input.max_discount_amount,
    });
    PromoCodePolicy.assertPositiveAmount(
      input.subtotal_amount,
      'subtotal_amount',
    );

    const subtotalAmount = PromoCodePolicy.roundAmount(input.subtotal_amount);

    let discountAmount =
      input.discount_type === 'percentage'
        ? PromoCodePolicy.roundAmount(
            (subtotalAmount * input.discount_value) / 100,
          )
        : PromoCodePolicy.roundAmount(input.discount_value);

    if (
      input.max_discount_amount !== null &&
      input.max_discount_amount !== undefined
    ) {
      discountAmount = Math.min(
        discountAmount,
        PromoCodePolicy.roundAmount(input.max_discount_amount),
      );
    }

    if (discountAmount <= ZERO_AMOUNT) {
      throw AppError.promoCodeDiscountInvalid(
        'Promo-code discount amount must be greater than zero.',
      );
    }

    if (discountAmount >= subtotalAmount) {
      throw AppError.promoCodeDiscountInvalid(
        'Promo-code discount cannot fully cover the checkout amount.',
        {
          subtotal_amount: subtotalAmount,
          discount_amount: discountAmount,
        },
      );
    }

    const finalAmount = PromoCodePolicy.roundAmount(
      subtotalAmount - discountAmount,
    );

    if (finalAmount <= ZERO_AMOUNT) {
      throw AppError.promoCodeDiscountInvalid(
        'Promo-code final checkout amount must remain greater than zero.',
        {
          subtotal_amount: subtotalAmount,
          discount_amount: discountAmount,
          final_amount: finalAmount,
        },
      );
    }

    return {
      subtotal_amount: subtotalAmount,
      discount_amount: discountAmount,
      final_amount: finalAmount,
      currency: input.currency,
    };
  }

  static normalizeTargetIds(
    targetIds?: PromoCodeTargetIdMutationInput,
  ): PromoCodeTargetIds {
    if (targetIds === undefined) {
      return EMPTY_TARGET_IDS;
    }

    return {
      class_ids: PromoCodePolicy.normalizeUuidArray(targetIds.class_ids),
      schedule_ids: PromoCodePolicy.normalizeUuidArray(targetIds.schedule_ids),
      trainer_staff_profile_ids: PromoCodePolicy.normalizeUuidArray(
        targetIds.trainer_staff_profile_ids,
      ),
      customer_user_ids: PromoCodePolicy.normalizeUuidArray(
        targetIds.customer_user_ids,
      ),
    };
  }

  static extractTargetIds(
    hydratedRecord: PromoCodeHydratedRecord,
  ): PromoCodeTargetIds {
    return {
      class_ids: hydratedRecord.class_targets.map((target) => target.class_id),
      schedule_ids: hydratedRecord.schedule_targets.map(
        (target) => target.schedule_id,
      ),
      trainer_staff_profile_ids: hydratedRecord.trainer_targets.map(
        (target) => target.trainer_staff_profile_id,
      ),
      customer_user_ids: hydratedRecord.customer_targets.map(
        (target) => target.customer_user_id,
      ),
    };
  }

  static hasTargetRestrictions(targetIds: PromoCodeTargetIds): boolean {
    return (
      targetIds.class_ids.length > ZERO_AMOUNT ||
      targetIds.schedule_ids.length > ZERO_AMOUNT ||
      targetIds.trainer_staff_profile_ids.length > ZERO_AMOUNT ||
      targetIds.customer_user_ids.length > ZERO_AMOUNT
    );
  }

  static assertMetadataSafe(metadata?: DatabaseJsonObject): void {
    if (metadata === undefined) {
      return;
    }

    const sanitizationResult = PromoCodePolicy.sanitizeMetadata(metadata);

    if (sanitizationResult.removed_keys.length > ZERO_AMOUNT) {
      throw AppError.promoCodeInvalid(
        'Promo-code metadata contains forbidden sensitive keys.',
        {
          removed_keys: sanitizationResult.removed_keys,
        },
      );
    }
  }

  static sanitizeMetadata(
    metadata?: DatabaseJsonObject | null,
  ): PromoCodeMetadataSanitizationResult {
    if (metadata === undefined || metadata === null) {
      return {
        metadata: {},
        removed_keys: [],
      };
    }

    const sanitizedMetadata: Record<string, unknown> = {};
    const removedKeys: string[] = [];
    const forbiddenKeys = new Set<string>(
      PROMO_CODE_FORBIDDEN_METADATA_KEYS.map((key) => key.toLowerCase()),
    );

    for (const [key, value] of Object.entries(metadata)) {
      const normalizedKey = key.trim().toLowerCase();

      if (forbiddenKeys.has(normalizedKey)) {
        removedKeys.push(key);
        continue;
      }

      sanitizedMetadata[key] = value;
    }

    return {
      metadata: sanitizedMetadata as DatabaseJsonObject,
      removed_keys: removedKeys,
    };
  }

  static assertRedemptionCanBeReleased(
    redemption: PromoCodeRedemptionRecord,
  ): void {
    if (redemption.status === 'redeemed') {
      throw AppError.promoCodeRedemptionAlreadyRedeemed();
    }

    if (!PromoCodePolicy.isActiveRedemptionStatus(redemption.status)) {
      throw AppError.promoCodeRedemptionConflict(
        'Only active promo-code redemptions can be released.',
        {
          redemption_id: redemption.id,
          status: redemption.status,
        },
      );
    }
  }

  static assertActorCanManagePromoCode(
    actor: PromoCodeActor,
    promoCode: PromoCodeRecord,
  ): void {
    if (PromoCodePolicy.isAdminActor(actor)) {
      return;
    }

    if (
      actor.role === 'staff' &&
      promoCode.created_by_admin_id === actor.user_id
    ) {
      return;
    }

    throw AppError.promoCodeStaffLimitExceeded(
      'Staff can manage only promo codes they created.',
      {
        promo_code_id: promoCode.id,
        actor_user_id: actor.user_id,
        actor_role: actor.role,
      },
    );
  }

  private static assertActorCanCreate(actor: PromoCodeActor): void {
    if (PromoCodePolicy.isAdminActor(actor)) {
      return;
    }

    if (actor.role === 'staff') {
      return;
    }

    if (actor.role === 'system') {
      return;
    }

    throw AppError.promoCodeStaffLimitExceeded(
      'This role cannot create promo codes.',
      {
        actor_user_id: actor.user_id,
        actor_role: actor.role,
      },
    );
  }

  private static assertDiscountDefinition(input: {
    readonly discount_type: PromoCodeDiscountType;
    readonly discount_value: number;
    readonly max_discount_amount?: number | null;
  }): void {
    if (!PROMO_CODE_DISCOUNT_TYPES.includes(input.discount_type)) {
      throw AppError.promoCodeDiscountInvalid(
        'Promo-code discount type is invalid.',
        {
          discount_type: input.discount_type,
        },
      );
    }

    PromoCodePolicy.assertPositiveAmount(
      input.discount_value,
      'discount_value',
    );

    if (input.discount_type === 'percentage') {
      if (
        input.discount_value < PROMO_CODE_PERCENTAGE_MIN_VALUE ||
        input.discount_value > PROMO_CODE_PERCENTAGE_MAX_VALUE
      ) {
        throw AppError.promoCodeDiscountInvalid(
          `Percentage discount must be between ${PROMO_CODE_PERCENTAGE_MIN_VALUE} and ${PROMO_CODE_PERCENTAGE_MAX_VALUE}.`,
          {
            discount_value: input.discount_value,
          },
        );
      }
    }

    if (
      input.discount_type === 'fixed_amount' &&
      input.discount_value < PROMO_CODE_FIXED_AMOUNT_MIN_VALUE
    ) {
      throw AppError.promoCodeDiscountInvalid(
        `Fixed discount amount must be at least ${PROMO_CODE_FIXED_AMOUNT_MIN_VALUE}.`,
        {
          discount_value: input.discount_value,
        },
      );
    }

    PromoCodePolicy.assertOptionalPositiveAmount(
      input.max_discount_amount,
      'max_discount_amount',
    );
  }

  private static assertDateRange(
    startsAtValue?: string | null,
    endsAtValue?: string | null,
  ): void {
    const startsAt = PromoCodePolicy.parseOptionalDate(startsAtValue);
    const endsAt = PromoCodePolicy.parseOptionalDate(endsAtValue);

    if (startsAt !== null && endsAt !== null && startsAt >= endsAt) {
      throw AppError.promoCodeInvalid(
        'starts_at must be earlier than ends_at.',
        {
          starts_at: startsAtValue,
          ends_at: endsAtValue,
        },
      );
    }
  }

  private static assertRedemptionLimits(
    maxRedemptions?: number | null,
    perUserLimit?: number | null,
  ): void {
    if (
      maxRedemptions !== undefined &&
      maxRedemptions !== null &&
      maxRedemptions < PROMO_CODE_MAX_REDEMPTIONS_MIN_VALUE
    ) {
      throw AppError.promoCodeInvalid(
        `max_redemptions must be at least ${PROMO_CODE_MAX_REDEMPTIONS_MIN_VALUE}.`,
        {
          max_redemptions: maxRedemptions,
        },
      );
    }

    if (
      perUserLimit !== undefined &&
      perUserLimit !== null &&
      perUserLimit < PROMO_CODE_PER_USER_LIMIT_MIN_VALUE
    ) {
      throw AppError.promoCodeInvalid(
        `per_user_limit must be at least ${PROMO_CODE_PER_USER_LIMIT_MIN_VALUE}.`,
        {
          per_user_limit: perUserLimit,
        },
      );
    }

    if (
      maxRedemptions !== undefined &&
      maxRedemptions !== null &&
      perUserLimit !== undefined &&
      perUserLimit !== null &&
      perUserLimit > maxRedemptions
    ) {
      throw AppError.promoCodeInvalid(
        'per_user_limit cannot be greater than max_redemptions.',
        {
          max_redemptions: maxRedemptions,
          per_user_limit: perUserLimit,
        },
      );
    }
  }

  private static assertMinimumOrderAmount(minimumOrderAmount?: number): void {
    if (minimumOrderAmount === undefined) {
      return;
    }

    if (
      !Number.isFinite(minimumOrderAmount) ||
      minimumOrderAmount < PROMO_CODE_MINIMUM_ORDER_MIN_AMOUNT
    ) {
      throw AppError.promoCodeInvalid(
        `minimum_order_amount must be at least ${PROMO_CODE_MINIMUM_ORDER_MIN_AMOUNT}.`,
        {
          minimum_order_amount: minimumOrderAmount,
        },
      );
    }
  }

  private static assertMinimumOrderMet(
    subtotalAmount: number,
    minimumOrderAmount: number,
  ): void {
    if (subtotalAmount < minimumOrderAmount) {
      throw AppError.promoCodeMinimumOrderNotMet(undefined, {
        subtotal_amount: subtotalAmount,
        minimum_order_amount: minimumOrderAmount,
      });
    }
  }

  private static assertPerUserLimit(
    userRedemptionCount: number,
    perUserLimit: number | null,
  ): void {
    if (perUserLimit === null) {
      return;
    }

    if (userRedemptionCount >= perUserLimit) {
      throw AppError.promoCodePerUserLimitReached(undefined, {
        user_redemption_count: userRedemptionCount,
        per_user_limit: perUserLimit,
      });
    }
  }

  private static assertGlobalLimit(
    redemptionCount: number,
    maxRedemptions: number | null,
  ): void {
    if (maxRedemptions === null) {
      return;
    }

    if (redemptionCount >= maxRedemptions) {
      throw AppError.promoCodeGlobalLimitReached(undefined, {
        redemption_count: redemptionCount,
        max_redemptions: maxRedemptions,
      });
    }
  }

  private static assertFirstTimeCustomerEligibility(
    firstTimeCustomerOnly: boolean,
    hasPriorPaidBooking: boolean,
  ): void {
    if (!firstTimeCustomerOnly) {
      return;
    }

    if (hasPriorPaidBooking) {
      throw AppError.promoCodeFirstTimeCustomerRequired();
    }
  }

  private static assertAllowedTargetTypes(
    targetTypes: readonly string[],
  ): void {
    if (targetTypes.length === ZERO_AMOUNT) {
      throw AppError.promoCodeTargetInvalid(
        'allowed_target_types must contain at least one checkout target type.',
      );
    }

    for (const targetType of targetTypes) {
      if (!PromoCodePolicy.isAllowedTargetType(targetType)) {
        throw AppError.promoCodeTargetInvalid(
          'Promo-code target type is invalid.',
          {
            target_type: targetType,
          },
        );
      }
    }
  }

  private static assertAllowedPaymentMethods(
    paymentMethods?: readonly string[],
  ): void {
    if (paymentMethods === undefined) {
      return;
    }

    if (paymentMethods.length === ZERO_AMOUNT) {
      throw AppError.promoCodePaymentMethodNotAllowed(
        'allowed_payment_methods must contain at least one payment method.',
      );
    }

    for (const paymentMethod of paymentMethods) {
      if (!PromoCodePolicy.isAllowedPaymentMethod(paymentMethod)) {
        throw AppError.promoCodePaymentMethodNotAllowed(
          'Promo-code payment method is invalid.',
          {
            payment_method: paymentMethod,
          },
        );
      }
    }
  }

  private static assertTargetTypeAllowed(
    targetType: PromoCodeAllowedTargetType,
    allowedTargetTypes: readonly string[],
  ): void {
    if (!allowedTargetTypes.includes(targetType)) {
      throw AppError.promoCodeTargetNotAllowed(undefined, {
        target_type: targetType,
        allowed_target_types: allowedTargetTypes,
      });
    }
  }

  private static assertPaymentMethodAllowed(
    paymentMethod: PromoCodeAllowedPaymentMethod,
    allowedPaymentMethods: readonly string[],
  ): void {
    if (!allowedPaymentMethods.includes(paymentMethod)) {
      throw AppError.promoCodePaymentMethodNotAllowed(undefined, {
        payment_method: paymentMethod,
        allowed_payment_methods: allowedPaymentMethods,
      });
    }
  }

  private static assertTargetRestrictions(
    promoCode: PromoCodeHydratedRecord,
    target: PromoCodeResolvedCheckoutTarget,
  ): void {
    const targetIds = PromoCodePolicy.extractTargetIds(promoCode);

    if (
      targetIds.class_ids.length > ZERO_AMOUNT &&
      !PromoCodePolicy.includesOptionalId(targetIds.class_ids, target.class_id)
    ) {
      throw AppError.promoCodeCustomerNotEligible(
        'This promo code is not eligible for the selected class.',
        {
          class_id: target.class_id ?? null,
        },
      );
    }

    if (
      targetIds.schedule_ids.length > ZERO_AMOUNT &&
      !PromoCodePolicy.includesOptionalId(
        targetIds.schedule_ids,
        target.schedule_id,
      )
    ) {
      throw AppError.promoCodeCustomerNotEligible(
        'This promo code is not eligible for the selected schedule.',
        {
          schedule_id: target.schedule_id ?? null,
        },
      );
    }

    if (
      targetIds.trainer_staff_profile_ids.length > ZERO_AMOUNT &&
      !PromoCodePolicy.includesOptionalId(
        targetIds.trainer_staff_profile_ids,
        target.trainer_staff_profile_id,
      )
    ) {
      throw AppError.promoCodeCustomerNotEligible(
        'This promo code is not eligible for the selected trainer.',
        {
          trainer_staff_profile_id: target.trainer_staff_profile_id ?? null,
        },
      );
    }

    if (
      targetIds.customer_user_ids.length > ZERO_AMOUNT &&
      !targetIds.customer_user_ids.includes(target.user_id)
    ) {
      throw AppError.promoCodeCustomerNotEligible();
    }
  }

  private static assertStaffCreateLimits(input: PromoCodeCreateInput): void {
    if (input.ends_at === undefined || input.ends_at === null) {
      throw AppError.promoCodeStaffLimitExceeded(
        'Staff-created promo codes must have an expiry date.',
      );
    }

    if (input.max_redemptions === undefined || input.max_redemptions === null) {
      throw AppError.promoCodeStaffLimitExceeded(
        'Staff-created promo codes must have max_redemptions.',
      );
    }

    if (input.per_user_limit === undefined || input.per_user_limit === null) {
      throw AppError.promoCodeStaffLimitExceeded(
        'Staff-created promo codes must have per_user_limit.',
      );
    }

    if (input.max_redemptions > PROMO_CODE_STAFF_MAX_REDEMPTIONS) {
      throw AppError.promoCodeStaffLimitExceeded(
        `Staff-created promo codes cannot exceed ${PROMO_CODE_STAFF_MAX_REDEMPTIONS} total redemptions.`,
        {
          max_redemptions: input.max_redemptions,
        },
      );
    }

    if (input.per_user_limit > PROMO_CODE_STAFF_MAX_PER_USER_LIMIT) {
      throw AppError.promoCodeStaffLimitExceeded(
        `Staff-created promo codes cannot exceed ${PROMO_CODE_STAFF_MAX_PER_USER_LIMIT} redemption per user.`,
        {
          per_user_limit: input.per_user_limit,
        },
      );
    }

    if (
      input.discount_type === 'percentage' &&
      input.discount_value > PROMO_CODE_STAFF_MAX_PERCENTAGE_DISCOUNT
    ) {
      throw AppError.promoCodeStaffLimitExceeded(
        `Staff-created percentage discounts cannot exceed ${PROMO_CODE_STAFF_MAX_PERCENTAGE_DISCOUNT}%.`,
        {
          discount_value: input.discount_value,
        },
      );
    }

    if (
      input.discount_type === 'fixed_amount' &&
      input.discount_value > PROMO_CODE_STAFF_MAX_FIXED_DISCOUNT_AMOUNT
    ) {
      throw AppError.promoCodeStaffLimitExceeded(
        `Staff-created fixed discounts cannot exceed ${PROMO_CODE_STAFF_MAX_FIXED_DISCOUNT_AMOUNT} KWD.`,
        {
          discount_value: input.discount_value,
        },
      );
    }

    if (
      input.max_discount_amount !== undefined &&
      input.max_discount_amount !== null &&
      input.max_discount_amount > PROMO_CODE_STAFF_MAX_MAX_DISCOUNT_AMOUNT
    ) {
      throw AppError.promoCodeStaffLimitExceeded(
        `Staff-created max discount amount cannot exceed ${PROMO_CODE_STAFF_MAX_MAX_DISCOUNT_AMOUNT} KWD.`,
        {
          max_discount_amount: input.max_discount_amount,
        },
      );
    }

    const startsAt =
      PromoCodePolicy.parseOptionalDate(input.starts_at) ?? new Date();
    const endsAt = PromoCodePolicy.parseOptionalDate(input.ends_at);
    const validityDays =
      endsAt === null
        ? Number.POSITIVE_INFINITY
        : (endsAt.getTime() - startsAt.getTime()) / ONE_DAY_IN_MILLISECONDS;

    if (validityDays > PROMO_CODE_STAFF_MAX_VALIDITY_DAYS) {
      throw AppError.promoCodeStaffLimitExceeded(
        `Staff-created promo codes cannot be valid for more than ${PROMO_CODE_STAFF_MAX_VALIDITY_DAYS} days.`,
        {
          starts_at: input.starts_at ?? null,
          ends_at: input.ends_at,
          validity_days: validityDays,
        },
      );
    }
  }

  private static assertOptionalPositiveAmount(
    value: number | null | undefined,
    fieldName: string,
  ): void {
    if (value === null || value === undefined) {
      return;
    }

    PromoCodePolicy.assertPositiveAmount(value, fieldName);
  }

  private static assertPositiveAmount(value: number, fieldName: string): void {
    if (!Number.isFinite(value) || value <= ZERO_AMOUNT) {
      throw AppError.promoCodeDiscountInvalid(
        `${fieldName} must be greater than zero.`,
        {
          [fieldName]: value,
        },
      );
    }
  }

  private static roundAmount(value: number): number {
    return Math.round(value * AMOUNT_MULTIPLIER) / AMOUNT_MULTIPLIER;
  }

  private static parseOptionalDate(value?: string | null): Date | null {
    if (value === undefined || value === null) {
      return null;
    }

    const parsedDate = new Date(value);

    if (Number.isNaN(parsedDate.getTime())) {
      throw AppError.promoCodeInvalid('Promo-code date value is invalid.', {
        value,
      });
    }

    return parsedDate;
  }

  private static normalizeUuidArray(values?: readonly string[]): string[] {
    if (values === undefined) {
      return [];
    }

    const normalizedValues = values
      .map((value) => value.trim())
      .filter((value) => value.length > ZERO_AMOUNT);

    return [...new Set(normalizedValues)];
  }

  private static includesOptionalId(
    ids: readonly string[],
    value?: string | null,
  ): boolean {
    return value !== undefined && value !== null && ids.includes(value);
  }

  private static isAdminActor(actor: PromoCodeActor): boolean {
    return actor.role === 'admin' || actor.role === 'super_admin';
  }

  private static isMutableStatus(status: string): status is PromoCodeStatus {
    return PROMO_CODE_MUTABLE_STATUSES.some(
      (mutableStatus) => mutableStatus === status,
    );
  }

  private static isUsableStatus(status: string): status is PromoCodeStatus {
    return PROMO_CODE_USABLE_STATUSES.some(
      (usableStatus) => usableStatus === status,
    );
  }
  private static isActiveRedemptionStatus(
    status: PromoCodeRedemptionStatus,
  ): boolean {
    return PROMO_CODE_ACTIVE_REDEMPTION_STATUSES.some(
      (activeStatus) => activeStatus === status,
    );
  }

  private static isAllowedTargetType(
    targetType: string,
  ): targetType is PromoCodeAllowedTargetType {
    return PROMO_CODE_ALLOWED_TARGET_TYPES.some(
      (allowedTargetType) => allowedTargetType === targetType,
    );
  }

  private static isAllowedPaymentMethod(
    paymentMethod: string,
  ): paymentMethod is PromoCodeAllowedPaymentMethod {
    return PROMO_CODE_ALLOWED_PAYMENT_METHODS.some(
      (allowedPaymentMethod) => allowedPaymentMethod === paymentMethod,
    );
  }
}
