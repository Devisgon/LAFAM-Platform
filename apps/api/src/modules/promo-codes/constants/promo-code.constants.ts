// apps\api\src\modules\promo-codes\constants\promo-code.constants.ts
import type {
  DatabasePaymentMethod,
  DatabasePaymentTargetType,
  DatabasePromoCodeRedemptionStatus,
  DatabasePromoCodeStatus,
  DatabasePromoDiscountType,
} from '../../../database/database.types';

export const PROMO_CODE_ROUTE_PREFIX = 'promo-codes';
export const PROMO_CODE_ADMIN_ROUTE_PREFIX = 'admin/promo-codes';

export const PROMO_CODE_CODE_MIN_LENGTH = 3;
export const PROMO_CODE_CODE_MAX_LENGTH = 40;
export const PROMO_CODE_DESCRIPTION_MAX_LENGTH = 500;
export const PROMO_CODE_ADMIN_NOTES_MAX_LENGTH = 2000;
export const PROMO_CODE_IDEMPOTENCY_KEY_MAX_LENGTH = 160;
export const PROMO_CODE_RELEASE_REASON_MAX_LENGTH = 1000;

export const PROMO_CODE_DEFAULT_CURRENCY = 'KWD';

export const PROMO_CODE_AMOUNT_DECIMAL_PLACES = 3;
export const PROMO_CODE_PERCENTAGE_MIN_VALUE = 0.001;
export const PROMO_CODE_PERCENTAGE_MAX_VALUE = 100;
export const PROMO_CODE_FIXED_AMOUNT_MIN_VALUE = 0.001;

export const PROMO_CODE_MINIMUM_ORDER_MIN_AMOUNT = 0;
export const PROMO_CODE_MAX_REDEMPTIONS_MIN_VALUE = 1;
export const PROMO_CODE_PER_USER_LIMIT_MIN_VALUE = 1;

export const PROMO_CODE_LIST_DEFAULT_LIMIT = 50;
export const PROMO_CODE_LIST_MAX_LIMIT = 100;
export const PROMO_CODE_LIST_DEFAULT_OFFSET = 0;

export const PROMO_CODE_REDEMPTION_LIST_DEFAULT_LIMIT = 50;
export const PROMO_CODE_REDEMPTION_LIST_MAX_LIMIT = 100;
export const PROMO_CODE_REDEMPTION_LIST_DEFAULT_OFFSET = 0;

export const PROMO_CODE_RESERVATION_TTL_MINUTES = 30;

export const PROMO_CODE_STAFF_MAX_PERCENTAGE_DISCOUNT = 25;
export const PROMO_CODE_STAFF_MAX_FIXED_DISCOUNT_AMOUNT = 5;
export const PROMO_CODE_STAFF_MAX_MAX_DISCOUNT_AMOUNT = 5;
export const PROMO_CODE_STAFF_MAX_REDEMPTIONS = 25;
export const PROMO_CODE_STAFF_MAX_PER_USER_LIMIT = 1;
export const PROMO_CODE_STAFF_MAX_VALIDITY_DAYS = 30;

export const PROMO_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]*[A-Z0-9]$/;

export const PROMO_CODE_DISCOUNT_TYPES = [
  'percentage',
  'fixed_amount',
] as const satisfies readonly DatabasePromoDiscountType[];

export const PROMO_CODE_STATUSES = [
  'draft',
  'active',
  'inactive',
  'paused',
  'expired',
  'exhausted',
  'deleted',
] as const satisfies readonly DatabasePromoCodeStatus[];

export const PROMO_CODE_MUTABLE_STATUSES = [
  'draft',
  'active',
  'inactive',
  'paused',
] as const satisfies readonly DatabasePromoCodeStatus[];

export const PROMO_CODE_USABLE_STATUSES = [
  'active',
] as const satisfies readonly DatabasePromoCodeStatus[];

export const PROMO_CODE_TERMINAL_STATUSES = [
  'expired',
  'exhausted',
  'deleted',
] as const satisfies readonly DatabasePromoCodeStatus[];

export const PROMO_CODE_REDEMPTION_STATUSES = [
  'reserved',
  'redeemed',
  'released',
  'voided',
] as const satisfies readonly DatabasePromoCodeRedemptionStatus[];

export const PROMO_CODE_ACTIVE_REDEMPTION_STATUSES = [
  'reserved',
  'redeemed',
] as const satisfies readonly DatabasePromoCodeRedemptionStatus[];

export const PROMO_CODE_FINAL_REDEMPTION_STATUSES = [
  'redeemed',
  'released',
  'voided',
] as const satisfies readonly DatabasePromoCodeRedemptionStatus[];

export const PROMO_CODE_ALLOWED_TARGET_TYPES = [
  'booking',
  'private_booking',
  'booking_order',
] as const satisfies readonly DatabasePaymentTargetType[];

export const PROMO_CODE_BLOCKED_TARGET_TYPES = [
  'wallet_top_up',
] as const satisfies readonly DatabasePaymentTargetType[];

export const PROMO_CODE_ALLOWED_PAYMENT_METHODS = [
  'knet',
  'card',
  'wallet',
] as const satisfies readonly DatabasePaymentMethod[];

export const PROMO_CODE_ADMIN_ROLES = ['admin', 'super_admin'] as const;

export const PROMO_CODE_STAFF_CREATOR_ROLES = ['staff'] as const;

export const PROMO_CODE_ALLOWED_CREATOR_ROLES = [
  'super_admin',
  'admin',
  'staff',
  'system',
] as const;

export const PROMO_CODE_SORT_FIELDS = [
  'code',
  'status',
  'starts_at',
  'ends_at',
  'redemption_count',
  'created_at',
  'updated_at',
] as const;

export const PROMO_CODE_REDEMPTION_SORT_FIELDS = [
  'reserved_at',
  'redeemed_at',
  'released_at',
  'created_at',
] as const;

export const PROMO_CODE_SORT_DIRECTIONS = ['asc', 'desc'] as const;

export const PROMO_CODE_DEFAULT_SORT_FIELD = 'created_at';
export const PROMO_CODE_DEFAULT_SORT_DIRECTION = 'desc';

export const PROMO_CODE_REDEMPTION_DEFAULT_SORT_FIELD = 'created_at';
export const PROMO_CODE_REDEMPTION_DEFAULT_SORT_DIRECTION = 'desc';

export const PROMO_CODE_TARGET_TABLES = {
  classTargets: 'promo_code_class_targets',
  scheduleTargets: 'promo_code_schedule_targets',
  trainerTargets: 'promo_code_trainer_targets',
  customerTargets: 'promo_code_customer_targets',
} as const;

export const PROMO_CODE_TABLES = {
  promoCodes: 'promo_codes',
  classTargets: PROMO_CODE_TARGET_TABLES.classTargets,
  scheduleTargets: PROMO_CODE_TARGET_TABLES.scheduleTargets,
  trainerTargets: PROMO_CODE_TARGET_TABLES.trainerTargets,
  customerTargets: PROMO_CODE_TARGET_TABLES.customerTargets,
  redemptions: 'promo_code_redemptions',
  paymentDiscounts: 'payment_discounts',
} as const;

export const PROMO_CODE_RPC = {
  reserveRedemption: 'reserve_promo_code_redemption_atomic',
  attachPayment: 'attach_promo_code_redemption_payment_atomic',
  markRedeemed: 'mark_promo_code_redemption_redeemed_atomic',
  releaseRedemption: 'release_promo_code_redemption_atomic',
  releaseExpiredRedemptions: 'release_expired_promo_code_redemptions_atomic',
} as const;

export const PROMO_CODE_SAFE_METADATA_KEYS = [
  'target_type',
  'booking_id',
  'private_booking_id',
  'booking_order_id',
  'payment_id',
  'payment_method',
  'subtotal_amount',
  'discount_amount',
  'final_amount',
  'currency',
  'promo_code_id',
  'promo_code_redemption_id',
  'reserved_at',
  'redeemed_at',
  'released_at',
  'release_reason',
] as const;

export const PROMO_CODE_FORBIDDEN_METADATA_KEYS = [
  'civil_id',
  'password',
  'otp',
  'access_token',
  'refresh_token',
  'token',
  'token_hash',
  'invite_token',
  'invite_url',
  'authorization',
  'cookie',
  'provider_payload',
  'gateway_response',
  'brevo_api_key',
  'knet_secret_key',
  'supabase_secret_key',
] as const;

export type PromoCodeDiscountType = (typeof PROMO_CODE_DISCOUNT_TYPES)[number];

export type PromoCodeStatus = (typeof PROMO_CODE_STATUSES)[number];

export type PromoCodeRedemptionStatus =
  (typeof PROMO_CODE_REDEMPTION_STATUSES)[number];

export type PromoCodeAllowedTargetType =
  (typeof PROMO_CODE_ALLOWED_TARGET_TYPES)[number];

export type PromoCodeAllowedPaymentMethod =
  (typeof PROMO_CODE_ALLOWED_PAYMENT_METHODS)[number];

export type PromoCodeSortField = (typeof PROMO_CODE_SORT_FIELDS)[number];

export type PromoCodeRedemptionSortField =
  (typeof PROMO_CODE_REDEMPTION_SORT_FIELDS)[number];

export type PromoCodeSortDirection =
  (typeof PROMO_CODE_SORT_DIRECTIONS)[number];

export type PromoCodeAllowedCreatorRole =
  (typeof PROMO_CODE_ALLOWED_CREATOR_ROLES)[number];
