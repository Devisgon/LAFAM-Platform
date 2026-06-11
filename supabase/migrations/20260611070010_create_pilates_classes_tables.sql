-- supabase/migrations/20260611070010_create_pilates_classes_tables.sql
-- LAFAM Pilates Classes Module
--
-- Purpose:
-- - Adds Pilates class definitions.
-- - Adds Pilates class scheduled occurrences.
-- - Links schedules to existing staff_profiles trainers.
-- - Keeps Pilates separate from future Salon service flow.
-- - Prepares schedules for real-time availability updates through realtime_version.
--
-- Important:
-- - Bookings are not created in this migration.
-- - Available seats will be derived later from confirmed bookings.
-- - Trainer overlap is protected at database level for scheduled classes.
-- - Direct client access is blocked by RLS; backend service role remains the authority.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'pilates_class_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.pilates_class_status as enum (
      'draft',
      'active',
      'inactive',
      'deleted'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'pilates_class_schedule_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.pilates_class_schedule_status as enum (
      'scheduled',
      'cancelled',
      'completed',
      'deleted'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'pilates_class_level'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.pilates_class_level as enum (
      'beginner',
      'intermediate',
      'advanced',
      'all_levels'
    );
  end if;
end
$$;

create or replace function public.set_lafam_realtime_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.realtime_version = old.realtime_version + 1;
  return new;
end;
$$;

create table if not exists public.pilates_classes (
  id uuid primary key default gen_random_uuid(),

  title text not null,
  description text,
  default_duration_minutes integer not null default 60,
  default_capacity integer not null default 8,
  level public.pilates_class_level not null default 'all_levels',
  status public.pilates_class_status not null default 'draft',
  image_path text,

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
  deleted_at timestamptz,
  realtime_version bigint not null default 1,

  constraint pilates_classes_title_not_blank
    check (length(trim(title)) > 0),

  constraint pilates_classes_title_length
    check (char_length(title) <= 160),

  constraint pilates_classes_description_length
    check (description is null or char_length(description) <= 2000),

  constraint pilates_classes_default_duration_range
    check (default_duration_minutes between 15 and 240),

  constraint pilates_classes_default_capacity_range
    check (default_capacity between 1 and 100),

  constraint pilates_classes_image_path_length
    check (image_path is null or char_length(image_path) <= 1000),

  constraint pilates_classes_realtime_version_positive
    check (realtime_version >= 1),

  constraint pilates_classes_deleted_state_consistent
    check (
      (status = 'deleted' and deleted_at is not null)
      or
      (status <> 'deleted' and deleted_at is null)
    )
);

create table if not exists public.pilates_class_schedules (
  id uuid primary key default gen_random_uuid(),

  class_id uuid not null
    references public.pilates_classes(id)
    on update cascade
    on delete restrict,

  trainer_staff_profile_id uuid not null
    references public.staff_profiles(id)
    on update cascade
    on delete restrict,

  studio text not null default 'LAFAM Pilates Studio',
  class_date date not null,
  start_time time not null,
  end_time time not null,
  duration_minutes integer not null,
  capacity integer not null,

  status public.pilates_class_schedule_status not null default 'scheduled',
  cancellation_reason text,

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
  cancelled_at timestamptz,
  completed_at timestamptz,
  deleted_at timestamptz,
  realtime_version bigint not null default 1,

  constraint pilates_class_schedules_studio_not_blank
    check (length(trim(studio)) > 0),

  constraint pilates_class_schedules_studio_length
    check (char_length(studio) <= 120),

  constraint pilates_class_schedules_time_order
    check (start_time < end_time),

  constraint pilates_class_schedules_duration_range
    check (duration_minutes between 15 and 240),

  constraint pilates_class_schedules_duration_matches_times
    check (
      extract(epoch from (end_time - start_time)) / 60 = duration_minutes
    ),

  constraint pilates_class_schedules_capacity_range
    check (capacity between 1 and 100),

  constraint pilates_class_schedules_cancellation_reason_length
    check (
      cancellation_reason is null
      or char_length(cancellation_reason) <= 500
    ),

  constraint pilates_class_schedules_realtime_version_positive
    check (realtime_version >= 1),

  constraint pilates_class_schedules_cancelled_state_consistent
    check (
      (
        status = 'cancelled'
        and cancelled_at is not null
      )
      or
      (
        status <> 'cancelled'
        and cancelled_at is null
        and cancellation_reason is null
      )
    ),

  constraint pilates_class_schedules_completed_state_consistent
    check (
      (
        status = 'completed'
        and completed_at is not null
      )
      or
      (
        status <> 'completed'
        and completed_at is null
      )
    ),

  constraint pilates_class_schedules_deleted_state_consistent
    check (
      (
        status = 'deleted'
        and deleted_at is not null
      )
      or
      (
        status <> 'deleted'
        and deleted_at is null
      )
    )
);

create unique index if not exists pilates_classes_title_active_unique_idx
  on public.pilates_classes (lower(trim(title)))
  where deleted_at is null;

create index if not exists pilates_classes_status_idx
  on public.pilates_classes(status);

create index if not exists pilates_classes_level_idx
  on public.pilates_classes(level);

create index if not exists pilates_classes_deleted_at_idx
  on public.pilates_classes(deleted_at);

create index if not exists pilates_classes_created_at_idx
  on public.pilates_classes(created_at desc);

create index if not exists pilates_classes_created_by_admin_id_idx
  on public.pilates_classes(created_by_admin_id);

create index if not exists pilates_classes_updated_by_admin_id_idx
  on public.pilates_classes(updated_by_admin_id);

create index if not exists pilates_class_schedules_class_id_idx
  on public.pilates_class_schedules(class_id);

create index if not exists pilates_class_schedules_trainer_staff_profile_id_idx
  on public.pilates_class_schedules(trainer_staff_profile_id);

create index if not exists pilates_class_schedules_class_date_idx
  on public.pilates_class_schedules(class_date);

create index if not exists pilates_class_schedules_status_idx
  on public.pilates_class_schedules(status);

create index if not exists pilates_class_schedules_deleted_at_idx
  on public.pilates_class_schedules(deleted_at);

create index if not exists pilates_class_schedules_date_time_idx
  on public.pilates_class_schedules(class_date, start_time, end_time);

create index if not exists pilates_class_schedules_public_lookup_idx
  on public.pilates_class_schedules(class_date, status, deleted_at)
  where status = 'scheduled' and deleted_at is null;

create index if not exists pilates_class_schedules_created_by_admin_id_idx
  on public.pilates_class_schedules(created_by_admin_id);

create index if not exists pilates_class_schedules_updated_by_admin_id_idx
  on public.pilates_class_schedules(updated_by_admin_id);

create unique index if not exists pilates_class_schedules_exact_slot_unique_idx
  on public.pilates_class_schedules (
    class_id,
    trainer_staff_profile_id,
    class_date,
    start_time
  )
  where status = 'scheduled' and deleted_at is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pilates_class_schedules_trainer_no_overlap'
  ) then
    alter table public.pilates_class_schedules
      add constraint pilates_class_schedules_trainer_no_overlap
      exclude using gist (
        trainer_staff_profile_id with =,
        tsrange(
          (class_date + start_time),
          (class_date + end_time),
          '[)'
        ) with &&
      )
      where (status = 'scheduled' and deleted_at is null);
  end if;
end
$$;

drop trigger if exists set_pilates_classes_realtime_updated_at
  on public.pilates_classes;

create trigger set_pilates_classes_realtime_updated_at
before update on public.pilates_classes
for each row
execute function public.set_lafam_realtime_updated_at();

drop trigger if exists set_pilates_class_schedules_realtime_updated_at
  on public.pilates_class_schedules;

create trigger set_pilates_class_schedules_realtime_updated_at
before update on public.pilates_class_schedules
for each row
execute function public.set_lafam_realtime_updated_at();

alter table public.pilates_classes enable row level security;
alter table public.pilates_class_schedules enable row level security;

comment on table public.pilates_classes is
  'Reusable Pilates class definitions managed by LAFAM admins.';

comment on table public.pilates_class_schedules is
  'Bookable Pilates class occurrences with trainer assignment, date, time, capacity, status, and realtime versioning.';

comment on column public.pilates_classes.realtime_version is
  'Monotonic version used by backend realtime events to help clients detect stale Pilates class data.';

comment on column public.pilates_class_schedules.realtime_version is
  'Monotonic version used by backend realtime events to help clients detect stale Pilates schedule availability.';

comment on constraint pilates_class_schedules_trainer_no_overlap
  on public.pilates_class_schedules is
  'Prevents an active trainer from being assigned to overlapping scheduled Pilates class occurrences.';