// apps/api/src/modules/payments/constants/payment.constants.ts
/**
 * LAFAM Payment Module constants.
 *
 * Role:
 * - Defines shared Payment, Wallet, KNET/provider, Promo, security, and route constants.
 * - Keeps magic strings out of DTOs, policies, services, repositories, and controllers.
 * - Mirrors the database payment enums created by the Payment/Wallet migration.
 * - Defines route-specific rate-limit names used by Payment security guards.
 *
 * Important:
 * - KNET/card payments use hosted redirect flow.
 * - Wallet payments use internal wallet ledger debit.
 * - KWD is the only supported payment currency in this phase.
 * - Provider-specific code must stay behind the payment gateway abstraction.
 * - Do not collect, store, or process raw card data inside LAFAM.
 * - Callback routes are for user navigation; webhook/provider verification is payment truth.
 */

/* -------------------------------------------------------------------------- */
/* Routes                                                                      */
/* -------------------------------------------------------------------------- */

export const PAYMENT_CUSTOMER_ROUTE_PREFIX = 'payments';
export const PAYMENT_PUBLIC_ROUTE_PREFIX = 'payments';
export const PAYMENT_ADMIN_ROUTE_PREFIX = 'admin/payments';

export const WALLET_CUSTOMER_ROUTE_PREFIX = 'wallet';
export const WALLET_ADMIN_ROUTE_PREFIX = 'admin/wallets';

export const PAYMENT_KNET_CALLBACK_ROUTE = 'callback/knet';
export const PAYMENT_KNET_WEBHOOK_ROUTE = 'webhooks/knet';

/* -------------------------------------------------------------------------- */
/* Currency                                                                    */
/* -------------------------------------------------------------------------- */

export const PAYMENT_DEFAULT_CURRENCY = 'KWD' as const;

export const PAYMENT_ALLOWED_CURRENCIES = [PAYMENT_DEFAULT_CURRENCY] as const;

export type PaymentCurrency = (typeof PAYMENT_ALLOWED_CURRENCIES)[number];

export const PAYMENT_CURRENCY_CODE_LENGTH = 3;

/* -------------------------------------------------------------------------- */
/* Payment methods                                                             */
/* -------------------------------------------------------------------------- */

export const PAYMENT_METHOD_KNET = 'knet' as const;
export const PAYMENT_METHOD_CARD = 'card' as const;
export const PAYMENT_METHOD_WALLET = 'wallet' as const;

export const PAYMENT_METHODS = [
  PAYMENT_METHOD_KNET,
  PAYMENT_METHOD_CARD,
  PAYMENT_METHOD_WALLET,
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_HOSTED_REDIRECT_METHODS = [
  PAYMENT_METHOD_KNET,
  PAYMENT_METHOD_CARD,
] as const;

export type PaymentHostedRedirectMethod =
  (typeof PAYMENT_HOSTED_REDIRECT_METHODS)[number];

export const PAYMENT_INTERNAL_METHODS = [PAYMENT_METHOD_WALLET] as const;

export type PaymentInternalMethod = (typeof PAYMENT_INTERNAL_METHODS)[number];

/* -------------------------------------------------------------------------- */
/* Payment providers                                                           */
/* -------------------------------------------------------------------------- */

export const PAYMENT_PROVIDER_MOCK = 'mock' as const;
export const PAYMENT_PROVIDER_KNET = 'knet' as const;
export const PAYMENT_PROVIDER_TAP = 'tap' as const;
export const PAYMENT_PROVIDER_MYFATOORAH = 'myfatoorah' as const;
export const PAYMENT_PROVIDER_CHECKOUT = 'checkout' as const;
export const PAYMENT_PROVIDER_WALLET = 'wallet' as const;
export const PAYMENT_PROVIDER_MANUAL = 'manual' as const;

export const PAYMENT_PROVIDERS = [
  PAYMENT_PROVIDER_MOCK,
  PAYMENT_PROVIDER_KNET,
  PAYMENT_PROVIDER_TAP,
  PAYMENT_PROVIDER_MYFATOORAH,
  PAYMENT_PROVIDER_CHECKOUT,
  PAYMENT_PROVIDER_WALLET,
  PAYMENT_PROVIDER_MANUAL,
] as const;

export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_EXTERNAL_GATEWAY_PROVIDERS = [
  PAYMENT_PROVIDER_MOCK,
  PAYMENT_PROVIDER_KNET,
  PAYMENT_PROVIDER_TAP,
  PAYMENT_PROVIDER_MYFATOORAH,
  PAYMENT_PROVIDER_CHECKOUT,
] as const;

export type PaymentExternalGatewayProvider =
  (typeof PAYMENT_EXTERNAL_GATEWAY_PROVIDERS)[number];

export const PAYMENT_NON_GATEWAY_PROVIDERS = [
  PAYMENT_PROVIDER_WALLET,
  PAYMENT_PROVIDER_MANUAL,
] as const;

export type PaymentNonGatewayProvider =
  (typeof PAYMENT_NON_GATEWAY_PROVIDERS)[number];

/* -------------------------------------------------------------------------- */
/* Payment target types                                                        */
/* -------------------------------------------------------------------------- */

export const PAYMENT_TARGET_TYPE_BOOKING = 'booking' as const;
export const PAYMENT_TARGET_TYPE_PRIVATE_BOOKING = 'private_booking' as const;
export const PAYMENT_TARGET_TYPE_WALLET_TOP_UP = 'wallet_top_up' as const;

export const PAYMENT_TARGET_TYPES = [
  PAYMENT_TARGET_TYPE_BOOKING,
  PAYMENT_TARGET_TYPE_PRIVATE_BOOKING,
  PAYMENT_TARGET_TYPE_WALLET_TOP_UP,
] as const;

export type PaymentTargetType = (typeof PAYMENT_TARGET_TYPES)[number];

export const PAYMENT_BOOKING_TARGET_TYPES = [
  PAYMENT_TARGET_TYPE_BOOKING,
  PAYMENT_TARGET_TYPE_PRIVATE_BOOKING,
] as const;

export type PaymentBookingTargetType =
  (typeof PAYMENT_BOOKING_TARGET_TYPES)[number];

/* -------------------------------------------------------------------------- */
/* Payment statuses                                                            */
/* -------------------------------------------------------------------------- */

export const PAYMENT_STATUS_PENDING = 'pending' as const;
export const PAYMENT_STATUS_REQUIRES_REDIRECT = 'requires_redirect' as const;
export const PAYMENT_STATUS_PROCESSING = 'processing' as const;
export const PAYMENT_STATUS_PAID = 'paid' as const;
export const PAYMENT_STATUS_FAILED = 'failed' as const;
export const PAYMENT_STATUS_CANCELLED = 'cancelled' as const;
export const PAYMENT_STATUS_EXPIRED = 'expired' as const;
export const PAYMENT_STATUS_REFUND_REQUESTED = 'refund_requested' as const;
export const PAYMENT_STATUS_REFUND_PROCESSING = 'refund_processing' as const;
export const PAYMENT_STATUS_MANUAL_REFUND_REQUIRED =
  'manual_refund_required' as const;
export const PAYMENT_STATUS_REFUNDED = 'refunded' as const;

export const PAYMENT_STATUSES = [
  PAYMENT_STATUS_PENDING,
  PAYMENT_STATUS_REQUIRES_REDIRECT,
  PAYMENT_STATUS_PROCESSING,
  PAYMENT_STATUS_PAID,
  PAYMENT_STATUS_FAILED,
  PAYMENT_STATUS_CANCELLED,
  PAYMENT_STATUS_EXPIRED,
  PAYMENT_STATUS_REFUND_REQUESTED,
  PAYMENT_STATUS_REFUND_PROCESSING,
  PAYMENT_STATUS_MANUAL_REFUND_REQUIRED,
  PAYMENT_STATUS_REFUNDED,
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_PRE_SETTLEMENT_STATUSES = [
  PAYMENT_STATUS_PENDING,
  PAYMENT_STATUS_REQUIRES_REDIRECT,
  PAYMENT_STATUS_PROCESSING,
] as const;

export type PaymentPreSettlementStatus =
  (typeof PAYMENT_PRE_SETTLEMENT_STATUSES)[number];

export const PAYMENT_FAILURE_STATUSES = [
  PAYMENT_STATUS_FAILED,
  PAYMENT_STATUS_CANCELLED,
  PAYMENT_STATUS_EXPIRED,
] as const;

export type PaymentFailureStatus = (typeof PAYMENT_FAILURE_STATUSES)[number];

export const PAYMENT_REFUND_STATUSES = [
  PAYMENT_STATUS_REFUND_REQUESTED,
  PAYMENT_STATUS_REFUND_PROCESSING,
  PAYMENT_STATUS_MANUAL_REFUND_REQUIRED,
  PAYMENT_STATUS_REFUNDED,
] as const;

export type PaymentRefundStatus = (typeof PAYMENT_REFUND_STATUSES)[number];

export const PAYMENT_TERMINAL_STATUSES = [
  PAYMENT_STATUS_FAILED,
  PAYMENT_STATUS_CANCELLED,
  PAYMENT_STATUS_EXPIRED,
  PAYMENT_STATUS_REFUNDED,
] as const;

export type PaymentTerminalStatus = (typeof PAYMENT_TERMINAL_STATUSES)[number];

export const PAYMENT_PAID_OR_REFUND_STATUSES = [
  PAYMENT_STATUS_PAID,
  ...PAYMENT_REFUND_STATUSES,
] as const;

export type PaymentPaidOrRefundStatus =
  (typeof PAYMENT_PAID_OR_REFUND_STATUSES)[number];

/* -------------------------------------------------------------------------- */
/* Payment transaction types/statuses                                          */
/* -------------------------------------------------------------------------- */

export const PAYMENT_TRANSACTION_TYPE_INTENT_CREATED =
  'intent_created' as const;
export const PAYMENT_TRANSACTION_TYPE_PROVIDER_REQUEST =
  'provider_request' as const;
export const PAYMENT_TRANSACTION_TYPE_PROVIDER_RESPONSE =
  'provider_response' as const;
export const PAYMENT_TRANSACTION_TYPE_CALLBACK_RECEIVED =
  'callback_received' as const;
export const PAYMENT_TRANSACTION_TYPE_WEBHOOK_RECEIVED =
  'webhook_received' as const;
export const PAYMENT_TRANSACTION_TYPE_VERIFICATION = 'verification' as const;
export const PAYMENT_TRANSACTION_TYPE_STATUS_CHANGE = 'status_change' as const;
export const PAYMENT_TRANSACTION_TYPE_WALLET_DEBIT = 'wallet_debit' as const;
export const PAYMENT_TRANSACTION_TYPE_WALLET_CREDIT = 'wallet_credit' as const;
export const PAYMENT_TRANSACTION_TYPE_REFUND_REQUESTED =
  'refund_requested' as const;
export const PAYMENT_TRANSACTION_TYPE_REFUND_PROCESSED =
  'refund_processed' as const;
export const PAYMENT_TRANSACTION_TYPE_REFUND_FAILED = 'refund_failed' as const;

export const PAYMENT_TRANSACTION_TYPES = [
  PAYMENT_TRANSACTION_TYPE_INTENT_CREATED,
  PAYMENT_TRANSACTION_TYPE_PROVIDER_REQUEST,
  PAYMENT_TRANSACTION_TYPE_PROVIDER_RESPONSE,
  PAYMENT_TRANSACTION_TYPE_CALLBACK_RECEIVED,
  PAYMENT_TRANSACTION_TYPE_WEBHOOK_RECEIVED,
  PAYMENT_TRANSACTION_TYPE_VERIFICATION,
  PAYMENT_TRANSACTION_TYPE_STATUS_CHANGE,
  PAYMENT_TRANSACTION_TYPE_WALLET_DEBIT,
  PAYMENT_TRANSACTION_TYPE_WALLET_CREDIT,
  PAYMENT_TRANSACTION_TYPE_REFUND_REQUESTED,
  PAYMENT_TRANSACTION_TYPE_REFUND_PROCESSED,
  PAYMENT_TRANSACTION_TYPE_REFUND_FAILED,
] as const;

export type PaymentTransactionType = (typeof PAYMENT_TRANSACTION_TYPES)[number];

export const PAYMENT_TRANSACTION_STATUS_PENDING = 'pending' as const;
export const PAYMENT_TRANSACTION_STATUS_SUCCEEDED = 'succeeded' as const;
export const PAYMENT_TRANSACTION_STATUS_FAILED = 'failed' as const;
export const PAYMENT_TRANSACTION_STATUS_IGNORED = 'ignored' as const;

export const PAYMENT_TRANSACTION_STATUSES = [
  PAYMENT_TRANSACTION_STATUS_PENDING,
  PAYMENT_TRANSACTION_STATUS_SUCCEEDED,
  PAYMENT_TRANSACTION_STATUS_FAILED,
  PAYMENT_TRANSACTION_STATUS_IGNORED,
] as const;

export type PaymentTransactionStatus =
  (typeof PAYMENT_TRANSACTION_STATUSES)[number];

/* -------------------------------------------------------------------------- */
/* Wallet account and ledger                                                   */
/* -------------------------------------------------------------------------- */

export const WALLET_ACCOUNT_STATUS_ACTIVE = 'active' as const;
export const WALLET_ACCOUNT_STATUS_FROZEN = 'frozen' as const;
export const WALLET_ACCOUNT_STATUS_CLOSED = 'closed' as const;

export const WALLET_ACCOUNT_STATUSES = [
  WALLET_ACCOUNT_STATUS_ACTIVE,
  WALLET_ACCOUNT_STATUS_FROZEN,
  WALLET_ACCOUNT_STATUS_CLOSED,
] as const;

export type WalletAccountStatus = (typeof WALLET_ACCOUNT_STATUSES)[number];

export const WALLET_LEDGER_ENTRY_TYPE_WALLET_TOP_UP = 'wallet_top_up' as const;
export const WALLET_LEDGER_ENTRY_TYPE_BOOKING_PAYMENT =
  'booking_payment' as const;
export const WALLET_LEDGER_ENTRY_TYPE_PRIVATE_BOOKING_PAYMENT =
  'private_booking_payment' as const;
export const WALLET_LEDGER_ENTRY_TYPE_REFUND_CREDIT = 'refund_credit' as const;
export const WALLET_LEDGER_ENTRY_TYPE_ADMIN_ADJUSTMENT_CREDIT =
  'admin_adjustment_credit' as const;
export const WALLET_LEDGER_ENTRY_TYPE_ADMIN_ADJUSTMENT_DEBIT =
  'admin_adjustment_debit' as const;

export const WALLET_LEDGER_ENTRY_TYPES = [
  WALLET_LEDGER_ENTRY_TYPE_WALLET_TOP_UP,
  WALLET_LEDGER_ENTRY_TYPE_BOOKING_PAYMENT,
  WALLET_LEDGER_ENTRY_TYPE_PRIVATE_BOOKING_PAYMENT,
  WALLET_LEDGER_ENTRY_TYPE_REFUND_CREDIT,
  WALLET_LEDGER_ENTRY_TYPE_ADMIN_ADJUSTMENT_CREDIT,
  WALLET_LEDGER_ENTRY_TYPE_ADMIN_ADJUSTMENT_DEBIT,
] as const;

export type WalletLedgerEntryType = (typeof WALLET_LEDGER_ENTRY_TYPES)[number];

export const WALLET_LEDGER_ENTRY_STATUS_PENDING = 'pending' as const;
export const WALLET_LEDGER_ENTRY_STATUS_POSTED = 'posted' as const;
export const WALLET_LEDGER_ENTRY_STATUS_REVERSED = 'reversed' as const;
export const WALLET_LEDGER_ENTRY_STATUS_FAILED = 'failed' as const;

export const WALLET_LEDGER_ENTRY_STATUSES = [
  WALLET_LEDGER_ENTRY_STATUS_PENDING,
  WALLET_LEDGER_ENTRY_STATUS_POSTED,
  WALLET_LEDGER_ENTRY_STATUS_REVERSED,
  WALLET_LEDGER_ENTRY_STATUS_FAILED,
] as const;

export type WalletLedgerEntryStatus =
  (typeof WALLET_LEDGER_ENTRY_STATUSES)[number];

export const WALLET_CREDIT_ENTRY_TYPES = [
  WALLET_LEDGER_ENTRY_TYPE_WALLET_TOP_UP,
  WALLET_LEDGER_ENTRY_TYPE_REFUND_CREDIT,
  WALLET_LEDGER_ENTRY_TYPE_ADMIN_ADJUSTMENT_CREDIT,
] as const;

export type WalletCreditEntryType = (typeof WALLET_CREDIT_ENTRY_TYPES)[number];

export const WALLET_DEBIT_ENTRY_TYPES = [
  WALLET_LEDGER_ENTRY_TYPE_BOOKING_PAYMENT,
  WALLET_LEDGER_ENTRY_TYPE_PRIVATE_BOOKING_PAYMENT,
  WALLET_LEDGER_ENTRY_TYPE_ADMIN_ADJUSTMENT_DEBIT,
] as const;

export type WalletDebitEntryType = (typeof WALLET_DEBIT_ENTRY_TYPES)[number];

/* -------------------------------------------------------------------------- */
/* Promo codes                                                                 */
/* -------------------------------------------------------------------------- */

export const PROMO_DISCOUNT_TYPE_FIXED_AMOUNT = 'fixed_amount' as const;
export const PROMO_DISCOUNT_TYPE_PERCENTAGE = 'percentage' as const;

export const PROMO_DISCOUNT_TYPES = [
  PROMO_DISCOUNT_TYPE_FIXED_AMOUNT,
  PROMO_DISCOUNT_TYPE_PERCENTAGE,
] as const;

export type PromoDiscountType = (typeof PROMO_DISCOUNT_TYPES)[number];

export const PROMO_CODE_STATUS_ACTIVE = 'active' as const;
export const PROMO_CODE_STATUS_INACTIVE = 'inactive' as const;
export const PROMO_CODE_STATUS_EXPIRED = 'expired' as const;
export const PROMO_CODE_STATUS_DELETED = 'deleted' as const;

export const PROMO_CODE_STATUSES = [
  PROMO_CODE_STATUS_ACTIVE,
  PROMO_CODE_STATUS_INACTIVE,
  PROMO_CODE_STATUS_EXPIRED,
  PROMO_CODE_STATUS_DELETED,
] as const;

export type PromoCodeStatus = (typeof PROMO_CODE_STATUSES)[number];

/* -------------------------------------------------------------------------- */
/* Amount and input validation limits                                          */
/* -------------------------------------------------------------------------- */

export const PAYMENT_AMOUNT_MIN = 0.001;
export const PAYMENT_AMOUNT_MAX = 999_999_999.999;
export const PAYMENT_AMOUNT_DECIMAL_PLACES = 3;

export const PAYMENT_DISCOUNT_AMOUNT_MIN = 0;
export const PAYMENT_REFUND_AMOUNT_MIN = 0.001;

export const WALLET_BALANCE_MIN = 0;
export const WALLET_TOP_UP_AMOUNT_MIN = 0.001;
export const WALLET_TOP_UP_AMOUNT_MAX = 999_999_999.999;
export const WALLET_ADMIN_ADJUSTMENT_AMOUNT_MIN = 0.001;
export const WALLET_ADMIN_ADJUSTMENT_AMOUNT_MAX = 999_999_999.999;

export const PAYMENT_IDEMPOTENCY_KEY_MIN_LENGTH = 8;
export const PAYMENT_IDEMPOTENCY_KEY_MAX_LENGTH = 120;

export const PAYMENT_GATEWAY_REFERENCE_MAX_LENGTH = 255;
export const PAYMENT_GATEWAY_PAYMENT_ID_MAX_LENGTH = 255;
export const PAYMENT_GATEWAY_INVOICE_ID_MAX_LENGTH = 255;

export const PAYMENT_FAILURE_CODE_MAX_LENGTH = 120;
export const PAYMENT_FAILURE_MESSAGE_MAX_LENGTH = 1000;

export const PAYMENT_CALLBACK_RESULT_MAX_LENGTH = 80;
export const PAYMENT_WEBHOOK_EVENT_TYPE_MAX_LENGTH = 120;
export const PAYMENT_WEBHOOK_EVENT_ID_MAX_LENGTH = 255;

export const WALLET_LEDGER_DESCRIPTION_MAX_LENGTH = 500;
export const WALLET_ADMIN_ADJUSTMENT_REASON_MIN_LENGTH = 3;
export const WALLET_ADMIN_ADJUSTMENT_REASON_MAX_LENGTH = 500;

export const REFUND_REASON_MIN_LENGTH = 3;
export const REFUND_REASON_MAX_LENGTH = 500;

export const PROMO_CODE_MIN_LENGTH = 2;
export const PROMO_CODE_MAX_LENGTH = 80;
export const PROMO_CODE_DESCRIPTION_MAX_LENGTH = 1000;
export const PROMO_CODE_PERCENTAGE_MAX = 100;
export const PROMO_CODE_REDEMPTION_MIN = 1;

export const PAYMENT_METADATA_MAX_TOP_LEVEL_KEYS = 50;
export const PAYMENT_PROVIDER_PAYLOAD_MAX_BYTES = 64 * 1024;

/* -------------------------------------------------------------------------- */
/* Pagination defaults                                                         */
/* -------------------------------------------------------------------------- */

export const PAYMENT_LIST_DEFAULT_LIMIT = 20;
export const PAYMENT_LIST_MAX_LIMIT = 100;
export const PAYMENT_LIST_DEFAULT_OFFSET = 0;

export const PAYMENT_TRANSACTION_LIST_DEFAULT_LIMIT = 20;
export const PAYMENT_TRANSACTION_LIST_MAX_LIMIT = 100;
export const PAYMENT_TRANSACTION_LIST_DEFAULT_OFFSET = 0;

export const WALLET_LEDGER_LIST_DEFAULT_LIMIT = 20;
export const WALLET_LEDGER_LIST_MAX_LIMIT = 100;
export const WALLET_LEDGER_LIST_DEFAULT_OFFSET = 0;

export const ADMIN_WALLET_LIST_DEFAULT_LIMIT = 20;
export const ADMIN_WALLET_LIST_MAX_LIMIT = 100;
export const ADMIN_WALLET_LIST_DEFAULT_OFFSET = 0;

/* -------------------------------------------------------------------------- */
/* Payment intent defaults                                                     */
/* -------------------------------------------------------------------------- */

export const PAYMENT_CHECKOUT_INTENT_TTL_MINUTES = 15;
export const PAYMENT_WALLET_TOP_UP_INTENT_TTL_MINUTES = 30;

export const MOCK_PAYMENT_REFERENCE_PREFIX = 'mock_payment';

export const PAYMENT_NUMBER_PREFIX = 'PAY';
export const PAYMENT_RECEIPT_NUMBER_PREFIX = 'RCPT';

/* -------------------------------------------------------------------------- */
/* Provider callback/webhook constants                                         */
/* -------------------------------------------------------------------------- */

export const PAYMENT_CALLBACK_PROVIDER_KNET = 'knet' as const;

export const PAYMENT_CALLBACK_RESULT_SUCCESS = 'success' as const;
export const PAYMENT_CALLBACK_RESULT_FAILED = 'failed' as const;
export const PAYMENT_CALLBACK_RESULT_CANCELLED = 'cancelled' as const;

export const PAYMENT_CALLBACK_RESULTS = [
  PAYMENT_CALLBACK_RESULT_SUCCESS,
  PAYMENT_CALLBACK_RESULT_FAILED,
  PAYMENT_CALLBACK_RESULT_CANCELLED,
] as const;

export type PaymentCallbackResult = (typeof PAYMENT_CALLBACK_RESULTS)[number];

export const PAYMENT_WEBHOOK_SIGNATURE_HEADER_NAMES = [
  'x-knet-signature',
  'x-payment-signature',
  'x-webhook-signature',
] as const;

export const PAYMENT_WEBHOOK_TIMESTAMP_HEADER_NAMES = [
  'x-knet-timestamp',
  'x-payment-timestamp',
  'x-webhook-timestamp',
] as const;

export const PAYMENT_WEBHOOK_EVENT_ID_HEADER_NAMES = [
  'x-knet-event-id',
  'x-payment-event-id',
  'x-webhook-event-id',
] as const;

export const PAYMENT_WEBHOOK_MAX_CLOCK_SKEW_SECONDS = 300;

export const PAYMENT_WEBHOOK_EVENT_PAYMENT_SUCCEEDED =
  'payment.succeeded' as const;
export const PAYMENT_WEBHOOK_EVENT_PAYMENT_FAILED = 'payment.failed' as const;
export const PAYMENT_WEBHOOK_EVENT_PAYMENT_CANCELLED =
  'payment.cancelled' as const;
export const PAYMENT_WEBHOOK_EVENT_PAYMENT_REFUNDED =
  'payment.refunded' as const;

export const PAYMENT_WEBHOOK_EVENTS = [
  PAYMENT_WEBHOOK_EVENT_PAYMENT_SUCCEEDED,
  PAYMENT_WEBHOOK_EVENT_PAYMENT_FAILED,
  PAYMENT_WEBHOOK_EVENT_PAYMENT_CANCELLED,
  PAYMENT_WEBHOOK_EVENT_PAYMENT_REFUNDED,
] as const;

export type PaymentWebhookEvent = (typeof PAYMENT_WEBHOOK_EVENTS)[number];

/* -------------------------------------------------------------------------- */
/* Payment security and rate-limit buckets                                     */
/* -------------------------------------------------------------------------- */

export const PAYMENT_RATE_LIMIT_CHECKOUT_CREATE =
  'payment_checkout_create' as const;
export const PAYMENT_RATE_LIMIT_PAYMENT_VERIFY = 'payment_verify' as const;
export const PAYMENT_RATE_LIMIT_PAYMENT_READ = 'payment_read' as const;
export const PAYMENT_RATE_LIMIT_WALLET_TOP_UP = 'wallet_top_up' as const;
export const PAYMENT_RATE_LIMIT_WALLET_READ = 'wallet_read' as const;
export const PAYMENT_RATE_LIMIT_CALLBACK = 'payment_callback' as const;
export const PAYMENT_RATE_LIMIT_WEBHOOK = 'payment_webhook' as const;
export const PAYMENT_RATE_LIMIT_ADMIN_REFUND = 'admin_payment_refund' as const;
export const PAYMENT_RATE_LIMIT_ADMIN_WALLET_ADJUST =
  'admin_wallet_adjust' as const;

export const PAYMENT_RATE_LIMIT_BUCKETS = [
  PAYMENT_RATE_LIMIT_CHECKOUT_CREATE,
  PAYMENT_RATE_LIMIT_PAYMENT_VERIFY,
  PAYMENT_RATE_LIMIT_PAYMENT_READ,
  PAYMENT_RATE_LIMIT_WALLET_TOP_UP,
  PAYMENT_RATE_LIMIT_WALLET_READ,
  PAYMENT_RATE_LIMIT_CALLBACK,
  PAYMENT_RATE_LIMIT_WEBHOOK,
  PAYMENT_RATE_LIMIT_ADMIN_REFUND,
  PAYMENT_RATE_LIMIT_ADMIN_WALLET_ADJUST,
] as const;

export type PaymentRateLimitBucket =
  (typeof PAYMENT_RATE_LIMIT_BUCKETS)[number];

export const PAYMENT_RATE_LIMIT_WINDOW_SECONDS = 60;

export const PAYMENT_RATE_LIMIT_CHECKOUT_CREATE_MAX = 10;
export const PAYMENT_RATE_LIMIT_PAYMENT_VERIFY_MAX = 10;
export const PAYMENT_RATE_LIMIT_PAYMENT_READ_MAX = 60;
export const PAYMENT_RATE_LIMIT_WALLET_TOP_UP_MAX = 5;
export const PAYMENT_RATE_LIMIT_WALLET_READ_MAX = 60;
export const PAYMENT_RATE_LIMIT_CALLBACK_MAX = 60;
export const PAYMENT_RATE_LIMIT_WEBHOOK_MAX = 120;
export const PAYMENT_RATE_LIMIT_ADMIN_REFUND_MAX = 5;
export const PAYMENT_RATE_LIMIT_ADMIN_WALLET_ADJUST_MAX = 5;

export const PAYMENT_RATE_LIMIT_KEY_USER_PREFIX = 'user';
export const PAYMENT_RATE_LIMIT_KEY_IP_PREFIX = 'ip';
export const PAYMENT_RATE_LIMIT_KEY_PAYMENT_PREFIX = 'payment';
export const PAYMENT_RATE_LIMIT_KEY_PROVIDER_REFERENCE_PREFIX =
  'provider_reference';
export const PAYMENT_RATE_LIMIT_KEY_TARGET_USER_PREFIX = 'target_user';

export const PAYMENT_SENSITIVE_METADATA_KEYS = [
  'authorization',
  'card',
  'card_number',
  'cvv',
  'cvc',
  'expiry',
  'exp_month',
  'exp_year',
  'pan',
  'token',
  'access_token',
  'refresh_token',
  'signature',
  'secret',
  'password',
  'otp',
  'knet_secret_key',
  'knet_webhook_secret',
] as const;

export type PaymentSensitiveMetadataKey =
  (typeof PAYMENT_SENSITIVE_METADATA_KEYS)[number];

export const PAYMENT_SAFE_LOG_CONTEXT_KEYS = [
  'request_id',
  'payment_id',
  'payment_number',
  'booking_id',
  'private_booking_id',
  'user_id',
  'admin_user_id',
  'provider',
  'gateway_reference',
  'status',
  'failure_code',
] as const;

export type PaymentSafeLogContextKey =
  (typeof PAYMENT_SAFE_LOG_CONTEXT_KEYS)[number];

/* -------------------------------------------------------------------------- */
/* Type guards                                                                 */
/* -------------------------------------------------------------------------- */

const PAYMENT_CURRENCY_SET = new Set<PaymentCurrency>(
  PAYMENT_ALLOWED_CURRENCIES,
);

const PAYMENT_METHOD_SET = new Set<PaymentMethod>(PAYMENT_METHODS);

const PAYMENT_HOSTED_REDIRECT_METHOD_SET = new Set<PaymentHostedRedirectMethod>(
  PAYMENT_HOSTED_REDIRECT_METHODS,
);

const PAYMENT_PROVIDER_SET = new Set<PaymentProvider>(PAYMENT_PROVIDERS);

const PAYMENT_EXTERNAL_GATEWAY_PROVIDER_SET =
  new Set<PaymentExternalGatewayProvider>(PAYMENT_EXTERNAL_GATEWAY_PROVIDERS);

const PAYMENT_TARGET_TYPE_SET = new Set<PaymentTargetType>(
  PAYMENT_TARGET_TYPES,
);

const PAYMENT_BOOKING_TARGET_TYPE_SET = new Set<PaymentBookingTargetType>(
  PAYMENT_BOOKING_TARGET_TYPES,
);

const PAYMENT_STATUS_SET = new Set<PaymentStatus>(PAYMENT_STATUSES);

const PAYMENT_PRE_SETTLEMENT_STATUS_SET = new Set<PaymentPreSettlementStatus>(
  PAYMENT_PRE_SETTLEMENT_STATUSES,
);

const PAYMENT_REFUND_STATUS_SET = new Set<PaymentRefundStatus>(
  PAYMENT_REFUND_STATUSES,
);

const PAYMENT_TERMINAL_STATUS_SET = new Set<PaymentTerminalStatus>(
  PAYMENT_TERMINAL_STATUSES,
);

const PAYMENT_TRANSACTION_TYPE_SET = new Set<PaymentTransactionType>(
  PAYMENT_TRANSACTION_TYPES,
);

const PAYMENT_TRANSACTION_STATUS_SET = new Set<PaymentTransactionStatus>(
  PAYMENT_TRANSACTION_STATUSES,
);

const WALLET_ACCOUNT_STATUS_SET = new Set<WalletAccountStatus>(
  WALLET_ACCOUNT_STATUSES,
);

const WALLET_LEDGER_ENTRY_TYPE_SET = new Set<WalletLedgerEntryType>(
  WALLET_LEDGER_ENTRY_TYPES,
);

const WALLET_LEDGER_ENTRY_STATUS_SET = new Set<WalletLedgerEntryStatus>(
  WALLET_LEDGER_ENTRY_STATUSES,
);

const WALLET_CREDIT_ENTRY_TYPE_SET = new Set<WalletCreditEntryType>(
  WALLET_CREDIT_ENTRY_TYPES,
);

const WALLET_DEBIT_ENTRY_TYPE_SET = new Set<WalletDebitEntryType>(
  WALLET_DEBIT_ENTRY_TYPES,
);

const PROMO_DISCOUNT_TYPE_SET = new Set<PromoDiscountType>(
  PROMO_DISCOUNT_TYPES,
);

const PROMO_CODE_STATUS_SET = new Set<PromoCodeStatus>(PROMO_CODE_STATUSES);

const PAYMENT_CALLBACK_RESULT_SET = new Set<PaymentCallbackResult>(
  PAYMENT_CALLBACK_RESULTS,
);

const PAYMENT_WEBHOOK_EVENT_SET = new Set<PaymentWebhookEvent>(
  PAYMENT_WEBHOOK_EVENTS,
);

const PAYMENT_RATE_LIMIT_BUCKET_SET = new Set<PaymentRateLimitBucket>(
  PAYMENT_RATE_LIMIT_BUCKETS,
);

export function isPaymentCurrency(value: string): value is PaymentCurrency {
  return PAYMENT_CURRENCY_SET.has(value as PaymentCurrency);
}

export function isPaymentMethod(value: string): value is PaymentMethod {
  return PAYMENT_METHOD_SET.has(value as PaymentMethod);
}

export function isPaymentHostedRedirectMethod(
  value: string,
): value is PaymentHostedRedirectMethod {
  return PAYMENT_HOSTED_REDIRECT_METHOD_SET.has(
    value as PaymentHostedRedirectMethod,
  );
}

export function isPaymentProvider(value: string): value is PaymentProvider {
  return PAYMENT_PROVIDER_SET.has(value as PaymentProvider);
}

export function isPaymentExternalGatewayProvider(
  value: string,
): value is PaymentExternalGatewayProvider {
  return PAYMENT_EXTERNAL_GATEWAY_PROVIDER_SET.has(
    value as PaymentExternalGatewayProvider,
  );
}

export function isPaymentTargetType(value: string): value is PaymentTargetType {
  return PAYMENT_TARGET_TYPE_SET.has(value as PaymentTargetType);
}

export function isPaymentBookingTargetType(
  value: string,
): value is PaymentBookingTargetType {
  return PAYMENT_BOOKING_TARGET_TYPE_SET.has(value as PaymentBookingTargetType);
}

export function isPaymentStatus(value: string): value is PaymentStatus {
  return PAYMENT_STATUS_SET.has(value as PaymentStatus);
}

export function isPaymentPreSettlementStatus(
  value: string,
): value is PaymentPreSettlementStatus {
  return PAYMENT_PRE_SETTLEMENT_STATUS_SET.has(
    value as PaymentPreSettlementStatus,
  );
}

export function isPaymentRefundStatus(
  value: string,
): value is PaymentRefundStatus {
  return PAYMENT_REFUND_STATUS_SET.has(value as PaymentRefundStatus);
}

export function isPaymentTerminalStatus(
  value: string,
): value is PaymentTerminalStatus {
  return PAYMENT_TERMINAL_STATUS_SET.has(value as PaymentTerminalStatus);
}

export function isPaymentTransactionType(
  value: string,
): value is PaymentTransactionType {
  return PAYMENT_TRANSACTION_TYPE_SET.has(value as PaymentTransactionType);
}

export function isPaymentTransactionStatus(
  value: string,
): value is PaymentTransactionStatus {
  return PAYMENT_TRANSACTION_STATUS_SET.has(value as PaymentTransactionStatus);
}

export function isWalletAccountStatus(
  value: string,
): value is WalletAccountStatus {
  return WALLET_ACCOUNT_STATUS_SET.has(value as WalletAccountStatus);
}

export function isWalletLedgerEntryType(
  value: string,
): value is WalletLedgerEntryType {
  return WALLET_LEDGER_ENTRY_TYPE_SET.has(value as WalletLedgerEntryType);
}

export function isWalletLedgerEntryStatus(
  value: string,
): value is WalletLedgerEntryStatus {
  return WALLET_LEDGER_ENTRY_STATUS_SET.has(value as WalletLedgerEntryStatus);
}

export function isWalletCreditEntryType(
  value: string,
): value is WalletCreditEntryType {
  return WALLET_CREDIT_ENTRY_TYPE_SET.has(value as WalletCreditEntryType);
}

export function isWalletDebitEntryType(
  value: string,
): value is WalletDebitEntryType {
  return WALLET_DEBIT_ENTRY_TYPE_SET.has(value as WalletDebitEntryType);
}

export function isPromoDiscountType(value: string): value is PromoDiscountType {
  return PROMO_DISCOUNT_TYPE_SET.has(value as PromoDiscountType);
}

export function isPromoCodeStatus(value: string): value is PromoCodeStatus {
  return PROMO_CODE_STATUS_SET.has(value as PromoCodeStatus);
}

export function isPaymentCallbackResult(
  value: string,
): value is PaymentCallbackResult {
  return PAYMENT_CALLBACK_RESULT_SET.has(value as PaymentCallbackResult);
}

export function isPaymentWebhookEvent(
  value: string,
): value is PaymentWebhookEvent {
  return PAYMENT_WEBHOOK_EVENT_SET.has(value as PaymentWebhookEvent);
}

export function isPaymentRateLimitBucket(
  value: string,
): value is PaymentRateLimitBucket {
  return PAYMENT_RATE_LIMIT_BUCKET_SET.has(value as PaymentRateLimitBucket);
}
