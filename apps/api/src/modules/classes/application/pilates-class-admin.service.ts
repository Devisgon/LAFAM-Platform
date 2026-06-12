// apps/api/src/modules/classes/application/pilates-class-admin.service.ts
/**
 * LAFAM Pilates Classes admin service.
 *
 * Role:
 * - Owns admin-facing Pilates class and schedule business rules.
 * - Validates trainer assignment, trainer availability, schedule conflicts, class status, and lifecycle transitions.
 * - Converts repository records into admin-safe response contracts.
 * - Emits internal domain events after successful mutations.
 *
 * Important:
 * - This service does not directly query Supabase.
 * - This service does not create bookings, payments, memberships, or waitlist rows.
 * - This service prepares the Classes module for realtime updates through event payloads.
 */

import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import type {
  AppUserRow,
  PilatesClassInsert,
  PilatesClassRow,
  PilatesClassScheduleInsert,
  PilatesClassScheduleRow,
  PilatesClassScheduleUpdate,
  PilatesClassUpdate,
  StaffAvailabilityRuleRow,
  StaffProfileRow,
} from '../../../database/database.types';
import { AUTH_USER_STATUS_ACTIVE } from '../../auth/constants/auth.constants';
import type { AuthInternalContext } from '../../auth/types/auth-context.types';
import {
  STAFF_PROFILE_STATUS_AVAILABLE,
  STAFF_PROFILE_STATUS_DEACTIVATED,
  STAFF_PROFILE_STATUS_DELETED,
  STAFF_PROFILE_STATUS_ON_LEAVE,
  STAFF_PROFILE_STATUS_UNAVAILABLE,
} from '../../staff/constants/staff.constants';
import {
  PILATES_CLASS_DEFAULT_CAPACITY,
  PILATES_CLASS_DEFAULT_DURATION_MINUTES,
  PILATES_CLASS_DEFAULT_LEVEL,
  PILATES_CLASS_DEFAULT_STUDIO,
  PILATES_CLASS_SCHEDULE_STATUS_CANCELLED,
  PILATES_CLASS_SCHEDULE_STATUS_COMPLETED,
  PILATES_CLASS_SCHEDULE_STATUS_DELETED,
  PILATES_CLASS_SCHEDULE_STATUS_SCHEDULED,
  PILATES_CLASS_STATUS_ACTIVE,
  PILATES_CLASS_STATUS_DELETED,
  PILATES_CLASS_TEMPORARY_BOOKED_COUNT,
  PILATES_CLASS_TEMPORARY_WAITLIST_AVAILABLE,
  PILATES_CLASS_TEMPORARY_WAITLIST_COUNT,
  PILATES_CLASS_TRAINER_ROLE,
  isPilatesClassAdminManagementRole,
} from '../constants/pilates-class.constants';
import type { CancelPilatesScheduleDto } from '../dto/cancel-pilates-schedule.dto';
import type { CreatePilatesClassDto } from '../dto/create-pilates-class.dto';
import type { CreatePilatesScheduleDto } from '../dto/create-pilates-schedule.dto';
import type { ListPilatesClassesQueryDto } from '../dto/list-pilates-classes-query.dto';
import type { ListPilatesSchedulesQueryDto } from '../dto/list-pilates-schedules-query.dto';
import type { UpdatePilatesClassDto } from '../dto/update-pilates-class.dto';
import type { UpdatePilatesScheduleDto } from '../dto/update-pilates-schedule.dto';
import { PilatesClassRepository } from '../repositories/pilates-class.repository';
import type {
  PilatesClassAdminDetail,
  PilatesClassAdminSummary,
  PilatesClassAvailabilitySnapshot,
  PilatesClassImageUploadFile,
  PilatesClassListQuery,
  PilatesClassScheduleAdminDetail,
  PilatesClassScheduleAdminSummary,
  PilatesClassScheduleListQuery,
  PilatesClassScheduleTimeWindow,
  PilatesClassScheduleWithRelations,
  PilatesClassTrainerSummary,
  PilatesPaginatedResult,
} from '../types/pilates-class.types';
import { PilatesClassEventService } from './pilates-class-event.service';
import { PilatesClassImageService } from './pilates-class-image.service';

interface PilatesClassMutationResponse {
  readonly class: PilatesClassAdminSummary;
}

interface PilatesClassDetailResponse {
  readonly class: PilatesClassAdminDetail;
}

interface PilatesScheduleMutationResponse {
  readonly schedule: PilatesClassScheduleAdminSummary;
}

interface PilatesScheduleDetailResponse {
  readonly schedule: PilatesClassScheduleAdminDetail;
}

interface PilatesDeleteResponse {
  readonly deleted: true;
  readonly id: string;
}

type PilatesClassImageUrlResolver = (imagePath: string | null) => string | null;
function resolveAdminActorId(auth: AuthInternalContext): string {
  if (!isPilatesClassAdminManagementRole(auth.profile.role)) {
    throw AppError.adminAccessRequired(
      'Admin access is required to manage Pilates classes.',
    );
  }

  return auth.profile.id;
}

function hasObjectKeys(value: Record<string, unknown>): boolean {
  return Object.keys(value).length > 0;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function assertDateIsNotInPast(classDate: string): void {
  if (classDate < todayIsoDate()) {
    throw AppError.pilatesScheduleDateInPast(
      'A Pilates class schedule cannot be created or moved into the past.',
      {
        class_date: classDate,
      },
    );
  }
}

function parseTimeToMinutes(timeValue: string): number {
  const [hourPart, minutePart] = timeValue.split(':');

  const hour = Number(hourPart);
  const minute = Number(minutePart);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw AppError.pilatesScheduleInvalidTime(
      'The Pilates class schedule time is invalid.',
      {
        time: timeValue,
      },
    );
  }

  return hour * 60 + minute;
}

function formatMinutesToTime(totalMinutes: number): string {
  if (totalMinutes <= 0 || totalMinutes > 24 * 60) {
    throw AppError.pilatesScheduleInvalidTime(
      'The Pilates class schedule cannot end after midnight.',
      {
        total_minutes: totalMinutes,
      },
    );
  }

  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;

  if (hour >= 24) {
    throw AppError.pilatesScheduleInvalidTime(
      'The Pilates class schedule cannot end after midnight.',
      {
        total_minutes: totalMinutes,
      },
    );
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function calculateEndTime(startTime: string, durationMinutes: number): string {
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    throw AppError.pilatesDurationInvalid(
      'The Pilates class duration is invalid.',
      {
        duration_minutes: durationMinutes,
      },
    );
  }

  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = startMinutes + durationMinutes;

  return formatMinutesToTime(endMinutes);
}

function isTimeWindowCoveredByRule(
  rule: StaffAvailabilityRuleRow,
  window: PilatesClassScheduleTimeWindow,
): boolean {
  const ruleStart = parseTimeToMinutes(rule.start_time);
  const ruleEnd = parseTimeToMinutes(rule.end_time);
  const scheduleStart = parseTimeToMinutes(window.start_time);
  const scheduleEnd = parseTimeToMinutes(window.end_time);

  return ruleStart <= scheduleStart && ruleEnd >= scheduleEnd;
}

function createAvailabilitySnapshot(
  schedule: PilatesClassScheduleRow,
): PilatesClassAvailabilitySnapshot {
  return {
    capacity: schedule.capacity,
    booked_count: PILATES_CLASS_TEMPORARY_BOOKED_COUNT,
    available_seats: schedule.capacity,
    waitlist_count: PILATES_CLASS_TEMPORARY_WAITLIST_COUNT,
    waitlist_available: PILATES_CLASS_TEMPORARY_WAITLIST_AVAILABLE,
    realtime_version: schedule.realtime_version,
  };
}

function buildPaginatedResult<TItem>(
  items: readonly TItem[],
  total: number,
  limit: number,
  offset: number,
): PilatesPaginatedResult<TItem> {
  return {
    items,
    total,
    limit,
    offset,
    has_more: offset + items.length < total,
  };
}

function buildClassListQuery(
  dto: ListPilatesClassesQueryDto,
): PilatesClassListQuery {
  return {
    ...(dto.search !== undefined ? { search: dto.search } : {}),
    ...(dto.status !== undefined ? { status: dto.status } : {}),
    ...(dto.level !== undefined ? { level: dto.level } : {}),
    include_deleted: dto.include_deleted ?? false,
    limit: dto.limit,
    offset: dto.offset,
    sort_by: dto.sort_by,
    sort_direction: dto.sort_direction,
  };
}

function buildScheduleListQuery(
  dto: ListPilatesSchedulesQueryDto,
): PilatesClassScheduleListQuery {
  return {
    ...(dto.class_id !== undefined ? { class_id: dto.class_id } : {}),
    ...(dto.trainer_staff_profile_id !== undefined
      ? { trainer_staff_profile_id: dto.trainer_staff_profile_id }
      : {}),
    ...(dto.status !== undefined ? { status: dto.status } : {}),
    ...(dto.studio !== undefined ? { studio: dto.studio } : {}),
    ...(dto.from_date !== undefined ? { from_date: dto.from_date } : {}),
    ...(dto.to_date !== undefined ? { to_date: dto.to_date } : {}),
    include_deleted: dto.include_deleted ?? false,
    limit: dto.limit,
    offset: dto.offset,
    sort_by: dto.sort_by,
    sort_direction: dto.sort_direction,
  };
}

function mapClassToAdminSummary(
  record: PilatesClassRow,
  resolveImageUrl: PilatesClassImageUrlResolver,
): PilatesClassAdminSummary {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    default_duration_minutes: record.default_duration_minutes,
    default_capacity: record.default_capacity,
    level: record.level,
    status: record.status,
    image_path: record.image_path,
    image_url: resolveImageUrl(record.image_path),
    created_by_admin_id: record.created_by_admin_id,
    updated_by_admin_id: record.updated_by_admin_id,
    created_at: record.created_at,
    updated_at: record.updated_at,
    deleted_at: record.deleted_at,
    realtime_version: record.realtime_version,
  };
}

function mapTrainerToSummary(
  trainer: StaffProfileRow,
): PilatesClassTrainerSummary {
  return {
    id: trainer.id,
    app_user_id: trainer.app_user_id,
    display_name: trainer.display_name,
    post_title: trainer.post_title,
    bio: trainer.bio,
    specialties: trainer.specialties,
    status: trainer.status,
  };
}

function mapScheduleToAdminSummary(
  record: PilatesClassScheduleWithRelations,
  resolveImageUrl: PilatesClassImageUrlResolver,
): PilatesClassScheduleAdminSummary {
  return {
    id: record.schedule.id,
    class_id: record.schedule.class_id,
    trainer_staff_profile_id: record.schedule.trainer_staff_profile_id,
    studio: record.schedule.studio,
    class_date: record.schedule.class_date,
    start_time: record.schedule.start_time,
    end_time: record.schedule.end_time,
    duration_minutes: record.schedule.duration_minutes,
    capacity: record.schedule.capacity,
    status: record.schedule.status,
    cancellation_reason: record.schedule.cancellation_reason,
    created_by_admin_id: record.schedule.created_by_admin_id,
    updated_by_admin_id: record.schedule.updated_by_admin_id,
    created_at: record.schedule.created_at,
    updated_at: record.schedule.updated_at,
    cancelled_at: record.schedule.cancelled_at,
    completed_at: record.schedule.completed_at,
    deleted_at: record.schedule.deleted_at,
    realtime_version: record.schedule.realtime_version,
    class: mapClassToAdminSummary(record.class, resolveImageUrl),
    trainer: mapTrainerToSummary(record.trainer),
    availability: createAvailabilitySnapshot(record.schedule),
  };
}

function mapScheduleToAdminDetail(
  record: PilatesClassScheduleWithRelations,
  resolveImageUrl: PilatesClassImageUrlResolver,
): PilatesClassScheduleAdminDetail {
  return {
    ...mapScheduleToAdminSummary(record, resolveImageUrl),
    class: mapClassToAdminSummary(record.class, resolveImageUrl),
    trainer: mapTrainerToSummary(record.trainer),
  };
}

function assertClassIsNotDeleted(record: PilatesClassRow): void {
  if (
    record.status === PILATES_CLASS_STATUS_DELETED ||
    record.deleted_at !== null
  ) {
    throw AppError.pilatesClassAlreadyDeleted(
      'This Pilates class is already deleted.',
      {
        class_id: record.id,
      },
    );
  }
}

function assertClassCanBeScheduled(record: PilatesClassRow): void {
  assertClassIsNotDeleted(record);

  if (record.status !== PILATES_CLASS_STATUS_ACTIVE) {
    throw AppError.pilatesClassInvalidStatus(
      'Only active Pilates classes can be scheduled.',
      {
        class_id: record.id,
        status: record.status,
      },
    );
  }
}
function assertClassImageMutationIsNotConflicting(input: {
  readonly imageFile: PilatesClassImageUploadFile | null;
  readonly removeImage: boolean;
}): void {
  if (!input.imageFile || !input.removeImage) {
    return;
  }

  throw AppError.invalidRequest(
    'Cannot upload a Pilates class image and remove the existing image in the same request.',
    {
      image_field: 'image',
      remove_image: input.removeImage,
    },
  );
}

function assertScheduleCanBeMutated(schedule: PilatesClassScheduleRow): void {
  if (
    schedule.status === PILATES_CLASS_SCHEDULE_STATUS_DELETED ||
    schedule.deleted_at !== null
  ) {
    throw AppError.pilatesScheduleAlreadyDeleted(
      'This Pilates class schedule is already deleted.',
      {
        schedule_id: schedule.id,
      },
    );
  }

  if (schedule.status === PILATES_CLASS_SCHEDULE_STATUS_CANCELLED) {
    throw AppError.pilatesScheduleAlreadyCancelled(
      'This Pilates class schedule is already cancelled.',
      {
        schedule_id: schedule.id,
      },
    );
  }

  if (schedule.status === PILATES_CLASS_SCHEDULE_STATUS_COMPLETED) {
    throw AppError.pilatesScheduleAlreadyCompleted(
      'This Pilates class schedule is already completed.',
      {
        schedule_id: schedule.id,
      },
    );
  }
}

function assertTrainerProfileIsAssignable(
  trainer: StaffProfileRow,
  appUser: AppUserRow,
): void {
  if (appUser.role !== PILATES_CLASS_TRAINER_ROLE) {
    throw AppError.pilatesTrainerNotFound(
      'The selected staff member is not a Pilates trainer.',
      {
        staff_profile_id: trainer.id,
        app_user_id: trainer.app_user_id,
        role: appUser.role,
      },
    );
  }

  if (
    appUser.status !== AUTH_USER_STATUS_ACTIVE ||
    trainer.status === STAFF_PROFILE_STATUS_DEACTIVATED ||
    trainer.status === STAFF_PROFILE_STATUS_DELETED ||
    trainer.deleted_at !== null ||
    trainer.deactivated_at !== null
  ) {
    throw AppError.pilatesTrainerInactive(
      'The selected Pilates trainer is not active.',
      {
        staff_profile_id: trainer.id,
        app_user_id: trainer.app_user_id,
        auth_status: appUser.status,
        staff_status: trainer.status,
      },
    );
  }

  if (
    trainer.status === STAFF_PROFILE_STATUS_UNAVAILABLE ||
    trainer.status === STAFF_PROFILE_STATUS_ON_LEAVE
  ) {
    throw AppError.pilatesTrainerNotAvailable(
      'The selected Pilates trainer is not available.',
      {
        staff_profile_id: trainer.id,
        staff_status: trainer.status,
      },
    );
  }

  if (trainer.status !== STAFF_PROFILE_STATUS_AVAILABLE) {
    throw AppError.pilatesTrainerInactive(
      'The selected Pilates trainer is not active.',
      {
        staff_profile_id: trainer.id,
        staff_status: trainer.status,
      },
    );
  }
}

@Injectable()
export class PilatesClassAdminService {
  constructor(
    private readonly pilatesClassRepository: PilatesClassRepository,
    private readonly pilatesClassEventService: PilatesClassEventService,
    private readonly pilatesClassImageService: PilatesClassImageService,
  ) {}
  private resolveClassImageUrl(imagePath: string | null): string | null {
    if (!imagePath) {
      return null;
    }

    return this.pilatesClassImageService.resolvePublicImageUrl(imagePath);
  }

  private mapClassToAdminSummary(
    record: PilatesClassRow,
  ): PilatesClassAdminSummary {
    return mapClassToAdminSummary(record, (imagePath) =>
      this.resolveClassImageUrl(imagePath),
    );
  }

  private mapScheduleToAdminSummary(
    record: PilatesClassScheduleWithRelations,
  ): PilatesClassScheduleAdminSummary {
    return mapScheduleToAdminSummary(record, (imagePath) =>
      this.resolveClassImageUrl(imagePath),
    );
  }

  private mapScheduleToAdminDetail(
    record: PilatesClassScheduleWithRelations,
  ): PilatesClassScheduleAdminDetail {
    return mapScheduleToAdminDetail(record, (imagePath) =>
      this.resolveClassImageUrl(imagePath),
    );
  }
  async listClasses(
    auth: AuthInternalContext,
    dto: ListPilatesClassesQueryDto,
  ): Promise<PilatesPaginatedResult<PilatesClassAdminSummary>> {
    resolveAdminActorId(auth);

    const query = buildClassListQuery(dto);
    const result = await this.pilatesClassRepository.listClasses(query);

    return buildPaginatedResult(
      result.records.map((record) => this.mapClassToAdminSummary(record)),
      result.total,
      query.limit,
      query.offset,
    );
  }

  async getClassById(
    auth: AuthInternalContext,
    classId: string,
  ): Promise<PilatesClassDetailResponse> {
    resolveAdminActorId(auth);

    const record = await this.pilatesClassRepository.findClassById(classId);

    if (!record) {
      throw AppError.pilatesClassNotFound(
        'The requested Pilates class was not found.',
        {
          class_id: classId,
        },
      );
    }

    return {
      class: this.mapClassToAdminSummary(record),
    };
  }

  async createClass(
    auth: AuthInternalContext,
    dto: CreatePilatesClassDto,
    imageFile: PilatesClassImageUploadFile | null = null,
  ): Promise<PilatesClassMutationResponse> {
    const adminUserId = resolveAdminActorId(auth);

    const existingClass = await this.pilatesClassRepository.findClassByTitle(
      dto.title,
    );

    if (existingClass) {
      throw AppError.pilatesClassTitleAlreadyExists(
        'A Pilates class with this title already exists.',
        {
          title: dto.title,
        },
      );
    }

    const validatedImageFile =
      this.pilatesClassImageService.validateOptionalImageFile(imageFile);

    const classId = randomUUID();
    let uploadedImagePath: string | null = null;

    try {
      if (validatedImageFile) {
        const imageUploadResult =
          await this.pilatesClassImageService.uploadClassImage({
            classId,
            file: validatedImageFile,
          });

        uploadedImagePath = imageUploadResult.image_path;
      }

      const payload: PilatesClassInsert = {
        id: classId,
        title: dto.title,
        description: dto.description ?? null,
        default_duration_minutes:
          dto.default_duration_minutes ??
          PILATES_CLASS_DEFAULT_DURATION_MINUTES,
        default_capacity:
          dto.default_capacity ?? PILATES_CLASS_DEFAULT_CAPACITY,
        level: dto.level ?? PILATES_CLASS_DEFAULT_LEVEL,
        status: dto.status ?? 'draft',
        image_path: uploadedImagePath,
        created_by_admin_id: adminUserId,
        updated_by_admin_id: adminUserId,
      };

      const record = await this.pilatesClassRepository.createClass(payload);

      this.pilatesClassEventService.recordClassCreated(record, {
        actor_admin_user_id: adminUserId,
      });

      return {
        class: this.mapClassToAdminSummary(record),
      };
    } catch (error) {
      if (uploadedImagePath) {
        await this.pilatesClassImageService.deleteClassImage(uploadedImagePath);
      }

      throw error;
    }
  }

  async updateClass(
    auth: AuthInternalContext,
    classId: string,
    dto: UpdatePilatesClassDto,
    imageFile: PilatesClassImageUploadFile | null = null,
  ): Promise<PilatesClassMutationResponse> {
    const adminUserId = resolveAdminActorId(auth);
    const removeImage = dto.remove_image ?? false;

    assertClassImageMutationIsNotConflicting({
      imageFile,
      removeImage,
    });

    const validatedImageFile =
      this.pilatesClassImageService.validateOptionalImageFile(imageFile);

    const existingClass =
      await this.pilatesClassRepository.findClassById(classId);

    if (!existingClass) {
      throw AppError.pilatesClassNotFound(
        'The requested Pilates class was not found.',
        {
          class_id: classId,
        },
      );
    }

    assertClassIsNotDeleted(existingClass);

    const patch: PilatesClassUpdate = {
      updated_by_admin_id: adminUserId,
    };

    const businessPatchFields: Record<string, unknown> = {};
    let uploadedImagePath: string | null = null;

    if (dto.title !== undefined) {
      const classWithSameTitle =
        await this.pilatesClassRepository.findClassByTitle(dto.title);

      if (classWithSameTitle && classWithSameTitle.id !== classId) {
        throw AppError.pilatesClassTitleAlreadyExists(
          'A Pilates class with this title already exists.',
          {
            title: dto.title,
          },
        );
      }

      patch.title = dto.title;
      businessPatchFields.title = dto.title;
    }

    if (dto.description !== undefined) {
      patch.description = dto.description;
      businessPatchFields.description = dto.description;
    }

    if (dto.default_duration_minutes !== undefined) {
      patch.default_duration_minutes = dto.default_duration_minutes;
      businessPatchFields.default_duration_minutes =
        dto.default_duration_minutes;
    }

    if (dto.default_capacity !== undefined) {
      patch.default_capacity = dto.default_capacity;
      businessPatchFields.default_capacity = dto.default_capacity;
    }

    if (dto.level !== undefined) {
      patch.level = dto.level;
      businessPatchFields.level = dto.level;
    }

    if (dto.status !== undefined) {
      patch.status = dto.status;
      businessPatchFields.status = dto.status;
    }

    try {
      if (validatedImageFile) {
        const imageUploadResult =
          await this.pilatesClassImageService.uploadClassImage({
            classId,
            file: validatedImageFile,
          });

        uploadedImagePath = imageUploadResult.image_path;
        patch.image_path = imageUploadResult.image_path;
        businessPatchFields.image_file = imageUploadResult.image_path;
      }

      if (removeImage) {
        patch.image_path = null;
        businessPatchFields.remove_image = true;
      }

      if (!hasObjectKeys(businessPatchFields)) {
        throw AppError.pilatesClassEmptyUpdate(
          'At least one Pilates class field must be provided for update.',
        );
      }

      const record = await this.pilatesClassRepository.updateClass(
        classId,
        patch,
      );

      if (
        existingClass.image_path &&
        existingClass.image_path !== record.image_path
      ) {
        await this.pilatesClassImageService.deleteClassImage(
          existingClass.image_path,
        );
      }

      this.pilatesClassEventService.recordClassUpdated(record, {
        actor_admin_user_id: adminUserId,
      });

      return {
        class: this.mapClassToAdminSummary(record),
      };
    } catch (error) {
      if (uploadedImagePath && uploadedImagePath !== existingClass.image_path) {
        await this.pilatesClassImageService.deleteClassImage(uploadedImagePath);
      }

      throw error;
    }
  }

  async deleteClass(
    auth: AuthInternalContext,
    classId: string,
  ): Promise<PilatesDeleteResponse> {
    const adminUserId = resolveAdminActorId(auth);

    const existingClass =
      await this.pilatesClassRepository.findClassById(classId);

    if (!existingClass) {
      throw AppError.pilatesClassNotFound(
        'The requested Pilates class was not found.',
        {
          class_id: classId,
        },
      );
    }

    assertClassIsNotDeleted(existingClass);

    const scheduledCount =
      await this.pilatesClassRepository.countScheduledSchedulesByClassId(
        classId,
      );

    if (scheduledCount > 0) {
      throw AppError.pilatesClassDeleteBlocked(
        'This Pilates class cannot be deleted while scheduled occurrences still depend on it.',
        {
          class_id: classId,
          scheduled_count: scheduledCount,
        },
      );
    }

    const record = await this.pilatesClassRepository.softDeleteClass({
      class_id: classId,
      updated_by_admin_id: adminUserId,
      deleted_at: new Date().toISOString(),
    });

    this.pilatesClassEventService.recordClassDeleted(record, {
      actor_admin_user_id: adminUserId,
    });

    return {
      deleted: true,
      id: classId,
    };
  }

  async listSchedules(
    auth: AuthInternalContext,
    dto: ListPilatesSchedulesQueryDto,
  ): Promise<PilatesPaginatedResult<PilatesClassScheduleAdminSummary>> {
    resolveAdminActorId(auth);

    const query = buildScheduleListQuery(dto);
    const result = await this.pilatesClassRepository.listSchedules(query);

    return buildPaginatedResult(
      result.records.map((record) => this.mapScheduleToAdminSummary(record)),
      result.total,
      query.limit,
      query.offset,
    );
  }

  async getScheduleById(
    auth: AuthInternalContext,
    scheduleId: string,
  ): Promise<PilatesScheduleDetailResponse> {
    resolveAdminActorId(auth);

    const record =
      await this.pilatesClassRepository.findScheduleWithRelationsById(
        scheduleId,
      );

    if (!record) {
      throw AppError.pilatesScheduleNotFound(
        'The requested Pilates class schedule was not found.',
        {
          schedule_id: scheduleId,
        },
      );
    }

    return {
      schedule: this.mapScheduleToAdminDetail(record),
    };
  }

  async createSchedule(
    auth: AuthInternalContext,
    dto: CreatePilatesScheduleDto,
  ): Promise<PilatesScheduleMutationResponse> {
    const adminUserId = resolveAdminActorId(auth);

    const classRecord = await this.resolveSchedulableClass(dto.class_id);

    const durationMinutes =
      dto.duration_minutes ?? classRecord.default_duration_minutes;
    const capacity = dto.capacity ?? classRecord.default_capacity;
    const endTime = calculateEndTime(dto.start_time, durationMinutes);

    const window: PilatesClassScheduleTimeWindow = {
      class_date: dto.class_date,
      start_time: dto.start_time,
      end_time: endTime,
      duration_minutes: durationMinutes,
    };

    assertDateIsNotInPast(window.class_date);

    await this.assertTrainerCanBeAssigned({
      trainerStaffProfileId: dto.trainer_staff_profile_id,
      window,
    });

    const payload: PilatesClassScheduleInsert = {
      class_id: classRecord.id,
      trainer_staff_profile_id: dto.trainer_staff_profile_id,
      studio: dto.studio ?? PILATES_CLASS_DEFAULT_STUDIO,
      class_date: window.class_date,
      start_time: window.start_time,
      end_time: window.end_time,
      duration_minutes: window.duration_minutes,
      capacity,
      status: PILATES_CLASS_SCHEDULE_STATUS_SCHEDULED,
      created_by_admin_id: adminUserId,
      updated_by_admin_id: adminUserId,
    };

    const schedule = await this.pilatesClassRepository.createSchedule(payload);

    this.pilatesClassEventService.recordScheduleCreated(
      schedule,
      createAvailabilitySnapshot(schedule),
      {
        actor_admin_user_id: adminUserId,
      },
    );

    const hydratedSchedule =
      await this.pilatesClassRepository.findScheduleWithRelationsById(
        schedule.id,
      );

    if (!hydratedSchedule) {
      throw AppError.pilatesScheduleNotFound(
        'The created Pilates schedule could not be loaded.',
        {
          schedule_id: schedule.id,
        },
      );
    }

    return {
      schedule: this.mapScheduleToAdminSummary(hydratedSchedule),
    };
  }

  async updateSchedule(
    auth: AuthInternalContext,
    scheduleId: string,
    dto: UpdatePilatesScheduleDto,
  ): Promise<PilatesScheduleMutationResponse> {
    const adminUserId = resolveAdminActorId(auth);

    const existingSchedule =
      await this.pilatesClassRepository.findScheduleById(scheduleId);

    if (!existingSchedule) {
      throw AppError.pilatesScheduleNotFound(
        'The requested Pilates class schedule was not found.',
        {
          schedule_id: scheduleId,
        },
      );
    }

    assertScheduleCanBeMutated(existingSchedule);

    const businessPatchFields: Record<string, unknown> = {};

    if (dto.class_id !== undefined) {
      businessPatchFields.class_id = dto.class_id;
    }

    if (dto.trainer_staff_profile_id !== undefined) {
      businessPatchFields.trainer_staff_profile_id =
        dto.trainer_staff_profile_id;
    }

    if (dto.studio !== undefined) {
      businessPatchFields.studio = dto.studio;
    }

    if (dto.class_date !== undefined) {
      businessPatchFields.class_date = dto.class_date;
    }

    if (dto.start_time !== undefined) {
      businessPatchFields.start_time = dto.start_time;
    }

    if (dto.duration_minutes !== undefined) {
      businessPatchFields.duration_minutes = dto.duration_minutes;
    }

    if (dto.capacity !== undefined) {
      businessPatchFields.capacity = dto.capacity;
    }

    if (!hasObjectKeys(businessPatchFields)) {
      throw AppError.pilatesScheduleEmptyUpdate(
        'At least one Pilates schedule field must be provided for update.',
      );
    }

    const classId = dto.class_id ?? existingSchedule.class_id;
    const trainerStaffProfileId =
      dto.trainer_staff_profile_id ?? existingSchedule.trainer_staff_profile_id;
    const classDate = dto.class_date ?? existingSchedule.class_date;
    const startTime = dto.start_time ?? existingSchedule.start_time;
    const durationMinutes =
      dto.duration_minutes ?? existingSchedule.duration_minutes;
    const endTime = calculateEndTime(startTime, durationMinutes);

    await this.resolveSchedulableClass(classId);

    const window: PilatesClassScheduleTimeWindow = {
      class_date: classDate,
      start_time: startTime,
      end_time: endTime,
      duration_minutes: durationMinutes,
    };

    assertDateIsNotInPast(window.class_date);

    await this.assertTrainerCanBeAssigned({
      trainerStaffProfileId,
      window,
      excludeScheduleId: scheduleId,
    });

    const patch: PilatesClassScheduleUpdate = {
      updated_by_admin_id: adminUserId,
    };

    if (dto.class_id !== undefined) {
      patch.class_id = dto.class_id;
    }

    if (dto.trainer_staff_profile_id !== undefined) {
      patch.trainer_staff_profile_id = dto.trainer_staff_profile_id;
    }

    if (dto.studio !== undefined) {
      patch.studio = dto.studio;
    }

    if (dto.class_date !== undefined) {
      patch.class_date = dto.class_date;
    }

    if (dto.start_time !== undefined) {
      patch.start_time = dto.start_time;
    }

    if (dto.duration_minutes !== undefined) {
      patch.duration_minutes = dto.duration_minutes;
    }

    if (dto.start_time !== undefined || dto.duration_minutes !== undefined) {
      patch.end_time = endTime;
    }

    if (dto.capacity !== undefined) {
      patch.capacity = dto.capacity;
    }

    const schedule = await this.pilatesClassRepository.updateSchedule(
      scheduleId,
      patch,
    );

    this.pilatesClassEventService.recordScheduleUpdated(
      schedule,
      createAvailabilitySnapshot(schedule),
      {
        actor_admin_user_id: adminUserId,
      },
    );

    const hydratedSchedule =
      await this.pilatesClassRepository.findScheduleWithRelationsById(
        schedule.id,
      );

    if (!hydratedSchedule) {
      throw AppError.pilatesScheduleNotFound(
        'The updated Pilates schedule could not be loaded.',
        {
          schedule_id: schedule.id,
        },
      );
    }

    return {
      schedule: this.mapScheduleToAdminSummary(hydratedSchedule),
    };
  }

  async cancelSchedule(
    auth: AuthInternalContext,
    scheduleId: string,
    dto: CancelPilatesScheduleDto,
  ): Promise<PilatesScheduleMutationResponse> {
    const adminUserId = resolveAdminActorId(auth);

    const existingSchedule =
      await this.pilatesClassRepository.findScheduleById(scheduleId);

    if (!existingSchedule) {
      throw AppError.pilatesScheduleNotFound(
        'The requested Pilates class schedule was not found.',
        {
          schedule_id: scheduleId,
        },
      );
    }

    assertScheduleCanBeMutated(existingSchedule);

    const schedule = await this.pilatesClassRepository.cancelSchedule({
      schedule_id: scheduleId,
      updated_by_admin_id: adminUserId,
      cancelled_at: new Date().toISOString(),
      cancellation_reason: dto.cancellation_reason,
    });

    this.pilatesClassEventService.recordScheduleCancelled(schedule, {
      actor_admin_user_id: adminUserId,
      cancellation_reason: dto.cancellation_reason,
    });

    const hydratedSchedule =
      await this.pilatesClassRepository.findScheduleWithRelationsById(
        schedule.id,
      );

    if (!hydratedSchedule) {
      throw AppError.pilatesScheduleNotFound(
        'The cancelled Pilates schedule could not be loaded.',
        {
          schedule_id: schedule.id,
        },
      );
    }

    return {
      schedule: this.mapScheduleToAdminSummary(hydratedSchedule),
    };
  }

  async completeSchedule(
    auth: AuthInternalContext,
    scheduleId: string,
  ): Promise<PilatesScheduleMutationResponse> {
    const adminUserId = resolveAdminActorId(auth);

    const existingSchedule =
      await this.pilatesClassRepository.findScheduleById(scheduleId);

    if (!existingSchedule) {
      throw AppError.pilatesScheduleNotFound(
        'The requested Pilates class schedule was not found.',
        {
          schedule_id: scheduleId,
        },
      );
    }

    assertScheduleCanBeMutated(existingSchedule);

    const schedule = await this.pilatesClassRepository.completeSchedule({
      schedule_id: scheduleId,
      updated_by_admin_id: adminUserId,
      completed_at: new Date().toISOString(),
    });

    this.pilatesClassEventService.recordScheduleCompleted(schedule, {
      actor_admin_user_id: adminUserId,
    });

    const hydratedSchedule =
      await this.pilatesClassRepository.findScheduleWithRelationsById(
        schedule.id,
      );

    if (!hydratedSchedule) {
      throw AppError.pilatesScheduleNotFound(
        'The completed Pilates schedule could not be loaded.',
        {
          schedule_id: schedule.id,
        },
      );
    }

    return {
      schedule: this.mapScheduleToAdminSummary(hydratedSchedule),
    };
  }

  async deleteSchedule(
    auth: AuthInternalContext,
    scheduleId: string,
  ): Promise<PilatesDeleteResponse> {
    const adminUserId = resolveAdminActorId(auth);

    const existingSchedule =
      await this.pilatesClassRepository.findScheduleById(scheduleId);

    if (!existingSchedule) {
      throw AppError.pilatesScheduleNotFound(
        'The requested Pilates class schedule was not found.',
        {
          schedule_id: scheduleId,
        },
      );
    }

    if (
      existingSchedule.status === PILATES_CLASS_SCHEDULE_STATUS_DELETED ||
      existingSchedule.deleted_at !== null
    ) {
      throw AppError.pilatesScheduleAlreadyDeleted(
        'This Pilates class schedule is already deleted.',
        {
          schedule_id: scheduleId,
        },
      );
    }

    if (existingSchedule.status === PILATES_CLASS_SCHEDULE_STATUS_COMPLETED) {
      throw AppError.pilatesScheduleAlreadyCompleted(
        'Completed Pilates schedules cannot be deleted.',
        {
          schedule_id: scheduleId,
        },
      );
    }

    const schedule = await this.pilatesClassRepository.softDeleteSchedule({
      schedule_id: scheduleId,
      updated_by_admin_id: adminUserId,
      deleted_at: new Date().toISOString(),
    });

    this.pilatesClassEventService.recordScheduleDeleted(schedule, {
      actor_admin_user_id: adminUserId,
    });

    return {
      deleted: true,
      id: scheduleId,
    };
  }

  private async resolveSchedulableClass(
    classId: string,
  ): Promise<PilatesClassRow> {
    const classRecord =
      await this.pilatesClassRepository.findClassById(classId);

    if (!classRecord) {
      throw AppError.pilatesClassNotFound(
        'The requested Pilates class was not found.',
        {
          class_id: classId,
        },
      );
    }

    assertClassCanBeScheduled(classRecord);

    return classRecord;
  }

  private async assertTrainerCanBeAssigned(input: {
    readonly trainerStaffProfileId: string;
    readonly window: PilatesClassScheduleTimeWindow;
    readonly excludeScheduleId?: string;
  }): Promise<void> {
    const trainer = await this.pilatesClassRepository.findStaffProfileById(
      input.trainerStaffProfileId,
    );

    if (!trainer) {
      throw AppError.pilatesTrainerNotFound(
        'The selected Pilates trainer was not found.',
        {
          trainer_staff_profile_id: input.trainerStaffProfileId,
        },
      );
    }

    const appUser = await this.pilatesClassRepository.findAppUserById(
      trainer.app_user_id,
    );

    if (!appUser) {
      throw AppError.pilatesTrainerNotFound(
        'The selected Pilates trainer user account was not found.',
        {
          trainer_staff_profile_id: input.trainerStaffProfileId,
          app_user_id: trainer.app_user_id,
        },
      );
    }

    assertTrainerProfileIsAssignable(trainer, appUser);

    const availabilityRules =
      await this.pilatesClassRepository.findTrainerAvailabilityRules({
        trainer_staff_profile_id: input.trainerStaffProfileId,
        class_date: input.window.class_date,
        start_time: input.window.start_time,
        end_time: input.window.end_time,
      });

    const isCoveredByAvailability = availabilityRules.some((rule) =>
      isTimeWindowCoveredByRule(rule, input.window),
    );

    if (!isCoveredByAvailability) {
      throw AppError.pilatesTrainerNotAvailable(
        'The selected Pilates trainer is not available for this time slot.',
        {
          trainer_staff_profile_id: input.trainerStaffProfileId,
          class_date: input.window.class_date,
          start_time: input.window.start_time,
          end_time: input.window.end_time,
        },
      );
    }

    const hasConflict =
      await this.pilatesClassRepository.hasTrainerScheduleConflict({
        trainer_staff_profile_id: input.trainerStaffProfileId,
        class_date: input.window.class_date,
        start_time: input.window.start_time,
        end_time: input.window.end_time,
        ...(input.excludeScheduleId
          ? { exclude_schedule_id: input.excludeScheduleId }
          : {}),
      });

    if (hasConflict) {
      throw AppError.pilatesScheduleConflict(
        'The selected trainer already has a Pilates class during this time slot.',
        {
          trainer_staff_profile_id: input.trainerStaffProfileId,
          class_date: input.window.class_date,
          start_time: input.window.start_time,
          end_time: input.window.end_time,
        },
      );
    }
  }
}
