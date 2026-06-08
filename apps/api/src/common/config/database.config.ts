// apps/api/src/common/config/database.config.ts
/**
 * LAFAM API database configuration.
 *
 * Role:
 * - Defines the database provider used by the API.
 * - Keeps database identity/configuration separate from Supabase client setup.
 * - Gives database.module.ts a stable config object to consume later.
 *
 * Important:
 * - This project currently uses Supabase as the database/auth platform.
 * - This file does not create a Supabase client.
 * - Supabase client credentials belong in supabase.config.ts.
 * - Repository/database services should not read process.env directly.
 */

import { validateEnvironment, type EnvironmentInput } from './env.validation';

export const DATABASE_PROVIDER_VALUES = ['supabase'] as const;

export type DatabaseProvider = (typeof DATABASE_PROVIDER_VALUES)[number];

export interface DatabaseConfig {
  readonly provider: DatabaseProvider;
  readonly projectUrl: string;
  readonly isConfigured: boolean;
}

export function createDatabaseConfig(
  environment: EnvironmentInput = process.env,
): DatabaseConfig {
  const validatedEnvironment = validateEnvironment(environment);

  return {
    provider: 'supabase',
    projectUrl: validatedEnvironment.supabase.url,
    isConfigured: validatedEnvironment.supabase.url.length > 0,
  };
}

export const currentDatabaseConfig = createDatabaseConfig();
