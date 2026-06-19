// apps/api/src/modules/analytics/controllers/analytics-admin.controller.ts
/**
 * LAFAM admin analytics controller.
 *
 * Role:
 * - Exposes protected Admin Analytics Dashboard endpoints.
 * - Allows admin and super-admin users to retrieve read-only dashboard metrics.
 * - Keeps analytics route handling thin and delegates calculation logic to
 *   AnalyticsDashboardService.
 *
 * Important:
 * - AuthGuard resolves the Bearer token and attaches Auth context.
 * - ActiveSessionGuard rejects revoked, expired, deleted, deactivated, and invalid sessions.
 * - RolesGuard restricts this endpoint to admin and super-admin users.
 * - Controller does not calculate analytics.
 * - Controller does not query the database.
 * - Controller does not mutate bookings, payments, wallets, users, classes,
 *   schedules, or staff.
 */

import { Controller, Get, HttpStatus, Query, UseGuards } from '@nestjs/common';

import {
  createApiSuccessResponse,
  type ApiSuccessResponse,
} from '../../../common/responses/api-response';
import {
  AUTH_ADMIN_ROLE,
  AUTH_SUPER_ADMIN_ROLE,
} from '../../auth/constants/auth-role.constants';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ActiveSessionGuard } from '../../auth/guards/active-session.guard';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AnalyticsDashboardService } from '../application/analytics-dashboard.service';
import {
  ANALYTICS_ADMIN_ROUTE_PREFIX,
  ANALYTICS_DASHBOARD_ROUTE,
  ANALYTICS_DASHBOARD_SUCCESS_MESSAGE,
} from '../constants/analytics.constants';
import { AnalyticsDashboardQueryDto } from '../dto/analytics-dashboard-query.dto';
import type { AnalyticsDashboardResponse } from '../types/analytics.types';

@Controller(ANALYTICS_ADMIN_ROUTE_PREFIX)
@UseGuards(AuthGuard, ActiveSessionGuard, RolesGuard)
@Roles(AUTH_ADMIN_ROLE, AUTH_SUPER_ADMIN_ROLE)
export class AnalyticsAdminController {
  constructor(
    private readonly analyticsDashboardService: AnalyticsDashboardService,
  ) {}

  @Get(ANALYTICS_DASHBOARD_ROUTE)
  async getDashboard(
    @Query() query: AnalyticsDashboardQueryDto,
  ): Promise<ApiSuccessResponse<AnalyticsDashboardResponse>> {
    const data = await this.analyticsDashboardService.getDashboard(query);

    return createApiSuccessResponse({
      status: HttpStatus.OK,
      message: ANALYTICS_DASHBOARD_SUCCESS_MESSAGE,
      data,
    });
  }
}
