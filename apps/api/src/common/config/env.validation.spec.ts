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
        guestSessionTtlHours: 24,
        guestMaxSessionsPerIpPerHour: 20,
        guestRequireCaptcha: false,
        guestCleanupEnabled: true,
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
});
