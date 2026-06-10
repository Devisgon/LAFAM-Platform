-- supabase\migrations\20260609152328_create_auth_tables.sql
begin;

create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  email text unique,
  phone text,
  full_name text,
  role text not null,
  status text not null,
  is_guest boolean not null default false,
  avatar_path text,
  timezone text,
  metadata jsonb not null default '{}'::jsonb,
  guest_expires_at timestamptz,
  converted_from_guest_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  deleted_at timestamptz,

  constraint app_users_role_check
    check (
      role in (
        'guest',
        'customer',
        'admin',
        'trainer',
        'stylist',
        'staff',
        'super_admin'
      )
    ),

  constraint app_users_status_check
    check (
      status in (
        'guest_active',
        'pending_email_verification',
        'active',
        'deactivated',
        'deleted'
      )
    ),

  constraint app_users_metadata_object_check
    check (jsonb_typeof(metadata) = 'object'),

  constraint app_users_non_guest_email_required_check
    check (
      is_guest = true
      or email is not null
    ),

  constraint app_users_guest_consistency_check
    check (
      (
        is_guest = true
        and role = 'guest'
        and status in ('guest_active', 'deleted')
        and guest_expires_at is not null
      )
      or
      (
        is_guest = false
        and role <> 'guest'
        and status in (
          'pending_email_verification',
          'active',
          'deactivated',
          'deleted'
        )
      )
    )
);

create table if not exists public.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  supabase_auth_user_id uuid not null references auth.users(id) on delete cascade,
  access_token_hash text not null,
  refresh_token_hash text not null,
  session_type text not null default 'authenticated',
  device_id text,
  device_name text,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text,
  converted_at timestamptz,

  constraint auth_sessions_session_type_check
    check (
      session_type in (
        'guest',
        'authenticated',
        'admin',
        'staff'
      )
    ),

  constraint auth_sessions_guest_expiry_required_check
    check (
      session_type <> 'guest'
      or expires_at is not null
    ),

  constraint auth_sessions_converted_guest_only_check
    check (
      converted_at is null
      or session_type = 'guest'
    ),

  constraint auth_sessions_revocation_reason_check
    check (
      revoked_at is not null
      or revoked_reason is null
    )
);

create table if not exists public.password_reset_challenges (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  auth_user_id uuid references auth.users(id) on delete set null,
  reset_token_hash text,
  verified_at timestamptz,
  expires_at timestamptz not null,
  used_at timestamptz,
  failed_attempts integer not null default 0,
  created_at timestamptz not null default now(),

  constraint password_reset_challenges_failed_attempts_check
    check (failed_attempts >= 0),

  constraint password_reset_challenges_verified_before_used_check
    check (
      used_at is null
      or verified_at is not null
    )
);

create table if not exists public.auth_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.app_users(id) on delete set null,
  target_user_id uuid references public.app_users(id) on delete set null,
  event_type text not null,
  ip_address text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint auth_audit_events_event_type_not_empty_check
    check (length(trim(event_type)) > 0),

  constraint auth_audit_events_metadata_object_check
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists app_users_auth_user_id_idx
  on public.app_users (auth_user_id);

create index if not exists app_users_email_idx
  on public.app_users (email);

create index if not exists app_users_role_idx
  on public.app_users (role);

create index if not exists app_users_status_idx
  on public.app_users (status);

create index if not exists app_users_is_guest_idx
  on public.app_users (is_guest);

create index if not exists app_users_guest_expires_at_idx
  on public.app_users (guest_expires_at);

create index if not exists app_users_converted_from_guest_at_idx
  on public.app_users (converted_from_guest_at);

create unique index if not exists auth_sessions_access_token_hash_unique_idx
  on public.auth_sessions (access_token_hash);

create unique index if not exists auth_sessions_refresh_token_hash_unique_idx
  on public.auth_sessions (refresh_token_hash);

create index if not exists auth_sessions_user_id_idx
  on public.auth_sessions (user_id);

create index if not exists auth_sessions_supabase_auth_user_id_idx
  on public.auth_sessions (supabase_auth_user_id);

create index if not exists auth_sessions_revoked_at_idx
  on public.auth_sessions (revoked_at);

create index if not exists auth_sessions_session_type_idx
  on public.auth_sessions (session_type);

create index if not exists auth_sessions_converted_at_idx
  on public.auth_sessions (converted_at);

create index if not exists auth_sessions_expires_at_idx
  on public.auth_sessions (expires_at);

create index if not exists password_reset_challenges_email_idx
  on public.password_reset_challenges (email);

create unique index if not exists password_reset_challenges_reset_token_hash_unique_idx
  on public.password_reset_challenges (reset_token_hash)
  where reset_token_hash is not null;

create index if not exists password_reset_challenges_auth_user_id_idx
  on public.password_reset_challenges (auth_user_id);

create index if not exists password_reset_challenges_expires_at_idx
  on public.password_reset_challenges (expires_at);

create index if not exists auth_audit_events_actor_user_id_idx
  on public.auth_audit_events (actor_user_id);

create index if not exists auth_audit_events_target_user_id_idx
  on public.auth_audit_events (target_user_id);

create index if not exists auth_audit_events_event_type_idx
  on public.auth_audit_events (event_type);

create index if not exists auth_audit_events_created_at_idx
  on public.auth_audit_events (created_at);

create or replace function public.set_lafam_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_app_users_updated_at on public.app_users;

create trigger set_app_users_updated_at
before update on public.app_users
for each row
execute function public.set_lafam_updated_at();

alter table public.app_users enable row level security;
alter table public.auth_sessions enable row level security;
alter table public.password_reset_challenges enable row level security;
alter table public.auth_audit_events enable row level security;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'avatars',
  'avatars',
  false,
  2097152,
  array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id)
do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;