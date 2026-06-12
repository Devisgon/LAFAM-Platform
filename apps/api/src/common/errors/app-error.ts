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
  | 'STAFF_EMPTY_UPDATE'
  | 'PILATES_CLASS_NOT_FOUND'
  | 'PILATES_CLASS_ALREADY_DELETED'
  | 'PILATES_CLASS_EMPTY_UPDATE'
  | 'PILATES_CLASS_INVALID_STATUS'
  | 'PILATES_CLASS_TITLE_ALREADY_EXISTS'
  | 'PILATES_CLASS_DELETE_BLOCKED'
  | 'PILATES_SCHEDULE_NOT_FOUND'
  | 'PILATES_SCHEDULE_INVALID_TIME'
  | 'PILATES_SCHEDULE_DATE_IN_PAST'
  | 'PILATES_SCHEDULE_CONFLICT'
  | 'PILATES_SCHEDULE_ALREADY_CANCELLED'
  | 'PILATES_SCHEDULE_ALREADY_DELETED'
  | 'PILATES_SCHEDULE_ALREADY_COMPLETED'
  | 'PILATES_SCHEDULE_EMPTY_UPDATE'
  | 'PILATES_TRAINER_REQUIRED'
  | 'PILATES_TRAINER_NOT_FOUND'
  | 'PILATES_TRAINER_INACTIVE'
  | 'PILATES_TRAINER_NOT_AVAILABLE'
  | 'PILATES_CAPACITY_INVALID'
  | 'PILATES_DURATION_INVALID'
  | 'PILATES_CLASS_IMAGE_REQUIRED'
  | 'PILATES_CLASS_IMAGE_INVALID_FILE_TYPE'
  | 'PILATES_CLASS_IMAGE_FILE_TOO_LARGE'
  | 'PILATES_CLASS_IMAGE_UPLOAD_FAILED'
  | 'PILATES_CLASS_IMAGE_DELETE_FAILED'
  | 'BOOKING_SCHEDULE_NOT_FOUND'
  | 'BOOKING_CLASS_NOT_ACTIVE'
  | 'BOOKING_SCHEDULE_NOT_BOOKABLE'
  | 'BOOKING_SCHEDULE_IN_PAST'
  | 'BOOKING_DUPLICATE_ACTIVE_BOOKING'
  | 'BOOKING_DUPLICATE_WAITLIST_ENTRY'
  | 'BOOKING_CAPACITY_FULL'
  | 'BOOKING_NOT_FOUND'
  | 'BOOKING_ACCESS_DENIED'
  | 'BOOKING_ALREADY_CANCELLED'
  | 'BOOKING_ALREADY_COMPLETED'
  | 'BOOKING_INVALID_STATUS_TRANSITION'
  | 'BOOKING_PAYMENT_REQUIRED'
  | 'BOOKING_WAITLIST_NOT_FOUND'
  | 'BOOKING_WAITLIST_PROMOTION_FAILED'
  | 'BOOKING_CONFLICT_RETRY_REQUIRED'
  | 'BOOKING_DATABASE_TRANSACTION_FAILED';

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

  private static createValidationError(
    code: AppErrorCode,
    publicMessage: string,
    details?: AppErrorDetails,
  ): AppError {
    return new AppError({
      code,
      category: 'validation',
      statusCode: HttpStatus.BAD_REQUEST,
      publicMessage,
      details,
      exposeDetails: true,
    });
  }

  private static createAuthenticationError(
    code: AppErrorCode,
    publicMessage: string,
  ): AppError {
    return new AppError({
      code,
      category: 'authentication',
      statusCode: HttpStatus.UNAUTHORIZED,
      publicMessage,
    });
  }

  private static createAuthorizationError(
    code: AppErrorCode,
    publicMessage: string,
    details?: AppErrorDetails,
  ): AppError {
    return new AppError({
      code,
      category: 'authorization',
      statusCode: HttpStatus.FORBIDDEN,
      publicMessage,
      details,
      exposeDetails: typeof details !== 'undefined',
    });
  }

  private static createNotFoundError(
    code: AppErrorCode,
    publicMessage: string,
    details?: AppErrorDetails,
  ): AppError {
    return new AppError({
      code,
      category: 'not_found',
      statusCode: HttpStatus.NOT_FOUND,
      publicMessage,
      details,
      exposeDetails: true,
    });
  }

  private static createConflictError(
    code: AppErrorCode,
    publicMessage: string,
    details?: AppErrorDetails,
  ): AppError {
    return new AppError({
      code,
      category: 'conflict',
      statusCode: HttpStatus.CONFLICT,
      publicMessage,
      details,
      exposeDetails: true,
    });
  }

  private static createExternalProviderError(
    code: AppErrorCode,
    publicMessage: string,
    cause?: unknown,
  ): AppError {
    return new AppError({
      code,
      category: 'external_provider',
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      publicMessage,
      cause,
    });
  }

  static validationFailed(
    publicMessage = 'The submitted request is invalid.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createValidationError(
      'VALIDATION_FAILED',
      publicMessage,
      details,
    );
  }

  static invalidRequest(
    publicMessage = 'The request could not be processed.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createValidationError(
      'INVALID_REQUEST',
      publicMessage,
      details,
    );
  }

  static authenticationRequired(
    publicMessage = 'Authentication is required.',
  ): AppError {
    return AppError.createAuthenticationError(
      'AUTHENTICATION_REQUIRED',
      publicMessage,
    );
  }

  static invalidCredentials(
    publicMessage = 'The provided credentials are invalid.',
  ): AppError {
    return AppError.createAuthenticationError(
      'INVALID_CREDENTIALS',
      publicMessage,
    );
  }

  static sessionExpired(publicMessage = 'The session has expired.'): AppError {
    return AppError.createAuthenticationError('SESSION_EXPIRED', publicMessage);
  }

  static authorizationDenied(
    publicMessage = 'You do not have permission to perform this action.',
  ): AppError {
    return AppError.createAuthorizationError(
      'AUTHORIZATION_DENIED',
      publicMessage,
    );
  }

  static notFound(
    publicMessage = 'The requested resource was not found.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createNotFoundError(
      'RESOURCE_NOT_FOUND',
      publicMessage,
      details,
    );
  }

  static conflict(
    publicMessage = 'The requested operation conflicts with the current resource state.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createConflictError(
      'RESOURCE_CONFLICT',
      publicMessage,
      details,
    );
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
    return AppError.createExternalProviderError(
      'SUPABASE_UNAVAILABLE',
      'The authentication service is temporarily unavailable.',
      cause,
    );
  }

  static emailProviderUnavailable(cause?: unknown): AppError {
    return AppError.createExternalProviderError(
      'EMAIL_PROVIDER_UNAVAILABLE',
      'The email service is temporarily unavailable.',
      cause,
    );
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
    return AppError.createConflictError(
      'EMAIL_ALREADY_REGISTERED',
      publicMessage,
      details,
    );
  }

  static emailNotVerified(
    publicMessage = 'Please verify your email before continuing.',
  ): AppError {
    return AppError.createAuthorizationError(
      'EMAIL_NOT_VERIFIED',
      publicMessage,
    );
  }

  static verificationOtpInvalid(
    publicMessage = 'The verification code is invalid.',
  ): AppError {
    return AppError.createValidationError(
      'VERIFICATION_OTP_INVALID',
      publicMessage,
    );
  }

  static verificationOtpExpired(
    publicMessage = 'The verification code has expired.',
  ): AppError {
    return AppError.createValidationError(
      'VERIFICATION_OTP_EXPIRED',
      publicMessage,
    );
  }

  static resetOtpInvalid(
    publicMessage = 'The password reset code is invalid.',
  ): AppError {
    return AppError.createValidationError('RESET_OTP_INVALID', publicMessage);
  }

  static resetOtpExpired(
    publicMessage = 'The password reset code has expired.',
  ): AppError {
    return AppError.createValidationError('RESET_OTP_EXPIRED', publicMessage);
  }

  static resetTokenInvalid(
    publicMessage = 'The password reset token is invalid.',
  ): AppError {
    return AppError.createValidationError('RESET_TOKEN_INVALID', publicMessage);
  }

  static resetTokenExpired(
    publicMessage = 'The password reset token has expired.',
  ): AppError {
    return AppError.createValidationError('RESET_TOKEN_EXPIRED', publicMessage);
  }

  static passwordPolicyFailed(
    publicMessage = 'The password does not meet security requirements.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createValidationError(
      'PASSWORD_POLICY_FAILED',
      publicMessage,
      details,
    );
  }

  static passwordConfirmationMismatch(
    publicMessage = 'Password confirmation does not match.',
  ): AppError {
    return AppError.createValidationError(
      'PASSWORD_CONFIRMATION_MISMATCH',
      publicMessage,
    );
  }

  static accountDeactivated(
    publicMessage = 'This account has been deactivated.',
  ): AppError {
    return AppError.createAuthorizationError(
      'ACCOUNT_DEACTIVATED',
      publicMessage,
    );
  }

  static accountDeleted(
    publicMessage = 'This account has been deleted.',
  ): AppError {
    return AppError.createAuthorizationError('ACCOUNT_DELETED', publicMessage);
  }

  static sessionRevoked(
    publicMessage = 'The session has been revoked.',
  ): AppError {
    return AppError.createAuthenticationError('SESSION_REVOKED', publicMessage);
  }

  static sessionNotFound(
    publicMessage = 'The requested session was not found.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createNotFoundError(
      'SESSION_NOT_FOUND',
      publicMessage,
      details,
    );
  }

  static userNotFound(
    publicMessage = 'The requested user was not found.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createNotFoundError(
      'USER_NOT_FOUND',
      publicMessage,
      details,
    );
  }

  static userAlreadyDeactivated(
    publicMessage = 'This user is already deactivated.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createConflictError(
      'USER_ALREADY_DEACTIVATED',
      publicMessage,
      details,
    );
  }

  static userAlreadyActive(
    publicMessage = 'This user is already active.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createConflictError(
      'USER_ALREADY_ACTIVE',
      publicMessage,
      details,
    );
  }

  static cannotDeleteSelf(
    publicMessage = 'You cannot perform this deletion action on your own account.',
  ): AppError {
    return AppError.createConflictError('CANNOT_DELETE_SELF', publicMessage);
  }

  static superAdminRequired(
    publicMessage = 'Super admin access is required.',
  ): AppError {
    return AppError.createAuthorizationError(
      'SUPER_ADMIN_REQUIRED',
      publicMessage,
    );
  }

  static adminAccessRequired(
    publicMessage = 'Admin access is required.',
  ): AppError {
    return AppError.createAuthorizationError(
      'ADMIN_ACCESS_REQUIRED',
      publicMessage,
    );
  }

  static avatarInvalidFileType(
    publicMessage = 'The avatar file type is not supported.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createValidationError(
      'AVATAR_INVALID_FILE_TYPE',
      publicMessage,
      details,
    );
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
    return AppError.createExternalProviderError(
      'AVATAR_UPLOAD_FAILED',
      'Avatar upload failed. Please try again later.',
      cause,
    );
  }

  static guestSessionRequired(
    publicMessage = 'A guest session is required for this action.',
  ): AppError {
    return AppError.createAuthenticationError(
      'GUEST_SESSION_REQUIRED',
      publicMessage,
    );
  }

  static guestSessionExpired(
    publicMessage = 'The guest session has expired.',
  ): AppError {
    return AppError.createAuthenticationError(
      'GUEST_SESSION_EXPIRED',
      publicMessage,
    );
  }

  static guestSessionRevoked(
    publicMessage = 'The guest session has been revoked.',
  ): AppError {
    return AppError.createAuthenticationError(
      'GUEST_SESSION_REVOKED',
      publicMessage,
    );
  }

  static guestConversionRequired(
    publicMessage = 'Please create an account to continue.',
  ): AppError {
    return AppError.createAuthorizationError(
      'GUEST_CONVERSION_REQUIRED',
      publicMessage,
    );
  }

  static guestConversionFailed(cause?: unknown): AppError {
    return AppError.createExternalProviderError(
      'GUEST_CONVERSION_FAILED',
      'Guest account conversion failed. Please try again later.',
      cause,
    );
  }

  static guestAlreadyConverted(
    publicMessage = 'This guest session has already been converted.',
  ): AppError {
    return AppError.createConflictError(
      'GUEST_ALREADY_CONVERTED',
      publicMessage,
    );
  }

  static guestCannotAccessResource(
    publicMessage = 'Guest users cannot access this resource.',
  ): AppError {
    return AppError.createAuthorizationError(
      'GUEST_CANNOT_ACCESS_RESOURCE',
      publicMessage,
    );
  }

  static guestCannotCreateBooking(
    publicMessage = 'Guest users cannot create confirmed bookings.',
  ): AppError {
    return AppError.createAuthorizationError(
      'GUEST_CANNOT_CREATE_BOOKING',
      publicMessage,
    );
  }

  static guestCannotAccessBookingHistory(
    publicMessage = 'Guest users cannot access booking history.',
  ): AppError {
    return AppError.createAuthorizationError(
      'GUEST_CANNOT_ACCESS_BOOKING_HISTORY',
      publicMessage,
    );
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
    return AppError.createConflictError(
      'STAFF_EMAIL_ALREADY_EXISTS',
      publicMessage,
      details,
    );
  }

  static staffNotFound(
    publicMessage = 'The requested staff member was not found.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createNotFoundError(
      'STAFF_NOT_FOUND',
      publicMessage,
      details,
    );
  }

  static staffRoleNotAllowed(
    publicMessage = 'This staff role is not allowed for this operation.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createAuthorizationError(
      'STAFF_ROLE_NOT_ALLOWED',
      publicMessage,
      details,
    );
  }

  static staffPasswordInvalid(
    publicMessage = 'The staff password is invalid.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createValidationError(
      'STAFF_PASSWORD_INVALID',
      publicMessage,
      details,
    );
  }

  static staffAvailabilityInvalid(
    publicMessage = 'The staff availability is invalid.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createValidationError(
      'STAFF_AVAILABILITY_INVALID',
      publicMessage,
      details,
    );
  }

  static staffAuthUserCreationFailed(cause?: unknown): AppError {
    return AppError.createExternalProviderError(
      'STAFF_AUTH_USER_CREATION_FAILED',
      'Staff login account creation failed. Please try again later.',
      cause,
    );
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
    return AppError.createConflictError(
      'STAFF_DELETE_BLOCKED',
      publicMessage,
      details,
    );
  }

  static staffAlreadyDeactivated(
    publicMessage = 'This staff member is already deactivated.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createConflictError(
      'STAFF_ALREADY_DEACTIVATED',
      publicMessage,
      details,
    );
  }

  static staffAlreadyActive(
    publicMessage = 'This staff member is already active.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createConflictError(
      'STAFF_ALREADY_ACTIVE',
      publicMessage,
      details,
    );
  }

  static staffAlreadyDeleted(
    publicMessage = 'This staff member is already deleted.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createConflictError(
      'STAFF_ALREADY_DELETED',
      publicMessage,
      details,
    );
  }

  static staffEmptyUpdate(
    publicMessage = 'At least one staff field must be provided for update.',
  ): AppError {
    return AppError.createValidationError('STAFF_EMPTY_UPDATE', publicMessage);
  }

  static pilatesClassNotFound(
    publicMessage = 'The requested Pilates class was not found.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createNotFoundError(
      'PILATES_CLASS_NOT_FOUND',
      publicMessage,
      details,
    );
  }

  static pilatesClassAlreadyDeleted(
    publicMessage = 'This Pilates class is already deleted.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createConflictError(
      'PILATES_CLASS_ALREADY_DELETED',
      publicMessage,
      details,
    );
  }

  static pilatesClassEmptyUpdate(
    publicMessage = 'At least one Pilates class field must be provided for update.',
  ): AppError {
    return AppError.createValidationError(
      'PILATES_CLASS_EMPTY_UPDATE',
      publicMessage,
    );
  }

  static pilatesClassInvalidStatus(
    publicMessage = 'The Pilates class status is invalid for this operation.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createValidationError(
      'PILATES_CLASS_INVALID_STATUS',
      publicMessage,
      details,
    );
  }

  static pilatesClassTitleAlreadyExists(
    publicMessage = 'A Pilates class with this title already exists.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createConflictError(
      'PILATES_CLASS_TITLE_ALREADY_EXISTS',
      publicMessage,
      details,
    );
  }

  static pilatesClassDeleteBlocked(
    publicMessage = 'This Pilates class cannot be deleted because related schedules still depend on it.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createConflictError(
      'PILATES_CLASS_DELETE_BLOCKED',
      publicMessage,
      details,
    );
  }

  static pilatesScheduleNotFound(
    publicMessage = 'The requested Pilates class schedule was not found.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createNotFoundError(
      'PILATES_SCHEDULE_NOT_FOUND',
      publicMessage,
      details,
    );
  }

  static pilatesScheduleInvalidTime(
    publicMessage = 'The Pilates class schedule time is invalid.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createValidationError(
      'PILATES_SCHEDULE_INVALID_TIME',
      publicMessage,
      details,
    );
  }

  static pilatesScheduleDateInPast(
    publicMessage = 'A Pilates class schedule cannot be created in the past.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createValidationError(
      'PILATES_SCHEDULE_DATE_IN_PAST',
      publicMessage,
      details,
    );
  }

  static pilatesScheduleConflict(
    publicMessage = 'The Pilates class schedule conflicts with an existing schedule.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createConflictError(
      'PILATES_SCHEDULE_CONFLICT',
      publicMessage,
      details,
    );
  }

  static pilatesScheduleAlreadyCancelled(
    publicMessage = 'This Pilates class schedule is already cancelled.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createConflictError(
      'PILATES_SCHEDULE_ALREADY_CANCELLED',
      publicMessage,
      details,
    );
  }

  static pilatesScheduleAlreadyDeleted(
    publicMessage = 'This Pilates class schedule is already deleted.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createConflictError(
      'PILATES_SCHEDULE_ALREADY_DELETED',
      publicMessage,
      details,
    );
  }

  static pilatesScheduleAlreadyCompleted(
    publicMessage = 'This Pilates class schedule is already completed.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createConflictError(
      'PILATES_SCHEDULE_ALREADY_COMPLETED',
      publicMessage,
      details,
    );
  }

  static pilatesScheduleEmptyUpdate(
    publicMessage = 'At least one Pilates schedule field must be provided for update.',
  ): AppError {
    return AppError.createValidationError(
      'PILATES_SCHEDULE_EMPTY_UPDATE',
      publicMessage,
    );
  }

  static pilatesTrainerRequired(
    publicMessage = 'A Pilates trainer is required for this schedule.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createValidationError(
      'PILATES_TRAINER_REQUIRED',
      publicMessage,
      details,
    );
  }

  static pilatesTrainerNotFound(
    publicMessage = 'The selected Pilates trainer was not found.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createNotFoundError(
      'PILATES_TRAINER_NOT_FOUND',
      publicMessage,
      details,
    );
  }

  static pilatesTrainerInactive(
    publicMessage = 'The selected Pilates trainer is not active.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createConflictError(
      'PILATES_TRAINER_INACTIVE',
      publicMessage,
      details,
    );
  }

  static pilatesTrainerNotAvailable(
    publicMessage = 'The selected Pilates trainer is not available for this time slot.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createConflictError(
      'PILATES_TRAINER_NOT_AVAILABLE',
      publicMessage,
      details,
    );
  }

  static pilatesCapacityInvalid(
    publicMessage = 'The Pilates class capacity is invalid.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createValidationError(
      'PILATES_CAPACITY_INVALID',
      publicMessage,
      details,
    );
  }

  static pilatesDurationInvalid(
    publicMessage = 'The Pilates class duration is invalid.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createValidationError(
      'PILATES_DURATION_INVALID',
      publicMessage,
      details,
    );
  }
  static pilatesClassImageRequired(
    publicMessage = 'A Pilates class image file is required.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createValidationError(
      'PILATES_CLASS_IMAGE_REQUIRED',
      publicMessage,
      details,
    );
  }

  static pilatesClassImageInvalidFileType(
    publicMessage = 'The Pilates class image file type is not supported.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createValidationError(
      'PILATES_CLASS_IMAGE_INVALID_FILE_TYPE',
      publicMessage,
      details,
    );
  }

  static pilatesClassImageFileTooLarge(
    publicMessage = 'The Pilates class image file is too large.',
    details?: AppErrorDetails,
  ): AppError {
    return new AppError({
      code: 'PILATES_CLASS_IMAGE_FILE_TOO_LARGE',
      category: 'validation',
      statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
      publicMessage,
      details,
      exposeDetails: true,
    });
  }

  static pilatesClassImageUploadFailed(cause?: unknown): AppError {
    return AppError.createExternalProviderError(
      'PILATES_CLASS_IMAGE_UPLOAD_FAILED',
      'Pilates class image upload failed. Please try again later.',
      cause,
    );
  }

  static pilatesClassImageDeleteFailed(cause?: unknown): AppError {
    return AppError.createExternalProviderError(
      'PILATES_CLASS_IMAGE_DELETE_FAILED',
      'Pilates class image deletion failed. Please try again later.',
      cause,
    );
  }

  static bookingScheduleNotFound(
    publicMessage = 'The requested Pilates schedule was not found.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createNotFoundError(
      'BOOKING_SCHEDULE_NOT_FOUND',
      publicMessage,
      details,
    );
  }

  static bookingClassNotActive(
    publicMessage = 'This Pilates class is not active for booking.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createConflictError(
      'BOOKING_CLASS_NOT_ACTIVE',
      publicMessage,
      details,
    );
  }

  static bookingScheduleNotBookable(
    publicMessage = 'This Pilates schedule is not available for booking.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createConflictError(
      'BOOKING_SCHEDULE_NOT_BOOKABLE',
      publicMessage,
      details,
    );
  }

  static bookingScheduleInPast(
    publicMessage = 'Past Pilates schedules cannot be booked.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createValidationError(
      'BOOKING_SCHEDULE_IN_PAST',
      publicMessage,
      details,
    );
  }

  static bookingDuplicateActiveBooking(
    publicMessage = 'You already have an active booking for this schedule.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createConflictError(
      'BOOKING_DUPLICATE_ACTIVE_BOOKING',
      publicMessage,
      details,
    );
  }

  static bookingDuplicateWaitlistEntry(
    publicMessage = 'You already have an active waitlist entry for this schedule.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createConflictError(
      'BOOKING_DUPLICATE_WAITLIST_ENTRY',
      publicMessage,
      details,
    );
  }

  static bookingCapacityFull(
    publicMessage = 'This Pilates schedule is full.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createConflictError(
      'BOOKING_CAPACITY_FULL',
      publicMessage,
      details,
    );
  }

  static bookingNotFound(
    publicMessage = 'The requested booking was not found.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createNotFoundError(
      'BOOKING_NOT_FOUND',
      publicMessage,
      details,
    );
  }

  static bookingAccessDenied(
    publicMessage = 'You are not allowed to access this booking.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createAuthorizationError(
      'BOOKING_ACCESS_DENIED',
      publicMessage,
      details,
    );
  }

  static bookingAlreadyCancelled(
    publicMessage = 'This booking is already cancelled.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createConflictError(
      'BOOKING_ALREADY_CANCELLED',
      publicMessage,
      details,
    );
  }

  static bookingAlreadyCompleted(
    publicMessage = 'This booking is already completed.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createConflictError(
      'BOOKING_ALREADY_COMPLETED',
      publicMessage,
      details,
    );
  }

  static bookingInvalidStatusTransition(
    publicMessage = 'This booking cannot move to the requested status.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createConflictError(
      'BOOKING_INVALID_STATUS_TRANSITION',
      publicMessage,
      details,
    );
  }

  static bookingPaymentRequired(
    publicMessage = 'Payment is required before this booking can be confirmed.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createConflictError(
      'BOOKING_PAYMENT_REQUIRED',
      publicMessage,
      details,
    );
  }

  static bookingWaitlistNotFound(
    publicMessage = 'The requested waitlist entry was not found.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createNotFoundError(
      'BOOKING_WAITLIST_NOT_FOUND',
      publicMessage,
      details,
    );
  }

  static bookingWaitlistPromotionFailed(
    publicMessage = 'Waitlist promotion failed because the schedule state changed.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createConflictError(
      'BOOKING_WAITLIST_PROMOTION_FAILED',
      publicMessage,
      details,
    );
  }

  static bookingConflictRetryRequired(
    publicMessage = 'The booking state changed while processing this request. Please try again.',
    details?: AppErrorDetails,
  ): AppError {
    return AppError.createConflictError(
      'BOOKING_CONFLICT_RETRY_REQUIRED',
      publicMessage,
      details,
    );
  }

  static bookingDatabaseTransactionFailed(cause?: unknown): AppError {
    return new AppError({
      code: 'BOOKING_DATABASE_TRANSACTION_FAILED',
      category: 'internal',
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      publicMessage: 'Booking transaction failed. Please try again later.',
      cause,
    });
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
