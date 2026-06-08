// apps/api/src/common/config/logging.config.ts
/**
 * LAFAM API logging configuration.
 *
 * Role:
 * - Defines logger behavior for the API runtime.
 * - Chooses NestJS log levels based on the current environment.
 * - Keeps logging behavior centralized for AppLoggerService and bootstrap.
 *
 * Important:
 * - This file does not read process.env directly.
 * - Runtime environment values come from app.config.ts.
 * - Sensitive values must never be logged by logger implementations.
 */

import type { LogLevel } from '@nestjs/common';

import { currentAppConfig } from './app.config';

export interface LoggingConfig {
  readonly serviceName: string;
  readonly environment: string;
  readonly levels: readonly LogLevel[];
  readonly useJsonLogs: boolean;
  readonly includeTimestamp: boolean;
  readonly includeRequestLogs: boolean;
  readonly includeErrorStack: boolean;
  readonly redactSensitiveValues: boolean;
  readonly slowRequestThresholdMs: number;
}

const SERVICE_NAME = 'lafam-api';
const DEFAULT_SLOW_REQUEST_THRESHOLD_MS = 1000;

const DEVELOPMENT_LOG_LEVELS = [
  'log',
  'error',
  'warn',
  'debug',
  'verbose',
] as const satisfies readonly LogLevel[];

const TEST_LOG_LEVELS = [
  'error',
  'warn',
] as const satisfies readonly LogLevel[];

const PRODUCTION_LOG_LEVELS = [
  'log',
  'error',
  'warn',
] as const satisfies readonly LogLevel[];

function resolveLogLevels(): readonly LogLevel[] {
  if (currentAppConfig.isTest) {
    return TEST_LOG_LEVELS;
  }

  if (currentAppConfig.isProduction || currentAppConfig.isStaging) {
    return PRODUCTION_LOG_LEVELS;
  }

  return DEVELOPMENT_LOG_LEVELS;
}

export function createLoggingConfig(): LoggingConfig {
  const isProductionLike =
    currentAppConfig.isProduction || currentAppConfig.isStaging;

  return {
    serviceName: SERVICE_NAME,
    environment: currentAppConfig.nodeEnv,
    levels: resolveLogLevels(),
    useJsonLogs: isProductionLike,
    includeTimestamp: true,
    includeRequestLogs: !currentAppConfig.isTest,
    includeErrorStack: !currentAppConfig.isProduction,
    redactSensitiveValues: true,
    slowRequestThresholdMs: DEFAULT_SLOW_REQUEST_THRESHOLD_MS,
  };
}

export const currentLoggingConfig = createLoggingConfig();
