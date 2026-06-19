// apps/api/src/modules/analytics/analytics.module.ts
/**
 * LAFAM Analytics module.
 *
 * Role:
 * - Registers Admin Dashboard Analytics controller, service, and repository.
 * - Provides the backend boundary for read-only dashboard analytics.
 * - Composes Auth, Database, and Booking Calendar dependencies required by
 *   Analytics.
 *
 * Important:
 * - Analytics is read-only.
 * - Do not place business logic in this module.
 * - Do not register mutation services here.
 * - Do not export Analytics providers unless another approved module needs
 *   them later.
 * - DatabaseModule provides the Supabase admin client used by AnalyticsRepository.
 * - AuthModule provides guard/session dependencies used by Analytics controllers.
 * - BookingsModule exports BookingCalendarService, which Analytics reuses for
 *   optional upcoming calendar events.
 */

import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { BookingsModule } from '../bookings/bookings.module';
import { AnalyticsDashboardService } from './application/analytics-dashboard.service';
import { AnalyticsAdminController } from './controllers/analytics-admin.controller';
import { AnalyticsRepository } from './repositories/analytics.repository';

@Module({
  imports: [DatabaseModule, AuthModule, BookingsModule],
  controllers: [AnalyticsAdminController],
  providers: [AnalyticsDashboardService, AnalyticsRepository],
})
export class AnalyticsModule {}
