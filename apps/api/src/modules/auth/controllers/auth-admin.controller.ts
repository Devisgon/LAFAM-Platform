// apps/api/src/modules/auth/controllers/auth-admin.controller.ts
/**
 * LAFAM Auth admin controller.
 *
 * Role:
 * - Exposes protected admin user-management endpoints.
 * - Allows admins/super-admins to list, deactivate, and reactivate users.
 * - Allows only super-admins to hard-delete users.
 * - Keeps controller logic thin and delegates business rules to AuthAdminService.
 *
 * Important:
 * - AuthGuard resolves the Bearer token and attaches Auth context.
 * - ActiveSessionGuard rejects revoked, expired, deleted, deactivated, and invalid guest sessions.
 * - RolesGuard enforces route-level admin/super-admin access.
 * - AuthAdminService performs additional self-mutation and target-role protection.
 * - Controllers must not log raw access tokens, refresh tokens, passwords, OTPs, or token hashes.
 */

import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { AppError } from '../../../common/errors/app-error';
import {
  createApiSuccessResponse,
  type ApiSuccessResponse,
} from '../../../common/responses/api-response';
import {
  AuthAdminService,
  type AuthAdminServiceRequestMetadata,
} from '../application/auth-admin.service';
import {
  AUTH_ADMIN_ROLE,
  AUTH_SUPER_ADMIN_ROLE,
  isAuthUserRole,
  type AuthUserRole,
} from '../constants/auth-role.constants';
import {
  isAuthUserStatus,
  type AuthUserStatus,
} from '../constants/auth.constants';
import type { AuthenticatedRequest } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import { AdminUserParamDto } from '../dto/admin-user-param.dto';
import { ActiveSessionGuard } from '../guards/active-session.guard';
import { AuthGuard } from '../guards/auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import type { AuthInternalContext } from '../types/auth-context.types';
import type {
  AuthAdminHardDeleteUserResponse,
  AuthAdminUserListResponse,
  AuthAdminUserMutationResponse,
} from '../types/auth-response.types';
import type { AuthUserListFilters } from '../types/auth-user.types';

interface AdminUserListQuery {
  readonly search?: unknown;
  readonly role?: unknown;
  readonly status?: unknown;
  readonly is_guest?: unknown;
  readonly limit?: unknown;
  readonly offset?: unknown;
}

const DEFAULT_LIST_USERS_LIMIT = 50;
const DEFAULT_LIST_USERS_OFFSET = 0;

function extractHeaderValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmedValue = value.trim();

    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    const trimmedValue = value[0].trim();

    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  return null;
}

function resolveClientIp(request: Request): string | null {
  const forwardedForHeader = extractHeaderValue(
    request.headers['x-forwarded-for'],
  );

  if (forwardedForHeader) {
    const [firstIp] = forwardedForHeader.split(',');

    if (firstIp?.trim()) {
      return firstIp.trim();
    }
  }

  return request.ip ?? null;
}

function resolveUserAgent(request: Request): string | null {
  return extractHeaderValue(request.headers['user-agent']);
}

function resolveRequestMetadata(
  request: Request,
): AuthAdminServiceRequestMetadata {
  return {
    ipAddress: resolveClientIp(request),
    userAgent: resolveUserAgent(request),
  };
}

function resolveAuthContext(request: Request): AuthInternalContext {
  const authenticatedRequest = request as AuthenticatedRequest;

  if (!authenticatedRequest.auth) {
    throw AppError.authenticationRequired('Authentication is required.');
  }

  return authenticatedRequest.auth;
}

function normalizeOptionalQueryString(value: unknown): string | undefined {
  const headerValue = extractHeaderValue(value);

  return headerValue ?? undefined;
}

function parseOptionalIntegerQuery(input: {
  readonly value: unknown;
  readonly field: string;
  readonly fallback: number;
}): number {
  const value = normalizeOptionalQueryString(input.value);

  if (value === undefined) {
    return input.fallback;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    throw AppError.validationFailed(`${input.field} must be a valid integer.`, {
      field: input.field,
    });
  }

  return parsedValue;
}

function parseOptionalUserRole(value: unknown): AuthUserRole | undefined {
  const role = normalizeOptionalQueryString(value);

  if (role === undefined) {
    return undefined;
  }

  if (isAuthUserRole(role)) {
    return role;
  }

  throw AppError.validationFailed('role is invalid.', {
    field: 'role',
  });
}

function parseOptionalUserStatus(value: unknown): AuthUserStatus | undefined {
  const status = normalizeOptionalQueryString(value);

  if (status === undefined) {
    return undefined;
  }

  if (isAuthUserStatus(status)) {
    return status;
  }

  throw AppError.validationFailed('status is invalid.', {
    field: 'status',
  });
}

function parseOptionalBooleanQuery(input: {
  readonly value: unknown;
  readonly field: string;
}): boolean | undefined {
  const value = normalizeOptionalQueryString(input.value);

  if (value === undefined) {
    return undefined;
  }

  const normalizedValue = value.toLowerCase();

  if (normalizedValue === 'true') {
    return true;
  }

  if (normalizedValue === 'false') {
    return false;
  }

  throw AppError.validationFailed(`${input.field} must be true or false.`, {
    field: input.field,
  });
}

function buildUserListFilters(query: AdminUserListQuery): AuthUserListFilters {
  const search = normalizeOptionalQueryString(query.search);

  return {
    ...(search !== undefined ? { search } : {}),
    ...(parseOptionalUserRole(query.role) !== undefined
      ? { role: parseOptionalUserRole(query.role) }
      : {}),
    ...(parseOptionalUserStatus(query.status) !== undefined
      ? { status: parseOptionalUserStatus(query.status) }
      : {}),
    ...(parseOptionalBooleanQuery({
      value: query.is_guest,
      field: 'is_guest',
    }) !== undefined
      ? {
          isGuest: parseOptionalBooleanQuery({
            value: query.is_guest,
            field: 'is_guest',
          }),
        }
      : {}),
    limit: parseOptionalIntegerQuery({
      value: query.limit,
      field: 'limit',
      fallback: DEFAULT_LIST_USERS_LIMIT,
    }),
    offset: parseOptionalIntegerQuery({
      value: query.offset,
      field: 'offset',
      fallback: DEFAULT_LIST_USERS_OFFSET,
    }),
  };
}

@Controller('auth/admin')
@UseGuards(AuthGuard, ActiveSessionGuard, RolesGuard)
@Roles(AUTH_ADMIN_ROLE, AUTH_SUPER_ADMIN_ROLE)
export class AuthAdminController {
  constructor(private readonly authAdminService: AuthAdminService) {}

  @Get('users')
  async listUsers(
    @Query() query: AdminUserListQuery,
  ): Promise<ApiSuccessResponse<AuthAdminUserListResponse>> {
    const data = await this.authAdminService.listUsers(
      buildUserListFilters(query),
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Users retrieved successfully.',
      data,
    });
  }

  @Post('users/:userId/deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivateUser(
    @Param() params: AdminUserParamDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<AuthAdminUserMutationResponse>> {
    const data = await this.authAdminService.deactivateUser(
      resolveAuthContext(request),
      {
        userId: params.userId,
      },
      resolveRequestMetadata(request),
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'User deactivated successfully.',
      data,
    });
  }

  @Post('users/:userId/reactivate')
  @HttpCode(HttpStatus.OK)
  async reactivateUser(
    @Param() params: AdminUserParamDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<AuthAdminUserMutationResponse>> {
    const data = await this.authAdminService.reactivateUser(
      resolveAuthContext(request),
      {
        userId: params.userId,
      },
      resolveRequestMetadata(request),
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'User reactivated successfully.',
      data,
    });
  }

  @Delete('users/:userId/hard-delete')
  @HttpCode(HttpStatus.OK)
  @Roles(AUTH_SUPER_ADMIN_ROLE)
  async hardDeleteUser(
    @Param() params: AdminUserParamDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<AuthAdminHardDeleteUserResponse>> {
    const data = await this.authAdminService.hardDeleteUser(
      resolveAuthContext(request),
      {
        userId: params.userId,
      },
      resolveRequestMetadata(request),
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'User hard deleted successfully.',
      data,
    });
  }
}
