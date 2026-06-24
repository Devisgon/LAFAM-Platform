// apps/api/src/modules/customers/dto/lookup-customer-query.dto.ts
/**
 * LAFAM Customer lookup query DTO.
 *
 * Role:
 * - Validates exact customer lookup query parameters for admin customer endpoints.
 * - Supports exact lookup by phone, Civil ID, or both.
 * - Normalizes phone and Civil ID before service use.
 *
 * Important:
 * - At least one of phone or civil_id is required; the service enforces that rule.
 * - If both phone and civil_id are provided, both must match the same customer; the service enforces that rule.
 * - Civil ID values must never be logged or written into audit metadata.
 * - This DTO is for exact lookup only, not broad customer list search.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import {
  CUSTOMER_CIVIL_ID_MAX_LENGTH,
  CUSTOMER_CIVIL_ID_NORMALIZED_LENGTH,
  CUSTOMER_PHONE_MAX_LENGTH,
  CUSTOMER_PHONE_PATTERN,
} from '../constants/customer.constants';
import {
  normalizeAuthCivilId,
  normalizeAuthPhone,
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

export class LookupCustomerQueryDto {
  @ApiPropertyOptional({
    description:
      'Customer phone number in international format. Used for exact customer lookup.',
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
      'Customer Civil ID. Must contain exactly 12 digits. Spaces and hyphens are allowed for readability. Used for exact customer lookup.',
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
}
