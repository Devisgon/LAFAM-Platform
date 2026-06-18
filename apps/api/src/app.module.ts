// apps/api/src/app.module.ts
/**
 * Root NestJS application module for the LAFAM API shell.
 *
 * Role:
 * - Acts as the top-level composition root for the backend.
 * - Wires global infrastructure modules.
 * - Registers global API throttling.
 * - Registers approved platform modules.
 * - Provides the place where future approved feature modules will be attached.
 *
 * Important:
 * - This module must stay lightweight.
 * - Do not put business logic here.
 * - Do not import deleted starter files.
 * - Do not import feature modules until their module files are implemented and approved.
 * - HTTP baseline concerns remain in apply-http-app-baseline.ts.
 */

import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { LoggingModule } from './common/logging/logging.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { CoreModule } from './modules/core/core.module';
import { StaffModule } from './modules/staff/staff.module';
import { ClassesModule } from './modules/classes/classes.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { PaymentsModule } from './modules/payments/payments.module';

const DEFAULT_THROTTLE_TTL_MS = 60_000;
const DEFAULT_THROTTLE_LIMIT = 120;

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: DEFAULT_THROTTLE_TTL_MS,
        limit: DEFAULT_THROTTLE_LIMIT,
      },
    ]),
    LoggingModule,
    DatabaseModule,
    CoreModule,
    AuthModule,
    StaffModule,
    ClassesModule,
    BookingsModule,
    PaymentsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
