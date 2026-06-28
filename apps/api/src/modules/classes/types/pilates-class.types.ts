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
  PilatesScheduleSeriesRow,
  PilatesScheduleSeriesTimeSlotRow,
  StaffProfileRow,
} from '../../../database/database.types';
import type {
  PilatesClassCurrency,
  PilatesClassEvent,
  PilatesClassLevel,
  PilatesClassScheduleSortField,
  PilatesClassScheduleStatus,
  PilatesClassSortDirection,
  PilatesClassSortField,
  PilatesClassStatus,
  PilatesScheduleGenerationSource,
  PilatesScheduleMonthlyRule,
  PilatesScheduleSeriesFrequency,
  PilatesScheduleSeriesStatus,
  PilatesScheduleUpdateScope,
  PilatesScheduleWeekday,
} from '../constants/pilates-class.constants';

export type PilatesClassId = string;
export type PilatesClassScheduleId = string;
export type PilatesScheduleSeriesId = string;
export type PilatesTrainerStaffProfileId = string;
export type PilatesAdminUserId = string;
export type PilatesIsoDate = string;
export type PilatesTimeValue = string;
export type PilatesIsoTimestamp = string;

export type PilatesClassRecord = PilatesClassRow;
export type PilatesClassScheduleRecord = PilatesClassScheduleRow;
export type PilatesScheduleSeriesRecord = PilatesScheduleSeriesRow;
export type PilatesScheduleSeriesTimeSlotRecord =
  PilatesScheduleSeriesTimeSlotRow;
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
export interface PilatesClassPriceSnapshot {
  readonly amount: number;
  readonly currency: PilatesClassCurrency;
}

export interface PilatesScheduleTimeSlotInput {
  readonly start_time: string;
  readonly duration_minutes: number;
  readonly capacity?: number;
}

export interface PilatesScheduleSeriesTimeSlotCreateInput {
  readonly slot_index: number;
  readonly day_of_week: PilatesScheduleWeekday | null;
  readonly studio: string;
  readonly start_time: string;
  readonly end_time: string;
  readonly duration_minutes: number;
  readonly capacity: number;
  readonly price_amount?: number | null;
  readonly currency?: PilatesClassCurrency | null;
}

export interface PilatesScheduleSeriesTimeSlotSummary {
  readonly id: string;
  readonly series_id: string;
  readonly slot_index: number;
  readonly day_of_week: PilatesScheduleWeekday | null;
  readonly studio: string;
  readonly start_time: string;
  readonly end_time: string;
  readonly duration_minutes: number;
  readonly capacity: number;
  readonly price_amount: number | null;
  readonly currency: PilatesClassCurrency | null;
  readonly created_at: string;
  readonly updated_at: string;
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
  readonly default_price_amount?: number;
  readonly currency?: PilatesClassCurrency;
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
  readonly default_price_amount?: number;
  readonly currency?: PilatesClassCurrency;
  readonly level: PilatesClassLevel;
  readonly image_url: string | null;
  readonly realtime_version: number;
}

export interface PilatesClassPublicDetail extends PilatesClassPublicSummary {
  readonly upcoming_schedules?: readonly PilatesClassSchedulePublicSummary[];
}

export interface PilatesScheduleSeriesAdminSummary {
  readonly id: string;
  readonly class_id: string;
  readonly trainer_staff_profile_id: string;
  readonly studio: string;
  readonly frequency: PilatesScheduleSeriesFrequency;
  readonly days_of_week: readonly PilatesScheduleWeekday[];
  readonly monthly_rule: PilatesScheduleMonthlyRule | null;
  readonly day_of_month: number | null;
  readonly start_date: string;
  readonly end_date: string;
  readonly start_time: string;
  readonly end_time: string;
  readonly duration_minutes: number;
  readonly capacity: number;
  readonly price_amount?: number | null;
  readonly currency?: PilatesClassCurrency | null;
  readonly uses_multiple_time_slots?: boolean;
  readonly time_slot_count?: number;
  readonly time_slots?: readonly PilatesScheduleSeriesTimeSlotSummary[];
  readonly excluded_dates: readonly string[];
  readonly status: PilatesScheduleSeriesStatus;
  readonly created_by_admin_id: string | null;
  readonly updated_by_admin_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly cancelled_at: string | null;
  readonly deleted_at: string | null;
  readonly realtime_version: number;
  readonly class?: PilatesClassAdminSummary;
  readonly trainer?: PilatesClassTrainerSummary;
  readonly generated_schedule_count?: number;
}

export interface PilatesScheduleSeriesAdminDetail extends PilatesScheduleSeriesAdminSummary {
  readonly class: PilatesClassAdminSummary;
  readonly trainer: PilatesClassTrainerSummary;
  readonly generated_schedules?: readonly PilatesClassScheduleAdminSummary[];
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
  readonly price_amount?: number | null;
  readonly currency?: PilatesClassCurrency | null;
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
  readonly series_id: string | null;
  readonly series_occurrence_index: number | null;
  readonly series_time_slot_id?: string | null;
  readonly series_date_index?: number | null;
  readonly series_slot_index?: number | null;
  readonly generation_source: PilatesScheduleGenerationSource;
  readonly class?: PilatesClassAdminSummary;
  readonly trainer?: PilatesClassTrainerSummary;
  readonly series?: PilatesScheduleSeriesAdminSummary | null;
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
  readonly price_amount?: number | null;
  readonly currency?: PilatesClassCurrency | null;
  readonly status: PilatesClassScheduleStatus;
  readonly availability: PilatesClassAvailabilitySnapshot;
  readonly realtime_version: number;
  readonly series_id: string | null;
  readonly series_occurrence_index: number | null;
  readonly series_time_slot_id?: string | null;
  readonly series_date_index?: number | null;
  readonly series_slot_index?: number | null;
  readonly generation_source: PilatesScheduleGenerationSource;
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
  readonly series_id?: string;
  readonly generation_source?: PilatesScheduleGenerationSource;
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
  readonly series_id?: string;
  readonly generation_source?: PilatesScheduleGenerationSource;
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
  readonly default_price_amount?: number;
  readonly currency?: PilatesClassCurrency;
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
  readonly default_price_amount?: number;
  readonly currency?: PilatesClassCurrency;
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

export interface PilatesWeeklySchedulePlanDayInput {
  readonly day_of_week: PilatesScheduleWeekday;
  readonly time_slots: readonly PilatesScheduleTimeSlotInput[];
}

export interface CreatePilatesClassScheduleInput {
  readonly class_id: string;
  readonly trainer_staff_profile_id: string;
  readonly studio: string;
  readonly start_date: string;
  readonly end_date: string;
  readonly default_capacity: number;
  readonly price_amount: number;
  readonly currency?: PilatesClassCurrency;
  readonly schedule_days: readonly PilatesWeeklySchedulePlanDayInput[];
  readonly actor_admin_user_id: string;
}

export interface UpdatePilatesClassScheduleInput {
  readonly schedule_id: string;
  readonly update_scope?: PilatesScheduleUpdateScope;
  readonly class_id?: string;
  readonly trainer_staff_profile_id?: string;
  readonly studio?: string;
  readonly class_date?: string;
  readonly start_time?: string;
  readonly duration_minutes?: number;
  readonly capacity?: number;
  readonly price_amount?: number | null;
  readonly currency?: PilatesClassCurrency | null;
  readonly actor_admin_user_id: string;
}

export interface CancelPilatesClassScheduleInput {
  readonly schedule_id: string;
  readonly update_scope?: PilatesScheduleUpdateScope;
  readonly cancellation_reason: string;
  readonly actor_admin_user_id: string;
}

export interface DeletePilatesClassScheduleInput {
  readonly schedule_id: string;
  readonly update_scope?: PilatesScheduleUpdateScope;
  readonly actor_admin_user_id: string;
}

export interface CompletePilatesClassScheduleInput {
  readonly schedule_id: string;
  readonly actor_admin_user_id: string;
}

export interface PilatesWeeklySchedulePlanAdminSummary {
  readonly id: string;
  readonly class_id: string;
  readonly trainer_staff_profile_id: string;
  readonly studio: string;
  readonly start_date: string;
  readonly end_date: string;
  readonly days_of_week: readonly PilatesScheduleWeekday[];
  readonly default_capacity: number;
  readonly price_amount: number;
  readonly currency: PilatesClassCurrency;
  readonly time_slot_count: number;
  readonly generated_schedule_count: number;
}

export interface CreatePilatesClassScheduleResult {
  readonly schedule_plan: PilatesWeeklySchedulePlanAdminSummary;
  readonly generated_schedules: readonly PilatesClassScheduleAdminSummary[];
  readonly generated_count: number;
  readonly skipped_dates: readonly string[];
}

export interface PilatesClassScheduleTimeWindow {
  readonly class_date: string;
  readonly start_time: string;
  readonly end_time: string;
  readonly duration_minutes: number;
}
export interface PilatesScheduleGeneratedOccurrence {
  readonly occurrence_index: number;
  readonly class_date: string;
  readonly day_of_week: PilatesScheduleWeekday;
  readonly start_time: string;
  readonly end_time: string;
  readonly duration_minutes: number;
  readonly capacity: number;
  readonly studio?: string;
  readonly price_amount?: number | null;
  readonly currency?: PilatesClassCurrency | null;
  readonly series_time_slot_id?: string | null;
  readonly series_date_index: number;
  readonly series_slot_index: number;
}

export interface PilatesWeeklySchedulePlanGenerationInput {
  readonly start_date: string;
  readonly end_date: string;
  readonly studio: string;
  readonly default_capacity: number;
  readonly price_amount: number;
  readonly currency: PilatesClassCurrency;
  readonly schedule_days: readonly PilatesWeeklySchedulePlanDayInput[];
}

export interface PilatesWeeklySchedulePlanGenerationResult {
  readonly occurrences: readonly PilatesScheduleGeneratedOccurrence[];
  readonly skipped_dates: readonly string[];
}

export interface PilatesGeneratedScheduleConflict {
  readonly occurrence_index: number;
  readonly class_date: string;
  readonly start_time: string;
  readonly end_time: string;
  readonly reason: string;
  readonly series_slot_index?: number | null;
  readonly conflicting_schedule_id?: string;
}

export interface PilatesScheduleSeriesCreateInput {
  readonly class_id: string;
  readonly trainer_staff_profile_id: string;
  readonly studio: string;
  readonly frequency: PilatesScheduleSeriesFrequency;
  readonly days_of_week: readonly PilatesScheduleWeekday[];
  readonly monthly_rule: PilatesScheduleMonthlyRule | null;
  readonly day_of_month: number | null;
  readonly start_date: string;
  readonly end_date: string;
  readonly start_time: string;
  readonly end_time: string;
  readonly duration_minutes: number;
  readonly capacity: number;
  readonly price_amount?: number | null;
  readonly currency?: PilatesClassCurrency | null;
  readonly uses_multiple_time_slots: boolean;
  readonly time_slot_count: number;
  readonly time_slots: readonly PilatesScheduleSeriesTimeSlotCreateInput[];
  readonly excluded_dates: readonly string[];
  readonly actor_admin_user_id: string;
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
  readonly series_id?: string;
  readonly trainer_staff_profile_id?: string;
  readonly generation_source?: PilatesScheduleGenerationSource;
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
export interface PilatesScheduleSeriesCreatedEventPayload extends PilatesClassEventBasePayload {
  readonly event_type: 'pilates.schedule_series.created';
  readonly class_id: string;
  readonly series_id: string;
  readonly trainer_staff_profile_id: string;
  readonly frequency: PilatesScheduleSeriesFrequency;
  readonly start_date: string;
  readonly end_date: string;
  readonly generated_count: number;
  readonly realtime_version: number;
}

export interface PilatesScheduleSeriesUpdatedEventPayload extends PilatesClassEventBasePayload {
  readonly event_type: 'pilates.schedule_series.updated';
  readonly class_id: string;
  readonly series_id: string;
  readonly trainer_staff_profile_id: string;
  readonly frequency: PilatesScheduleSeriesFrequency;
  readonly start_date: string;
  readonly end_date: string;
  readonly realtime_version: number;
}

export interface PilatesScheduleSeriesCancelledEventPayload extends PilatesClassEventBasePayload {
  readonly event_type: 'pilates.schedule_series.cancelled';
  readonly class_id: string;
  readonly series_id: string;
  readonly cancellation_reason: string;
  readonly realtime_version: number;
}

export interface PilatesScheduleSeriesDeletedEventPayload extends PilatesClassEventBasePayload {
  readonly event_type: 'pilates.schedule_series.deleted';
  readonly class_id: string;
  readonly series_id: string;
  readonly realtime_version: number;
}

export interface PilatesRecurringSchedulesGeneratedEventPayload extends PilatesClassEventBasePayload {
  readonly event_type: 'pilates.recurring_schedules.generated';
  readonly class_id: string;
  readonly series_id: string;
  readonly trainer_staff_profile_id: string;
  readonly generated_schedule_ids: readonly string[];
  readonly generated_count: number;
  readonly skipped_dates: readonly string[];
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
  | PilatesScheduleAvailabilityChangedEventPayload
  | PilatesScheduleSeriesCreatedEventPayload
  | PilatesScheduleSeriesUpdatedEventPayload
  | PilatesScheduleSeriesCancelledEventPayload
  | PilatesScheduleSeriesDeletedEventPayload
  | PilatesRecurringSchedulesGeneratedEventPayload;

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
  readonly series?: PilatesScheduleSeriesRecord | null;
  readonly series_time_slot?: PilatesScheduleSeriesTimeSlotRecord | null;
}

export interface PilatesScheduleSeriesWithRelations {
  readonly series: PilatesScheduleSeriesRecord;
  readonly class: PilatesClassRecord;
  readonly trainer: StaffProfileRow;
  readonly time_slots?: readonly PilatesScheduleSeriesTimeSlotRecord[];
  readonly generated_schedules?: readonly PilatesClassScheduleWithRelations[];
}

export interface PilatesClassWithSchedules {
  readonly class: PilatesClassRecord;
  readonly schedules: readonly PilatesClassScheduleWithRelations[];
}
