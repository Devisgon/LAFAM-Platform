// apps/api/src/modules/staff/dto/update-staff.dto.ts
/**
 * LAFAM Staff update DTO.
 *
 * Role:
 * - Validates admin staff profile update payloads.
 * - Allows only safe staff profile fields.
 * - Normalizes safe text fields before service use.
 *
 * Important:
 * - This DTO does not update email.
 * - This DTO does not update password.
 * - This DTO does not update portal_role.
 * - Email and password changes require separate controlled Auth flows.
 * - Portal role changes require a separate authorization-sensitive flow.
 * - Service layer must reject empty update payloads.
 */

import { Transform, type TransformFnParams } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import {
  STAFF_ADDRESS_MAX_LENGTH,
  STAFF_BIO_MAX_LENGTH,
  STAFF_DISPLAY_NAME_MAX_LENGTH,
  STAFF_DISPLAY_NAME_MIN_LENGTH,
  STAFF_PHONE_MAX_LENGTH,
  STAFF_POST_TITLE_MAX_LENGTH,
  STAFF_POST_TITLE_MIN_LENGTH,
  STAFF_PROFILE_UPDATE_ALLOWED_STATUSES,
  STAFF_SPECIALTIES_MAX_COUNT,
  STAFF_SPECIALTY_MAX_LENGTH,
  STAFF_SPECIALTY_MIN_LENGTH,
  type StaffProfileUpdateAllowedStatus,
} from '../constants/staff.constants';

function normalizeRequiredText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeOptionalText(value: string): string | null {
  const normalizedValue = normalizeRequiredText(value);

  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizePhone(value: string): string | null {
  const normalizedValue = value.trim().replace(/\s+/g, '');

  return normalizedValue.length > 0 ? normalizedValue : null;
}

function transformRequiredText(params: TransformFnParams): unknown {
  const rawValue: unknown = params.value;

  return typeof rawValue === 'string'
    ? normalizeRequiredText(rawValue)
    : rawValue;
}

function transformOptionalText(params: TransformFnParams): unknown {
  const rawValue: unknown = params.value;

  return typeof rawValue === 'string'
    ? normalizeOptionalText(rawValue)
    : rawValue;
}

function transformPhone(params: TransformFnParams): unknown {
  const rawValue: unknown = params.value;

  return typeof rawValue === 'string' ? normalizePhone(rawValue) : rawValue;
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

export class UpdateStaffDto {
  @Transform(transformRequiredText)
  @IsOptional()
  @IsString({ message: 'display_name must be a string.' })
  @MinLength(STAFF_DISPLAY_NAME_MIN_LENGTH, {
    message: `display_name must be at least ${STAFF_DISPLAY_NAME_MIN_LENGTH} character long.`,
  })
  @MaxLength(STAFF_DISPLAY_NAME_MAX_LENGTH, {
    message: `display_name must be at most ${STAFF_DISPLAY_NAME_MAX_LENGTH} characters long.`,
  })
  readonly display_name?: string;

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

  @Transform(transformOptionalText)
  @IsOptional()
  @IsString({ message: 'address must be a string.' })
  @MaxLength(STAFF_ADDRESS_MAX_LENGTH, {
    message: `address must be at most ${STAFF_ADDRESS_MAX_LENGTH} characters long.`,
  })
  readonly address?: string | null;

  @Transform(transformRequiredText)
  @IsOptional()
  @IsString({ message: 'post_title must be a string.' })
  @MinLength(STAFF_POST_TITLE_MIN_LENGTH, {
    message: `post_title must be at least ${STAFF_POST_TITLE_MIN_LENGTH} character long.`,
  })
  @MaxLength(STAFF_POST_TITLE_MAX_LENGTH, {
    message: `post_title must be at most ${STAFF_POST_TITLE_MAX_LENGTH} characters long.`,
  })
  readonly post_title?: string;

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
  @IsIn([...STAFF_PROFILE_UPDATE_ALLOWED_STATUSES], {
    message: `status must be one of: ${STAFF_PROFILE_UPDATE_ALLOWED_STATUSES.join(', ')}.`,
  })
  readonly status?: StaffProfileUpdateAllowedStatus;
}
