// apps/api/src/common/config/payment.config.ts
/**
 * LAFAM API Payment configuration.
 *
 * Role:
 * - Exposes Payment Module runtime configuration.
 * - Converts the validated environment into a focused Payment config object.
 * - Keeps hosted payment redirect URLs, KNET/provider credentials, and payment mode outside business logic.
 *
 * Important:
 * - This file does not validate raw environment values directly.
 * - Validation is owned by env.validation.ts.
 * - KNET/card payments must use hosted redirect flow.
 * - KNET credentials are optional only when PAYMENT_PROVIDER is mock.
 * - Payment services should consume this config instead of reading process.env.
 */

import { validateEnvironment, type EnvironmentInput } from './env.validation';
import type { PaymentMode, PaymentProvider } from './environment.contract';

export const PAYMENT_KNET_CALLBACK_PATH = '/api/payments/callback/knet';
export const PAYMENT_KNET_WEBHOOK_PATH = '/api/payments/webhooks/knet';

export interface PaymentRedirectConfig {
  readonly publicBaseUrl: string;
  readonly frontendSuccessUrl: string;
  readonly frontendFailureUrl: string;
  readonly knetCallbackPath: string;
  readonly knetWebhookPath: string;
  readonly knetCallbackUrl: string;
  readonly knetWebhookUrl: string;
}

export interface PaymentKnetConfig {
  readonly merchantId: string;
  readonly secretKey: string;
  readonly webhookSecret: string;
  readonly apiBaseUrl: string;
  readonly sandboxApiBaseUrl: string;
  readonly activeApiBaseUrl: string;
  readonly callbackUrl: string;
  readonly webhookUrl: string;
  readonly isConfigured: boolean;
}

export interface PaymentConfig {
  readonly provider: PaymentProvider;
  readonly mode: PaymentMode;
  readonly defaultCurrency: string;
  readonly isMockProvider: boolean;
  readonly isSandboxMode: boolean;
  readonly isProductionMode: boolean;
  readonly redirect: PaymentRedirectConfig;
  readonly knet: PaymentKnetConfig;
}

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/u, '');
}

function ensureLeadingSlash(value: string): string {
  return value.startsWith('/') ? value : `/${value}`;
}

function joinUrl(baseUrl: string, path: string): string {
  return `${trimTrailingSlashes(baseUrl)}${ensureLeadingSlash(path)}`;
}

function resolveActiveKnetApiBaseUrl(
  mode: PaymentMode,
  apiBaseUrl: string,
  sandboxApiBaseUrl: string,
): string {
  return mode === 'production' ? apiBaseUrl : sandboxApiBaseUrl;
}

export function createPaymentConfig(
  environment: EnvironmentInput = process.env,
): PaymentConfig {
  const validatedEnvironment = validateEnvironment(environment);
  const { payment } = validatedEnvironment;

  const knetCallbackUrl = joinUrl(
    payment.publicBaseUrl,
    PAYMENT_KNET_CALLBACK_PATH,
  );

  const knetWebhookUrl = joinUrl(
    payment.publicBaseUrl,
    PAYMENT_KNET_WEBHOOK_PATH,
  );

  const activeKnetApiBaseUrl = resolveActiveKnetApiBaseUrl(
    payment.mode,
    payment.knetApiBaseUrl,
    payment.knetSandboxApiBaseUrl,
  );

  const isMockProvider = payment.provider === 'mock';

  return {
    provider: payment.provider,
    mode: payment.mode,
    defaultCurrency: payment.defaultCurrency,
    isMockProvider,
    isSandboxMode: payment.mode === 'sandbox',
    isProductionMode: payment.mode === 'production',
    redirect: {
      publicBaseUrl: payment.publicBaseUrl,
      frontendSuccessUrl: payment.frontendSuccessUrl,
      frontendFailureUrl: payment.frontendFailureUrl,
      knetCallbackPath: PAYMENT_KNET_CALLBACK_PATH,
      knetWebhookPath: PAYMENT_KNET_WEBHOOK_PATH,
      knetCallbackUrl,
      knetWebhookUrl,
    },
    knet: {
      merchantId: payment.knetMerchantId,
      secretKey: payment.knetSecretKey,
      webhookSecret: payment.knetWebhookSecret,
      apiBaseUrl: payment.knetApiBaseUrl,
      sandboxApiBaseUrl: payment.knetSandboxApiBaseUrl,
      activeApiBaseUrl: activeKnetApiBaseUrl,
      callbackUrl: knetCallbackUrl,
      webhookUrl: knetWebhookUrl,
      isConfigured:
        !isMockProvider &&
        payment.knetMerchantId.length > 0 &&
        payment.knetSecretKey.length > 0 &&
        payment.knetWebhookSecret.length > 0 &&
        activeKnetApiBaseUrl.length > 0,
    },
  };
}

export const currentPaymentConfig = createPaymentConfig();
