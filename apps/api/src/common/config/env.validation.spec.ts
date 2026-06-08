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
});
