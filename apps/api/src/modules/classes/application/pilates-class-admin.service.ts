// apps/api/src/modules/classes/application/pilates-class-admin.service.ts
/**
 * LAFAM Pilates Classes admin service.
 *
 * Role:
 * - Owns admin-facing Pilates class and schedule business rules.
 * - Validates trainer assignment, trainer availability, schedule conflicts, class status, and lifecycle transitions.
 * - Supports one weekly Pilates schedule plan that generates concrete schedule rows.
 * - Converts repository records into admin-safe response contracts.
 * - Emits internal domain events after successful mutations.
 *
 * Important:
 * - This service does not directly query Supabase.
 * - This service does not create bookings, payments, memberships, or waitlist rows.
 * - Customers book concrete pilates_class_schedules rows, not schedule plan templates.
 * - Schedule policy generates candidate occurrences only; repository/service logic validates trainer availability and conflicts.
 * - This service prepares the Classes module for realtime updates through event payloads.
 */

import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import type {
  AppUserRow,
  DatabaseJsonObject,
  PilatesClassInsert,
  PilatesClassRow,
  PilatesClassScheduleInsert,
  PilatesClassScheduleRow,
  PilatesClassScheduleUpdate,
  PilatesClassUpdate,
  PilatesScheduleSeriesInsert,
  PilatesScheduleSeriesRow,
  PilatesScheduleSeriesTimeSlotInsert,
  StaffAvailabilityRuleRow,
  StaffProfileRow,
} from '../../../database/database.types';
import { AUTH_USER_STATUS_ACTIVE } from '../../auth/constants/auth.constants';
import type { AuthInternalContext } from '../../auth/types/auth-context.types';
import { EmailNotificationService } from '../../notifications/application/email-notification.service';
import {
  EMAIL_NOTIFICATION_ENTITY_TYPE_PILATES_CLASS_SCHEDULE,
  EMAIL_NOTIFICATION_EVENT_TRAINER_ASSIGNED_TO_CLASS,
  EMAIL_NOTIFICATION_EVENT_TRAINER_REMOVED_FROM_CLASS,
  EMAIL_NOTIFICATION_EVENT_TRAINER_SCHEDULE_CHANGED,
  EMAIL_RECIPIENT_ROLE_TRAINER,
} from '../../notifications/constants/notification.constants';
import { createEntityEmailIdempotencyKey } from '../../notifications/domain/email-idempotency.policy';
import type {
  EmailNotificationEvent,
  EmailRecipient,
} from '../../notifications/types/notification.types';
import {
  STAFF_PROFILE_STATUS_AVAILABLE,
  STAFF_PROFILE_STATUS_DEACTIVATED,
  STAFF_PROFILE_STATUS_DELETED,
  STAFF_PROFILE_STATUS_ON_LEAVE,
  STAFF_PROFILE_STATUS_UNAVAILABLE,
} from '../../staff/constants/staff.constants';
import {
  PILATES_CLASS_DEFAULT_CAPACITY,
  PILATES_CLASS_DEFAULT_CURRENCY,
  PILATES_CLASS_DEFAULT_DURATION_MINUTES,
  PILATES_CLASS_DEFAULT_LEVEL,
  PILATES_CLASS_DEFAULT_PRICE_AMOUNT,
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
  PILATES_SCHEDULE_GENERATION_SOURCE_RECURRING,
  PILATES_SCHEDULE_SERIES_FREQUENCY_WEEKLY,
  PILATES_SCHEDULE_SERIES_STATUS_ACTIVE,
  PILATES_SCHEDULE_UPDATE_SCOPE_THIS_OCCURRENCE,
  isPilatesClassAdminManagementRole,
  isPilatesClassCurrency,
  type PilatesClassCurrency,
  type PilatesScheduleWeekday,
} from '../constants/pilates-class.constants';
import type { CancelPilatesScheduleDto } from '../dto/cancel-pilates-schedule.dto';
import type { CreatePilatesClassDto } from '../dto/create-pilates-class.dto';
import type { CreatePilatesScheduleDto } from '../dto/create-pilates-schedule.dto';
import type { ListPilatesClassesQueryDto } from '../dto/list-pilates-classes-query.dto';
import type { ListPilatesSchedulesQueryDto } from '../dto/list-pilates-schedules-query.dto';
import type { UpdatePilatesClassDto } from '../dto/update-pilates-class.dto';
import type { UpdatePilatesScheduleDto } from '../dto/update-pilates-schedule.dto';
import { PilatesScheduleRecurrencePolicy } from '../domain/pilates-schedule-recurrence.policy';
import { PilatesClassRepository } from '../repositories/pilates-class.repository';
import type {
  CreatePilatesClassScheduleResult,
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
  PilatesScheduleGeneratedOccurrence,
  PilatesScheduleSeriesAdminDetail,
  PilatesScheduleSeriesAdminSummary,
  PilatesScheduleSeriesTimeSlotCreateInput,
  PilatesScheduleSeriesTimeSlotSummary,
  PilatesScheduleSeriesWithRelations,
  PilatesWeeklySchedulePlanAdminSummary,
  PilatesWeeklySchedulePlanGenerationInput,
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

interface AssignableTrainerContext {
  readonly trainer: StaffProfileRow;
  readonly appUser: AppUserRow;
}

interface TrainerNotificationContext {
  readonly trainer: StaffProfileRow;
  readonly appUser: AppUserRow;
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

function resolvePilatesClassCurrency(value: string): PilatesClassCurrency {
  if (isPilatesClassCurrency(value)) {
    return value;
  }

  throw AppError.paymentCurrencyUnsupported('Schedule currency must be KWD.', {
    currency: value,
  });
}

function mapSeriesTimeSlotToAdminSummary(
  timeSlot: NonNullable<
    PilatesScheduleSeriesWithRelations['time_slots']
  >[number],
): PilatesScheduleSeriesTimeSlotSummary {
  return {
    id: timeSlot.id,
    series_id: timeSlot.series_id,
    slot_index: timeSlot.slot_index,
    day_of_week:
      timeSlot.day_of_week !== null
        ? (timeSlot.day_of_week as PilatesScheduleWeekday)
        : null,
    studio: timeSlot.studio,
    start_time: timeSlot.start_time,
    end_time: timeSlot.end_time,
    duration_minutes: timeSlot.duration_minutes,
    capacity: timeSlot.capacity,
    price_amount: timeSlot.price_amount,
    currency:
      timeSlot.currency !== null
        ? resolvePilatesClassCurrency(timeSlot.currency)
        : null,
    created_at: timeSlot.created_at,
    updated_at: timeSlot.updated_at,
  };
}

function hasObjectKeys(value: Record<string, unknown>): boolean {
  return Object.keys(value).length > 0;
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function addOptionalTemplateString(
  target: DatabaseJsonObject,
  key: string,
  value: string | null | undefined,
): void {
  const normalizedValue = normalizeOptionalText(value);

  if (normalizedValue) {
    target[key] = normalizedValue;
  }
}

function createTrainerEmailRecipient(
  context: TrainerNotificationContext,
): EmailRecipient | null {
  const email = normalizeOptionalText(context.appUser.email);

  if (!email) {
    return null;
  }

  return {
    role: EMAIL_RECIPIENT_ROLE_TRAINER,
    email,
    name: context.trainer.display_name,
    appUserId: context.appUser.id,
  };
}

function buildTrainerClassScheduleTemplateData(input: {
  readonly schedule: PilatesClassScheduleAdminSummary;
  readonly trainer: TrainerNotificationContext;
  readonly oldSchedule?: PilatesClassScheduleAdminSummary | null;
}): DatabaseJsonObject {
  const templateData: DatabaseJsonObject = {};

  addOptionalTemplateString(
    templateData,
    'recipientName',
    input.trainer.trainer.display_name,
  );
  addOptionalTemplateString(
    templateData,
    'trainerName',
    input.trainer.trainer.display_name,
  );
  addOptionalTemplateString(
    templateData,
    'classTitle',
    input.schedule.class?.title,
  );
  addOptionalTemplateString(
    templateData,
    'sessionDate',
    input.schedule.class_date,
  );
  addOptionalTemplateString(
    templateData,
    'startTime',
    input.schedule.start_time,
  );
  addOptionalTemplateString(templateData, 'endTime', input.schedule.end_time);

  if (input.oldSchedule) {
    addOptionalTemplateString(
      templateData,
      'oldSessionDate',
      input.oldSchedule.class_date,
    );
    addOptionalTemplateString(
      templateData,
      'oldStartTime',
      input.oldSchedule.start_time,
    );
    addOptionalTemplateString(
      templateData,
      'newSessionDate',
      input.schedule.class_date,
    );
    addOptionalTemplateString(
      templateData,
      'newStartTime',
      input.schedule.start_time,
    );
  }

  return templateData;
}

function buildTrainerClassScheduleMetadata(input: {
  readonly schedule: PilatesClassScheduleAdminSummary;
  readonly adminUserId?: string | null;
  readonly oldSchedule?: PilatesClassScheduleAdminSummary | null;
}): DatabaseJsonObject {
  return {
    schedule_id: input.schedule.id,
    class_id: input.schedule.class_id,
    trainer_staff_profile_id: input.schedule.trainer_staff_profile_id,
    class_date: input.schedule.class_date,
    start_time: input.schedule.start_time,
    end_time: input.schedule.end_time,
    studio: input.schedule.studio,
    status: input.schedule.status,
    ...(input.oldSchedule
      ? {
          old_schedule_id: input.oldSchedule.id,
          old_trainer_staff_profile_id:
            input.oldSchedule.trainer_staff_profile_id,
          old_class_date: input.oldSchedule.class_date,
          old_start_time: input.oldSchedule.start_time,
          old_end_time: input.oldSchedule.end_time,
        }
      : {}),
    ...(input.adminUserId
      ? {
          updated_by_admin_id: input.adminUserId,
        }
      : {}),
  };
}

function hasTrainerScheduleImpactChanged(input: {
  readonly oldSchedule: PilatesClassScheduleAdminSummary;
  readonly newSchedule: PilatesClassScheduleAdminSummary;
}): boolean {
  return (
    input.oldSchedule.class_id !== input.newSchedule.class_id ||
    input.oldSchedule.studio !== input.newSchedule.studio ||
    input.oldSchedule.class_date !== input.newSchedule.class_date ||
    input.oldSchedule.start_time !== input.newSchedule.start_time ||
    input.oldSchedule.end_time !== input.newSchedule.end_time ||
    input.oldSchedule.duration_minutes !== input.newSchedule.duration_minutes
  );
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

function assertOccurrencesAreNotInPast(
  occurrences: readonly PilatesScheduleGeneratedOccurrence[],
): void {
  const today = todayIsoDate();
  const pastOccurrence = occurrences.find(
    (occurrence) => occurrence.class_date < today,
  );

  if (!pastOccurrence) {
    return;
  }

  throw AppError.pilatesScheduleDateInPast(
    'Recurring Pilates schedules cannot generate occurrences in the past.',
    {
      class_date: pastOccurrence.class_date,
      occurrence_index: pastOccurrence.occurrence_index,
    },
  );
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

function buildWeeklySchedulePlanInput(
  dto: CreatePilatesScheduleDto,
): PilatesWeeklySchedulePlanGenerationInput {
  return {
    start_date: dto.start_date,
    end_date: dto.end_date,
    studio: dto.studio,
    default_capacity: dto.default_capacity,
    price_amount: dto.price_amount,
    currency: resolvePilatesClassCurrency(dto.currency),
    schedule_days: dto.schedule_days.map((scheduleDay) => ({
      day_of_week: scheduleDay.day_of_week as PilatesScheduleWeekday,
      time_slots: scheduleDay.time_slots.map((timeSlot) => ({
        start_time: timeSlot.start_time,
        duration_minutes: timeSlot.duration_minutes,
        ...(typeof timeSlot.capacity === 'number'
          ? { capacity: timeSlot.capacity }
          : {}),
      })),
    })),
  };
}

function buildWeeklySeriesTimeSlotPayloads(
  input: PilatesWeeklySchedulePlanGenerationInput,
): readonly PilatesScheduleSeriesTimeSlotCreateInput[] {
  let nextSlotIndex = 1;
  const timeSlots: PilatesScheduleSeriesTimeSlotCreateInput[] = [];

  for (const scheduleDay of [...input.schedule_days].sort(
    (firstDay, secondDay) => firstDay.day_of_week - secondDay.day_of_week,
  )) {
    for (const timeSlot of scheduleDay.time_slots) {
      const endTime = calculateEndTime(
        timeSlot.start_time,
        timeSlot.duration_minutes,
      );

      timeSlots.push({
        slot_index: nextSlotIndex,
        day_of_week: scheduleDay.day_of_week,
        studio: input.studio,
        start_time: timeSlot.start_time,
        end_time: endTime,
        duration_minutes: timeSlot.duration_minutes,
        capacity: timeSlot.capacity ?? input.default_capacity,
        price_amount: input.price_amount,
        currency: input.currency,
      });

      nextSlotIndex += 1;
    }
  }

  return timeSlots;
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
    ...(dto.series_id !== undefined ? { series_id: dto.series_id } : {}),
    ...(dto.generation_source !== undefined
      ? { generation_source: dto.generation_source }
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
    default_price_amount: record.default_price_amount,
    currency: resolvePilatesClassCurrency(record.currency),
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

function mapScheduleSeriesRowToAdminSummary(
  series: PilatesScheduleSeriesRow,
): PilatesScheduleSeriesAdminSummary {
  return {
    id: series.id,
    class_id: series.class_id,
    trainer_staff_profile_id: series.trainer_staff_profile_id,
    studio: series.studio,
    frequency: series.frequency,
    days_of_week: series.days_of_week as readonly PilatesScheduleWeekday[],
    monthly_rule: series.monthly_rule,
    day_of_month: series.day_of_month,
    start_date: series.start_date,
    end_date: series.end_date,
    start_time: series.start_time,
    end_time: series.end_time,
    duration_minutes: series.duration_minutes,
    capacity: series.capacity,
    uses_multiple_time_slots: series.uses_multiple_time_slots,
    time_slot_count: series.time_slot_count,
    excluded_dates: series.excluded_dates,
    status: series.status,
    created_by_admin_id: series.created_by_admin_id,
    updated_by_admin_id: series.updated_by_admin_id,
    created_at: series.created_at,
    updated_at: series.updated_at,
    cancelled_at: series.cancelled_at,
    deleted_at: series.deleted_at,
    realtime_version: series.realtime_version,
  };
}

function mapScheduleSeriesToAdminSummary(
  record: PilatesScheduleSeriesWithRelations,
  resolveImageUrl: PilatesClassImageUrlResolver,
): PilatesScheduleSeriesAdminSummary {
  return {
    ...mapScheduleSeriesRowToAdminSummary(record.series),
    class: mapClassToAdminSummary(record.class, resolveImageUrl),
    trainer: mapTrainerToSummary(record.trainer),
    ...(record.time_slots !== undefined
      ? {
          time_slots: record.time_slots.map((timeSlot) =>
            mapSeriesTimeSlotToAdminSummary(timeSlot),
          ),
        }
      : {}),
    ...(record.generated_schedules !== undefined
      ? { generated_schedule_count: record.generated_schedules.length }
      : {}),
  };
}

function mapScheduleSeriesToAdminDetail(
  record: PilatesScheduleSeriesWithRelations,
  resolveImageUrl: PilatesClassImageUrlResolver,
): PilatesScheduleSeriesAdminDetail {
  const summary = mapScheduleSeriesToAdminSummary(record, resolveImageUrl);

  return {
    ...summary,
    class: mapClassToAdminSummary(record.class, resolveImageUrl),
    trainer: mapTrainerToSummary(record.trainer),
    ...(record.generated_schedules !== undefined
      ? {
          generated_schedules: record.generated_schedules.map((schedule) =>
            mapScheduleToAdminSummary(schedule, resolveImageUrl),
          ),
        }
      : {}),
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
    price_amount: record.schedule.price_amount,
    currency:
      record.schedule.currency !== null
        ? resolvePilatesClassCurrency(record.schedule.currency)
        : null,
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
    series_id: record.schedule.series_id,
    series_occurrence_index: record.schedule.series_occurrence_index,
    series_time_slot_id: record.schedule.series_time_slot_id,
    series_date_index: record.schedule.series_date_index,
    series_slot_index: record.schedule.series_slot_index,
    generation_source: record.schedule.generation_source,
    class: mapClassToAdminSummary(record.class, resolveImageUrl),
    trainer: mapTrainerToSummary(record.trainer),
    series:
      record.series !== undefined && record.series !== null
        ? mapScheduleSeriesRowToAdminSummary(record.series)
        : null,
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

function assertOccurrenceUpdateScopeOnly(
  updateScope: string | undefined,
): void {
  if (
    updateScope === undefined ||
    updateScope === PILATES_SCHEDULE_UPDATE_SCOPE_THIS_OCCURRENCE
  ) {
    return;
  }

  throw AppError.invalidRequest(
    'Only occurrence-level Pilates schedule updates are currently supported.',
    {
      update_scope: updateScope,
      supported_update_scope: PILATES_SCHEDULE_UPDATE_SCOPE_THIS_OCCURRENCE,
    },
  );
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
    private readonly emailNotificationService: EmailNotificationService,
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

  private mapScheduleSeriesToAdminDetail(
    record: PilatesScheduleSeriesWithRelations,
  ): PilatesScheduleSeriesAdminDetail {
    return mapScheduleSeriesToAdminDetail(record, (imagePath) =>
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
        default_price_amount:
          dto.default_price_amount ?? PILATES_CLASS_DEFAULT_PRICE_AMOUNT,
        currency: dto.currency ?? PILATES_CLASS_DEFAULT_CURRENCY,
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

    if (dto.default_price_amount !== undefined) {
      patch.default_price_amount = dto.default_price_amount;
      businessPatchFields.default_price_amount = dto.default_price_amount;
    }

    if (dto.currency !== undefined) {
      patch.currency = dto.currency;
      businessPatchFields.currency = dto.currency;
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
  ): Promise<CreatePilatesClassScheduleResult> {
    const adminUserId = resolveAdminActorId(auth);

    return this.createWeeklySchedulePlan(adminUserId, dto);
  }

  async updateSchedule(
    auth: AuthInternalContext,
    scheduleId: string,
    dto: UpdatePilatesScheduleDto,
  ): Promise<PilatesScheduleMutationResponse> {
    const adminUserId = resolveAdminActorId(auth);

    assertOccurrenceUpdateScopeOnly(dto.update_scope);

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
    const oldHydratedSchedule =
      await this.pilatesClassRepository.findScheduleWithRelationsById(
        scheduleId,
      );

    if (!oldHydratedSchedule) {
      throw AppError.pilatesScheduleNotFound(
        'The existing Pilates schedule could not be loaded.',
        {
          schedule_id: scheduleId,
        },
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

    const oldScheduleSummary =
      this.mapScheduleToAdminSummary(oldHydratedSchedule);
    const updatedScheduleSummary =
      this.mapScheduleToAdminSummary(hydratedSchedule);

    await this.notifyTrainerScheduleUpdated({
      oldSchedule: oldScheduleSummary,
      newSchedule: updatedScheduleSummary,
      adminUserId,
    });

    return {
      schedule: updatedScheduleSummary,
    };
  }

  async cancelSchedule(
    auth: AuthInternalContext,
    scheduleId: string,
    dto: CancelPilatesScheduleDto,
  ): Promise<PilatesScheduleMutationResponse> {
    const adminUserId = resolveAdminActorId(auth);

    assertOccurrenceUpdateScopeOnly(dto.update_scope);

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

    const cancelledScheduleSummary =
      this.mapScheduleToAdminSummary(hydratedSchedule);

    await this.notifyTrainerRemovedFromClass({
      schedule: cancelledScheduleSummary,
      adminUserId,
      scope: `cancelled:${cancelledScheduleSummary.cancelled_at ?? cancelledScheduleSummary.updated_at}`,
    });

    return {
      schedule: cancelledScheduleSummary,
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
    const hydratedExistingSchedule =
      await this.pilatesClassRepository.findScheduleWithRelationsById(
        scheduleId,
      );

    if (!hydratedExistingSchedule) {
      throw AppError.pilatesScheduleNotFound(
        'The existing Pilates schedule could not be loaded.',
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
    await this.notifyTrainerRemovedFromClass({
      schedule: this.mapScheduleToAdminSummary(hydratedExistingSchedule),
      adminUserId,
      scope: `deleted:${schedule.deleted_at ?? schedule.updated_at}`,
    });

    return {
      deleted: true,
      id: scheduleId,
    };
  }

  private async createWeeklySchedulePlan(
    adminUserId: string,
    dto: CreatePilatesScheduleDto,
  ): Promise<CreatePilatesClassScheduleResult> {
    assertDateIsNotInPast(dto.start_date);

    const classRecord = await this.resolveSchedulableClass(dto.class_id);
    const generationInput = buildWeeklySchedulePlanInput(dto);
    const generationResult =
      PilatesScheduleRecurrencePolicy.generateOccurrences(generationInput);

    assertOccurrencesAreNotInPast(generationResult.occurrences);

    await this.assertTrainerCanBeAssignedForGeneratedOccurrences({
      trainerStaffProfileId: dto.trainer_staff_profile_id,
      occurrences: generationResult.occurrences,
    });

    const seriesTimeSlotInputs =
      buildWeeklySeriesTimeSlotPayloads(generationInput);
    const firstTimeSlot = seriesTimeSlotInputs[0];

    if (typeof firstTimeSlot === 'undefined') {
      throw AppError.pilatesScheduleTimeSlotInvalid(
        'schedule_days must include at least one time slot.',
      );
    }

    const daysOfWeek = [
      ...new Set(
        generationInput.schedule_days.map(
          (scheduleDay) => scheduleDay.day_of_week,
        ),
      ),
    ].sort((firstDay, secondDay) => firstDay - secondDay);

    const seriesPayload: PilatesScheduleSeriesInsert = {
      class_id: classRecord.id,
      trainer_staff_profile_id: dto.trainer_staff_profile_id,
      studio: generationInput.studio,
      frequency: PILATES_SCHEDULE_SERIES_FREQUENCY_WEEKLY,
      days_of_week: daysOfWeek,
      monthly_rule: null,
      day_of_month: null,
      start_date: generationInput.start_date,
      end_date: generationInput.end_date,
      start_time: firstTimeSlot.start_time,
      end_time: firstTimeSlot.end_time,
      duration_minutes: firstTimeSlot.duration_minutes,
      capacity: generationInput.default_capacity,
      uses_multiple_time_slots: seriesTimeSlotInputs.length > 1,
      time_slot_count: seriesTimeSlotInputs.length,
      excluded_dates: [],
      status: PILATES_SCHEDULE_SERIES_STATUS_ACTIVE,
      created_by_admin_id: adminUserId,
      updated_by_admin_id: adminUserId,
    };

    const series =
      await this.pilatesClassRepository.createScheduleSeries(seriesPayload);

    const seriesTimeSlotPayloads: PilatesScheduleSeriesTimeSlotInsert[] =
      seriesTimeSlotInputs.map((timeSlot) => ({
        series_id: series.id,
        slot_index: timeSlot.slot_index,
        day_of_week: timeSlot.day_of_week,
        studio: timeSlot.studio,
        start_time: timeSlot.start_time,
        end_time: timeSlot.end_time,
        duration_minutes: timeSlot.duration_minutes,
        capacity: timeSlot.capacity,
        price_amount: timeSlot.price_amount,
        currency: timeSlot.currency,
      }));

    const seriesTimeSlots =
      await this.pilatesClassRepository.createScheduleSeriesTimeSlots(
        seriesTimeSlotPayloads,
      );

    const seriesTimeSlotsBySlotIndex = new Map(
      seriesTimeSlots.map((timeSlot) => [timeSlot.slot_index, timeSlot]),
    );

    const schedulePayloads: PilatesClassScheduleInsert[] =
      generationResult.occurrences.map((occurrence) => {
        const seriesTimeSlot =
          seriesTimeSlotsBySlotIndex.get(occurrence.series_slot_index) ?? null;

        return {
          class_id: classRecord.id,
          trainer_staff_profile_id: dto.trainer_staff_profile_id,
          studio: occurrence.studio ?? generationInput.studio,
          class_date: occurrence.class_date,
          start_time: occurrence.start_time,
          end_time: occurrence.end_time,
          duration_minutes: occurrence.duration_minutes,
          capacity: occurrence.capacity,
          price_amount: occurrence.price_amount ?? generationInput.price_amount,
          currency: occurrence.currency ?? generationInput.currency,
          status: PILATES_CLASS_SCHEDULE_STATUS_SCHEDULED,
          created_by_admin_id: adminUserId,
          updated_by_admin_id: adminUserId,
          series_id: series.id,
          series_occurrence_index: occurrence.occurrence_index,
          series_time_slot_id: seriesTimeSlot?.id ?? null,
          series_date_index: occurrence.series_date_index,
          series_slot_index: occurrence.series_slot_index,
          generation_source: PILATES_SCHEDULE_GENERATION_SOURCE_RECURRING,
        };
      });

    const generatedSchedules =
      await this.pilatesClassRepository.createSchedules(schedulePayloads);

    for (const schedule of generatedSchedules) {
      this.pilatesClassEventService.recordScheduleCreated(
        schedule,
        createAvailabilitySnapshot(schedule),
        {
          actor_admin_user_id: adminUserId,
        },
      );
    }

    const hydratedSeries =
      await this.pilatesClassRepository.findScheduleSeriesWithRelationsById(
        series.id,
      );

    if (!hydratedSeries) {
      throw AppError.pilatesScheduleNotFound(
        'The created Pilates schedule plan could not be loaded.',
        {
          series_id: series.id,
        },
      );
    }

    const seriesDetail = this.mapScheduleSeriesToAdminDetail(hydratedSeries);
    const generatedScheduleSummaries = (
      hydratedSeries.generated_schedules ?? []
    ).map((schedule) => this.mapScheduleToAdminSummary(schedule));
    await this.notifyTrainerAssignedToGeneratedSchedules({
      schedules: generatedScheduleSummaries,
      adminUserId,
    });
    const schedulePlan: PilatesWeeklySchedulePlanAdminSummary = {
      id: seriesDetail.id,
      class_id: seriesDetail.class_id,
      trainer_staff_profile_id: seriesDetail.trainer_staff_profile_id,
      studio: seriesDetail.studio,
      start_date: seriesDetail.start_date,
      end_date: seriesDetail.end_date,
      days_of_week: seriesDetail.days_of_week,
      default_capacity: generationInput.default_capacity,
      price_amount: generationInput.price_amount,
      currency: generationInput.currency,
      time_slot_count: seriesTimeSlotInputs.length,
      generated_schedule_count: generatedScheduleSummaries.length,
    };

    return {
      schedule_plan: schedulePlan,
      generated_schedules: generatedScheduleSummaries,
      generated_count: generatedScheduleSummaries.length,
      skipped_dates: generationResult.skipped_dates,
    };
  }
  private async resolveTrainerNotificationContext(
    trainerStaffProfileId: string,
  ): Promise<TrainerNotificationContext | null> {
    const trainer = await this.pilatesClassRepository.findStaffProfileById(
      trainerStaffProfileId,
    );

    if (!trainer) {
      return null;
    }

    const appUser = await this.pilatesClassRepository.findAppUserById(
      trainer.app_user_id,
    );

    if (!appUser) {
      return null;
    }

    return {
      trainer,
      appUser,
    };
  }

  private async createTrainerClassScheduleNotificationBestEffort(input: {
    readonly eventType: EmailNotificationEvent;
    readonly schedule: PilatesClassScheduleAdminSummary;
    readonly adminUserId?: string | null;
    readonly oldSchedule?: PilatesClassScheduleAdminSummary | null;
    readonly scope?: string | null;
  }): Promise<void> {
    try {
      const trainerContext = await this.resolveTrainerNotificationContext(
        input.schedule.trainer_staff_profile_id,
      );

      if (!trainerContext) {
        return;
      }

      const recipient = createTrainerEmailRecipient(trainerContext);

      if (!recipient) {
        return;
      }

      await this.emailNotificationService.createFromTemplate({
        eventType: input.eventType,
        recipient,
        templateData: buildTrainerClassScheduleTemplateData({
          schedule: input.schedule,
          trainer: trainerContext,
          oldSchedule: input.oldSchedule ?? null,
        }),
        entity: {
          entityType: EMAIL_NOTIFICATION_ENTITY_TYPE_PILATES_CLASS_SCHEDULE,
          entityId: input.schedule.id,
        },
        idempotencyKey: createEntityEmailIdempotencyKey({
          eventType: input.eventType,
          recipientRole: recipient.role,
          recipientEmail: recipient.email,
          recipientAppUserId: recipient.appUserId ?? null,
          entityType: EMAIL_NOTIFICATION_ENTITY_TYPE_PILATES_CLASS_SCHEDULE,
          entityId: input.schedule.id,
          scope: input.scope ?? null,
        }),
        metadata: buildTrainerClassScheduleMetadata({
          schedule: input.schedule,
          oldSchedule: input.oldSchedule ?? null,
          adminUserId: input.adminUserId ?? null,
        }),
      });
    } catch {
      // Best-effort notification side effect. The committed class/schedule mutation remains authoritative.
    }
  }

  private async notifyTrainerAssignedToClass(input: {
    readonly schedule: PilatesClassScheduleAdminSummary;
    readonly adminUserId: string;
    readonly scope?: string | null;
  }): Promise<void> {
    await this.createTrainerClassScheduleNotificationBestEffort({
      eventType: EMAIL_NOTIFICATION_EVENT_TRAINER_ASSIGNED_TO_CLASS,
      schedule: input.schedule,
      adminUserId: input.adminUserId,
      scope: input.scope ?? `assigned:${input.schedule.created_at}`,
    });
  }

  private async notifyTrainerAssignedToGeneratedSchedules(input: {
    readonly schedules: readonly PilatesClassScheduleAdminSummary[];
    readonly adminUserId: string;
  }): Promise<void> {
    for (const schedule of input.schedules) {
      await this.notifyTrainerAssignedToClass({
        schedule,
        adminUserId: input.adminUserId,
        scope: `series:${schedule.series_id ?? 'none'}:${schedule.id}`,
      });
    }
  }

  private async notifyTrainerRemovedFromClass(input: {
    readonly schedule: PilatesClassScheduleAdminSummary;
    readonly adminUserId: string;
    readonly scope?: string | null;
  }): Promise<void> {
    await this.createTrainerClassScheduleNotificationBestEffort({
      eventType: EMAIL_NOTIFICATION_EVENT_TRAINER_REMOVED_FROM_CLASS,
      schedule: input.schedule,
      adminUserId: input.adminUserId,
      scope: input.scope ?? `removed:${input.schedule.updated_at}`,
    });
  }

  private async notifyTrainerScheduleChanged(input: {
    readonly oldSchedule: PilatesClassScheduleAdminSummary;
    readonly newSchedule: PilatesClassScheduleAdminSummary;
    readonly adminUserId: string;
  }): Promise<void> {
    await this.createTrainerClassScheduleNotificationBestEffort({
      eventType: EMAIL_NOTIFICATION_EVENT_TRAINER_SCHEDULE_CHANGED,
      schedule: input.newSchedule,
      oldSchedule: input.oldSchedule,
      adminUserId: input.adminUserId,
      scope: `from:${input.oldSchedule.id}:updated:${input.newSchedule.updated_at}`,
    });
  }

  private async notifyTrainerScheduleUpdated(input: {
    readonly oldSchedule: PilatesClassScheduleAdminSummary;
    readonly newSchedule: PilatesClassScheduleAdminSummary;
    readonly adminUserId: string;
  }): Promise<void> {
    if (
      input.oldSchedule.trainer_staff_profile_id !==
      input.newSchedule.trainer_staff_profile_id
    ) {
      await this.notifyTrainerRemovedFromClass({
        schedule: input.oldSchedule,
        adminUserId: input.adminUserId,
        scope: `reassigned-from:${input.newSchedule.id}:${input.newSchedule.updated_at}`,
      });

      await this.notifyTrainerAssignedToClass({
        schedule: input.newSchedule,
        adminUserId: input.adminUserId,
        scope: `reassigned-to:${input.oldSchedule.id}:${input.newSchedule.updated_at}`,
      });

      return;
    }

    if (!hasTrainerScheduleImpactChanged(input)) {
      return;
    }

    await this.notifyTrainerScheduleChanged(input);
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

  private async resolveAssignableTrainer(
    trainerStaffProfileId: string,
  ): Promise<AssignableTrainerContext> {
    const trainer = await this.pilatesClassRepository.findStaffProfileById(
      trainerStaffProfileId,
    );

    if (!trainer) {
      throw AppError.pilatesTrainerNotFound(
        'The selected Pilates trainer was not found.',
        {
          trainer_staff_profile_id: trainerStaffProfileId,
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
          trainer_staff_profile_id: trainerStaffProfileId,
          app_user_id: trainer.app_user_id,
        },
      );
    }

    assertTrainerProfileIsAssignable(trainer, appUser);

    return {
      trainer,
      appUser,
    };
  }

  private async assertTrainerCanBeAssigned(input: {
    readonly trainerStaffProfileId: string;
    readonly window: PilatesClassScheduleTimeWindow;
    readonly excludeScheduleId?: string;
  }): Promise<void> {
    await this.resolveAssignableTrainer(input.trainerStaffProfileId);

    await this.assertTrainerAvailabilityCoversWindow({
      trainerStaffProfileId: input.trainerStaffProfileId,
      window: input.window,
    });

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

  private async assertTrainerCanBeAssignedForGeneratedOccurrences(input: {
    readonly trainerStaffProfileId: string;
    readonly occurrences: readonly PilatesScheduleGeneratedOccurrence[];
  }): Promise<void> {
    await this.resolveAssignableTrainer(input.trainerStaffProfileId);

    for (const occurrence of input.occurrences) {
      await this.assertTrainerAvailabilityCoversWindow({
        trainerStaffProfileId: input.trainerStaffProfileId,
        window: {
          class_date: occurrence.class_date,
          start_time: occurrence.start_time,
          end_time: occurrence.end_time,
          duration_minutes: occurrence.duration_minutes,
        },
      });
    }

    const conflicts =
      await this.pilatesClassRepository.findGeneratedScheduleConflicts({
        trainer_staff_profile_id: input.trainerStaffProfileId,
        occurrences: input.occurrences,
      });

    if (conflicts.length === 0) {
      return;
    }

    throw AppError.recurrenceConflictFound(
      'One or more generated Pilates schedule occurrences conflict with existing trainer schedules.',
      {
        trainer_staff_profile_id: input.trainerStaffProfileId,
        conflict_count: conflicts.length,
        conflicts: conflicts.slice(0, 20),
      },
    );
  }

  private async assertTrainerAvailabilityCoversWindow(input: {
    readonly trainerStaffProfileId: string;
    readonly window: PilatesClassScheduleTimeWindow;
  }): Promise<void> {
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
  }
}
