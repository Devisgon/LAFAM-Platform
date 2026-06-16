// apps/api/src/modules/classes/controllers/pilates-class-admin.controller.ts
/**
 * LAFAM Pilates Classes admin controllers.
 *
 * Role:
 * - Exposes protected admin Pilates class management endpoints.
 * - Exposes protected admin Pilates schedule management endpoints.
 * - Keeps controller logic thin and delegates business rules to PilatesClassAdminService.
 *
 * Important:
 * - AuthGuard resolves the Bearer token and attaches Auth context.
 * - ActiveSessionGuard rejects revoked, expired, deleted, deactivated, and invalid guest sessions.
 * - RolesGuard enforces route-level admin/super-admin access.
 * - PilatesClassAdminService owns class/schedule business validation.
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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
import { PilatesClassAdminService } from '../application/pilates-class-admin.service';
import {
  PILATES_ADMIN_CLASSES_ROUTE_PREFIX,
  PILATES_ADMIN_SCHEDULES_ROUTE_PREFIX,
  PILATES_CLASS_IMAGE_FIELD_NAME,
} from '../constants/pilates-class.constants';
import { CancelPilatesScheduleDto } from '../dto/cancel-pilates-schedule.dto';
import { PilatesClassParamDto } from '../dto/class-param.dto';
import { CreatePilatesClassDto } from '../dto/create-pilates-class.dto';
import { CreatePilatesScheduleDto } from '../dto/create-pilates-schedule.dto';
import { ListPilatesClassesQueryDto } from '../dto/list-pilates-classes-query.dto';
import { ListPilatesSchedulesQueryDto } from '../dto/list-pilates-schedules-query.dto';
import { PilatesScheduleParamDto } from '../dto/schedule-param.dto';
import { UpdatePilatesClassDto } from '../dto/update-pilates-class.dto';
import { UpdatePilatesScheduleDto } from '../dto/update-pilates-schedule.dto';
import type {
  CreatePilatesClassScheduleResult,
  PilatesClassAdminDetail,
  PilatesClassAdminSummary,
  PilatesClassImageUploadFile,
  PilatesClassScheduleAdminDetail,
  PilatesClassScheduleAdminSummary,
  PilatesPaginatedResult,
} from '../types/pilates-class.types';

interface PilatesClassMutationResult {
  readonly class: PilatesClassAdminSummary;
}

interface PilatesClassDetailResult {
  readonly class: PilatesClassAdminDetail;
}

interface PilatesScheduleMutationResult {
  readonly schedule: PilatesClassScheduleAdminSummary;
}

interface PilatesScheduleDetailResult {
  readonly schedule: PilatesClassScheduleAdminDetail;
}

interface PilatesDeleteResult {
  readonly deleted: true;
  readonly id: string;
}

function resolveAuthContext(
  auth: AuthInternalContext | undefined,
): AuthInternalContext {
  if (!auth) {
    throw AppError.authenticationRequired('Authentication is required.');
  }

  return auth;
}

@Controller(PILATES_ADMIN_CLASSES_ROUTE_PREFIX)
@UseGuards(AuthGuard, ActiveSessionGuard, RolesGuard)
@Roles(AUTH_ADMIN_ROLE, AUTH_SUPER_ADMIN_ROLE)
export class PilatesClassAdminController {
  constructor(
    private readonly pilatesClassAdminService: PilatesClassAdminService,
  ) {}

  @Get()
  async listClasses(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Query() query: ListPilatesClassesQueryDto,
  ): Promise<
    ApiSuccessResponse<PilatesPaginatedResult<PilatesClassAdminSummary>>
  > {
    const data = await this.pilatesClassAdminService.listClasses(
      resolveAuthContext(auth),
      query,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Pilates classes retrieved successfully.',
      data,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor(PILATES_CLASS_IMAGE_FIELD_NAME))
  async createClass(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Body() body: CreatePilatesClassDto,
    @UploadedFile() imageFile: PilatesClassImageUploadFile | undefined,
  ): Promise<ApiSuccessResponse<PilatesClassMutationResult>> {
    const data = await this.pilatesClassAdminService.createClass(
      resolveAuthContext(auth),
      body,
      imageFile ?? null,
    );

    return createApiSuccessResponse({
      status: HttpStatus.CREATED,
      message: 'Pilates class created successfully.',
      data,
    });
  }

  @Get(':classId')
  async getClassById(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: PilatesClassParamDto,
  ): Promise<ApiSuccessResponse<PilatesClassDetailResult>> {
    const data = await this.pilatesClassAdminService.getClassById(
      resolveAuthContext(auth),
      params.classId,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Pilates class retrieved successfully.',
      data,
    });
  }

  @Patch(':classId')
  @UseInterceptors(FileInterceptor(PILATES_CLASS_IMAGE_FIELD_NAME))
  async updateClass(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: PilatesClassParamDto,
    @Body() body: UpdatePilatesClassDto,
    @UploadedFile() imageFile: PilatesClassImageUploadFile | undefined,
  ): Promise<ApiSuccessResponse<PilatesClassMutationResult>> {
    const data = await this.pilatesClassAdminService.updateClass(
      resolveAuthContext(auth),
      params.classId,
      body,
      imageFile ?? null,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Pilates class updated successfully.',
      data,
    });
  }

  @Delete(':classId')
  @HttpCode(HttpStatus.OK)
  async deleteClass(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: PilatesClassParamDto,
  ): Promise<ApiSuccessResponse<PilatesDeleteResult>> {
    const data = await this.pilatesClassAdminService.deleteClass(
      resolveAuthContext(auth),
      params.classId,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Pilates class deleted successfully.',
      data,
    });
  }
}

@Controller(PILATES_ADMIN_SCHEDULES_ROUTE_PREFIX)
@UseGuards(AuthGuard, ActiveSessionGuard, RolesGuard)
@Roles(AUTH_ADMIN_ROLE, AUTH_SUPER_ADMIN_ROLE)
export class PilatesScheduleAdminController {
  constructor(
    private readonly pilatesClassAdminService: PilatesClassAdminService,
  ) {}

  @Get()
  async listSchedules(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Query() query: ListPilatesSchedulesQueryDto,
  ): Promise<
    ApiSuccessResponse<PilatesPaginatedResult<PilatesClassScheduleAdminSummary>>
  > {
    const data = await this.pilatesClassAdminService.listSchedules(
      resolveAuthContext(auth),
      query,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Pilates schedules retrieved successfully.',
      data,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createSchedule(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Body() body: CreatePilatesScheduleDto,
  ): Promise<ApiSuccessResponse<CreatePilatesClassScheduleResult>> {
    const data = await this.pilatesClassAdminService.createSchedule(
      resolveAuthContext(auth),
      body,
    );

    return createApiSuccessResponse({
      status: HttpStatus.CREATED,
      message: 'Pilates schedule created successfully.',
      data,
    });
  }

  @Get(':scheduleId')
  async getScheduleById(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: PilatesScheduleParamDto,
  ): Promise<ApiSuccessResponse<PilatesScheduleDetailResult>> {
    const data = await this.pilatesClassAdminService.getScheduleById(
      resolveAuthContext(auth),
      params.scheduleId,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Pilates schedule retrieved successfully.',
      data,
    });
  }

  @Patch(':scheduleId')
  async updateSchedule(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: PilatesScheduleParamDto,
    @Body() body: UpdatePilatesScheduleDto,
  ): Promise<ApiSuccessResponse<PilatesScheduleMutationResult>> {
    const data = await this.pilatesClassAdminService.updateSchedule(
      resolveAuthContext(auth),
      params.scheduleId,
      body,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Pilates schedule updated successfully.',
      data,
    });
  }

  @Post(':scheduleId/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelSchedule(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: PilatesScheduleParamDto,
    @Body() body: CancelPilatesScheduleDto,
  ): Promise<ApiSuccessResponse<PilatesScheduleMutationResult>> {
    const data = await this.pilatesClassAdminService.cancelSchedule(
      resolveAuthContext(auth),
      params.scheduleId,
      body,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Pilates schedule cancelled successfully.',
      data,
    });
  }

  @Post(':scheduleId/complete')
  @HttpCode(HttpStatus.OK)
  async completeSchedule(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: PilatesScheduleParamDto,
  ): Promise<ApiSuccessResponse<PilatesScheduleMutationResult>> {
    const data = await this.pilatesClassAdminService.completeSchedule(
      resolveAuthContext(auth),
      params.scheduleId,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Pilates schedule completed successfully.',
      data,
    });
  }

  @Delete(':scheduleId')
  @HttpCode(HttpStatus.OK)
  async deleteSchedule(
    @CurrentAuth() auth: AuthInternalContext | undefined,
    @Param() params: PilatesScheduleParamDto,
  ): Promise<ApiSuccessResponse<PilatesDeleteResult>> {
    const data = await this.pilatesClassAdminService.deleteSchedule(
      resolveAuthContext(auth),
      params.scheduleId,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Pilates schedule deleted successfully.',
      data,
    });
  }
}
