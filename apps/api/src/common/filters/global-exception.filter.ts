// apps/api/src/common/filters/global-exception.filter.ts
/**
 * LAFAM API global exception filter.
 *
 * Role:
 * - Converts thrown errors into consistent API error responses.
 * - Logs server-side error details without leaking sensitive internals to clients.
 * - Handles AppError, Nest HttpException, and unknown runtime errors.
 *
 * Important:
 * - Public API responses must stay safe and predictable.
 * - Raw provider errors, stack traces, tokens, secrets, and database details must not be returned.
 * - Provider diagnostics are logged only after safe field selection.
 * - AppError is the preferred error type for expected application failures.
 */

import {
  ArgumentsHost,
  Catch,
  HttpException,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { AppError, isAppError, type AppErrorCode } from '../errors/app-error';
import { AppLoggerService } from '../logging/app-logger.service';

interface ErrorResponseBody {
  readonly success: false;
  readonly error: {
    readonly code: AppErrorCode;
    readonly message: string;
    readonly statusCode: number;
    readonly path: string;
    readonly method: string;
    readonly timestamp: string;
    readonly requestId?: string;
    readonly details?: unknown;
  };
}

interface HttpExceptionResponseObject {
  readonly message?: unknown;
  readonly error?: unknown;
  readonly statusCode?: unknown;
}

interface SafeErrorSummary {
  readonly name?: string;
  readonly message?: string;
  readonly code?: string | number;
  readonly status?: string | number;
  readonly statusCode?: string | number;
  readonly type?: string;
  readonly reason?: string;
  readonly details?: string;
  readonly hint?: string;
}

const HTTP_STATUS = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

const MAX_CAUSE_CHAIN_DEPTH = 5;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHttpExceptionResponseObject(
  value: unknown,
): value is HttpExceptionResponseObject {
  return isRecord(value);
}

function resolveRequestId(request: Request): string | undefined {
  const headerValue = request.headers['x-request-id'];

  if (typeof headerValue === 'string' && headerValue.trim().length > 0) {
    return headerValue;
  }

  if (Array.isArray(headerValue) && headerValue[0]?.trim()) {
    return headerValue[0];
  }

  return undefined;
}

function resolveHttpExceptionCode(statusCode: number): AppErrorCode {
  switch (statusCode) {
    case HTTP_STATUS.BAD_REQUEST:
      return 'VALIDATION_FAILED';
    case HTTP_STATUS.UNAUTHORIZED:
      return 'AUTHENTICATION_REQUIRED';
    case HTTP_STATUS.FORBIDDEN:
      return 'AUTHORIZATION_DENIED';
    case HTTP_STATUS.NOT_FOUND:
      return 'RESOURCE_NOT_FOUND';
    case HTTP_STATUS.CONFLICT:
      return 'RESOURCE_CONFLICT';
    case HTTP_STATUS.TOO_MANY_REQUESTS:
      return 'RATE_LIMITED';
    default:
      return statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR
        ? 'INTERNAL_ERROR'
        : 'INVALID_REQUEST';
  }
}

function resolveHttpExceptionMessage(
  statusCode: number,
  exceptionResponse: string | object,
): string {
  if (typeof exceptionResponse === 'string') {
    return exceptionResponse;
  }

  if (isHttpExceptionResponseObject(exceptionResponse)) {
    const { message } = exceptionResponse;

    if (typeof message === 'string') {
      return message;
    }

    if (Array.isArray(message)) {
      return 'The submitted request is invalid.';
    }
  }

  if (statusCode >= 500) {
    return 'An unexpected server error occurred.';
  }

  return 'The request could not be processed.';
}

function resolveHttpExceptionDetails(
  statusCode: number,
  exceptionResponse: string | object,
): unknown {
  if (statusCode !== HTTP_STATUS.BAD_REQUEST) {
    return undefined;
  }

  if (!isHttpExceptionResponseObject(exceptionResponse)) {
    return undefined;
  }

  const { message } = exceptionResponse;

  if (Array.isArray(message)) {
    return {
      validationErrors: message,
    };
  }

  return undefined;
}

function readStringField(
  source: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = source[key];

  return typeof value === 'string' && value.trim().length > 0
    ? value
    : undefined;
}

function readStringOrNumberField(
  source: Record<string, unknown>,
  key: string,
): string | number | undefined {
  const value = source[key];

  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  if (typeof value === 'number') {
    return value;
  }

  return undefined;
}

function resolveErrorCause(error: unknown): unknown {
  if (!isRecord(error)) {
    return undefined;
  }

  return error.cause;
}

function summarizeSafeError(error: unknown): SafeErrorSummary {
  if (error instanceof Error) {
    const recordError = isRecord(error) ? error : {};

    return {
      name: error.name,
      message: error.message,
      ...(readStringOrNumberField(recordError, 'code')
        ? { code: readStringOrNumberField(recordError, 'code') }
        : {}),
      ...(readStringOrNumberField(recordError, 'status')
        ? { status: readStringOrNumberField(recordError, 'status') }
        : {}),
      ...(readStringOrNumberField(recordError, 'statusCode')
        ? { statusCode: readStringOrNumberField(recordError, 'statusCode') }
        : {}),
      ...(readStringField(recordError, 'type')
        ? { type: readStringField(recordError, 'type') }
        : {}),
      ...(readStringField(recordError, 'reason')
        ? { reason: readStringField(recordError, 'reason') }
        : {}),
      ...(readStringField(recordError, 'details')
        ? { details: readStringField(recordError, 'details') }
        : {}),
      ...(readStringField(recordError, 'hint')
        ? { hint: readStringField(recordError, 'hint') }
        : {}),
    };
  }

  if (isRecord(error)) {
    return {
      ...(readStringField(error, 'name')
        ? { name: readStringField(error, 'name') }
        : {}),
      ...(readStringField(error, 'message')
        ? { message: readStringField(error, 'message') }
        : {}),
      ...(readStringOrNumberField(error, 'code')
        ? { code: readStringOrNumberField(error, 'code') }
        : {}),
      ...(readStringOrNumberField(error, 'status')
        ? { status: readStringOrNumberField(error, 'status') }
        : {}),
      ...(readStringOrNumberField(error, 'statusCode')
        ? { statusCode: readStringOrNumberField(error, 'statusCode') }
        : {}),
      ...(readStringField(error, 'type')
        ? { type: readStringField(error, 'type') }
        : {}),
      ...(readStringField(error, 'reason')
        ? { reason: readStringField(error, 'reason') }
        : {}),
      ...(readStringField(error, 'details')
        ? { details: readStringField(error, 'details') }
        : {}),
      ...(readStringField(error, 'hint')
        ? { hint: readStringField(error, 'hint') }
        : {}),
    };
  }

  return {
    message: String(error),
  };
}

function createCauseChain(error: unknown): readonly SafeErrorSummary[] {
  const chain: SafeErrorSummary[] = [];
  const seen = new WeakSet<object>();

  let currentCause = resolveErrorCause(error);
  let depth = 0;

  while (typeof currentCause !== 'undefined' && depth < MAX_CAUSE_CHAIN_DEPTH) {
    if (typeof currentCause === 'object' && currentCause !== null) {
      if (seen.has(currentCause)) {
        chain.push({
          message: '[Circular cause]',
        });
        break;
      }

      seen.add(currentCause);
    }

    chain.push(summarizeSafeError(currentCause));

    currentCause = resolveErrorCause(currentCause);
    depth += 1;
  }

  return chain;
}

function createErrorResponseBody(params: {
  code: AppErrorCode;
  message: string;
  statusCode: number;
  request: Request;
  timestamp: string;
  requestId?: string;
  details?: unknown;
}): ErrorResponseBody {
  return {
    success: false,
    error: {
      code: params.code,
      message: params.message,
      statusCode: params.statusCode,
      path: params.request.originalUrl || params.request.url,
      method: params.request.method,
      timestamp: params.timestamp,
      ...(params.requestId ? { requestId: params.requestId } : {}),
      ...(typeof params.details !== 'undefined'
        ? { details: params.details }
        : {}),
    },
  };
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const httpContext = host.switchToHttp();
    const response = httpContext.getResponse<Response>();
    const request = httpContext.getRequest<Request>();
    const timestamp = new Date().toISOString();
    const requestId = resolveRequestId(request);

    if (isAppError(exception)) {
      this.handleAppError(exception, request, response, timestamp, requestId);
      return;
    }

    if (exception instanceof HttpException) {
      this.handleHttpException(
        exception,
        request,
        response,
        timestamp,
        requestId,
      );
      return;
    }

    this.handleUnknownError(exception, request, response, timestamp, requestId);
  }

  private handleAppError(
    exception: AppError,
    request: Request,
    response: Response,
    timestamp: string,
    requestId: string | undefined,
  ): void {
    const serializedError = exception.serialize();

    this.logHandledException(
      exception.statusCode,
      exception,
      request,
      requestId,
    );

    response.status(exception.statusCode).json(
      createErrorResponseBody({
        code: serializedError.code,
        message: serializedError.message,
        statusCode: serializedError.statusCode,
        request,
        timestamp,
        requestId,
        details: serializedError.details,
      }),
    );
  }

  private handleHttpException(
    exception: HttpException,
    request: Request,
    response: Response,
    timestamp: string,
    requestId: string | undefined,
  ): void {
    const statusCode = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    const code = resolveHttpExceptionCode(statusCode);
    const message = resolveHttpExceptionMessage(statusCode, exceptionResponse);
    const details = resolveHttpExceptionDetails(statusCode, exceptionResponse);

    this.logHandledException(statusCode, exception, request, requestId);

    response.status(statusCode).json(
      createErrorResponseBody({
        code,
        message,
        statusCode,
        request,
        timestamp,
        requestId,
        details,
      }),
    );
  }

  private handleUnknownError(
    exception: unknown,
    request: Request,
    response: Response,
    timestamp: string,
    requestId: string | undefined,
  ): void {
    const statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;

    this.logger.error('Unhandled application error.', {
      context: GlobalExceptionFilter.name,
      requestId,
      metadata: {
        statusCode,
        method: request.method,
        path: request.originalUrl || request.url,
        failure: summarizeSafeError(exception),
        causeChain: createCauseChain(exception),
      },
      trace: exception instanceof Error ? exception.stack : undefined,
    });

    response.status(statusCode).json(
      createErrorResponseBody({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected server error occurred.',
        statusCode,
        request,
        timestamp,
        requestId,
      }),
    );
  }

  private logHandledException(
    statusCode: number,
    exception: Error,
    request: Request,
    requestId: string | undefined,
  ): void {
    const metadata = {
      statusCode,
      method: request.method,
      path: request.originalUrl || request.url,
      failure: this.createHandledFailureMetadata(exception),
    };

    if (statusCode >= 500) {
      this.logger.error('HTTP exception handled.', {
        context: GlobalExceptionFilter.name,
        requestId,
        metadata,
        trace: exception.stack,
      });
      return;
    }

    this.logger.warn('HTTP exception handled.', {
      context: GlobalExceptionFilter.name,
      requestId,
      metadata,
    });
  }

  private createHandledFailureMetadata(
    exception: Error,
  ): Record<string, unknown> {
    if (isAppError(exception)) {
      return {
        name: exception.name,
        message: exception.message,
        appCode: exception.code,
        category: exception.category,
        statusCode: exception.statusCode,
        publicMessage: exception.publicMessage,
        exposedDetails: exception.exposeDetails,
        ...(exception.details ? { details: exception.details } : {}),
        causeChain: createCauseChain(exception),
      };
    }

    if (exception instanceof HttpException) {
      return {
        name: exception.name,
        message: exception.message,
        statusCode: exception.getStatus(),
        response: summarizeSafeError(exception.getResponse()),
        causeChain: createCauseChain(exception),
      };
    }

    return {
      ...summarizeSafeError(exception),
      causeChain: createCauseChain(exception),
    };
  }
}
