// apps/api/src/modules/auth/repositories/auth-audit.repository.ts
/**
 * LAFAM Auth audit repository.
 *
 * Role:
 * - Owns all auth_audit_events table writes for the Auth module.
 * - Stores security-sensitive Auth activity for traceability.
 * - Keeps audit persistence isolated from services/controllers.
 *
 * Important:
 * - Never write passwords, OTPs, raw tokens, refresh tokens, reset tokens, or token hashes into metadata.
 * - Audit write failures should not expose database details to API clients.
 * - Services decide which events to write; this repository only persists them.
 */

import { Inject, Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { SUPABASE_ADMIN_CLIENT } from '../../../database/database.constants';
import type {
  AuthAuditEventInsert,
  AuthAuditEventRow,
  DatabaseJsonObject,
  LAFAMSupabaseClient,
} from '../../../database/database.types';
import type { AuthAuditEventType } from '../constants/auth.constants';

export interface AuthAuditEventInternal {
  readonly id: string;
  readonly actorUserId: string | null;
  readonly targetUserId: string | null;
  readonly eventType: AuthAuditEventType;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly metadata: DatabaseJsonObject;
  readonly createdAt: string;
}

export interface CreateAuthAuditEventInput {
  readonly actorUserId?: string | null;
  readonly targetUserId?: string | null;
  readonly eventType: AuthAuditEventType;
  readonly ipAddress?: string | null;
  readonly userAgent?: string | null;
  readonly metadata?: DatabaseJsonObject;
}

export interface ListAuthAuditEventsInput {
  readonly actorUserId?: string;
  readonly targetUserId?: string;
  readonly eventType?: AuthAuditEventType;
  readonly limit: number;
  readonly offset: number;
}

export interface AuthAuditEventListResult {
  readonly events: readonly AuthAuditEventInternal[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

const DEFAULT_LIST_AUDIT_EVENTS_LIMIT = 50;
const MAX_LIST_AUDIT_EVENTS_LIMIT = 200;

function mapDatabaseError(error: unknown): AppError {
  return AppError.databaseOperationFailed(error);
}

function normalizeListLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit <= 0) {
    return DEFAULT_LIST_AUDIT_EVENTS_LIMIT;
  }

  return Math.min(limit, MAX_LIST_AUDIT_EVENTS_LIMIT);
}

function normalizeListOffset(offset: number): number {
  if (!Number.isInteger(offset) || offset < 0) {
    return 0;
  }

  return offset;
}

function mapAuthAuditEventRowToInternal(
  row: AuthAuditEventRow,
): AuthAuditEventInternal {
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    targetUserId: row.target_user_id,
    eventType: row.event_type as AuthAuditEventType,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

@Injectable()
export class AuthAuditRepository {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly adminClient: LAFAMSupabaseClient,
  ) {}

  async createEvent(
    input: CreateAuthAuditEventInput,
  ): Promise<AuthAuditEventInternal> {
    const insertPayload: AuthAuditEventInsert = {
      actor_user_id: input.actorUserId ?? null,
      target_user_id: input.targetUserId ?? null,
      event_type: input.eventType,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
      metadata: input.metadata ?? {},
    };

    const { data, error } = await this.adminClient
      .from('auth_audit_events')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      throw mapDatabaseError(error);
    }

    return mapAuthAuditEventRowToInternal(data);
  }

  async listEvents(
    input: ListAuthAuditEventsInput,
  ): Promise<AuthAuditEventListResult> {
    const limit = normalizeListLimit(input.limit);
    const offset = normalizeListOffset(input.offset);

    let query = this.adminClient
      .from('auth_audit_events')
      .select('*', { count: 'exact' });

    if (input.actorUserId) {
      query = query.eq('actor_user_id', input.actorUserId);
    }

    if (input.targetUserId) {
      query = query.eq('target_user_id', input.targetUserId);
    }

    if (input.eventType) {
      query = query.eq('event_type', input.eventType);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw mapDatabaseError(error);
    }

    const events = (data ?? []).map(mapAuthAuditEventRowToInternal);

    return {
      events,
      total: count ?? events.length,
      limit,
      offset,
    };
  }
}
