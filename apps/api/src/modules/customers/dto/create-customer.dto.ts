// apps/api/src/modules/customers/dto/create-customer.dto.ts
/**
 * LAFAM Customer create DTO.
 *
 * Role:
 * - Validates admin-created customer request payloads.
 * - Normalizes email, phone, Civil ID, full name, and timezone before service use.
 * - Keeps password confirmation in the request so the service can apply the shared Auth password policy.
 *
 * Important:
 * - Admin-created customers are created active/verified by the backend.
 * - Customer creation requires full name, email, phone, Civil ID, password, and password confirmation.
 * - Passwords and Civil ID values must never be logged.
 * - Civil ID belongs to customer_profiles, not Supabase Auth metadata.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
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

function transformStringValue(
  params: TransformFnParams,
  normalizer: (value: string) => string | null,
): unknown {
  return typeof params.value === 'string'
    ? normalizer(params.value)
    : params.value;
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

  @ApiProperty({
    description: 'Customer password.',
    example: 'StrongPass123!',
    minLength: CUSTOMER_PASSWORD_MIN_LENGTH,
    maxLength: CUSTOMER_PASSWORD_MAX_LENGTH,
  })
  @IsString({ message: 'password must be a string.' })
  @MinLength(CUSTOMER_PASSWORD_MIN_LENGTH, {
    message: `password must be at least ${CUSTOMER_PASSWORD_MIN_LENGTH} characters long.`,
  })
  @MaxLength(CUSTOMER_PASSWORD_MAX_LENGTH, {
    message: `password must be at most ${CUSTOMER_PASSWORD_MAX_LENGTH} characters long.`,
  })
  readonly password!: string;

  @ApiProperty({
    description: 'Password confirmation. Must match password.',
    example: 'StrongPass123!',
    minLength: CUSTOMER_PASSWORD_MIN_LENGTH,
    maxLength: CUSTOMER_PASSWORD_MAX_LENGTH,
  })
  @IsString({ message: 'confirm_password must be a string.' })
  @MinLength(CUSTOMER_PASSWORD_MIN_LENGTH, {
    message: `confirm_password must be at least ${CUSTOMER_PASSWORD_MIN_LENGTH} characters long.`,
  })
  @MaxLength(CUSTOMER_PASSWORD_MAX_LENGTH, {
    message: `confirm_password must be at most ${CUSTOMER_PASSWORD_MAX_LENGTH} characters long.`,
  })
  readonly confirm_password!: string;

  @ApiPropertyOptional({
    description: 'Customer timezone.',
    example: 'Asia/Kuwait',
    maxLength: CUSTOMER_TIMEZONE_MAX_LENGTH,
    nullable: true,
  })
  @Transform((params) => transformStringValue(params, normalizeAuthTimezone))
  @IsOptional()
  @IsString({ message: 'timezone must be a string.' })
  @MaxLength(CUSTOMER_TIMEZONE_MAX_LENGTH, {
    message: `timezone must be at most ${CUSTOMER_TIMEZONE_MAX_LENGTH} characters long.`,
  })
  @Matches(CUSTOMER_TIMEZONE_PATTERN, {
    message: 'timezone must be a valid IANA-style timezone.',
  })
  readonly timezone?: string | null;
}
