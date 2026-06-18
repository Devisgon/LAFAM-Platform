// apps/api/src/modules/payments/application/payment-gateway.service.ts
/**
 * LAFAM Payment gateway service.
 *
 * Role:
 * - Routes hosted payment operations to the configured provider adapter.
 * - Keeps checkout/callback/refund services independent from provider-specific APIs.
 * - Validates normalized provider results before business services use them.
 * - Exposes injection tokens for concrete payment provider adapters.
 *
 * Important:
 * - This service does not call KNET/Tap/MyFatoorah directly.
 * - This service does not mutate payment records.
 * - This service does not decide payment lifecycle transitions.
 * - This service does not trust raw provider payloads as business truth.
 * - Concrete provider adapters must return normalized PaymentGateway* results only.
 * - Provider-specific raw payloads belong in payment_transactions after sanitization.
 */

import { Inject, Injectable, Optional } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import {
  PAYMENT_EXTERNAL_GATEWAY_PROVIDERS,
  PAYMENT_HOSTED_REDIRECT_METHODS,
  PAYMENT_PROVIDER_CHECKOUT,
  PAYMENT_PROVIDER_KNET,
  PAYMENT_PROVIDER_MOCK,
  PAYMENT_PROVIDER_MYFATOORAH,
  PAYMENT_PROVIDER_TAP,
  type PaymentExternalGatewayProvider,
  type PaymentHostedRedirectMethod,
  type PaymentProvider,
} from '../constants/payment.constants';
import type {
  PaymentGatewayCreateHostedPaymentInput,
  PaymentGatewayCreateHostedPaymentResult,
  PaymentGatewayRefundInput,
  PaymentGatewayRefundResult,
  PaymentGatewayVerifyPaymentInput,
  PaymentGatewayVerifyPaymentResult,
  PaymentWebhookInput,
  PaymentWebhookParsedEvent,
} from '../types/payment.types';

export const PAYMENT_MOCK_GATEWAY_PROVIDER = Symbol(
  'lafam:payments:mock-gateway-provider',
);

export const PAYMENT_KNET_GATEWAY_PROVIDER = Symbol(
  'lafam:payments:knet-gateway-provider',
);

export const PAYMENT_TAP_GATEWAY_PROVIDER = Symbol(
  'lafam:payments:tap-gateway-provider',
);

export const PAYMENT_MYFATOORAH_GATEWAY_PROVIDER = Symbol(
  'lafam:payments:myfatoorah-gateway-provider',
);

export const PAYMENT_CHECKOUT_GATEWAY_PROVIDER = Symbol(
  'lafam:payments:checkout-gateway-provider',
);

export interface PaymentGatewayProviderAdapter {
  readonly provider: PaymentExternalGatewayProvider;

  createHostedPayment(
    input: PaymentGatewayCreateHostedPaymentInput,
  ): Promise<PaymentGatewayCreateHostedPaymentResult>;

  verifyPayment(
    input: PaymentGatewayVerifyPaymentInput,
  ): Promise<PaymentGatewayVerifyPaymentResult>;

  refundPayment(
    input: PaymentGatewayRefundInput,
  ): Promise<PaymentGatewayRefundResult>;

  verifyWebhookSignature(input: PaymentWebhookInput): Promise<boolean>;

  parseWebhook(input: PaymentWebhookInput): Promise<PaymentWebhookParsedEvent>;
}

const EXTERNAL_GATEWAY_PROVIDER_SET = new Set<PaymentExternalGatewayProvider>(
  PAYMENT_EXTERNAL_GATEWAY_PROVIDERS,
);

const HOSTED_REDIRECT_METHOD_SET = new Set<PaymentHostedRedirectMethod>(
  PAYMENT_HOSTED_REDIRECT_METHODS,
);

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isExternalGatewayProvider(
  provider: PaymentProvider,
): provider is PaymentExternalGatewayProvider {
  return EXTERNAL_GATEWAY_PROVIDER_SET.has(
    provider as PaymentExternalGatewayProvider,
  );
}

function isHostedRedirectMethod(
  paymentMethod: string,
): paymentMethod is PaymentHostedRedirectMethod {
  return HOSTED_REDIRECT_METHOD_SET.has(
    paymentMethod as PaymentHostedRedirectMethod,
  );
}

function assertExternalGatewayProvider(
  provider: PaymentProvider,
): PaymentExternalGatewayProvider {
  if (isExternalGatewayProvider(provider)) {
    return provider;
  }

  throw AppError.invalidRequest(
    'Payment provider is not an external hosted gateway provider.',
    {
      provider,
      allowed_external_gateway_providers: [
        ...PAYMENT_EXTERNAL_GATEWAY_PROVIDERS,
      ],
    },
  );
}

function assertHostedRedirectMethod(
  paymentMethod: string,
): PaymentHostedRedirectMethod {
  if (isHostedRedirectMethod(paymentMethod)) {
    return paymentMethod;
  }

  throw AppError.invalidRequest(
    'Payment method does not support hosted gateway redirect.',
    {
      payment_method: paymentMethod,
      allowed_hosted_redirect_methods: [...PAYMENT_HOSTED_REDIRECT_METHODS],
    },
  );
}

function assertProviderMatches(
  expectedProvider: PaymentExternalGatewayProvider,
  actualProvider: PaymentExternalGatewayProvider,
): void {
  if (expectedProvider === actualProvider) {
    return;
  }

  throw AppError.invalidRequest(
    'Payment gateway provider result used a different provider than requested.',
    {
      expected_provider: expectedProvider,
      actual_provider: actualProvider,
    },
  );
}

function assertHostedPaymentResult(
  input: PaymentGatewayCreateHostedPaymentInput,
  result: PaymentGatewayCreateHostedPaymentResult,
): void {
  assertProviderMatches(input.provider, result.provider);

  if (!hasText(result.provider_reference)) {
    throw AppError.invalidRequest(
      'Payment gateway did not return a provider reference.',
      {
        provider: input.provider,
        payment_id: input.payment_id,
        payment_number: input.payment_number,
      },
    );
  }

  if (!hasText(result.redirect_url)) {
    throw AppError.invalidRequest(
      'Payment gateway did not return a hosted redirect URL.',
      {
        provider: input.provider,
        payment_id: input.payment_id,
        payment_number: input.payment_number,
      },
    );
  }
}

function assertVerificationResult(
  provider: PaymentExternalGatewayProvider,
  result: PaymentGatewayVerifyPaymentResult,
): void {
  assertProviderMatches(provider, result.provider);

  if (
    !hasText(result.provider_reference) &&
    !hasText(result.gateway_payment_id) &&
    !hasText(result.gateway_invoice_id)
  ) {
    throw AppError.paymentProviderVerificationFailed({
      message:
        'Payment gateway verification did not return any usable provider reference.',
      provider,
      status: result.status,
    });
  }
}

function assertRefundResult(
  provider: PaymentExternalGatewayProvider,
  result: PaymentGatewayRefundResult,
): void {
  assertProviderMatches(provider, result.provider);

  if (!Number.isFinite(result.refunded_amount) || result.refunded_amount < 0) {
    throw AppError.invalidRequest(
      'Payment gateway refund result returned an invalid refunded amount.',
      {
        provider,
        refunded_amount: result.refunded_amount,
        status: result.status,
      },
    );
  }
}

function assertWebhookParsedEvent(
  provider: PaymentExternalGatewayProvider,
  event: PaymentWebhookParsedEvent,
): void {
  assertProviderMatches(provider, event.provider);

  if (
    !hasText(event.payment_id) &&
    !hasText(event.provider_reference) &&
    !hasText(event.gateway_payment_id) &&
    !hasText(event.gateway_invoice_id)
  ) {
    throw AppError.paymentWebhookInvalid(
      'Payment webhook did not contain a usable payment reference.',
      {
        provider,
        event_id: event.event_id,
        event_type: event.event_type,
      },
    );
  }
}

@Injectable()
export class PaymentGatewayService {
  constructor(
    @Optional()
    @Inject(PAYMENT_MOCK_GATEWAY_PROVIDER)
    private readonly mockProvider?: PaymentGatewayProviderAdapter,

    @Optional()
    @Inject(PAYMENT_KNET_GATEWAY_PROVIDER)
    private readonly knetProvider?: PaymentGatewayProviderAdapter,

    @Optional()
    @Inject(PAYMENT_TAP_GATEWAY_PROVIDER)
    private readonly tapProvider?: PaymentGatewayProviderAdapter,

    @Optional()
    @Inject(PAYMENT_MYFATOORAH_GATEWAY_PROVIDER)
    private readonly myFatoorahProvider?: PaymentGatewayProviderAdapter,

    @Optional()
    @Inject(PAYMENT_CHECKOUT_GATEWAY_PROVIDER)
    private readonly checkoutProvider?: PaymentGatewayProviderAdapter,
  ) {}

  async createHostedPayment(
    input: PaymentGatewayCreateHostedPaymentInput,
  ): Promise<PaymentGatewayCreateHostedPaymentResult> {
    assertHostedRedirectMethod(input.payment_method);

    const provider = assertExternalGatewayProvider(input.provider);
    const adapter = this.getProviderAdapter(provider);
    const result = await adapter.createHostedPayment(input);

    assertHostedPaymentResult(input, result);

    return result;
  }

  async verifyPayment(
    input: PaymentGatewayVerifyPaymentInput,
  ): Promise<PaymentGatewayVerifyPaymentResult> {
    const provider = assertExternalGatewayProvider(
      input.payment.payment_provider,
    );
    const adapter = this.getProviderAdapter(provider);
    const result = await adapter.verifyPayment(input);

    assertVerificationResult(provider, result);

    return result;
  }

  async refundPayment(
    input: PaymentGatewayRefundInput,
  ): Promise<PaymentGatewayRefundResult> {
    const provider = assertExternalGatewayProvider(
      input.payment.payment_provider,
    );
    const adapter = this.getProviderAdapter(provider);
    const result = await adapter.refundPayment(input);

    assertRefundResult(provider, result);

    return result;
  }

  async verifyWebhookSignature(input: PaymentWebhookInput): Promise<boolean> {
    const provider = assertExternalGatewayProvider(input.provider);
    const adapter = this.getProviderAdapter(provider);
    const verified = await adapter.verifyWebhookSignature(input);

    if (verified) {
      return true;
    }

    throw AppError.paymentWebhookInvalid(
      'Payment webhook signature verification failed.',
      {
        provider,
        event_id: input.headers.event_id,
      },
    );
  }

  async parseWebhook(
    input: PaymentWebhookInput,
  ): Promise<PaymentWebhookParsedEvent> {
    const provider = assertExternalGatewayProvider(input.provider);
    const adapter = this.getProviderAdapter(provider);
    const event = await adapter.parseWebhook(input);

    assertWebhookParsedEvent(provider, event);

    return event;
  }

  hasProvider(provider: PaymentExternalGatewayProvider): boolean {
    return typeof this.resolveProviderAdapter(provider) !== 'undefined';
  }

  getProviderAdapter(
    provider: PaymentExternalGatewayProvider,
  ): PaymentGatewayProviderAdapter {
    const adapter = this.resolveProviderAdapter(provider);

    if (typeof adapter !== 'undefined') {
      return adapter;
    }

    throw AppError.invalidRequest(
      'Payment gateway provider is not configured in the current backend module.',
      {
        provider,
      },
    );
  }

  private resolveProviderAdapter(
    provider: PaymentExternalGatewayProvider,
  ): PaymentGatewayProviderAdapter | undefined {
    if (provider === PAYMENT_PROVIDER_MOCK) {
      return this.mockProvider;
    }

    if (provider === PAYMENT_PROVIDER_KNET) {
      return this.knetProvider;
    }

    if (provider === PAYMENT_PROVIDER_TAP) {
      return this.tapProvider;
    }

    if (provider === PAYMENT_PROVIDER_MYFATOORAH) {
      return this.myFatoorahProvider;
    }

    if (provider === PAYMENT_PROVIDER_CHECKOUT) {
      return this.checkoutProvider;
    }

    return undefined;
  }
}
