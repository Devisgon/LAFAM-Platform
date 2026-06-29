// apps/api/src/common/config/redis.config.ts
/**
 * LAFAM API Redis configuration.
 *
 * Role:
 * - Exposes Redis runtime configuration for BullMQ.
 * - Converts the validated Redis URL into BullMQ connection options.
 * - Provides one queue prefix used by BullMQ key namespacing.
 * - Keeps Redis connection parsing outside application modules.
 *
 * Important:
 * - This file does not validate raw environment values directly.
 * - Validation is owned by env.validation.ts.
 * - REDIS_URL can contain credentials and must never be logged.
 * - Feature modules must not read process.env for Redis values.
 * - BullMQ queue registration belongs inside feature modules.
 * - BullMQ root connection wiring belongs in AppModule.
 */

import { validateEnvironment, type EnvironmentInput } from './env.validation';

export interface RedisConnectionConfig {
  readonly host: string;
  readonly port: number;
  readonly username?: string;
  readonly password?: string;
  readonly db?: number;
  readonly tls?: Record<string, never>;
  readonly maxRetriesPerRequest: null;
}

export interface RedisConfig {
  readonly url: string;
  readonly queuePrefix: string;
  readonly connection: RedisConnectionConfig;
}

const DEFAULT_REDIS_PORT = 6379;
const REDIS_TLS_PROTOCOL = 'rediss:';

function parseRedisPort(parsedUrl: URL): number {
  if (!parsedUrl.port) {
    return DEFAULT_REDIS_PORT;
  }

  const parsedPort = Number(parsedUrl.port);

  if (!Number.isInteger(parsedPort) || parsedPort <= 0 || parsedPort > 65_535) {
    return DEFAULT_REDIS_PORT;
  }

  return parsedPort;
}

function parseRedisDatabase(parsedUrl: URL): number | undefined {
  const normalizedPath = parsedUrl.pathname.replace(/^\/+/, '').trim();

  if (!normalizedPath) {
    return undefined;
  }

  const parsedDatabase = Number(normalizedPath);

  if (!Number.isInteger(parsedDatabase) || parsedDatabase < 0) {
    return undefined;
  }

  return parsedDatabase;
}

function decodeRedisCredential(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function createRedisConnectionConfig(redisUrl: string): RedisConnectionConfig {
  const parsedUrl = new URL(redisUrl);
  const username = parsedUrl.username
    ? decodeRedisCredential(parsedUrl.username)
    : null;
  const password = parsedUrl.password
    ? decodeRedisCredential(parsedUrl.password)
    : null;
  const database = parseRedisDatabase(parsedUrl);

  return {
    host: parsedUrl.hostname,
    port: parseRedisPort(parsedUrl),
    maxRetriesPerRequest: null,
    ...(username
      ? {
          username,
        }
      : {}),
    ...(password
      ? {
          password,
        }
      : {}),
    ...(typeof database === 'number'
      ? {
          db: database,
        }
      : {}),
    ...(parsedUrl.protocol === REDIS_TLS_PROTOCOL
      ? {
          tls: {},
        }
      : {}),
  };
}

export function createRedisConfig(
  environment: EnvironmentInput = process.env,
): RedisConfig {
  const validatedEnvironment = validateEnvironment(environment);
  const { redis } = validatedEnvironment;

  return {
    url: redis.url,
    queuePrefix: redis.queuePrefix,
    connection: createRedisConnectionConfig(redis.url),
  };
}

export const currentRedisConfig = createRedisConfig();
