// apps/api/src/modules/payments/guards/payment-rate-limit.guard.ts
/**
 * LAFAM Payment rate-limit guard.
 *
 * Role:
 * - Applies Payment-specific route rate limits.
 * - Builds deterministic rate-limit keys using user/IP/payment/provider references.
 * - Protects checkout, verify, wallet, webhook, refund, and admin wallet routes from brute-force/flood attempts.
 * - Keeps Payment rate-limit rules separate from generic application throttling.
 *
 * Important:
 * - This guard is intentionally bucket-based, not one global limit.
 * - Controllers must opt in with @PaymentRateLimit(...).
 * - This implementation is process-local.
 * - Multi-instance production deployment must replace the in-memory store with Redis/shared storage.
 * - Rate limiting is not authorization.
 * - Services must still enforce ownership, webhook verification, idempotency, and lifecycle rules.
 */

import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import {
  PAYMENT_RATE_LIMIT_ADMIN_REFUND,
  PAYMENT_RATE_LIMIT_ADMIN_REFUND_MAX,
  PAYMENT_RATE_LIMIT_ADMIN_WALLET_ADJUST,
  PAYMENT_RATE_LIMIT_ADMIN_WALLET_ADJUST_MAX,
  PAYMENT_RATE_LIMIT_BUCKETS,
  PAYMENT_RATE_LIMIT_CALLBACK,
  PAYMENT_RATE_LIMIT_CALLBACK_MAX,
  PAYMENT_RATE_LIMIT_CHECKOUT_CREATE,
  PAYMENT_RATE_LIMIT_CHECKOUT_CREATE_MAX,
  PAYMENT_RATE_LIMIT_PAYMENT_READ,
  PAYMENT_RATE_LIMIT_PAYMENT_READ_MAX,
  PAYMENT_RATE_LIMIT_PAYMENT_VERIFY,
  PAYMENT_RATE_LIMIT_PAYMENT_VERIFY_MAX,
  PAYMENT_RATE_LIMIT_WALLET_READ,
  PAYMENT_RATE_LIMIT_WALLET_READ_MAX,
  PAYMENT_RATE_LIMIT_WALLET_TOP_UP,
  PAYMENT_RATE_LIMIT_WALLET_TOP_UP_MAX,
  PAYMENT_RATE_LIMIT_WEBHOOK,
  PAYMENT_RATE_LIMIT_WEBHOOK_MAX,
  PAYMENT_RATE_LIMIT_WINDOW_SECONDS,
  type PaymentRateLimitBucket,
} from '../constants/payment.constants';
import { PaymentSecurityPolicy } from '../domain/payment-security.policy';

export const PAYMENT_RATE_LIMIT_METADATA_KEY = Symbol(
  'lafam:payment:rate-limit',
);

export interface PaymentRateLimitOptions {
  readonly bucket: PaymentRateLimitBucket;
  readonly limit?: number;
  readonly windowSeconds?: number;
}

interface PaymentRateLimitConfig {
  readonly limit: number;
  readonly windowSeconds: number;
}

interface RateLimitState {
  readonly resetAt: number;
  count: number;
}

interface RateLimitConsumeResult {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  readonly resetAt: number;
  readonly retryAfterSeconds: number;
  readonly windowSeconds: number;
}

interface HttpRequestLike {
  readonly ip?: string;
  readonly ips?: readonly string[];
  readonly headers?: Record<string, string | readonly string[] | undefined>;
  readonly params?: Record<string, string | undefined>;
  readonly query?: Record<string, unknown>;
  readonly body?: unknown;
  readonly socket?: {
    readonly remoteAddress?: string;
  };
  readonly auth?: unknown;
  readonly user?: unknown;
}

interface HttpResponseLike {
  setHeader(name: string, value: string | number): void;
}

const PAYMENT_RATE_LIMIT_DEFAULT_CONFIGS: Record<
  PaymentRateLimitBucket,
  PaymentRateLimitConfig
> = {
  [PAYMENT_RATE_LIMIT_CHECKOUT_CREATE]: {
    limit: PAYMENT_RATE_LIMIT_CHECKOUT_CREATE_MAX,
    windowSeconds: PAYMENT_RATE_LIMIT_WINDOW_SECONDS,
  },
  [PAYMENT_RATE_LIMIT_PAYMENT_VERIFY]: {
    limit: PAYMENT_RATE_LIMIT_PAYMENT_VERIFY_MAX,
    windowSeconds: PAYMENT_RATE_LIMIT_WINDOW_SECONDS,
  },
  [PAYMENT_RATE_LIMIT_PAYMENT_READ]: {
    limit: PAYMENT_RATE_LIMIT_PAYMENT_READ_MAX,
    windowSeconds: PAYMENT_RATE_LIMIT_WINDOW_SECONDS,
  },
  [PAYMENT_RATE_LIMIT_WALLET_TOP_UP]: {
    limit: PAYMENT_RATE_LIMIT_WALLET_TOP_UP_MAX,
    windowSeconds: PAYMENT_RATE_LIMIT_WINDOW_SECONDS,
  },
  [PAYMENT_RATE_LIMIT_WALLET_READ]: {
    limit: PAYMENT_RATE_LIMIT_WALLET_READ_MAX,
    windowSeconds: PAYMENT_RATE_LIMIT_WINDOW_SECONDS,
  },
  [PAYMENT_RATE_LIMIT_CALLBACK]: {
    limit: PAYMENT_RATE_LIMIT_CALLBACK_MAX,
    windowSeconds: PAYMENT_RATE_LIMIT_WINDOW_SECONDS,
  },
  [PAYMENT_RATE_LIMIT_WEBHOOK]: {
    limit: PAYMENT_RATE_LIMIT_WEBHOOK_MAX,
    windowSeconds: PAYMENT_RATE_LIMIT_WINDOW_SECONDS,
  },
  [PAYMENT_RATE_LIMIT_ADMIN_REFUND]: {
    limit: PAYMENT_RATE_LIMIT_ADMIN_REFUND_MAX,
    windowSeconds: PAYMENT_RATE_LIMIT_WINDOW_SECONDS,
  },
  [PAYMENT_RATE_LIMIT_ADMIN_WALLET_ADJUST]: {
    limit: PAYMENT_RATE_LIMIT_ADMIN_WALLET_ADJUST_MAX,
    windowSeconds: PAYMENT_RATE_LIMIT_WINDOW_SECONDS,
  },
};

const PAYMENT_RATE_LIMIT_BUCKET_SET = new Set<PaymentRateLimitBucket>(
  PAYMENT_RATE_LIMIT_BUCKETS,
);

const STORE_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isReadonlyStringArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.every((item): item is string => typeof item === 'string')
  );
}
function getStringProperty(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];

  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function getNestedStringProperty(
  value: unknown,
  path: readonly string[],
): string | null {
  let currentValue: unknown = value;

  for (const key of path) {
    if (!isRecord(currentValue)) {
      return null;
    }

    currentValue = currentValue[key];
  }

  return typeof currentValue === 'string' && currentValue.trim().length > 0
    ? currentValue.trim()
    : null;
}

function firstStringValue(
  value: string | readonly string[] | undefined,
): string | null {
  if (typeof value === 'string') {
    const trimmedValue = value.trim();

    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  if (isReadonlyStringArray(value)) {
    for (const item of value) {
      const trimmedValue = item.trim();

      if (trimmedValue.length > 0) {
        return trimmedValue;
      }
    }
  }

  return null;
}

function getHeaderValue(
  headers: Record<string, string | readonly string[] | undefined> | undefined,
  headerName: string,
): string | null {
  if (!headers) {
    return null;
  }

  const directValue = firstStringValue(headers[headerName]);

  if (directValue !== null) {
    return directValue;
  }

  const lowerHeaderName = headerName.toLowerCase();

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerHeaderName) {
      return firstStringValue(value);
    }
  }

  return null;
}

function resolveForwardedIp(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const [firstIp] = value.split(',');
  const trimmedIp = firstIp?.trim();

  return typeof trimmedIp === 'string' && trimmedIp.length > 0
    ? trimmedIp
    : null;
}

function resolveIpAddress(request: HttpRequestLike): string | null {
  const forwardedIp = resolveForwardedIp(
    getHeaderValue(request.headers, 'x-forwarded-for'),
  );

  if (forwardedIp !== null) {
    return forwardedIp;
  }

  const realIp = getHeaderValue(request.headers, 'x-real-ip');

  if (realIp !== null) {
    return realIp;
  }

  if (typeof request.ip === 'string' && request.ip.trim().length > 0) {
    return request.ip.trim();
  }

  if (isReadonlyStringArray(request.ips)) {
    for (const ip of request.ips) {
      const trimmedIp = ip.trim();

      if (trimmedIp.length > 0) {
        return trimmedIp;
      }
    }
  }

  const remoteAddress = request.socket?.remoteAddress;

  return typeof remoteAddress === 'string' && remoteAddress.trim().length > 0
    ? remoteAddress.trim()
    : null;
}

function resolveAuthenticatedUserId(request: HttpRequestLike): string | null {
  const authCandidate = request.auth ?? request.user;

  return (
    getNestedStringProperty(authCandidate, ['app_user', 'id']) ??
    getNestedStringProperty(authCandidate, ['user', 'id']) ??
    getNestedStringProperty(authCandidate, ['user', 'app_user_id']) ??
    getNestedStringProperty(authCandidate, ['session', 'app_user_id']) ??
    (isRecord(authCandidate)
      ? (getStringProperty(authCandidate, 'app_user_id') ??
        getStringProperty(authCandidate, 'user_id') ??
        getStringProperty(authCandidate, 'id'))
      : null)
  );
}

function resolvePaymentId(request: HttpRequestLike): string | null {
  return (
    request.params?.paymentId ??
    request.params?.payment_id ??
    (request.query ? getStringProperty(request.query, 'payment_id') : null) ??
    (isRecord(request.body)
      ? getStringProperty(request.body, 'payment_id')
      : null)
  );
}

function resolveTargetUserId(request: HttpRequestLike): string | null {
  return (
    request.params?.userId ??
    request.params?.user_id ??
    (request.query ? getStringProperty(request.query, 'user_id') : null) ??
    (isRecord(request.body) ? getStringProperty(request.body, 'user_id') : null)
  );
}

function resolveProviderReference(request: HttpRequestLike): string | null {
  return (
    (request.query
      ? (getStringProperty(request.query, 'provider_reference') ??
        getStringProperty(request.query, 'reference_id') ??
        getStringProperty(request.query, 'gateway_payment_id') ??
        getStringProperty(request.query, 'gateway_invoice_id') ??
        getStringProperty(request.query, 'event_id'))
      : null) ??
    (isRecord(request.body)
      ? (getStringProperty(request.body, 'provider_reference') ??
        getStringProperty(request.body, 'reference_id') ??
        getStringProperty(request.body, 'gateway_payment_id') ??
        getStringProperty(request.body, 'gateway_invoice_id') ??
        getStringProperty(request.body, 'event_id'))
      : null) ??
    getHeaderValue(request.headers, 'x-knet-event-id') ??
    getHeaderValue(request.headers, 'x-payment-event-id') ??
    getHeaderValue(request.headers, 'x-webhook-event-id')
  );
}

function resolveRateLimitConfig(
  options: PaymentRateLimitOptions,
): PaymentRateLimitConfig {
  const defaultConfig = PAYMENT_RATE_LIMIT_DEFAULT_CONFIGS[options.bucket];

  return {
    limit: options.limit ?? defaultConfig.limit,
    windowSeconds: options.windowSeconds ?? defaultConfig.windowSeconds,
  };
}

function assertPaymentRateLimitOptions(options: PaymentRateLimitOptions): void {
  if (!PAYMENT_RATE_LIMIT_BUCKET_SET.has(options.bucket)) {
    throw new Error(`Unsupported payment rate-limit bucket: ${options.bucket}`);
  }

  if (
    typeof options.limit !== 'undefined' &&
    (!Number.isInteger(options.limit) || options.limit < 1)
  ) {
    throw new Error('Payment rate-limit limit must be a positive integer.');
  }

  if (
    typeof options.windowSeconds !== 'undefined' &&
    (!Number.isInteger(options.windowSeconds) || options.windowSeconds < 1)
  ) {
    throw new Error(
      'Payment rate-limit windowSeconds must be a positive integer.',
    );
  }
}

function createRateLimitExceededException(
  key: string,
  result: RateLimitConsumeResult,
  bucket: PaymentRateLimitBucket,
): HttpException {
  return new HttpException(
    {
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      error: 'Too Many Requests',
      message: 'Too many payment requests. Please retry later.',
      code: 'PAYMENT_RATE_LIMIT_EXCEEDED',
      details: {
        bucket,
        key,
        limit: result.limit,
        window_seconds: result.windowSeconds,
        retry_after_seconds: result.retryAfterSeconds,
        reset_at: new Date(result.resetAt).toISOString(),
      },
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

function setRateLimitHeaders(
  response: HttpResponseLike,
  result: RateLimitConsumeResult,
): void {
  response.setHeader('X-RateLimit-Limit', result.limit);
  response.setHeader('X-RateLimit-Remaining', result.remaining);
  response.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));

  if (!result.allowed) {
    response.setHeader('Retry-After', result.retryAfterSeconds);
  }
}

export function PaymentRateLimit(
  bucket: PaymentRateLimitBucket,
  overrides: Omit<PaymentRateLimitOptions, 'bucket'> = {},
): MethodDecorator & ClassDecorator {
  const options: PaymentRateLimitOptions = {
    bucket,
    ...overrides,
  };

  assertPaymentRateLimitOptions(options);

  return SetMetadata(PAYMENT_RATE_LIMIT_METADATA_KEY, options);
}

class InMemoryPaymentRateLimitStore {
  private readonly buckets = new Map<string, RateLimitState>();

  private lastCleanupAt = 0;

  consume(input: {
    readonly key: string;
    readonly limit: number;
    readonly windowSeconds: number;
    readonly now: number;
  }): RateLimitConsumeResult {
    this.cleanupExpiredBuckets(input.now);

    const windowMs = input.windowSeconds * 1000;
    const existingBucket = this.buckets.get(input.key);

    if (!existingBucket || existingBucket.resetAt <= input.now) {
      const resetAt = input.now + windowMs;

      this.buckets.set(input.key, {
        count: 1,
        resetAt,
      });

      return {
        allowed: true,
        limit: input.limit,
        remaining: Math.max(0, input.limit - 1),
        resetAt,
        retryAfterSeconds: 0,
        windowSeconds: input.windowSeconds,
      };
    }

    if (existingBucket.count >= input.limit) {
      return {
        allowed: false,
        limit: input.limit,
        remaining: 0,
        resetAt: existingBucket.resetAt,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((existingBucket.resetAt - input.now) / 1000),
        ),
        windowSeconds: input.windowSeconds,
      };
    }

    existingBucket.count += 1;

    return {
      allowed: true,
      limit: input.limit,
      remaining: Math.max(0, input.limit - existingBucket.count),
      resetAt: existingBucket.resetAt,
      retryAfterSeconds: 0,
      windowSeconds: input.windowSeconds,
    };
  }

  private cleanupExpiredBuckets(now: number): void {
    if (now - this.lastCleanupAt < STORE_CLEANUP_INTERVAL_MS) {
      return;
    }

    this.lastCleanupAt = now;

    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}

@Injectable()
export class PaymentRateLimitGuard implements CanActivate {
  private static readonly store = new InMemoryPaymentRateLimitStore();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<PaymentRateLimitOptions>(
      PAYMENT_RATE_LIMIT_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) {
      return true;
    }

    assertPaymentRateLimitOptions(options);

    const request = context.switchToHttp().getRequest<HttpRequestLike>();
    const response = context.switchToHttp().getResponse<HttpResponseLike>();
    const config = resolveRateLimitConfig(options);

    const key = PaymentSecurityPolicy.buildRateLimitKey({
      bucket: options.bucket,
      ip_address: resolveIpAddress(request),
      ...(resolveAuthenticatedUserId(request) !== null
        ? { user_id: resolveAuthenticatedUserId(request) }
        : {}),
      ...(resolvePaymentId(request) !== null
        ? { payment_id: resolvePaymentId(request) }
        : {}),
      ...(resolveProviderReference(request) !== null
        ? { provider_reference: resolveProviderReference(request) }
        : {}),
      ...(resolveTargetUserId(request) !== null
        ? { target_user_id: resolveTargetUserId(request) }
        : {}),
    });

    const result = PaymentRateLimitGuard.store.consume({
      key,
      limit: config.limit,
      windowSeconds: config.windowSeconds,
      now: Date.now(),
    });

    setRateLimitHeaders(response, result);

    if (result.allowed) {
      return true;
    }

    throw createRateLimitExceededException(key, result, options.bucket);
  }
}
