// apps/api/src/modules/staff/dto/create-staff.dto.ts
/**
 * LAFAM Staff create DTO.
 *
 * Role:
 * - Validates admin-created staff payloads.
 * - Normalizes safe text fields before service use.
 * - Accepts only approved staff portal roles.
 * - Accepts only business-safe staff profile creation statuses.
 *
 * Important:
 * - This DTO does not create users.
 * - This DTO does not call Supabase.
 * - This DTO does not check duplicate emails.
 * - This DTO does not verify password confirmation.
 * - Password values are not transformed because passwords must not be trimmed or mutated.
 * - The Staff admin service must enforce password match and full password policy.
 */

import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import {
  STAFF_ADDRESS_MAX_LENGTH,
  STAFF_AVAILABILITY_MAX_RULES,
  STAFF_AVAILABILITY_MIN_RULES,
  STAFF_BIO_MAX_LENGTH,
  STAFF_DAY_OF_WEEK_VALUES,
  STAFF_DISPLAY_NAME_MAX_LENGTH,
  STAFF_DISPLAY_NAME_MIN_LENGTH,
  STAFF_EMAIL_MAX_LENGTH,
  STAFF_PASSWORD_MAX_LENGTH,
  STAFF_PASSWORD_MIN_LENGTH,
  STAFF_PHONE_MAX_LENGTH,
  STAFF_PORTAL_ROLES,
  STAFF_POST_TITLE_MAX_LENGTH,
  STAFF_POST_TITLE_MIN_LENGTH,
  STAFF_PROFILE_CREATE_ALLOWED_STATUSES,
  STAFF_PROFILE_STATUS_AVAILABLE,
  STAFF_SPECIALTIES_MAX_COUNT,
  STAFF_SPECIALTY_MAX_LENGTH,
  STAFF_SPECIALTY_MIN_LENGTH,
  STAFF_TIME_VALUE_PATTERN,
  type StaffDayOfWeek,
  type StaffPortalRole,
  type StaffProfileCreateAllowedStatus,
} from '../constants/staff.constants';

function normalizeRequiredText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeOptionalText(value: string): string | null {
  const normalizedValue = normalizeRequiredText(value);

  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string): string | null {
  const normalizedValue = value.trim().replace(/\s+/g, '');

  return normalizedValue.length > 0 ? normalizedValue : null;
}

function transformRequiredText(params: TransformFnParams): unknown {
  return typeof params.value === 'string'
    ? normalizeRequiredText(params.value)
    : params.value;
}

function transformOptionalText(params: TransformFnParams): unknown {
  return typeof params.value === 'string'
    ? normalizeOptionalText(params.value)
    : params.value;
}

function transformEmail(params: TransformFnParams): unknown {
  return typeof params.value === 'string'
    ? normalizeEmail(params.value)
    : params.value;
}

function transformPhone(params: TransformFnParams): unknown {
  return typeof params.value === 'string'
    ? normalizePhone(params.value)
    : params.value;
}

function normalizeSpecialty(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function transformSpecialties(params: TransformFnParams): unknown {
  const rawValue: unknown = params.value;

  if (typeof rawValue === 'string') {
    return rawValue
      .split(',')
      .map((specialty) => normalizeSpecialty(specialty))
      .filter((specialty) => specialty.length > 0);
  }

  if (Array.isArray(rawValue)) {
    return rawValue.map((specialty: unknown) =>
      typeof specialty === 'string' ? normalizeSpecialty(specialty) : specialty,
    );
  }

  return rawValue;
}

export class CreateStaffDto {
  @Transform(transformRequiredText)
  @IsString({ message: 'display_name must be a string.' })
  @MinLength(STAFF_DISPLAY_NAME_MIN_LENGTH, {
    message: `display_name must be at least ${STAFF_DISPLAY_NAME_MIN_LENGTH} character long.`,
  })
  @MaxLength(STAFF_DISPLAY_NAME_MAX_LENGTH, {
    message: `display_name must be at most ${STAFF_DISPLAY_NAME_MAX_LENGTH} characters long.`,
  })
  readonly display_name!: string;

  @Transform(transformEmail)
  @IsEmail({}, { message: 'email must be a valid email address.' })
  @MaxLength(STAFF_EMAIL_MAX_LENGTH, {
    message: `email must be at most ${STAFF_EMAIL_MAX_LENGTH} characters long.`,
  })
  readonly email!: string;

  @Transform(transformPhone)
  @IsOptional()
  @IsString({ message: 'phone must be a string.' })
  @MaxLength(STAFF_PHONE_MAX_LENGTH, {
    message: `phone must be at most ${STAFF_PHONE_MAX_LENGTH} characters long.`,
  })
  @Matches(/^\+?[1-9]\d{6,15}$/u, {
    message: 'phone must be a valid international phone number without spaces.',
  })
  readonly phone?: string | null;

  @IsString({ message: 'password must be a string.' })
  @MinLength(STAFF_PASSWORD_MIN_LENGTH, {
    message: `password must be at least ${STAFF_PASSWORD_MIN_LENGTH} characters long.`,
  })
  @MaxLength(STAFF_PASSWORD_MAX_LENGTH, {
    message: `password must be at most ${STAFF_PASSWORD_MAX_LENGTH} characters long.`,
  })
  readonly password!: string;

  @IsString({ message: 'confirm_password must be a string.' })
  @MinLength(STAFF_PASSWORD_MIN_LENGTH, {
    message: `confirm_password must be at least ${STAFF_PASSWORD_MIN_LENGTH} characters long.`,
  })
  @MaxLength(STAFF_PASSWORD_MAX_LENGTH, {
    message: `confirm_password must be at most ${STAFF_PASSWORD_MAX_LENGTH} characters long.`,
  })
  readonly confirm_password!: string;

  @Transform(transformOptionalText)
  @IsOptional()
  @IsString({ message: 'address must be a string.' })
  @MaxLength(STAFF_ADDRESS_MAX_LENGTH, {
    message: `address must be at most ${STAFF_ADDRESS_MAX_LENGTH} characters long.`,
  })
  readonly address?: string | null;

  @IsIn([...STAFF_PORTAL_ROLES], {
    message: `portal_role must be one of: ${STAFF_PORTAL_ROLES.join(', ')}.`,
  })
  readonly portal_role!: StaffPortalRole;

  @Transform(transformRequiredText)
  @IsString({ message: 'post_title must be a string.' })
  @MinLength(STAFF_POST_TITLE_MIN_LENGTH, {
    message: `post_title must be at least ${STAFF_POST_TITLE_MIN_LENGTH} character long.`,
  })
  @MaxLength(STAFF_POST_TITLE_MAX_LENGTH, {
    message: `post_title must be at most ${STAFF_POST_TITLE_MAX_LENGTH} characters long.`,
  })
  readonly post_title!: string;

  @IsArray({ message: 'working_days must be an array.' })
  @ArrayMinSize(STAFF_AVAILABILITY_MIN_RULES, {
    message: `working_days must contain at least ${STAFF_AVAILABILITY_MIN_RULES} day.`,
  })
  @ArrayMaxSize(STAFF_AVAILABILITY_MAX_RULES, {
    message: `working_days must contain at most ${STAFF_AVAILABILITY_MAX_RULES} days.`,
  })
  @ArrayUnique({ message: 'working_days must not contain duplicate days.' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'each working_days value must be an integer.' })
  @Min(0, {
    each: true,
    message: 'each working_days value must be at least 0.',
  })
  @Max(6, { each: true, message: 'each working_days value must be at most 6.' })
  @IsIn([...STAFF_DAY_OF_WEEK_VALUES], {
    each: true,
    message: 'each working_days value must be between 0 and 6.',
  })
  readonly working_days!: StaffDayOfWeek[];

  @IsString({ message: 'start_time must be a string.' })
  @Matches(STAFF_TIME_VALUE_PATTERN, {
    message: 'start_time must use HH:mm 24-hour format.',
  })
  readonly start_time!: string;

  @IsString({ message: 'end_time must be a string.' })
  @Matches(STAFF_TIME_VALUE_PATTERN, {
    message: 'end_time must use HH:mm 24-hour format.',
  })
  readonly end_time!: string;

  @Transform(transformSpecialties)
  @IsOptional()
  @IsArray({
    message: 'specialties must be an array or comma-separated string.',
  })
  @ArrayMaxSize(STAFF_SPECIALTIES_MAX_COUNT, {
    message: `specialties must contain at most ${STAFF_SPECIALTIES_MAX_COUNT} items.`,
  })
  @ArrayUnique({ message: 'specialties must not contain duplicate values.' })
  @IsString({ each: true, message: 'each specialty must be a string.' })
  @MinLength(STAFF_SPECIALTY_MIN_LENGTH, {
    each: true,
    message: `each specialty must be at least ${STAFF_SPECIALTY_MIN_LENGTH} character long.`,
  })
  @MaxLength(STAFF_SPECIALTY_MAX_LENGTH, {
    each: true,
    message: `each specialty must be at most ${STAFF_SPECIALTY_MAX_LENGTH} characters long.`,
  })
  readonly specialties?: string[];

  @Transform(transformOptionalText)
  @IsOptional()
  @IsString({ message: 'bio must be a string.' })
  @MaxLength(STAFF_BIO_MAX_LENGTH, {
    message: `bio must be at most ${STAFF_BIO_MAX_LENGTH} characters long.`,
  })
  readonly bio?: string | null;

  @IsOptional()
  @IsIn([...STAFF_PROFILE_CREATE_ALLOWED_STATUSES], {
    message: `status must be one of: ${STAFF_PROFILE_CREATE_ALLOWED_STATUSES.join(', ')}.`,
  })
  readonly status?: StaffProfileCreateAllowedStatus =
    STAFF_PROFILE_STATUS_AVAILABLE;
}
