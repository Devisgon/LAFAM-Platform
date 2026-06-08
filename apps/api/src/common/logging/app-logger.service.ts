// apps/api/src/common/logging/app-logger.service.ts
/**
 * LAFAM API application logger.
 *
 * Role:
 * - Provides one structured logger for NestJS system logs and application logs.
 * - Adds severity-based colors for local readable logs.
 * - Preserves JSON-safe structured logs for production-like environments.
 * - Redacts sensitive values before writing logs.
 *
 * Important:
 * - Do not log raw passwords, tokens, API keys, cookies, authorization headers, or secrets.
 * - This logger accepts both NestJS logger calls and application-style structured calls.
 * - Production/staging logs remain uncolored JSON so log collectors can parse them safely.
 */

import { Injectable, type LoggerService, type LogLevel } from '@nestjs/common';

import {
  currentLoggingConfig,
  type LoggingConfig,
} from '../config/logging.config';
import {
  ENVIRONMENT_VARIABLE_NAMES,
  isSensitiveEnvironmentVariableName,
  type EnvironmentVariableName,
} from '../config/environment.contract';

export type AppLogSeverity = Extract<
  LogLevel,
  'log' | 'fatal' | 'error' | 'warn' | 'debug' | 'verbose'
>;

export interface AppLogOptions {
  readonly context?: string;
  readonly requestId?: string;
  readonly metadata?: Record<string, unknown>;
  readonly trace?: string;
}

export interface StructuredLogEntry {
  readonly timestamp: string;
  readonly level: AppLogSeverity;
  readonly service: string;
  readonly environment: string;
  readonly pid: number;
  readonly message: string;
  readonly context?: string;
  readonly requestId?: string;
  readonly metadata?: unknown;
  readonly trace?: string;
}

const REDACTED_VALUE = '[REDACTED]';
const CIRCULAR_VALUE = '[Circular]';

const ENVIRONMENT_VARIABLE_NAME_SET = new Set<string>(
  ENVIRONMENT_VARIABLE_NAMES,
);

const SENSITIVE_KEY_PATTERN =
  /password|passwd|pwd|secret|token|api[_-]?key|authorization|cookie|session|credential|private[_-]?key|dsn|supabase|brevo|sentry/iu;

const SEVERITY_COLORS = {
  fatal: '\u001B[45;97m',
  error: '\u001B[31m',
  warn: '\u001B[33m',
  log: '\u001B[32m',
  debug: '\u001B[36m',
  verbose: '\u001B[90m',
} as const satisfies Record<AppLogSeverity, string>;

const COLOR_RESET = '\u001B[0m';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEnvironmentVariableName(
  value: string,
): value is EnvironmentVariableName {
  return ENVIRONMENT_VARIABLE_NAME_SET.has(value);
}

function isSensitiveObjectKey(key: string): boolean {
  if (
    isEnvironmentVariableName(key) &&
    isSensitiveEnvironmentVariableName(key)
  ) {
    return true;
  }

  return SENSITIVE_KEY_PATTERN.test(key);
}

function isAppLogOptions(value: unknown): value is AppLogOptions {
  if (!isRecord(value)) {
    return false;
  }

  return (
    'context' in value ||
    'requestId' in value ||
    'metadata' in value ||
    'trace' in value
  );
}

function mergeMetadata(
  currentMetadata: Record<string, unknown> | undefined,
  nextMetadata: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...(currentMetadata ?? {}),
    ...nextMetadata,
  };
}

function sanitizeForLog(
  value: unknown,
  seenObjects: WeakSet<object> = new WeakSet<object>(),
): unknown {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'undefined') {
    return undefined;
  }

  if (typeof value === 'symbol') {
    return value.toString();
  }

  if (typeof value === 'function') {
    return `[Function: ${value.name || 'anonymous'}]`;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLog(item, seenObjects));
  }

  if (typeof value === 'object') {
    if (seenObjects.has(value)) {
      return CIRCULAR_VALUE;
    }

    seenObjects.add(value);

    const output: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      output[key] = isSensitiveObjectKey(key)
        ? REDACTED_VALUE
        : sanitizeForLog(nestedValue, seenObjects);
    }

    return output;
  }

  return '[Unsupported log value]';
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(sanitizeForLog(value));
  } catch {
    return JSON.stringify({
      message: 'Log serialization failed.',
    });
  }
}

function stringifyMessage(message: unknown): string {
  if (typeof message === 'string') {
    return message;
  }

  if (message instanceof Error) {
    return message.message;
  }

  return safeStringify(message);
}

function colorize(level: AppLogSeverity, value: string): string {
  return `${SEVERITY_COLORS[level]}${value}${COLOR_RESET}`;
}

function resolveConsoleWriter(
  level: AppLogSeverity,
): (message?: unknown, ...optionalParams: unknown[]) => void {
  if (level === 'fatal' || level === 'error') {
    return console.error;
  }

  if (level === 'warn') {
    return console.warn;
  }

  if (level === 'debug') {
    return console.debug;
  }

  return console.log;
}

@Injectable()
export class AppLoggerService implements LoggerService {
  constructor(private readonly config: LoggingConfig = currentLoggingConfig) {}

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('log', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('fatal', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('verbose', message, optionalParams);
  }

  private write(
    level: AppLogSeverity,
    message: unknown,
    optionalParams: readonly unknown[],
  ): void {
    if (!this.shouldWrite(level)) {
      return;
    }

    const options = this.resolveLogOptions(level, optionalParams);
    const entry = this.createStructuredEntry(level, message, options);
    const serializedEntry = safeStringify(entry);
    const output = this.config.useJsonLogs
      ? serializedEntry
      : colorize(level, serializedEntry);

    resolveConsoleWriter(level)(output);
  }

  private shouldWrite(level: AppLogSeverity): boolean {
    return this.config.levels.includes(level);
  }

  private createStructuredEntry(
    level: AppLogSeverity,
    message: unknown,
    options: AppLogOptions,
  ): StructuredLogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      service: this.config.serviceName,
      environment: this.config.environment,
      pid: process.pid,
      message: stringifyMessage(message),
      ...(options.context ? { context: options.context } : {}),
      ...(options.requestId ? { requestId: options.requestId } : {}),
      ...(options.metadata
        ? { metadata: sanitizeForLog(options.metadata) }
        : {}),
      ...(this.config.includeErrorStack && options.trace
        ? { trace: options.trace }
        : {}),
    };
  }

  private resolveLogOptions(
    level: AppLogSeverity,
    optionalParams: readonly unknown[],
  ): AppLogOptions {
    let context: string | undefined;
    let requestId: string | undefined;
    let trace: string | undefined;
    let metadata: Record<string, unknown> | undefined;

    for (const optionalParam of optionalParams) {
      if (isAppLogOptions(optionalParam)) {
        context = optionalParam.context ?? context;
        requestId = optionalParam.requestId ?? requestId;
        trace = optionalParam.trace ?? trace;

        if (optionalParam.metadata) {
          metadata = mergeMetadata(metadata, optionalParam.metadata);
        }

        continue;
      }

      if (optionalParam instanceof Error) {
        trace = optionalParam.stack ?? trace;
        metadata = mergeMetadata(metadata, {
          error: {
            name: optionalParam.name,
            message: optionalParam.message,
          },
        });

        continue;
      }

      if (typeof optionalParam === 'string') {
        if ((level === 'error' || level === 'fatal') && !trace) {
          trace = optionalParam;
        } else {
          context = optionalParam;
        }

        continue;
      }

      if (isRecord(optionalParam)) {
        metadata = mergeMetadata(metadata, optionalParam);
        continue;
      }

      if (typeof optionalParam !== 'undefined') {
        metadata = mergeMetadata(metadata, {
          optionalParam,
        });
      }
    }

    return {
      ...(context ? { context } : {}),
      ...(requestId ? { requestId } : {}),
      ...(metadata ? { metadata } : {}),
      ...(trace ? { trace } : {}),
    };
  }
}
