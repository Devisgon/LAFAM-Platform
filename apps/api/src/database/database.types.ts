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
    };
    Enums: {
      staff_profile_status: DatabaseStaffProfileStatus;
      pilates_class_status: DatabasePilatesClassStatus;
      pilates_class_schedule_status: DatabasePilatesClassScheduleStatus;
      pilates_class_level: DatabasePilatesClassLevel;
      booking_status: DatabaseBookingStatus;
      booking_payment_status: DatabaseBookingPaymentStatus;
      booking_source: DatabaseBookingSource;
      waitlist_status: DatabaseWaitlistStatus;
      booking_history_action: DatabaseBookingHistoryAction;
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

export type PilatesClassScheduleRow =
  Database['public']['Tables']['pilates_class_schedules']['Row'];
export type PilatesClassScheduleInsert =
  Database['public']['Tables']['pilates_class_schedules']['Insert'];
export type PilatesClassScheduleUpdate =
  Database['public']['Tables']['pilates_class_schedules']['Update'];
export type BookingRow = Database['public']['Tables']['bookings']['Row'];
export type BookingInsert = Database['public']['Tables']['bookings']['Insert'];
export type BookingUpdate = Database['public']['Tables']['bookings']['Update'];

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
