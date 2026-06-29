// apps/api/src/modules/customers/repositories/customer-invite.repository.ts
/**
 * LAFAM Customer invitation repository.
 *
 * Role:
 * - Owns direct database access for customer_invitations.
 * - Persists hashed invitation tokens only.
 * - Hydrates invitations with app_users and customer_profiles.
 * - Updates invitation lifecycle states: pending, accepted, expired, revoked.
 *
 * Important:
 * - Raw invite tokens must never be stored here.
 * - Token hashes may be stored and queried.
 * - Civil ID must never be written to logs, audit metadata, email metadata, or
 *   provider payloads.
 * - Feature modules must not write customer_invitations directly.
 */

import { Inject, Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { SUPABASE_ADMIN_CLIENT } from '../../../database/database.constants';
import type {
  AppUserRow,
  CustomerInvitationInsert,
  CustomerInvitationRow,
  CustomerInvitationUpdate,
  CustomerProfileRow,
  DatabaseJsonObject,
  LAFAMSupabaseClient,
} from '../../../database/database.types';
import {
  CUSTOMER_INVITATION_STATUS_ACCEPTED,
  CUSTOMER_INVITATION_STATUS_EXPIRED,
  CUSTOMER_INVITATION_STATUS_PENDING,
  CUSTOMER_INVITATION_STATUS_REVOKED,
} from '../constants/customer.constants';
import type {
  CustomerInvitationAcceptRepositoryInput,
  CustomerInvitationCreateRepositoryInput,
  CustomerInvitationExpireRepositoryInput,
  CustomerInvitationRevokeRepositoryInput,
  CustomerInvitationWithCustomer,
  FindCustomerInvitationByIdInput,
  FindCustomerInvitationByTokenHashInput,
  FindLatestCustomerInvitationByAppUserIdInput,
  FindPendingCustomerInvitationByAppUserIdInput,
} from '../types/customer.types';

const POSTGRES_UNIQUE_VIOLATION_CODE = '23505';
const POSTGRES_FOREIGN_KEY_VIOLATION_CODE = '23503';
const POSTGRES_CHECK_VIOLATION_CODE = '23514';
const POSTGRES_NOT_NULL_VIOLATION_CODE = '23502';

interface DatabaseErrorShape {
  readonly code?: string;
  readonly message?: string;
  readonly details?: string | null;
  readonly hint?: string | null;
}

function isDatabaseError(value: unknown): value is DatabaseErrorShape {
  return typeof value === 'object' && value !== null;
}

function databaseErrorText(error: DatabaseErrorShape): string {
  return [error.code, error.message, error.details, error.hint]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase();
}

function mapCustomerInvitationCreateDatabaseError(error: unknown): AppError {
  if (!isDatabaseError(error)) {
    return AppError.customerInviteCreateFailed(error);
  }

  if (error.code === POSTGRES_UNIQUE_VIOLATION_CODE) {
    const errorText = databaseErrorText(error);

    if (
      errorText.includes('customer_invitations_pending_app_user_id_uidx') ||
      errorText.includes('(app_user_id)')
    ) {
      return AppError.customerInviteAlreadyPending(
        'This customer already has a pending invitation.',
      );
    }

    return AppError.customerInviteCreateFailed(error);
  }

  if (error.code === POSTGRES_FOREIGN_KEY_VIOLATION_CODE) {
    return AppError.customerNotFound(
      'The related invited customer was not found.',
    );
  }

  if (
    error.code === POSTGRES_CHECK_VIOLATION_CODE ||
    error.code === POSTGRES_NOT_NULL_VIOLATION_CODE
  ) {
    return AppError.invalidRequest(
      'The customer invitation payload is invalid.',
    );
  }

  return AppError.customerInviteCreateFailed(error);
}

function mapReadDatabaseError(error: unknown): AppError {
  return AppError.databaseOperationFailed(error);
}

function mapCustomerInvitationAcceptDatabaseError(error: unknown): AppError {
  return AppError.customerInviteAcceptFailed(error);
}

function mapCustomerInvitationRevokeDatabaseError(error: unknown): AppError {
  return AppError.customerInviteRevokeFailed(error);
}

function assertCustomerInvitationRow(
  row: CustomerInvitationRow | null,
  details?: Record<string, unknown>,
): CustomerInvitationRow {
  if (!row) {
    throw AppError.customerInviteNotFound(
      'The requested customer invitation was not found.',
      details,
    );
  }

  return row;
}

function assertAppUserRow(
  row: AppUserRow | undefined,
  invitation: CustomerInvitationRow,
): AppUserRow {
  if (!row) {
    throw AppError.customerNotFound(
      'The related invited customer user was not found.',
      {
        customer_invitation_id: invitation.id,
        app_user_id: invitation.app_user_id,
      },
    );
  }

  return row;
}

function assertCustomerProfileRow(
  row: CustomerProfileRow | undefined,
  invitation: CustomerInvitationRow,
): CustomerProfileRow {
  if (!row) {
    throw AppError.customerNotFound(
      'The related invited customer profile was not found.',
      {
        customer_invitation_id: invitation.id,
        app_user_id: invitation.app_user_id,
      },
    );
  }

  return row;
}

function assertCustomerProfileForInvitationCreate(
  row: CustomerProfileRow | null,
  appUserId: string,
): CustomerProfileRow {
  if (!row) {
    throw AppError.customerNotFound(
      'The invited customer profile was not found.',
      {
        app_user_id: appUserId,
      },
    );
  }

  return row;
}

function createCustomerInvitationMetadata(
  input: CustomerInvitationCreateRepositoryInput,
): DatabaseJsonObject {
  return {
    ...(input.metadata ?? {}),
    created_by_admin_id: input.created_by_admin_id,
  };
}

function toCustomerInvitationInsert(
  input: CustomerInvitationCreateRepositoryInput,
  customerProfileId: string,
): CustomerInvitationInsert {
  return {
    app_user_id: input.app_user_id,
    customer_profile_id: customerProfileId,
    email: input.email,
    token_hash: input.token_hash,
    status: input.status,
    expires_at: input.expires_at,
    metadata: createCustomerInvitationMetadata(input),
  };
}

@Injectable()
export class CustomerInviteRepository {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly adminClient: LAFAMSupabaseClient,
  ) {}

  private async getCustomerProfileForInvitationCreate(
    appUserId: string,
  ): Promise<CustomerProfileRow> {
    const { data, error } = await this.adminClient
      .from('customer_profiles')
      .select('*')
      .eq('app_user_id', appUserId)
      .maybeSingle();

    if (error) {
      throw mapReadDatabaseError(error);
    }

    return assertCustomerProfileForInvitationCreate(data, appUserId);
  }

  private async hydrateInvitationRows(
    invitations: readonly CustomerInvitationRow[],
  ): Promise<readonly CustomerInvitationWithCustomer[]> {
    if (invitations.length === 0) {
      return [];
    }

    const appUserIds = [
      ...new Set(invitations.map((invitation) => invitation.app_user_id)),
    ];

    const { data: appUsers, error: appUsersError } = await this.adminClient
      .from('app_users')
      .select('*')
      .in('id', appUserIds);

    if (appUsersError) {
      throw mapReadDatabaseError(appUsersError);
    }

    const { data: profiles, error: profilesError } = await this.adminClient
      .from('customer_profiles')
      .select('*')
      .in('app_user_id', appUserIds);

    if (profilesError) {
      throw mapReadDatabaseError(profilesError);
    }

    const appUserById = new Map<string, AppUserRow>(
      (appUsers ?? []).map((appUser) => [appUser.id, appUser]),
    );
    const profileByAppUserId = new Map<string, CustomerProfileRow>(
      (profiles ?? []).map((profile) => [profile.app_user_id, profile]),
    );

    return invitations.map((invitation) => {
      const appUser = assertAppUserRow(
        appUserById.get(invitation.app_user_id),
        invitation,
      );
      const profile = assertCustomerProfileRow(
        profileByAppUserId.get(invitation.app_user_id),
        invitation,
      );

      return {
        invitation,
        profile,
        app_user: appUser,
      };
    });
  }

  private async hydrateInvitationRow(
    invitation: CustomerInvitationRow,
  ): Promise<CustomerInvitationWithCustomer> {
    const hydratedInvitations = await this.hydrateInvitationRows([invitation]);
    const hydratedInvitation = hydratedInvitations[0];

    if (!hydratedInvitation) {
      throw AppError.customerInviteNotFound(
        'The requested customer invitation was not found.',
        {
          customer_invitation_id: invitation.id,
        },
      );
    }

    return hydratedInvitation;
  }

  private async findRawById(
    invitationId: string,
  ): Promise<CustomerInvitationRow | null> {
    const { data, error } = await this.adminClient
      .from('customer_invitations')
      .select('*')
      .eq('id', invitationId)
      .maybeSingle();

    if (error) {
      throw mapReadDatabaseError(error);
    }

    return data;
  }

  private async assertPendingMutationTarget(
    invitationId: string,
  ): Promise<never> {
    const invitation = await this.findRawById(invitationId);

    if (!invitation) {
      throw AppError.customerInviteNotFound(
        'The requested customer invitation was not found.',
        {
          customer_invitation_id: invitationId,
        },
      );
    }

    if (invitation.status === CUSTOMER_INVITATION_STATUS_ACCEPTED) {
      throw AppError.customerInviteAlreadyAccepted(
        'This invitation has already been accepted.',
        {
          customer_invitation_id: invitationId,
        },
      );
    }

    if (invitation.status === CUSTOMER_INVITATION_STATUS_EXPIRED) {
      throw AppError.customerInviteExpired('This invitation has expired.', {
        customer_invitation_id: invitationId,
      });
    }

    if (invitation.status === CUSTOMER_INVITATION_STATUS_REVOKED) {
      throw AppError.customerInviteRevoked(
        'This invitation has been revoked.',
        {
          customer_invitation_id: invitationId,
        },
      );
    }

    throw AppError.customerInviteNotFound(
      'The requested pending customer invitation was not found.',
      {
        customer_invitation_id: invitationId,
      },
    );
  }

  async create(
    input: CustomerInvitationCreateRepositoryInput,
  ): Promise<CustomerInvitationWithCustomer> {
    const customerProfile = await this.getCustomerProfileForInvitationCreate(
      input.app_user_id,
    );
    const insertPayload = toCustomerInvitationInsert(input, customerProfile.id);

    const { data, error } = await this.adminClient
      .from('customer_invitations')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      throw mapCustomerInvitationCreateDatabaseError(error);
    }

    return this.hydrateInvitationRow(assertCustomerInvitationRow(data));
  }

  async findById(
    input: FindCustomerInvitationByIdInput,
  ): Promise<CustomerInvitationWithCustomer | null> {
    const invitation = await this.findRawById(input.invitationId);

    return invitation ? this.hydrateInvitationRow(invitation) : null;
  }

  async getById(
    input: FindCustomerInvitationByIdInput,
  ): Promise<CustomerInvitationWithCustomer> {
    const invitation = await this.findById(input);

    if (!invitation) {
      throw AppError.customerInviteNotFound(
        'The requested customer invitation was not found.',
        {
          customer_invitation_id: input.invitationId,
        },
      );
    }

    return invitation;
  }

  async findByTokenHash(
    input: FindCustomerInvitationByTokenHashInput,
  ): Promise<CustomerInvitationWithCustomer | null> {
    const { data, error } = await this.adminClient
      .from('customer_invitations')
      .select('*')
      .eq('token_hash', input.tokenHash)
      .maybeSingle();

    if (error) {
      throw mapReadDatabaseError(error);
    }

    return data ? this.hydrateInvitationRow(data) : null;
  }

  async findPendingByAppUserId(
    input: FindPendingCustomerInvitationByAppUserIdInput,
  ): Promise<CustomerInvitationWithCustomer | null> {
    const { data, error } = await this.adminClient
      .from('customer_invitations')
      .select('*')
      .eq('app_user_id', input.appUserId)
      .eq('status', CUSTOMER_INVITATION_STATUS_PENDING)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw mapReadDatabaseError(error);
    }

    return data ? this.hydrateInvitationRow(data) : null;
  }

  async findLatestByAppUserId(
    input: FindLatestCustomerInvitationByAppUserIdInput,
  ): Promise<CustomerInvitationWithCustomer | null> {
    const { data, error } = await this.adminClient
      .from('customer_invitations')
      .select('*')
      .eq('app_user_id', input.appUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw mapReadDatabaseError(error);
    }

    return data ? this.hydrateInvitationRow(data) : null;
  }

  async accept(
    input: CustomerInvitationAcceptRepositoryInput,
  ): Promise<CustomerInvitationWithCustomer> {
    const updatePayload: CustomerInvitationUpdate = {
      status: CUSTOMER_INVITATION_STATUS_ACCEPTED,
      accepted_at: input.accepted_at,
      updated_at: input.accepted_at,
    };

    const { data, error } = await this.adminClient
      .from('customer_invitations')
      .update(updatePayload)
      .eq('id', input.invitation_id)
      .eq('status', CUSTOMER_INVITATION_STATUS_PENDING)
      .select('*')
      .maybeSingle();

    if (error) {
      throw mapCustomerInvitationAcceptDatabaseError(error);
    }

    if (!data) {
      return this.assertPendingMutationTarget(input.invitation_id);
    }

    return this.hydrateInvitationRow(data);
  }

  async expire(
    input: CustomerInvitationExpireRepositoryInput,
  ): Promise<CustomerInvitationWithCustomer> {
    const updatePayload: CustomerInvitationUpdate = {
      status: CUSTOMER_INVITATION_STATUS_EXPIRED,
      expired_at: input.expired_at,
      updated_at: input.expired_at,
    };

    const { data, error } = await this.adminClient
      .from('customer_invitations')
      .update(updatePayload)
      .eq('id', input.invitation_id)
      .eq('status', CUSTOMER_INVITATION_STATUS_PENDING)
      .select('*')
      .maybeSingle();

    if (error) {
      throw mapReadDatabaseError(error);
    }

    if (!data) {
      return this.assertPendingMutationTarget(input.invitation_id);
    }

    return this.hydrateInvitationRow(data);
  }

  async revoke(
    input: CustomerInvitationRevokeRepositoryInput,
  ): Promise<CustomerInvitationWithCustomer> {
    const updatePayload: CustomerInvitationUpdate = {
      status: CUSTOMER_INVITATION_STATUS_REVOKED,
      revoked_at: input.revoked_at,
      revoked_by_admin_id: input.revoked_by_admin_id,
      updated_at: input.revoked_at,
    };

    const { data, error } = await this.adminClient
      .from('customer_invitations')
      .update(updatePayload)
      .eq('id', input.invitation_id)
      .eq('status', CUSTOMER_INVITATION_STATUS_PENDING)
      .select('*')
      .maybeSingle();

    if (error) {
      throw mapCustomerInvitationRevokeDatabaseError(error);
    }

    if (!data) {
      return this.assertPendingMutationTarget(input.invitation_id);
    }

    return this.hydrateInvitationRow(data);
  }

  async deleteByIdForRollback(invitationId: string): Promise<void> {
    const { error } = await this.adminClient
      .from('customer_invitations')
      .delete()
      .eq('id', invitationId);

    if (error) {
      throw mapReadDatabaseError(error);
    }
  }
}
