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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      staff_profile_status: DatabaseStaffProfileStatus;
      pilates_class_status: DatabasePilatesClassStatus;
      pilates_class_schedule_status: DatabasePilatesClassScheduleStatus;
      pilates_class_level: DatabasePilatesClassLevel;
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
