// apps/api/src/modules/classes/controllers/pilates-class-public.controller.ts
/**
 * LAFAM Pilates Classes public controllers.
 *
 * Role:
 * - Exposes public/customer-safe Pilates class browsing endpoints.
 * - Exposes public/customer-safe Pilates schedule browsing endpoints.
 * - Keeps controller logic thin and delegates read filtering to PilatesClassPublicService.
 *
 * Important:
 * - These routes are intentionally public.
 * - Public routes expose only active classes and future scheduled occurrences.
 * - Public responses must not expose admin metadata.
 * - Booking, checkout, payment, and waitlist actions belong to later modules.
 */

import { Controller, Get, HttpStatus, Param, Query } from '@nestjs/common';

import {
  createApiSuccessResponse,
  type ApiSuccessResponse,
} from '../../../common/responses/api-response';
import { PublicRoute } from '../../auth/decorators/public-route.decorator';
import { PilatesClassPublicService } from '../application/pilates-class-public.service';
import {
  PILATES_PUBLIC_CLASSES_ROUTE_PREFIX,
  PILATES_PUBLIC_SCHEDULES_ROUTE_PREFIX,
} from '../constants/pilates-class.constants';
import { PilatesClassParamDto } from '../dto/class-param.dto';
import { ListPublicPilatesClassesQueryDto } from '../dto/list-pilates-classes-query.dto';
import { ListPublicPilatesSchedulesQueryDto } from '../dto/list-pilates-schedules-query.dto';
import { PilatesScheduleParamDto } from '../dto/schedule-param.dto';
import type {
  PilatesClassPublicDetail,
  PilatesClassPublicSummary,
  PilatesClassSchedulePublicDetail,
  PilatesClassSchedulePublicSummary,
  PilatesPaginatedResult,
} from '../types/pilates-class.types';

interface PilatesClassDetailResult {
  readonly class: PilatesClassPublicDetail;
}

interface PilatesScheduleDetailResult {
  readonly schedule: PilatesClassSchedulePublicDetail;
}

@PublicRoute()
@Controller(PILATES_PUBLIC_CLASSES_ROUTE_PREFIX)
export class PilatesClassPublicController {
  constructor(
    private readonly pilatesClassPublicService: PilatesClassPublicService,
  ) {}

  @Get()
  async listClasses(
    @Query() query: ListPublicPilatesClassesQueryDto,
  ): Promise<
    ApiSuccessResponse<PilatesPaginatedResult<PilatesClassPublicSummary>>
  > {
    const data = await this.pilatesClassPublicService.listClasses(query);

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Pilates classes retrieved successfully.',
      data,
    });
  }

  @Get(':classId')
  async getClassById(
    @Param() params: PilatesClassParamDto,
  ): Promise<ApiSuccessResponse<PilatesClassDetailResult>> {
    const data = await this.pilatesClassPublicService.getClassById(
      params.classId,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Pilates class retrieved successfully.',
      data,
    });
  }
}

@PublicRoute()
@Controller(PILATES_PUBLIC_SCHEDULES_ROUTE_PREFIX)
export class PilatesSchedulePublicController {
  constructor(
    private readonly pilatesClassPublicService: PilatesClassPublicService,
  ) {}

  @Get()
  async listSchedules(
    @Query() query: ListPublicPilatesSchedulesQueryDto,
  ): Promise<
    ApiSuccessResponse<
      PilatesPaginatedResult<PilatesClassSchedulePublicSummary>
    >
  > {
    const data = await this.pilatesClassPublicService.listSchedules(query);

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Pilates schedules retrieved successfully.',
      data,
    });
  }

  @Get(':scheduleId')
  async getScheduleById(
    @Param() params: PilatesScheduleParamDto,
  ): Promise<ApiSuccessResponse<PilatesScheduleDetailResult>> {
    const data = await this.pilatesClassPublicService.getScheduleById(
      params.scheduleId,
    );

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: 'Pilates schedule retrieved successfully.',
      data,
    });
  }
}
