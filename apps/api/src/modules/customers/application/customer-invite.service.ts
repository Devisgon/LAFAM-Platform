// apps/api/src/modules/customers/application/customer-invite.service.ts
/**
 * LAFAM Customer invitation service.
 *
 * Role:
 * - Creates invited customer accounts when admin omits password.
 * - Generates secure invite tokens and stores only token hashes.
 * - Sends customer invite emails through the NotificationsModule.
 * - Accepts public invite tokens and activates invited customer accounts.
 * - Supports admin resend/revoke invitation flows.
 *
 * Important:
 * - Raw invite tokens are never stored in the database.
 * - Raw invite tokens are never written to audit metadata, notification metadata,
 *   logs, or provider payloads.
 * - Civil ID is stored only in customer_profiles and returned only in admin-safe
 *   customer responses.
 * - Civil ID must never be written to audit metadata, email metadata, or provider
 *   metadata.
 * - Passwords are never returned, logged, emailed, or stored in LAFAM tables.
 */

import { Injectable } from '@nestjs/common';

import { currentEmailConfig } from '../../../common/config/email.config';
import { AppError } from '../../../common/errors/app-error';
import type { DatabaseJsonObject } from '../../../database/database.types';
import {
  AUTH_ERROR_REASON_PASSWORD_CONFIRMATION_MISMATCH,
  AUTH_ERROR_REASON_PASSWORD_POLICY_FAILED,
} from '../../auth/constants/auth-error.constants';
import {
  AUTH_AUDIT_EVENT_CUSTOMER_PROFILE_CREATED,
  AUTH_AUDIT_EVENT_PASSWORD_CHANGED,
  AUTH_AUDIT_EVENT_USER_CREATED_BY_ADMIN,
} from '../../auth/constants/auth.constants';
import { AuthAuditRepository } from '../../auth/repositories/auth-audit.repository';
import { AuthUserRepository } from '../../auth/repositories/auth-user.repository';
import { SupabaseAuthRepository } from '../../auth/repositories/supabase-auth.repository';
import { normalizeAuthCivilIdNormalized } from '../../auth/utils/auth-normalization.util';
import {
  getAuthPasswordPolicyFailureCodes,
  validateAuthPasswordAndConfirmation,
} from '../../auth/utils/password-policy.util';
import { EmailNotificationService } from '../../notifications/application/email-notification.service';
import {
  EMAIL_NOTIFICATION_ENTITY_TYPE_CUSTOMER_INVITATION,
  EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_ACCEPTED,
  EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_CREATED,
  EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_RESENT,
  EMAIL_RECIPIENT_ROLE_CUSTOMER,
} from '../../notifications/constants/notification.constants';
import { createCustomerInvitationEmailIdempotencyKey } from '../../notifications/domain/email-idempotency.policy';
import {
  CUSTOMER_APP_ROLE,
  CUSTOMER_AUDIT_METADATA_APP_USER_ID_KEY,
  CUSTOMER_AUDIT_METADATA_CREATED_BY_ADMIN_ID_KEY,
  CUSTOMER_AUDIT_METADATA_CUSTOMER_INVITATION_ID_KEY,
  CUSTOMER_AUDIT_METADATA_CUSTOMER_PROFILE_ID_KEY,
  CUSTOMER_AUTH_METADATA_CREATED_BY_ADMIN_ID_KEY,
  CUSTOMER_AUTH_METADATA_SOURCE_ADMIN_CUSTOMER_INVITE,
  CUSTOMER_AUTH_METADATA_SOURCE_KEY,
  CUSTOMER_AUTH_STATUS_ACTIVE,
  CUSTOMER_AUTH_STATUS_DEACTIVATED,
  CUSTOMER_AUTH_STATUS_DELETED,
  CUSTOMER_AUTH_STATUS_INVITED,
  CUSTOMER_AUTH_STATUS_PENDING_EMAIL_VERIFICATION,
  CUSTOMER_CIVIL_ID_NORMALIZED_LENGTH,
  CUSTOMER_INVITATION_STATUS_ACCEPTED,
  CUSTOMER_INVITATION_STATUS_EXPIRED,
  CUSTOMER_INVITATION_STATUS_PENDING,
  CUSTOMER_INVITATION_STATUS_REVOKED,
  CUSTOMER_INVITE_AUTH_STATUS,
  type CustomerAuthStatus,
  type CustomerInvitationStatus,
} from '../constants/customer.constants';
import { CustomerInviteRepository } from '../repositories/customer-invite.repository';
import { CustomerRepository } from '../repositories/customer.repository';
import type {
  CustomerAcceptInvitationInput,
  CustomerCreateInput,
  CustomerInvitationAcceptResult,
  CustomerInvitationMutationResult,
  CustomerInvitationWithCustomer,
  CustomerProfileWithUser,
  CustomerRevokeInvitationInput,
  SafeCustomerInvitation,
  SafeCustomerProfile,
} from '../types/customer.types';
import {
  createCustomerInviteExpiresAt,
  createCustomerInviteLink,
  createCustomerInviteToken,
  hashCustomerInviteToken,
  isCustomerInviteExpired,
} from '../utils/customer-invite-token.util';

export interface CreateInvitedCustomerInput {
  readonly adminUserId: string;
  readonly customer: CustomerCreateInput;
}

export interface ResendCustomerInvitationInput {
  readonly invitation_id: string;
  readonly resent_by_admin_id: string;
}

type RevokeCustomerInvitationInput = CustomerRevokeInvitationInput;

interface MutableCustomerInvitationCreationRollbackState {
  auth_user_id: string | null;
  app_user_id: string | null;
  customer_profile_id: string | null;
  customer_invitation_id: string | null;
}

function resolveRequiredCivilIdNormalized(civilId: string): string {
  const civilIdNormalized = normalizeAuthCivilIdNormalized(civilId);

  if (
    !civilIdNormalized ||
    civilIdNormalized.length !== CUSTOMER_CIVIL_ID_NORMALIZED_LENGTH
  ) {
    throw AppError.validationFailed(
      'civil_id must contain exactly 12 digits and may include spaces or hyphens.',
      {
        field: 'civil_id',
      },
    );
  }

  return civilIdNormalized;
}

function buildPasswordFailureDetails(
  failures: readonly { readonly code: string; readonly message: string }[],
  failureCodes: readonly string[],
): DatabaseJsonObject {
  return {
    reason: failureCodes.includes(
      AUTH_ERROR_REASON_PASSWORD_CONFIRMATION_MISMATCH,
    )
      ? AUTH_ERROR_REASON_PASSWORD_CONFIRMATION_MISMATCH
      : AUTH_ERROR_REASON_PASSWORD_POLICY_FAILED,
    failures: failures.map((failure) => ({
      code: failure.code,
      message: failure.message,
    })),
  };
}

function assertInvitePasswordAllowed(input: {
  readonly password: string;
  readonly confirmPassword: string;
  readonly email: string;
  readonly fullName: string;
}): void {
  const result = validateAuthPasswordAndConfirmation(
    input.password,
    input.confirmPassword,
    {
      email: input.email,
      fullName: input.fullName,
    },
  );

  if (result.valid) {
    return;
  }

  const failureCodes = getAuthPasswordPolicyFailureCodes(result);

  if (failureCodes.includes(AUTH_ERROR_REASON_PASSWORD_CONFIRMATION_MISMATCH)) {
    throw AppError.passwordConfirmationMismatch(
      'Password confirmation does not match.',
    );
  }

  throw AppError.passwordPolicyFailed(
    'The customer password does not meet security requirements.',
    buildPasswordFailureDetails(result.failures, failureCodes),
  );
}

function hasProvidedPasswordField(value: string | null | undefined): boolean {
  return value !== null && typeof value !== 'undefined';
}

function assertPasswordFieldsOmittedForInvite(
  customer: CustomerCreateInput,
): void {
  if (
    !hasProvidedPasswordField(customer.password) &&
    !hasProvidedPasswordField(customer.confirm_password)
  ) {
    return;
  }

  throw AppError.invalidRequest(
    'Password and confirm_password must be omitted when creating an invited customer.',
    {
      mode: 'invite_without_password',
    },
  );
}

function resolveRequiredCustomerString(input: {
  readonly value: string | null;
  readonly publicMessage: string;
  readonly details: Record<string, unknown>;
}): string {
  if (input.value) {
    return input.value;
  }

  throw AppError.customerNotFound(input.publicMessage, input.details);
}

function resolveCustomerAuthStatus(value: string): CustomerAuthStatus {
  switch (value) {
    case CUSTOMER_AUTH_STATUS_PENDING_EMAIL_VERIFICATION:
    case CUSTOMER_AUTH_STATUS_INVITED:
    case CUSTOMER_AUTH_STATUS_ACTIVE:
    case CUSTOMER_AUTH_STATUS_DEACTIVATED:
    case CUSTOMER_AUTH_STATUS_DELETED:
      return value;
    default:
      throw AppError.customerNotFound(
        'The stored customer auth status is invalid.',
      );
  }
}

function resolveCustomerInvitationStatus(
  value: string,
): CustomerInvitationStatus {
  switch (value) {
    case CUSTOMER_INVITATION_STATUS_PENDING:
    case CUSTOMER_INVITATION_STATUS_ACCEPTED:
    case CUSTOMER_INVITATION_STATUS_EXPIRED:
    case CUSTOMER_INVITATION_STATUS_REVOKED:
      return value;
    default:
      throw AppError.customerInviteNotFound(
        'The stored customer invitation status is invalid.',
      );
  }
}

function assertHydratedCustomerIsCustomer(
  customer: CustomerProfileWithUser,
): void {
  if (
    customer.app_user.role !== CUSTOMER_APP_ROLE ||
    customer.app_user.is_guest !== false
  ) {
    throw AppError.customerNotFound('The requested customer was not found.', {
      customer_profile_id: customer.profile.id,
      app_user_id: customer.app_user.id,
    });
  }
}

function assertInvitationCustomerIsUsable(
  invitation: CustomerInvitationWithCustomer,
): void {
  assertHydratedCustomerIsCustomer(invitation);

  if (
    invitation.profile.deleted_at !== null ||
    invitation.app_user.status === CUSTOMER_AUTH_STATUS_DELETED ||
    invitation.app_user.deleted_at !== null
  ) {
    throw AppError.customerAlreadyDeleted();
  }
}

function mapCustomerToSafeResponse(
  customer: CustomerProfileWithUser,
): SafeCustomerProfile {
  assertHydratedCustomerIsCustomer(customer);

  return {
    id: customer.profile.id,
    app_user_id: customer.app_user.id,
    auth_user_id: resolveRequiredCustomerString({
      value: customer.app_user.auth_user_id,
      publicMessage: 'The related customer auth identity was not found.',
      details: {
        customer_profile_id: customer.profile.id,
        app_user_id: customer.app_user.id,
      },
    }),
    email: resolveRequiredCustomerString({
      value: customer.app_user.email,
      publicMessage: 'The related customer email was not found.',
      details: {
        customer_profile_id: customer.profile.id,
        app_user_id: customer.app_user.id,
      },
    }),
    phone: resolveRequiredCustomerString({
      value: customer.app_user.phone,
      publicMessage: 'The related customer phone number was not found.',
      details: {
        customer_profile_id: customer.profile.id,
        app_user_id: customer.app_user.id,
      },
    }),
    full_name: resolveRequiredCustomerString({
      value: customer.app_user.full_name,
      publicMessage: 'The related customer full name was not found.',
      details: {
        customer_profile_id: customer.profile.id,
        app_user_id: customer.app_user.id,
      },
    }),
    civil_id: customer.profile.civil_id,
    role: CUSTOMER_APP_ROLE,
    auth_status: resolveCustomerAuthStatus(customer.app_user.status),
    is_guest: false,
    avatar_path: customer.app_user.avatar_path,
    timezone: customer.app_user.timezone,
    created_by_admin_id: customer.profile.created_by_admin_id,
    updated_by_admin_id: customer.profile.updated_by_admin_id,
    created_at: customer.profile.created_at,
    updated_at: customer.profile.updated_at,
    deactivated_at: customer.app_user.deactivated_at,
    deleted_at: customer.profile.deleted_at ?? customer.app_user.deleted_at,
  };
}

function getMetadataString(
  metadata: DatabaseJsonObject,
  key: string,
): string | null {
  const value = metadata[key];

  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function resolveInvitationCreatedByAdminId(
  invitation: CustomerInvitationWithCustomer,
): string {
  const createdByAdminId = getMetadataString(
    invitation.invitation.metadata,
    CUSTOMER_AUDIT_METADATA_CREATED_BY_ADMIN_ID_KEY,
  );

  if (createdByAdminId) {
    return createdByAdminId;
  }

  throw AppError.customerInviteNotFound(
    'The stored customer invitation creator metadata is missing.',
    {
      customer_invitation_id: invitation.invitation.id,
    },
  );
}

function mapInvitationToSafeResponse(
  invitation: CustomerInvitationWithCustomer,
): SafeCustomerInvitation {
  const status = resolveCustomerInvitationStatus(invitation.invitation.status);

  return {
    id: invitation.invitation.id,
    app_user_id: invitation.invitation.app_user_id,
    email: invitation.invitation.email,
    status,
    expires_at: invitation.invitation.expires_at,
    accepted_at: invitation.invitation.accepted_at,
    expired_at: invitation.invitation.expired_at,
    revoked_at: invitation.invitation.revoked_at,
    created_by_admin_id: resolveInvitationCreatedByAdminId(invitation),
    accepted_by_app_user_id:
      status === CUSTOMER_INVITATION_STATUS_ACCEPTED
        ? invitation.invitation.app_user_id
        : null,
    revoked_by_admin_id: invitation.invitation.revoked_by_admin_id,
    created_at: invitation.invitation.created_at,
    updated_at: invitation.invitation.updated_at,
  };
}

function buildCustomerAuditMetadata(input: {
  readonly customerProfileId: string;
  readonly appUserId: string;
  readonly adminUserId?: string | null;
  readonly customerInvitationId?: string | null;
}): DatabaseJsonObject {
  return {
    [CUSTOMER_AUDIT_METADATA_CUSTOMER_PROFILE_ID_KEY]: input.customerProfileId,
    [CUSTOMER_AUDIT_METADATA_APP_USER_ID_KEY]: input.appUserId,
    ...(input.adminUserId
      ? {
          [CUSTOMER_AUDIT_METADATA_CREATED_BY_ADMIN_ID_KEY]: input.adminUserId,
        }
      : {}),
    ...(input.customerInvitationId
      ? {
          [CUSTOMER_AUDIT_METADATA_CUSTOMER_INVITATION_ID_KEY]:
            input.customerInvitationId,
        }
      : {}),
  };
}

function buildCustomerInvitationEmailMetadata(input: {
  readonly customerInvitationId: string;
  readonly appUserId: string;
  readonly adminUserId?: string | null;
}): DatabaseJsonObject {
  return {
    [CUSTOMER_AUDIT_METADATA_CUSTOMER_INVITATION_ID_KEY]:
      input.customerInvitationId,
    [CUSTOMER_AUDIT_METADATA_APP_USER_ID_KEY]: input.appUserId,
    ...(input.adminUserId
      ? {
          [CUSTOMER_AUDIT_METADATA_CREATED_BY_ADMIN_ID_KEY]: input.adminUserId,
        }
      : {}),
  };
}

function resolveRequiredAuthUserId(customer: CustomerProfileWithUser): string {
  return resolveRequiredCustomerString({
    value: customer.app_user.auth_user_id,
    publicMessage: 'The related customer auth identity was not found.',
    details: {
      customer_profile_id: customer.profile.id,
      app_user_id: customer.app_user.id,
    },
  });
}

function assertInvitationPendingForMutation(
  invitation: CustomerInvitationWithCustomer,
): void {
  if (invitation.invitation.status === CUSTOMER_INVITATION_STATUS_PENDING) {
    return;
  }

  if (invitation.invitation.status === CUSTOMER_INVITATION_STATUS_ACCEPTED) {
    throw AppError.customerInviteAlreadyAccepted(
      'This invitation has already been accepted.',
      {
        customer_invitation_id: invitation.invitation.id,
      },
    );
  }

  if (invitation.invitation.status === CUSTOMER_INVITATION_STATUS_EXPIRED) {
    throw AppError.customerInviteExpired('This invitation has expired.', {
      customer_invitation_id: invitation.invitation.id,
    });
  }

  if (invitation.invitation.status === CUSTOMER_INVITATION_STATUS_REVOKED) {
    throw AppError.customerInviteRevoked('This invitation has been revoked.', {
      customer_invitation_id: invitation.invitation.id,
    });
  }

  throw AppError.customerInviteNotFound(
    'The requested pending customer invitation was not found.',
    {
      customer_invitation_id: invitation.invitation.id,
    },
  );
}

function assertInvitationCustomerStillInvited(
  invitation: CustomerInvitationWithCustomer,
): void {
  const status = resolveCustomerAuthStatus(invitation.app_user.status);

  if (status === CUSTOMER_AUTH_STATUS_INVITED) {
    return;
  }

  if (status === CUSTOMER_AUTH_STATUS_ACTIVE) {
    throw AppError.customerInviteAlreadyAccepted(
      'This invitation has already been accepted.',
      {
        customer_invitation_id: invitation.invitation.id,
        app_user_id: invitation.app_user.id,
      },
    );
  }

  throw AppError.customerInviteAcceptFailed(
    new Error('Customer account is not in invited status.'),
  );
}

@Injectable()
export class CustomerInviteService {
  constructor(
    private readonly customerRepository: CustomerRepository,
    private readonly customerInviteRepository: CustomerInviteRepository,
    private readonly authUserRepository: AuthUserRepository,
    private readonly supabaseAuthRepository: SupabaseAuthRepository,
    private readonly authAuditRepository: AuthAuditRepository,
    private readonly emailNotificationService: EmailNotificationService,
  ) {}

  async createInvitedCustomer(
    input: CreateInvitedCustomerInput,
  ): Promise<CustomerInvitationMutationResult> {
    assertPasswordFieldsOmittedForInvite(input.customer);

    const civilIdNormalized = resolveRequiredCivilIdNormalized(
      input.customer.civil_id,
    );

    await this.assertCustomerCreateIdentityAvailable({
      email: input.customer.email,
      phone: input.customer.phone,
      civilIdNormalized,
    });

    const rollbackState: MutableCustomerInvitationCreationRollbackState = {
      auth_user_id: null,
      app_user_id: null,
      customer_profile_id: null,
      customer_invitation_id: null,
    };

    const authUserResult =
      await this.supabaseAuthRepository.createCustomerAuthUserForInvite({
        email: input.customer.email,
        fullName: input.customer.full_name,
        phone: input.customer.phone,
        timezone: input.customer.timezone ?? null,
        createdByAdminId: input.adminUserId,
      });

    rollbackState.auth_user_id = authUserResult.user.id;

    try {
      const customer = await this.customerRepository.createCustomer({
        app_user: {
          auth_user_id: authUserResult.user.id,
          email: input.customer.email,
          phone: input.customer.phone,
          full_name: input.customer.full_name,
          role: CUSTOMER_APP_ROLE,
          status: CUSTOMER_INVITE_AUTH_STATUS,
          is_guest: false,
          timezone: input.customer.timezone ?? null,
          metadata: {
            [CUSTOMER_AUTH_METADATA_SOURCE_KEY]:
              CUSTOMER_AUTH_METADATA_SOURCE_ADMIN_CUSTOMER_INVITE,
            [CUSTOMER_AUTH_METADATA_CREATED_BY_ADMIN_ID_KEY]: input.adminUserId,
          },
        },
        customer_profile: {
          civil_id: input.customer.civil_id,
          civil_id_normalized: civilIdNormalized,
          created_by_admin_id: input.adminUserId,
          updated_by_admin_id: input.adminUserId,
        },
      });

      rollbackState.app_user_id = customer.app_user.id;
      rollbackState.customer_profile_id = customer.profile.id;

      const invitation = await this.createInvitationAndSendEmail({
        customer,
        adminUserId: input.adminUserId,
        eventType: EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_CREATED,
      });

      rollbackState.customer_invitation_id = invitation.invitation.id;

      await this.createCustomerCreatedAuditEvents({
        customer,
        adminUserId: input.adminUserId,
        customerInvitationId: invitation.invitation.id,
      });

      return {
        customer: mapCustomerToSafeResponse(customer),
        invitation: mapInvitationToSafeResponse(invitation),
      };
    } catch (error: unknown) {
      await this.cleanupInvitationCreation(rollbackState);

      if (error instanceof AppError) {
        throw error;
      }

      throw AppError.customerInviteCreateFailed(error);
    }
  }

  async acceptCustomerInvitation(
    input: CustomerAcceptInvitationInput,
  ): Promise<CustomerInvitationAcceptResult> {
    assertInvitePasswordAllowed({
      password: input.password,
      confirmPassword: input.confirm_password,
      email: '',
      fullName: '',
    });

    const tokenHash = hashCustomerInviteToken(input.token);
    const invitation = await this.customerInviteRepository.findByTokenHash({
      tokenHash,
    });

    if (!invitation) {
      throw AppError.customerInviteTokenInvalid(
        'The invitation token is invalid.',
      );
    }

    assertInvitationCustomerIsUsable(invitation);
    assertInvitationPendingForMutation(invitation);

    if (
      isCustomerInviteExpired({
        expiresAt: invitation.invitation.expires_at,
      })
    ) {
      const expiredInvitation = await this.customerInviteRepository.expire({
        invitation_id: invitation.invitation.id,
        expired_at: new Date().toISOString(),
      });

      throw AppError.customerInviteExpired('This invitation has expired.', {
        customer_invitation_id: expiredInvitation.invitation.id,
      });
    }

    assertInvitationCustomerStillInvited(invitation);

    assertInvitePasswordAllowed({
      password: input.password,
      confirmPassword: input.confirm_password,
      email: invitation.app_user.email ?? invitation.invitation.email,
      fullName: invitation.app_user.full_name ?? '',
    });

    await this.supabaseAuthRepository.setCustomerInviteAuthUserPassword({
      authUserId: resolveRequiredAuthUserId(invitation),
      password: input.password,
    });

    const customer = await this.customerRepository.activateInvitedCustomer({
      app_user_id: invitation.app_user.id,
    });

    const acceptedInvitation = await this.customerInviteRepository.accept({
      invitation_id: invitation.invitation.id,
      accepted_at: new Date().toISOString(),
      accepted_by_app_user_id: invitation.app_user.id,
    });

    await this.runInviteAcceptedSideEffects({
      customer,
      invitation: acceptedInvitation,
    });

    return {
      customer: mapCustomerToSafeResponse(customer),
      invitation: mapInvitationToSafeResponse(acceptedInvitation),
    };
  }

  async resendCustomerInvitation(
    input: ResendCustomerInvitationInput,
  ): Promise<CustomerInvitationMutationResult> {
    const invitation = await this.customerInviteRepository.getById({
      invitationId: input.invitation_id,
    });

    assertInvitationCustomerIsUsable(invitation);
    assertInvitationCustomerStillInvited(invitation);

    if (invitation.invitation.status === CUSTOMER_INVITATION_STATUS_ACCEPTED) {
      throw AppError.customerInviteAlreadyAccepted(
        'This invitation has already been accepted.',
        {
          customer_invitation_id: invitation.invitation.id,
        },
      );
    }

    if (invitation.invitation.status === CUSTOMER_INVITATION_STATUS_REVOKED) {
      throw AppError.customerInviteRevoked(
        'This invitation has been revoked.',
        {
          customer_invitation_id: invitation.invitation.id,
        },
      );
    }

    if (invitation.invitation.status === CUSTOMER_INVITATION_STATUS_PENDING) {
      if (
        isCustomerInviteExpired({
          expiresAt: invitation.invitation.expires_at,
        })
      ) {
        await this.customerInviteRepository.expire({
          invitation_id: invitation.invitation.id,
          expired_at: new Date().toISOString(),
        });
      } else {
        await this.customerInviteRepository.revoke({
          invitation_id: invitation.invitation.id,
          revoked_at: new Date().toISOString(),
          revoked_by_admin_id: input.resent_by_admin_id,
        });
      }
    }

    const customer: CustomerProfileWithUser = {
      profile: invitation.profile,
      app_user: invitation.app_user,
    };

    const newInvitation = await this.createInvitationAndSendEmail({
      customer,
      adminUserId: input.resent_by_admin_id,
      eventType: EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_RESENT,
    });

    return {
      customer: mapCustomerToSafeResponse(customer),
      invitation: mapInvitationToSafeResponse(newInvitation),
    };
  }

  async revokeCustomerInvitation(
    input: RevokeCustomerInvitationInput,
  ): Promise<CustomerInvitationMutationResult> {
    const invitation = await this.customerInviteRepository.getById({
      invitationId: input.invitation_id,
    });

    assertInvitationCustomerIsUsable(invitation);
    assertInvitationPendingForMutation(invitation);

    if (
      isCustomerInviteExpired({
        expiresAt: invitation.invitation.expires_at,
      })
    ) {
      const expiredInvitation = await this.customerInviteRepository.expire({
        invitation_id: invitation.invitation.id,
        expired_at: new Date().toISOString(),
      });

      throw AppError.customerInviteExpired('This invitation has expired.', {
        customer_invitation_id: expiredInvitation.invitation.id,
      });
    }

    const revokedInvitation = await this.customerInviteRepository.revoke({
      invitation_id: input.invitation_id,
      revoked_at: new Date().toISOString(),
      revoked_by_admin_id: input.revoked_by_admin_id,
    });

    return {
      customer: mapCustomerToSafeResponse({
        profile: revokedInvitation.profile,
        app_user: revokedInvitation.app_user,
      }),
      invitation: mapInvitationToSafeResponse(revokedInvitation),
    };
  }

  private async assertCustomerCreateIdentityAvailable(input: {
    readonly email: string;
    readonly phone: string;
    readonly civilIdNormalized: string;
  }): Promise<void> {
    const existingEmailUser = await this.authUserRepository.findByEmail({
      email: input.email,
    });

    if (existingEmailUser) {
      throw AppError.customerEmailAlreadyExists(undefined, {
        field: 'email',
      });
    }

    const existingPhoneUser = await this.authUserRepository.findByPhone({
      phone: input.phone,
    });

    if (existingPhoneUser) {
      throw AppError.customerPhoneAlreadyExists(undefined, {
        field: 'phone',
      });
    }

    const existingCivilIdCustomer =
      await this.customerRepository.findByCivilIdNormalized({
        civilIdNormalized: input.civilIdNormalized,
        includeDeleted: true,
      });

    if (existingCivilIdCustomer) {
      throw AppError.customerCivilIdAlreadyExists(undefined, {
        field: 'civil_id',
      });
    }
  }

  private async createInvitationAndSendEmail(input: {
    readonly customer: CustomerProfileWithUser;
    readonly adminUserId: string;
    readonly eventType:
      | typeof EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_CREATED
      | typeof EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_RESENT;
  }): Promise<CustomerInvitationWithCustomer> {
    const inviteToken = createCustomerInviteToken();
    const expiresAt = createCustomerInviteExpiresAt({
      ttlHours: currentEmailConfig.customerInvite.tokenTtlHours,
    });
    const inviteLink = createCustomerInviteLink({
      acceptUrlBase: currentEmailConfig.customerInvite.acceptUrlBase,
      token: inviteToken.token,
      tokenHash: inviteToken.token_hash,
      expiresAt,
    });

    const invitation = await this.customerInviteRepository.create({
      app_user_id: input.customer.app_user.id,
      email: resolveRequiredCustomerString({
        value: input.customer.app_user.email,
        publicMessage: 'The related customer email was not found.',
        details: {
          customer_profile_id: input.customer.profile.id,
          app_user_id: input.customer.app_user.id,
        },
      }),
      token_hash: inviteLink.token_hash,
      status: CUSTOMER_INVITATION_STATUS_PENDING,
      expires_at: inviteLink.expires_at,
      created_by_admin_id: input.adminUserId,
      metadata: {
        [CUSTOMER_AUTH_METADATA_SOURCE_KEY]:
          CUSTOMER_AUTH_METADATA_SOURCE_ADMIN_CUSTOMER_INVITE,
        [CUSTOMER_AUDIT_METADATA_CREATED_BY_ADMIN_ID_KEY]: input.adminUserId,
      },
    });

    try {
      await this.sendCustomerInviteEmail({
        invitation,
        adminUserId: input.adminUserId,
        eventType: input.eventType,
        actionUrl: inviteLink.accept_url,
      });
    } catch (error: unknown) {
      await this.cleanupCreatedInvitation(invitation.invitation.id);

      if (error instanceof AppError) {
        throw error;
      }

      throw AppError.customerInviteCreateFailed(error);
    }

    return invitation;
  }

  private async sendCustomerInviteEmail(input: {
    readonly invitation: CustomerInvitationWithCustomer;
    readonly adminUserId: string;
    readonly eventType:
      | typeof EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_CREATED
      | typeof EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_RESENT;
    readonly actionUrl: string;
  }): Promise<void> {
    await this.emailNotificationService.createFromTemplate({
      eventType: input.eventType,
      recipient: {
        role: EMAIL_RECIPIENT_ROLE_CUSTOMER,
        email: input.invitation.invitation.email,
        name: input.invitation.app_user.full_name,
        appUserId: input.invitation.app_user.id,
      },
      templateData: {
        recipientName: input.invitation.app_user.full_name,
        customerName: input.invitation.app_user.full_name,
        actionUrl: input.actionUrl,
        inviteExpiresAt: input.invitation.invitation.expires_at,
      },
      entity: {
        entityType: EMAIL_NOTIFICATION_ENTITY_TYPE_CUSTOMER_INVITATION,
        entityId: input.invitation.invitation.id,
      },
      idempotencyKey: createCustomerInvitationEmailIdempotencyKey({
        eventType: input.eventType,
        customerInvitationId: input.invitation.invitation.id,
        customerAppUserId: input.invitation.app_user.id,
        customerEmail: input.invitation.invitation.email,
      }),
      metadata: buildCustomerInvitationEmailMetadata({
        customerInvitationId: input.invitation.invitation.id,
        appUserId: input.invitation.app_user.id,
        adminUserId: input.adminUserId,
      }),
    });
  }

  private async sendCustomerInviteAcceptedEmail(input: {
    readonly customer: CustomerProfileWithUser;
    readonly invitation: CustomerInvitationWithCustomer;
  }): Promise<void> {
    await this.emailNotificationService.createFromTemplate({
      eventType: EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_ACCEPTED,
      recipient: {
        role: EMAIL_RECIPIENT_ROLE_CUSTOMER,
        email: input.invitation.invitation.email,
        name: input.customer.app_user.full_name,
        appUserId: input.customer.app_user.id,
      },
      templateData: {
        recipientName: input.customer.app_user.full_name,
        customerName: input.customer.app_user.full_name,
      },
      entity: {
        entityType: EMAIL_NOTIFICATION_ENTITY_TYPE_CUSTOMER_INVITATION,
        entityId: input.invitation.invitation.id,
      },
      idempotencyKey: createCustomerInvitationEmailIdempotencyKey({
        eventType: EMAIL_NOTIFICATION_EVENT_CUSTOMER_INVITE_ACCEPTED,
        customerInvitationId: input.invitation.invitation.id,
        customerAppUserId: input.customer.app_user.id,
        customerEmail: input.invitation.invitation.email,
      }),
      metadata: buildCustomerInvitationEmailMetadata({
        customerInvitationId: input.invitation.invitation.id,
        appUserId: input.customer.app_user.id,
      }),
    });
  }

  private async createCustomerCreatedAuditEvents(input: {
    readonly customer: CustomerProfileWithUser;
    readonly adminUserId: string;
    readonly customerInvitationId: string;
  }): Promise<void> {
    const metadata = buildCustomerAuditMetadata({
      customerProfileId: input.customer.profile.id,
      appUserId: input.customer.app_user.id,
      adminUserId: input.adminUserId,
      customerInvitationId: input.customerInvitationId,
    });

    await this.authAuditRepository.createEvent({
      actorUserId: input.adminUserId,
      targetUserId: input.customer.app_user.id,
      eventType: AUTH_AUDIT_EVENT_USER_CREATED_BY_ADMIN,
      metadata,
    });

    await this.authAuditRepository.createEvent({
      actorUserId: input.adminUserId,
      targetUserId: input.customer.app_user.id,
      eventType: AUTH_AUDIT_EVENT_CUSTOMER_PROFILE_CREATED,
      metadata,
    });
  }

  private async runInviteAcceptedSideEffects(input: {
    readonly customer: CustomerProfileWithUser;
    readonly invitation: CustomerInvitationWithCustomer;
  }): Promise<void> {
    try {
      await this.authAuditRepository.createEvent({
        actorUserId: input.customer.app_user.id,
        targetUserId: input.customer.app_user.id,
        eventType: AUTH_AUDIT_EVENT_PASSWORD_CHANGED,
        metadata: buildCustomerAuditMetadata({
          customerProfileId: input.customer.profile.id,
          appUserId: input.customer.app_user.id,
          customerInvitationId: input.invitation.invitation.id,
        }),
      });
    } catch {
      // Best-effort audit side effect. Invite acceptance must remain successful.
    }

    try {
      await this.sendCustomerInviteAcceptedEmail(input);
    } catch {
      // Best-effort notification side effect. Invite acceptance must remain successful.
    }
  }

  private async cleanupCreatedInvitation(invitationId: string): Promise<void> {
    try {
      await this.customerInviteRepository.deleteByIdForRollback(invitationId);
    } catch {
      // Best-effort rollback only. The original invite creation error remains authoritative.
    }
  }

  private async cleanupInvitationCreation(
    state: MutableCustomerInvitationCreationRollbackState,
  ): Promise<void> {
    if (state.customer_invitation_id) {
      await this.cleanupCreatedInvitation(state.customer_invitation_id);
    }

    if (state.customer_profile_id) {
      try {
        await this.customerRepository.deleteCustomerProfileByIdForRollback(
          state.customer_profile_id,
        );
      } catch {
        // Best-effort rollback only.
      }
    }

    if (state.app_user_id) {
      try {
        await this.customerRepository.deleteAppUserByIdForRollback(
          state.app_user_id,
        );
      } catch {
        // Best-effort rollback only.
      }
    }

    if (state.auth_user_id) {
      try {
        await this.supabaseAuthRepository.deleteAuthUser({
          authUserId: state.auth_user_id,
          shouldSoftDelete: false,
        });
      } catch {
        // Best-effort rollback only.
      }
    }
  }
}
