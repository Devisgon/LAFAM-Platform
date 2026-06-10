// apps/api/src/modules/staff/controllers/staff-admin.controller.ts
/**
 * LAFAM Staff admin controller.
 *
 * Role:
 * - Exposes protected admin Staff Module endpoints.
 * - Allows admins/super-admins to create, list, read, update, deactivate,
 *   reactivate, soft-delete, and replace staff availability.
 * - Keeps controller logic thin and delegates business rules to StaffAdminService.
 *
 * Important:
 * - AuthGuard resolves the Bearer token and attaches Auth context.
 * - ActiveSessionGuard rejects revoked, expired, deleted, deactivated, and invalid guest sessions.
 * - RolesGuard enforces route-level admin/super-admin access.
 * - StaffAdminService performs Staff Module business validation.
 * - Controllers must not log raw access tokens, refresh tokens, passwords, OTPs, or token hashes.
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import {
  createApiSuccessResponse,
  type ApiSuccessResponse,
} from '../../../common/responses/api-response';
import {
  AUTH_ADMIN_ROLE,
  AUTH_SUPER_ADMIN_ROLE,
} from '../../auth/constants/auth-role.constants';
import { CurrentAuth } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ActiveSessionGuard } from '../../auth/guards/active-session.guard';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthInternalContext } from '../../auth/types/auth-context.types';
import { StaffAdminService } from '../application/staff-admin.service';
import { STAFF_ADMIN_ROUTE_PREFIX } from '../constants/staff.constants';
import { CreateStaffDto } from '../dto/create-staff.dto';
import { ListStaffQueryDto } from '../dto/list-staff-query.dto';
import { StaffParamDto } from '../dto/staff-param.dto';
import { UpdateStaffAvailabilityDto } from '../dto/update-staff-availability.dto';
import { UpdateStaffDto } from '../dto/update-staff.dto';
import type {
  StaffDeleteResult,
  StaffListResult,
  StaffMutationResult,
} from '../types/staff.types';

function resolveAuthContext(
  auth: AuthInternalContext | undefined,
): AuthInternalContext {
  if (!auth) {
    throw AppError.authenticationRequired('Authentication is required.');
  }

  return auth;
}

@Controller(STAFF_ADMIN_ROUTE_PREFIX)
@UseGuards(AuthGuard, ActiveSessionGuard, RolesGuard)
@Roles(AUTH_ADMIN_ROLE, AUTH_SUPER_ADMIN_ROLE)
export class StaffAdminController {
  constructor(private readonly staffAdminService: StaffAdminService) {}

  @Get()
  async listStaff(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Query() query: ListStaffQueryDto,
  ): Promise<ApiSuccessResponse<StaffListResult>> {
    const data = await this.staffAdminService.listStaff(
      resolveAuthContext(auth),
      query,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Staff members retrieved successfully.',
      data,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createStaff(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Body() body: CreateStaffDto,
  ): Promise<ApiSuccessResponse<StaffMutationResult>> {
    const data = await this.staffAdminService.createStaff(
      resolveAuthContext(auth),
      body,
    );

    return createApiSuccessResponse({
      status: HttpStatus.CREATED,
      message:
        'Staff member created successfully. Email verification is required before login.',
      data,
    });
  }

  @Get(':staffId')
  async getStaffById(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: StaffParamDto,
  ): Promise<ApiSuccessResponse<StaffMutationResult>> {
    const data = await this.staffAdminService.getStaffById(
      resolveAuthContext(auth),
      params.staffId,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Staff member retrieved successfully.',
      data,
    });
  }

  @Patch(':staffId')
  async updateStaff(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: StaffParamDto,
    @Body() body: UpdateStaffDto,
  ): Promise<ApiSuccessResponse<StaffMutationResult>> {
    const data = await this.staffAdminService.updateStaff(
      resolveAuthContext(auth),
      params.staffId,
      body,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Staff member updated successfully.',
      data,
    });
  }

  @Patch(':staffId/availability')
  async replaceStaffAvailability(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: StaffParamDto,
    @Body() body: UpdateStaffAvailabilityDto,
  ): Promise<ApiSuccessResponse<StaffMutationResult>> {
    const data = await this.staffAdminService.replaceStaffAvailability(
      resolveAuthContext(auth),
      params.staffId,
      body,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Staff availability updated successfully.',
      data,
    });
  }

  @Post(':staffId/deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivateStaff(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: StaffParamDto,
  ): Promise<ApiSuccessResponse<StaffMutationResult>> {
    const data = await this.staffAdminService.deactivateStaff(
      resolveAuthContext(auth),
      params.staffId,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Staff member deactivated successfully.',
      data,
    });
  }

  @Post(':staffId/reactivate')
  @HttpCode(HttpStatus.OK)
  async reactivateStaff(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: StaffParamDto,
  ): Promise<ApiSuccessResponse<StaffMutationResult>> {
    const data = await this.staffAdminService.reactivateStaff(
      resolveAuthContext(auth),
      params.staffId,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Staff member reactivated successfully.',
      data,
    });
  }

  @Delete(':staffId')
  @HttpCode(HttpStatus.OK)
  async deleteStaff(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: StaffParamDto,
  ): Promise<ApiSuccessResponse<StaffDeleteResult>> {
    const data = await this.staffAdminService.deleteStaff(
      resolveAuthContext(auth),
      params.staffId,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Staff member deleted successfully.',
      data,
    });
  }
}
