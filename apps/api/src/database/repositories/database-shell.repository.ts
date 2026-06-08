// apps/api/src/database/repositories/database-shell.repository.ts
/**
 * LAFAM API database shell repository.
 *
 * Role:
 * - Owns low-level Supabase connectivity checks.
 * - Provides controlled access to initialized Supabase clients for infrastructure services.
 * - Keeps direct Supabase SDK calls out of higher-level health/application services.
 *
 * Important:
 * - This repository must not expose secrets.
 * - This repository must not return raw Supabase provider errors directly to API clients.
 * - Business modules should create their own repositories instead of using this shell repository directly.
 */

import { Inject, Injectable } from '@nestjs/common';

import { DATABASE_ERROR_CODE } from '../database.constants';
import type {
  DatabaseQueryOutcome,
  LAFAMSupabaseClient,
} from '../database.types';
import {
  SUPABASE_ADMIN_CLIENT,
  SUPABASE_PUBLIC_CLIENT,
} from '../database.constants';

export interface DatabaseShellConnectivityResult {
  readonly checkedAt: string;
  readonly userSampleCount: number;
}

function stringifyProviderErrorCode(value: unknown): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value.toString();
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  return DATABASE_ERROR_CODE.HEALTH_CHECK_FAILED;
}

function resolveProviderError(error: unknown): {
  readonly code: string;
  readonly message: string;
} {
  if (error instanceof Error) {
    return {
      code: DATABASE_ERROR_CODE.HEALTH_CHECK_FAILED,
      message: error.message,
    };
  }

  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;

    return {
      code:
        typeof record.code === 'string' && record.code.trim().length > 0
          ? record.code
          : stringifyProviderErrorCode(record.status),
      message:
        typeof record.message === 'string'
          ? record.message
          : 'Supabase health check failed.',
    };
  }

  return {
    code: DATABASE_ERROR_CODE.HEALTH_CHECK_FAILED,
    message: 'Supabase health check failed.',
  };
}

@Injectable()
export class DatabaseShellRepository {
  constructor(
    @Inject(SUPABASE_PUBLIC_CLIENT)
    private readonly publicClient: LAFAMSupabaseClient,
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly adminClient: LAFAMSupabaseClient,
  ) {}

  getPublicClient(): LAFAMSupabaseClient {
    return this.publicClient;
  }

  getAdminClient(): LAFAMSupabaseClient {
    return this.adminClient;
  }

  async checkAdminConnectivity(): Promise<
    DatabaseQueryOutcome<DatabaseShellConnectivityResult>
  > {
    try {
      const { data, error } = await this.adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 1,
      });

      if (error) {
        return {
          data: null,
          error: resolveProviderError(error),
        };
      }

      return {
        data: {
          checkedAt: new Date().toISOString(),
          userSampleCount: Array.isArray(data?.users) ? data.users.length : 0,
        },
        error: null,
      };
    } catch (error: unknown) {
      return {
        data: null,
        error: resolveProviderError(error),
      };
    }
  }
}
