// apps/api/src/modules/promo-codes/types/promo-code.types.ts
/**
 * LAFAM Promo Code Module shared types.
 *
 * Role:
 * - Defines Promo Code Module service, repository, policy, and response contracts.
 * - Wraps database rows and RPC return types with promo-specific names.
 * - Keeps admin/staff management, customer preview, checkout reservation, redemption, and release boundaries explicit.
 * - Provides typed target structures for booking, private booking, booking-order, class, schedule, trainer, and customer restrictions.
 *
 * Important:
 * - These are TypeScript contracts only.
 * - This file does not validate requests.
 * - This file does not calculate discounts.
 * - This file does not create payments, confirm bookings, mutate wallets, or process refunds.
 * - Promo-code discount truth must remain backend-owned.
 * - Promo codes apply before payment creation, not after payment is already paid.
 * - Wallet top-up is intentionally excluded from promo-code usage.
 * - Sensitive values such as Civil ID, OTPs, passwords, tokens, cookies, and provider payloads must not be placed in promo metadata.
 */

import type {
  AttachPromoCodeRedemptionPaymentAtomicRpcRow,
  DatabaseJsonObject,
  MarkPromoCodeRedemptionRedeemedAtomicRpcRow,
  PaymentDiscountInsert,
  PaymentDiscountRow,
  PromoCodeClassTargetInsert,
  PromoCodeClassTargetRow,
  PromoCodeCustomerTargetInsert,
  PromoCodeCustomerTargetRow,
  PromoCodeInsert,
  PromoCodeRedemptionInsert,
  PromoCodeRedemptionRow,
  PromoCodeRedemptionUpdate,
  PromoCodeRow,
  PromoCodeScheduleTargetInsert,
  PromoCodeScheduleTargetRow,
  PromoCodeTrainerTargetInsert,
  PromoCodeTrainerTargetRow,
  PromoCodeUpdate,
  ReleaseExpiredPromoCodeRedemptionsAtomicRpcRow,
  ReleasePromoCodeRedemptionAtomicRpcRow,
  ReservePromoCodeRedemptionAtomicRpcRow,
} from '../../../database/database.types';
import type {
  PromoCodeAllowedCreatorRole,
  PromoCodeAllowedPaymentMethod,
  PromoCodeAllowedTargetType,
  PromoCodeDiscountType,
  PromoCodeRedemptionSortField,
  PromoCodeRedemptionStatus,
  PromoCodeSortDirection,
  PromoCodeSortField,
  PromoCodeStatus,
} from '../constants/promo-code.constants';

export type PromoCodeRecord = PromoCodeRow;
export type PromoCodeCreateRecord = PromoCodeInsert;
export type PromoCodeUpdateRecord = PromoCodeUpdate;

export type PromoCodeClassTargetRecord = PromoCodeClassTargetRow;
export type PromoCodeClassTargetCreateRecord = PromoCodeClassTargetInsert;

export type PromoCodeScheduleTargetRecord = PromoCodeScheduleTargetRow;
export type PromoCodeScheduleTargetCreateRecord = PromoCodeScheduleTargetInsert;

export type PromoCodeTrainerTargetRecord = PromoCodeTrainerTargetRow;
export type PromoCodeTrainerTargetCreateRecord = PromoCodeTrainerTargetInsert;

export type PromoCodeCustomerTargetRecord = PromoCodeCustomerTargetRow;
export type PromoCodeCustomerTargetCreateRecord = PromoCodeCustomerTargetInsert;

export type PromoCodeRedemptionRecord = PromoCodeRedemptionRow;
export type PromoCodeRedemptionCreateRecord = PromoCodeRedemptionInsert;
export type PromoCodeRedemptionUpdateRecord = PromoCodeRedemptionUpdate;

export type PromoCodePaymentDiscountRecord = PaymentDiscountRow;
export type PromoCodePaymentDiscountCreateRecord = PaymentDiscountInsert;

export type ReservePromoCodeRedemptionResult =
  ReservePromoCodeRedemptionAtomicRpcRow;

export type AttachPromoCodeRedemptionPaymentResult =
  AttachPromoCodeRedemptionPaymentAtomicRpcRow;

export type MarkPromoCodeRedemptionRedeemedResult =
  MarkPromoCodeRedemptionRedeemedAtomicRpcRow;

export type ReleasePromoCodeRedemptionResult =
  ReleasePromoCodeRedemptionAtomicRpcRow;

export type ReleaseExpiredPromoCodeRedemptionsResult =
  ReleaseExpiredPromoCodeRedemptionsAtomicRpcRow;

export type PromoCodeCreatorRole = PromoCodeAllowedCreatorRole;
export type PromoCodePaymentMethod = PromoCodeAllowedPaymentMethod;
export type PromoCodeTargetType = PromoCodeAllowedTargetType;

export interface PromoCodeActor {
  readonly user_id: string;
  readonly role: PromoCodeCreatorRole;
}

export interface PromoCodeTargetIds {
  readonly class_ids: readonly string[];
  readonly schedule_ids: readonly string[];
  readonly trainer_staff_profile_ids: readonly string[];
  readonly customer_user_ids: readonly string[];
}

export interface PromoCodeTargetIdMutationInput {
  readonly class_ids?: readonly string[];
  readonly schedule_ids?: readonly string[];
  readonly trainer_staff_profile_ids?: readonly string[];
  readonly customer_user_ids?: readonly string[];
}

export interface PromoCodeTargetRecords {
  readonly class_targets: readonly PromoCodeClassTargetRecord[];
  readonly schedule_targets: readonly PromoCodeScheduleTargetRecord[];
  readonly trainer_targets: readonly PromoCodeTrainerTargetRecord[];
  readonly customer_targets: readonly PromoCodeCustomerTargetRecord[];
}

export interface PromoCodeHydratedRecord extends PromoCodeTargetRecords {
  readonly promo_code: PromoCodeRecord;
}

export interface PromoCodeCreateInput {
  readonly code: string;
  readonly description?: string | null;
  readonly discount_type: PromoCodeDiscountType;
  readonly discount_value: number;
  readonly max_discount_amount?: number | null;
  readonly starts_at?: string | null;
  readonly ends_at?: string | null;
  readonly max_redemptions?: number | null;
  readonly per_user_limit?: number | null;
  readonly status?: PromoCodeStatus;
  readonly currency?: string;
  readonly minimum_order_amount?: number;
  readonly first_time_customer_only?: boolean;
  readonly allowed_target_types: readonly PromoCodeTargetType[];
  readonly allowed_payment_methods?: readonly PromoCodePaymentMethod[];
  readonly target_ids?: PromoCodeTargetIdMutationInput;
  readonly admin_notes?: string | null;
  readonly metadata?: DatabaseJsonObject;
  readonly actor: PromoCodeActor;
}

export interface PromoCodeUpdateInput {
  readonly promo_code_id: string;
  readonly description?: string | null;
  readonly discount_type?: PromoCodeDiscountType;
  readonly discount_value?: number;
  readonly max_discount_amount?: number | null;
  readonly starts_at?: string | null;
  readonly ends_at?: string | null;
  readonly max_redemptions?: number | null;
  readonly per_user_limit?: number | null;
  readonly status?: PromoCodeStatus;
  readonly minimum_order_amount?: number;
  readonly first_time_customer_only?: boolean;
  readonly allowed_target_types?: readonly PromoCodeTargetType[];
  readonly allowed_payment_methods?: readonly PromoCodePaymentMethod[];
  readonly target_ids?: PromoCodeTargetIdMutationInput;
  readonly admin_notes?: string | null;
  readonly metadata?: DatabaseJsonObject;
  readonly actor: PromoCodeActor;
}

export interface PromoCodeStatusMutationInput {
  readonly promo_code_id: string;
  readonly actor: PromoCodeActor;
}

export interface PromoCodeDeleteInput {
  readonly promo_code_id: string;
  readonly actor: PromoCodeActor;
}

export interface PromoCodeCreateRepositoryInput {
  readonly promo_code: PromoCodeCreateRecord;
  readonly target_ids: PromoCodeTargetIds;
}

export interface PromoCodeUpdateRepositoryInput {
  readonly promo_code_id: string;
  readonly promo_code: PromoCodeUpdateRecord;
  readonly target_ids?: PromoCodeTargetIdMutationInput;
}

export interface PromoCodeListFilters {
  readonly search?: string;
  readonly status?: PromoCodeStatus;
  readonly discount_type?: PromoCodeDiscountType;
  readonly target_type?: PromoCodeTargetType;
  readonly payment_method?: PromoCodePaymentMethod;
  readonly created_by_admin_id?: string;
  readonly created_by_role?: PromoCodeCreatorRole;
  readonly starts_from?: string;
  readonly starts_to?: string;
  readonly ends_from?: string;
  readonly ends_to?: string;
  readonly include_deleted: boolean;
  readonly limit: number;
  readonly offset: number;
  readonly sort_by: PromoCodeSortField;
  readonly sort_direction: PromoCodeSortDirection;
}

export interface PromoCodeListResult {
  readonly records: readonly PromoCodeHydratedRecord[];
  readonly total: number;
}

export interface PromoCodeRedemptionListFilters {
  readonly promo_code_id?: string;
  readonly user_id?: string;
  readonly payment_id?: string;
  readonly status?: PromoCodeRedemptionStatus;
  readonly target_type?: PromoCodeTargetType;
  readonly booking_id?: string;
  readonly private_booking_id?: string;
  readonly booking_order_id?: string;
  readonly from_date?: string;
  readonly to_date?: string;
  readonly limit: number;
  readonly offset: number;
  readonly sort_by: PromoCodeRedemptionSortField;
  readonly sort_direction: PromoCodeSortDirection;
}

export interface PromoCodeRedemptionListResult {
  readonly records: readonly PromoCodeRedemptionRecord[];
  readonly total: number;
}

export interface PromoCodeCheckoutTargetReference {
  readonly target_type: PromoCodeTargetType;
  readonly booking_id?: string | null;
  readonly private_booking_id?: string | null;
  readonly booking_order_id?: string | null;
}

export interface PromoCodeResolvedCheckoutTarget extends PromoCodeCheckoutTargetReference {
  readonly user_id: string;
  readonly subtotal_amount: number;
  readonly currency: string;
  readonly class_id?: string | null;
  readonly schedule_id?: string | null;
  readonly trainer_staff_profile_id?: string | null;
  readonly payment_method?: PromoCodePaymentMethod | null;
  readonly metadata?: DatabaseJsonObject;
}

export interface PromoCodePreviewInput extends PromoCodeCheckoutTargetReference {
  readonly code: string;
  readonly user_id: string;
  readonly payment_method?: PromoCodePaymentMethod | null;
}

export interface PromoCodeValidationInput {
  readonly code: string;
  readonly user_id: string;
  readonly payment_method: PromoCodePaymentMethod;
  readonly target: PromoCodeResolvedCheckoutTarget;
}

export interface PromoCodeReserveInput extends PromoCodeValidationInput {
  readonly idempotency_key: string;
  readonly expires_at?: string | null;
  readonly metadata?: DatabaseJsonObject;
}

export interface PromoCodeAttachPaymentInput {
  readonly redemption_id: string;
  readonly payment_id: string;
  readonly metadata?: DatabaseJsonObject;
}

export interface PromoCodeMarkRedeemedInput {
  readonly redemption_id?: string | null;
  readonly payment_id?: string | null;
  readonly metadata?: DatabaseJsonObject;
}

export interface PromoCodeReleaseInput {
  readonly redemption_id?: string | null;
  readonly payment_id?: string | null;
  readonly release_reason?: string | null;
  readonly metadata?: DatabaseJsonObject;
}

export interface PromoCodeReleaseExpiredInput {
  readonly now?: string;
  readonly limit?: number;
}

export interface PromoCodeDiscountCalculationInput {
  readonly discount_type: PromoCodeDiscountType;
  readonly discount_value: number;
  readonly max_discount_amount?: number | null;
  readonly subtotal_amount: number;
  readonly currency: string;
}

export interface PromoCodeDiscountCalculationResult {
  readonly subtotal_amount: number;
  readonly discount_amount: number;
  readonly final_amount: number;
  readonly currency: string;
}

export interface PromoCodeEligibilityContext {
  readonly promo_code: PromoCodeHydratedRecord;
  readonly target: PromoCodeResolvedCheckoutTarget;
  readonly payment_method: PromoCodePaymentMethod;
  readonly user_redemption_count: number;
  readonly has_prior_paid_booking: boolean;
  readonly now: Date;
}

export interface PromoCodeValidationResult {
  readonly promo_code: PromoCodeRecord;
  readonly target_ids: PromoCodeTargetIds;
  readonly pricing: PromoCodeDiscountCalculationResult;
}

export interface PromoCodeReservationResult {
  readonly promo_code: PromoCodeRecord;
  readonly target_ids: PromoCodeTargetIds;
  readonly pricing: PromoCodeDiscountCalculationResult;
  readonly redemption: ReservePromoCodeRedemptionResult;
}

export interface PromoCodeTargetSummary {
  readonly class_ids: readonly string[];
  readonly schedule_ids: readonly string[];
  readonly trainer_staff_profile_ids: readonly string[];
  readonly customer_user_ids: readonly string[];
}

export interface PromoCodeUsageSummary {
  readonly redemption_count: number;
  readonly max_redemptions: number | null;
  readonly per_user_limit: number | null;
  readonly remaining_redemptions: number | null;
}

export interface PromoCodeResponse {
  readonly id: string;
  readonly code: string;
  readonly description: string | null;
  readonly discount_type: PromoCodeDiscountType;
  readonly discount_value: number;
  readonly max_discount_amount: number | null;
  readonly starts_at: string | null;
  readonly ends_at: string | null;
  readonly max_redemptions: number | null;
  readonly per_user_limit: number | null;
  readonly redemption_count: number;
  readonly status: PromoCodeStatus;
  readonly currency: string;
  readonly minimum_order_amount: number;
  readonly first_time_customer_only: boolean;
  readonly allowed_target_types: readonly PromoCodeTargetType[];
  readonly allowed_payment_methods: readonly PromoCodePaymentMethod[];
  readonly targets: PromoCodeTargetSummary;
  readonly usage: PromoCodeUsageSummary;
  readonly created_by_admin_id: string | null;
  readonly updated_by_admin_id: string | null;
  readonly created_by_role: PromoCodeCreatorRole | null;
  readonly admin_notes: string | null;
  readonly metadata: DatabaseJsonObject;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
}

export interface PromoCodeListResponse {
  readonly promo_codes: readonly PromoCodeResponse[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export interface PromoCodePreviewResponse {
  readonly promo_code: Pick<
    PromoCodeResponse,
    | 'id'
    | 'code'
    | 'description'
    | 'discount_type'
    | 'discount_value'
    | 'max_discount_amount'
  >;
  readonly pricing: PromoCodeDiscountCalculationResult;
  readonly applies: true;
}

export interface PromoCodeRedemptionResponse {
  readonly id: string;
  readonly promo_code_id: string;
  readonly user_id: string;
  readonly payment_id: string | null;
  readonly target_type: PromoCodeTargetType;
  readonly booking_id: string | null;
  readonly private_booking_id: string | null;
  readonly booking_order_id: string | null;
  readonly payment_method: PromoCodePaymentMethod;
  readonly idempotency_key: string;
  readonly status: PromoCodeRedemptionStatus;
  readonly subtotal_amount: number;
  readonly discount_amount: number;
  readonly final_amount: number;
  readonly currency: string;
  readonly reserved_at: string;
  readonly redeemed_at: string | null;
  readonly released_at: string | null;
  readonly expires_at: string | null;
  readonly release_reason: string | null;
  readonly metadata: DatabaseJsonObject;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface PromoCodeRedemptionListResponse {
  readonly redemptions: readonly PromoCodeRedemptionResponse[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export interface PromoCodePaymentDiscountResponse {
  readonly id: string;
  readonly payment_id: string;
  readonly promo_code_id: string | null;
  readonly promo_code_redemption_id: string | null;
  readonly code: string;
  readonly discount_amount: number;
  readonly metadata: DatabaseJsonObject;
  readonly created_at: string;
}

export interface PromoCodeMetadataSanitizationResult {
  readonly metadata: DatabaseJsonObject;
  readonly removed_keys: readonly string[];
}
