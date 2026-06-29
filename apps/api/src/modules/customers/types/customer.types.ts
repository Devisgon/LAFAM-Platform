// apps/api/src/modules/customers/types/customer.types.ts
/**
 * LAFAM Customer module types.
 *
 * Role:
 * - Defines Customer Module service, repository, invitation, and response contracts.
 * - Keeps customer business identity separate from Auth/provider identity.
 * - Provides stable types for controllers, services, repositories, and Swagger mapping.
 *
 * Important:
 * - This file contains types only.
 * - Do not place validation decorators here.
 * - Do not place database queries here.
 * - Do not place business logic here.
 * - Passwords must never appear in response types.
 * - Raw invite tokens must never appear in response types.
 * - Civil ID may appear in admin customer responses, but must never appear in logs,
 *   audit metadata, email metadata, or provider payloads.
 */

import type {
  AppUserRow,
  AppUserUpdate,
  CustomerInvitationInsert,
  CustomerInvitationRow,
  CustomerInvitationUpdate,
  CustomerProfileInsert,
  CustomerProfileRow,
  CustomerProfileUpdate,
  DatabaseJsonObject,
} from '../../../database/database.types';
import type {
  CustomerAppRole,
  CustomerAuthStatus,
  CustomerInvitationStatus,
  CustomerLookupField,
} from '../constants/customer.constants';

export type CustomerRole = CustomerAppRole;

export type CustomerStatus = CustomerAuthStatus;

export type CustomerLookupMatch = CustomerLookupField | 'phone_and_civil_id';

export type CustomerCreateMode =
  | 'create_with_password'
  | 'invite_without_password';

export type CustomerInviteToken = string;

export type CustomerInviteTokenHash = string;

export interface CustomerCreateInput {
  readonly full_name: string;
  readonly email: string;
  readonly phone: string;
  readonly civil_id: string;
  readonly password?: string | null;
  readonly confirm_password?: string | null;
  readonly timezone?: string | null;
}

export interface CustomerUpdateInput {
  readonly full_name?: string;
  readonly phone?: string;
  readonly civil_id?: string;
  readonly timezone?: string | null;
}

export interface CustomerListQuery {
  readonly search?: string;
  readonly auth_status?: CustomerAuthStatus;
  readonly include_deleted?: boolean;
  readonly limit: number;
  readonly offset: number;
}

export interface CustomerLookupQuery {
  readonly phone?: string;
  readonly civil_id?: string;
}

export interface CustomerParam {
  readonly customer_id: string;
}

export interface CustomerInvitationParam {
  readonly invitation_id: string;
}

export interface CustomerAcceptInvitationInput {
  readonly token: CustomerInviteToken;
  readonly password: string;
  readonly confirm_password: string;
}

export interface CustomerResendInvitationInput {
  readonly invitation_id: string;
}

export interface CustomerRevokeInvitationInput {
  readonly invitation_id: string;
  readonly revoked_by_admin_id: string;
}

export interface CustomerProfileCreateRepositoryInput {
  readonly appUserId: string;
  readonly civilId: string;
  readonly civilIdNormalized: string;
  readonly createdByAdminId: string | null;
  readonly updatedByAdminId: string | null;
}

export interface CustomerCreateRepositoryInput {
  readonly app_user: {
    readonly auth_user_id: string;
    readonly email: string;
    readonly phone: string;
    readonly full_name: string;
    readonly role: CustomerAppRole;
    readonly status: CustomerAuthStatus;
    readonly is_guest: false;
    readonly timezone: string | null;
    readonly metadata: DatabaseJsonObject;
  };
  readonly customer_profile: {
    readonly civil_id: string;
    readonly civil_id_normalized: string;
    readonly created_by_admin_id: string | null;
    readonly updated_by_admin_id: string | null;
  };
}

export interface CustomerUpdateRepositoryInput {
  readonly customer_profile_id: string;
  readonly updated_by_admin_id: string;
  readonly profile_update: CustomerProfileUpdate;
  readonly app_user_update?: Pick<
    AppUserUpdate,
    'full_name' | 'phone' | 'timezone'
  >;
}

export interface CustomerDeactivateRepositoryInput {
  readonly customer_profile_id: string;
  readonly updated_by_admin_id: string;
  readonly deactivated_at: string;
}

export interface CustomerReactivateRepositoryInput {
  readonly customer_profile_id: string;
  readonly updated_by_admin_id: string;
}

export interface CustomerSoftDeleteRepositoryInput {
  readonly customer_profile_id: string;
  readonly updated_by_admin_id: string;
  readonly deleted_at: string;
}

export interface FindCustomerByIdInput {
  readonly customerProfileId: string;
  readonly includeDeleted?: boolean;
}

export interface FindCustomerByAppUserIdInput {
  readonly appUserId: string;
  readonly includeDeleted?: boolean;
}

export interface FindCustomerByEmailInput {
  readonly email: string;
  readonly includeDeleted?: boolean;
  readonly excludeCustomerProfileId?: string | null;
}

export interface FindCustomerByPhoneInput {
  readonly phone: string;
  readonly includeDeleted?: boolean;
  readonly excludeCustomerProfileId?: string | null;
}

export interface FindCustomerByCivilIdNormalizedInput {
  readonly civilIdNormalized: string;
  readonly includeDeleted?: boolean;
  readonly excludeCustomerProfileId?: string | null;
}

export interface LookupCustomerRepositoryInput {
  readonly phone?: string;
  readonly civilIdNormalized?: string;
  readonly includeDeleted?: boolean;
}

export interface CustomerProfileWithUser {
  readonly profile: CustomerProfileRow;
  readonly app_user: AppUserRow;
}

export interface CustomerCreateDatabasePayload {
  readonly app_user_id: string;
  readonly customer_profile: CustomerProfileInsert;
}

export interface CustomerUpdateDatabasePayload {
  readonly customer_profile: CustomerProfileUpdate;
  readonly app_user?: Pick<AppUserUpdate, 'full_name' | 'phone' | 'timezone'>;
}

export interface CustomerRepositoryListResult {
  readonly customers: readonly CustomerProfileWithUser[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export interface CustomerInvitationCreateRepositoryInput {
  readonly app_user_id: string;
  readonly email: string;
  readonly token_hash: CustomerInviteTokenHash;
  readonly status: CustomerInvitationStatus;
  readonly expires_at: string;
  readonly created_by_admin_id: string;
  readonly metadata?: DatabaseJsonObject;
}

export interface CustomerInvitationCreateDatabasePayload {
  readonly customer_invitation: CustomerInvitationInsert;
}

export interface CustomerInvitationUpdateDatabasePayload {
  readonly customer_invitation: CustomerInvitationUpdate;
}

export interface FindCustomerInvitationByIdInput {
  readonly invitationId: string;
}

export interface FindCustomerInvitationByTokenHashInput {
  readonly tokenHash: CustomerInviteTokenHash;
}

export interface FindPendingCustomerInvitationByAppUserIdInput {
  readonly appUserId: string;
}

export interface FindLatestCustomerInvitationByAppUserIdInput {
  readonly appUserId: string;
}

export interface CustomerInvitationAcceptRepositoryInput {
  readonly invitation_id: string;
  readonly accepted_at: string;
  readonly accepted_by_app_user_id: string;
}

export interface CustomerInvitationExpireRepositoryInput {
  readonly invitation_id: string;
  readonly expired_at: string;
}

export interface CustomerInvitationRevokeRepositoryInput {
  readonly invitation_id: string;
  readonly revoked_at: string;
  readonly revoked_by_admin_id: string;
}

export interface CustomerInvitationWithCustomer {
  readonly invitation: CustomerInvitationRow;
  readonly profile: CustomerProfileRow;
  readonly app_user: AppUserRow;
}

export interface SafeCustomerProfile {
  readonly id: string;
  readonly app_user_id: string;
  readonly auth_user_id: string;
  readonly email: string;
  readonly phone: string;
  readonly full_name: string;
  readonly civil_id: string;
  readonly role: CustomerAppRole;
  readonly auth_status: CustomerAuthStatus;
  readonly is_guest: false;
  readonly avatar_path: string | null;
  readonly timezone: string | null;
  readonly created_by_admin_id: string | null;
  readonly updated_by_admin_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deactivated_at: string | null;
  readonly deleted_at: string | null;
}

export interface SafeCustomerInvitation {
  readonly id: string;
  readonly app_user_id: string;
  readonly email: string;
  readonly status: CustomerInvitationStatus;
  readonly expires_at: string;
  readonly accepted_at: string | null;
  readonly expired_at: string | null;
  readonly revoked_at: string | null;
  readonly created_by_admin_id: string;
  readonly accepted_by_app_user_id: string | null;
  readonly revoked_by_admin_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface CustomerListResult {
  readonly customers: readonly SafeCustomerProfile[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export interface CustomerMutationResult {
  readonly customer: SafeCustomerProfile;
}

export interface CustomerInvitationMutationResult {
  readonly customer: SafeCustomerProfile;
  readonly invitation: SafeCustomerInvitation;
}

export interface CustomerInvitationAcceptResult {
  readonly customer: SafeCustomerProfile;
  readonly invitation: SafeCustomerInvitation;
}

export interface CustomerLookupResult {
  readonly customer: SafeCustomerProfile | null;
  readonly matched_by: CustomerLookupMatch | null;
}

export interface CustomerDeleteResult {
  readonly deleted: true;
  readonly customer_id: string;
}

export interface CustomerAuthUserCreateInput {
  readonly email: string;
  readonly password: string;
  readonly full_name: string;
  readonly phone: string;
  readonly timezone: string | null;
  readonly created_by_admin_id: string;
}

export interface CustomerInviteAuthUserCreateInput {
  readonly email: string;
  readonly full_name: string;
  readonly phone: string;
  readonly timezone: string | null;
  readonly created_by_admin_id: string;
}

export interface CustomerInviteAuthUserPasswordSetInput {
  readonly auth_user_id: string;
  readonly password: string;
}

export interface CustomerAuthUserCreateResult {
  readonly auth_user_id: string;
  readonly email: string;
  readonly email_verification_required: false;
}

export interface CustomerInviteAuthUserCreateResult {
  readonly auth_user_id: string;
  readonly email: string;
  readonly invite_acceptance_required: true;
}

export interface CustomerInviteTokenCreateResult {
  readonly token: CustomerInviteToken;
  readonly token_hash: CustomerInviteTokenHash;
}

export interface CustomerInviteLinkCreateResult {
  readonly token: CustomerInviteToken;
  readonly token_hash: CustomerInviteTokenHash;
  readonly accept_url: string;
  readonly expires_at: string;
}

export interface CustomerCreationRollbackState {
  readonly auth_user_id: string | null;
  readonly app_user_id: string | null;
  readonly customer_profile_id: string | null;
}

export interface CustomerInvitationCreationRollbackState extends CustomerCreationRollbackState {
  readonly customer_invitation_id: string | null;
}
