// apps/api/src/database/database.module.ts
/**
 * LAFAM API database module.
 *
 * Role:
 * - Creates the Supabase public client.
 * - Creates the Supabase admin client.
 * - Registers database shell service and repository.
 * - Exports database providers for approved backend modules.
 *
 * Important:
 * - SUPABASE_SECRET_KEY is used only on the server.
 * - The admin client must never be exposed to the frontend.
 * - Controllers should not use Supabase clients directly.
 * - Feature modules should use repositories/services instead of direct SDK calls.
 */

import { Global, Module } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

import { currentSupabaseConfig } from '../common/config/supabase.config';
import { LoggingModule } from '../common/logging/logging.module';
import {
  SUPABASE_ADMIN_CLIENT,
  SUPABASE_PUBLIC_CLIENT,
} from './database.constants';
import { DatabaseShellService } from './database-shell.service';
import type { Database, LAFAMSupabaseClient } from './database.types';
import { DatabaseShellRepository } from './repositories/database-shell.repository';

function createSupabaseClient(apiKey: string): LAFAMSupabaseClient {
  return createClient<Database>(currentSupabaseConfig.url, apiKey, {
    auth: {
      persistSession: currentSupabaseConfig.auth.persistSession,
      autoRefreshToken: currentSupabaseConfig.auth.autoRefreshToken,
      detectSessionInUrl: currentSupabaseConfig.auth.detectSessionInUrl,
    },
  });
}

@Global()
@Module({
  imports: [LoggingModule],
  providers: [
    {
      provide: SUPABASE_PUBLIC_CLIENT,
      useFactory: (): LAFAMSupabaseClient =>
        createSupabaseClient(currentSupabaseConfig.publishableKey),
    },
    {
      provide: SUPABASE_ADMIN_CLIENT,
      useFactory: (): LAFAMSupabaseClient =>
        createSupabaseClient(currentSupabaseConfig.secretKey),
    },
    DatabaseShellRepository,
    DatabaseShellService,
  ],
  exports: [
    SUPABASE_PUBLIC_CLIENT,
    SUPABASE_ADMIN_CLIENT,
    DatabaseShellRepository,
    DatabaseShellService,
  ],
})
export class DatabaseModule {}
