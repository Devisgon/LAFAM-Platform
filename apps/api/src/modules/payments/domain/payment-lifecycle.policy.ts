// apps/api/src/modules/payments/domain/payment-lifecycle.policy.ts
/**
 * LAFAM Payment lifecycle policy.
 *
 * Role:
 * - Defines valid Payment status transitions.
 * - Protects paid/refunded/terminal states from unsafe mutation.
 * - Provides idempotent duplicate-callback/webhook handling decisions.
 * - Enforces refund eligibility rules before admin/provider refund logic runs.
 * - Keeps arbitrary payment status changes out of services/controllers.
 *
 * Important:
 * - This policy does not call the database.
 * - This policy does not call payment providers.
 * - This policy does not debit or credit wallets.
 * - This policy does not confirm bookings directly.
 * - Atomic database RPCs must still enforce final mutation safety.
 * - Services must use this policy before calling payment mutation RPCs.
 */

import { AppError } from '../../../common/errors/app-error';
import {
  PAYMENT_FAILURE_STATUSES,
  PAYMENT_PRE_SETTLEMENT_STATUSES,
  PAYMENT_REFUND_STATUSES,
  PAYMENT_STATUS_CANCELLED,
  PAYMENT_STATUS_EXPIRED,
  PAYMENT_STATUS_FAILED,
  PAYMENT_STATUS_MANUAL_REFUND_REQUIRED,
  PAYMENT_STATUS_PAID,
  PAYMENT_STATUS_PENDING,
  PAYMENT_STATUS_PROCESSING,
  PAYMENT_STATUS_REFUND_PROCESSING,
  PAYMENT_STATUS_REFUND_REQUESTED,
  PAYMENT_STATUS_REFUNDED,
  PAYMENT_STATUS_REQUIRES_REDIRECT,
  PAYMENT_TERMINAL_STATUSES,
  type PaymentFailureStatus,
  type PaymentPreSettlementStatus,
  type PaymentRefundStatus,
  type PaymentStatus,
} from '../constants/payment.constants';
import type {
  PaymentRecord,
  PaymentStatusTransitionInput,
  PaymentStatusTransitionResult,
} from '../types/payment.types';

interface PaymentRefundEligibilityInput {
  readonly payment: PaymentRecord;
  readonly requested_refund_amount?: number | null;
}

interface PaymentProviderVerificationDecisionInput {
  readonly payment: PaymentRecord;
  readonly provider_status:
    | 'paid'
    | 'failed'
    | 'cancelled'
    | 'pending'
    | 'unknown';
  readonly failure_code?: string | null;
  readonly failure_message?: string | null;
}

interface PaymentProviderVerificationDecision {
  readonly should_mutate: boolean;
  readonly next_status: PaymentStatus | null;
  readonly ignored: boolean;
  readonly reason: string | null;
}

interface PaymentExpiryEligibilityInput {
  readonly payment: PaymentRecord;
  readonly now?: Date;
}

const ALLOWED_TRANSITIONS: ReadonlyMap<
  PaymentStatus,
  ReadonlySet<PaymentStatus>
> = new Map([
  [
    PAYMENT_STATUS_PENDING,
    new Set<PaymentStatus>([
      PAYMENT_STATUS_REQUIRES_REDIRECT,
      PAYMENT_STATUS_PROCESSING,
      PAYMENT_STATUS_PAID,
      PAYMENT_STATUS_FAILED,
      PAYMENT_STATUS_CANCELLED,
      PAYMENT_STATUS_EXPIRED,
    ]),
  ],
  [
    PAYMENT_STATUS_REQUIRES_REDIRECT,
    new Set<PaymentStatus>([
      PAYMENT_STATUS_PROCESSING,
      PAYMENT_STATUS_PAID,
      PAYMENT_STATUS_FAILED,
      PAYMENT_STATUS_CANCELLED,
      PAYMENT_STATUS_EXPIRED,
    ]),
  ],
  [
    PAYMENT_STATUS_PROCESSING,
    new Set<PaymentStatus>([
      PAYMENT_STATUS_PAID,
      PAYMENT_STATUS_FAILED,
      PAYMENT_STATUS_CANCELLED,
      PAYMENT_STATUS_EXPIRED,
    ]),
  ],
  [
    PAYMENT_STATUS_PAID,
    new Set<PaymentStatus>([
      PAYMENT_STATUS_REFUND_REQUESTED,
      PAYMENT_STATUS_REFUND_PROCESSING,
      PAYMENT_STATUS_MANUAL_REFUND_REQUIRED,
      PAYMENT_STATUS_REFUNDED,
    ]),
  ],
  [PAYMENT_STATUS_FAILED, new Set<PaymentStatus>()],
  [PAYMENT_STATUS_CANCELLED, new Set<PaymentStatus>()],
  [PAYMENT_STATUS_EXPIRED, new Set<PaymentStatus>()],
  [
    PAYMENT_STATUS_REFUND_REQUESTED,
    new Set<PaymentStatus>([
      PAYMENT_STATUS_REFUND_PROCESSING,
      PAYMENT_STATUS_MANUAL_REFUND_REQUIRED,
      PAYMENT_STATUS_REFUNDED,
    ]),
  ],
  [
    PAYMENT_STATUS_REFUND_PROCESSING,
    new Set<PaymentStatus>([
      PAYMENT_STATUS_MANUAL_REFUND_REQUIRED,
      PAYMENT_STATUS_REFUNDED,
    ]),
  ],
  [
    PAYMENT_STATUS_MANUAL_REFUND_REQUIRED,
    new Set<PaymentStatus>([PAYMENT_STATUS_REFUNDED]),
  ],
  [PAYMENT_STATUS_REFUNDED, new Set<PaymentStatus>()],
]);

const PAYMENT_PRE_SETTLEMENT_STATUS_SET = new Set<PaymentPreSettlementStatus>(
  PAYMENT_PRE_SETTLEMENT_STATUSES,
);

const PAYMENT_FAILURE_STATUS_SET = new Set<PaymentFailureStatus>(
  PAYMENT_FAILURE_STATUSES,
);

const PAYMENT_REFUND_STATUS_SET = new Set<PaymentRefundStatus>(
  PAYMENT_REFUND_STATUSES,
);

const PAYMENT_TERMINAL_STATUS_SET = new Set<PaymentStatus>(
  PAYMENT_TERMINAL_STATUSES,
);

function isPreSettlementStatus(
  status: PaymentStatus,
): status is PaymentPreSettlementStatus {
  return PAYMENT_PRE_SETTLEMENT_STATUS_SET.has(
    status as PaymentPreSettlementStatus,
  );
}

function isFailureStatus(
  status: PaymentStatus,
): status is PaymentFailureStatus {
  return PAYMENT_FAILURE_STATUS_SET.has(status as PaymentFailureStatus);
}

function isRefundStatus(status: PaymentStatus): status is PaymentRefundStatus {
  return PAYMENT_REFUND_STATUS_SET.has(status as PaymentRefundStatus);
}

function isTerminalStatus(status: PaymentStatus): boolean {
  return PAYMENT_TERMINAL_STATUS_SET.has(status);
}

function paymentStatusDetails(payment: PaymentRecord): Record<string, unknown> {
  return {
    payment_id: payment.id,
    payment_number: payment.payment_number,
    current_status: payment.status,
  };
}

function resolvePaidAt(payment: PaymentRecord): string | null {
  return typeof payment.paid_at === 'string' ? payment.paid_at : null;
}

function resolveRefundedAmount(payment: PaymentRecord): number {
  return typeof payment.refunded_amount === 'number'
    ? payment.refunded_amount
    : 0;
}

function resolveFinalAmount(payment: PaymentRecord): number {
  return typeof payment.final_amount === 'number' ? payment.final_amount : 0;
}

export class PaymentLifecyclePolicy {
  static canTransition(
    input: PaymentStatusTransitionInput,
  ): PaymentStatusTransitionResult {
    if (input.current_status === input.next_status) {
      return {
        allowed: true,
        ignored: true,
        reason: 'duplicate_status_transition',
      };
    }

    const allowedNextStatuses = ALLOWED_TRANSITIONS.get(input.current_status);

    if (!allowedNextStatuses) {
      return {
        allowed: false,
        ignored: false,
        reason: 'unknown_current_status',
      };
    }

    if (allowedNextStatuses.has(input.next_status)) {
      return {
        allowed: true,
        ignored: false,
        reason: null,
      };
    }

    if (
      input.current_status === PAYMENT_STATUS_PAID &&
      isFailureStatus(input.next_status)
    ) {
      return {
        allowed: false,
        ignored: true,
        reason: 'failure_after_paid_ignored',
      };
    }

    if (
      isRefundStatus(input.current_status) &&
      (isPreSettlementStatus(input.next_status) ||
        isFailureStatus(input.next_status) ||
        input.next_status === PAYMENT_STATUS_PAID)
    ) {
      return {
        allowed: false,
        ignored: true,
        reason: 'settlement_event_after_refund_ignored',
      };
    }

    if (isTerminalStatus(input.current_status)) {
      return {
        allowed: false,
        ignored: true,
        reason: 'terminal_status_transition_ignored',
      };
    }

    return {
      allowed: false,
      ignored: false,
      reason: 'transition_not_allowed',
    };
  }

  static assertTransitionAllowed(
    input: PaymentStatusTransitionInput,
  ): PaymentStatusTransitionResult {
    const result = this.canTransition(input);

    if (result.allowed) {
      return result;
    }

    if (result.ignored) {
      return result;
    }

    throw AppError.paymentNotPayable(
      'Payment status transition is not allowed.',
      {
        current_status: input.current_status,
        next_status: input.next_status,
        reason: result.reason,
      },
    );
  }

  static assertCanCreateHostedRedirect(payment: PaymentRecord): void {
    if (
      payment.status === PAYMENT_STATUS_PENDING ||
      payment.status === PAYMENT_STATUS_REQUIRES_REDIRECT
    ) {
      return;
    }

    if (payment.status === PAYMENT_STATUS_PAID) {
      throw AppError.paymentAlreadyPaid(
        'Payment has already been completed.',
        paymentStatusDetails(payment),
      );
    }

    throw AppError.paymentNotPayable(
      'Payment cannot start hosted redirect in its current status.',
      paymentStatusDetails(payment),
    );
  }

  static assertCanVerifyPayment(payment: PaymentRecord): void {
    if (
      payment.status === PAYMENT_STATUS_PENDING ||
      payment.status === PAYMENT_STATUS_REQUIRES_REDIRECT ||
      payment.status === PAYMENT_STATUS_PROCESSING
    ) {
      return;
    }

    if (payment.status === PAYMENT_STATUS_PAID) {
      return;
    }

    if (payment.status === PAYMENT_STATUS_EXPIRED) {
      throw AppError.paymentExpired(
        'Payment has expired and cannot be verified.',
        paymentStatusDetails(payment),
      );
    }

    throw AppError.paymentProviderVerificationFailed({
      message: 'Payment cannot be verified in its current status.',
      ...paymentStatusDetails(payment),
    });
  }

  static assertCanMarkPaid(payment: PaymentRecord): void {
    if (payment.status === PAYMENT_STATUS_PAID) {
      return;
    }

    const result = this.assertTransitionAllowed({
      current_status: payment.status,
      next_status: PAYMENT_STATUS_PAID,
    });

    if (result.ignored) {
      throw AppError.paymentNotPayable(
        'Payment cannot be marked paid in its current status.',
        {
          ...paymentStatusDetails(payment),
          reason: result.reason,
        },
      );
    }
  }

  static assertCanMarkFailed(payment: PaymentRecord): void {
    const result = this.assertTransitionAllowed({
      current_status: payment.status,
      next_status: PAYMENT_STATUS_FAILED,
    });

    if (result.ignored) {
      return;
    }
  }

  static assertCanMarkCancelled(payment: PaymentRecord): void {
    const result = this.assertTransitionAllowed({
      current_status: payment.status,
      next_status: PAYMENT_STATUS_CANCELLED,
    });

    if (result.ignored) {
      return;
    }
  }

  static assertCanMarkExpired(payment: PaymentRecord): void {
    const result = this.assertTransitionAllowed({
      current_status: payment.status,
      next_status: PAYMENT_STATUS_EXPIRED,
    });

    if (result.ignored) {
      return;
    }
  }

  static assertCanRequestRefund(input: PaymentRefundEligibilityInput): void {
    const payment = input.payment;

    if (payment.status !== PAYMENT_STATUS_PAID) {
      throw AppError.refundNotAllowed(
        'Only paid payments can be refunded.',
        paymentStatusDetails(payment),
      );
    }

    const paidAt = resolvePaidAt(payment);

    if (paidAt === null) {
      throw AppError.refundNotAllowed(
        'Payment cannot be refunded because paid_at is missing.',
        paymentStatusDetails(payment),
      );
    }

    const finalAmount = resolveFinalAmount(payment);
    const refundedAmount = resolveRefundedAmount(payment);
    const refundableAmount = finalAmount - refundedAmount;

    if (finalAmount <= 0) {
      throw AppError.refundNotAllowed(
        'Payment cannot be refunded because final_amount is invalid.',
        {
          ...paymentStatusDetails(payment),
          final_amount: finalAmount,
        },
      );
    }

    if (refundableAmount <= 0) {
      throw AppError.refundNotAllowed(
        'Payment has no refundable amount remaining.',
        {
          ...paymentStatusDetails(payment),
          final_amount: finalAmount,
          refunded_amount: refundedAmount,
          refundable_amount: refundableAmount,
        },
      );
    }

    if (
      typeof input.requested_refund_amount === 'number' &&
      input.requested_refund_amount > refundableAmount
    ) {
      throw AppError.refundNotAllowed(
        'Requested refund amount exceeds refundable amount.',
        {
          ...paymentStatusDetails(payment),
          requested_refund_amount: input.requested_refund_amount,
          refundable_amount: refundableAmount,
        },
      );
    }
  }

  static assertCanMoveToRefundProcessing(payment: PaymentRecord): void {
    const result = this.assertTransitionAllowed({
      current_status: payment.status,
      next_status: PAYMENT_STATUS_REFUND_PROCESSING,
    });

    if (result.ignored) {
      throw AppError.refundNotAllowed(
        'Payment cannot move to refund processing in its current status.',
        {
          ...paymentStatusDetails(payment),
          reason: result.reason,
        },
      );
    }
  }

  static assertCanMarkManualRefundRequired(payment: PaymentRecord): void {
    const result = this.assertTransitionAllowed({
      current_status: payment.status,
      next_status: PAYMENT_STATUS_MANUAL_REFUND_REQUIRED,
    });

    if (result.ignored) {
      throw AppError.refundNotAllowed(
        'Payment cannot require manual refund in its current status.',
        {
          ...paymentStatusDetails(payment),
          reason: result.reason,
        },
      );
    }
  }

  static assertCanMarkRefunded(payment: PaymentRecord): void {
    const result = this.assertTransitionAllowed({
      current_status: payment.status,
      next_status: PAYMENT_STATUS_REFUNDED,
    });

    if (result.ignored) {
      throw AppError.refundNotAllowed(
        'Payment cannot be marked refunded in its current status.',
        {
          ...paymentStatusDetails(payment),
          reason: result.reason,
        },
      );
    }
  }

  static resolveProviderVerificationDecision(
    input: PaymentProviderVerificationDecisionInput,
  ): PaymentProviderVerificationDecision {
    const payment = input.payment;

    if (input.provider_status === 'unknown') {
      return {
        should_mutate: false,
        next_status: null,
        ignored: false,
        reason: 'provider_status_unknown',
      };
    }

    if (input.provider_status === 'pending') {
      if (
        payment.status === PAYMENT_STATUS_PENDING ||
        payment.status === PAYMENT_STATUS_REQUIRES_REDIRECT
      ) {
        return {
          should_mutate: true,
          next_status: PAYMENT_STATUS_PROCESSING,
          ignored: false,
          reason: null,
        };
      }

      return {
        should_mutate: false,
        next_status: null,
        ignored: true,
        reason: 'pending_event_not_applicable',
      };
    }

    const nextStatus = this.mapProviderStatusToPaymentStatus(
      input.provider_status,
    );
    const transition = this.canTransition({
      current_status: payment.status,
      next_status: nextStatus,
    });

    if (transition.allowed && transition.ignored) {
      return {
        should_mutate: false,
        next_status: nextStatus,
        ignored: true,
        reason: transition.reason,
      };
    }

    if (transition.allowed) {
      return {
        should_mutate: true,
        next_status: nextStatus,
        ignored: false,
        reason: null,
      };
    }

    if (transition.ignored) {
      return {
        should_mutate: false,
        next_status: nextStatus,
        ignored: true,
        reason: transition.reason,
      };
    }

    throw AppError.paymentProviderVerificationFailed({
      message: 'Verified provider status cannot be applied to this payment.',
      ...paymentStatusDetails(payment),
      provider_status: input.provider_status,
      next_status: nextStatus,
      failure_code: input.failure_code ?? null,
      failure_message: input.failure_message ?? null,
      reason: transition.reason,
    });
  }

  static assertPaymentNotExpired(input: PaymentExpiryEligibilityInput): void {
    const expiresAt = input.payment.expires_at;

    if (typeof expiresAt !== 'string') {
      return;
    }

    const expiresAtMs = Date.parse(expiresAt);

    if (!Number.isFinite(expiresAtMs)) {
      return;
    }

    const nowMs = (input.now ?? new Date()).getTime();

    if (nowMs <= expiresAtMs) {
      return;
    }

    throw AppError.paymentExpired('Payment has expired.', {
      ...paymentStatusDetails(input.payment),
      expires_at: expiresAt,
    });
  }

  static isPaid(payment: PaymentRecord): boolean {
    return payment.status === PAYMENT_STATUS_PAID;
  }

  static isPreSettlement(payment: PaymentRecord): boolean {
    return isPreSettlementStatus(payment.status);
  }

  static isFailure(payment: PaymentRecord): boolean {
    return isFailureStatus(payment.status);
  }

  static isRefundLifecycle(payment: PaymentRecord): boolean {
    return isRefundStatus(payment.status);
  }

  static isTerminal(payment: PaymentRecord): boolean {
    return isTerminalStatus(payment.status);
  }

  static shouldIgnoreDuplicatePaidEvent(payment: PaymentRecord): boolean {
    return payment.status === PAYMENT_STATUS_PAID;
  }

  static shouldIgnoreFailureAfterPaid(payment: PaymentRecord): boolean {
    return payment.status === PAYMENT_STATUS_PAID;
  }

  static resolveRefundableAmount(payment: PaymentRecord): number {
    return resolveFinalAmount(payment) - resolveRefundedAmount(payment);
  }

  private static mapProviderStatusToPaymentStatus(
    providerStatus: 'paid' | 'failed' | 'cancelled',
  ): PaymentStatus {
    if (providerStatus === 'paid') {
      return PAYMENT_STATUS_PAID;
    }

    if (providerStatus === 'failed') {
      return PAYMENT_STATUS_FAILED;
    }

    return PAYMENT_STATUS_CANCELLED;
  }
}
