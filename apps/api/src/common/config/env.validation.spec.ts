// apps/api/src/common/config/env.validation.spec.ts
import { validateEnvironment } from './env.validation';
import type { RawEnvironment } from './environment.contract';

function createValidEnvironment(
  overrides: RawEnvironment = {},
): RawEnvironment {
  return {
    NODE_ENV: 'development',
    PORT: '4000',
    API_GLOBAL_PREFIX: 'api',
    WEB_ORIGIN: 'http://localhost:3000',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
    SUPABASE_SECRET_KEY: 'test-secret-key',
    SENTRY_ENVIRONMENT: 'development',
    SENTRY_TRACES_SAMPLE_RATE: '0.1',
    BREVO_SENDER_NAME: 'LAFAM',
    JWT_CLOCK_TOLERANCE_SECONDS: '30',
    REQUEST_BODY_LIMIT: '1mb',
    AUTH_ACCESS_TOKEN_HASH_PEPPER: 'test-auth-token-hash-pepper-value-0001',
    AUTH_RESET_TOKEN_TTL_MINUTES: '15',
    AUTH_MAX_RESET_OTP_ATTEMPTS: '5',
    AUTH_AVATAR_BUCKET: 'avatars',
    AUTH_AVATAR_MAX_SIZE_BYTES: '2097152',
    AUTH_AVATAR_SIGNED_URL_TTL_SECONDS: '3600',
    AUTH_SESSION_TTL_HOURS: '24',
    AUTH_GUEST_SESSION_TTL_HOURS: '24',
    AUTH_GUEST_MAX_SESSIONS_PER_IP_PER_HOUR: '20',
    AUTH_GUEST_REQUIRE_CAPTCHA: 'false',
    AUTH_GUEST_CLEANUP_ENABLED: 'true',
    ...overrides,
  };
}

describe('validateEnvironment', () => {
  it('returns a validated environment object for valid input', () => {
    const result = validateEnvironment(createValidEnvironment());

    expect(result).toEqual({
      app: {
        nodeEnv: 'development',
        port: 4000,
        apiGlobalPrefix: 'api',
        webOrigin: 'http://localhost:3000',
      },
      supabase: {
        url: 'https://example.supabase.co',
        publishableKey: 'test-publishable-key',
        secretKey: 'test-secret-key',
      },
      sentry: {
        dsn: '',
        environment: 'development',
        tracesSampleRate: 0.1,
      },
      brevo: {
        apiKey: '',
        senderEmail: '',
        senderName: 'LAFAM',
      },
      security: {
        jwtClockToleranceSeconds: 30,
        requestBodyLimit: '1mb',
      },
      auth: {
        accessTokenHashPepper: 'test-auth-token-hash-pepper-value-0001',
        resetTokenTtlMinutes: 15,
        maxResetOtpAttempts: 5,
        avatarBucket: 'avatars',
        avatarMaxSizeBytes: 2097152,
        avatarSignedUrlTtlSeconds: 3600,
        authenticatedSessionTtlHours: 24,
        guestSessionTtlHours: 24,
        guestMaxSessionsPerIpPerHour: 20,
        guestRequireCaptcha: false,
        guestCleanupEnabled: true,
      },
      payment: {
        provider: 'mock',
        mode: 'sandbox',
        defaultCurrency: 'KWD',
        publicBaseUrl: 'http://localhost:4000',
        frontendSuccessUrl: 'http://localhost:3000/payment/success',
        frontendFailureUrl: 'http://localhost:3000/payment/failed',
        knetMerchantId: '',
        knetSecretKey: '',
        knetWebhookSecret: '',
        knetApiBaseUrl: '',
        knetSandboxApiBaseUrl: '',
      },
    });
  });

  it('normalizes API global prefix by removing surrounding slashes', () => {
    const result = validateEnvironment(
      createValidEnvironment({
        API_GLOBAL_PREFIX: '/api/',
      }),
    );

    expect(result.app.apiGlobalPrefix).toBe('api');
  });

  it('normalizes request body limit to lowercase', () => {
    const result = validateEnvironment(
      createValidEnvironment({
        REQUEST_BODY_LIMIT: '2MB',
      }),
    );

    expect(result.security.requestBodyLimit).toBe('2mb');
  });

  it('parses Auth boolean values', () => {
    const result = validateEnvironment(
      createValidEnvironment({
        AUTH_GUEST_REQUIRE_CAPTCHA: 'true',
        AUTH_GUEST_CLEANUP_ENABLED: 'false',
      }),
    );

    expect(result.auth.guestRequireCaptcha).toBe(true);
    expect(result.auth.guestCleanupEnabled).toBe(false);
  });

  it('uses safe Payment defaults for local mock development', () => {
    const result = validateEnvironment(createValidEnvironment());

    expect(result.payment).toEqual({
      provider: 'mock',
      mode: 'sandbox',
      defaultCurrency: 'KWD',
      publicBaseUrl: 'http://localhost:4000',
      frontendSuccessUrl: 'http://localhost:3000/payment/success',
      frontendFailureUrl: 'http://localhost:3000/payment/failed',
      knetMerchantId: '',
      knetSecretKey: '',
      knetWebhookSecret: '',
      knetApiBaseUrl: '',
      knetSandboxApiBaseUrl: '',
    });
  });

  it('parses explicit mock Payment configuration', () => {
    const result = validateEnvironment(
      createValidEnvironment({
        PAYMENT_PROVIDER: 'mock',
        PAYMENT_MODE: 'sandbox',
        PAYMENT_DEFAULT_CURRENCY: 'kwd',
        PAYMENT_PUBLIC_BASE_URL: 'https://api.lafam.test',
        PAYMENT_FRONTEND_SUCCESS_URL: 'https://lafam.test/payment/success',
        PAYMENT_FRONTEND_FAILURE_URL: 'https://lafam.test/payment/failed',
      }),
    );

    expect(result.payment).toEqual({
      provider: 'mock',
      mode: 'sandbox',
      defaultCurrency: 'KWD',
      publicBaseUrl: 'https://api.lafam.test',
      frontendSuccessUrl: 'https://lafam.test/payment/success',
      frontendFailureUrl: 'https://lafam.test/payment/failed',
      knetMerchantId: '',
      knetSecretKey: '',
      knetWebhookSecret: '',
      knetApiBaseUrl: '',
      knetSandboxApiBaseUrl: '',
    });
  });

  it('accepts non-mock sandbox Payment provider when KNET sandbox credentials are configured', () => {
    const result = validateEnvironment(
      createValidEnvironment({
        PAYMENT_PROVIDER: 'knet',
        PAYMENT_MODE: 'sandbox',
        PAYMENT_DEFAULT_CURRENCY: 'KWD',
        PAYMENT_PUBLIC_BASE_URL: 'https://api.lafam.test',
        PAYMENT_FRONTEND_SUCCESS_URL: 'https://lafam.test/payment/success',
        PAYMENT_FRONTEND_FAILURE_URL: 'https://lafam.test/payment/failed',
        KNET_MERCHANT_ID: 'sandbox-merchant',
        KNET_SECRET_KEY: 'sandbox-secret',
        KNET_WEBHOOK_SECRET: 'sandbox-webhook-secret',
        KNET_SANDBOX_API_BASE_URL: 'https://sandbox-payments.lafam.test',
      }),
    );

    expect(result.payment).toEqual({
      provider: 'knet',
      mode: 'sandbox',
      defaultCurrency: 'KWD',
      publicBaseUrl: 'https://api.lafam.test',
      frontendSuccessUrl: 'https://lafam.test/payment/success',
      frontendFailureUrl: 'https://lafam.test/payment/failed',
      knetMerchantId: 'sandbox-merchant',
      knetSecretKey: 'sandbox-secret',
      knetWebhookSecret: 'sandbox-webhook-secret',
      knetApiBaseUrl: '',
      knetSandboxApiBaseUrl: 'https://sandbox-payments.lafam.test',
    });
  });

  it('accepts non-mock production Payment provider when KNET production credentials are configured', () => {
    const result = validateEnvironment(
      createValidEnvironment({
        PAYMENT_PROVIDER: 'tap',
        PAYMENT_MODE: 'production',
        PAYMENT_DEFAULT_CURRENCY: 'KWD',
        PAYMENT_PUBLIC_BASE_URL: 'https://api.lafam.com',
        PAYMENT_FRONTEND_SUCCESS_URL: 'https://lafam.com/payment/success',
        PAYMENT_FRONTEND_FAILURE_URL: 'https://lafam.com/payment/failed',
        KNET_MERCHANT_ID: 'production-merchant',
        KNET_SECRET_KEY: 'production-secret',
        KNET_WEBHOOK_SECRET: 'production-webhook-secret',
        KNET_API_BASE_URL: 'https://payments.lafam.com',
      }),
    );

    expect(result.payment).toEqual({
      provider: 'tap',
      mode: 'production',
      defaultCurrency: 'KWD',
      publicBaseUrl: 'https://api.lafam.com',
      frontendSuccessUrl: 'https://lafam.com/payment/success',
      frontendFailureUrl: 'https://lafam.com/payment/failed',
      knetMerchantId: 'production-merchant',
      knetSecretKey: 'production-secret',
      knetWebhookSecret: 'production-webhook-secret',
      knetApiBaseUrl: 'https://payments.lafam.com',
      knetSandboxApiBaseUrl: '',
    });
  });

  it('rejects invalid port values', () => {
    expect(() =>
      validateEnvironment(
        createValidEnvironment({
          PORT: 'abc',
        }),
      ),
    ).toThrow('PORT must be a number between 1 and 65535.');
  });

  it('rejects missing Supabase credentials', () => {
    expect(() =>
      validateEnvironment(
        createValidEnvironment({
          SUPABASE_URL: '',
          SUPABASE_PUBLISHABLE_KEY: '',
          SUPABASE_SECRET_KEY: '',
        }),
      ),
    ).toThrow('SUPABASE_URL is required.');
  });

  it('rejects partial Brevo setup', () => {
    expect(() =>
      validateEnvironment(
        createValidEnvironment({
          BREVO_API_KEY: 'test-brevo-key',
          BREVO_SENDER_EMAIL: '',
        }),
      ),
    ).toThrow(
      'BREVO_API_KEY and BREVO_SENDER_EMAIL must be configured together.',
    );
  });

  it('rejects short Auth access token hash pepper', () => {
    expect(() =>
      validateEnvironment(
        createValidEnvironment({
          AUTH_ACCESS_TOKEN_HASH_PEPPER: 'too-short',
        }),
      ),
    ).toThrow(
      'AUTH_ACCESS_TOKEN_HASH_PEPPER must be at least 32 characters long.',
    );
  });

  it('rejects invalid Auth avatar bucket names', () => {
    expect(() =>
      validateEnvironment(
        createValidEnvironment({
          AUTH_AVATAR_BUCKET: 'Invalid Bucket',
        }),
      ),
    ).toThrow(
      'AUTH_AVATAR_BUCKET must be 2 to 63 characters and may only contain lowercase letters, numbers, underscores, and hyphens.',
    );
  });

  it('rejects invalid Auth avatar file size limits', () => {
    expect(() =>
      validateEnvironment(
        createValidEnvironment({
          AUTH_AVATAR_MAX_SIZE_BYTES: '100',
        }),
      ),
    ).toThrow(
      'AUTH_AVATAR_MAX_SIZE_BYTES must be an integer between 1024 and 10485760.',
    );
  });

  it('rejects invalid guest captcha boolean value', () => {
    expect(() =>
      validateEnvironment(
        createValidEnvironment({
          AUTH_GUEST_REQUIRE_CAPTCHA: 'yes',
        }),
      ),
    ).toThrow('AUTH_GUEST_REQUIRE_CAPTCHA must be either true or false.');
  });

  it('rejects invalid guest cleanup boolean value', () => {
    expect(() =>
      validateEnvironment(
        createValidEnvironment({
          AUTH_GUEST_CLEANUP_ENABLED: '1',
        }),
      ),
    ).toThrow('AUTH_GUEST_CLEANUP_ENABLED must be either true or false.');
  });

  it('rejects invalid guest session ttl values', () => {
    expect(() =>
      validateEnvironment(
        createValidEnvironment({
          AUTH_GUEST_SESSION_TTL_HOURS: '0',
        }),
      ),
    ).toThrow(
      'AUTH_GUEST_SESSION_TTL_HOURS must be an integer between 1 and 168.',
    );
  });

  it.each(['0', '721'])(
    'rejects invalid authenticated session ttl value %s',
    (sessionTtlHours) => {
      expect(() =>
        validateEnvironment(
          createValidEnvironment({
            AUTH_SESSION_TTL_HOURS: sessionTtlHours,
          }),
        ),
      ).toThrow('AUTH_SESSION_TTL_HOURS must be an integer between 1 and 720.');
    },
  );

  it('rejects invalid guest session rate-limit values', () => {
    expect(() =>
      validateEnvironment(
        createValidEnvironment({
          AUTH_GUEST_MAX_SESSIONS_PER_IP_PER_HOUR: '0',
        }),
      ),
    ).toThrow(
      'AUTH_GUEST_MAX_SESSIONS_PER_IP_PER_HOUR must be an integer between 1 and 1000.',
    );
  });

  it('rejects invalid Payment provider values', () => {
    expect(() =>
      validateEnvironment(
        createValidEnvironment({
          PAYMENT_PROVIDER: 'stripe',
        }),
      ),
    ).toThrow(
      'PAYMENT_PROVIDER must be one of: mock, knet, tap, myfatoorah, checkout.',
    );
  });

  it('rejects invalid Payment mode values', () => {
    expect(() =>
      validateEnvironment(
        createValidEnvironment({
          PAYMENT_MODE: 'live',
        }),
      ),
    ).toThrow('PAYMENT_MODE must be one of: sandbox, production.');
  });

  it('rejects invalid Payment default currency format', () => {
    expect(() =>
      validateEnvironment(
        createValidEnvironment({
          PAYMENT_DEFAULT_CURRENCY: '123',
        }),
      ),
    ).toThrow('PAYMENT_DEFAULT_CURRENCY must be a 3-letter currency code.');
  });

  it('rejects non-KWD Payment default currency', () => {
    expect(() =>
      validateEnvironment(
        createValidEnvironment({
          PAYMENT_DEFAULT_CURRENCY: 'USD',
        }),
      ),
    ).toThrow(
      'PAYMENT_DEFAULT_CURRENCY must be KWD for the current payment module.',
    );
  });

  it('rejects missing KNET merchant id for non-mock Payment provider', () => {
    expect(() =>
      validateEnvironment(
        createValidEnvironment({
          PAYMENT_PROVIDER: 'knet',
          PAYMENT_MODE: 'sandbox',
          KNET_SECRET_KEY: 'sandbox-secret',
          KNET_WEBHOOK_SECRET: 'sandbox-webhook-secret',
          KNET_SANDBOX_API_BASE_URL: 'https://sandbox-payments.lafam.test',
        }),
      ),
    ).toThrow(
      'KNET_MERCHANT_ID is required when PAYMENT_PROVIDER is not mock.',
    );
  });

  it('rejects missing KNET secret key for non-mock Payment provider', () => {
    expect(() =>
      validateEnvironment(
        createValidEnvironment({
          PAYMENT_PROVIDER: 'knet',
          PAYMENT_MODE: 'sandbox',
          KNET_MERCHANT_ID: 'sandbox-merchant',
          KNET_WEBHOOK_SECRET: 'sandbox-webhook-secret',
          KNET_SANDBOX_API_BASE_URL: 'https://sandbox-payments.lafam.test',
        }),
      ),
    ).toThrow('KNET_SECRET_KEY is required when PAYMENT_PROVIDER is not mock.');
  });

  it('rejects missing KNET webhook secret for non-mock Payment provider', () => {
    expect(() =>
      validateEnvironment(
        createValidEnvironment({
          PAYMENT_PROVIDER: 'knet',
          PAYMENT_MODE: 'sandbox',
          KNET_MERCHANT_ID: 'sandbox-merchant',
          KNET_SECRET_KEY: 'sandbox-secret',
          KNET_SANDBOX_API_BASE_URL: 'https://sandbox-payments.lafam.test',
        }),
      ),
    ).toThrow(
      'KNET_WEBHOOK_SECRET is required when PAYMENT_PROVIDER is not mock.',
    );
  });

  it('rejects missing KNET sandbox API base URL for sandbox non-mock Payment provider', () => {
    expect(() =>
      validateEnvironment(
        createValidEnvironment({
          PAYMENT_PROVIDER: 'knet',
          PAYMENT_MODE: 'sandbox',
          KNET_MERCHANT_ID: 'sandbox-merchant',
          KNET_SECRET_KEY: 'sandbox-secret',
          KNET_WEBHOOK_SECRET: 'sandbox-webhook-secret',
        }),
      ),
    ).toThrow(
      'KNET_SANDBOX_API_BASE_URL is required when PAYMENT_PROVIDER is not mock and PAYMENT_MODE is sandbox.',
    );
  });

  it('rejects missing KNET production API base URL for production non-mock Payment provider', () => {
    expect(() =>
      validateEnvironment(
        createValidEnvironment({
          PAYMENT_PROVIDER: 'knet',
          PAYMENT_MODE: 'production',
          KNET_MERCHANT_ID: 'production-merchant',
          KNET_SECRET_KEY: 'production-secret',
          KNET_WEBHOOK_SECRET: 'production-webhook-secret',
        }),
      ),
    ).toThrow(
      'KNET_API_BASE_URL is required when PAYMENT_PROVIDER is not mock and PAYMENT_MODE is production.',
    );
  });
});
