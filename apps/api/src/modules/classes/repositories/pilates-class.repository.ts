// apps/api/src/modules/classes/repositories/pilates-class.repository.ts
/**
 * LAFAM Pilates Classes repository.
 *
 * Role:
 * - Owns Pilates Classes Module database access.
 * - Handles pilates_classes and pilates_class_schedules reads/writes.
 * - Hydrates schedules with related class and trainer profile records.
 * - Provides trainer availability and trainer schedule conflict lookup helpers.
 *
 * Important:
 * - This repository does not perform authorization.
 * - This repository does not own business decisions.
 * - This repository does not create bookings, payments, memberships, or waitlist rows.
 * - This repository does not broadcast realtime events directly.
 * - Services must remain the business-rule authority.
 * - Database/provider errors are converted into frontend-safe AppError instances.
 */

import { Inject, Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { SUPABASE_ADMIN_CLIENT } from '../../../database/database.constants';
import type {
  AppUserRow,
  LAFAMSupabaseClient,
  PilatesClassInsert,
  PilatesClassRow,
  PilatesClassScheduleInsert,
  PilatesClassScheduleRow,
  PilatesClassScheduleUpdate,
  PilatesClassUpdate,
  StaffAvailabilityRuleRow,
  StaffProfileRow,
} from '../../../database/database.types';
import {
  PILATES_CLASS_LIST_DEFAULT_LIMIT,
  PILATES_CLASS_LIST_DEFAULT_OFFSET,
  PILATES_CLASS_LIST_MAX_LIMIT,
  PILATES_CLASS_PUBLIC_LIST_DEFAULT_LIMIT,
  PILATES_CLASS_PUBLIC_LIST_MAX_LIMIT,
  PILATES_CLASS_SCHEDULE_LIST_DEFAULT_LIMIT,
  PILATES_CLASS_SCHEDULE_LIST_DEFAULT_OFFSET,
  PILATES_CLASS_SCHEDULE_LIST_MAX_LIMIT,
  PILATES_CLASS_SCHEDULE_PUBLIC_LIST_DEFAULT_LIMIT,
  PILATES_CLASS_SCHEDULE_PUBLIC_LIST_MAX_LIMIT,
  PILATES_CLASS_SCHEDULE_STATUS_CANCELLED,
  PILATES_CLASS_SCHEDULE_STATUS_COMPLETED,
  PILATES_CLASS_SCHEDULE_STATUS_DELETED,
  PILATES_CLASS_SCHEDULE_STATUS_SCHEDULED,
  PILATES_CLASS_STATUS_ACTIVE,
  PILATES_CLASS_STATUS_DELETED,
} from '../constants/pilates-class.constants';
import type {
  PilatesClassListQuery,
  PilatesClassPublicListQuery,
  PilatesClassRepositoryListResult,
  PilatesClassScheduleListQuery,
  PilatesClassSchedulePublicListQuery,
  PilatesClassScheduleWithRelations,
  PilatesTrainerAvailabilityLookupInput,
  PilatesTrainerScheduleConflictLookupInput,
} from '../types/pilates-class.types';

interface ProviderDatabaseError {
  readonly code?: string;
  readonly message?: string;
  readonly details?: string;
  readonly hint?: string;
}

interface SoftDeleteClassInput {
  readonly class_id: string;
  readonly updated_by_admin_id: string;
  readonly deleted_at: string;
}

interface CancelScheduleInput {
  readonly schedule_id: string;
  readonly updated_by_admin_id: string;
  readonly cancelled_at: string;
  readonly cancellation_reason: string;
}

interface CompleteScheduleInput {
  readonly schedule_id: string;
  readonly updated_by_admin_id: string;
  readonly completed_at: string;
}

interface SoftDeleteScheduleInput {
  readonly schedule_id: string;
  readonly updated_by_admin_id: string;
  readonly deleted_at: string;
}

function isProviderDatabaseError(
  error: unknown,
): error is ProviderDatabaseError {
  return typeof error === 'object' && error !== null;
}

function createProviderErrorDetails(
  error: ProviderDatabaseError,
): Record<string, unknown> {
  return {
    ...(error.code ? { provider_code: error.code } : {}),
    ...(error.details ? { provider_details: error.details } : {}),
    ...(error.hint ? { provider_hint: error.hint } : {}),
  };
}

function mapDatabaseError(error: unknown): AppError {
  if (!isProviderDatabaseError(error)) {
    return AppError.databaseOperationFailed(error);
  }

  const details = createProviderErrorDetails(error);
  const message = error.message ?? '';

  if (
    error.code === '23505' &&
    message.includes('pilates_classes_title_active_unique_idx')
  ) {
    return AppError.pilatesClassTitleAlreadyExists(
      'A Pilates class with this title already exists.',
      details,
    );
  }

  if (
    error.code === '23P01' ||
    message.includes('pilates_class_schedules_trainer_no_overlap')
  ) {
    return AppError.pilatesScheduleConflict(
      'The selected trainer already has a class during this time slot.',
      details,
    );
  }

  if (error.code === '23503') {
    return AppError.invalidRequest(
      'A related Pilates class, trainer, or admin record was not found.',
      details,
    );
  }

  if (error.code === '23514') {
    return AppError.invalidRequest(
      'The submitted Pilates class data violates database constraints.',
      details,
    );
  }

  return AppError.databaseOperationFailed(error);
}

function resolveLimit(
  value: number,
  defaultValue: number,
  maxValue: number,
): number {
  if (!Number.isFinite(value)) {
    return defaultValue;
  }

  const normalizedValue = Math.floor(value);

  if (normalizedValue < 1) {
    return defaultValue;
  }

  return Math.min(normalizedValue, maxValue);
}

function resolveOffset(value: number, defaultValue: number): number {
  if (!Number.isFinite(value)) {
    return defaultValue;
  }

  const normalizedValue = Math.floor(value);

  return normalizedValue >= 0 ? normalizedValue : defaultValue;
}

function resolveRangeEnd(offset: number, limit: number): number {
  return offset + limit - 1;
}

function resolveTotal(count: number | null): number {
  return typeof count === 'number' && Number.isFinite(count) ? count : 0;
}

function sanitizePostgrestSearchTerm(value: string): string {
  return value.replace(/[%,()]/gu, '').trim();
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function uniqueValues(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

@Injectable()
export class PilatesClassRepository {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly adminClient: LAFAMSupabaseClient,
  ) {}

  async createClass(payload: PilatesClassInsert): Promise<PilatesClassRow> {
    const { data, error } = await this.adminClient
      .from('pilates_classes')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data;
  }

  async updateClass(
    classId: string,
    patch: PilatesClassUpdate,
  ): Promise<PilatesClassRow> {
    const { data, error } = await this.adminClient
      .from('pilates_classes')
      .update(patch)
      .eq('id', classId)
      .select('*')
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    if (!data) {
      throw AppError.pilatesClassNotFound(
        'The requested Pilates class was not found.',
        {
          class_id: classId,
        },
      );
    }

    return data;
  }

  async softDeleteClass(input: SoftDeleteClassInput): Promise<PilatesClassRow> {
    const { data, error } = await this.adminClient
      .from('pilates_classes')
      .update({
        status: PILATES_CLASS_STATUS_DELETED,
        deleted_at: input.deleted_at,
        updated_by_admin_id: input.updated_by_admin_id,
      })
      .eq('id', input.class_id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    if (!data) {
      throw AppError.pilatesClassNotFound(
        'The requested Pilates class was not found.',
        {
          class_id: input.class_id,
        },
      );
    }

    return data;
  }

  async findClassById(classId: string): Promise<PilatesClassRow | null> {
    const { data, error } = await this.adminClient
      .from('pilates_classes')
      .select('*')
      .eq('id', classId)
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data;
  }

  async findActiveClassById(classId: string): Promise<PilatesClassRow | null> {
    const { data, error } = await this.adminClient
      .from('pilates_classes')
      .select('*')
      .eq('id', classId)
      .eq('status', PILATES_CLASS_STATUS_ACTIVE)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data;
  }

  async findClassByTitle(title: string): Promise<PilatesClassRow | null> {
    const normalizedTitle = title.trim();

    if (normalizedTitle.length === 0) {
      return null;
    }

    const { data, error } = await this.adminClient
      .from('pilates_classes')
      .select('*')
      .ilike('title', normalizedTitle)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data;
  }

  async listClasses(
    input: PilatesClassListQuery,
  ): Promise<PilatesClassRepositoryListResult<PilatesClassRow>> {
    const limit = resolveLimit(
      input.limit,
      PILATES_CLASS_LIST_DEFAULT_LIMIT,
      PILATES_CLASS_LIST_MAX_LIMIT,
    );
    const offset = resolveOffset(
      input.offset,
      PILATES_CLASS_LIST_DEFAULT_OFFSET,
    );

    let query = this.adminClient
      .from('pilates_classes')
      .select('*', { count: 'exact' });

    if (input.search) {
      const searchTerm = sanitizePostgrestSearchTerm(input.search);

      if (searchTerm.length > 0) {
        query = query.or(
          `title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`,
        );
      }
    }

    if (input.status) {
      query = query.eq('status', input.status);
    }

    if (input.level) {
      query = query.eq('level', input.level);
    }

    if (!input.include_deleted) {
      query = query.is('deleted_at', null);
    }

    const { data, error, count } = await query
      .order(input.sort_by, {
        ascending: input.sort_direction === 'asc',
      })
      .range(offset, resolveRangeEnd(offset, limit));

    if (error) {
      throw mapDatabaseError(error);
    }

    return {
      records: data ?? [],
      total: resolveTotal(count),
    };
  }

  async listPublicClasses(
    input: PilatesClassPublicListQuery,
  ): Promise<PilatesClassRepositoryListResult<PilatesClassRow>> {
    const limit = resolveLimit(
      input.limit,
      PILATES_CLASS_PUBLIC_LIST_DEFAULT_LIMIT,
      PILATES_CLASS_PUBLIC_LIST_MAX_LIMIT,
    );
    const offset = resolveOffset(
      input.offset,
      PILATES_CLASS_LIST_DEFAULT_OFFSET,
    );

    const scheduleFilteredClassIds =
      await this.resolvePublicScheduleClassIds(input);

    if (
      scheduleFilteredClassIds !== null &&
      scheduleFilteredClassIds.length === 0
    ) {
      return {
        records: [],
        total: 0,
      };
    }

    let query = this.adminClient
      .from('pilates_classes')
      .select('*', { count: 'exact' })
      .eq('status', PILATES_CLASS_STATUS_ACTIVE)
      .is('deleted_at', null);

    if (scheduleFilteredClassIds !== null) {
      query = query.in('id', scheduleFilteredClassIds);
    }

    if (input.search) {
      const searchTerm = sanitizePostgrestSearchTerm(input.search);

      if (searchTerm.length > 0) {
        query = query.or(
          `title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`,
        );
      }
    }

    if (input.level) {
      query = query.eq('level', input.level);
    }

    const { data, error, count } = await query
      .order(input.sort_by, {
        ascending: input.sort_direction === 'asc',
      })
      .range(offset, resolveRangeEnd(offset, limit));

    if (error) {
      throw mapDatabaseError(error);
    }

    return {
      records: data ?? [],
      total: resolveTotal(count),
    };
  }

  async createSchedule(
    payload: PilatesClassScheduleInsert,
  ): Promise<PilatesClassScheduleRow> {
    const { data, error } = await this.adminClient
      .from('pilates_class_schedules')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data;
  }

  async updateSchedule(
    scheduleId: string,
    patch: PilatesClassScheduleUpdate,
  ): Promise<PilatesClassScheduleRow> {
    const { data, error } = await this.adminClient
      .from('pilates_class_schedules')
      .update(patch)
      .eq('id', scheduleId)
      .select('*')
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    if (!data) {
      throw AppError.pilatesScheduleNotFound(
        'The requested Pilates class schedule was not found.',
        {
          schedule_id: scheduleId,
        },
      );
    }

    return data;
  }

  async cancelSchedule(
    input: CancelScheduleInput,
  ): Promise<PilatesClassScheduleRow> {
    const { data, error } = await this.adminClient
      .from('pilates_class_schedules')
      .update({
        status: PILATES_CLASS_SCHEDULE_STATUS_CANCELLED,
        cancellation_reason: input.cancellation_reason,
        cancelled_at: input.cancelled_at,
        completed_at: null,
        deleted_at: null,
        updated_by_admin_id: input.updated_by_admin_id,
      })
      .eq('id', input.schedule_id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    if (!data) {
      throw AppError.pilatesScheduleNotFound(
        'The requested Pilates class schedule was not found.',
        {
          schedule_id: input.schedule_id,
        },
      );
    }

    return data;
  }

  async completeSchedule(
    input: CompleteScheduleInput,
  ): Promise<PilatesClassScheduleRow> {
    const { data, error } = await this.adminClient
      .from('pilates_class_schedules')
      .update({
        status: PILATES_CLASS_SCHEDULE_STATUS_COMPLETED,
        cancellation_reason: null,
        cancelled_at: null,
        completed_at: input.completed_at,
        deleted_at: null,
        updated_by_admin_id: input.updated_by_admin_id,
      })
      .eq('id', input.schedule_id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    if (!data) {
      throw AppError.pilatesScheduleNotFound(
        'The requested Pilates class schedule was not found.',
        {
          schedule_id: input.schedule_id,
        },
      );
    }

    return data;
  }

  async softDeleteSchedule(
    input: SoftDeleteScheduleInput,
  ): Promise<PilatesClassScheduleRow> {
    const { data, error } = await this.adminClient
      .from('pilates_class_schedules')
      .update({
        status: PILATES_CLASS_SCHEDULE_STATUS_DELETED,
        cancellation_reason: null,
        cancelled_at: null,
        completed_at: null,
        deleted_at: input.deleted_at,
        updated_by_admin_id: input.updated_by_admin_id,
      })
      .eq('id', input.schedule_id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    if (!data) {
      throw AppError.pilatesScheduleNotFound(
        'The requested Pilates class schedule was not found.',
        {
          schedule_id: input.schedule_id,
        },
      );
    }

    return data;
  }

  async findScheduleById(
    scheduleId: string,
  ): Promise<PilatesClassScheduleRow | null> {
    const { data, error } = await this.adminClient
      .from('pilates_class_schedules')
      .select('*')
      .eq('id', scheduleId)
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data;
  }

  async findScheduleWithRelationsById(
    scheduleId: string,
  ): Promise<PilatesClassScheduleWithRelations | null> {
    const schedule = await this.findScheduleById(scheduleId);

    if (!schedule) {
      return null;
    }

    const hydratedSchedules = await this.hydrateSchedules([schedule]);

    return hydratedSchedules[0] ?? null;
  }

  async findPublicScheduleWithRelationsById(
    scheduleId: string,
  ): Promise<PilatesClassScheduleWithRelations | null> {
    const { data, error } = await this.adminClient
      .from('pilates_class_schedules')
      .select('*')
      .eq('id', scheduleId)
      .eq('status', PILATES_CLASS_SCHEDULE_STATUS_SCHEDULED)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    if (!data) {
      return null;
    }

    const hydratedSchedules = await this.hydrateSchedules([data]);
    const hydratedSchedule = hydratedSchedules[0];

    if (!hydratedSchedule) {
      return null;
    }

    if (
      hydratedSchedule.class.status !== PILATES_CLASS_STATUS_ACTIVE ||
      hydratedSchedule.class.deleted_at !== null
    ) {
      return null;
    }

    return hydratedSchedule;
  }

  async listSchedules(
    input: PilatesClassScheduleListQuery,
  ): Promise<
    PilatesClassRepositoryListResult<PilatesClassScheduleWithRelations>
  > {
    const limit = resolveLimit(
      input.limit,
      PILATES_CLASS_SCHEDULE_LIST_DEFAULT_LIMIT,
      PILATES_CLASS_SCHEDULE_LIST_MAX_LIMIT,
    );
    const offset = resolveOffset(
      input.offset,
      PILATES_CLASS_SCHEDULE_LIST_DEFAULT_OFFSET,
    );

    let query = this.adminClient
      .from('pilates_class_schedules')
      .select('*', { count: 'exact' });

    if (input.class_id) {
      query = query.eq('class_id', input.class_id);
    }

    if (input.trainer_staff_profile_id) {
      query = query.eq(
        'trainer_staff_profile_id',
        input.trainer_staff_profile_id,
      );
    }

    if (input.status) {
      query = query.eq('status', input.status);
    }

    if (input.studio) {
      const studioTerm = sanitizePostgrestSearchTerm(input.studio);

      if (studioTerm.length > 0) {
        query = query.ilike('studio', `%${studioTerm}%`);
      }
    }

    if (input.from_date) {
      query = query.gte('class_date', input.from_date);
    }

    if (input.to_date) {
      query = query.lte('class_date', input.to_date);
    }

    if (!input.include_deleted) {
      query = query.is('deleted_at', null);
    }

    const { data, error, count } = await query
      .order(input.sort_by, {
        ascending: input.sort_direction === 'asc',
      })
      .range(offset, resolveRangeEnd(offset, limit));

    if (error) {
      throw mapDatabaseError(error);
    }

    return {
      records: await this.hydrateSchedules(data ?? []),
      total: resolveTotal(count),
    };
  }

  async listPublicSchedules(
    input: PilatesClassSchedulePublicListQuery,
  ): Promise<
    PilatesClassRepositoryListResult<PilatesClassScheduleWithRelations>
  > {
    const limit = resolveLimit(
      input.limit,
      PILATES_CLASS_SCHEDULE_PUBLIC_LIST_DEFAULT_LIMIT,
      PILATES_CLASS_SCHEDULE_PUBLIC_LIST_MAX_LIMIT,
    );
    const offset = resolveOffset(
      input.offset,
      PILATES_CLASS_SCHEDULE_LIST_DEFAULT_OFFSET,
    );

    const activeClassIds = await this.resolveActiveClassIds(input.class_id);

    if (activeClassIds.length === 0) {
      return {
        records: [],
        total: 0,
      };
    }

    let query = this.adminClient
      .from('pilates_class_schedules')
      .select('*', { count: 'exact' })
      .eq('status', PILATES_CLASS_SCHEDULE_STATUS_SCHEDULED)
      .is('deleted_at', null)
      .in('class_id', activeClassIds);

    if (input.trainer_staff_profile_id) {
      query = query.eq(
        'trainer_staff_profile_id',
        input.trainer_staff_profile_id,
      );
    }

    if (input.studio) {
      const studioTerm = sanitizePostgrestSearchTerm(input.studio);

      if (studioTerm.length > 0) {
        query = query.ilike('studio', `%${studioTerm}%`);
      }
    }

    query = query.gte('class_date', input.from_date ?? todayIsoDate());

    if (input.to_date) {
      query = query.lte('class_date', input.to_date);
    }

    const { data, error, count } = await query
      .order(input.sort_by, {
        ascending: input.sort_direction === 'asc',
      })
      .range(offset, resolveRangeEnd(offset, limit));

    if (error) {
      throw mapDatabaseError(error);
    }

    return {
      records: await this.hydrateSchedules(data ?? []),
      total: resolveTotal(count),
    };
  }

  async findStaffProfileById(
    staffProfileId: string,
  ): Promise<StaffProfileRow | null> {
    const { data, error } = await this.adminClient
      .from('staff_profiles')
      .select('*')
      .eq('id', staffProfileId)
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data;
  }

  async findAppUserById(appUserId: string): Promise<AppUserRow | null> {
    const { data, error } = await this.adminClient
      .from('app_users')
      .select('*')
      .eq('id', appUserId)
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error);
    }

    return data;
  }

  async findTrainerAvailabilityRules(
    input: PilatesTrainerAvailabilityLookupInput,
  ): Promise<readonly StaffAvailabilityRuleRow[]> {
    const dayOfWeek = new Date(`${input.class_date}T00:00:00.000Z`).getUTCDay();

    const { data, error } = await this.adminClient
      .from('staff_availability_rules')
      .select('*')
      .eq('staff_profile_id', input.trainer_staff_profile_id)
      .eq('day_of_week', dayOfWeek)
      .eq('is_available', true)
      .order('start_time', { ascending: true });

    if (error) {
      throw mapDatabaseError(error);
    }

    return data ?? [];
  }

  async hasTrainerScheduleConflict(
    input: PilatesTrainerScheduleConflictLookupInput,
  ): Promise<boolean> {
    let query = this.adminClient
      .from('pilates_class_schedules')
      .select('id')
      .eq('trainer_staff_profile_id', input.trainer_staff_profile_id)
      .eq('class_date', input.class_date)
      .eq('status', PILATES_CLASS_SCHEDULE_STATUS_SCHEDULED)
      .is('deleted_at', null)
      .lt('start_time', input.end_time)
      .gt('end_time', input.start_time)
      .limit(1);

    if (input.exclude_schedule_id) {
      query = query.neq('id', input.exclude_schedule_id);
    }

    const { data, error } = await query;

    if (error) {
      throw mapDatabaseError(error);
    }

    return (data ?? []).length > 0;
  }

  async countScheduledSchedulesByClassId(classId: string): Promise<number> {
    const { error, count } = await this.adminClient
      .from('pilates_class_schedules')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', classId)
      .eq('status', PILATES_CLASS_SCHEDULE_STATUS_SCHEDULED)
      .is('deleted_at', null);

    if (error) {
      throw mapDatabaseError(error);
    }

    return resolveTotal(count);
  }

  private async resolvePublicScheduleClassIds(
    input: PilatesClassPublicListQuery,
  ): Promise<readonly string[] | null> {
    if (!input.trainer_staff_profile_id && !input.from_date && !input.to_date) {
      return null;
    }

    let query = this.adminClient
      .from('pilates_class_schedules')
      .select('class_id')
      .eq('status', PILATES_CLASS_SCHEDULE_STATUS_SCHEDULED)
      .is('deleted_at', null);

    if (input.trainer_staff_profile_id) {
      query = query.eq(
        'trainer_staff_profile_id',
        input.trainer_staff_profile_id,
      );
    }

    query = query.gte('class_date', input.from_date ?? todayIsoDate());

    if (input.to_date) {
      query = query.lte('class_date', input.to_date);
    }

    const { data, error } = await query;

    if (error) {
      throw mapDatabaseError(error);
    }

    return uniqueValues((data ?? []).map((record) => record.class_id));
  }

  private async resolveActiveClassIds(
    classId?: string,
  ): Promise<readonly string[]> {
    let query = this.adminClient
      .from('pilates_classes')
      .select('id')
      .eq('status', PILATES_CLASS_STATUS_ACTIVE)
      .is('deleted_at', null);

    if (classId) {
      query = query.eq('id', classId);
    }

    const { data, error } = await query;

    if (error) {
      throw mapDatabaseError(error);
    }

    return (data ?? []).map((record) => record.id);
  }

  private async hydrateSchedules(
    schedules: readonly PilatesClassScheduleRow[],
  ): Promise<readonly PilatesClassScheduleWithRelations[]> {
    if (schedules.length === 0) {
      return [];
    }

    const classIds = uniqueValues(
      schedules.map((schedule) => schedule.class_id),
    );
    const trainerIds = uniqueValues(
      schedules.map((schedule) => schedule.trainer_staff_profile_id),
    );

    const [classesById, trainersById] = await Promise.all([
      this.fetchClassesByIds(classIds),
      this.fetchStaffProfilesByIds(trainerIds),
    ]);

    return schedules.map((schedule) => {
      const classRecord = classesById.get(schedule.class_id);
      const trainer = trainersById.get(schedule.trainer_staff_profile_id);

      if (!classRecord) {
        throw AppError.pilatesClassNotFound(
          'The related Pilates class was not found.',
          {
            class_id: schedule.class_id,
            schedule_id: schedule.id,
          },
        );
      }

      if (!trainer) {
        throw AppError.pilatesTrainerNotFound(
          'The related Pilates trainer was not found.',
          {
            trainer_staff_profile_id: schedule.trainer_staff_profile_id,
            schedule_id: schedule.id,
          },
        );
      }

      return {
        schedule,
        class: classRecord,
        trainer,
      };
    });
  }

  private async fetchClassesByIds(
    classIds: readonly string[],
  ): Promise<ReadonlyMap<string, PilatesClassRow>> {
    if (classIds.length === 0) {
      return new Map<string, PilatesClassRow>();
    }

    const { data, error } = await this.adminClient
      .from('pilates_classes')
      .select('*')
      .in('id', classIds);

    if (error) {
      throw mapDatabaseError(error);
    }

    return new Map((data ?? []).map((record) => [record.id, record]));
  }

  private async fetchStaffProfilesByIds(
    staffProfileIds: readonly string[],
  ): Promise<ReadonlyMap<string, StaffProfileRow>> {
    if (staffProfileIds.length === 0) {
      return new Map<string, StaffProfileRow>();
    }

    const { data, error } = await this.adminClient
      .from('staff_profiles')
      .select('*')
      .in('id', staffProfileIds);

    if (error) {
      throw mapDatabaseError(error);
    }

    return new Map((data ?? []).map((record) => [record.id, record]));
  }
}
