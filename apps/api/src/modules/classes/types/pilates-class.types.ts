// apps/api/src/modules/classes/types/pilates-class.types.ts
/**
 * LAFAM Pilates Classes module types.
 *
 * Role:
 * - Defines service, repository, response, query, availability, and realtime event contracts.
 * - Keeps Pilates class/schedule typing separate from future Salon service modules.
 * - Provides stable contracts for the upcoming repository, services, and controllers.
 *
 * Important:
 * - This file contains types only.
 * - Do not place runtime constants here.
 * - Do not place validation rules here.
 * - Do not place database queries here.
 */

import type {
  PilatesClassRow,
  PilatesClassScheduleRow,
  StaffProfileRow,
} from '../../../database/database.types';
import type {
  PilatesClassEvent,
  PilatesClassLevel,
  PilatesClassScheduleSortField,
  PilatesClassScheduleStatus,
  PilatesClassSortDirection,
  PilatesClassSortField,
  PilatesClassStatus,
} from '../constants/pilates-class.constants';

export type PilatesClassId = string;
export type PilatesClassScheduleId = string;
export type PilatesTrainerStaffProfileId = string;
export type PilatesAdminUserId = string;
export type PilatesIsoDate = string;
export type PilatesTimeValue = string;
export type PilatesIsoTimestamp = string;

export type PilatesClassRecord = PilatesClassRow;
export type PilatesClassScheduleRecord = PilatesClassScheduleRow;
export interface PilatesClassImageUploadFile {
  readonly buffer: Buffer;
  readonly mimetype: string;
  readonly size: number;
  readonly originalname?: string;
}

export interface PilatesClassImageUploadResult {
  readonly image_path: string;
  readonly image_url: string;
}
export interface PilatesClassTrainerSummary {
  readonly id: string;
  readonly app_user_id: string;
  readonly display_name: string;
  readonly post_title: string;
  readonly bio: string | null;
  readonly specialties: readonly string[];
  readonly status: StaffProfileRow['status'];
}

export interface PilatesClassAvailabilitySnapshot {
  readonly capacity: number;
  readonly booked_count: number;
  readonly available_seats: number;
  readonly waitlist_count: number;
  readonly waitlist_available: boolean;
  readonly realtime_version: number;
}

export interface PilatesClassAdminSummary {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly default_duration_minutes: number;
  readonly default_capacity: number;
  readonly level: PilatesClassLevel;
  readonly status: PilatesClassStatus;
  readonly image_path: string | null;
  readonly image_url: string | null;
  readonly created_by_admin_id: string | null;
  readonly updated_by_admin_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
  readonly realtime_version: number;
}

export interface PilatesClassAdminDetail extends PilatesClassAdminSummary {
  readonly schedules?: readonly PilatesClassScheduleAdminSummary[];
}

export interface PilatesClassPublicSummary {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly default_duration_minutes: number;
  readonly default_capacity: number;
  readonly level: PilatesClassLevel;
  readonly image_url: string | null;
  readonly realtime_version: number;
}

export interface PilatesClassPublicDetail extends PilatesClassPublicSummary {
  readonly upcoming_schedules?: readonly PilatesClassSchedulePublicSummary[];
}

export interface PilatesClassScheduleAdminSummary {
  readonly id: string;
  readonly class_id: string;
  readonly trainer_staff_profile_id: string;
  readonly studio: string;
  readonly class_date: string;
  readonly start_time: string;
  readonly end_time: string;
  readonly duration_minutes: number;
  readonly capacity: number;
  readonly status: PilatesClassScheduleStatus;
  readonly cancellation_reason: string | null;
  readonly created_by_admin_id: string | null;
  readonly updated_by_admin_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly cancelled_at: string | null;
  readonly completed_at: string | null;
  readonly deleted_at: string | null;
  readonly realtime_version: number;
  readonly class?: PilatesClassAdminSummary;
  readonly trainer?: PilatesClassTrainerSummary;
  readonly availability: PilatesClassAvailabilitySnapshot;
}

export interface PilatesClassScheduleAdminDetail extends PilatesClassScheduleAdminSummary {
  readonly class: PilatesClassAdminSummary;
  readonly trainer: PilatesClassTrainerSummary;
}

export interface PilatesClassSchedulePublicSummary {
  readonly id: string;
  readonly class: PilatesClassPublicSummary;
  readonly trainer: PilatesClassTrainerSummary;
  readonly studio: string;
  readonly class_date: string;
  readonly start_time: string;
  readonly end_time: string;
  readonly duration_minutes: number;
  readonly capacity: number;
  readonly status: PilatesClassScheduleStatus;
  readonly availability: PilatesClassAvailabilitySnapshot;
  readonly realtime_version: number;
}

export type PilatesClassSchedulePublicDetail =
  PilatesClassSchedulePublicSummary;

export interface PilatesPaginatedResult<TItem> {
  readonly items: readonly TItem[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  readonly has_more: boolean;
}

export interface PilatesClassListQuery {
  readonly search?: string;
  readonly status?: PilatesClassStatus;
  readonly level?: PilatesClassLevel;
  readonly include_deleted?: boolean;
  readonly limit: number;
  readonly offset: number;
  readonly sort_by: PilatesClassSortField;
  readonly sort_direction: PilatesClassSortDirection;
}

export interface PilatesClassPublicListQuery {
  readonly search?: string;
  readonly level?: PilatesClassLevel;
  readonly trainer_staff_profile_id?: string;
  readonly from_date?: string;
  readonly to_date?: string;
  readonly limit: number;
  readonly offset: number;
  readonly sort_by: PilatesClassSortField;
  readonly sort_direction: PilatesClassSortDirection;
}

export interface PilatesClassScheduleListQuery {
  readonly class_id?: string;
  readonly trainer_staff_profile_id?: string;
  readonly status?: PilatesClassScheduleStatus;
  readonly studio?: string;
  readonly from_date?: string;
  readonly to_date?: string;
  readonly include_deleted?: boolean;
  readonly limit: number;
  readonly offset: number;
  readonly sort_by: PilatesClassScheduleSortField;
  readonly sort_direction: PilatesClassSortDirection;
}

export interface PilatesClassSchedulePublicListQuery {
  readonly class_id?: string;
  readonly trainer_staff_profile_id?: string;
  readonly studio?: string;
  readonly from_date?: string;
  readonly to_date?: string;
  readonly only_available?: boolean;
  readonly limit: number;
  readonly offset: number;
  readonly sort_by: PilatesClassScheduleSortField;
  readonly sort_direction: PilatesClassSortDirection;
}

export interface CreatePilatesClassInput {
  readonly title: string;
  readonly description?: string | null;
  readonly default_duration_minutes?: number;
  readonly default_capacity?: number;
  readonly level?: PilatesClassLevel;
  readonly status?: PilatesClassStatus;
  readonly image_file?: PilatesClassImageUploadFile | null;
  readonly actor_admin_user_id: string;
}

export interface UpdatePilatesClassInput {
  readonly class_id: string;
  readonly title?: string;
  readonly description?: string | null;
  readonly default_duration_minutes?: number;
  readonly default_capacity?: number;
  readonly level?: PilatesClassLevel;
  readonly status?: PilatesClassStatus;
  readonly image_file?: PilatesClassImageUploadFile | null;
  readonly remove_image?: boolean;
  readonly actor_admin_user_id: string;
}

export interface DeletePilatesClassInput {
  readonly class_id: string;
  readonly actor_admin_user_id: string;
}

export interface CreatePilatesClassScheduleInput {
  readonly class_id: string;
  readonly trainer_staff_profile_id: string;
  readonly studio?: string;
  readonly class_date: string;
  readonly start_time: string;
  readonly duration_minutes: number;
  readonly capacity?: number;
  readonly actor_admin_user_id: string;
}

export interface UpdatePilatesClassScheduleInput {
  readonly schedule_id: string;
  readonly class_id?: string;
  readonly trainer_staff_profile_id?: string;
  readonly studio?: string;
  readonly class_date?: string;
  readonly start_time?: string;
  readonly duration_minutes?: number;
  readonly capacity?: number;
  readonly actor_admin_user_id: string;
}

export interface CancelPilatesClassScheduleInput {
  readonly schedule_id: string;
  readonly cancellation_reason: string;
  readonly actor_admin_user_id: string;
}

export interface DeletePilatesClassScheduleInput {
  readonly schedule_id: string;
  readonly actor_admin_user_id: string;
}

export interface CompletePilatesClassScheduleInput {
  readonly schedule_id: string;
  readonly actor_admin_user_id: string;
}

export interface PilatesClassScheduleTimeWindow {
  readonly class_date: string;
  readonly start_time: string;
  readonly end_time: string;
  readonly duration_minutes: number;
}

export interface PilatesTrainerScheduleConflictLookupInput {
  readonly trainer_staff_profile_id: string;
  readonly class_date: string;
  readonly start_time: string;
  readonly end_time: string;
  readonly exclude_schedule_id?: string;
}

export interface PilatesTrainerAvailabilityLookupInput {
  readonly trainer_staff_profile_id: string;
  readonly class_date: string;
  readonly start_time: string;
  readonly end_time: string;
}

export interface PilatesClassScheduleAvailabilityLookupInput {
  readonly schedule_id: string;
}

export interface PilatesClassEventBasePayload {
  readonly event_id: string;
  readonly event_type: PilatesClassEvent;
  readonly occurred_at: string;
  readonly actor_admin_user_id?: string;
  readonly class_id?: string;
  readonly schedule_id?: string;
  readonly trainer_staff_profile_id?: string;
  readonly realtime_version?: number;
}

export interface PilatesClassCreatedEventPayload extends PilatesClassEventBasePayload {
  readonly event_type: 'pilates.class.created';
  readonly class_id: string;
  readonly class_title: string;
  readonly status: PilatesClassStatus;
  readonly realtime_version: number;
}

export interface PilatesClassUpdatedEventPayload extends PilatesClassEventBasePayload {
  readonly event_type: 'pilates.class.updated';
  readonly class_id: string;
  readonly class_title: string;
  readonly status: PilatesClassStatus;
  readonly realtime_version: number;
}

export interface PilatesClassDeletedEventPayload extends PilatesClassEventBasePayload {
  readonly event_type: 'pilates.class.deleted';
  readonly class_id: string;
  readonly realtime_version: number;
}

export interface PilatesScheduleCreatedEventPayload extends PilatesClassEventBasePayload {
  readonly event_type: 'pilates.schedule.created';
  readonly class_id: string;
  readonly schedule_id: string;
  readonly trainer_staff_profile_id: string;
  readonly class_date: string;
  readonly start_time: string;
  readonly end_time: string;
  readonly capacity: number;
  readonly available_seats: number;
  readonly waitlist_count: number;
  readonly realtime_version: number;
}

export interface PilatesScheduleUpdatedEventPayload extends PilatesClassEventBasePayload {
  readonly event_type: 'pilates.schedule.updated';
  readonly class_id: string;
  readonly schedule_id: string;
  readonly trainer_staff_profile_id: string;
  readonly class_date: string;
  readonly start_time: string;
  readonly end_time: string;
  readonly capacity: number;
  readonly available_seats: number;
  readonly waitlist_count: number;
  readonly realtime_version: number;
}

export interface PilatesScheduleCancelledEventPayload extends PilatesClassEventBasePayload {
  readonly event_type: 'pilates.schedule.cancelled';
  readonly class_id: string;
  readonly schedule_id: string;
  readonly cancellation_reason: string;
  readonly realtime_version: number;
}

export interface PilatesScheduleCompletedEventPayload extends PilatesClassEventBasePayload {
  readonly event_type: 'pilates.schedule.completed';
  readonly class_id: string;
  readonly schedule_id: string;
  readonly realtime_version: number;
}

export interface PilatesScheduleDeletedEventPayload extends PilatesClassEventBasePayload {
  readonly event_type: 'pilates.schedule.deleted';
  readonly class_id: string;
  readonly schedule_id: string;
  readonly realtime_version: number;
}

export interface PilatesScheduleAvailabilityChangedEventPayload extends PilatesClassEventBasePayload {
  readonly event_type: 'pilates.schedule.availability_changed';
  readonly class_id: string;
  readonly schedule_id: string;
  readonly capacity: number;
  readonly booked_count: number;
  readonly available_seats: number;
  readonly waitlist_count: number;
  readonly waitlist_available: boolean;
  readonly realtime_version: number;
}

export type PilatesClassDomainEventPayload =
  | PilatesClassCreatedEventPayload
  | PilatesClassUpdatedEventPayload
  | PilatesClassDeletedEventPayload
  | PilatesScheduleCreatedEventPayload
  | PilatesScheduleUpdatedEventPayload
  | PilatesScheduleCancelledEventPayload
  | PilatesScheduleCompletedEventPayload
  | PilatesScheduleDeletedEventPayload
  | PilatesScheduleAvailabilityChangedEventPayload;

export interface PilatesClassRepositoryListResult<TRecord> {
  readonly records: readonly TRecord[];
  readonly total: number;
}

export interface PilatesClassMutationResult<TRecord> {
  readonly record: TRecord;
}

export interface PilatesClassScheduleWithRelations {
  readonly schedule: PilatesClassScheduleRecord;
  readonly class: PilatesClassRecord;
  readonly trainer: StaffProfileRow;
}

export interface PilatesClassWithSchedules {
  readonly class: PilatesClassRecord;
  readonly schedules: readonly PilatesClassScheduleWithRelations[];
}
