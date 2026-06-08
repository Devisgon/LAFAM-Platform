// apps/api/src/common/logging/logging.module.ts
/**
 * LAFAM API logging module.
 *
 * Role:
 * - Registers AppLoggerService for dependency injection.
 * - Exports one shared logger provider for the backend.
 * - Makes logging available across modules without repeated provider setup.
 *
 * Important:
 * - AppLoggerService is created through a factory to avoid Nest trying to inject
 *   the TypeScript-only LoggingConfig interface.
 * - This module is global because logging is infrastructure, not domain logic.
 */

import { Global, Module } from '@nestjs/common';

import { AppLoggerService } from './app-logger.service';

export const APP_LOGGER = Symbol('APP_LOGGER');

@Global()
@Module({
  providers: [
    {
      provide: AppLoggerService,
      useFactory: (): AppLoggerService => new AppLoggerService(),
    },
    {
      provide: APP_LOGGER,
      useExisting: AppLoggerService,
    },
  ],
  exports: [AppLoggerService, APP_LOGGER],
})
export class LoggingModule {}
