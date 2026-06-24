// apps/api/src/modules/customers/dto/update-customer.dto.ts
/**
 * LAFAM Customer update DTO.
 *
 * Role:
 * - Validates admin customer update request payloads.
 * - Allows admins to update customer full name, phone, Civil ID, and timezone.
 * - Normalizes editable customer identity fields before service use.
 *
 * Important:
 * - Email changes are not supported in this phase.
 * - Password changes are handled by Auth password reset flows, not customer admin update.
 * - Role and status changes are not allowed through this DTO.
 * - Customer status changes must use dedicated deactivate/reactivate endpoints.
 * - Civil ID values must never be logged.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
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
  CUSTOMER_FULL_NAME_MAX_LENGTH,
  CUSTOMER_FULL_NAME_MIN_LENGTH,
  CUSTOMER_PHONE_MAX_LENGTH,
  CUSTOMER_PHONE_PATTERN,
  CUSTOMER_TIMEZONE_MAX_LENGTH,
  CUSTOMER_TIMEZONE_PATTERN,
} from '../constants/customer.constants';
import {
  normalizeAuthCivilId,
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

export class UpdateCustomerDto {
  @ApiPropertyOptional({
    description: 'Updated customer full name.',
    example: 'Ahmad Sajid',
    minLength: CUSTOMER_FULL_NAME_MIN_LENGTH,
    maxLength: CUSTOMER_FULL_NAME_MAX_LENGTH,
  })
  @Transform((params) => transformStringValue(params, normalizeAuthFullName))
  @IsOptional()
  @IsString({ message: 'full_name must be a string.' })
  @MinLength(CUSTOMER_FULL_NAME_MIN_LENGTH, {
    message: `full_name must be at least ${CUSTOMER_FULL_NAME_MIN_LENGTH} character long.`,
  })
  @MaxLength(CUSTOMER_FULL_NAME_MAX_LENGTH, {
    message: `full_name must be at most ${CUSTOMER_FULL_NAME_MAX_LENGTH} characters long.`,
  })
  readonly full_name?: string;

  @ApiPropertyOptional({
    description: 'Updated customer phone number in international format.',
    example: '+923001234567',
    maxLength: CUSTOMER_PHONE_MAX_LENGTH,
  })
  @Transform((params) => transformStringValue(params, normalizeAuthPhone))
  @IsOptional()
  @IsString({ message: 'phone must be a string.' })
  @MaxLength(CUSTOMER_PHONE_MAX_LENGTH, {
    message: `phone must be at most ${CUSTOMER_PHONE_MAX_LENGTH} characters long.`,
  })
  @Matches(CUSTOMER_PHONE_PATTERN, {
    message: 'phone must be a valid international phone number without spaces.',
  })
  readonly phone?: string;

  @ApiPropertyOptional({
    description:
      'Updated customer Civil ID. Must contain exactly 12 digits. Spaces and hyphens are allowed for readability.',
    example: '2990-1011-2345',
    maxLength: CUSTOMER_CIVIL_ID_MAX_LENGTH,
  })
  @Transform((params) => transformStringValue(params, normalizeAuthCivilId))
  @IsOptional()
  @IsString({ message: 'civil_id must be a string.' })
  @MaxLength(CUSTOMER_CIVIL_ID_MAX_LENGTH, {
    message: `civil_id must be at most ${CUSTOMER_CIVIL_ID_MAX_LENGTH} characters long.`,
  })
  @Matches(CUSTOMER_CIVIL_ID_INPUT_PATTERN, {
    message: `civil_id must contain exactly ${CUSTOMER_CIVIL_ID_NORMALIZED_LENGTH} digits and may include spaces or hyphens.`,
  })
  readonly civil_id?: string;

  @ApiPropertyOptional({
    description: 'Updated customer timezone.',
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
