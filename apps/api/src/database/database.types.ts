// apps/api/src/database/database.types.ts
/**
 * LAFAM API database types.
 *
 * Role:
 * - Defines the local Supabase database type contract.
 * - Provides shared database health/result types.
 * - Gives repositories and services stable types after approved migrations are added.
 *
 * Important:
 * - This file contains types only.
 * - This file must not create clients.
 * - This file must not read environment variables.
 * - Keep this file aligned with approved Supabase migrations.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  DatabaseHealthStatus,
  DatabaseProvider,
} from './database.constants';

export type DatabaseJson =
  | string
  | number
  | boolean
  | null
  | { [key: string]: DatabaseJson | undefined }
  | DatabaseJson[];

export type DatabaseJsonObject = {
  [key: string]: DatabaseJson | undefined;
};

export type DatabaseAppUserRole =
  | 'guest'
  | 'customer'
  | 'admin'
  | 'trainer'
  | 'stylist'
  | 'staff'
  | 'super_admin';

export type DatabaseAppUserStatus =
  | 'guest_active'
  | 'pending_email_verification'
  | 'active'
  | 'deactivated'
  | 'deleted';

export type DatabaseAuthSessionType =
  | 'guest'
  | 'authenticated'
  | 'admin'
  | 'staff';

export type DatabaseStaffProfileStatus =
  | 'available'
  | 'unavailable'
  | 'on_leave'
  | 'deactivated'
  | 'deleted';

export type DatabasePilatesClassStatus =
  | 'draft'
  | 'active'
  | 'inactive'
  | 'deleted';

export type DatabasePilatesClassScheduleStatus =
  | 'scheduled'
  | 'cancelled'
  | 'completed'
  | 'deleted';

export type DatabasePilatesClassLevel =
  | 'beginner'
  | 'intermediate'
  | 'advanced'
  | 'all_levels';
export type DatabaseBookingStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'no_show'
  | 'expired'
  | 'rescheduled'
  | 'deleted';

export type DatabaseBookingPaymentStatus =
  | 'not_required'
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'expired';

export type DatabaseBookingSource =
  | 'customer_web'
  | 'admin_dashboard'
  | 'system_waitlist_promotion';

export type DatabaseWaitlistStatus =
  | 'waiting'
  | 'promoted'
  | 'expired'
  | 'cancelled'
  | 'converted'
  | 'removed';

export type DatabaseBookingHistoryAction =
  | 'booking_created'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_completed'
  | 'booking_no_show'
  | 'booking_expired'
  | 'booking_rescheduled'
  | 'waitlist_joined'
  | 'waitlist_promoted'
  | 'waitlist_cancelled'
  | 'admin_override';

export type DatabasePilatesScheduleSeriesFrequency = 'weekly' | 'monthly';

export type DatabasePilatesScheduleMonthlyRule = 'day_of_month';

export type DatabasePilatesScheduleSeriesStatus =
  | 'active'
  | 'cancelled'
  | 'deleted';

export type DatabasePilatesScheduleGenerationSource = 'single' | 'recurring';

export type DatabasePrivateBookingHistoryAction =
  | 'private_booking_created'
  | 'private_booking_confirmed'
  | 'private_booking_cancelled'
  | 'private_booking_completed'
  | 'private_booking_no_show'
  | 'private_booking_expired'
  | 'private_booking_rescheduled'
  | 'private_booking_admin_override';
export type DatabasePaymentMethod = 'knet' | 'card' | 'wallet';

export type DatabasePaymentStatus =
  | 'pending'
  | 'requires_redirect'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | 'refund_requested'
  | 'refund_processing'
  | 'manual_refund_required'
  | 'refunded';

export type DatabasePaymentTargetType =
  | 'booking'
  | 'private_booking'
  | 'wallet_top_up';

export type DatabasePaymentProvider =
  | 'mock'
  | 'knet'
  | 'tap'
  | 'myfatoorah'
  | 'checkout'
  | 'wallet'
  | 'manual';

export type DatabasePaymentTransactionType =
  | 'intent_created'
  | 'provider_request'
  | 'provider_response'
  | 'callback_received'
  | 'webhook_received'
  | 'verification'
  | 'status_change'
  | 'wallet_debit'
  | 'wallet_credit'
  | 'refund_requested'
  | 'refund_processed'
  | 'refund_failed';

export type DatabasePaymentTransactionStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'ignored';

export type DatabaseWalletAccountStatus = 'active' | 'frozen' | 'closed';

export type DatabaseWalletLedgerEntryType =
  | 'wallet_top_up'
  | 'booking_payment'
  | 'private_booking_payment'
  | 'refund_credit'
  | 'admin_adjustment_credit'
  | 'admin_adjustment_debit';

export type DatabaseWalletLedgerEntryStatus =
  | 'pending'
  | 'posted'
  | 'reversed'
  | 'failed';

export type DatabasePromoDiscountType = 'fixed_amount' | 'percentage';

export type DatabasePromoCodeStatus =
  | 'active'
  | 'inactive'
  | 'expired'
  | 'deleted';

export interface Database {
  public: {
    Tables: {
      app_users: {
        Row: {
          id: string;
          auth_user_id: string;
          email: string | null;
          phone: string | null;
          full_name: string | null;
          role: DatabaseAppUserRole;
          status: DatabaseAppUserStatus;
          is_guest: boolean;
          avatar_path: string | null;
          timezone: string | null;
          metadata: DatabaseJsonObject;
          guest_expires_at: string | null;
          converted_from_guest_at: string | null;
          created_at: string;
          updated_at: string;
          deactivated_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          auth_user_id: string;
          email?: string | null;
          phone?: string | null;
          full_name?: string | null;
          role: DatabaseAppUserRole;
          status: DatabaseAppUserStatus;
          is_guest?: boolean;
          avatar_path?: string | null;
          timezone?: string | null;
          metadata?: DatabaseJsonObject;
          guest_expires_at?: string | null;
          converted_from_guest_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deactivated_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          auth_user_id?: string;
          email?: string | null;
          phone?: string | null;
          full_name?: string | null;
          role?: DatabaseAppUserRole;
          status?: DatabaseAppUserStatus;
          is_guest?: boolean;
          avatar_path?: string | null;
          timezone?: string | null;
          metadata?: DatabaseJsonObject;
          guest_expires_at?: string | null;
          converted_from_guest_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deactivated_at?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'app_users_auth_user_id_fkey';
            columns: ['auth_user_id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };

      auth_sessions: {
        Row: {
          id: string;
          user_id: string;
          supabase_auth_user_id: string;
          access_token_hash: string;
          refresh_token_hash: string;
          session_type: DatabaseAuthSessionType;
          device_id: string | null;
          device_name: string | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
          last_seen_at: string | null;
          expires_at: string | null;
          revoked_at: string | null;
          revoked_reason: string | null;
          converted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          supabase_auth_user_id: string;
          access_token_hash: string;
          refresh_token_hash: string;
          session_type?: DatabaseAuthSessionType;
          device_id?: string | null;
          device_name?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
          last_seen_at?: string | null;
          expires_at?: string | null;
          revoked_at?: string | null;
          revoked_reason?: string | null;
          converted_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          supabase_auth_user_id?: string;
          access_token_hash?: string;
          refresh_token_hash?: string;
          session_type?: DatabaseAuthSessionType;
          device_id?: string | null;
          device_name?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
          last_seen_at?: string | null;
          expires_at?: string | null;
          revoked_at?: string | null;
          revoked_reason?: string | null;
          converted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'auth_sessions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'auth_sessions_supabase_auth_user_id_fkey';
            columns: ['supabase_auth_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };

      password_reset_challenges: {
        Row: {
          id: string;
          email: string;
          auth_user_id: string | null;
          reset_token_hash: string | null;
          verified_at: string | null;
          expires_at: string;
          used_at: string | null;
          failed_attempts: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          auth_user_id?: string | null;
          reset_token_hash?: string | null;
          verified_at?: string | null;
          expires_at: string;
          used_at?: string | null;
          failed_attempts?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          auth_user_id?: string | null;
          reset_token_hash?: string | null;
          verified_at?: string | null;
          expires_at?: string;
          used_at?: string | null;
          failed_attempts?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'password_reset_challenges_auth_user_id_fkey';
            columns: ['auth_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };

      auth_audit_events: {
        Row: {
          id: string;
          actor_user_id: string | null;
          target_user_id: string | null;
          event_type: string;
          ip_address: string | null;
          user_agent: string | null;
          metadata: DatabaseJsonObject;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_user_id?: string | null;
          target_user_id?: string | null;
          event_type: string;
          ip_address?: string | null;
          user_agent?: string | null;
          metadata?: DatabaseJsonObject;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_user_id?: string | null;
          target_user_id?: string | null;
          event_type?: string;
          ip_address?: string | null;
          user_agent?: string | null;
          metadata?: DatabaseJsonObject;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'auth_audit_events_actor_user_id_fkey';
            columns: ['actor_user_id'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'auth_audit_events_target_user_id_fkey';
            columns: ['target_user_id'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
        ];
      };

      staff_profiles: {
        Row: {
          id: string;
          app_user_id: string;
          display_name: string;
          address: string | null;
          post_title: string;
          bio: string | null;
          specialties: string[];
          status: DatabaseStaffProfileStatus;
          created_by_admin_id: string | null;
          updated_by_admin_id: string | null;
          created_at: string;
          updated_at: string;
          deactivated_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          app_user_id: string;
          display_name: string;
          address?: string | null;
          post_title: string;
          bio?: string | null;
          specialties?: string[];
          status?: DatabaseStaffProfileStatus;
          created_by_admin_id?: string | null;
          updated_by_admin_id?: string | null;
          created_at?: string;
          updated_at?: string;
          deactivated_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          app_user_id?: string;
          display_name?: string;
          address?: string | null;
          post_title?: string;
          bio?: string | null;
          specialties?: string[];
          status?: DatabaseStaffProfileStatus;
          created_by_admin_id?: string | null;
          updated_by_admin_id?: string | null;
          created_at?: string;
          updated_at?: string;
          deactivated_at?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_profiles_app_user_id_fkey';
            columns: ['app_user_id'];
            isOneToOne: true;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'staff_profiles_created_by_admin_id_fkey';
            columns: ['created_by_admin_id'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'staff_profiles_updated_by_admin_id_fkey';
            columns: ['updated_by_admin_id'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
        ];
      };

      staff_availability_rules: {
        Row: {
          id: string;
          staff_profile_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          is_available: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          staff_profile_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          is_available?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          staff_profile_id?: string;
          day_of_week?: number;
          start_time?: string;
          end_time?: string;
          is_available?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_availability_rules_staff_profile_id_fkey';
            columns: ['staff_profile_id'];
            isOneToOne: false;
            referencedRelation: 'staff_profiles';
            referencedColumns: ['id'];
          },
        ];
      };

      pilates_classes: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          default_duration_minutes: number;
          default_capacity: number;
          default_price_amount: number;
          currency: string;
          level: DatabasePilatesClassLevel;
          status: DatabasePilatesClassStatus;
          image_path: string | null;
          created_by_admin_id: string | null;
          updated_by_admin_id: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          realtime_version: number;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          default_duration_minutes?: number;
          default_capacity?: number;
          default_price_amount?: number;
          currency?: string;
          level?: DatabasePilatesClassLevel;
          status?: DatabasePilatesClassStatus;
          image_path?: string | null;
          created_by_admin_id?: string | null;
          updated_by_admin_id?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          realtime_version?: number;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          default_duration_minutes?: number;
          default_capacity?: number;
          default_price_amount?: number;
          currency?: string;
          level?: DatabasePilatesClassLevel;
          status?: DatabasePilatesClassStatus;
          image_path?: string | null;
          created_by_admin_id?: string | null;
          updated_by_admin_id?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          realtime_version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'pilates_classes_created_by_admin_id_fkey';
            columns: ['created_by_admin_id'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pilates_classes_updated_by_admin_id_fkey';
            columns: ['updated_by_admin_id'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
        ];
      };

      pilates_schedule_series: {
        Row: {
          id: string;
          class_id: string;
          trainer_staff_profile_id: string;
          studio: string;
          frequency: DatabasePilatesScheduleSeriesFrequency;
          days_of_week: number[];
          monthly_rule: DatabasePilatesScheduleMonthlyRule | null;
          day_of_month: number | null;
          start_date: string;
          end_date: string;
          start_time: string;
          end_time: string;
          duration_minutes: number;
          capacity: number;
          uses_multiple_time_slots: boolean;
          time_slot_count: number;
          excluded_dates: string[];
          status: DatabasePilatesScheduleSeriesStatus;
          created_by_admin_id: string | null;
          updated_by_admin_id: string | null;
          created_at: string;
          updated_at: string;
          cancelled_at: string | null;
          deleted_at: string | null;
          realtime_version: number;
        };
        Insert: {
          id?: string;
          class_id: string;
          trainer_staff_profile_id: string;
          studio?: string;
          frequency: DatabasePilatesScheduleSeriesFrequency;
          days_of_week?: number[];
          monthly_rule?: DatabasePilatesScheduleMonthlyRule | null;
          day_of_month?: number | null;
          start_date: string;
          end_date: string;
          start_time: string;
          end_time: string;
          duration_minutes: number;
          capacity: number;
          uses_multiple_time_slots?: boolean;
          time_slot_count?: number;
          excluded_dates?: string[];
          status?: DatabasePilatesScheduleSeriesStatus;
          created_by_admin_id?: string | null;
          updated_by_admin_id?: string | null;
          created_at?: string;
          updated_at?: string;
          cancelled_at?: string | null;
          deleted_at?: string | null;
          realtime_version?: number;
        };
        Update: {
          id?: string;
          class_id?: string;
          trainer_staff_profile_id?: string;
          studio?: string;
          frequency?: DatabasePilatesScheduleSeriesFrequency;
          days_of_week?: number[];
          monthly_rule?: DatabasePilatesScheduleMonthlyRule | null;
          day_of_month?: number | null;
          start_date?: string;
          end_date?: string;
          start_time?: string;
          end_time?: string;
          duration_minutes?: number;
          capacity?: number;
          uses_multiple_time_slots?: boolean;
          time_slot_count?: number;
          excluded_dates?: string[];
          status?: DatabasePilatesScheduleSeriesStatus;
          created_by_admin_id?: string | null;
          updated_by_admin_id?: string | null;
          created_at?: string;
          updated_at?: string;
          cancelled_at?: string | null;
          deleted_at?: string | null;
          realtime_version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'pilates_schedule_series_class_id_fkey';
            columns: ['class_id'];
            isOneToOne: false;
            referencedRelation: 'pilates_classes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pilates_schedule_series_trainer_staff_profile_id_fkey';
            columns: ['trainer_staff_profile_id'];
            isOneToOne: false;
            referencedRelation: 'staff_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pilates_schedule_series_created_by_admin_id_fkey';
            columns: ['created_by_admin_id'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pilates_schedule_series_updated_by_admin_id_fkey';
            columns: ['updated_by_admin_id'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
        ];
      };
      pilates_schedule_series_time_slots: {
        Row: {
          id: string;
          series_id: string;
          slot_index: number;
          studio: string;
          start_time: string;
          end_time: string;
          duration_minutes: number;
          capacity: number;
          price_amount: number | null;
          currency: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          series_id: string;
          slot_index: number;
          studio?: string;
          start_time: string;
          end_time: string;
          duration_minutes: number;
          capacity: number;
          price_amount?: number | null;
          currency?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          series_id?: string;
          slot_index?: number;
          studio?: string;
          start_time?: string;
          end_time?: string;
          duration_minutes?: number;
          capacity?: number;
          price_amount?: number | null;
          currency?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pilates_schedule_series_time_slots_series_id_fkey';
            columns: ['series_id'];
            isOneToOne: false;
            referencedRelation: 'pilates_schedule_series';
            referencedColumns: ['id'];
          },
        ];
      };

      pilates_class_schedules: {
        Row: {
          id: string;
          class_id: string;
          trainer_staff_profile_id: string;
          studio: string;
          class_date: string;
          start_time: string;
          end_time: string;
          duration_minutes: number;
          capacity: number;
          price_amount: number | null;
          currency: string | null;
          status: DatabasePilatesClassScheduleStatus;
          cancellation_reason: string | null;
          created_by_admin_id: string | null;
          updated_by_admin_id: string | null;
          created_at: string;
          updated_at: string;
          cancelled_at: string | null;
          completed_at: string | null;
          deleted_at: string | null;
          realtime_version: number;
          series_id: string | null;
          series_occurrence_index: number | null;
          generation_source: DatabasePilatesScheduleGenerationSource;
          series_time_slot_id: string | null;
          series_date_index: number | null;
          series_slot_index: number | null;
        };
        Insert: {
          id?: string;
          class_id: string;
          trainer_staff_profile_id: string;
          studio?: string;
          class_date: string;
          start_time: string;
          end_time: string;
          duration_minutes: number;
          capacity: number;
          price_amount?: number | null;
          currency?: string | null;
          status?: DatabasePilatesClassScheduleStatus;
          cancellation_reason?: string | null;
          created_by_admin_id?: string | null;
          updated_by_admin_id?: string | null;
          created_at?: string;
          updated_at?: string;
          cancelled_at?: string | null;
          completed_at?: string | null;
          deleted_at?: string | null;
          realtime_version?: number;
          series_id?: string | null;
          series_occurrence_index?: number | null;
          generation_source?: DatabasePilatesScheduleGenerationSource;
          series_time_slot_id?: string | null;
          series_date_index?: number | null;
          series_slot_index?: number | null;
        };
        Update: {
          id?: string;
          class_id?: string;
          trainer_staff_profile_id?: string;
          studio?: string;
          class_date?: string;
          start_time?: string;
          end_time?: string;
          duration_minutes?: number;
          capacity?: number;
          price_amount?: number | null;
          currency?: string | null;
          status?: DatabasePilatesClassScheduleStatus;
          cancellation_reason?: string | null;
          created_by_admin_id?: string | null;
          updated_by_admin_id?: string | null;
          created_at?: string;
          updated_at?: string;
          cancelled_at?: string | null;
          completed_at?: string | null;
          deleted_at?: string | null;
          realtime_version?: number;
          series_id?: string | null;
          series_occurrence_index?: number | null;
          generation_source?: DatabasePilatesScheduleGenerationSource;
          series_time_slot_id?: string | null;
          series_date_index?: number | null;
          series_slot_index?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'pilates_class_schedules_class_id_fkey';
            columns: ['class_id'];
            isOneToOne: false;
            referencedRelation: 'pilates_classes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pilates_class_schedules_trainer_staff_profile_id_fkey';
            columns: ['trainer_staff_profile_id'];
            isOneToOne: false;
            referencedRelation: 'staff_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pilates_class_schedules_created_by_admin_id_fkey';
            columns: ['created_by_admin_id'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pilates_class_schedules_updated_by_admin_id_fkey';
            columns: ['updated_by_admin_id'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pilates_class_schedules_series_id_fkey';
            columns: ['series_id'];
            isOneToOne: false;
            referencedRelation: 'pilates_schedule_series';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pilates_class_schedules_series_time_slot_id_fkey';
            columns: ['series_time_slot_id'];
            isOneToOne: false;
            referencedRelation: 'pilates_schedule_series_time_slots';
            referencedColumns: ['id'];
          },
        ];
      };

      bookings: {
        Row: {
          id: string;
          booking_number: string;
          user_id: string;
          schedule_id: string;
          class_id: string;
          trainer_staff_profile_id: string | null;
          status: DatabaseBookingStatus;
          source: DatabaseBookingSource;
          payment_status: DatabaseBookingPaymentStatus;
          payment_required: boolean;
          idempotency_key: string | null;
          seat_hold_expires_at: string | null;
          confirmed_at: string | null;
          cancelled_at: string | null;
          completed_at: string | null;
          no_show_at: string | null;
          rescheduled_from_booking_id: string | null;
          created_by_user_id: string | null;
          created_by_admin_id: string | null;
          cancelled_by_user_id: string | null;
          cancelled_by_admin_id: string | null;
          cancellation_reason: string | null;
          admin_notes: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          realtime_version: number;
        };
        Insert: {
          id?: string;
          booking_number: string;
          user_id: string;
          schedule_id: string;
          class_id: string;
          trainer_staff_profile_id?: string | null;
          status?: DatabaseBookingStatus;
          source?: DatabaseBookingSource;
          payment_status?: DatabaseBookingPaymentStatus;
          payment_required?: boolean;
          idempotency_key?: string | null;
          seat_hold_expires_at?: string | null;
          confirmed_at?: string | null;
          cancelled_at?: string | null;
          completed_at?: string | null;
          no_show_at?: string | null;
          rescheduled_from_booking_id?: string | null;
          created_by_user_id?: string | null;
          created_by_admin_id?: string | null;
          cancelled_by_user_id?: string | null;
          cancelled_by_admin_id?: string | null;
          cancellation_reason?: string | null;
          admin_notes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          realtime_version?: number;
        };
        Update: {
          id?: string;
          booking_number?: string;
          user_id?: string;
          schedule_id?: string;
          class_id?: string;
          trainer_staff_profile_id?: string | null;
          status?: DatabaseBookingStatus;
          source?: DatabaseBookingSource;
          payment_status?: DatabaseBookingPaymentStatus;
          payment_required?: boolean;
          idempotency_key?: string | null;
          seat_hold_expires_at?: string | null;
          confirmed_at?: string | null;
          cancelled_at?: string | null;
          completed_at?: string | null;
          no_show_at?: string | null;
          rescheduled_from_booking_id?: string | null;
          created_by_user_id?: string | null;
          created_by_admin_id?: string | null;
          cancelled_by_user_id?: string | null;
          cancelled_by_admin_id?: string | null;
          cancellation_reason?: string | null;
          admin_notes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          realtime_version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'bookings_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_schedule_id_fkey';
            columns: ['schedule_id'];
            isOneToOne: false;
            referencedRelation: 'pilates_class_schedules';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_class_id_fkey';
            columns: ['class_id'];
            isOneToOne: false;
            referencedRelation: 'pilates_classes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_trainer_staff_profile_id_fkey';
            columns: ['trainer_staff_profile_id'];
            isOneToOne: false;
            referencedRelation: 'staff_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_rescheduled_from_booking_id_fkey';
            columns: ['rescheduled_from_booking_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_created_by_user_id_fkey';
            columns: ['created_by_user_id'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_created_by_admin_id_fkey';
            columns: ['created_by_admin_id'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_cancelled_by_user_id_fkey';
            columns: ['cancelled_by_user_id'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_cancelled_by_admin_id_fkey';
            columns: ['cancelled_by_admin_id'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
        ];
      };

      private_trainer_bookings: {
        Row: {
          id: string;
          booking_number: string;
          user_id: string;
          trainer_staff_profile_id: string;
          session_date: string;
          start_time: string;
          end_time: string;
          duration_minutes: number;
          studio: string;
          price_amount: number;
          currency: string;
          status: DatabaseBookingStatus;
          source: DatabaseBookingSource;
          payment_status: DatabaseBookingPaymentStatus;
          payment_required: boolean;
          idempotency_key: string | null;
          seat_hold_expires_at: string | null;
          confirmed_at: string | null;
          cancelled_at: string | null;
          completed_at: string | null;
          no_show_at: string | null;
          rescheduled_at: string | null;
          rescheduled_from_private_booking_id: string | null;
          rescheduled_to_private_booking_id: string | null;
          created_by_user_id: string | null;
          created_by_admin_id: string | null;
          cancelled_by_user_id: string | null;
          cancelled_by_admin_id: string | null;
          cancellation_reason: string | null;
          admin_notes: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          realtime_version: number;
        };
        Insert: {
          id?: string;
          booking_number: string;
          user_id: string;
          trainer_staff_profile_id: string;
          session_date: string;
          start_time: string;
          end_time: string;
          duration_minutes: number;
          studio?: string;
          price_amount?: number;
          currency?: string;
          status?: DatabaseBookingStatus;
          source?: DatabaseBookingSource;
          payment_status?: DatabaseBookingPaymentStatus;
          payment_required?: boolean;
          idempotency_key?: string | null;
          seat_hold_expires_at?: string | null;
          confirmed_at?: string | null;
          cancelled_at?: string | null;
          completed_at?: string | null;
          no_show_at?: string | null;
          rescheduled_at?: string | null;
          rescheduled_from_private_booking_id?: string | null;
          rescheduled_to_private_booking_id?: string | null;
          created_by_user_id?: string | null;
          created_by_admin_id?: string | null;
          cancelled_by_user_id?: string | null;
          cancelled_by_admin_id?: string | null;
          cancellation_reason?: string | null;
          admin_notes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          realtime_version?: number;
        };
        Update: {
          id?: string;
          booking_number?: string;
          user_id?: string;
          trainer_staff_profile_id?: string;
          session_date?: string;
          start_time?: string;
          end_time?: string;
          duration_minutes?: number;
          studio?: string;
          price_amount?: number;
          currency?: string;
          status?: DatabaseBookingStatus;
          source?: DatabaseBookingSource;
          payment_status?: DatabaseBookingPaymentStatus;
          payment_required?: boolean;
          idempotency_key?: string | null;
          seat_hold_expires_at?: string | null;
          confirmed_at?: string | null;
          cancelled_at?: string | null;
          completed_at?: string | null;
          no_show_at?: string | null;
          rescheduled_at?: string | null;
          rescheduled_from_private_booking_id?: string | null;
          rescheduled_to_private_booking_id?: string | null;
          created_by_user_id?: string | null;
          created_by_admin_id?: string | null;
          cancelled_by_user_id?: string | null;
          cancelled_by_admin_id?: string | null;
          cancellation_reason?: string | null;
          admin_notes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          realtime_version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'private_trainer_bookings_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'private_trainer_bookings_trainer_staff_profile_id_fkey';
            columns: ['trainer_staff_profile_id'];
            isOneToOne: false;
            referencedRelation: 'staff_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'private_trainer_bookings_rescheduled_from_private_booking_id_fkey';
            columns: ['rescheduled_from_private_booking_id'];
            isOneToOne: false;
            referencedRelation: 'private_trainer_bookings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'private_trainer_bookings_rescheduled_to_private_booking_id_fkey';
            columns: ['rescheduled_to_private_booking_id'];
            isOneToOne: false;
            referencedRelation: 'private_trainer_bookings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'private_trainer_bookings_created_by_user_id_fkey';
            columns: ['created_by_user_id'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'private_trainer_bookings_created_by_admin_id_fkey';
            columns: ['created_by_admin_id'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'private_trainer_bookings_cancelled_by_user_id_fkey';
            columns: ['cancelled_by_user_id'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'private_trainer_bookings_cancelled_by_admin_id_fkey';
            columns: ['cancelled_by_admin_id'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
        ];
      };

      private_trainer_booking_history: {
        Row: {
          id: string;
          private_booking_id: string;
          actor_user_id: string | null;
          actor_admin_id: string | null;
          actor_role: string | null;
          action: DatabasePrivateBookingHistoryAction;
          from_status: DatabaseBookingStatus | null;
          to_status: DatabaseBookingStatus | null;
          notes: string | null;
          metadata: DatabaseJsonObject;
          created_at: string;
        };
        Insert: {
          id?: string;
          private_booking_id: string;
          actor_user_id?: string | null;
          actor_admin_id?: string | null;
          actor_role?: string | null;
          action: DatabasePrivateBookingHistoryAction;
          from_status?: DatabaseBookingStatus | null;
          to_status?: DatabaseBookingStatus | null;
          notes?: string | null;
          metadata?: DatabaseJsonObject;
          created_at?: string;
        };
        Update: {
          id?: string;
          private_booking_id?: string;
          actor_user_id?: string | null;
          actor_admin_id?: string | null;
          actor_role?: string | null;
          action?: DatabasePrivateBookingHistoryAction;
          from_status?: DatabaseBookingStatus | null;
          to_status?: DatabaseBookingStatus | null;
          notes?: string | null;
          metadata?: DatabaseJsonObject;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'private_trainer_booking_history_private_booking_id_fkey';
            columns: ['private_booking_id'];
            isOneToOne: false;
            referencedRelation: 'private_trainer_bookings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'private_trainer_booking_history_actor_user_id_fkey';
            columns: ['actor_user_id'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'private_trainer_booking_history_actor_admin_id_fkey';
            columns: ['actor_admin_id'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
        ];
      };

      booking_history: {
        Row: {
          id: string;
          booking_id: string;
          actor_user_id: string | null;
          actor_admin_id: string | null;
          actor_role: string | null;
          action: DatabaseBookingHistoryAction;
          from_status: DatabaseBookingStatus | null;
          to_status: DatabaseBookingStatus | null;
          notes: string | null;
          metadata: DatabaseJsonObject;
          created_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          actor_user_id?: string | null;
          actor_admin_id?: string | null;
          actor_role?: string | null;
          action: DatabaseBookingHistoryAction;
          from_status?: DatabaseBookingStatus | null;
          to_status?: DatabaseBookingStatus | null;
          notes?: string | null;
          metadata?: DatabaseJsonObject;
          created_at?: string;
        };
        Update: {
          id?: string;
          booking_id?: string;
          actor_user_id?: string | null;
          actor_admin_id?: string | null;
          actor_role?: string | null;
          action?: DatabaseBookingHistoryAction;
          from_status?: DatabaseBookingStatus | null;
          to_status?: DatabaseBookingStatus | null;
          notes?: string | null;
          metadata?: DatabaseJsonObject;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'booking_history_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'booking_history_actor_user_id_fkey';
            columns: ['actor_user_id'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'booking_history_actor_admin_id_fkey';
            columns: ['actor_admin_id'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
        ];
      };

      booking_waitlist: {
        Row: {
          id: string;
          schedule_id: string;
          class_id: string;
          user_id: string;
          position: number;
          status: DatabaseWaitlistStatus;
          joined_at: string;
          promoted_at: string | null;
          expired_at: string | null;
          cancelled_at: string | null;
          promotion_expires_at: string | null;
          converted_booking_id: string | null;
          cancellation_reason: string | null;
          created_at: string;
          updated_at: string;
          realtime_version: number;
        };
        Insert: {
          id?: string;
          schedule_id: string;
          class_id: string;
          user_id: string;
          position: number;
          status?: DatabaseWaitlistStatus;
          joined_at?: string;
          promoted_at?: string | null;
          expired_at?: string | null;
          cancelled_at?: string | null;
          promotion_expires_at?: string | null;
          converted_booking_id?: string | null;
          cancellation_reason?: string | null;
          created_at?: string;
          updated_at?: string;
          realtime_version?: number;
        };
        Update: {
          id?: string;
          schedule_id?: string;
          class_id?: string;
          user_id?: string;
          position?: number;
          status?: DatabaseWaitlistStatus;
          joined_at?: string;
          promoted_at?: string | null;
          expired_at?: string | null;
          cancelled_at?: string | null;
          promotion_expires_at?: string | null;
          converted_booking_id?: string | null;
          cancellation_reason?: string | null;
          created_at?: string;
          updated_at?: string;
          realtime_version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'booking_waitlist_schedule_id_fkey';
            columns: ['schedule_id'];
            isOneToOne: false;
            referencedRelation: 'pilates_class_schedules';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'booking_waitlist_class_id_fkey';
            columns: ['class_id'];
            isOneToOne: false;
            referencedRelation: 'pilates_classes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'booking_waitlist_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'booking_waitlist_converted_booking_id_fkey';
            columns: ['converted_booking_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
        ];
      };

      booking_domain_events: {
        Row: {
          id: string;
          event_type: string;
          schedule_id: string | null;
          booking_id: string | null;
          waitlist_id: string | null;
          private_booking_id: string | null;
          payment_id: string | null;
          payload: DatabaseJsonObject;
          created_at: string;
          published_at: string | null;
        };
        Insert: {
          id?: string;
          event_type: string;
          schedule_id?: string | null;
          booking_id?: string | null;
          waitlist_id?: string | null;
          private_booking_id?: string | null;
          payment_id?: string | null;
          payload?: DatabaseJsonObject;
          created_at?: string;
          published_at?: string | null;
        };
        Update: {
          id?: string;
          event_type?: string;
          schedule_id?: string | null;
          booking_id?: string | null;
          waitlist_id?: string | null;
          private_booking_id?: string | null;
          payment_id?: string | null;
          payload?: DatabaseJsonObject;
          created_at?: string;
          published_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'booking_domain_events_schedule_id_fkey';
            columns: ['schedule_id'];
            isOneToOne: false;
            referencedRelation: 'pilates_class_schedules';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'booking_domain_events_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'booking_domain_events_waitlist_id_fkey';
            columns: ['waitlist_id'];
            isOneToOne: false;
            referencedRelation: 'booking_waitlist';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'booking_domain_events_private_booking_id_fkey';
            columns: ['private_booking_id'];
            isOneToOne: false;
            referencedRelation: 'private_trainer_bookings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'booking_domain_events_payment_id_fkey';
            columns: ['payment_id'];
            isOneToOne: false;
            referencedRelation: 'payments';
            referencedColumns: ['id'];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          payment_number: string;
          receipt_number: string | null;
          user_id: string;
          target_type: DatabasePaymentTargetType;
          booking_id: string | null;
          private_booking_id: string | null;
          amount: number;
          discount_amount: number;
          final_amount: number;
          currency: string;
          payment_method: DatabasePaymentMethod;
          payment_provider: DatabasePaymentProvider;
          status: DatabasePaymentStatus;
          gateway_reference: string | null;
          gateway_payment_id: string | null;
          gateway_invoice_id: string | null;
          redirect_url: string | null;
          callback_url: string | null;
          webhook_verified_at: string | null;
          paid_at: string | null;
          failed_at: string | null;
          cancelled_at: string | null;
          expired_at: string | null;
          refunded_at: string | null;
          refunded_amount: number;
          expires_at: string | null;
          idempotency_key: string | null;
          failure_code: string | null;
          failure_message: string | null;
          metadata: DatabaseJsonObject;
          created_at: string;
          updated_at: string;
          realtime_version: number;
        };
        Insert: {
          id?: string;
          payment_number?: string;
          receipt_number?: string | null;
          user_id: string;
          target_type: DatabasePaymentTargetType;
          booking_id?: string | null;
          private_booking_id?: string | null;
          amount: number;
          discount_amount?: number;
          final_amount: number;
          currency?: string;
          payment_method: DatabasePaymentMethod;
          payment_provider?: DatabasePaymentProvider;
          status?: DatabasePaymentStatus;
          gateway_reference?: string | null;
          gateway_payment_id?: string | null;
          gateway_invoice_id?: string | null;
          redirect_url?: string | null;
          callback_url?: string | null;
          webhook_verified_at?: string | null;
          paid_at?: string | null;
          failed_at?: string | null;
          cancelled_at?: string | null;
          expired_at?: string | null;
          refunded_at?: string | null;
          refunded_amount?: number;
          expires_at?: string | null;
          idempotency_key?: string | null;
          failure_code?: string | null;
          failure_message?: string | null;
          metadata?: DatabaseJsonObject;
          created_at?: string;
          updated_at?: string;
          realtime_version?: number;
        };
        Update: {
          id?: string;
          payment_number?: string;
          receipt_number?: string | null;
          user_id?: string;
          target_type?: DatabasePaymentTargetType;
          booking_id?: string | null;
          private_booking_id?: string | null;
          amount?: number;
          discount_amount?: number;
          final_amount?: number;
          currency?: string;
          payment_method?: DatabasePaymentMethod;
          payment_provider?: DatabasePaymentProvider;
          status?: DatabasePaymentStatus;
          gateway_reference?: string | null;
          gateway_payment_id?: string | null;
          gateway_invoice_id?: string | null;
          redirect_url?: string | null;
          callback_url?: string | null;
          webhook_verified_at?: string | null;
          paid_at?: string | null;
          failed_at?: string | null;
          cancelled_at?: string | null;
          expired_at?: string | null;
          refunded_at?: string | null;
          refunded_amount?: number;
          expires_at?: string | null;
          idempotency_key?: string | null;
          failure_code?: string | null;
          failure_message?: string | null;
          metadata?: DatabaseJsonObject;
          created_at?: string;
          updated_at?: string;
          realtime_version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'payments_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payments_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payments_private_booking_id_fkey';
            columns: ['private_booking_id'];
            isOneToOne: false;
            referencedRelation: 'private_trainer_bookings';
            referencedColumns: ['id'];
          },
        ];
      };

      payment_transactions: {
        Row: {
          id: string;
          payment_id: string;
          transaction_type: DatabasePaymentTransactionType;
          transaction_status: DatabasePaymentTransactionStatus;
          provider: DatabasePaymentProvider;
          provider_reference: string | null;
          gateway_request: DatabaseJsonObject;
          gateway_response: DatabaseJsonObject;
          failure_code: string | null;
          failure_message: string | null;
          metadata: DatabaseJsonObject;
          processed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          payment_id: string;
          transaction_type: DatabasePaymentTransactionType;
          transaction_status?: DatabasePaymentTransactionStatus;
          provider?: DatabasePaymentProvider;
          provider_reference?: string | null;
          gateway_request?: DatabaseJsonObject;
          gateway_response?: DatabaseJsonObject;
          failure_code?: string | null;
          failure_message?: string | null;
          metadata?: DatabaseJsonObject;
          processed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          payment_id?: string;
          transaction_type?: DatabasePaymentTransactionType;
          transaction_status?: DatabasePaymentTransactionStatus;
          provider?: DatabasePaymentProvider;
          provider_reference?: string | null;
          gateway_request?: DatabaseJsonObject;
          gateway_response?: DatabaseJsonObject;
          failure_code?: string | null;
          failure_message?: string | null;
          metadata?: DatabaseJsonObject;
          processed_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payment_transactions_payment_id_fkey';
            columns: ['payment_id'];
            isOneToOne: false;
            referencedRelation: 'payments';
            referencedColumns: ['id'];
          },
        ];
      };

      wallet_accounts: {
        Row: {
          id: string;
          user_id: string;
          currency: string;
          available_balance: number;
          pending_balance: number;
          status: DatabaseWalletAccountStatus;
          created_at: string;
          updated_at: string;
          realtime_version: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          currency?: string;
          available_balance?: number;
          pending_balance?: number;
          status?: DatabaseWalletAccountStatus;
          created_at?: string;
          updated_at?: string;
          realtime_version?: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          currency?: string;
          available_balance?: number;
          pending_balance?: number;
          status?: DatabaseWalletAccountStatus;
          created_at?: string;
          updated_at?: string;
          realtime_version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'wallet_accounts_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
        ];
      };

      wallet_ledger_entries: {
        Row: {
          id: string;
          wallet_account_id: string;
          user_id: string;
          payment_id: string | null;
          booking_id: string | null;
          private_booking_id: string | null;
          entry_type: DatabaseWalletLedgerEntryType;
          entry_status: DatabaseWalletLedgerEntryStatus;
          amount: number;
          balance_before: number;
          balance_after: number;
          description: string | null;
          metadata: DatabaseJsonObject;
          created_at: string;
        };
        Insert: {
          id?: string;
          wallet_account_id: string;
          user_id: string;
          payment_id?: string | null;
          booking_id?: string | null;
          private_booking_id?: string | null;
          entry_type: DatabaseWalletLedgerEntryType;
          entry_status?: DatabaseWalletLedgerEntryStatus;
          amount: number;
          balance_before: number;
          balance_after: number;
          description?: string | null;
          metadata?: DatabaseJsonObject;
          created_at?: string;
        };
        Update: {
          id?: string;
          wallet_account_id?: string;
          user_id?: string;
          payment_id?: string | null;
          booking_id?: string | null;
          private_booking_id?: string | null;
          entry_type?: DatabaseWalletLedgerEntryType;
          entry_status?: DatabaseWalletLedgerEntryStatus;
          amount?: number;
          balance_before?: number;
          balance_after?: number;
          description?: string | null;
          metadata?: DatabaseJsonObject;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'wallet_ledger_entries_wallet_account_id_fkey';
            columns: ['wallet_account_id'];
            isOneToOne: false;
            referencedRelation: 'wallet_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'wallet_ledger_entries_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'wallet_ledger_entries_payment_id_fkey';
            columns: ['payment_id'];
            isOneToOne: false;
            referencedRelation: 'payments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'wallet_ledger_entries_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'wallet_ledger_entries_private_booking_id_fkey';
            columns: ['private_booking_id'];
            isOneToOne: false;
            referencedRelation: 'private_trainer_bookings';
            referencedColumns: ['id'];
          },
        ];
      };

      promo_codes: {
        Row: {
          id: string;
          code: string;
          description: string | null;
          discount_type: DatabasePromoDiscountType;
          discount_value: number;
          max_discount_amount: number | null;
          starts_at: string | null;
          ends_at: string | null;
          max_redemptions: number | null;
          per_user_limit: number | null;
          redemption_count: number;
          status: DatabasePromoCodeStatus;
          created_by_admin_id: string | null;
          updated_by_admin_id: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          code: string;
          description?: string | null;
          discount_type: DatabasePromoDiscountType;
          discount_value: number;
          max_discount_amount?: number | null;
          starts_at?: string | null;
          ends_at?: string | null;
          max_redemptions?: number | null;
          per_user_limit?: number | null;
          redemption_count?: number;
          status?: DatabasePromoCodeStatus;
          created_by_admin_id?: string | null;
          updated_by_admin_id?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          code?: string;
          description?: string | null;
          discount_type?: DatabasePromoDiscountType;
          discount_value?: number;
          max_discount_amount?: number | null;
          starts_at?: string | null;
          ends_at?: string | null;
          max_redemptions?: number | null;
          per_user_limit?: number | null;
          redemption_count?: number;
          status?: DatabasePromoCodeStatus;
          created_by_admin_id?: string | null;
          updated_by_admin_id?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'promo_codes_created_by_admin_id_fkey';
            columns: ['created_by_admin_id'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'promo_codes_updated_by_admin_id_fkey';
            columns: ['updated_by_admin_id'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
        ];
      };

      payment_discounts: {
        Row: {
          id: string;
          payment_id: string;
          promo_code_id: string | null;
          code: string;
          discount_amount: number;
          metadata: DatabaseJsonObject;
          created_at: string;
        };
        Insert: {
          id?: string;
          payment_id: string;
          promo_code_id?: string | null;
          code: string;
          discount_amount: number;
          metadata?: DatabaseJsonObject;
          created_at?: string;
        };
        Update: {
          id?: string;
          payment_id?: string;
          promo_code_id?: string | null;
          code?: string;
          discount_amount?: number;
          metadata?: DatabaseJsonObject;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payment_discounts_payment_id_fkey';
            columns: ['payment_id'];
            isOneToOne: false;
            referencedRelation: 'payments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payment_discounts_promo_code_id_fkey';
            columns: ['promo_code_id'];
            isOneToOne: false;
            referencedRelation: 'promo_codes';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_pilates_schedule_availability: {
        Args: {
          p_schedule_id: string;
        };
        Returns: {
          schedule_id: string;
          capacity: number;
          booked_count: number;
          pending_hold_count: number;
          available_seats: number;
          waitlist_count: number;
          waitlist_available: boolean;
          schedule_realtime_version: number;
        }[];
      };

      create_pilates_booking_atomic: {
        Args: {
          p_user_id: string;
          p_schedule_id: string;
          p_payment_required?: boolean;
          p_idempotency_key?: string | null;
          p_created_by_admin_id?: string | null;
          p_source?: DatabaseBookingSource;
        };
        Returns: {
          action_result: string;
          booking_id: string | null;
          waitlist_id: string | null;
          booking_number: string | null;
          waitlist_position: number | null;
          capacity: number;
          booked_count: number;
          pending_hold_count: number;
          available_seats: number;
          waitlist_count: number;
          schedule_realtime_version: number;
        }[];
      };

      cancel_pilates_booking_atomic: {
        Args: {
          p_booking_id: string;
          p_actor_user_id?: string | null;
          p_actor_admin_id?: string | null;
          p_reason?: string | null;
        };
        Returns: {
          action_result: string;
          cancelled_booking_id: string;
          promoted_booking_id: string | null;
          promoted_waitlist_id: string | null;
          capacity: number;
          booked_count: number;
          pending_hold_count: number;
          available_seats: number;
          waitlist_count: number;
          schedule_realtime_version: number;
        }[];
      };

      reschedule_pilates_booking_atomic: {
        Args: {
          p_booking_id: string;
          p_target_schedule_id: string;
          p_actor_user_id?: string | null;
          p_actor_admin_id?: string | null;
          p_join_waitlist_if_full?: boolean;
          p_reason?: string | null;
        };
        Returns: {
          action_result: string;
          old_booking_id: string;
          new_booking_id: string | null;
          waitlist_id: string | null;
          waitlist_position: number | null;
          capacity: number;
          booked_count: number;
          pending_hold_count: number;
          available_seats: number;
          waitlist_count: number;
          schedule_realtime_version: number;
        }[];
      };

      expire_booking_holds_atomic: {
        Args: Record<string, never>;
        Returns: {
          expired_booking_id: string;
          schedule_id: string;
        }[];
      };
      lafam_is_valid_weekday_array: {
        Args: {
          p_days: number[];
        };
        Returns: boolean;
      };

      is_staff_available_for_time: {
        Args: {
          p_staff_profile_id: string;
          p_session_date: string;
          p_start_time: string;
          p_end_time: string;
        };
        Returns: boolean;
      };

      has_trainer_class_schedule_conflict: {
        Args: {
          p_trainer_staff_profile_id: string;
          p_session_date: string;
          p_start_time: string;
          p_end_time: string;
          p_ignore_schedule_id?: string | null;
        };
        Returns: boolean;
      };

      has_trainer_private_booking_conflict: {
        Args: {
          p_trainer_staff_profile_id: string;
          p_session_date: string;
          p_start_time: string;
          p_end_time: string;
          p_ignore_private_booking_id?: string | null;
        };
        Returns: boolean;
      };

      expire_private_trainer_booking_holds_atomic: {
        Args: Record<string, never>;
        Returns: {
          expired_count: number;
        }[];
      };

      create_private_trainer_booking_atomic: {
        Args: {
          p_user_id: string;
          p_trainer_staff_profile_id: string;
          p_session_date: string;
          p_start_time: string;
          p_duration_minutes: number;
          p_studio?: string;
          p_payment_required?: boolean;
          p_idempotency_key?: string | null;
          p_created_by_admin_id?: string | null;
          p_source?: DatabaseBookingSource;
          p_rescheduled_from_private_booking_id?: string | null;
        };
        Returns: {
          action_result: string;
          private_booking_id: string;
          booking_number: string;
          trainer_staff_profile_id: string;
          session_date: string;
          start_time: string;
          end_time: string;
          status: DatabaseBookingStatus;
          payment_status: DatabaseBookingPaymentStatus;
          realtime_version: number;
        }[];
      };

      cancel_private_trainer_booking_atomic: {
        Args: {
          p_private_booking_id: string;
          p_actor_user_id?: string | null;
          p_actor_admin_id?: string | null;
          p_reason?: string | null;
        };
        Returns: {
          action_result: string;
          private_booking_id: string;
          status: DatabaseBookingStatus;
          payment_status: DatabaseBookingPaymentStatus;
          realtime_version: number;
        }[];
      };

      reschedule_private_trainer_booking_atomic: {
        Args: {
          p_private_booking_id: string;
          p_target_session_date: string;
          p_target_start_time: string;
          p_target_duration_minutes: number;
          p_studio?: string | null;
          p_actor_user_id?: string | null;
          p_actor_admin_id?: string | null;
          p_reason?: string | null;
          p_idempotency_key?: string | null;
          p_payment_required?: boolean;
        };
        Returns: {
          action_result: string;
          old_private_booking_id: string;
          new_private_booking_id: string;
          new_booking_number: string;
          trainer_staff_profile_id: string;
          session_date: string;
          start_time: string;
          end_time: string;
          old_status: DatabaseBookingStatus;
          new_status: DatabaseBookingStatus;
          new_payment_status: DatabaseBookingPaymentStatus;
        }[];
      };
      create_payment_intent_atomic: {
        Args: {
          p_user_id: string;
          p_target_type: DatabasePaymentTargetType;
          p_booking_id: string | null;
          p_private_booking_id: string | null;
          p_amount: number;
          p_discount_amount: number;
          p_final_amount: number;
          p_currency: string;
          p_payment_method: DatabasePaymentMethod;
          p_payment_provider: DatabasePaymentProvider;
          p_status?: DatabasePaymentStatus | null;
          p_idempotency_key?: string | null;
          p_redirect_url?: string | null;
          p_callback_url?: string | null;
          p_gateway_reference?: string | null;
          p_gateway_payment_id?: string | null;
          p_gateway_invoice_id?: string | null;
          p_expires_at?: string | null;
          p_metadata?: DatabaseJsonObject;
        };
        Returns: {
          payment_id: string;
          payment_number: string;
          target_type: DatabasePaymentTargetType;
          booking_id: string | null;
          private_booking_id: string | null;
          status: DatabasePaymentStatus;
          payment_method: DatabasePaymentMethod;
          payment_provider: DatabasePaymentProvider;
          final_amount: number;
          currency: string;
          redirect_url: string | null;
          expires_at: string | null;
        }[];
      };

      mark_payment_paid_atomic: {
        Args: {
          p_payment_id: string;
          p_provider_reference?: string | null;
          p_gateway_payment_id?: string | null;
          p_gateway_invoice_id?: string | null;
          p_gateway_response?: DatabaseJsonObject;
          p_webhook_verified?: boolean;
          p_next_status?: DatabasePaymentStatus;
        };
        Returns: {
          payment_id: string;
          payment_number: string;
          target_type: DatabasePaymentTargetType;
          booking_id: string | null;
          private_booking_id: string | null;
          status: DatabasePaymentStatus;
          receipt_number: string | null;
          paid_at: string | null;
        }[];
      };

      mark_payment_failed_atomic: {
        Args: {
          p_payment_id: string;
          p_failure_code?: string | null;
          p_failure_message?: string | null;
          p_gateway_response?: DatabaseJsonObject;
          p_next_status?: DatabasePaymentStatus;
        };
        Returns: {
          payment_id: string;
          target_type: DatabasePaymentTargetType;
          booking_id: string | null;
          private_booking_id: string | null;
          status: DatabasePaymentStatus;
        }[];
      };

      mark_payment_cancelled_atomic: {
        Args: {
          p_payment_id: string;
          p_reason?: string | null;
          p_gateway_response?: DatabaseJsonObject;
          p_next_status?: DatabasePaymentStatus;
        };
        Returns: {
          payment_id: string;
          target_type: DatabasePaymentTargetType;
          booking_id: string | null;
          private_booking_id: string | null;
          status: DatabasePaymentStatus;
        }[];
      };

      expire_payment_intents_atomic: {
        Args: Record<string, never>;
        Returns: {
          payment_id: string;
          target_type: DatabasePaymentTargetType;
          booking_id: string | null;
          private_booking_id: string | null;
          status: DatabasePaymentStatus;
        }[];
      };

      debit_wallet_for_booking_atomic: {
        Args: {
          p_payment_id: string;
          p_description?: string | null;
          p_metadata?: DatabaseJsonObject;
        };
        Returns: {
          payment_id: string;
          wallet_account_id: string;
          ledger_entry_id: string;
          available_balance: number;
          booking_id: string | null;
          private_booking_id: string | null;
        }[];
      };

      credit_wallet_atomic: {
        Args: {
          p_user_id: string;
          p_amount: number;
          p_currency?: string;
          p_payment_id?: string | null;
          p_description?: string | null;
          p_metadata?: DatabaseJsonObject;
        };
        Returns: {
          wallet_account_id: string;
          ledger_entry_id: string;
          available_balance: number;
        }[];
      };

      refund_payment_atomic: {
        Args: {
          p_payment_id: string;
          p_actor_admin_id?: string | null;
          p_reason?: string | null;
          p_refund_amount?: number | null;
          p_gateway_response?: DatabaseJsonObject;
        };
        Returns: {
          payment_id: string;
          status: DatabasePaymentStatus;
          refunded_amount: number;
          refunded_at: string | null;
        }[];
      };
    };
    Enums: {
      staff_profile_status: DatabaseStaffProfileStatus;
      pilates_class_status: DatabasePilatesClassStatus;
      pilates_class_schedule_status: DatabasePilatesClassScheduleStatus;
      pilates_class_level: DatabasePilatesClassLevel;
      pilates_schedule_series_frequency: DatabasePilatesScheduleSeriesFrequency;
      pilates_schedule_monthly_rule: DatabasePilatesScheduleMonthlyRule;
      pilates_schedule_series_status: DatabasePilatesScheduleSeriesStatus;
      pilates_schedule_generation_source: DatabasePilatesScheduleGenerationSource;
      booking_status: DatabaseBookingStatus;
      booking_payment_status: DatabaseBookingPaymentStatus;
      booking_source: DatabaseBookingSource;
      waitlist_status: DatabaseWaitlistStatus;
      booking_history_action: DatabaseBookingHistoryAction;
      private_booking_history_action: DatabasePrivateBookingHistoryAction;
      payment_method: DatabasePaymentMethod;
      payment_status: DatabasePaymentStatus;
      payment_target_type: DatabasePaymentTargetType;
      payment_provider: DatabasePaymentProvider;
      payment_transaction_type: DatabasePaymentTransactionType;
      payment_transaction_status: DatabasePaymentTransactionStatus;
      wallet_account_status: DatabaseWalletAccountStatus;
      wallet_ledger_entry_type: DatabaseWalletLedgerEntryType;
      wallet_ledger_entry_status: DatabaseWalletLedgerEntryStatus;
      promo_discount_type: DatabasePromoDiscountType;
      promo_code_status: DatabasePromoCodeStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type AppUserRow = Database['public']['Tables']['app_users']['Row'];
export type AppUserInsert = Database['public']['Tables']['app_users']['Insert'];
export type AppUserUpdate = Database['public']['Tables']['app_users']['Update'];

export type AuthSessionRow =
  Database['public']['Tables']['auth_sessions']['Row'];
export type AuthSessionInsert =
  Database['public']['Tables']['auth_sessions']['Insert'];
export type AuthSessionUpdate =
  Database['public']['Tables']['auth_sessions']['Update'];

export type PasswordResetChallengeRow =
  Database['public']['Tables']['password_reset_challenges']['Row'];
export type PasswordResetChallengeInsert =
  Database['public']['Tables']['password_reset_challenges']['Insert'];
export type PasswordResetChallengeUpdate =
  Database['public']['Tables']['password_reset_challenges']['Update'];

export type AuthAuditEventRow =
  Database['public']['Tables']['auth_audit_events']['Row'];
export type AuthAuditEventInsert =
  Database['public']['Tables']['auth_audit_events']['Insert'];
export type AuthAuditEventUpdate =
  Database['public']['Tables']['auth_audit_events']['Update'];

export type StaffProfileRow =
  Database['public']['Tables']['staff_profiles']['Row'];
export type StaffProfileInsert =
  Database['public']['Tables']['staff_profiles']['Insert'];
export type StaffProfileUpdate =
  Database['public']['Tables']['staff_profiles']['Update'];

export type StaffAvailabilityRuleRow =
  Database['public']['Tables']['staff_availability_rules']['Row'];
export type StaffAvailabilityRuleInsert =
  Database['public']['Tables']['staff_availability_rules']['Insert'];
export type StaffAvailabilityRuleUpdate =
  Database['public']['Tables']['staff_availability_rules']['Update'];

export type PilatesClassRow =
  Database['public']['Tables']['pilates_classes']['Row'];
export type PilatesClassInsert =
  Database['public']['Tables']['pilates_classes']['Insert'];
export type PilatesClassUpdate =
  Database['public']['Tables']['pilates_classes']['Update'];

export type PilatesScheduleSeriesRow =
  Database['public']['Tables']['pilates_schedule_series']['Row'];
export type PilatesScheduleSeriesInsert =
  Database['public']['Tables']['pilates_schedule_series']['Insert'];
export type PilatesScheduleSeriesUpdate =
  Database['public']['Tables']['pilates_schedule_series']['Update'];
export type PilatesScheduleSeriesTimeSlotRow =
  Database['public']['Tables']['pilates_schedule_series_time_slots']['Row'];
export type PilatesScheduleSeriesTimeSlotInsert =
  Database['public']['Tables']['pilates_schedule_series_time_slots']['Insert'];
export type PilatesScheduleSeriesTimeSlotUpdate =
  Database['public']['Tables']['pilates_schedule_series_time_slots']['Update'];

export type PilatesClassScheduleRow =
  Database['public']['Tables']['pilates_class_schedules']['Row'];
export type PilatesClassScheduleInsert =
  Database['public']['Tables']['pilates_class_schedules']['Insert'];
export type PilatesClassScheduleUpdate =
  Database['public']['Tables']['pilates_class_schedules']['Update'];

export type BookingRow = Database['public']['Tables']['bookings']['Row'];
export type BookingInsert = Database['public']['Tables']['bookings']['Insert'];
export type BookingUpdate = Database['public']['Tables']['bookings']['Update'];
export type PrivateTrainerBookingRow =
  Database['public']['Tables']['private_trainer_bookings']['Row'];
export type PrivateTrainerBookingInsert =
  Database['public']['Tables']['private_trainer_bookings']['Insert'];
export type PrivateTrainerBookingUpdate =
  Database['public']['Tables']['private_trainer_bookings']['Update'];

export type PrivateTrainerBookingHistoryRow =
  Database['public']['Tables']['private_trainer_booking_history']['Row'];
export type PrivateTrainerBookingHistoryInsert =
  Database['public']['Tables']['private_trainer_booking_history']['Insert'];
export type PrivateTrainerBookingHistoryUpdate =
  Database['public']['Tables']['private_trainer_booking_history']['Update'];
export type BookingHistoryRow =
  Database['public']['Tables']['booking_history']['Row'];
export type BookingHistoryInsert =
  Database['public']['Tables']['booking_history']['Insert'];
export type BookingHistoryUpdate =
  Database['public']['Tables']['booking_history']['Update'];

export type BookingWaitlistRow =
  Database['public']['Tables']['booking_waitlist']['Row'];
export type BookingWaitlistInsert =
  Database['public']['Tables']['booking_waitlist']['Insert'];
export type BookingWaitlistUpdate =
  Database['public']['Tables']['booking_waitlist']['Update'];

export type BookingDomainEventRow =
  Database['public']['Tables']['booking_domain_events']['Row'];
export type BookingDomainEventInsert =
  Database['public']['Tables']['booking_domain_events']['Insert'];
export type BookingDomainEventUpdate =
  Database['public']['Tables']['booking_domain_events']['Update'];
export type PaymentRow = Database['public']['Tables']['payments']['Row'];
export type PaymentInsert = Database['public']['Tables']['payments']['Insert'];
export type PaymentUpdate = Database['public']['Tables']['payments']['Update'];

export type PaymentTransactionRow =
  Database['public']['Tables']['payment_transactions']['Row'];
export type PaymentTransactionInsert =
  Database['public']['Tables']['payment_transactions']['Insert'];
export type PaymentTransactionUpdate =
  Database['public']['Tables']['payment_transactions']['Update'];

export type WalletAccountRow =
  Database['public']['Tables']['wallet_accounts']['Row'];
export type WalletAccountInsert =
  Database['public']['Tables']['wallet_accounts']['Insert'];
export type WalletAccountUpdate =
  Database['public']['Tables']['wallet_accounts']['Update'];

export type WalletLedgerEntryRow =
  Database['public']['Tables']['wallet_ledger_entries']['Row'];
export type WalletLedgerEntryInsert =
  Database['public']['Tables']['wallet_ledger_entries']['Insert'];
export type WalletLedgerEntryUpdate =
  Database['public']['Tables']['wallet_ledger_entries']['Update'];

export type PromoCodeRow = Database['public']['Tables']['promo_codes']['Row'];
export type PromoCodeInsert =
  Database['public']['Tables']['promo_codes']['Insert'];
export type PromoCodeUpdate =
  Database['public']['Tables']['promo_codes']['Update'];

export type PaymentDiscountRow =
  Database['public']['Tables']['payment_discounts']['Row'];
export type PaymentDiscountInsert =
  Database['public']['Tables']['payment_discounts']['Insert'];
export type PaymentDiscountUpdate =
  Database['public']['Tables']['payment_discounts']['Update'];
export type PilatesScheduleAvailabilityRpcRow =
  Database['public']['Functions']['get_pilates_schedule_availability']['Returns'][number];

export type CreatePilatesBookingAtomicRpcRow =
  Database['public']['Functions']['create_pilates_booking_atomic']['Returns'][number];

export type CancelPilatesBookingAtomicRpcRow =
  Database['public']['Functions']['cancel_pilates_booking_atomic']['Returns'][number];

export type ReschedulePilatesBookingAtomicRpcRow =
  Database['public']['Functions']['reschedule_pilates_booking_atomic']['Returns'][number];

export type ExpireBookingHoldsAtomicRpcRow =
  Database['public']['Functions']['expire_booking_holds_atomic']['Returns'][number];
export type ExpirePrivateTrainerBookingHoldsAtomicRpcRow =
  Database['public']['Functions']['expire_private_trainer_booking_holds_atomic']['Returns'][number];

export type CreatePrivateTrainerBookingAtomicRpcRow =
  Database['public']['Functions']['create_private_trainer_booking_atomic']['Returns'][number];

export type CancelPrivateTrainerBookingAtomicRpcRow =
  Database['public']['Functions']['cancel_private_trainer_booking_atomic']['Returns'][number];

export type ReschedulePrivateTrainerBookingAtomicRpcRow =
  Database['public']['Functions']['reschedule_private_trainer_booking_atomic']['Returns'][number];
export type CreatePaymentIntentAtomicRpcRow =
  Database['public']['Functions']['create_payment_intent_atomic']['Returns'][number];

export type MarkPaymentPaidAtomicRpcRow =
  Database['public']['Functions']['mark_payment_paid_atomic']['Returns'][number];

export type MarkPaymentFailedAtomicRpcRow =
  Database['public']['Functions']['mark_payment_failed_atomic']['Returns'][number];

export type MarkPaymentCancelledAtomicRpcRow =
  Database['public']['Functions']['mark_payment_cancelled_atomic']['Returns'][number];

export type ExpirePaymentIntentsAtomicRpcRow =
  Database['public']['Functions']['expire_payment_intents_atomic']['Returns'][number];

export type DebitWalletForBookingAtomicRpcRow =
  Database['public']['Functions']['debit_wallet_for_booking_atomic']['Returns'][number];

export type CreditWalletAtomicRpcRow =
  Database['public']['Functions']['credit_wallet_atomic']['Returns'][number];

export type RefundPaymentAtomicRpcRow =
  Database['public']['Functions']['refund_payment_atomic']['Returns'][number];

export type LAFAMSupabaseClient = SupabaseClient<Database>;

export interface DatabaseConnectionInfo {
  provider: DatabaseProvider;
  projectUrl: string;
  projectRef: string | null;
}

export interface DatabaseHealthCheckResult {
  status: DatabaseHealthStatus;
  provider: DatabaseProvider;
  checkedAt: string;
  latencyMs: number;
  projectRef: string | null;
  error?: {
    code: string;
    message: string;
  };
}

export interface DatabaseQueryResult<TData> {
  data: TData;
  error: null;
}

export interface DatabaseQueryFailure {
  data: null;
  error: {
    code: string;
    message: string;
  };
}

export type DatabaseQueryOutcome<TData> =
  | DatabaseQueryResult<TData>
  | DatabaseQueryFailure;
