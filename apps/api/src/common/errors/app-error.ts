// apps/api/src/common/errors/app-error.ts
/**
 * LAFAM API application error model.
 *
 * Role:
 * - Provides one controlled error type for expected application failures.
 * - Separates public client-safe messages from internal error details.
 * - Gives the global exception filter a stable structure to format API errors.
 *
 * Important:
 * - Throw AppError for known business/application failures.
 * - Do not expose raw provider errors, secrets, tokens, stack traces, or database details.
 * - Unknown programming errors should remain normal Error objects and be handled by the global filter.
 */

import { HttpStatus } from '@nestjs/common';

export type AppErrorCategory =
  | 'validation'
  | 'authentication'
  | 'authorization'
  | 'not_found'
  | 'conflict'
  | 'rate_limit'
  | 'external_provider'
  | 'configuration'
  | 'internal';

export type AppErrorCode =
  | 'VALIDATION_FAILED'
  | 'INVALID_REQUEST'
  | 'AUTHENTICATION_REQUIRED'
  | 'INVALID_CREDENTIALS'
  | 'SESSION_EXPIRED'
  | 'AUTHORIZATION_DENIED'
  | 'RESOURCE_NOT_FOUND'
  | 'RESOURCE_CONFLICT'
  | 'RATE_LIMITED'
  | 'SUPABASE_UNAVAILABLE'
  | 'EMAIL_PROVIDER_UNAVAILABLE'
  | 'CONFIGURATION_INVALID'
  | 'INTERNAL_ERROR';

export type AppErrorDetails = Record<string, unknown>;

export interface AppErrorOptions {
  readonly code: AppErrorCode;
  readonly category: AppErrorCategory;
  readonly statusCode: HttpStatus;
  readonly publicMessage: string;
  readonly details?: AppErrorDetails;
  readonly cause?: unknown;
  readonly exposeDetails?: boolean;
}

export interface SerializedAppError {
  readonly code: AppErrorCode;
  readonly category: AppErrorCategory;
  readonly message: string;
  readonly statusCode: HttpStatus;
  readonly details?: AppErrorDetails;
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly category: AppErrorCategory;
  readonly statusCode: HttpStatus;
  readonly publicMessage: string;
  readonly details?: AppErrorDetails;
  readonly exposeDetails: boolean;
  override readonly cause?: unknown;

  constructor(options: AppErrorOptions) {
    super(options.publicMessage, { cause: options.cause });

    this.name = 'AppError';
    this.code = options.code;
    this.category = options.category;
    this.statusCode = options.statusCode;
    this.publicMessage = options.publicMessage;
    this.details = options.details;
    this.exposeDetails = options.exposeDetails ?? false;
    this.cause = options.cause;

    Error.captureStackTrace?.(this, AppError);
  }

  serialize(): SerializedAppError {
    return {
      code: this.code,
      category: this.category,
      message: this.publicMessage,
      statusCode: this.statusCode,
      ...(this.exposeDetails && this.details ? { details: this.details } : {}),
    };
  }

  static validationFailed(
    publicMessage = 'The submitted request is invalid.',
    details?: AppErrorDetails,
  ): AppError {
    return new AppError({
      code: 'VALIDATION_FAILED',
      category: 'validation',
      statusCode: HttpStatus.BAD_REQUEST,
      publicMessage,
      details,
      exposeDetails: true,
    });
  }

  static invalidRequest(
    publicMessage = 'The request could not be processed.',
    details?: AppErrorDetails,
  ): AppError {
    return new AppError({
      code: 'INVALID_REQUEST',
      category: 'validation',
      statusCode: HttpStatus.BAD_REQUEST,
      publicMessage,
      details,
      exposeDetails: true,
    });
  }

  static authenticationRequired(
    publicMessage = 'Authentication is required.',
  ): AppError {
    return new AppError({
      code: 'AUTHENTICATION_REQUIRED',
      category: 'authentication',
      statusCode: HttpStatus.UNAUTHORIZED,
      publicMessage,
    });
  }

  static invalidCredentials(
    publicMessage = 'The provided credentials are invalid.',
  ): AppError {
    return new AppError({
      code: 'INVALID_CREDENTIALS',
      category: 'authentication',
      statusCode: HttpStatus.UNAUTHORIZED,
      publicMessage,
    });
  }

  static sessionExpired(publicMessage = 'The session has expired.'): AppError {
    return new AppError({
      code: 'SESSION_EXPIRED',
      category: 'authentication',
      statusCode: HttpStatus.UNAUTHORIZED,
      publicMessage,
    });
  }

  static authorizationDenied(
    publicMessage = 'You do not have permission to perform this action.',
  ): AppError {
    return new AppError({
      code: 'AUTHORIZATION_DENIED',
      category: 'authorization',
      statusCode: HttpStatus.FORBIDDEN,
      publicMessage,
    });
  }

  static notFound(
    publicMessage = 'The requested resource was not found.',
    details?: AppErrorDetails,
  ): AppError {
    return new AppError({
      code: 'RESOURCE_NOT_FOUND',
      category: 'not_found',
      statusCode: HttpStatus.NOT_FOUND,
      publicMessage,
      details,
      exposeDetails: true,
    });
  }

  static conflict(
    publicMessage = 'The requested operation conflicts with the current resource state.',
    details?: AppErrorDetails,
  ): AppError {
    return new AppError({
      code: 'RESOURCE_CONFLICT',
      category: 'conflict',
      statusCode: HttpStatus.CONFLICT,
      publicMessage,
      details,
      exposeDetails: true,
    });
  }

  static rateLimited(
    publicMessage = 'Too many requests. Please try again later.',
  ): AppError {
    return new AppError({
      code: 'RATE_LIMITED',
      category: 'rate_limit',
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      publicMessage,
    });
  }

  static supabaseUnavailable(cause?: unknown): AppError {
    return new AppError({
      code: 'SUPABASE_UNAVAILABLE',
      category: 'external_provider',
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      publicMessage: 'The authentication service is temporarily unavailable.',
      cause,
    });
  }

  static emailProviderUnavailable(cause?: unknown): AppError {
    return new AppError({
      code: 'EMAIL_PROVIDER_UNAVAILABLE',
      category: 'external_provider',
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      publicMessage: 'The email service is temporarily unavailable.',
      cause,
    });
  }

  static configurationInvalid(
    publicMessage = 'The server configuration is invalid.',
    cause?: unknown,
  ): AppError {
    return new AppError({
      code: 'CONFIGURATION_INVALID',
      category: 'configuration',
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      publicMessage,
      cause,
    });
  }

  static internal(cause?: unknown): AppError {
    return new AppError({
      code: 'INTERNAL_ERROR',
      category: 'internal',
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      publicMessage: 'An unexpected server error occurred.',
      cause,
    });
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
