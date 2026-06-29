// apps/api/src/modules/notifications/notifications.module.ts
/**
 * LAFAM notifications module.
 *
 * Role:
 * - Registers notification outbox repositories.
 * - Registers scheduled-email discovery repository.
 * - Registers email template rendering.
 * - Registers Brevo provider dispatch.
 * - Registers the BullMQ email notification queue.
 * - Registers recurring email dispatch, stale-lock reset, and scheduled customer invite jobs.
 * - Registers the BullMQ email scheduled job processor.
 * - Exposes EmailNotificationService for feature modules.
 * - Exposes EmailDispatcherService for dispatch jobs/manual dispatch wiring.
 * - Exposes EmailScheduledJobService for future admin/maintenance triggers.
 *
 * Important:
 * - Feature modules must depend on EmailNotificationService, not Brevo directly.
 * - Provider-specific dispatch stays inside this module.
 * - Scheduled customer invitation discovery stays inside EmailSchedulerRepository.
 * - BullMQ only schedules dispatcher/scheduler execution.
 * - Email retry state remains inside email_notifications and email_delivery_attempts.
 * - Queue job payloads must not contain raw provider payloads, provider secrets,
 *   invite tokens, passwords, OTPs, Civil ID, cookies, or raw customer data.
 * - DatabaseModule is required because notification repositories use the Supabase admin client.
 * - No controller is registered here yet because dispatch/admin endpoints are not
 *   part of this phase.
 */

import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';

import { BrevoEmailProviderService } from './application/brevo-email-provider.service';
import { EmailDispatcherService } from './application/email-dispatcher.service';
import { EmailNotificationService } from './application/email-notification.service';
import {
  EMAIL_NOTIFICATION_QUEUE_NAME,
  EmailScheduledJobProcessor,
  EmailScheduledJobService,
} from './application/email-scheduled-job.service';
import { EmailTemplateRendererService } from './application/email-template-renderer.service';
import { EmailDeliveryAttemptRepository } from './repositories/email-delivery-attempt.repository';
import { EmailNotificationRepository } from './repositories/email-notification.repository';
import { EmailSchedulerRepository } from './repositories/email-scheduler.repository';

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({
      name: EMAIL_NOTIFICATION_QUEUE_NAME,
    }),
  ],
  providers: [
    EmailNotificationRepository,
    EmailDeliveryAttemptRepository,
    EmailSchedulerRepository,
    EmailTemplateRendererService,
    BrevoEmailProviderService,
    EmailNotificationService,
    EmailDispatcherService,
    EmailScheduledJobService,
    EmailScheduledJobProcessor,
  ],
  exports: [
    EmailNotificationService,
    EmailDispatcherService,
    EmailScheduledJobService,
  ],
})
export class NotificationsModule {}
