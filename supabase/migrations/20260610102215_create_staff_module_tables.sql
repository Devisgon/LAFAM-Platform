-- supabase/migrations/20260610102215_create_staff_module_tables.sql

/**
 * LAFAM Staff Module Tables
 *
 * Purpose:
 * - Stores staff business profiles separately from authentication identity.
 * - Links every staff profile to the existing public.app_users table.
 * - Stores weekly staff availability rules for trainer/staff scheduling.
 *
 * Important:
 * - Passwords are never stored here.
 * - Login identity remains in Supabase auth.users.
 * - Platform identity remains in public.app_users.
 * - Staff business data lives in public.staff_profiles.
 * - Staff working schedule lives in public.staff_availability_rules.
 * - RLS is enabled and no public policies are added because the NestJS backend
 *   must remain the authority for privileged mutations.
 */

create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_lafam_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  create type public.staff_profile_status as enum (
    'available',
    'unavailable',
    'on_leave',
    'deactivated',
    'deleted'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.staff_profiles (
  id uuid primary key default gen_random_uuid(),

  app_user_id uuid not null unique
    references public.app_users(id)
    on update cascade
    on delete restrict,

  display_name text not null,
  address text,
  post_title text not null,
  bio text,
  specialties text[] not null default '{}',

  status public.staff_profile_status not null default 'available',

  created_by_admin_id uuid
    references public.app_users(id)
    on update cascade
    on delete set null,

  updated_by_admin_id uuid
    references public.app_users(id)
    on update cascade
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  deleted_at timestamptz,

  constraint staff_profiles_display_name_not_blank
    check (length(trim(display_name)) > 0),

  constraint staff_profiles_display_name_length
    check (char_length(display_name) <= 120),

  constraint staff_profiles_post_title_not_blank
    check (length(trim(post_title)) > 0),

  constraint staff_profiles_post_title_length
    check (char_length(post_title) <= 100),

  constraint staff_profiles_address_length
    check (address is null or char_length(address) <= 500),

  constraint staff_profiles_bio_length
    check (bio is null or char_length(bio) <= 1000),

  constraint staff_profiles_deleted_state_consistent
    check (
      (status = 'deleted' and deleted_at is not null)
      or
      (status <> 'deleted' and deleted_at is null)
    ),

  constraint staff_profiles_deactivated_state_consistent
    check (
      (status = 'deactivated' and deactivated_at is not null)
      or
      (status <> 'deactivated' and deactivated_at is null)
    )
);

create table if not exists public.staff_availability_rules (
  id uuid primary key default gen_random_uuid(),

  staff_profile_id uuid not null
    references public.staff_profiles(id)
    on update cascade
    on delete cascade,

  day_of_week smallint not null,
  start_time time not null,
  end_time time not null,
  is_available boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint staff_availability_rules_day_of_week_range
    check (day_of_week between 0 and 6),

  constraint staff_availability_rules_time_order
    check (start_time < end_time),

  constraint staff_availability_rules_unique_window
    unique (staff_profile_id, day_of_week, start_time, end_time)
);

create index if not exists staff_profiles_app_user_id_idx
  on public.staff_profiles(app_user_id);

create index if not exists staff_profiles_status_idx
  on public.staff_profiles(status);

create index if not exists staff_profiles_deleted_at_idx
  on public.staff_profiles(deleted_at);

create index if not exists staff_profiles_created_by_admin_id_idx
  on public.staff_profiles(created_by_admin_id);

create index if not exists staff_availability_rules_staff_profile_id_idx
  on public.staff_availability_rules(staff_profile_id);

create index if not exists staff_availability_rules_day_of_week_idx
  on public.staff_availability_rules(day_of_week);

drop trigger if exists set_staff_profiles_updated_at
  on public.staff_profiles;

create trigger set_staff_profiles_updated_at
before update on public.staff_profiles
for each row
execute function public.set_lafam_updated_at();

drop trigger if exists set_staff_availability_rules_updated_at
  on public.staff_availability_rules;

create trigger set_staff_availability_rules_updated_at
before update on public.staff_availability_rules
for each row
execute function public.set_lafam_updated_at();

alter table public.staff_profiles enable row level security;
alter table public.staff_availability_rules enable row level security;

comment on table public.staff_profiles is
  'Business profile records for LAFAM staff members. Authentication identity remains in auth.users and platform identity remains in app_users.';

comment on column public.staff_profiles.app_user_id is
  'References the app_users row for the staff member. The related app_users row owns email, phone, role, auth status, and Supabase auth_user_id.';

comment on column public.staff_profiles.display_name is
  'Staff display name shown in admin and operational screens.';

comment on column public.staff_profiles.post_title is
  'Human-readable staff post/title such as Pilates Trainer. This is not an authorization role.';

comment on column public.staff_profiles.specialties is
  'List of staff specialties such as Reformer, Strength, Beginner Pilates.';

comment on column public.staff_profiles.status is
  'Business availability state for the staff profile. Auth account status remains on app_users.status.';

comment on table public.staff_availability_rules is
  'Weekly availability windows for staff members. day_of_week uses 0 = Sunday through 6 = Saturday.';

comment on column public.staff_availability_rules.day_of_week is
  '0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday.';

comment on column public.staff_availability_rules.is_available is
  'Marks whether this weekly availability window is active for scheduling.';