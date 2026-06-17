// apps/api/src/modules/classes/application/pilates-class-public.service.ts
/**
 * LAFAM Pilates Classes public service.
 *
 * Role:
 * - Owns public/customer-facing Pilates class and schedule read flows.
 * - Exposes only active Pilates classes and scheduled future occurrences.
 * - Converts repository records into public-safe response contracts.
 * - Resolves public Pilates class image URLs from backend-owned storage paths.
 *
 * Important:
 * - This service does not expose admin metadata.
 * - This service does not expose internal image_path values to public clients.
 * - This service does not create bookings, payments, memberships, or waitlist rows.
 * - Availability is temporary until the Booking module owns confirmed bookings/waitlist counts.
 */

import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import type {
  PilatesClassRow,
  PilatesClassScheduleRow,
  StaffProfileRow,
} from '../../../database/database.types';
import {
  PILATES_CLASS_TEMPORARY_BOOKED_COUNT,
  PILATES_CLASS_TEMPORARY_WAITLIST_AVAILABLE,
  PILATES_CLASS_TEMPORARY_WAITLIST_COUNT,
} from '../constants/pilates-class.constants';
import type { ListPublicPilatesClassesQueryDto } from '../dto/list-pilates-classes-query.dto';
import type { ListPublicPilatesSchedulesQueryDto } from '../dto/list-pilates-schedules-query.dto';
import { PilatesClassRepository } from '../repositories/pilates-class.repository';
import type {
  PilatesClassAvailabilitySnapshot,
  PilatesClassPublicDetail,
  PilatesClassPublicListQuery,
  PilatesClassPublicSummary,
  PilatesClassSchedulePublicDetail,
  PilatesClassSchedulePublicListQuery,
  PilatesClassSchedulePublicSummary,
  PilatesClassScheduleWithRelations,
  PilatesClassTrainerSummary,
  PilatesPaginatedResult,
} from '../types/pilates-class.types';
import { PilatesClassImageService } from './pilates-class-image.service';

interface PilatesClassDetailResponse {
  readonly class: PilatesClassPublicDetail;
}

interface PilatesScheduleDetailResponse {
  readonly schedule: PilatesClassSchedulePublicDetail;
}

type PilatesClassImageUrlResolver = (imagePath: string | null) => string | null;

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function maxIsoDate(left: string, right: string): string {
  return left > right ? left : right;
}

function assertValidDateRange(fromDate?: string, toDate?: string): void {
  if (fromDate && toDate && fromDate > toDate) {
    throw AppError.invalidRequest('from_date cannot be later than to_date.', {
      from_date: fromDate,
      to_date: toDate,
    });
  }
}

function shouldApplyClassScheduleFilter(
  dto: ListPublicPilatesClassesQueryDto,
): boolean {
  return Boolean(dto.trainer_staff_profile_id ?? dto.from_date ?? dto.to_date);
}

function resolveFutureFromDate(fromDate?: string): string {
  return maxIsoDate(fromDate ?? todayIsoDate(), todayIsoDate());
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

function buildPublicClassListQuery(
  dto: ListPublicPilatesClassesQueryDto,
): PilatesClassPublicListQuery {
  const shouldFilterBySchedules = shouldApplyClassScheduleFilter(dto);
  const fromDate = shouldFilterBySchedules
    ? resolveFutureFromDate(dto.from_date)
    : undefined;

  assertValidDateRange(fromDate, dto.to_date);

  return {
    ...(dto.search !== undefined ? { search: dto.search } : {}),
    ...(dto.level !== undefined ? { level: dto.level } : {}),
    ...(dto.trainer_staff_profile_id !== undefined
      ? { trainer_staff_profile_id: dto.trainer_staff_profile_id }
      : {}),
    ...(fromDate !== undefined ? { from_date: fromDate } : {}),
    ...(dto.to_date !== undefined ? { to_date: dto.to_date } : {}),
    limit: dto.limit,
    offset: dto.offset,
    sort_by: dto.sort_by,
    sort_direction: dto.sort_direction,
  };
}

function buildPublicScheduleListQuery(
  dto: ListPublicPilatesSchedulesQueryDto,
): PilatesClassSchedulePublicListQuery {
  const fromDate = resolveFutureFromDate(dto.from_date);

  assertValidDateRange(fromDate, dto.to_date);

  return {
    ...(dto.class_id !== undefined ? { class_id: dto.class_id } : {}),
    ...(dto.trainer_staff_profile_id !== undefined
      ? { trainer_staff_profile_id: dto.trainer_staff_profile_id }
      : {}),
    ...(dto.series_id !== undefined ? { series_id: dto.series_id } : {}),
    ...(dto.generation_source !== undefined
      ? { generation_source: dto.generation_source }
      : {}),
    ...(dto.studio !== undefined ? { studio: dto.studio } : {}),
    from_date: fromDate,
    ...(dto.to_date !== undefined ? { to_date: dto.to_date } : {}),
    only_available: dto.only_available ?? false,
    limit: dto.limit,
    offset: dto.offset,
    sort_by: dto.sort_by,
    sort_direction: dto.sort_direction,
  };
}

function mapClassToPublicSummary(
  record: PilatesClassRow,
  resolveImageUrl: PilatesClassImageUrlResolver,
): PilatesClassPublicSummary {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    default_duration_minutes: record.default_duration_minutes,
    default_capacity: record.default_capacity,
    level: record.level,
    image_url: resolveImageUrl(record.image_path),
    realtime_version: record.realtime_version,
  };
}

function mapClassToPublicDetail(
  record: PilatesClassRow,
  resolveImageUrl: PilatesClassImageUrlResolver,
): PilatesClassPublicDetail {
  return {
    ...mapClassToPublicSummary(record, resolveImageUrl),
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

function mapScheduleToPublicSummary(
  record: PilatesClassScheduleWithRelations,
  resolveImageUrl: PilatesClassImageUrlResolver,
): PilatesClassSchedulePublicSummary {
  return {
    id: record.schedule.id,
    studio: record.schedule.studio,
    class_date: record.schedule.class_date,
    start_time: record.schedule.start_time,
    end_time: record.schedule.end_time,
    duration_minutes: record.schedule.duration_minutes,
    capacity: record.schedule.capacity,
    status: record.schedule.status,
    availability: createAvailabilitySnapshot(record.schedule),
    realtime_version: record.schedule.realtime_version,
    series_id: record.schedule.series_id,
    series_occurrence_index: record.schedule.series_occurrence_index,
    generation_source: record.schedule.generation_source,
    class: mapClassToPublicSummary(record.class, resolveImageUrl),
    trainer: mapTrainerToSummary(record.trainer),
  };
}

function mapScheduleToPublicDetail(
  record: PilatesClassScheduleWithRelations,
  resolveImageUrl: PilatesClassImageUrlResolver,
): PilatesClassSchedulePublicDetail {
  return {
    ...mapScheduleToPublicSummary(record, resolveImageUrl),
  };
}

@Injectable()
export class PilatesClassPublicService {
  constructor(
    private readonly pilatesClassRepository: PilatesClassRepository,
    private readonly pilatesClassImageService: PilatesClassImageService,
  ) {}

  private resolveClassImageUrl(imagePath: string | null): string | null {
    if (!imagePath) {
      return null;
    }

    return this.pilatesClassImageService.resolvePublicImageUrl(imagePath);
  }

  private mapClassToPublicSummary(
    record: PilatesClassRow,
  ): PilatesClassPublicSummary {
    return mapClassToPublicSummary(record, (imagePath) =>
      this.resolveClassImageUrl(imagePath),
    );
  }

  private mapClassToPublicDetail(
    record: PilatesClassRow,
  ): PilatesClassPublicDetail {
    return mapClassToPublicDetail(record, (imagePath) =>
      this.resolveClassImageUrl(imagePath),
    );
  }

  private mapScheduleToPublicSummary(
    record: PilatesClassScheduleWithRelations,
  ): PilatesClassSchedulePublicSummary {
    return mapScheduleToPublicSummary(record, (imagePath) =>
      this.resolveClassImageUrl(imagePath),
    );
  }

  private mapScheduleToPublicDetail(
    record: PilatesClassScheduleWithRelations,
  ): PilatesClassSchedulePublicDetail {
    return mapScheduleToPublicDetail(record, (imagePath) =>
      this.resolveClassImageUrl(imagePath),
    );
  }

  async listClasses(
    dto: ListPublicPilatesClassesQueryDto,
  ): Promise<PilatesPaginatedResult<PilatesClassPublicSummary>> {
    const query = buildPublicClassListQuery(dto);
    const result = await this.pilatesClassRepository.listPublicClasses(query);

    return buildPaginatedResult(
      result.records.map((record) => this.mapClassToPublicSummary(record)),
      result.total,
      query.limit,
      query.offset,
    );
  }

  async getClassById(classId: string): Promise<PilatesClassDetailResponse> {
    const record =
      await this.pilatesClassRepository.findActiveClassById(classId);

    if (!record) {
      throw AppError.pilatesClassNotFound(
        'The requested Pilates class was not found.',
        {
          class_id: classId,
        },
      );
    }

    return {
      class: this.mapClassToPublicDetail(record),
    };
  }

  async listSchedules(
    dto: ListPublicPilatesSchedulesQueryDto,
  ): Promise<PilatesPaginatedResult<PilatesClassSchedulePublicSummary>> {
    const query = buildPublicScheduleListQuery(dto);
    const result = await this.pilatesClassRepository.listPublicSchedules(query);

    return buildPaginatedResult(
      result.records.map((record) => this.mapScheduleToPublicSummary(record)),
      result.total,
      query.limit,
      query.offset,
    );
  }

  async getScheduleById(
    scheduleId: string,
  ): Promise<PilatesScheduleDetailResponse> {
    const record =
      await this.pilatesClassRepository.findPublicScheduleWithRelationsById(
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
      schedule: this.mapScheduleToPublicDetail(record),
    };
  }
}
