// apps/api/src/modules/auth/repositories/password-reset.repository.ts
/**
 * LAFAM password reset repository.
 *
 * Role:
 * - Owns all password_reset_challenges table access for the Auth module.
 * - Tracks reset OTP verification state and temporary reset-token state.
 * - Keeps reset-token hashes inside repository/service boundaries.
 *
 * Important:
 * - Never store raw reset tokens.
 * - Never expose reset-token hashes in controller responses.
 * - Account-existence behavior must remain service-controlled.
 */

import { Inject, Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { SUPABASE_ADMIN_CLIENT } from '../../../database/database.constants';
import type {
  LAFAMSupabaseClient,
  PasswordResetChallengeInsert,
  PasswordResetChallengeRow,
  PasswordResetChallengeUpdate,
} from '../../../database/database.types';

export interface PasswordResetChallengeInternal {
  readonly id: string;
  readonly email: string;
  readonly authUserId: string | null;
  readonly resetTokenHash: string | null;
  readonly verifiedAt: string | null;
  readonly expiresAt: string;
  readonly usedAt: string | null;
  readonly failedAttempts: number;
  readonly createdAt: string;
}

export interface CreatePasswordResetChallengeInput {
  readonly email: string;
  readonly authUserId: string | null;
  readonly expiresAt: string;
}

export interface FindLatestPasswordResetChallengeByEmailInput {
  readonly email: string;
}

export interface FindPasswordResetChallengeByResetTokenHashInput {
  readonly resetTokenHash: string;
}

export interface MarkPasswordResetChallengeVerifiedInput {
  readonly challengeId: string;
  readonly resetTokenHash: string;
  readonly verifiedAt: string;
  readonly expiresAt: string;
}

export interface IncrementPasswordResetChallengeFailedAttemptsInput {
  readonly challengeId: string;
  readonly failedAttempts: number;
}

export interface MarkPasswordResetChallengeUsedInput {
  readonly challengeId: string;
  readonly usedAt: string;
}

export interface InvalidatePasswordResetChallengesForEmailInput {
  readonly email: string;
  readonly usedAt: string;
}

const POSTGRES_UNIQUE_VIOLATION_CODE = '23505';

function isDatabaseError(value: unknown): value is {
  readonly code?: string;
  readonly message?: string;
} {
  return typeof value === 'object' && value !== null;
}

function mapDatabaseError(error: unknown): AppError {
  if (isDatabaseError(error) && error.code === POSTGRES_UNIQUE_VIOLATION_CODE) {
    return AppError.conflict(
      'The password reset challenge conflicts with an existing reset challenge.',
    );
  }

  return AppError.supabaseUnavailable(error);
}

function assertPasswordResetChallengeRow(
  row: PasswordResetChallengeRow | null,
  details?: Record<string, unknown>,
): PasswordResetChallengeRow {
  if (!row) {
    throw AppError.resetTokenInvalid('The password reset token is invalid.');
  }

  void details;

  return row;
}

function mapPasswordResetChallengeRowToInternal(
  row: PasswordResetChallengeRow,
): PasswordResetChallengeInternal {
  return {
    id: row.id,
    email: row.email,
    authUserId: row.auth_user_id,
    resetTokenHash: row.reset_token_hash,
    verifiedAt: row.verified_at,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    failedAttempts: row.failed_attempts,
    createdAt: row.created_at,
  };
}

@Injectable()
export class PasswordResetRepository {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly adminClient: LAFAMSupabaseClient,
  ) {}

  async createChallenge(
    input: CreatePasswordResetChallengeInput,
  ): Promise<PasswordResetChallengeInternal> {
    const insertPayload: PasswordResetChallengeInsert = {
      email: input.email,
      auth_user_id: input.authUserId,
      expires_at: input.expiresAt,
      failed_attempts: 0,
    };

    const { data, error } = await this.adminClient
      .from('password_reset_challenges')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      throw mapDatabaseError(error);
    }

    return mapPasswordResetChallengeRowToInternal(
      assertPasswordResetChallengeRow(data),
    );
  }

  async findLatestByEmail(
    input: FindLatestPasswordResetChallengeByEmailInput,
  ): Promise<PasswordResetChallengeInternal | null> {
    const { data, error } = await this.adminClient
      .from('password_reset_challenges')
      .select('*')
      .eq('email', input.email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data ? mapPasswordResetChallengeRowToInternal(data) : null;
  }

  async findByResetTokenHash(
    input: FindPasswordResetChallengeByResetTokenHashInput,
  ): Promise<PasswordResetChallengeInternal | null> {
    const { data, error } = await this.adminClient
      .from('password_reset_challenges')
      .select('*')
      .eq('reset_token_hash', input.resetTokenHash)
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data ? mapPasswordResetChallengeRowToInternal(data) : null;
  }

  async getByResetTokenHash(
    input: FindPasswordResetChallengeByResetTokenHashInput,
  ): Promise<PasswordResetChallengeInternal> {
    const challenge = await this.findByResetTokenHash(input);

    if (!challenge) {
      throw AppError.resetTokenInvalid('The password reset token is invalid.');
    }

    return challenge;
  }

  async markVerified(
    input: MarkPasswordResetChallengeVerifiedInput,
  ): Promise<PasswordResetChallengeInternal> {
    const updatePayload: PasswordResetChallengeUpdate = {
      reset_token_hash: input.resetTokenHash,
      verified_at: input.verifiedAt,
      expires_at: input.expiresAt,
    };

    const { data, error } = await this.adminClient
      .from('password_reset_challenges')
      .update(updatePayload)
      .eq('id', input.challengeId)
      .is('used_at', null)
      .select('*')
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return mapPasswordResetChallengeRowToInternal(
      assertPasswordResetChallengeRow(data, {
        challenge_id: input.challengeId,
      }),
    );
  }

  async incrementFailedAttempts(
    input: IncrementPasswordResetChallengeFailedAttemptsInput,
  ): Promise<PasswordResetChallengeInternal> {
    const updatePayload: PasswordResetChallengeUpdate = {
      failed_attempts: input.failedAttempts + 1,
    };

    const { data, error } = await this.adminClient
      .from('password_reset_challenges')
      .update(updatePayload)
      .eq('id', input.challengeId)
      .is('used_at', null)
      .select('*')
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return mapPasswordResetChallengeRowToInternal(
      assertPasswordResetChallengeRow(data, {
        challenge_id: input.challengeId,
      }),
    );
  }

  async markUsed(
    input: MarkPasswordResetChallengeUsedInput,
  ): Promise<PasswordResetChallengeInternal> {
    const updatePayload: PasswordResetChallengeUpdate = {
      used_at: input.usedAt,
    };

    const { data, error } = await this.adminClient
      .from('password_reset_challenges')
      .update(updatePayload)
      .eq('id', input.challengeId)
      .is('used_at', null)
      .select('*')
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return mapPasswordResetChallengeRowToInternal(
      assertPasswordResetChallengeRow(data, {
        challenge_id: input.challengeId,
      }),
    );
  }

  async invalidateUnusedChallengesForEmail(
    input: InvalidatePasswordResetChallengesForEmailInput,
  ): Promise<number> {
    const updatePayload: PasswordResetChallengeUpdate = {
      used_at: input.usedAt,
    };

    const { data, error } = await this.adminClient
      .from('password_reset_challenges')
      .update(updatePayload)
      .eq('email', input.email)
      .is('used_at', null)
      .select('id');

    if (error) {
      throw mapDatabaseError(error);
    }

    return data?.length ?? 0;
  }
}
