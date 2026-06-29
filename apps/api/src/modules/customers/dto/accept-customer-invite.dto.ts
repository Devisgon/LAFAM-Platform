// apps/api/src/modules/customers/dto/accept-customer-invite.dto.ts
/**
 * LAFAM Customer invite acceptance DTO.
 *
 * Role:
 * - Validates the public customer invite acceptance payload.
 * - Accepts the raw invite token from the frontend invite URL.
 * - Accepts the customer password and password confirmation.
 *
 * Important:
 * - The raw invite token must never be logged.
 * - The raw invite token must never be stored in the database.
 * - Password matching and full password-policy checks are enforced by the service.
 * - This DTO only validates shape, type, length, and token format.
 */

import { ApiProperty } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

import {
  CUSTOMER_INVITE_TOKEN_MAX_LENGTH,
  CUSTOMER_INVITE_TOKEN_MIN_LENGTH,
  CUSTOMER_INVITE_TOKEN_PATTERN,
  CUSTOMER_PASSWORD_MAX_LENGTH,
  CUSTOMER_PASSWORD_MIN_LENGTH,
} from '../constants/customer.constants';

function trimStringValue(params: TransformFnParams): unknown {
  return typeof params.value === 'string' ? params.value.trim() : params.value;
}

export class AcceptCustomerInviteDto {
  @ApiProperty({
    description:
      'Raw customer invite token from the invite URL. This token is hashed by the backend before lookup.',
    example: 'nY0lX3r9PpB6c2YkE3QzZ2wQ6dR8mV1sA9bT4xC7hJ0',
    minLength: CUSTOMER_INVITE_TOKEN_MIN_LENGTH,
    maxLength: CUSTOMER_INVITE_TOKEN_MAX_LENGTH,
  })
  @Transform(trimStringValue)
  @IsString({ message: 'token must be a string.' })
  @MinLength(CUSTOMER_INVITE_TOKEN_MIN_LENGTH, {
    message: `token must be at least ${CUSTOMER_INVITE_TOKEN_MIN_LENGTH} characters long.`,
  })
  @MaxLength(CUSTOMER_INVITE_TOKEN_MAX_LENGTH, {
    message: `token must be at most ${CUSTOMER_INVITE_TOKEN_MAX_LENGTH} characters long.`,
  })
  @Matches(CUSTOMER_INVITE_TOKEN_PATTERN, {
    message: 'token must contain only URL-safe characters.',
  })
  readonly token!: string;

  @ApiProperty({
    description: 'New customer account password.',
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
}
