// apps/api/src/app.module.ts
/**
 * Root NestJS application module for the LAFAM API shell.
 *
 * Role:
 * - Acts as the top-level composition root for the backend.
 * - Wires global infrastructure modules.
 * - Registers global API throttling.
 * - Registers the root BullMQ Redis connection.
 * - Registers approved platform modules.
 * - Provides the place where future approved feature modules will be attached.
 *
 * Important:
 * - This module must stay lightweight.
 * - Do not put business logic here.
 * - Do not import deleted starter files.
 * - Do not import feature modules until their module files are implemented and approved.
 * - BullMQ queue registration belongs inside feature modules.
 * - BullMQ root Redis connection belongs here.
 * - HTTP baseline concerns remain in apply-http-app-baseline.ts.
 */

import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { currentRedisConfig } from './common/config';

import { LoggingModule } from './common/logging/logging.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { CoreModule } from './modules/core/core.module';
import { CustomersModule } from './modules/customers/customers.module';
import { StaffModule } from './modules/staff/staff.module';
import { ClassesModule } from './modules/classes/classes.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PromoCodesModule } from './modules/promo-codes/promo-codes.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

const DEFAULT_THROTTLE_TTL_MS = 60_000;
const DEFAULT_THROTTLE_LIMIT = 120;

@Module({
  imports: [
    BullModule.forRoot({
      connection: currentRedisConfig.connection,
      prefix: currentRedisConfig.queuePrefix,
    }),
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
    CustomersModule,
    StaffModule,
    ClassesModule,
    BookingsModule,
    PaymentsModule,
    PromoCodesModule,
    AnalyticsModule,
    NotificationsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
