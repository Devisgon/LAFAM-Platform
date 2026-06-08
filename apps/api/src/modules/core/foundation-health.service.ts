// apps/api/src/modules/core/foundation-health.service.ts
/**
 * LAFAM API foundation health service.
 *
 * Role:
 * - Provides API identity data.
 * - Provides process-level health data.
 * - Provides foundation-level health data by checking Supabase/database connectivity.
 *
 * Important:
 * - This service returns data only.
 * - Controllers wrap this data using the standard API response envelope.
 * - This service must not expose secrets, tokens, Supabase keys, or raw provider errors.
 */

import { Injectable } from '@nestjs/common';

import { currentApiConfig } from '../../common/config/api.config';
import { currentAppConfig } from '../../common/config/app.config';
import { currentDatabaseConfig } from '../../common/config/database.config';
import { DATABASE_HEALTH_STATUS } from '../../database/database.constants';
import { DatabaseShellService } from '../../database/database-shell.service';
import type { DatabaseHealthCheckResult } from '../../database/database.types';

export type CoreHealthStatus = 'ok' | 'degraded' | 'unavailable';

export interface ApiIdentityData {
  readonly service_name: 'lafam-api';
  readonly service_status: CoreHealthStatus;
  readonly environment: string;
  readonly api_prefix: string;
  readonly base_url: string;
  readonly uptime_seconds: number;
}

export interface ProcessHealthData {
  readonly service_name: 'lafam-api';
  readonly service_status: CoreHealthStatus;
  readonly environment: string;
  readonly uptime_seconds: number;
  readonly memory: {
    readonly rss_bytes: number;
    readonly heap_total_bytes: number;
    readonly heap_used_bytes: number;
    readonly external_bytes: number;
    readonly array_buffers_bytes: number;
  };
}

export interface FoundationHealthData {
  readonly service_name: 'lafam-api';
  readonly service_status: CoreHealthStatus;
  readonly environment: string;
  readonly uptime_seconds: number;
  readonly api: {
    readonly service_status: CoreHealthStatus;
    readonly base_url: string;
    readonly prefix: string;
  };
  readonly database: {
    readonly service_status: CoreHealthStatus;
    readonly provider: string;
    readonly project_url: string;
    readonly project_ref: string | null;
    readonly latency_ms: number;
    readonly checked_at: string;
    readonly error?: {
      readonly code: string;
      readonly message: string;
    };
  };
}

function getUptimeSeconds(): number {
  return Math.floor(process.uptime());
}

function mapDatabaseStatusToCoreStatus(
  databaseHealth: DatabaseHealthCheckResult,
): CoreHealthStatus {
  return databaseHealth.status === DATABASE_HEALTH_STATUS.OK
    ? 'ok'
    : 'unavailable';
}

function resolveFoundationStatus(
  databaseHealth: DatabaseHealthCheckResult,
): CoreHealthStatus {
  return databaseHealth.status === DATABASE_HEALTH_STATUS.OK
    ? 'ok'
    : 'degraded';
}

@Injectable()
export class FoundationHealthService {
  constructor(private readonly databaseShellService: DatabaseShellService) {}

  getApiIdentity(): ApiIdentityData {
    return {
      service_name: 'lafam-api',
      service_status: 'ok',
      environment: currentAppConfig.nodeEnv,
      api_prefix: currentApiConfig.prefix,
      base_url: currentApiConfig.localBaseUrl,
      uptime_seconds: getUptimeSeconds(),
    };
  }

  getProcessHealth(): ProcessHealthData {
    const memoryUsage = process.memoryUsage();

    return {
      service_name: 'lafam-api',
      service_status: 'ok',
      environment: currentAppConfig.nodeEnv,
      uptime_seconds: getUptimeSeconds(),
      memory: {
        rss_bytes: memoryUsage.rss,
        heap_total_bytes: memoryUsage.heapTotal,
        heap_used_bytes: memoryUsage.heapUsed,
        external_bytes: memoryUsage.external,
        array_buffers_bytes: memoryUsage.arrayBuffers,
      },
    };
  }

  async getFoundationHealth(): Promise<FoundationHealthData> {
    const databaseHealth = await this.databaseShellService.checkHealth();
    const databaseStatus = mapDatabaseStatusToCoreStatus(databaseHealth);

    return {
      service_name: 'lafam-api',
      service_status: resolveFoundationStatus(databaseHealth),
      environment: currentAppConfig.nodeEnv,
      uptime_seconds: getUptimeSeconds(),
      api: {
        service_status: 'ok',
        base_url: currentApiConfig.localBaseUrl,
        prefix: currentApiConfig.prefix,
      },
      database: {
        service_status: databaseStatus,
        provider: currentDatabaseConfig.provider,
        project_url: currentDatabaseConfig.projectUrl,
        project_ref: databaseHealth.projectRef,
        latency_ms: databaseHealth.latencyMs,
        checked_at: databaseHealth.checkedAt,
        ...(databaseHealth.error
          ? {
              error: {
                code: databaseHealth.error.code,
                message: databaseHealth.error.message,
              },
            }
          : {}),
      },
    };
  }
}
