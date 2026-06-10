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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
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
