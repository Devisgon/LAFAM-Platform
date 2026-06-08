// apps/api/src/common/config/supabase.config.ts
/**
 * LAFAM API Supabase configuration.
 *
 * Role:
 * - Exposes Supabase project URL and server-side API credentials.
 * - Keeps Supabase credential access centralized.
 * - Gives the database layer and Auth module one stable config object.
 *
 * Important:
 * - This file does not create a Supabase client.
 * - Client creation belongs in the database module or Auth repository layer.
 * - SUPABASE_SECRET_KEY is server-only and must never be sent to the frontend.
 * - SUPABASE_PUBLISHABLE_KEY can identify the project, but it still should not be logged.
 */

import { validateEnvironment, type EnvironmentInput } from './env.validation';

export interface SupabaseAuthConfig {
  readonly persistSession: boolean;
  readonly autoRefreshToken: boolean;
  readonly detectSessionInUrl: boolean;
}

export interface SupabaseConfig {
  readonly url: string;
  readonly publishableKey: string;
  readonly secretKey: string;
  readonly projectRef: string | null;
  readonly auth: SupabaseAuthConfig;
}

function extractSupabaseProjectRef(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    const [projectRef] = parsedUrl.hostname.split('.');

    return projectRef && projectRef.length > 0 ? projectRef : null;
  } catch {
    return null;
  }
}

export function createSupabaseConfig(
  environment: EnvironmentInput = process.env,
): SupabaseConfig {
  const validatedEnvironment = validateEnvironment(environment);
  const { supabase } = validatedEnvironment;

  return {
    url: supabase.url,
    publishableKey: supabase.publishableKey,
    secretKey: supabase.secretKey,
    projectRef: extractSupabaseProjectRef(supabase.url),
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  };
}

export const currentSupabaseConfig = createSupabaseConfig();
