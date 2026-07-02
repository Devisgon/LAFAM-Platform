// apps/api/src/modules/payments/types/payment.types.ts
/**
 * LAFAM Payment Module shared types.
 *
 * Role:
 * - Defines Payment Module service, provider, repository, wallet, and response contracts.
 * - Keeps DTO/controller/service boundaries explicit.
 * - Wraps database rows and RPC return types with domain-specific names.
 * - Defines normalized provider result shapes so business logic does not depend on raw KNET/Tap/MyFatoorah response shapes.
 *
 * Important:
 * - These are TypeScript contracts only.
 * - This file does not validate requests.
 * - This file does not call payment providers.
 * - This file does not mutate payments, bookings, private bookings, wallets, or refunds.
 * - All trusted payment amounts must come from backend-owned pricing.
 * - Raw provider payloads must be sanitized before logging.
 */

import type {
  CreatePaymentIntentAtomicRpcRow,
  CreditWalletAtomicRpcRow,
  DatabaseJsonObject,
  DebitWalletForBookingAtomicRpcRow,
  DebitWalletForBookingOrderAtomicRpcRow,
  ExpirePaymentIntentsAtomicRpcRow,
  MarkPaymentCancelledAtomicRpcRow,
  MarkPaymentFailedAtomicRpcRow,
  MarkPaymentPaidAtomicRpcRow,
  PaymentDiscountInsert,
  PaymentDiscountRow,
  PaymentDiscountUpdate,
  PaymentInsert,
  PaymentRow,
  PaymentTransactionInsert,
  PaymentTransactionRow,
  PaymentTransactionUpdate,
  PaymentUpdate,
  PromoCodeInsert,
  PromoCodeRow,
  PromoCodeUpdate,
  RefundPaymentAtomicRpcRow,
  WalletAccountInsert,
  WalletAccountRow,
  WalletAccountUpdate,
  WalletLedgerEntryInsert,
  WalletLedgerEntryRow,
  WalletLedgerEntryUpdate,
} from '../../../database/database.types';
import type {
  PaymentCallbackResult,
  PaymentCurrency,
  PaymentExternalGatewayProvider,
  PaymentHostedRedirectMethod,
  PaymentMethod,
  PaymentProvider,
  PaymentRateLimitBucket,
  PaymentStatus,
  PaymentTargetType,
  PaymentTransactionStatus,
  PaymentTransactionType,
  PaymentWebhookEvent,
  WalletAccountStatus,
  WalletCreditEntryType,
  WalletDebitEntryType,
  WalletLedgerEntryStatus,
  WalletLedgerEntryType,
} from '../constants/payment.constants';

/* -------------------------------------------------------------------------- */
/* Database record aliases                                                     */
/* -------------------------------------------------------------------------- */

export type PaymentRecord = PaymentRow;
export type PaymentCreateRecord = PaymentInsert;
export type PaymentUpdateRecord = PaymentUpdate;

export type PaymentTransactionRecord = PaymentTransactionRow;
export type PaymentTransactionCreateRecord = PaymentTransactionInsert;
export type PaymentTransactionUpdateRecord = PaymentTransactionUpdate;

export type WalletAccountRecord = WalletAccountRow;
export type WalletAccountCreateRecord = WalletAccountInsert;
export type WalletAccountUpdateRecord = WalletAccountUpdate;

export type WalletLedgerEntryRecord = WalletLedgerEntryRow;
export type WalletLedgerEntryCreateRecord = WalletLedgerEntryInsert;
export type WalletLedgerEntryUpdateRecord = WalletLedgerEntryUpdate;

export type PromoCodeRecord = PromoCodeRow;
export type PromoCodeCreateRecord = PromoCodeInsert;
export type PromoCodeUpdateRecord = PromoCodeUpdate;

export type PaymentDiscountRecord = PaymentDiscountRow;
export type PaymentDiscountCreateRecord = PaymentDiscountInsert;
export type PaymentDiscountUpdateRecord = PaymentDiscountUpdate;

/* -------------------------------------------------------------------------- */
/* RPC result aliases                                                          */
/* -------------------------------------------------------------------------- */

export type CreatePaymentIntentAtomicResult = CreatePaymentIntentAtomicRpcRow;
export type MarkPaymentPaidAtomicResult = MarkPaymentPaidAtomicRpcRow;
export type MarkPaymentFailedAtomicResult = MarkPaymentFailedAtomicRpcRow;
export type MarkPaymentCancelledAtomicResult = MarkPaymentCancelledAtomicRpcRow;
export type ExpirePaymentIntentsAtomicResult = ExpirePaymentIntentsAtomicRpcRow;
export type DebitWalletForBookingAtomicResult =
  DebitWalletForBookingAtomicRpcRow;
export type DebitWalletForBookingOrderAtomicResult =
  DebitWalletForBookingOrderAtomicRpcRow;
export type CreditWalletAtomicResult = CreditWalletAtomicRpcRow;
export type RefundPaymentAtomicResult = RefundPaymentAtomicRpcRow;

/* -------------------------------------------------------------------------- */
/* Generic list contracts                                                      */
/* -------------------------------------------------------------------------- */

export interface PaymentRepositoryListResult<TRecord> {
  readonly records: readonly TRecord[];
  readonly total: number;
}

export interface PaymentPaginatedResult<TItem> {
  readonly items: readonly TItem[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  readonly has_more: boolean;
}

export type PaymentSortDirection = 'asc' | 'desc';

/* -------------------------------------------------------------------------- */
/* Payment target and amount contracts                                         */
/* -------------------------------------------------------------------------- */

export interface PaymentTargetReference {
  readonly target_type: PaymentTargetType;
  readonly booking_id?: string | null;
  readonly private_booking_id?: string | null;
  readonly booking_order_id?: string | null;
}

export interface PaymentResolvedTargetReference {
  readonly target_type: PaymentTargetType;
  readonly booking_id: string | null;
  readonly private_booking_id: string | null;
  readonly booking_order_id: string | null;
}

export interface PaymentAmountSnapshot {
  readonly amount: number;
  readonly discount_amount: number;
  readonly final_amount: number;
  readonly currency: PaymentCurrency;
}

export interface PaymentPriceResolutionInput {
  readonly user_id: string;
  readonly target_type: PaymentTargetType;
  readonly booking_id?: string | null;
  readonly private_booking_id?: string | null;
  readonly booking_order_id?: string | null;
  readonly wallet_top_up_amount?: number;
  readonly currency?: PaymentCurrency;
  readonly promo_code?: string;
}

export interface PaymentPriceResolutionResult {
  readonly target: PaymentResolvedTargetReference;
  readonly amount: number;
  readonly discount_amount: number;
  readonly final_amount: number;
  readonly currency: PaymentCurrency;
  readonly promo_code_id: string | null;
  readonly promo_code: string | null;
  readonly promo_code_redemption_id: string | null;
  readonly discount_metadata: DatabaseJsonObject;
}

export interface PaymentPromoCodeReservationSnapshot {
  readonly promo_code_id: string;
  readonly promo_code: string;
  readonly promo_code_redemption_id: string;
  readonly subtotal_amount: number;
  readonly discount_amount: number;
  readonly final_amount: number;
  readonly currency: PaymentCurrency;
  readonly expires_at: string | null;
  readonly metadata: DatabaseJsonObject;
}

export interface PaymentPromoCodeCheckoutContext {
  readonly promo_code: string | null;
  readonly reservation: PaymentPromoCodeReservationSnapshot | null;
}
/* -------------------------------------------------------------------------- */
/* Checkout contracts                                                          */
/* -------------------------------------------------------------------------- */

export interface CreateCheckoutPaymentInput {
  readonly user_id: string;
  readonly target_type: PaymentTargetType;
  readonly booking_id?: string | null;
  readonly private_booking_id?: string | null;
  readonly booking_order_id?: string | null;
  readonly wallet_top_up_amount?: number;
  readonly payment_method: PaymentMethod;
  readonly idempotency_key?: string | null;
  readonly promo_code?: string;
  readonly metadata?: DatabaseJsonObject;
}

export interface CreateCheckoutPaymentCommand {
  readonly user_id: string;
  readonly target: PaymentResolvedTargetReference;
  readonly amount: number;
  readonly discount_amount: number;
  readonly final_amount: number;
  readonly currency: PaymentCurrency;
  readonly payment_method: PaymentMethod;
  readonly payment_provider: PaymentProvider;
  readonly idempotency_key: string | null;
  readonly redirect_url: string | null;
  readonly callback_url: string | null;
  readonly gateway_reference: string | null;
  readonly gateway_payment_id: string | null;
  readonly gateway_invoice_id: string | null;
  readonly expires_at: string;
  readonly promo_code_redemption_id: string | null;
  readonly metadata: DatabaseJsonObject;
}

export interface PaymentCheckoutHostedRedirectResult {
  readonly payment: PaymentRecord;
  readonly status: PaymentStatus;
  readonly requires_redirect: true;
  readonly redirect_url: string;
  readonly expires_at: string | null;
}

export interface PaymentCheckoutWalletResult {
  readonly payment: PaymentRecord;
  readonly status: PaymentStatus;
  readonly requires_redirect: false;
  readonly wallet_account_id: string;
  readonly wallet_ledger_entry_id: string;
  readonly available_balance: number;
  readonly booking_order_id: string | null;
}

export type PaymentCheckoutResult =
  | PaymentCheckoutHostedRedirectResult
  | PaymentCheckoutWalletResult;

/* -------------------------------------------------------------------------- */
/* Provider abstraction contracts                                              */
/* -------------------------------------------------------------------------- */

export interface PaymentGatewayCreateHostedPaymentInput {
  readonly payment_id: string;
  readonly payment_number: string;
  readonly user_id: string;
  readonly amount: number;
  readonly currency: PaymentCurrency;
  readonly payment_method: PaymentHostedRedirectMethod;
  readonly provider: PaymentExternalGatewayProvider;
  readonly target_type: PaymentTargetType;
  readonly booking_id: string | null;
  readonly private_booking_id: string | null;
  readonly booking_order_id: string | null;
  readonly callback_url: string;
  readonly webhook_url: string;
  readonly frontend_success_url: string;
  readonly frontend_failure_url: string;
  readonly idempotency_key: string | null;
  readonly metadata: DatabaseJsonObject;
}

export interface PaymentGatewayCreateHostedPaymentResult {
  readonly provider: PaymentExternalGatewayProvider;
  readonly provider_reference: string;
  readonly gateway_payment_id: string | null;
  readonly gateway_invoice_id: string | null;
  readonly redirect_url: string;
  readonly expires_at: string | null;
  readonly raw_response: DatabaseJsonObject;
}

export type PaymentProviderVerificationStatus =
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'pending'
  | 'unknown';

export interface PaymentGatewayVerifyPaymentInput {
  readonly payment: PaymentRecord;
  readonly provider_reference?: string | null;
  readonly gateway_payment_id?: string | null;
  readonly gateway_invoice_id?: string | null;
}

export interface PaymentGatewayVerifyPaymentResult {
  readonly provider: PaymentExternalGatewayProvider;
  readonly provider_reference: string | null;
  readonly gateway_payment_id: string | null;
  readonly gateway_invoice_id: string | null;
  readonly status: PaymentProviderVerificationStatus;
  readonly failure_code: string | null;
  readonly failure_message: string | null;
  readonly raw_response: DatabaseJsonObject;
}

export interface PaymentGatewayRefundInput {
  readonly payment: PaymentRecord;
  readonly reason: string;
  readonly amount: number;
  readonly currency: PaymentCurrency;
  readonly idempotency_key: string;
  readonly metadata: DatabaseJsonObject;
}

export type PaymentGatewayRefundStatus =
  | 'refund_requested'
  | 'refund_processing'
  | 'refunded'
  | 'manual_refund_required'
  | 'refund_failed';

export interface PaymentGatewayRefundResult {
  readonly provider: PaymentExternalGatewayProvider;
  readonly provider_reference: string | null;
  readonly status: PaymentGatewayRefundStatus;
  readonly refunded_amount: number;
  readonly failure_code: string | null;
  readonly failure_message: string | null;
  readonly raw_response: DatabaseJsonObject;
}

/* -------------------------------------------------------------------------- */
/* Callback and webhook contracts                                              */
/* -------------------------------------------------------------------------- */

export interface PaymentCallbackInput {
  readonly provider: PaymentExternalGatewayProvider;
  readonly payment_id?: string | null;
  readonly provider_reference?: string | null;
  readonly gateway_payment_id?: string | null;
  readonly gateway_invoice_id?: string | null;
  readonly result?: PaymentCallbackResult | null;
  readonly raw_query: DatabaseJsonObject;
}

export interface PaymentCallbackResultPayload {
  readonly payment_id: string | null;
  readonly payment_number: string | null;
  readonly status: PaymentStatus | null;
  readonly frontend_redirect_url: string;
}

export interface PaymentWebhookHeaders {
  readonly signature: string | null;
  readonly timestamp: string | null;
  readonly event_id: string | null;
}

export interface PaymentWebhookInput {
  readonly provider: PaymentExternalGatewayProvider;
  readonly headers: PaymentWebhookHeaders;
  readonly raw_body: string;
  readonly payload: DatabaseJsonObject;
}

export interface PaymentWebhookParsedEvent {
  readonly provider: PaymentExternalGatewayProvider;
  readonly event_id: string | null;
  readonly event_type: PaymentWebhookEvent;
  readonly payment_id: string | null;
  readonly provider_reference: string | null;
  readonly gateway_payment_id: string | null;
  readonly gateway_invoice_id: string | null;
  readonly status: PaymentProviderVerificationStatus;
  readonly failure_code: string | null;
  readonly failure_message: string | null;
  readonly occurred_at: string | null;
  readonly raw_payload: DatabaseJsonObject;
}

export interface PaymentWebhookHandlingResult {
  readonly accepted: boolean;
  readonly ignored: boolean;
  readonly payment_id: string | null;
  readonly status: PaymentStatus | null;
}

/* -------------------------------------------------------------------------- */
/* Payment lifecycle contracts                                                 */
/* -------------------------------------------------------------------------- */

export interface PaymentStatusTransitionInput {
  readonly current_status: PaymentStatus;
  readonly next_status: PaymentStatus;
}

export interface PaymentStatusTransitionResult {
  readonly allowed: boolean;
  readonly ignored: boolean;
  readonly reason: string | null;
}

export interface MarkPaymentPaidInput {
  readonly payment_id: string;
  readonly provider_reference?: string | null;
  readonly gateway_response?: DatabaseJsonObject;
  readonly webhook_verified?: boolean;
}

export interface MarkPaymentFailedInput {
  readonly payment_id: string;
  readonly failure_code?: string | null;
  readonly failure_message?: string | null;
  readonly gateway_response?: DatabaseJsonObject;
}

export interface MarkPaymentCancelledInput {
  readonly payment_id: string;
  readonly reason?: string | null;
  readonly gateway_response?: DatabaseJsonObject;
}

export interface RefundPaymentInput {
  readonly payment_id: string;
  readonly actor_admin_id: string;
  readonly reason: string;
  readonly gateway_response?: DatabaseJsonObject;
}

/* -------------------------------------------------------------------------- */
/* Repository query contracts                                                  */
/* -------------------------------------------------------------------------- */

export interface PaymentListQuery {
  readonly user_id?: string;
  readonly target_type?: PaymentTargetType;
  readonly booking_id?: string;
  readonly private_booking_id?: string;
  readonly booking_order_id?: string;
  readonly payment_method?: PaymentMethod;
  readonly payment_provider?: PaymentProvider;
  readonly status?: PaymentStatus;
  readonly from_date?: string;
  readonly to_date?: string;
  readonly limit: number;
  readonly offset: number;
  readonly sort_by: 'created_at' | 'updated_at' | 'final_amount' | 'paid_at';
  readonly sort_direction: PaymentSortDirection;
}

export interface CustomerPaymentListQuery {
  readonly user_id: string;
  readonly target_type?: PaymentTargetType;
  readonly booking_order_id?: string;
  readonly status?: PaymentStatus;
  readonly from_date?: string;
  readonly to_date?: string;
  readonly limit: number;
  readonly offset: number;
  readonly sort_by: 'created_at' | 'updated_at' | 'final_amount' | 'paid_at';
  readonly sort_direction: PaymentSortDirection;
}

export interface PaymentTransactionListQuery {
  readonly payment_id: string;
  readonly transaction_type?: PaymentTransactionType;
  readonly transaction_status?: PaymentTransactionStatus;
  readonly limit: number;
  readonly offset: number;
  readonly sort_by: 'created_at' | 'processed_at';
  readonly sort_direction: PaymentSortDirection;
}

export interface WalletLedgerListQuery {
  readonly user_id: string;
  readonly wallet_account_id?: string;
  readonly entry_type?: WalletLedgerEntryType;
  readonly entry_status?: WalletLedgerEntryStatus;
  readonly from_date?: string;
  readonly to_date?: string;
  readonly limit: number;
  readonly offset: number;
  readonly sort_by: 'created_at' | 'amount';
  readonly sort_direction: PaymentSortDirection;
}

export interface AdminWalletListQuery {
  readonly user_id?: string;
  readonly status?: WalletAccountStatus;
  readonly from_date?: string;
  readonly to_date?: string;
  readonly limit: number;
  readonly offset: number;
  readonly sort_by: 'created_at' | 'updated_at' | 'available_balance';
  readonly sort_direction: PaymentSortDirection;
}

/* -------------------------------------------------------------------------- */
/* Response summary contracts                                                  */
/* -------------------------------------------------------------------------- */

export interface PaymentSummary {
  readonly id: string;
  readonly payment_number: string;
  readonly receipt_number: string | null;
  readonly user_id: string;
  readonly target_type: PaymentTargetType;
  readonly booking_id: string | null;
  readonly private_booking_id: string | null;
  readonly booking_order_id: string | null;
  readonly amount: number;
  readonly discount_amount: number;
  readonly final_amount: number;
  readonly currency: PaymentCurrency;
  readonly payment_method: PaymentMethod;
  readonly payment_provider: PaymentProvider;
  readonly status: PaymentStatus;
  readonly redirect_url: string | null;
  readonly paid_at: string | null;
  readonly failed_at: string | null;
  readonly cancelled_at: string | null;
  readonly expired_at: string | null;
  readonly refunded_at: string | null;
  readonly refunded_amount: number;
  readonly expires_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly realtime_version: number;
}

export interface PaymentDetail extends PaymentSummary {
  readonly gateway_reference: string | null;
  readonly gateway_payment_id: string | null;
  readonly gateway_invoice_id: string | null;
  readonly webhook_verified_at: string | null;
  readonly failure_code: string | null;
  readonly failure_message: string | null;
  readonly metadata: DatabaseJsonObject;
  readonly transactions?: readonly PaymentTransactionSummary[];
  readonly discounts?: readonly PaymentDiscountSummary[];
}

export interface PaymentTransactionSummary {
  readonly id: string;
  readonly payment_id: string;
  readonly transaction_type: PaymentTransactionType;
  readonly transaction_status: PaymentTransactionStatus;
  readonly provider: PaymentProvider;
  readonly provider_reference: string | null;
  readonly failure_code: string | null;
  readonly failure_message: string | null;
  readonly metadata: DatabaseJsonObject;
  readonly processed_at: string | null;
  readonly created_at: string;
}

export interface PaymentDiscountSummary {
  readonly id: string;
  readonly payment_id: string;
  readonly promo_code_id: string | null;
  readonly promo_code_redemption_id: string | null;
  readonly code: string;
  readonly discount_amount: number;
  readonly metadata: DatabaseJsonObject;
  readonly created_at: string;
}

export interface PaymentReceiptSummary {
  readonly payment_id: string;
  readonly payment_number: string;
  readonly receipt_number: string;
  readonly user_id: string;
  readonly target_type: PaymentTargetType;
  readonly booking_id: string | null;
  readonly private_booking_id: string | null;
  readonly booking_order_id: string | null;
  readonly amount: number;
  readonly discount_amount: number;
  readonly final_amount: number;
  readonly currency: PaymentCurrency;
  readonly payment_method: PaymentMethod;
  readonly payment_provider: PaymentProvider;
  readonly paid_at: string;
}

/* -------------------------------------------------------------------------- */
/* Wallet response contracts                                                   */
/* -------------------------------------------------------------------------- */

export interface WalletAccountSummary {
  readonly id: string;
  readonly user_id: string;
  readonly currency: PaymentCurrency;
  readonly available_balance: number;
  readonly pending_balance: number;
  readonly status: WalletAccountStatus;
  readonly created_at: string;
  readonly updated_at: string;
  readonly realtime_version: number;
}

export interface WalletLedgerEntrySummary {
  readonly id: string;
  readonly wallet_account_id: string;
  readonly user_id: string;
  readonly payment_id: string | null;
  readonly booking_id: string | null;
  readonly private_booking_id: string | null;
  readonly booking_order_id: string | null;
  readonly entry_type: WalletLedgerEntryType;
  readonly entry_status: WalletLedgerEntryStatus;
  readonly amount: number;
  readonly balance_before: number;
  readonly balance_after: number;
  readonly description: string | null;
  readonly metadata: DatabaseJsonObject;
  readonly created_at: string;
}

export interface WalletTopUpInput {
  readonly user_id: string;
  readonly amount: number;
  readonly currency: PaymentCurrency;
  readonly payment_method: PaymentHostedRedirectMethod;
  readonly idempotency_key?: string | null;
  readonly metadata?: DatabaseJsonObject;
}

export interface WalletCreditInput {
  readonly user_id: string;
  readonly amount: number;
  readonly currency: PaymentCurrency;
  readonly payment_id?: string | null;
  readonly entry_type: WalletCreditEntryType;
  readonly description?: string | null;
  readonly metadata?: DatabaseJsonObject;
}

export interface WalletDebitInput {
  readonly user_id: string;
  readonly payment_id: string;
  readonly amount: number;
  readonly currency: PaymentCurrency;
  readonly entry_type: WalletDebitEntryType;
  readonly booking_id?: string | null;
  readonly private_booking_id?: string | null;
  readonly booking_order_id?: string | null;
  readonly description?: string | null;
  readonly metadata?: DatabaseJsonObject;
}

export interface AdminWalletAdjustmentInput {
  readonly admin_user_id: string;
  readonly target_user_id: string;
  readonly amount: number;
  readonly currency: PaymentCurrency;
  readonly entry_type: 'admin_adjustment_credit' | 'admin_adjustment_debit';
  readonly reason: string;
  readonly metadata?: DatabaseJsonObject;
}

/* -------------------------------------------------------------------------- */
/* Promo-code payment integration contracts                                    */
/* -------------------------------------------------------------------------- */

export interface PaymentPromoCodeSettlementInput {
  readonly payment_id: string;
  readonly promo_code_redemption_id?: string | null;
  readonly metadata?: DatabaseJsonObject;
}

export interface PaymentPromoCodeReleaseInput {
  readonly payment_id: string;
  readonly promo_code_redemption_id?: string | null;
  readonly release_reason: string;
  readonly metadata?: DatabaseJsonObject;
}

/* -------------------------------------------------------------------------- */
/* Security and rate-limit contracts                                           */
/* -------------------------------------------------------------------------- */

export interface PaymentOwnershipCheckInput {
  readonly payment: PaymentRecord;
  readonly user_id: string;
}

export interface PaymentTargetOwnershipCheckInput {
  readonly user_id: string;
  readonly target: PaymentResolvedTargetReference;
}

export interface PaymentAdminActionAuditContext {
  readonly admin_user_id: string;
  readonly reason: string;
  readonly metadata?: DatabaseJsonObject;
}

export interface PaymentRateLimitContext {
  readonly bucket: PaymentRateLimitBucket;
  readonly ip_address: string | null;
  readonly user_id?: string | null;
  readonly payment_id?: string | null;
  readonly provider_reference?: string | null;
  readonly target_user_id?: string | null;
}

export interface PaymentSafeLogContext {
  readonly request_id?: string;
  readonly payment_id?: string;
  readonly payment_number?: string;
  readonly booking_id?: string;
  readonly private_booking_id?: string;
  readonly booking_order_id?: string;
  readonly user_id?: string;
  readonly admin_user_id?: string;
  readonly provider?: PaymentProvider;
  readonly gateway_reference?: string;
  readonly status?: PaymentStatus;
  readonly failure_code?: string;
}

export interface PaymentSanitizationResult {
  readonly sanitized: DatabaseJsonObject;
  readonly removed_keys: readonly string[];
}

/* -------------------------------------------------------------------------- */
/* Controller response wrappers                                                */
/* -------------------------------------------------------------------------- */

export interface PaymentCheckoutResponse {
  readonly payment: PaymentSummary;
  readonly requires_redirect: boolean;
  readonly redirect_url: string | null;
  readonly wallet_account?: WalletAccountSummary;
}

export interface PaymentDetailResponse {
  readonly payment: PaymentDetail;
}

export interface PaymentListResponse {
  readonly payments: PaymentPaginatedResult<PaymentSummary>;
}

export interface PaymentVerificationResponse {
  readonly payment: PaymentSummary;
  readonly receipt: PaymentReceiptSummary | null;
}

export interface PaymentRefundResponse {
  readonly payment: PaymentSummary;
}

export interface WalletAccountResponse {
  readonly wallet: WalletAccountSummary;
}

export interface WalletLedgerListResponse {
  readonly transactions: PaymentPaginatedResult<WalletLedgerEntrySummary>;
}

export interface WalletTopUpResponse {
  readonly payment: PaymentSummary;
  readonly redirect_url: string;
}

export interface AdminWalletAdjustmentResponse {
  readonly wallet: WalletAccountSummary;
  readonly ledger_entry: WalletLedgerEntrySummary;
}
