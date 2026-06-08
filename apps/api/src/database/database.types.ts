// apps/api/src/database/database.types.ts
/**
 * LAFAM API database types.
 *
 * Role:
 * - Defines the local Supabase database type contract.
 * - Provides shared database health/result types.
 * - Gives repositories and services stable types before real migrations are added.
 *
 * Important:
 * - This file contains types only.
 * - This file must not create clients.
 * - This file must not read environment variables.
 * - Replace the empty Database schema sections when Supabase migrations are added/generated.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  DatabaseHealthStatus,
  DatabaseProvider,
} from './database.constants';

export type DatabaseJson =
  | string
  | number
  | boolean
  | null
  | { readonly [key: string]: DatabaseJson | undefined }
  | readonly DatabaseJson[];

export interface Database {
  readonly public: {
    readonly Tables: Record<string, never>;
    readonly Views: Record<string, never>;
    readonly Functions: Record<string, never>;
    readonly Enums: Record<string, never>;
    readonly CompositeTypes: Record<string, never>;
  };
}

export type LAFAMSupabaseClient = SupabaseClient<Database>;

export interface DatabaseConnectionInfo {
  readonly provider: DatabaseProvider;
  readonly projectUrl: string;
  readonly projectRef: string | null;
}

export interface DatabaseHealthCheckResult {
  readonly status: DatabaseHealthStatus;
  readonly provider: DatabaseProvider;
  readonly checkedAt: string;
  readonly latencyMs: number;
  readonly projectRef: string | null;
  readonly error?: {
    readonly code: string;
    readonly message: string;
  };
}

export interface DatabaseQueryResult<TData> {
  readonly data: TData;
  readonly error: null;
}

export interface DatabaseQueryFailure {
  readonly data: null;
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}

export type DatabaseQueryOutcome<TData> =
  | DatabaseQueryResult<TData>
  | DatabaseQueryFailure;
