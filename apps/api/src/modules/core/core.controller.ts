// apps/api/src/modules/core/core.controller.ts
/**
 * LAFAM API core controller.
 *
 * Role:
 * - Exposes the API identity endpoint.
 * - Exposes process-level health endpoint.
 * - Exposes foundation-level health endpoint.
 * - Wraps all successful responses in the standard LAFAM API response envelope.
 *
 * Important:
 * - This controller must stay thin.
 * - This controller must not contain health calculation logic.
 * - This controller must not expose secrets, tokens, Supabase keys, or raw provider errors.
 */

import { Controller, Get } from '@nestjs/common';

import {
  createApiSuccessResponse,
  type ApiSuccessResponse,
} from '../../common/responses/api-response';
import {
  type ApiIdentityData,
  type FoundationHealthData,
  FoundationHealthService,
  type ProcessHealthData,
} from './foundation-health.service';

const HTTP_STATUS_OK = 200;

@Controller()
export class CoreController {
  constructor(
    private readonly foundationHealthService: FoundationHealthService,
  ) {}

  @Get()
  getApiIdentity(): ApiSuccessResponse<ApiIdentityData> {
    return createApiSuccessResponse({
      status: HTTP_STATUS_OK,
      message: 'LAFAM API is running',
      data: this.foundationHealthService.getApiIdentity(),
    });
  }

  @Get('health')
  getProcessHealth(): ApiSuccessResponse<ProcessHealthData> {
    return createApiSuccessResponse({
      status: HTTP_STATUS_OK,
      message: 'Health check successful',
      data: this.foundationHealthService.getProcessHealth(),
    });
  }

  @Get('health/foundation')
  async getFoundationHealth(): Promise<
    ApiSuccessResponse<FoundationHealthData>
  > {
    const foundationHealth =
      await this.foundationHealthService.getFoundationHealth();

    return createApiSuccessResponse({
      status: HTTP_STATUS_OK,
      message: 'Foundation health check successful',
      data: foundationHealth,
    });
  }
}
