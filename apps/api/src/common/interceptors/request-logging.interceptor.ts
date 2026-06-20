// apps/api/src/common/interceptors/request-logging.interceptor.ts
/**
 * LAFAM API request logging interceptor.
 *
 * Role:
 * - Logs inbound HTTP request completion and failure.
 * - Measures request duration.
 * - Adds/propagates a request id for traceability.
 * - Keeps request logs structured through AppLoggerService.
 *
 * Important:
 * - Do not log request bodies.
 * - Do not log authorization headers, cookies, passwords, tokens, or secrets.
 * - This interceptor logs safe request metadata only.
 */

import { randomUUID } from 'node:crypto';

import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, catchError, tap, throwError } from 'rxjs';

import { currentLoggingConfig } from '../config/logging.config';
import { AppLoggerService } from '../logging/app-logger.service';

interface SafeRequestMetadata {
  readonly method: string;
  readonly path: string;
  readonly statusCode?: number;
  readonly durationMs?: number;
  readonly userAgent?: string;
  readonly ip?: string;
  readonly queryKeys?: readonly string[];
}
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;
function resolveHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    const firstValue = value.find((item) => item.trim().length > 0);
    return firstValue?.trim();
  }

  return undefined;
}

function resolveRequestId(request: Request): string {
  const incomingRequestId = resolveHeaderValue(request.headers['x-request-id']);

  return incomingRequestId ?? randomUUID();
}

function resolveRequestPath(request: Request): string {
  return request.originalUrl || request.url;
}

function resolveClientIp(request: Request): string | undefined {
  const forwardedFor = resolveHeaderValue(request.headers['x-forwarded-for']);

  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim();
  }

  return request.ip;
}

function resolveQueryKeys(request: Request): readonly string[] | undefined {
  const queryKeys = Object.keys(request.query);

  return queryKeys.length > 0 ? queryKeys.sort() : undefined;
}

function createRequestMetadata(
  request: Request,
  response?: Response,
  durationMs?: number,
  statusCodeOverride?: number,
): SafeRequestMetadata {
  const resolvedStatusCode =
    typeof statusCodeOverride === 'number'
      ? statusCodeOverride
      : response?.statusCode;

  return {
    method: request.method,
    path: resolveRequestPath(request),
    ...(typeof resolvedStatusCode === 'number'
      ? { statusCode: resolvedStatusCode }
      : {}),
    ...(typeof durationMs === 'number' ? { durationMs } : {}),
    ...(request.headers['user-agent']
      ? { userAgent: String(request.headers['user-agent']) }
      : {}),
    ...(resolveClientIp(request) ? { ip: resolveClientIp(request) } : {}),
    ...(resolveQueryKeys(request)
      ? { queryKeys: resolveQueryKeys(request) }
      : {}),
  };
}
function resolveFailureStatusCode(error: unknown, response: Response): number {
  if (error instanceof HttpException) {
    return error.getStatus();
  }

  if (response.statusCode >= 400) {
    return response.statusCode;
  }

  return HTTP_STATUS_INTERNAL_SERVER_ERROR;
}
function isSlowRequest(durationMs: number): boolean {
  return durationMs >= currentLoggingConfig.slowRequestThresholdMs;
}

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!currentLoggingConfig.includeRequestLogs) {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();
    const requestId = resolveRequestId(request);
    const startedAt = Date.now();

    response.setHeader('x-request-id', requestId);

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - startedAt;
        const metadata = createRequestMetadata(request, response, durationMs);

        if (isSlowRequest(durationMs)) {
          this.logger.warn('Slow HTTP request completed.', {
            context: RequestLoggingInterceptor.name,
            requestId,
            metadata,
          });

          return;
        }

        this.logger.log('HTTP request completed.', {
          context: RequestLoggingInterceptor.name,
          requestId,
          metadata,
        });
      }),
      catchError((error: unknown) => {
        const durationMs = Date.now() - startedAt;
        const failureStatusCode = resolveFailureStatusCode(error, response);
        const metadata = {
          ...createRequestMetadata(
            request,
            response,
            durationMs,
            failureStatusCode,
          ),
          error:
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                }
              : String(error),
        };

        this.logger.error('HTTP request failed.', {
          context: RequestLoggingInterceptor.name,
          requestId,
          metadata,
          trace: error instanceof Error ? error.stack : undefined,
        });

        return throwError(() => error);
      }),
    );
  }
}
