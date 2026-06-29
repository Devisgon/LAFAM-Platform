// apps/api/src/modules/classes/classes.module.ts
/**
 * LAFAM Classes module.
 *
 * Role:
 * - Registers Pilates class controllers, services, repository, and event service.
 * - Provides the backend boundary for Pilates class definitions and schedules.
 * - Connects protected admin routes and public browsing routes.
 * - Connects trainer class-assignment and schedule-change emails to NotificationsModule.
 *
 * Important:
 * - Phase 1 ClassesModule is Pilates-only.
 * - Salon services/classes must remain separate for Phase 2.
 * - Booking, checkout, payment, membership, and waitlist logic do not belong here.
 * - Customer booking/payment emails do not belong here.
 * - Realtime broadcasting is not wired yet; PilatesClassEventService keeps the module event-ready.
 * - AuthModule is imported for guards/session enforcement used by admin controllers.
 * - DatabaseModule provides the Supabase admin client used by PilatesClassRepository.
 * - NotificationsModule provides the email outbox/template/provider boundary used by trainer schedule notifications.
 * - ClassesModule must not call Brevo directly.
 */

import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PilatesClassAdminService } from './application/pilates-class-admin.service';
import { PilatesClassEventService } from './application/pilates-class-event.service';
import { PilatesClassImageService } from './application/pilates-class-image.service';
import { PilatesClassPublicService } from './application/pilates-class-public.service';
import {
  PilatesClassAdminController,
  PilatesScheduleAdminController,
} from './controllers/pilates-class-admin.controller';
import {
  PilatesClassPublicController,
  PilatesSchedulePublicController,
} from './controllers/pilates-class-public.controller';
import { PilatesClassRepository } from './repositories/pilates-class.repository';

@Module({
  imports: [DatabaseModule, AuthModule, NotificationsModule],
  controllers: [
    PilatesClassAdminController,
    PilatesScheduleAdminController,
    PilatesClassPublicController,
    PilatesSchedulePublicController,
  ],
  providers: [
    PilatesClassAdminService,
    PilatesClassPublicService,
    PilatesClassEventService,
    PilatesClassImageService,
    PilatesClassRepository,
  ],
  exports: [
    PilatesClassAdminService,
    PilatesClassPublicService,
    PilatesClassEventService,
    PilatesClassImageService,
    PilatesClassRepository,
  ],
})
export class ClassesModule {}
