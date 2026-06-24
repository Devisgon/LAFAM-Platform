// apps/api/src/modules/customers/dto/list-customers-query.dto.ts
/**
 * LAFAM Customer list query DTO.
 *
 * Role:
 * - Validates admin customer list query parameters.
 * - Supports search, auth-status filtering, soft-deleted inclusion, and pagination.
 * - Converts query-string pagination and boolean values into typed values before service use.
 *
 * Important:
 * - This DTO is for admin list filtering only.
 * - Customer lookup by exact phone/Civil ID is handled by lookup-customer-query.dto.ts.
 * - Civil ID values must not be accepted as broad search metadata for logs or audit events.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  CUSTOMER_EMAIL_MAX_LENGTH,
  CUSTOMER_LIST_DEFAULT_LIMIT,
  CUSTOMER_LIST_DEFAULT_OFFSET,
  CUSTOMER_LIST_FILTERABLE_AUTH_STATUSES,
  CUSTOMER_LIST_MAX_LIMIT,
  type CustomerAuthStatus,
} from '../constants/customer.constants';

function transformOptionalTrimmedString(params: TransformFnParams): unknown {
  if (typeof params.value !== 'string') {
    return params.value;
  }

  const trimmedValue = params.value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function transformOptionalInteger(params: TransformFnParams): unknown {
  if (
    params.value === undefined ||
    params.value === null ||
    params.value === ''
  ) {
    return undefined;
  }

  if (typeof params.value === 'number') {
    return Number.isInteger(params.value) ? params.value : params.value;
  }

  if (typeof params.value !== 'string') {
    return params.value;
  }

  const trimmedValue = params.value.trim();

  if (trimmedValue.length === 0) {
    return undefined;
  }

  const parsedValue = Number(trimmedValue);

  return Number.isInteger(parsedValue) ? parsedValue : params.value;
}

function transformOptionalBoolean(params: TransformFnParams): unknown {
  if (
    params.value === undefined ||
    params.value === null ||
    params.value === ''
  ) {
    return undefined;
  }

  if (typeof params.value === 'boolean') {
    return params.value;
  }

  if (typeof params.value !== 'string') {
    return params.value;
  }

  const normalizedValue = params.value.trim().toLowerCase();

  if (normalizedValue === 'true') {
    return true;
  }

  if (normalizedValue === 'false') {
    return false;
  }

  return params.value;
}

export class ListCustomersQueryDto {
  @ApiPropertyOptional({
    description:
      'Optional broad search over customer name, email, or phone. Use lookup endpoint for exact phone/Civil ID lookup.',
    example: 'ahmad',
    maxLength: CUSTOMER_EMAIL_MAX_LENGTH,
  })
  @Transform(transformOptionalTrimmedString)
  @IsOptional()
  @IsString({ message: 'search must be a string.' })
  @MaxLength(CUSTOMER_EMAIL_MAX_LENGTH, {
    message: `search must be at most ${CUSTOMER_EMAIL_MAX_LENGTH} characters long.`,
  })
  readonly search?: string;

  @ApiPropertyOptional({
    description: 'Filter customers by Auth/app user status.',
    enum: CUSTOMER_LIST_FILTERABLE_AUTH_STATUSES,
    example: 'active',
  })
  @Transform(transformOptionalTrimmedString)
  @IsOptional()
  @IsIn(CUSTOMER_LIST_FILTERABLE_AUTH_STATUSES, {
    message: 'auth_status must be a valid customer auth status.',
  })
  readonly auth_status?: CustomerAuthStatus;

  @ApiPropertyOptional({
    description: 'Whether to include soft-deleted customer profiles.',
    example: false,
    default: false,
  })
  @Transform(transformOptionalBoolean)
  @IsOptional()
  @IsBoolean({ message: 'include_deleted must be a boolean.' })
  readonly include_deleted?: boolean;

  @ApiPropertyOptional({
    description: 'Maximum number of customers to return.',
    example: CUSTOMER_LIST_DEFAULT_LIMIT,
    default: CUSTOMER_LIST_DEFAULT_LIMIT,
    minimum: 1,
    maximum: CUSTOMER_LIST_MAX_LIMIT,
  })
  @Transform(transformOptionalInteger)
  @IsOptional()
  @IsInt({ message: 'limit must be an integer.' })
  @Min(1, { message: 'limit must be at least 1.' })
  @Max(CUSTOMER_LIST_MAX_LIMIT, {
    message: `limit must be at most ${CUSTOMER_LIST_MAX_LIMIT}.`,
  })
  readonly limit?: number;

  @ApiPropertyOptional({
    description: 'Number of customers to skip before returning results.',
    example: CUSTOMER_LIST_DEFAULT_OFFSET,
    default: CUSTOMER_LIST_DEFAULT_OFFSET,
    minimum: 0,
  })
  @Transform(transformOptionalInteger)
  @IsOptional()
  @IsInt({ message: 'offset must be an integer.' })
  @Min(0, { message: 'offset must be at least 0.' })
  readonly offset?: number;
}
