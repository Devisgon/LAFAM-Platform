// apps/api/src/modules/notifications/application/email-scheduled-job.service.ts
/**
 * LAFAM email scheduled job service.
 *
 * Role:
 * - Registers BullMQ recurring jobs for email notification dispatch.
 * - Registers BullMQ recurring jobs for stale email dispatch lock recovery.
 * - Registers BullMQ recurring jobs for scheduled customer invite emails.
 * - Creates scheduled customer invite email outbox rows through EmailNotificationService.
 * - Provides manual enqueue helpers for future admin/maintenance triggers.
 * - Processes email notification queue jobs through EmailDispatcherService.
 *
 * Important:
 * - This file does not create immediate feature notification intents.
 * - This file only creates scheduled notification intents after scheduler discovery.
 * - This file does not render templates directly.
 * - This file does not call Brevo directly.
 * - This file does not store raw provider payloads, provider secrets, invite
 *   tokens, passwords, OTPs, Civil ID, cookies, or raw customer data in BullMQ.
 * - Email provider retry state remains inside email_notifications and
 *   email_delivery_attempts. BullMQ only schedules dispatcher execution.
 * - Queue job retries are intentionally not used for individual email retries.
 *   EmailDispatcherService owns per-notification retry decisions.
 */

import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Job, JobsOptions, Queue } from 'bullmq';
import { currentEmailConfig } from '../../../common/config/email.config';
import type { DatabaseJsonObject } from '../../../database/database.types';
import {
  EMAIL_NOTIFICATION_ENTITY_TYPE_CUSTOMER_INVITATION,
  EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_EXPIRED,
  EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_EXPIRING_SOON,
  EMAIL_RECIPIENT_ROLE_CUSTOMER,
} from '../constants/notification.constants';
import { createCustomerInvitationEmailIdempotencyKey } from '../domain/email-idempotency.policy';
import {
  EmailSchedulerRepository,
  type EmailSchedulerCustomerInvitationTarget,
} from '../repositories/email-scheduler.repository';
import type {
  EmailNotificationEvent,
  EmailRecipient,
} from '../types/notification.types';
import { EmailNotificationService } from './email-notification.service';
import {
  EmailDispatcherService,
  type EmailDispatchBatchResult,
} from './email-dispatcher.service';

export const EMAIL_NOTIFICATION_QUEUE_NAME = 'email-notifications';

export const EMAIL_DISPATCH_DUE_JOB_NAME = 'dispatch-due-email-notifications';

export const EMAIL_RESET_STALE_LOCKS_JOB_NAME =
  'reset-stale-email-notification-locks';
export const EMAIL_CUSTOMER_INVITE_EXPIRING_SOON_JOB_NAME =
  'process-customer-invite-expiring-soon-emails';

export const EMAIL_CUSTOMER_INVITE_EXPIRED_JOB_NAME =
  'process-customer-invite-expired-emails';

export const EMAIL_DISPATCH_DUE_SCHEDULER_ID =
  'email-notifications:dispatch-due';

export const EMAIL_RESET_STALE_LOCKS_SCHEDULER_ID =
  'email-notifications:reset-stale-locks';
export const EMAIL_CUSTOMER_INVITE_EXPIRING_SOON_SCHEDULER_ID =
  'email-notifications:customer-invite-expiring-soon';

export const EMAIL_CUSTOMER_INVITE_EXPIRED_SCHEDULER_ID =
  'email-notifications:customer-invite-expired';

const EMAIL_DISPATCH_DUE_EVERY_MS = 60_000;
const EMAIL_RESET_STALE_LOCKS_EVERY_MS = 5 * 60_000;
const EMAIL_CUSTOMER_INVITE_EXPIRING_SOON_EVERY_MS = 60 * 60 * 1_000;
const EMAIL_CUSTOMER_INVITE_EXPIRED_EVERY_MS = 15 * 60 * 1_000;

const EMAIL_DISPATCH_DEFAULT_LIMIT = 50;
const EMAIL_DISPATCH_MAX_LIMIT = 200;

const EMAIL_RECURRING_JOB_OPTIONS = {
  attempts: 1,
  removeOnComplete: 1_000,
  removeOnFail: 1_000,
} as const satisfies JobsOptions;

const EMAIL_MANUAL_JOB_OPTIONS = {
  attempts: 1,
  removeOnComplete: 1_000,
  removeOnFail: 1_000,
} as const satisfies JobsOptions;

export type EmailScheduledJobTrigger = 'scheduler' | 'manual';

export interface DispatchDueEmailScheduledJobData {
  readonly triggeredBy: EmailScheduledJobTrigger;
  readonly scheduledBefore?: string | null;
  readonly limit?: number;
}

export interface ResetStaleLocksEmailScheduledJobData {
  readonly triggeredBy: EmailScheduledJobTrigger;
  readonly lockedBefore?: string | null;
}
export interface ProcessCustomerInviteExpiringSoonScheduledJobData {
  readonly triggeredBy: EmailScheduledJobTrigger;
  readonly now?: string | null;
  readonly expiresBefore?: string | null;
  readonly limit?: number;
}

export interface ProcessCustomerInviteExpiredScheduledJobData {
  readonly triggeredBy: EmailScheduledJobTrigger;
  readonly now?: string | null;
  readonly limit?: number;
  readonly includeRecovery?: boolean;
}
export type EmailScheduledJobData =
  | DispatchDueEmailScheduledJobData
  | ResetStaleLocksEmailScheduledJobData
  | ProcessCustomerInviteExpiringSoonScheduledJobData
  | ProcessCustomerInviteExpiredScheduledJobData;

export interface EmailResetStaleLocksJobResult {
  readonly resetStaleLocks: number;
}
export interface EmailCustomerInviteExpiringSoonJobResult {
  readonly scanned: number;
  readonly created: number;
  readonly skipped: number;
  readonly failed: number;
}

export interface EmailCustomerInviteExpiredJobResult {
  readonly scanned: number;
  readonly expired: number;
  readonly recovered: number;
  readonly created: number;
  readonly skipped: number;
  readonly failed: number;
}

export type EmailScheduledJobResult =
  | EmailDispatchBatchResult
  | EmailResetStaleLocksJobResult
  | EmailCustomerInviteExpiringSoonJobResult
  | EmailCustomerInviteExpiredJobResult;

export type EmailScheduledJobName =
  | typeof EMAIL_DISPATCH_DUE_JOB_NAME
  | typeof EMAIL_RESET_STALE_LOCKS_JOB_NAME
  | typeof EMAIL_CUSTOMER_INVITE_EXPIRING_SOON_JOB_NAME
  | typeof EMAIL_CUSTOMER_INVITE_EXPIRED_JOB_NAME;

type EmailScheduledQueueName =
  | EmailScheduledJobName
  | typeof EMAIL_DISPATCH_DUE_SCHEDULER_ID
  | typeof EMAIL_RESET_STALE_LOCKS_SCHEDULER_ID
  | typeof EMAIL_CUSTOMER_INVITE_EXPIRING_SOON_SCHEDULER_ID
  | typeof EMAIL_CUSTOMER_INVITE_EXPIRED_SCHEDULER_ID;

export interface EnqueueDispatchDueEmailNotificationsInput {
  readonly scheduledBefore?: string | null;
  readonly limit?: number;
}

export interface EnqueueResetStaleEmailLocksInput {
  readonly lockedBefore?: string | null;
}
export interface EnqueueCustomerInviteExpiringSoonEmailsInput {
  readonly now?: string | null;
  readonly expiresBefore?: string | null;
  readonly limit?: number;
}

export interface EnqueueCustomerInviteExpiredEmailsInput {
  readonly now?: string | null;
  readonly limit?: number;
  readonly includeRecovery?: boolean;
}
function normalizeOptionalString(
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function normalizeOptionalIsoDateTime(
  value: string | null | undefined,
): string | null {
  const normalizedValue = normalizeOptionalString(value);

  if (!normalizedValue) {
    return null;
  }

  const timestamp = Date.parse(normalizedValue);

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString();
}

function normalizeDispatchLimit(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
    return EMAIL_DISPATCH_DEFAULT_LIMIT;
  }

  return Math.min(Math.floor(value), EMAIL_DISPATCH_MAX_LIMIT);
}
function createNowIsoString(): string {
  return new Date().toISOString();
}

function addHoursIsoString(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 60 * 60 * 1_000).toISOString();
}

function getScheduledJobNow(value: string | null | undefined): string {
  return normalizeOptionalIsoDateTime(value) ?? createNowIsoString();
}

function resolveCustomerInviteExpiringSoonExpiresBefore(input: {
  readonly now: string;
  readonly expiresBefore?: string | null;
}): string {
  return (
    normalizeOptionalIsoDateTime(input.expiresBefore) ??
    addHoursIsoString(
      input.now,
      currentEmailConfig.customerInvite.expiringSoonHours,
    )
  );
}

function addOptionalTemplateString(
  target: DatabaseJsonObject,
  key: string,
  value: string | null | undefined,
): void {
  const normalizedValue = normalizeOptionalString(value);

  if (normalizedValue) {
    target[key] = normalizedValue;
  }
}

function createCustomerInviteEmailRecipient(
  target: EmailSchedulerCustomerInvitationTarget,
): EmailRecipient {
  return {
    role: EMAIL_RECIPIENT_ROLE_CUSTOMER,
    email: target.recipientEmail,
    name: target.recipientName,
    appUserId: target.appUserId,
  };
}

function buildCustomerInviteScheduledTemplateData(
  target: EmailSchedulerCustomerInvitationTarget,
): DatabaseJsonObject {
  const templateData: DatabaseJsonObject = {};

  addOptionalTemplateString(
    templateData,
    'recipientName',
    target.recipientName,
  );
  addOptionalTemplateString(templateData, 'customerName', target.recipientName);
  addOptionalTemplateString(templateData, 'inviteExpiresAt', target.expiresAt);
  addOptionalTemplateString(templateData, 'expiresAt', target.expiresAt);
  addOptionalTemplateString(templateData, 'expiredAt', target.expiredAt);

  return templateData;
}

function buildCustomerInviteScheduledMetadata(
  target: EmailSchedulerCustomerInvitationTarget,
): DatabaseJsonObject {
  return {
    customer_invitation_id: target.invitationId,
    app_user_id: target.appUserId,
    customer_profile_id: target.customerProfileId,
    invitation_status: target.invitationStatus,
    invited_at: target.invitedAt,
    expires_at: target.expiresAt,
    expired_at: target.expiredAt,
    resend_count: target.resendCount,
    last_sent_at: target.lastSentAt,
    recipient_timezone: target.recipientTimezone,
    scheduler_generated: true,
  };
}

@Injectable()
export class EmailScheduledJobService implements OnModuleInit {
  private readonly logger = new Logger(EmailScheduledJobService.name);

  constructor(
    @InjectQueue(EMAIL_NOTIFICATION_QUEUE_NAME)
    private readonly emailQueue: Queue<
      EmailScheduledJobData,
      EmailScheduledJobResult,
      EmailScheduledQueueName
    >,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.registerRecurringJobs();
  }

  async registerRecurringJobs(): Promise<void> {
    await this.emailQueue.upsertJobScheduler(
      EMAIL_DISPATCH_DUE_SCHEDULER_ID,
      {
        every: EMAIL_DISPATCH_DUE_EVERY_MS,
      },
      {
        name: EMAIL_DISPATCH_DUE_JOB_NAME,
        data: {
          triggeredBy: 'scheduler',
          limit: EMAIL_DISPATCH_DEFAULT_LIMIT,
        },
        opts: EMAIL_RECURRING_JOB_OPTIONS,
      },
    );

    await this.emailQueue.upsertJobScheduler(
      EMAIL_RESET_STALE_LOCKS_SCHEDULER_ID,
      {
        every: EMAIL_RESET_STALE_LOCKS_EVERY_MS,
      },
      {
        name: EMAIL_RESET_STALE_LOCKS_JOB_NAME,
        data: {
          triggeredBy: 'scheduler',
        },
        opts: EMAIL_RECURRING_JOB_OPTIONS,
      },
    );
    await this.emailQueue.upsertJobScheduler(
      EMAIL_CUSTOMER_INVITE_EXPIRING_SOON_SCHEDULER_ID,
      {
        every: EMAIL_CUSTOMER_INVITE_EXPIRING_SOON_EVERY_MS,
      },
      {
        name: EMAIL_CUSTOMER_INVITE_EXPIRING_SOON_JOB_NAME,
        data: {
          triggeredBy: 'scheduler',
          limit: EMAIL_DISPATCH_DEFAULT_LIMIT,
        },
        opts: EMAIL_RECURRING_JOB_OPTIONS,
      },
    );

    await this.emailQueue.upsertJobScheduler(
      EMAIL_CUSTOMER_INVITE_EXPIRED_SCHEDULER_ID,
      {
        every: EMAIL_CUSTOMER_INVITE_EXPIRED_EVERY_MS,
      },
      {
        name: EMAIL_CUSTOMER_INVITE_EXPIRED_JOB_NAME,
        data: {
          triggeredBy: 'scheduler',
          limit: EMAIL_DISPATCH_DEFAULT_LIMIT,
          includeRecovery: true,
        },
        opts: EMAIL_RECURRING_JOB_OPTIONS,
      },
    );
    this.logger.log(
      'Email notification BullMQ schedulers registered successfully.',
    );
  }

  async enqueueDispatchDueNotifications(
    input: EnqueueDispatchDueEmailNotificationsInput = {},
  ): Promise<string | null> {
    const job = await this.emailQueue.add(
      EMAIL_DISPATCH_DUE_JOB_NAME,
      {
        triggeredBy: 'manual',
        scheduledBefore: normalizeOptionalIsoDateTime(input.scheduledBefore),
        limit: normalizeDispatchLimit(input.limit),
      },
      EMAIL_MANUAL_JOB_OPTIONS,
    );

    return job.id ?? null;
  }

  async enqueueResetStaleSendingNotifications(
    input: EnqueueResetStaleEmailLocksInput = {},
  ): Promise<string | null> {
    const job = await this.emailQueue.add(
      EMAIL_RESET_STALE_LOCKS_JOB_NAME,
      {
        triggeredBy: 'manual',
        lockedBefore: normalizeOptionalIsoDateTime(input.lockedBefore),
      },
      EMAIL_MANUAL_JOB_OPTIONS,
    );

    return job.id ?? null;
  }
  async enqueueCustomerInviteExpiringSoonEmails(
    input: EnqueueCustomerInviteExpiringSoonEmailsInput = {},
  ): Promise<string | null> {
    const job = await this.emailQueue.add(
      EMAIL_CUSTOMER_INVITE_EXPIRING_SOON_JOB_NAME,
      {
        triggeredBy: 'manual',
        now: normalizeOptionalIsoDateTime(input.now),
        expiresBefore: normalizeOptionalIsoDateTime(input.expiresBefore),
        limit: normalizeDispatchLimit(input.limit),
      },
      EMAIL_MANUAL_JOB_OPTIONS,
    );

    return job.id ?? null;
  }

  async enqueueCustomerInviteExpiredEmails(
    input: EnqueueCustomerInviteExpiredEmailsInput = {},
  ): Promise<string | null> {
    const job = await this.emailQueue.add(
      EMAIL_CUSTOMER_INVITE_EXPIRED_JOB_NAME,
      {
        triggeredBy: 'manual',
        now: normalizeOptionalIsoDateTime(input.now),
        limit: normalizeDispatchLimit(input.limit),
        includeRecovery: input.includeRecovery ?? true,
      },
      EMAIL_MANUAL_JOB_OPTIONS,
    );

    return job.id ?? null;
  }
}

@Processor(EMAIL_NOTIFICATION_QUEUE_NAME)
export class EmailScheduledJobProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailScheduledJobProcessor.name);

  constructor(
    private readonly emailDispatcherService: EmailDispatcherService,
    private readonly emailNotificationService: EmailNotificationService,
    private readonly emailSchedulerRepository: EmailSchedulerRepository,
  ) {
    super();
  }

  async process(
    job: Job<
      EmailScheduledJobData,
      EmailScheduledJobResult,
      EmailScheduledQueueName
    >,
  ): Promise<EmailScheduledJobResult> {
    if (job.name === EMAIL_DISPATCH_DUE_JOB_NAME) {
      return this.processDispatchDueNotifications(
        job as Job<
          DispatchDueEmailScheduledJobData,
          EmailDispatchBatchResult,
          typeof EMAIL_DISPATCH_DUE_JOB_NAME
        >,
      );
    }

    if (job.name === EMAIL_RESET_STALE_LOCKS_JOB_NAME) {
      return this.processResetStaleSendingNotifications(
        job as Job<
          ResetStaleLocksEmailScheduledJobData,
          EmailResetStaleLocksJobResult,
          typeof EMAIL_RESET_STALE_LOCKS_JOB_NAME
        >,
      );
    }
    if (job.name === EMAIL_CUSTOMER_INVITE_EXPIRING_SOON_JOB_NAME) {
      return this.processCustomerInviteExpiringSoonEmails(
        job as Job<
          ProcessCustomerInviteExpiringSoonScheduledJobData,
          EmailCustomerInviteExpiringSoonJobResult,
          typeof EMAIL_CUSTOMER_INVITE_EXPIRING_SOON_JOB_NAME
        >,
      );
    }

    if (job.name === EMAIL_CUSTOMER_INVITE_EXPIRED_JOB_NAME) {
      return this.processCustomerInviteExpiredEmails(
        job as Job<
          ProcessCustomerInviteExpiredScheduledJobData,
          EmailCustomerInviteExpiredJobResult,
          typeof EMAIL_CUSTOMER_INVITE_EXPIRED_JOB_NAME
        >,
      );
    }

    const unsupportedJobName: string = job.name;

    throw new Error(`Unsupported email scheduled job: ${unsupportedJobName}`);
  }
  private async processCustomerInviteExpiringSoonEmails(
    job: Job<
      ProcessCustomerInviteExpiringSoonScheduledJobData,
      EmailCustomerInviteExpiringSoonJobResult,
      typeof EMAIL_CUSTOMER_INVITE_EXPIRING_SOON_JOB_NAME
    >,
  ): Promise<EmailCustomerInviteExpiringSoonJobResult> {
    await job.updateProgress(10);

    const now = getScheduledJobNow(job.data.now);
    const expiresBefore = resolveCustomerInviteExpiringSoonExpiresBefore({
      now,
      expiresBefore: job.data.expiresBefore,
    });

    const targets =
      await this.emailSchedulerRepository.listCustomerInviteExpiringSoonCandidates(
        {
          now,
          expiresBefore,
          limit: normalizeDispatchLimit(job.data.limit),
        },
      );

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const target of targets) {
      try {
        const wasCreated = await this.createCustomerInviteScheduledEmail({
          eventType: EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_EXPIRING_SOON,
          target,
          scope: `expires:${target.expiresAt}`,
        });

        if (wasCreated) {
          created += 1;
        } else {
          skipped += 1;
        }
      } catch {
        failed += 1;
      }
    }

    await job.updateProgress(100);

    this.logger.log(
      [
        'Customer invite expiring-soon scheduled email job completed.',
        `job_id=${job.id ?? 'unknown'}`,
        `scanned=${targets.length}`,
        `created=${created}`,
        `skipped=${skipped}`,
        `failed=${failed}`,
      ].join(' '),
    );

    return {
      scanned: targets.length,
      created,
      skipped,
      failed,
    };
  }

  private async processCustomerInviteExpiredEmails(
    job: Job<
      ProcessCustomerInviteExpiredScheduledJobData,
      EmailCustomerInviteExpiredJobResult,
      typeof EMAIL_CUSTOMER_INVITE_EXPIRED_JOB_NAME
    >,
  ): Promise<EmailCustomerInviteExpiredJobResult> {
    await job.updateProgress(10);

    const now = getScheduledJobNow(job.data.now);
    const limit = normalizeDispatchLimit(job.data.limit);
    const pendingTargets =
      await this.emailSchedulerRepository.listPendingCustomerInvitesReadyToExpire(
        {
          now,
          limit,
        },
      );

    let expired = 0;
    let recovered = 0;
    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const target of pendingTargets) {
      try {
        const expiredTarget =
          await this.emailSchedulerRepository.expirePendingCustomerInvite({
            invitationId: target.invitationId,
            expiredAt: now,
          });

        if (!expiredTarget) {
          skipped += 1;
          continue;
        }

        expired += 1;

        const wasCreated = await this.createCustomerInviteScheduledEmail({
          eventType: EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_EXPIRED,
          target: expiredTarget,
          scope: `expired:${expiredTarget.expiredAt ?? now}`,
        });

        if (wasCreated) {
          created += 1;
        } else {
          skipped += 1;
        }
      } catch {
        failed += 1;
      }
    }

    if (job.data.includeRecovery !== false) {
      const recoveryTargets =
        await this.emailSchedulerRepository.listExpiredCustomerInviteEmailRecoveryCandidates(
          {
            expiredBefore: now,
            limit,
          },
        );

      recovered = recoveryTargets.length;

      for (const target of recoveryTargets) {
        try {
          const wasCreated = await this.createCustomerInviteScheduledEmail({
            eventType: EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_EXPIRED,
            target,
            scope: `expired:${target.expiredAt ?? target.updatedAt}`,
          });

          if (wasCreated) {
            created += 1;
          } else {
            skipped += 1;
          }
        } catch {
          failed += 1;
        }
      }
    }

    await job.updateProgress(100);

    this.logger.log(
      [
        'Customer invite expired scheduled email job completed.',
        `job_id=${job.id ?? 'unknown'}`,
        `scanned=${pendingTargets.length + recovered}`,
        `expired=${expired}`,
        `recovered=${recovered}`,
        `created=${created}`,
        `skipped=${skipped}`,
        `failed=${failed}`,
      ].join(' '),
    );

    return {
      scanned: pendingTargets.length + recovered,
      expired,
      recovered,
      created,
      skipped,
      failed,
    };
  }

  private async createCustomerInviteScheduledEmail(input: {
    readonly eventType: EmailNotificationEvent;
    readonly target: EmailSchedulerCustomerInvitationTarget;
    readonly scope: string;
  }): Promise<boolean> {
    const recipient = createCustomerInviteEmailRecipient(input.target);

    const notification = await this.emailNotificationService.createFromTemplate(
      {
        eventType: input.eventType,
        recipient,
        templateData: buildCustomerInviteScheduledTemplateData(input.target),
        entity: {
          entityType: EMAIL_NOTIFICATION_ENTITY_TYPE_CUSTOMER_INVITATION,
          entityId: input.target.invitationId,
        },
        idempotencyKey: createCustomerInvitationEmailIdempotencyKey({
          eventType: input.eventType,
          customerInvitationId: input.target.invitationId,
          customerAppUserId: input.target.appUserId,
          customerEmail: input.target.recipientEmail,
          scope: input.scope,
        }),
        metadata: buildCustomerInviteScheduledMetadata(input.target),
      },
    );

    return notification !== null;
  }

  private async processDispatchDueNotifications(
    job: Job<
      DispatchDueEmailScheduledJobData,
      EmailDispatchBatchResult,
      typeof EMAIL_DISPATCH_DUE_JOB_NAME
    >,
  ): Promise<EmailDispatchBatchResult> {
    await job.updateProgress(10);

    const result = await this.emailDispatcherService.dispatchDueNotifications({
      scheduledBefore: normalizeOptionalIsoDateTime(job.data.scheduledBefore),
      limit: normalizeDispatchLimit(job.data.limit),
    });

    await job.updateProgress(100);

    this.logger.log(
      [
        'Email dispatch job completed.',
        `job_id=${job.id ?? 'unknown'}`,
        `scanned=${result.scanned}`,
        `sent=${result.sent}`,
        `retried=${result.retried}`,
        `failed=${result.failed}`,
        `skipped=${result.skipped}`,
        `ignored=${result.ignored}`,
      ].join(' '),
    );

    return result;
  }

  private async processResetStaleSendingNotifications(
    job: Job<
      ResetStaleLocksEmailScheduledJobData,
      EmailResetStaleLocksJobResult,
      typeof EMAIL_RESET_STALE_LOCKS_JOB_NAME
    >,
  ): Promise<EmailResetStaleLocksJobResult> {
    await job.updateProgress(10);

    const resetStaleLocks =
      await this.emailDispatcherService.resetStaleSendingNotifications({
        lockedBefore: normalizeOptionalIsoDateTime(job.data.lockedBefore),
      });

    await job.updateProgress(100);

    this.logger.log(
      [
        'Email stale-lock reset job completed.',
        `job_id=${job.id ?? 'unknown'}`,
        `reset_stale_locks=${resetStaleLocks}`,
      ].join(' '),
    );

    return {
      resetStaleLocks,
    };
  }
}
