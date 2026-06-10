// apps/api/src/modules/staff/dto/list-staff-query.dto.ts
/**
 * LAFAM Staff list query DTO.
 *
 * Role:
 * - Validates Staff admin listing query parameters.
 * - Normalizes safe query values.
 * - Applies safe pagination defaults.
 *
 * Important:
 * - This DTO does not query the database.
 * - This DTO does not decide authorization.
 * - This DTO does not include password or email-verification logic.
 * - The Staff admin service and repository are responsible for filtering records.
 */

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

import type { DatabaseAppUserStatus } from '../../../database/database.types';
import {
  STAFF_EMAIL_MAX_LENGTH,
  STAFF_LIST_DEFAULT_LIMIT,
  STAFF_LIST_DEFAULT_OFFSET,
  STAFF_LIST_MAX_LIMIT,
  STAFF_PORTAL_ROLES,
  STAFF_PROFILE_STATUSES,
  type StaffPortalRole,
  type StaffProfileStatus,
} from '../constants/staff.constants';

const STAFF_AUTH_STATUS_FILTER_VALUES = [
  'guest_active',
  'pending_email_verification',
  'active',
  'deactivated',
  'deleted',
] as const satisfies readonly DatabaseAppUserStatus[];

function normalizeOptionalText(value: string): string | undefined {
  const normalizedValue = value.trim().replace(/\s+/g, ' ');

  return normalizedValue.length > 0 ? normalizedValue : undefined;
}

function transformOptionalText(params: TransformFnParams): unknown {
  const rawValue: unknown = params.value;

  return typeof rawValue === 'string'
    ? normalizeOptionalText(rawValue)
    : rawValue;
}

function transformIntegerWithDefault(defaultValue: number) {
  return (params: TransformFnParams): unknown => {
    const rawValue: unknown = params.value;

    if (rawValue === undefined || rawValue === null || rawValue === '') {
      return defaultValue;
    }

    if (typeof rawValue === 'number') {
      return rawValue;
    }

    if (typeof rawValue === 'string') {
      return Number(rawValue);
    }

    return rawValue;
  };
}

function transformBooleanWithDefault(defaultValue: boolean) {
  return (params: TransformFnParams): unknown => {
    const rawValue: unknown = params.value;

    if (rawValue === undefined || rawValue === null || rawValue === '') {
      return defaultValue;
    }

    if (typeof rawValue === 'boolean') {
      return rawValue;
    }

    if (typeof rawValue === 'string') {
      const normalizedValue = rawValue.trim().toLowerCase();

      if (normalizedValue === 'true') {
        return true;
      }

      if (normalizedValue === 'false') {
        return false;
      }
    }

    return rawValue;
  };
}

export class ListStaffQueryDto {
  @Transform(transformOptionalText)
  @IsOptional()
  @IsString({ message: 'search must be a string.' })
  @MaxLength(STAFF_EMAIL_MAX_LENGTH, {
    message: `search must be at most ${STAFF_EMAIL_MAX_LENGTH} characters long.`,
  })
  readonly search?: string;

  @IsOptional()
  @IsIn([...STAFF_PORTAL_ROLES], {
    message: `portal_role must be one of: ${STAFF_PORTAL_ROLES.join(', ')}.`,
  })
  readonly portal_role?: StaffPortalRole;

  @IsOptional()
  @IsIn([...STAFF_PROFILE_STATUSES], {
    message: `staff_status must be one of: ${STAFF_PROFILE_STATUSES.join(', ')}.`,
  })
  readonly staff_status?: StaffProfileStatus;

  @IsOptional()
  @IsIn([...STAFF_AUTH_STATUS_FILTER_VALUES], {
    message: `auth_status must be one of: ${STAFF_AUTH_STATUS_FILTER_VALUES.join(', ')}.`,
  })
  readonly auth_status?: DatabaseAppUserStatus;

  @Transform(transformBooleanWithDefault(false))
  @IsOptional()
  @IsBoolean({ message: 'include_deleted must be a boolean.' })
  readonly include_deleted?: boolean = false;

  @Transform(transformIntegerWithDefault(STAFF_LIST_DEFAULT_LIMIT))
  @IsOptional()
  @IsInt({ message: 'limit must be an integer.' })
  @Min(1, { message: 'limit must be at least 1.' })
  @Max(STAFF_LIST_MAX_LIMIT, {
    message: `limit must be at most ${STAFF_LIST_MAX_LIMIT}.`,
  })
  readonly limit?: number = STAFF_LIST_DEFAULT_LIMIT;

  @Transform(transformIntegerWithDefault(STAFF_LIST_DEFAULT_OFFSET))
  @IsOptional()
  @IsInt({ message: 'offset must be an integer.' })
  @Min(0, { message: 'offset must be at least 0.' })
  readonly offset?: number = STAFF_LIST_DEFAULT_OFFSET;
}
