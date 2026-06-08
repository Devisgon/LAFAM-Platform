// apps/api/src/modules/core/core.module.ts
/**
 * LAFAM API core module.
 *
 * Role:
 * - Registers core platform endpoints.
 * - Wires API identity and health-check services.
 * - Provides foundation health checks before business modules are introduced.
 *
 * Important:
 * - This module must stay infrastructure-focused.
 * - Do not put Auth, booking, payment, class, trainer, or admin business logic here.
 * - Database access is consumed through DatabaseShellService.
 */

import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { CoreController } from './core.controller';
import { FoundationHealthService } from './foundation-health.service';

@Module({
  imports: [DatabaseModule],
  controllers: [CoreController],
  providers: [FoundationHealthService],
})
export class CoreModule {}
