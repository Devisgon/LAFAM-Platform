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
  | 'INTERNAL_ERROR'
  | 'EMAIL_ALREADY_REGISTERED'
  | 'EMAIL_NOT_VERIFIED'
  | 'VERIFICATION_OTP_INVALID'
  | 'VERIFICATION_OTP_EXPIRED'
  | 'RESET_OTP_INVALID'
  | 'RESET_OTP_EXPIRED'
  | 'RESET_TOKEN_INVALID'
  | 'RESET_TOKEN_EXPIRED'
  | 'PASSWORD_POLICY_FAILED'
  | 'PASSWORD_CONFIRMATION_MISMATCH'
  | 'ACCOUNT_DEACTIVATED'
  | 'ACCOUNT_DELETED'
  | 'SESSION_REVOKED'
  | 'SESSION_NOT_FOUND'
  | 'USER_NOT_FOUND'
  | 'USER_ALREADY_DEACTIVATED'
  | 'USER_ALREADY_ACTIVE'
  | 'CANNOT_DELETE_SELF'
  | 'SUPER_ADMIN_REQUIRED'
  | 'ADMIN_ACCESS_REQUIRED'
  | 'AVATAR_INVALID_FILE_TYPE'
  | 'AVATAR_FILE_TOO_LARGE'
  | 'AVATAR_UPLOAD_FAILED'
  | 'GUEST_SESSION_REQUIRED'
  | 'GUEST_SESSION_EXPIRED'
  | 'GUEST_SESSION_REVOKED'
  | 'GUEST_CONVERSION_REQUIRED'
  | 'GUEST_CONVERSION_FAILED'
  | 'GUEST_ALREADY_CONVERTED'
  | 'GUEST_CANNOT_ACCESS_RESOURCE'
  | 'GUEST_CANNOT_CREATE_BOOKING'
  | 'GUEST_CANNOT_ACCESS_BOOKING_HISTORY'
  | 'GUEST_RATE_LIMITED'
  | 'STAFF_EMAIL_ALREADY_EXISTS'
  | 'STAFF_NOT_FOUND'
  | 'STAFF_ROLE_NOT_ALLOWED'
  | 'STAFF_PASSWORD_INVALID'
  | 'STAFF_AVAILABILITY_INVALID'
  | 'STAFF_AUTH_USER_CREATION_FAILED'
  | 'STAFF_PROFILE_CREATION_FAILED'
  | 'STAFF_DELETE_BLOCKED'
  | 'STAFF_ALREADY_DEACTIVATED'
  | 'STAFF_ALREADY_ACTIVE'
  | 'STAFF_ALREADY_DELETED'
  | 'STAFF_EMPTY_UPDATE';

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

  static emailAlreadyRegistered(
    publicMessage = 'An account with this email already exists.',
    details?: AppErrorDetails,
  ): AppError {
    return new AppError({
      code: 'EMAIL_ALREADY_REGISTERED',
      category: 'conflict',
      statusCode: HttpStatus.CONFLICT,
      publicMessage,
      details,
      exposeDetails: true,
    });
  }

  static emailNotVerified(
    publicMessage = 'Please verify your email before continuing.',
  ): AppError {
    return new AppError({
      code: 'EMAIL_NOT_VERIFIED',
      category: 'authorization',
      statusCode: HttpStatus.FORBIDDEN,
      publicMessage,
    });
  }

  static verificationOtpInvalid(
    publicMessage = 'The verification code is invalid.',
  ): AppError {
    return new AppError({
      code: 'VERIFICATION_OTP_INVALID',
      category: 'validation',
      statusCode: HttpStatus.BAD_REQUEST,
      publicMessage,
    });
  }

  static verificationOtpExpired(
    publicMessage = 'The verification code has expired.',
  ): AppError {
    return new AppError({
      code: 'VERIFICATION_OTP_EXPIRED',
      category: 'validation',
      statusCode: HttpStatus.BAD_REQUEST,
      publicMessage,
    });
  }

  static resetOtpInvalid(
    publicMessage = 'The password reset code is invalid.',
  ): AppError {
    return new AppError({
      code: 'RESET_OTP_INVALID',
      category: 'validation',
      statusCode: HttpStatus.BAD_REQUEST,
      publicMessage,
    });
  }

  static resetOtpExpired(
    publicMessage = 'The password reset code has expired.',
  ): AppError {
    return new AppError({
      code: 'RESET_OTP_EXPIRED',
      category: 'validation',
      statusCode: HttpStatus.BAD_REQUEST,
      publicMessage,
    });
  }

  static resetTokenInvalid(
    publicMessage = 'The password reset token is invalid.',
  ): AppError {
    return new AppError({
      code: 'RESET_TOKEN_INVALID',
      category: 'validation',
      statusCode: HttpStatus.BAD_REQUEST,
      publicMessage,
    });
  }

  static resetTokenExpired(
    publicMessage = 'The password reset token has expired.',
  ): AppError {
    return new AppError({
      code: 'RESET_TOKEN_EXPIRED',
      category: 'validation',
      statusCode: HttpStatus.BAD_REQUEST,
      publicMessage,
    });
  }

  static passwordPolicyFailed(
    publicMessage = 'The password does not meet security requirements.',
    details?: AppErrorDetails,
  ): AppError {
    return new AppError({
      code: 'PASSWORD_POLICY_FAILED',
      category: 'validation',
      statusCode: HttpStatus.BAD_REQUEST,
      publicMessage,
      details,
      exposeDetails: true,
    });
  }

  static passwordConfirmationMismatch(
    publicMessage = 'Password confirmation does not match.',
  ): AppError {
    return new AppError({
      code: 'PASSWORD_CONFIRMATION_MISMATCH',
      category: 'validation',
      statusCode: HttpStatus.BAD_REQUEST,
      publicMessage,
    });
  }

  static accountDeactivated(
    publicMessage = 'This account has been deactivated.',
  ): AppError {
    return new AppError({
      code: 'ACCOUNT_DEACTIVATED',
      category: 'authorization',
      statusCode: HttpStatus.FORBIDDEN,
      publicMessage,
    });
  }

  static accountDeleted(
    publicMessage = 'This account has been deleted.',
  ): AppError {
    return new AppError({
      code: 'ACCOUNT_DELETED',
      category: 'authorization',
      statusCode: HttpStatus.FORBIDDEN,
      publicMessage,
    });
  }

  static sessionRevoked(
    publicMessage = 'The session has been revoked.',
  ): AppError {
    return new AppError({
      code: 'SESSION_REVOKED',
      category: 'authentication',
      statusCode: HttpStatus.UNAUTHORIZED,
      publicMessage,
    });
  }

  static sessionNotFound(
    publicMessage = 'The requested session was not found.',
    details?: AppErrorDetails,
  ): AppError {
    return new AppError({
      code: 'SESSION_NOT_FOUND',
      category: 'not_found',
      statusCode: HttpStatus.NOT_FOUND,
      publicMessage,
      details,
      exposeDetails: true,
    });
  }

  static userNotFound(
    publicMessage = 'The requested user was not found.',
    details?: AppErrorDetails,
  ): AppError {
    return new AppError({
      code: 'USER_NOT_FOUND',
      category: 'not_found',
      statusCode: HttpStatus.NOT_FOUND,
      publicMessage,
      details,
      exposeDetails: true,
    });
  }

  static userAlreadyDeactivated(
    publicMessage = 'This user is already deactivated.',
    details?: AppErrorDetails,
  ): AppError {
    return new AppError({
      code: 'USER_ALREADY_DEACTIVATED',
      category: 'conflict',
      statusCode: HttpStatus.CONFLICT,
      publicMessage,
      details,
      exposeDetails: true,
    });
  }

  static userAlreadyActive(
    publicMessage = 'This user is already active.',
    details?: AppErrorDetails,
  ): AppError {
    return new AppError({
      code: 'USER_ALREADY_ACTIVE',
      category: 'conflict',
      statusCode: HttpStatus.CONFLICT,
      publicMessage,
      details,
      exposeDetails: true,
    });
  }

  static cannotDeleteSelf(
    publicMessage = 'You cannot perform this deletion action on your own account.',
  ): AppError {
    return new AppError({
      code: 'CANNOT_DELETE_SELF',
      category: 'conflict',
      statusCode: HttpStatus.CONFLICT,
      publicMessage,
    });
  }

  static superAdminRequired(
    publicMessage = 'Super admin access is required.',
  ): AppError {
    return new AppError({
      code: 'SUPER_ADMIN_REQUIRED',
      category: 'authorization',
      statusCode: HttpStatus.FORBIDDEN,
      publicMessage,
    });
  }

  static adminAccessRequired(
    publicMessage = 'Admin access is required.',
  ): AppError {
    return new AppError({
      code: 'ADMIN_ACCESS_REQUIRED',
      category: 'authorization',
      statusCode: HttpStatus.FORBIDDEN,
      publicMessage,
    });
  }

  static avatarInvalidFileType(
    publicMessage = 'The avatar file type is not supported.',
    details?: AppErrorDetails,
  ): AppError {
    return new AppError({
      code: 'AVATAR_INVALID_FILE_TYPE',
      category: 'validation',
      statusCode: HttpStatus.BAD_REQUEST,
      publicMessage,
      details,
      exposeDetails: true,
    });
  }

  static avatarFileTooLarge(
    publicMessage = 'The avatar file is too large.',
    details?: AppErrorDetails,
  ): AppError {
    return new AppError({
      code: 'AVATAR_FILE_TOO_LARGE',
      category: 'validation',
      statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
      publicMessage,
      details,
      exposeDetails: true,
    });
  }

  static avatarUploadFailed(cause?: unknown): AppError {
    return new AppError({
      code: 'AVATAR_UPLOAD_FAILED',
      category: 'external_provider',
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      publicMessage: 'Avatar upload failed. Please try again later.',
      cause,
    });
  }

  static guestSessionRequired(
    publicMessage = 'A guest session is required for this action.',
  ): AppError {
    return new AppError({
      code: 'GUEST_SESSION_REQUIRED',
      category: 'authentication',
      statusCode: HttpStatus.UNAUTHORIZED,
      publicMessage,
    });
  }

  static guestSessionExpired(
    publicMessage = 'The guest session has expired.',
  ): AppError {
    return new AppError({
      code: 'GUEST_SESSION_EXPIRED',
      category: 'authentication',
      statusCode: HttpStatus.UNAUTHORIZED,
      publicMessage,
    });
  }

  static guestSessionRevoked(
    publicMessage = 'The guest session has been revoked.',
  ): AppError {
    return new AppError({
      code: 'GUEST_SESSION_REVOKED',
      category: 'authentication',
      statusCode: HttpStatus.UNAUTHORIZED,
      publicMessage,
    });
  }

  static guestConversionRequired(
    publicMessage = 'Please create an account to continue.',
  ): AppError {
    return new AppError({
      code: 'GUEST_CONVERSION_REQUIRED',
      category: 'authorization',
      statusCode: HttpStatus.FORBIDDEN,
      publicMessage,
    });
  }

  static guestConversionFailed(cause?: unknown): AppError {
    return new AppError({
      code: 'GUEST_CONVERSION_FAILED',
      category: 'external_provider',
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      publicMessage: 'Guest account conversion failed. Please try again later.',
      cause,
    });
  }

  static guestAlreadyConverted(
    publicMessage = 'This guest session has already been converted.',
  ): AppError {
    return new AppError({
      code: 'GUEST_ALREADY_CONVERTED',
      category: 'conflict',
      statusCode: HttpStatus.CONFLICT,
      publicMessage,
    });
  }

  static guestCannotAccessResource(
    publicMessage = 'Guest users cannot access this resource.',
  ): AppError {
    return new AppError({
      code: 'GUEST_CANNOT_ACCESS_RESOURCE',
      category: 'authorization',
      statusCode: HttpStatus.FORBIDDEN,
      publicMessage,
    });
  }

  static guestCannotCreateBooking(
    publicMessage = 'Guest users cannot create confirmed bookings.',
  ): AppError {
    return new AppError({
      code: 'GUEST_CANNOT_CREATE_BOOKING',
      category: 'authorization',
      statusCode: HttpStatus.FORBIDDEN,
      publicMessage,
    });
  }

  static guestCannotAccessBookingHistory(
    publicMessage = 'Guest users cannot access booking history.',
  ): AppError {
    return new AppError({
      code: 'GUEST_CANNOT_ACCESS_BOOKING_HISTORY',
      category: 'authorization',
      statusCode: HttpStatus.FORBIDDEN,
      publicMessage,
    });
  }

  static guestRateLimited(
    publicMessage = 'Too many guest sessions have been created from this network. Please try again later.',
  ): AppError {
    return new AppError({
      code: 'GUEST_RATE_LIMITED',
      category: 'rate_limit',
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      publicMessage,
    });
  }

  static staffEmailAlreadyExists(
    publicMessage = 'A staff account with this email already exists.',
    details?: AppErrorDetails,
  ): AppError {
    return new AppError({
      code: 'STAFF_EMAIL_ALREADY_EXISTS',
      category: 'conflict',
      statusCode: HttpStatus.CONFLICT,
      publicMessage,
      details,
      exposeDetails: true,
    });
  }

  static staffNotFound(
    publicMessage = 'The requested staff member was not found.',
    details?: AppErrorDetails,
  ): AppError {
    return new AppError({
      code: 'STAFF_NOT_FOUND',
      category: 'not_found',
      statusCode: HttpStatus.NOT_FOUND,
      publicMessage,
      details,
      exposeDetails: true,
    });
  }

  static staffRoleNotAllowed(
    publicMessage = 'This staff role is not allowed for this operation.',
    details?: AppErrorDetails,
  ): AppError {
    return new AppError({
      code: 'STAFF_ROLE_NOT_ALLOWED',
      category: 'authorization',
      statusCode: HttpStatus.FORBIDDEN,
      publicMessage,
      details,
      exposeDetails: true,
    });
  }

  static staffPasswordInvalid(
    publicMessage = 'The staff password is invalid.',
    details?: AppErrorDetails,
  ): AppError {
    return new AppError({
      code: 'STAFF_PASSWORD_INVALID',
      category: 'validation',
      statusCode: HttpStatus.BAD_REQUEST,
      publicMessage,
      details,
      exposeDetails: true,
    });
  }

  static staffAvailabilityInvalid(
    publicMessage = 'The staff availability is invalid.',
    details?: AppErrorDetails,
  ): AppError {
    return new AppError({
      code: 'STAFF_AVAILABILITY_INVALID',
      category: 'validation',
      statusCode: HttpStatus.BAD_REQUEST,
      publicMessage,
      details,
      exposeDetails: true,
    });
  }

  static staffAuthUserCreationFailed(cause?: unknown): AppError {
    return new AppError({
      code: 'STAFF_AUTH_USER_CREATION_FAILED',
      category: 'external_provider',
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      publicMessage:
        'Staff login account creation failed. Please try again later.',
      cause,
    });
  }

  static staffProfileCreationFailed(cause?: unknown): AppError {
    return new AppError({
      code: 'STAFF_PROFILE_CREATION_FAILED',
      category: 'internal',
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      publicMessage: 'Staff profile creation failed. Please try again later.',
      cause,
    });
  }

  static staffDeleteBlocked(
    publicMessage = 'This staff member cannot be deleted because related records still depend on it.',
    details?: AppErrorDetails,
  ): AppError {
    return new AppError({
      code: 'STAFF_DELETE_BLOCKED',
      category: 'conflict',
      statusCode: HttpStatus.CONFLICT,
      publicMessage,
      details,
      exposeDetails: true,
    });
  }

  static staffAlreadyDeactivated(
    publicMessage = 'This staff member is already deactivated.',
    details?: AppErrorDetails,
  ): AppError {
    return new AppError({
      code: 'STAFF_ALREADY_DEACTIVATED',
      category: 'conflict',
      statusCode: HttpStatus.CONFLICT,
      publicMessage,
      details,
      exposeDetails: true,
    });
  }

  static staffAlreadyActive(
    publicMessage = 'This staff member is already active.',
    details?: AppErrorDetails,
  ): AppError {
    return new AppError({
      code: 'STAFF_ALREADY_ACTIVE',
      category: 'conflict',
      statusCode: HttpStatus.CONFLICT,
      publicMessage,
      details,
      exposeDetails: true,
    });
  }

  static staffAlreadyDeleted(
    publicMessage = 'This staff member is already deleted.',
    details?: AppErrorDetails,
  ): AppError {
    return new AppError({
      code: 'STAFF_ALREADY_DELETED',
      category: 'conflict',
      statusCode: HttpStatus.CONFLICT,
      publicMessage,
      details,
      exposeDetails: true,
    });
  }

  static staffEmptyUpdate(
    publicMessage = 'At least one staff field must be provided for update.',
  ): AppError {
    return new AppError({
      code: 'STAFF_EMPTY_UPDATE',
      category: 'validation',
      statusCode: HttpStatus.BAD_REQUEST,
      publicMessage,
    });
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
