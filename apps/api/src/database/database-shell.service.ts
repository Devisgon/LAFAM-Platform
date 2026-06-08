// apps/api/src/database/database-shell.service.ts
/**
 * LAFAM API database shell service.
 *
 * Role:
 * - Exposes controlled access to Supabase clients.
 * - Provides database connection metadata.
 * - Provides a lightweight Supabase connectivity health check.
 *
 * Important:
 * - This service must not expose Supabase secret keys.
 * - The admin client is server-only and must never be returned in API responses.
 * - Business modules should use repositories, not call Supabase directly from controllers.
 */

import { Inject, Injectable } from '@nestjs/common';

import { currentDatabaseConfig } from '../common/config/database.config';
import { currentSupabaseConfig } from '../common/config/supabase.config';
import { AppLoggerService } from '../common/logging/app-logger.service';
import {
  DATABASE_ERROR_CODE,
  DATABASE_HEALTH_STATUS,
  DATABASE_PROVIDER,
  SUPABASE_ADMIN_CLIENT,
  SUPABASE_PUBLIC_CLIENT,
} from './database.constants';
import type {
  DatabaseConnectionInfo,
  DatabaseHealthCheckResult,
  LAFAMSupabaseClient,
} from './database.types';

@Injectable()
export class DatabaseShellService {
  constructor(
    @Inject(SUPABASE_PUBLIC_CLIENT)
    private readonly publicClient: LAFAMSupabaseClient,
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly adminClient: LAFAMSupabaseClient,
    private readonly logger: AppLoggerService,
  ) {}

  getConnectionInfo(): DatabaseConnectionInfo {
    return {
      provider: DATABASE_PROVIDER.SUPABASE,
      projectUrl: currentDatabaseConfig.projectUrl,
      projectRef: currentSupabaseConfig.projectRef,
    };
  }

  getPublicClient(): LAFAMSupabaseClient {
    return this.publicClient;
  }

  getAdminClient(): LAFAMSupabaseClient {
    return this.adminClient;
  }

  async checkHealth(): Promise<DatabaseHealthCheckResult> {
    const startedAt = Date.now();
    const checkedAt = new Date().toISOString();

    try {
      const { error } = await this.adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 1,
      });

      const latencyMs = Date.now() - startedAt;

      if (error) {
        this.logger.warn('Supabase database health check failed.', {
          context: DatabaseShellService.name,
          metadata: {
            provider: DATABASE_PROVIDER.SUPABASE,
            latencyMs,
            error: {
              name: error.name,
              message: error.message,
              status: error.status,
            },
          },
        });

        return {
          status: DATABASE_HEALTH_STATUS.UNAVAILABLE,
          provider: DATABASE_PROVIDER.SUPABASE,
          checkedAt,
          latencyMs,
          projectRef: currentSupabaseConfig.projectRef,
          error: {
            code: String(
              error.status ?? DATABASE_ERROR_CODE.HEALTH_CHECK_FAILED,
            ),
            message: 'Supabase health check failed.',
          },
        };
      }

      return {
        status: DATABASE_HEALTH_STATUS.OK,
        provider: DATABASE_PROVIDER.SUPABASE,
        checkedAt,
        latencyMs,
        projectRef: currentSupabaseConfig.projectRef,
      };
    } catch (error: unknown) {
      const latencyMs = Date.now() - startedAt;

      this.logger.error('Supabase database health check threw an exception.', {
        context: DatabaseShellService.name,
        metadata: {
          provider: DATABASE_PROVIDER.SUPABASE,
          latencyMs,
          error:
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                }
              : String(error),
        },
        trace: error instanceof Error ? error.stack : undefined,
      });

      return {
        status: DATABASE_HEALTH_STATUS.UNAVAILABLE,
        provider: DATABASE_PROVIDER.SUPABASE,
        checkedAt,
        latencyMs,
        projectRef: currentSupabaseConfig.projectRef,
        error: {
          code: DATABASE_ERROR_CODE.CONNECTION_FAILED,
          message: 'Supabase connection check failed.',
        },
      };
    }
  }
}
