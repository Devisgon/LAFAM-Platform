// apps/api/src/modules/notifications/repositories/email-scheduler.repository.ts
/**
 * LAFAM email scheduler repository.
 *
 * Role:
 * - Finds database records that need scheduled email notification work.
 * - Finds pending customer invitations that are expiring soon.
 * - Finds pending customer invitations that have passed expiry.
 * - Marks pending customer invitations as expired for scheduled expiry flow.
 * - Finds expired customer invitations that still need the expired email.
 *
 * Important:
 * - This repository does not send emails.
 * - This repository does not render templates.
 * - This repository does not enqueue BullMQ jobs.
 * - This repository does not create email_notifications rows directly.
 * - This repository must never return or expose raw invite tokens.
 * - This repository must never return Civil ID values.
 * - Only safe customer invitation scheduling fields are returned.
 */

import { Inject, Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { SUPABASE_ADMIN_CLIENT } from '../../../database/database.constants';
import type {
  AppUserRow,
  CustomerInvitationRow,
  CustomerInvitationUpdate,
  DatabaseCustomerInvitationStatus,
  LAFAMSupabaseClient,
} from '../../../database/database.types';
import {
  CUSTOMER_INVITATION_STATUS_EXPIRED,
  CUSTOMER_INVITATION_STATUS_PENDING,
} from '../../customers/constants/customer.constants';
import {
  EMAIL_NOTIFICATION_ENTITY_TYPE_CUSTOMER_INVITATION,
  EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_EXPIRED,
  EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_EXPIRING_SOON,
} from '../constants/notification.constants';
import type { EmailNotificationEvent } from '../types/notification.types';

const DEFAULT_SCHEDULED_CANDIDATE_LIMIT = 50;
const MAX_SCHEDULED_CANDIDATE_LIMIT = 200;

export interface EmailSchedulerCustomerInvitationTarget {
  readonly invitationId: string;
  readonly appUserId: string;
  readonly customerProfileId: string;
  readonly recipientEmail: string;
  readonly recipientName: string | null;
  readonly recipientTimezone: string | null;
  readonly invitationStatus: DatabaseCustomerInvitationStatus;
  readonly invitedAt: string;
  readonly expiresAt: string;
  readonly expiredAt: string | null;
  readonly resendCount: number;
  readonly lastSentAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ListCustomerInviteExpiringSoonCandidatesInput {
  readonly now: string;
  readonly expiresBefore: string;
  readonly limit?: number;
}

export interface ListPendingCustomerInvitesReadyToExpireInput {
  readonly now: string;
  readonly limit?: number;
}

export interface ListExpiredCustomerInviteEmailRecoveryCandidatesInput {
  readonly expiredBefore: string;
  readonly limit?: number;
}

export interface ExpirePendingCustomerInviteInput {
  readonly invitationId: string;
  readonly expiredAt: string;
}

function normalizeLimit(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
    return DEFAULT_SCHEDULED_CANDIDATE_LIMIT;
  }

  return Math.min(Math.floor(value), MAX_SCHEDULED_CANDIDATE_LIMIT);
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

function normalizeRequiredIsoTimestamp(
  value: string,
  fieldName: string,
): string {
  const normalizedValue = normalizeOptionalString(value);

  if (!normalizedValue) {
    throw AppError.invalidRequest(`${fieldName} is required.`);
  }

  const timestamp = Date.parse(normalizedValue);

  if (!Number.isFinite(timestamp)) {
    throw AppError.invalidRequest(`${fieldName} must be a valid ISO datetime.`);
  }

  return new Date(timestamp).toISOString();
}

function assertForwardWindow(input: {
  readonly now: string;
  readonly expiresBefore: string;
}): void {
  if (Date.parse(input.expiresBefore) <= Date.parse(input.now)) {
    throw AppError.invalidRequest(
      'expiresBefore must be later than now for expiring-soon invitation discovery.',
    );
  }
}

function mapReadDatabaseError(error: unknown): AppError {
  return AppError.databaseOperationFailed(error);
}

function mapCustomerInvitationTarget(input: {
  readonly invitation: CustomerInvitationRow;
  readonly appUser: AppUserRow;
}): EmailSchedulerCustomerInvitationTarget | null {
  const recipientEmail = normalizeOptionalString(input.invitation.email);

  if (!recipientEmail) {
    return null;
  }

  return {
    invitationId: input.invitation.id,
    appUserId: input.invitation.app_user_id,
    customerProfileId: input.invitation.customer_profile_id,
    recipientEmail,
    recipientName: normalizeOptionalString(input.appUser.full_name),
    recipientTimezone: normalizeOptionalString(input.appUser.timezone),
    invitationStatus: input.invitation.status,
    invitedAt: input.invitation.invited_at,
    expiresAt: input.invitation.expires_at,
    expiredAt: input.invitation.expired_at,
    resendCount: input.invitation.resend_count,
    lastSentAt: input.invitation.last_sent_at,
    createdAt: input.invitation.created_at,
    updatedAt: input.invitation.updated_at,
  };
}

@Injectable()
export class EmailSchedulerRepository {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly adminClient: LAFAMSupabaseClient,
  ) {}

  private async hydrateCustomerInvitationTargets(
    invitations: readonly CustomerInvitationRow[],
  ): Promise<readonly EmailSchedulerCustomerInvitationTarget[]> {
    if (invitations.length === 0) {
      return [];
    }

    const appUserIds = [
      ...new Set(invitations.map((invitation) => invitation.app_user_id)),
    ];

    const { data: appUsers, error } = await this.adminClient
      .from('app_users')
      .select('*')
      .in('id', appUserIds)
      .is('deleted_at', null);

    if (error) {
      throw mapReadDatabaseError(error);
    }

    const appUserById = new Map<string, AppUserRow>(
      (appUsers ?? []).map((appUser) => [appUser.id, appUser]),
    );

    return invitations.flatMap((invitation) => {
      const appUser = appUserById.get(invitation.app_user_id);

      if (!appUser) {
        return [];
      }

      const target = mapCustomerInvitationTarget({
        invitation,
        appUser,
      });

      return target ? [target] : [];
    });
  }

  private async hydrateCustomerInvitationTarget(
    invitation: CustomerInvitationRow,
  ): Promise<EmailSchedulerCustomerInvitationTarget | null> {
    const targets = await this.hydrateCustomerInvitationTargets([invitation]);

    return targets[0] ?? null;
  }

  private async listExistingNotificationEntityIds(input: {
    readonly eventType: EmailNotificationEvent;
    readonly entityIds: readonly string[];
  }): Promise<ReadonlySet<string>> {
    if (input.entityIds.length === 0) {
      return new Set();
    }

    const { data, error } = await this.adminClient
      .from('email_notifications')
      .select('entity_id')
      .eq('event_type', input.eventType)
      .eq('entity_type', EMAIL_NOTIFICATION_ENTITY_TYPE_CUSTOMER_INVITATION)
      .in('entity_id', [...input.entityIds]);

    if (error) {
      throw mapReadDatabaseError(error);
    }

    return new Set(
      (data ?? []).flatMap((notification) =>
        notification.entity_id ? [notification.entity_id] : [],
      ),
    );
  }

  private async filterTargetsWithoutExistingNotification(input: {
    readonly eventType: EmailNotificationEvent;
    readonly targets: readonly EmailSchedulerCustomerInvitationTarget[];
  }): Promise<readonly EmailSchedulerCustomerInvitationTarget[]> {
    const existingNotificationEntityIds =
      await this.listExistingNotificationEntityIds({
        eventType: input.eventType,
        entityIds: input.targets.map((target) => target.invitationId),
      });

    return input.targets.filter(
      (target) => !existingNotificationEntityIds.has(target.invitationId),
    );
  }

  async listCustomerInviteExpiringSoonCandidates(
    input: ListCustomerInviteExpiringSoonCandidatesInput,
  ): Promise<readonly EmailSchedulerCustomerInvitationTarget[]> {
    const now = normalizeRequiredIsoTimestamp(input.now, 'now');
    const expiresBefore = normalizeRequiredIsoTimestamp(
      input.expiresBefore,
      'expiresBefore',
    );

    assertForwardWindow({
      now,
      expiresBefore,
    });

    const limit = normalizeLimit(input.limit);

    const { data, error } = await this.adminClient
      .from('customer_invitations')
      .select('*')
      .eq('status', CUSTOMER_INVITATION_STATUS_PENDING)
      .gt('expires_at', now)
      .lte('expires_at', expiresBefore)
      .order('expires_at', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw mapReadDatabaseError(error);
    }

    const targets = await this.hydrateCustomerInvitationTargets(data ?? []);

    return this.filterTargetsWithoutExistingNotification({
      eventType: EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_EXPIRING_SOON,
      targets,
    });
  }

  async listPendingCustomerInvitesReadyToExpire(
    input: ListPendingCustomerInvitesReadyToExpireInput,
  ): Promise<readonly EmailSchedulerCustomerInvitationTarget[]> {
    const now = normalizeRequiredIsoTimestamp(input.now, 'now');
    const limit = normalizeLimit(input.limit);

    const { data, error } = await this.adminClient
      .from('customer_invitations')
      .select('*')
      .eq('status', CUSTOMER_INVITATION_STATUS_PENDING)
      .lte('expires_at', now)
      .order('expires_at', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw mapReadDatabaseError(error);
    }

    return this.hydrateCustomerInvitationTargets(data ?? []);
  }

  async expirePendingCustomerInvite(
    input: ExpirePendingCustomerInviteInput,
  ): Promise<EmailSchedulerCustomerInvitationTarget | null> {
    const invitationId = normalizeOptionalString(input.invitationId);
    const expiredAt = normalizeRequiredIsoTimestamp(
      input.expiredAt,
      'expiredAt',
    );

    if (!invitationId) {
      throw AppError.invalidRequest('invitationId is required.');
    }

    const updatePayload: CustomerInvitationUpdate = {
      status: CUSTOMER_INVITATION_STATUS_EXPIRED,
      expired_at: expiredAt,
      updated_at: expiredAt,
    };

    const { data, error } = await this.adminClient
      .from('customer_invitations')
      .update(updatePayload)
      .eq('id', invitationId)
      .eq('status', CUSTOMER_INVITATION_STATUS_PENDING)
      .lte('expires_at', expiredAt)
      .select('*')
      .maybeSingle();

    if (error) {
      throw mapReadDatabaseError(error);
    }

    return data ? this.hydrateCustomerInvitationTarget(data) : null;
  }

  async listExpiredCustomerInviteEmailRecoveryCandidates(
    input: ListExpiredCustomerInviteEmailRecoveryCandidatesInput,
  ): Promise<readonly EmailSchedulerCustomerInvitationTarget[]> {
    const expiredBefore = normalizeRequiredIsoTimestamp(
      input.expiredBefore,
      'expiredBefore',
    );
    const limit = normalizeLimit(input.limit);

    const { data, error } = await this.adminClient
      .from('customer_invitations')
      .select('*')
      .eq('status', CUSTOMER_INVITATION_STATUS_EXPIRED)
      .lte('expired_at', expiredBefore)
      .order('expired_at', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw mapReadDatabaseError(error);
    }

    const targets = await this.hydrateCustomerInvitationTargets(data ?? []);

    return this.filterTargetsWithoutExistingNotification({
      eventType: EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_EXPIRED,
      targets,
    });
  }
}
