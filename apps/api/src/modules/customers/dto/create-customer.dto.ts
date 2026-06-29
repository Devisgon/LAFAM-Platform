// apps/api/src/modules/customers/dto/create-customer.dto.ts
/**
 * LAFAM Customer create DTO.
 *
 * Role:
 * - Validates admin-created customer request payloads.
 * - Normalizes email, phone, Civil ID, full name, and timezone before service use.
 * - Supports two admin customer creation modes:
 *   1. Password provided: create an active/verified customer immediately.
 *   2. Password omitted: create an invited customer and send a password-set invite.
 *
 * Important:
 * - Password and confirm_password must be provided together or omitted together.
 * - Password match and shared password-policy checks are enforced by the service.
 * - Passwords and Civil ID values must never be logged.
 * - Civil ID belongs to customer_profiles, not Supabase Auth metadata.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

import {
  CUSTOMER_CIVIL_ID_MAX_LENGTH,
  CUSTOMER_CIVIL_ID_NORMALIZED_LENGTH,
  CUSTOMER_EMAIL_MAX_LENGTH,
  CUSTOMER_EMAIL_PATTERN,
  CUSTOMER_FULL_NAME_MAX_LENGTH,
  CUSTOMER_FULL_NAME_MIN_LENGTH,
  CUSTOMER_PASSWORD_MAX_LENGTH,
  CUSTOMER_PASSWORD_MIN_LENGTH,
  CUSTOMER_PHONE_MAX_LENGTH,
  CUSTOMER_PHONE_PATTERN,
  CUSTOMER_TIMEZONE_MAX_LENGTH,
  CUSTOMER_TIMEZONE_PATTERN,
} from '../constants/customer.constants';
import {
  normalizeAuthCivilId,
  normalizeAuthEmail,
  normalizeAuthFullName,
  normalizeAuthPhone,
  normalizeAuthTimezone,
} from '../../auth/utils/auth-normalization.util';

const CUSTOMER_CIVIL_ID_INPUT_PATTERN = /^(?=(?:\D*\d){12}\D*$)[0-9 -]+$/u;

interface PasswordPairCandidate {
  readonly password?: unknown;
  readonly confirm_password?: unknown;
}

function transformStringValue(
  params: TransformFnParams,
  normalizer: (value: string) => string | null,
): unknown {
  return typeof params.value === 'string'
    ? normalizer(params.value)
    : params.value;
}

function hasPasswordPairInput(value: PasswordPairCandidate): boolean {
  return (
    typeof value.password !== 'undefined' ||
    typeof value.confirm_password !== 'undefined'
  );
}

export class CreateCustomerDto {
  @ApiProperty({
    description: 'Customer full name.',
    example: 'Ahmad Sajid',
    minLength: CUSTOMER_FULL_NAME_MIN_LENGTH,
    maxLength: CUSTOMER_FULL_NAME_MAX_LENGTH,
  })
  @Transform((params) => transformStringValue(params, normalizeAuthFullName))
  @IsString({ message: 'full_name must be a string.' })
  @MinLength(CUSTOMER_FULL_NAME_MIN_LENGTH, {
    message: `full_name must be at least ${CUSTOMER_FULL_NAME_MIN_LENGTH} character long.`,
  })
  @MaxLength(CUSTOMER_FULL_NAME_MAX_LENGTH, {
    message: `full_name must be at most ${CUSTOMER_FULL_NAME_MAX_LENGTH} characters long.`,
  })
  readonly full_name!: string;

  @ApiProperty({
    description: 'Customer email address used for login.',
    example: 'customer@example.com',
    maxLength: CUSTOMER_EMAIL_MAX_LENGTH,
  })
  @Transform((params) => transformStringValue(params, normalizeAuthEmail))
  @IsString({ message: 'email must be a string.' })
  @MaxLength(CUSTOMER_EMAIL_MAX_LENGTH, {
    message: `email must be at most ${CUSTOMER_EMAIL_MAX_LENGTH} characters long.`,
  })
  @Matches(CUSTOMER_EMAIL_PATTERN, {
    message: 'email must be a valid email address.',
  })
  readonly email!: string;

  @ApiProperty({
    description: 'Customer phone number in international format.',
    example: '+923001234567',
    maxLength: CUSTOMER_PHONE_MAX_LENGTH,
  })
  @Transform((params) => transformStringValue(params, normalizeAuthPhone))
  @IsString({ message: 'phone must be a string.' })
  @MaxLength(CUSTOMER_PHONE_MAX_LENGTH, {
    message: `phone must be at most ${CUSTOMER_PHONE_MAX_LENGTH} characters long.`,
  })
  @Matches(CUSTOMER_PHONE_PATTERN, {
    message: 'phone must be a valid international phone number without spaces.',
  })
  readonly phone!: string;

  @ApiProperty({
    description:
      'Customer Civil ID. Must contain exactly 12 digits. Spaces and hyphens are allowed for readability.',
    example: '2990-1011-2345',
    maxLength: CUSTOMER_CIVIL_ID_MAX_LENGTH,
  })
  @Transform((params) => transformStringValue(params, normalizeAuthCivilId))
  @IsString({ message: 'civil_id must be a string.' })
  @MaxLength(CUSTOMER_CIVIL_ID_MAX_LENGTH, {
    message: `civil_id must be at most ${CUSTOMER_CIVIL_ID_MAX_LENGTH} characters long.`,
  })
  @Matches(CUSTOMER_CIVIL_ID_INPUT_PATTERN, {
    message: `civil_id must contain exactly ${CUSTOMER_CIVIL_ID_NORMALIZED_LENGTH} digits and may include spaces or hyphens.`,
  })
  readonly civil_id!: string;

  @ApiPropertyOptional({
    description:
      'Customer password. Provide with confirm_password to create an active customer immediately. Omit both fields to create an invited customer.',
    example: 'StrongPass123!',
    minLength: CUSTOMER_PASSWORD_MIN_LENGTH,
    maxLength: CUSTOMER_PASSWORD_MAX_LENGTH,
  })
  @ValidateIf((value: PasswordPairCandidate) => hasPasswordPairInput(value))
  @IsString({
    message:
      'password must be a string when password or confirm_password is provided.',
  })
  @MinLength(CUSTOMER_PASSWORD_MIN_LENGTH, {
    message: `password must be at least ${CUSTOMER_PASSWORD_MIN_LENGTH} characters long.`,
  })
  @MaxLength(CUSTOMER_PASSWORD_MAX_LENGTH, {
    message: `password must be at most ${CUSTOMER_PASSWORD_MAX_LENGTH} characters long.`,
  })
  readonly password?: string | null;

  @ApiPropertyOptional({
    description:
      'Password confirmation. Required when password is provided. Omit both fields to create an invited customer.',
    example: 'StrongPass123!',
    minLength: CUSTOMER_PASSWORD_MIN_LENGTH,
    maxLength: CUSTOMER_PASSWORD_MAX_LENGTH,
  })
  @ValidateIf((value: PasswordPairCandidate) => hasPasswordPairInput(value))
  @IsString({
    message:
      'confirm_password must be a string when password or confirm_password is provided.',
  })
  @MinLength(CUSTOMER_PASSWORD_MIN_LENGTH, {
    message: `confirm_password must be at least ${CUSTOMER_PASSWORD_MIN_LENGTH} characters long.`,
  })
  @MaxLength(CUSTOMER_PASSWORD_MAX_LENGTH, {
    message: `confirm_password must be at most ${CUSTOMER_PASSWORD_MAX_LENGTH} characters long.`,
  })
  readonly confirm_password?: string | null;

  @ApiPropertyOptional({
    description: 'Customer timezone.',
    example: 'Asia/Kuwait',
    maxLength: CUSTOMER_TIMEZONE_MAX_LENGTH,
    nullable: true,
  })
  @Transform((params) => transformStringValue(params, normalizeAuthTimezone))
  @ValidateIf((_, value: unknown) => value !== null && value !== undefined)
  @IsString({ message: 'timezone must be a string.' })
  @MaxLength(CUSTOMER_TIMEZONE_MAX_LENGTH, {
    message: `timezone must be at most ${CUSTOMER_TIMEZONE_MAX_LENGTH} characters long.`,
  })
  @Matches(CUSTOMER_TIMEZONE_PATTERN, {
    message: 'timezone must be a valid IANA-style timezone.',
  })
  readonly timezone?: string | null;
}
