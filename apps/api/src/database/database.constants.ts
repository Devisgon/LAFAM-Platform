// apps/api/src/database/database.constants.ts
/**
 * LAFAM API database constants.
 *
 * Role:
 * - Defines stable database-layer provider tokens.
 * - Keeps Supabase client injection tokens centralized.
 * - Prevents string-token duplication across modules, services, and repositories.
 *
 * Important:
 * - This file must not create clients.
 * - This file must not read environment variables.
 * - This file must not contain secrets.
 */

export const DATABASE_MODULE_NAME = 'DatabaseModule';

export const SUPABASE_PUBLIC_CLIENT = Symbol('SUPABASE_PUBLIC_CLIENT');
export const SUPABASE_ADMIN_CLIENT = Symbol('SUPABASE_ADMIN_CLIENT');

export const DATABASE_PROVIDER = {
  SUPABASE: 'supabase',
} as const;

export type DatabaseProvider =
  (typeof DATABASE_PROVIDER)[keyof typeof DATABASE_PROVIDER];

export const DATABASE_HEALTH_STATUS = {
  OK: 'ok',
  UNAVAILABLE: 'unavailable',
} as const;

export type DatabaseHealthStatus =
  (typeof DATABASE_HEALTH_STATUS)[keyof typeof DATABASE_HEALTH_STATUS];

export const DATABASE_ERROR_CODE = {
  CONNECTION_FAILED: 'DATABASE_CONNECTION_FAILED',
  HEALTH_CHECK_FAILED: 'DATABASE_HEALTH_CHECK_FAILED',
} as const;

export type DatabaseErrorCode =
  (typeof DATABASE_ERROR_CODE)[keyof typeof DATABASE_ERROR_CODE];
