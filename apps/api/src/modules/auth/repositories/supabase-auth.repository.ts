// apps/api/src/modules/auth/repositories/supabase-auth.repository.ts
/**
 * LAFAM Supabase Auth repository.
 *
 * Role:
 * - Wraps Supabase Auth operations behind a LAFAM-owned repository boundary.
 * - Converts provider errors into frontend-safe AppError instances.
 * - Keeps raw Supabase calls out of services and controllers.
 *
 * Important:
 * - Never expose SUPABASE_SECRET_KEY outside the backend.
 * - Never log passwords, OTPs, access tokens, refresh tokens, or reset tokens.
 * - Public Auth calls use isolated Supabase clients to avoid shared session state.
 * - Admin Auth calls use the injected server-only Supabase admin client.
 * - Staff Auth creation intentionally creates a pending email-verification identity.
 */

import { Inject, Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

import { currentSupabaseConfig } from '../../../common/config';
import { AppError } from '../../../common/errors/app-error';
import { SUPABASE_ADMIN_CLIENT } from '../../../database/database.constants';
import type {
  Database,
  DatabaseJsonObject,
  LAFAMSupabaseClient,
} from '../../../database/database.types';
import {
  AUTH_SUPABASE_EMAIL_OTP_TYPE,
  AUTH_SUPABASE_PASSWORD_RECOVERY_OTP_TYPE,
} from '../constants/auth.constants';
import {
  createAuthProviderInvalidResponseError,
  mapAuthProviderErrorToAppError,
  normalizeAuthProviderError,
  type AuthProviderErrorFlow,
} from '../utils/auth-provider-error.util';

export interface SupabaseAuthUser {
  readonly id: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly emailConfirmedAt: string | null;
  readonly phoneConfirmedAt: string | null;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
  readonly isAnonymous: boolean;
  readonly appMetadata: DatabaseJsonObject;
  readonly userMetadata: DatabaseJsonObject;
}

export interface SupabaseAuthSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly tokenType: string;
  readonly expiresIn: number | null;
  readonly expiresAt: number | null;
  readonly user: SupabaseAuthUser;
}

export interface SupabaseAuthUserResult {
  readonly user: SupabaseAuthUser;
}

export interface SupabaseAuthSessionResult {
  readonly user: SupabaseAuthUser;
  readonly session: SupabaseAuthSession;
}

export interface SupabaseAuthOptionalSessionResult {
  readonly user: SupabaseAuthUser;
  readonly session: SupabaseAuthSession | null;
}

export interface SupabaseAdminUserListResult {
  readonly users: readonly SupabaseAuthUser[];
  readonly total: number;
  readonly page: number;
  readonly perPage: number;
}

export interface SignUpWithPasswordInput {
  readonly email: string;
  readonly password: string;
  readonly fullName: string;
  readonly phone: string | null;
  readonly timezone: string | null;
}

export interface CreateStaffAuthUserWithPasswordInput {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
  readonly phone: string | null;
  readonly portalRole: 'trainer' | 'staff';
  readonly createdByAdminId: string;
}

export interface VerifyEmailOtpInput {
  readonly email: string;
  readonly otp: string;
}

export interface ResendVerificationOtpInput {
  readonly email: string;
}

export interface SignInWithPasswordInput {
  readonly email: string;
  readonly password: string;
}

export interface RefreshAuthSessionInput {
  readonly refreshToken: string;
}

export interface SendPasswordResetOtpInput {
  readonly email: string;
}

export interface VerifyResetOtpInput {
  readonly email: string;
  readonly otp: string;
}

export interface UpdateAuthUserPasswordInput {
  readonly authUserId: string;
  readonly password: string;
}

export interface CreateAnonymousGuestSessionInput {
  readonly captchaToken: string | null;
}

export interface ConvertAnonymousGuestInput {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly email: string;
  readonly password: string;
  readonly fullName: string;
  readonly phone: string | null;
  readonly timezone: string | null;
}

export type SupabaseSignOutScope = 'global' | 'local' | 'others';

export interface SignOutWithAccessTokenInput {
  readonly accessToken: string;
  readonly scope: SupabaseSignOutScope;
}

export interface GetAuthUserByAccessTokenInput {
  readonly accessToken: string;
}

export interface GetAuthUserByIdInput {
  readonly authUserId: string;
}

export interface DeleteAuthUserInput {
  /**
   * Supabase auth.users id.
   */
  readonly authUserId: string;

  /**
   * Supabase Admin Auth deletion mode.
   *
   * true:
   * - Soft-deletes/disables the Supabase Auth identity.
   * - Does not physically delete auth.users.
   * - Must be used for admin account deletion because business tables keep
   *   historical references through public.app_users.
   *
   * false:
   * - Physically deletes auth.users.
   * - Can cascade into public.app_users.
   * - Must only be used for rollback flows before business records exist.
   */
  readonly shouldSoftDelete: boolean;
}

export interface ListAuthUsersInput {
  readonly page: number;
  readonly perPage: number;
}

interface SupabaseProviderUserShape {
  readonly id: string;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly email_confirmed_at?: string | null;
  readonly phone_confirmed_at?: string | null;
  readonly created_at?: string | null;
  readonly updated_at?: string | null;
  readonly is_anonymous?: boolean | null;
  readonly app_metadata?: unknown;
  readonly user_metadata?: unknown;
}

interface SupabaseProviderSessionShape {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly token_type?: string | null;
  readonly expires_in?: number | null;
  readonly expires_at?: number | null;
  readonly user: SupabaseProviderUserShape;
}

function isDatabaseJsonObject(value: unknown): value is DatabaseJsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeProviderMetadata(value: unknown): DatabaseJsonObject {
  return isDatabaseJsonObject(value) ? value : {};
}

function mapSupabaseAuthUser(
  user: SupabaseProviderUserShape,
): SupabaseAuthUser {
  return {
    id: user.id,
    email: user.email ?? null,
    phone: user.phone ?? null,
    emailConfirmedAt: user.email_confirmed_at ?? null,
    phoneConfirmedAt: user.phone_confirmed_at ?? null,
    createdAt: user.created_at ?? null,
    updatedAt: user.updated_at ?? null,
    isAnonymous: user.is_anonymous ?? false,
    appMetadata: normalizeProviderMetadata(user.app_metadata),
    userMetadata: normalizeProviderMetadata(user.user_metadata),
  };
}

function mapSupabaseAuthSession(
  session: SupabaseProviderSessionShape,
): SupabaseAuthSession {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    tokenType: session.token_type ?? 'bearer',
    expiresIn: session.expires_in ?? null,
    expiresAt: session.expires_at ?? null,
    user: mapSupabaseAuthUser(session.user),
  };
}

function assertSupabaseUser(
  user: SupabaseProviderUserShape | null,
  flow: AuthProviderErrorFlow,
): SupabaseAuthUser {
  if (!user) {
    throw createAuthProviderInvalidResponseError(flow);
  }

  return mapSupabaseAuthUser(user);
}

function assertSupabaseSession(
  session: SupabaseProviderSessionShape | null,
  flow: AuthProviderErrorFlow,
): SupabaseAuthSession {
  if (!session) {
    throw createAuthProviderInvalidResponseError(flow);
  }

  return mapSupabaseAuthSession(session);
}

function createPublicAuthClient(): LAFAMSupabaseClient {
  return createClient<Database>(
    currentSupabaseConfig.url,
    currentSupabaseConfig.publishableKey,
    {
      auth: {
        persistSession: currentSupabaseConfig.auth.persistSession,
        autoRefreshToken: currentSupabaseConfig.auth.autoRefreshToken,
        detectSessionInUrl: currentSupabaseConfig.auth.detectSessionInUrl,
      },
    },
  );
}

function mapStaffAuthCreationError(error: unknown): AppError {
  const mappedError = mapAuthProviderErrorToAppError({
    error,
    flow: 'sign_up',
  });

  if (mappedError.code === 'EMAIL_ALREADY_REGISTERED') {
    return AppError.staffEmailAlreadyExists();
  }

  return AppError.staffAuthUserCreationFailed(mappedError);
}

function isMissingAuthUserDuringSoftDelete(error: unknown): boolean {
  const providerError = normalizeAuthProviderError(error);
  const searchText = [
    providerError.name,
    providerError.code,
    providerError.message,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase();

  return (
    providerError.status === 404 ||
    providerError.statusCode === 404 ||
    searchText.includes('user_not_found') ||
    (searchText.includes('user') && searchText.includes('not found'))
  );
}

@Injectable()
export class SupabaseAuthRepository {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly adminClient: LAFAMSupabaseClient,
  ) {}

  async signUpWithPassword(
    input: SignUpWithPasswordInput,
  ): Promise<SupabaseAuthOptionalSessionResult> {
    const client = createPublicAuthClient();

    const { data, error } = await client.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          full_name: input.fullName,
          phone: input.phone,
          timezone: input.timezone,
          source: 'lafam_public_sign_up',
        },
      },
    });

    if (error) {
      throw mapAuthProviderErrorToAppError({
        error,
        flow: 'sign_up',
      });
    }

    return {
      user: assertSupabaseUser(data.user, 'sign_up'),
      session: data.session ? mapSupabaseAuthSession(data.session) : null,
    };
  }

  async createStaffAuthUserWithPassword(
    input: CreateStaffAuthUserWithPasswordInput,
  ): Promise<SupabaseAuthUserResult> {
    const client = createPublicAuthClient();

    const { data, error } = await client.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          full_name: input.displayName,
          phone: input.phone,
          portal_role: input.portalRole,
          source: 'lafam_admin_staff_create',
          created_by_admin_id: input.createdByAdminId,
        },
      },
    });

    if (error) {
      throw mapStaffAuthCreationError(error);
    }

    return {
      user: assertSupabaseUser(data.user, 'sign_up'),
    };
  }

  async verifyEmailOtp(
    input: VerifyEmailOtpInput,
  ): Promise<SupabaseAuthOptionalSessionResult> {
    const client = createPublicAuthClient();

    const { data, error } = await client.auth.verifyOtp({
      email: input.email,
      token: input.otp,
      type: AUTH_SUPABASE_EMAIL_OTP_TYPE,
    });

    if (error) {
      throw mapAuthProviderErrorToAppError({
        error,
        flow: 'verify_email_otp',
      });
    }

    return {
      user: assertSupabaseUser(data.user, 'verify_email_otp'),
      session: data.session ? mapSupabaseAuthSession(data.session) : null,
    };
  }

  async resendVerificationOtp(
    input: ResendVerificationOtpInput,
  ): Promise<void> {
    const client = createPublicAuthClient();

    const { error } = await client.auth.resend({
      type: 'signup',
      email: input.email,
    });

    if (error) {
      throw mapAuthProviderErrorToAppError({
        error,
        flow: 'resend_verification_otp',
      });
    }
  }

  async signInWithPassword(
    input: SignInWithPasswordInput,
  ): Promise<SupabaseAuthSessionResult> {
    const client = createPublicAuthClient();

    const { data, error } = await client.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (error) {
      throw mapAuthProviderErrorToAppError({
        error,
        flow: 'login',
      });
    }

    const session = assertSupabaseSession(data.session, 'login');

    return {
      user: session.user,
      session,
    };
  }

  async refreshSession(
    input: RefreshAuthSessionInput,
  ): Promise<SupabaseAuthSessionResult> {
    const client = createPublicAuthClient();

    const { data, error } = await client.auth.refreshSession({
      refresh_token: input.refreshToken,
    });

    if (error) {
      throw mapAuthProviderErrorToAppError({
        error,
        flow: 'refresh_token',
      });
    }

    const session = assertSupabaseSession(data.session, 'refresh_token');

    return {
      user: session.user,
      session,
    };
  }

  async sendPasswordResetOtp(input: SendPasswordResetOtpInput): Promise<void> {
    const client = createPublicAuthClient();

    const { error } = await client.auth.resetPasswordForEmail(input.email);

    if (error) {
      throw mapAuthProviderErrorToAppError({
        error,
        flow: 'forgot_password',
      });
    }
  }

  async verifyResetOtp(
    input: VerifyResetOtpInput,
  ): Promise<SupabaseAuthOptionalSessionResult> {
    const client = createPublicAuthClient();

    const { data, error } = await client.auth.verifyOtp({
      email: input.email,
      token: input.otp,
      type: AUTH_SUPABASE_PASSWORD_RECOVERY_OTP_TYPE,
    });

    if (error) {
      throw mapAuthProviderErrorToAppError({
        error,
        flow: 'verify_reset_otp',
      });
    }

    return {
      user: assertSupabaseUser(data.user, 'verify_reset_otp'),
      session: data.session ? mapSupabaseAuthSession(data.session) : null,
    };
  }

  async updateAuthUserPassword(
    input: UpdateAuthUserPasswordInput,
  ): Promise<SupabaseAuthUserResult> {
    const { data, error } = await this.adminClient.auth.admin.updateUserById(
      input.authUserId,
      {
        password: input.password,
      },
    );

    if (error) {
      throw mapAuthProviderErrorToAppError({
        error,
        flow: 'reset_password',
      });
    }

    return {
      user: assertSupabaseUser(data.user, 'reset_password'),
    };
  }

  async createAnonymousGuestSession(
    input: CreateAnonymousGuestSessionInput,
  ): Promise<SupabaseAuthSessionResult> {
    const client = createPublicAuthClient();

    const credentials =
      input.captchaToken !== null
        ? {
            options: {
              captchaToken: input.captchaToken,
              data: {
                source: 'lafam_guest_session',
              },
            },
          }
        : {
            options: {
              data: {
                source: 'lafam_guest_session',
              },
            },
          };

    const { data, error } = await client.auth.signInAnonymously(credentials);

    if (error) {
      throw mapAuthProviderErrorToAppError({
        error,
        flow: 'guest_session',
      });
    }

    const session = assertSupabaseSession(data.session, 'guest_session');

    return {
      user: session.user,
      session,
    };
  }

  async convertAnonymousGuestToEmailPassword(
    input: ConvertAnonymousGuestInput,
  ): Promise<SupabaseAuthOptionalSessionResult> {
    const client = createPublicAuthClient();

    const { error: sessionError } = await client.auth.setSession({
      access_token: input.accessToken,
      refresh_token: input.refreshToken,
    });

    if (sessionError) {
      throw mapAuthProviderErrorToAppError({
        error: sessionError,
        flow: 'guest_conversion',
      });
    }

    const { data, error } = await client.auth.updateUser({
      email: input.email,
      password: input.password,
      data: {
        full_name: input.fullName,
        phone: input.phone,
        timezone: input.timezone,
        source: 'lafam_guest_conversion',
      },
    });

    if (error) {
      throw mapAuthProviderErrorToAppError({
        error,
        flow: 'guest_conversion',
      });
    }

    return {
      user: assertSupabaseUser(data.user, 'guest_conversion'),
      session: null,
    };
  }

  async getAuthUserByAccessToken(
    input: GetAuthUserByAccessTokenInput,
  ): Promise<SupabaseAuthUserResult> {
    const client = createPublicAuthClient();

    const { data, error } = await client.auth.getUser(input.accessToken);

    if (error) {
      throw mapAuthProviderErrorToAppError({
        error,
        flow: 'access_token_lookup',
      });
    }

    return {
      user: assertSupabaseUser(data.user, 'access_token_lookup'),
    };
  }

  async getAuthUserById(
    input: GetAuthUserByIdInput,
  ): Promise<SupabaseAuthUserResult> {
    const { data, error } = await this.adminClient.auth.admin.getUserById(
      input.authUserId,
    );

    if (error) {
      throw mapAuthProviderErrorToAppError({
        error,
        flow: 'admin_user_operation',
      });
    }

    return {
      user: assertSupabaseUser(data.user, 'admin_user_operation'),
    };
  }

  async signOutWithAccessToken(
    input: SignOutWithAccessTokenInput,
  ): Promise<void> {
    const { error } = await this.adminClient.auth.admin.signOut(
      input.accessToken,
      input.scope,
    );

    if (error) {
      throw mapAuthProviderErrorToAppError({
        error,
        flow: 'unknown',
      });
    }
  }

  async deleteAuthUser(input: DeleteAuthUserInput): Promise<void> {
    const { error } = await this.adminClient.auth.admin.deleteUser(
      input.authUserId,
      input.shouldSoftDelete,
    );

    if (!error) {
      return;
    }

    if (input.shouldSoftDelete && isMissingAuthUserDuringSoftDelete(error)) {
      return;
    }

    const mappedError = mapAuthProviderErrorToAppError({
      error,
      flow: 'admin_user_operation',
    });

    return Promise.reject(AppError.userDeleteFailed(mappedError));
  }

  async listAuthUsers(
    input: ListAuthUsersInput,
  ): Promise<SupabaseAdminUserListResult> {
    const { data, error } = await this.adminClient.auth.admin.listUsers({
      page: input.page,
      perPage: input.perPage,
    });

    if (error) {
      throw mapAuthProviderErrorToAppError({
        error,
        flow: 'admin_user_operation',
      });
    }

    const users = data.users.map(mapSupabaseAuthUser);

    return {
      users,
      total: data.total ?? users.length,
      page: input.page,
      perPage: input.perPage,
    };
  }
}
