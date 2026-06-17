-- supabase/migrations/20260616053844_add_schedule_recurrence_private_bookings_calendar_support.sql
-- LAFAM Schedule Recurrence, Private Trainer Bookings, and Calendar Support
--
-- Purpose:
-- - Adds recurring Pilates schedule series support for weekly/monthly schedule generation.
-- - Keeps existing single scheduled class occurrences fully supported.
-- - Adds isolated one-on-one private trainer booking support inside the Booking domain.
-- - Adds database structure and indexes required for admin calendar views.
-- - Preserves backend authority: frontend must not write directly to these tables.
--
-- Important:
-- - Customers still book real schedule occurrences, not recurrence templates.
-- - Private trainer bookings are intentionally isolated from group class bookings.
-- - Group class bookings continue to use public.bookings.
-- - Private sessions use public.private_trainer_bookings.
-- - Cross-conflict protection between class schedules and private trainer bookings is enforced by RPC logic.
-- - Direct client access is blocked by RLS; NestJS service-role access remains the trusted mutation path.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Schedule recurrence enums
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'pilates_schedule_series_frequency'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.pilates_schedule_series_frequency as enum (
      'weekly',
      'monthly'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'pilates_schedule_monthly_rule'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.pilates_schedule_monthly_rule as enum (
      'day_of_month'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'pilates_schedule_series_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.pilates_schedule_series_status as enum (
      'active',
      'cancelled',
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
    where typname = 'pilates_schedule_generation_source'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.pilates_schedule_generation_source as enum (
      'single',
      'recurring'
    );
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Private booking enums
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'private_booking_history_action'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.private_booking_history_action as enum (
      'private_booking_created',
      'private_booking_confirmed',
      'private_booking_cancelled',
      'private_booking_completed',
      'private_booking_no_show',
      'private_booking_expired',
      'private_booking_rescheduled',
      'private_booking_admin_override'
    );
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Schedule recurrence validation helpers
-- ---------------------------------------------------------------------------

create or replace function public.lafam_is_valid_weekday_array(
  p_days smallint[]
)
returns boolean
language sql
immutable
as $$
  select
    p_days is not null
    and cardinality(p_days) between 1 and 7
    and not exists (
      select 1
      from unnest(p_days) as weekdays(day_value)
      where weekdays.day_value < 0
         or weekdays.day_value > 6
    )
    and cardinality(p_days) = (
      select count(distinct weekdays.day_value)::integer
      from unnest(p_days) as weekdays(day_value)
    );
$$;

-- ---------------------------------------------------------------------------
-- Schedule recurrence table
-- ---------------------------------------------------------------------------

create table if not exists public.pilates_schedule_series (
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

  frequency public.pilates_schedule_series_frequency not null,
  days_of_week smallint[] not null default '{}',
  monthly_rule public.pilates_schedule_monthly_rule,
  day_of_month smallint,

  start_date date not null,
  end_date date not null,
  start_time time not null,
  end_time time not null,
  duration_minutes integer not null,
  capacity integer not null,

  excluded_dates date[] not null default '{}',

  status public.pilates_schedule_series_status not null default 'active',

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
  deleted_at timestamptz,
  realtime_version bigint not null default 1,

  constraint pilates_schedule_series_studio_not_blank
    check (length(trim(studio)) > 0),

  constraint pilates_schedule_series_studio_length
    check (char_length(studio) <= 120),

  constraint pilates_schedule_series_date_order
    check (start_date <= end_date),

  constraint pilates_schedule_series_max_range
    check (end_date <= (start_date + interval '12 months')::date),

  constraint pilates_schedule_series_time_order
    check (start_time < end_time),

  constraint pilates_schedule_series_duration_range
    check (duration_minutes between 15 and 240),

  constraint pilates_schedule_series_duration_matches_times
    check (
      extract(epoch from (end_time - start_time)) / 60 = duration_minutes
    ),

  constraint pilates_schedule_series_capacity_range
    check (capacity between 1 and 100),

  constraint pilates_schedule_series_realtime_version_positive
    check (realtime_version >= 1),

  constraint pilates_schedule_series_weekly_rule_valid
    check (
      frequency <> 'weekly'
      or
      (
        public.lafam_is_valid_weekday_array(days_of_week)
        and monthly_rule is null
        and day_of_month is null
      )
    ),

  constraint pilates_schedule_series_monthly_rule_valid
    check (
      frequency <> 'monthly'
      or
      (
        cardinality(days_of_week) = 0
        and monthly_rule = 'day_of_month'
        and day_of_month between 1 and 31
      )
    ),

  constraint pilates_schedule_series_cancelled_state_consistent
    check (
      (
        status = 'cancelled'
        and cancelled_at is not null
        and deleted_at is null
      )
      or
      (
        status <> 'cancelled'
        and cancelled_at is null
      )
    ),

  constraint pilates_schedule_series_deleted_state_consistent
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

-- ---------------------------------------------------------------------------
-- Extend existing Pilates schedules with recurrence metadata
-- ---------------------------------------------------------------------------

alter table public.pilates_class_schedules
  add column if not exists series_id uuid;

alter table public.pilates_class_schedules
  add column if not exists series_occurrence_index integer;

alter table public.pilates_class_schedules
  add column if not exists generation_source public.pilates_schedule_generation_source
    not null default 'single';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pilates_class_schedules_series_id_fkey'
  ) then
    alter table public.pilates_class_schedules
      add constraint pilates_class_schedules_series_id_fkey
      foreign key (series_id)
      references public.pilates_schedule_series(id)
      on update cascade
      on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pilates_class_schedules_series_occurrence_positive'
  ) then
    alter table public.pilates_class_schedules
      add constraint pilates_class_schedules_series_occurrence_positive
      check (
        series_occurrence_index is null
        or series_occurrence_index > 0
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pilates_class_schedules_generation_source_consistent'
  ) then
    alter table public.pilates_class_schedules
      add constraint pilates_class_schedules_generation_source_consistent
      check (
        (
          generation_source = 'single'
          and series_id is null
          and series_occurrence_index is null
        )
        or
        (
          generation_source = 'recurring'
          and series_id is not null
          and series_occurrence_index is not null
        )
      );
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Private trainer booking table
-- ---------------------------------------------------------------------------

create table if not exists public.private_trainer_bookings (
  id uuid primary key default gen_random_uuid(),

  booking_number text not null unique,

  user_id uuid not null
    references public.app_users(id)
    on update cascade
    on delete restrict,

  trainer_staff_profile_id uuid not null
    references public.staff_profiles(id)
    on update cascade
    on delete restrict,

  session_date date not null,
  start_time time not null,
  end_time time not null,
  duration_minutes integer not null,
  studio text not null default 'LAFAM Pilates Studio',

  status public.booking_status not null default 'pending_payment',
  source public.booking_source not null default 'customer_web',
  payment_status public.booking_payment_status not null default 'pending',
  payment_required boolean not null default true,

  idempotency_key text,

  seat_hold_expires_at timestamptz,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  completed_at timestamptz,
  no_show_at timestamptz,
  rescheduled_at timestamptz,

  rescheduled_from_private_booking_id uuid
    references public.private_trainer_bookings(id)
    on update cascade
    on delete set null,

  rescheduled_to_private_booking_id uuid
    references public.private_trainer_bookings(id)
    on update cascade
    on delete set null,

  created_by_user_id uuid
    references public.app_users(id)
    on update cascade
    on delete set null,

  created_by_admin_id uuid
    references public.app_users(id)
    on update cascade
    on delete set null,

  cancelled_by_user_id uuid
    references public.app_users(id)
    on update cascade
    on delete set null,

  cancelled_by_admin_id uuid
    references public.app_users(id)
    on update cascade
    on delete set null,

  cancellation_reason text,
  admin_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  realtime_version bigint not null default 1,

  constraint private_trainer_bookings_booking_number_not_blank
    check (length(trim(booking_number)) > 0),

  constraint private_trainer_bookings_booking_number_length
    check (char_length(booking_number) <= 80),

  constraint private_trainer_bookings_studio_not_blank
    check (length(trim(studio)) > 0),

  constraint private_trainer_bookings_studio_length
    check (char_length(studio) <= 120),

  constraint private_trainer_bookings_time_order
    check (start_time < end_time),

  constraint private_trainer_bookings_duration_range
    check (duration_minutes between 15 and 240),

  constraint private_trainer_bookings_duration_matches_times
    check (
      extract(epoch from (end_time - start_time)) / 60 = duration_minutes
    ),

  constraint private_trainer_bookings_idempotency_key_length
    check (idempotency_key is null or char_length(idempotency_key) <= 160),

  constraint private_trainer_bookings_cancellation_reason_length
    check (cancellation_reason is null or char_length(cancellation_reason) <= 1000),

  constraint private_trainer_bookings_admin_notes_length
    check (admin_notes is null or char_length(admin_notes) <= 2000),

  constraint private_trainer_bookings_realtime_version_positive
    check (realtime_version >= 1),

  constraint private_trainer_bookings_payment_state_consistent
    check (
      (
        payment_required = false
        and payment_status = 'not_required'
        and seat_hold_expires_at is null
      )
      or
      (
        payment_required = true
        and payment_status <> 'not_required'
      )
    ),

  constraint private_trainer_bookings_pending_payment_state_consistent
    check (
      status <> 'pending_payment'
      or
      (
        payment_required = true
        and payment_status = 'pending'
        and seat_hold_expires_at is not null
        and confirmed_at is null
        and cancelled_at is null
        and completed_at is null
        and no_show_at is null
        and rescheduled_at is null
        and deleted_at is null
      )
    ),

  constraint private_trainer_bookings_confirmed_state_consistent
    check (
      status <> 'confirmed'
      or
      (
        confirmed_at is not null
        and cancelled_at is null
        and completed_at is null
        and no_show_at is null
        and rescheduled_at is null
        and deleted_at is null
      )
    ),

  constraint private_trainer_bookings_cancelled_state_consistent
    check (
      status <> 'cancelled'
      or
      (
        cancelled_at is not null
        and completed_at is null
        and no_show_at is null
        and rescheduled_at is null
        and deleted_at is null
      )
    ),

  constraint private_trainer_bookings_completed_state_consistent
    check (
      status <> 'completed'
      or
      (
        completed_at is not null
        and cancelled_at is null
        and no_show_at is null
        and rescheduled_at is null
        and deleted_at is null
      )
    ),

  constraint private_trainer_bookings_no_show_state_consistent
    check (
      status <> 'no_show'
      or
      (
        no_show_at is not null
        and cancelled_at is null
        and completed_at is null
        and rescheduled_at is null
        and deleted_at is null
      )
    ),

  constraint private_trainer_bookings_rescheduled_state_consistent
    check (
      status <> 'rescheduled'
      or
      (
        rescheduled_at is not null
        and rescheduled_to_private_booking_id is not null
        and cancelled_at is null
        and completed_at is null
        and no_show_at is null
        and deleted_at is null
      )
    ),

  constraint private_trainer_bookings_deleted_state_consistent
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

create table if not exists public.private_trainer_booking_history (
  id uuid primary key default gen_random_uuid(),

  private_booking_id uuid not null
    references public.private_trainer_bookings(id)
    on update cascade
    on delete cascade,

  actor_user_id uuid
    references public.app_users(id)
    on update cascade
    on delete set null,

  actor_admin_id uuid
    references public.app_users(id)
    on update cascade
    on delete set null,

  actor_role text,
  action public.private_booking_history_action not null,
  from_status public.booking_status,
  to_status public.booking_status,
  notes text,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  constraint private_trainer_booking_history_actor_role_length
    check (actor_role is null or char_length(actor_role) <= 80),

  constraint private_trainer_booking_history_notes_length
    check (notes is null or char_length(notes) <= 2000),

  constraint private_trainer_booking_history_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

-- ---------------------------------------------------------------------------
-- Extend booking domain events for private bookings
-- ---------------------------------------------------------------------------

alter table public.booking_domain_events
  add column if not exists private_booking_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'booking_domain_events_private_booking_id_fkey'
  ) then
    alter table public.booking_domain_events
      add constraint booking_domain_events_private_booking_id_fkey
      foreign key (private_booking_id)
      references public.private_trainer_bookings(id)
      on update cascade
      on delete set null;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists pilates_schedule_series_class_id_idx
  on public.pilates_schedule_series (class_id);

create index if not exists pilates_schedule_series_trainer_staff_profile_id_idx
  on public.pilates_schedule_series (trainer_staff_profile_id);

create index if not exists pilates_schedule_series_status_idx
  on public.pilates_schedule_series (status);

create index if not exists pilates_schedule_series_date_range_idx
  on public.pilates_schedule_series (start_date, end_date);

create index if not exists pilates_schedule_series_created_by_admin_id_idx
  on public.pilates_schedule_series (created_by_admin_id);

create index if not exists pilates_class_schedules_series_id_idx
  on public.pilates_class_schedules (series_id);

create index if not exists pilates_class_schedules_generation_source_idx
  on public.pilates_class_schedules (generation_source);

create index if not exists pilates_class_schedules_calendar_lookup_idx
  on public.pilates_class_schedules (
    class_date,
    start_time,
    end_time,
    status,
    trainer_staff_profile_id
  )
  where deleted_at is null;

create unique index if not exists pilates_class_schedules_series_occurrence_uidx
  on public.pilates_class_schedules (series_id, series_occurrence_index)
  where series_id is not null;

create unique index if not exists private_trainer_bookings_active_user_trainer_slot_uidx
  on public.private_trainer_bookings (
    user_id,
    trainer_staff_profile_id,
    session_date,
    start_time
  )
  where deleted_at is null
    and status in ('pending_payment', 'confirmed');

create unique index if not exists private_trainer_bookings_idempotency_key_uidx
  on public.private_trainer_bookings (user_id, idempotency_key)
  where idempotency_key is not null
    and deleted_at is null;

create index if not exists private_trainer_bookings_user_id_idx
  on public.private_trainer_bookings (user_id);

create index if not exists private_trainer_bookings_trainer_staff_profile_id_idx
  on public.private_trainer_bookings (trainer_staff_profile_id);

create index if not exists private_trainer_bookings_session_date_idx
  on public.private_trainer_bookings (session_date);

create index if not exists private_trainer_bookings_status_idx
  on public.private_trainer_bookings (status);

create index if not exists private_trainer_bookings_payment_status_idx
  on public.private_trainer_bookings (payment_status);

create index if not exists private_trainer_bookings_created_at_idx
  on public.private_trainer_bookings (created_at desc);

create index if not exists private_trainer_bookings_calendar_lookup_idx
  on public.private_trainer_bookings (
    session_date,
    start_time,
    end_time,
    status,
    trainer_staff_profile_id
  )
  where deleted_at is null;

create index if not exists private_trainer_bookings_rescheduled_from_idx
  on public.private_trainer_bookings (rescheduled_from_private_booking_id)
  where rescheduled_from_private_booking_id is not null;

create index if not exists private_trainer_bookings_rescheduled_to_idx
  on public.private_trainer_bookings (rescheduled_to_private_booking_id)
  where rescheduled_to_private_booking_id is not null;

create index if not exists private_trainer_booking_history_private_booking_id_idx
  on public.private_trainer_booking_history (private_booking_id);

create index if not exists private_trainer_booking_history_created_at_idx
  on public.private_trainer_booking_history (created_at desc);

create index if not exists booking_domain_events_private_booking_id_idx
  on public.booking_domain_events (private_booking_id);

-- ---------------------------------------------------------------------------
-- Exclusion constraint for private booking trainer overlap
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'private_trainer_bookings_trainer_no_overlap'
  ) then
    alter table public.private_trainer_bookings
      add constraint private_trainer_bookings_trainer_no_overlap
      exclude using gist (
        trainer_staff_profile_id with =,
        tsrange(
          (session_date + start_time),
          (session_date + end_time),
          '[)'
        ) with &&
      )
      where (
        deleted_at is null
        and status in ('pending_payment', 'confirmed')
      );
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

drop trigger if exists trg_pilates_schedule_series_set_updated_at
  on public.pilates_schedule_series;

create trigger trg_pilates_schedule_series_set_updated_at
before update on public.pilates_schedule_series
for each row
execute function public.set_lafam_realtime_updated_at();

drop trigger if exists trg_private_trainer_bookings_set_updated_at
  on public.private_trainer_bookings;

create trigger trg_private_trainer_bookings_set_updated_at
before update on public.private_trainer_bookings
for each row
execute function public.set_lafam_booking_realtime_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.pilates_schedule_series enable row level security;
alter table public.private_trainer_bookings enable row level security;
alter table public.private_trainer_booking_history enable row level security;

-- ---------------------------------------------------------------------------
-- Private booking helper functions
-- ---------------------------------------------------------------------------

create or replace function public.is_staff_available_for_time(
  p_staff_profile_id uuid,
  p_session_date date,
  p_start_time time,
  p_end_time time
)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_availability_rules availability
    where availability.staff_profile_id = p_staff_profile_id
      and availability.is_available = true
      and availability.day_of_week = extract(dow from p_session_date)::smallint
      and availability.start_time <= p_start_time
      and availability.end_time >= p_end_time
  );
$$;

create or replace function public.has_trainer_class_schedule_conflict(
  p_trainer_staff_profile_id uuid,
  p_session_date date,
  p_start_time time,
  p_end_time time,
  p_ignore_schedule_id uuid default null
)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.pilates_class_schedules schedules
    where schedules.trainer_staff_profile_id = p_trainer_staff_profile_id
      and schedules.class_date = p_session_date
      and schedules.status = 'scheduled'
      and schedules.deleted_at is null
      and (p_ignore_schedule_id is null or schedules.id <> p_ignore_schedule_id)
      and schedules.start_time < p_end_time
      and schedules.end_time > p_start_time
  );
$$;

create or replace function public.has_trainer_private_booking_conflict(
  p_trainer_staff_profile_id uuid,
  p_session_date date,
  p_start_time time,
  p_end_time time,
  p_ignore_private_booking_id uuid default null
)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.private_trainer_bookings private_bookings
    where private_bookings.trainer_staff_profile_id = p_trainer_staff_profile_id
      and private_bookings.session_date = p_session_date
      and private_bookings.deleted_at is null
      and (p_ignore_private_booking_id is null or private_bookings.id <> p_ignore_private_booking_id)
      and (
        private_bookings.status = 'confirmed'
        or
        (
          private_bookings.status = 'pending_payment'
          and private_bookings.payment_status = 'pending'
          and private_bookings.seat_hold_expires_at > now()
        )
      )
      and private_bookings.start_time < p_end_time
      and private_bookings.end_time > p_start_time
  );
$$;

create or replace function public.expire_private_trainer_booking_holds_atomic()
returns table (
  expired_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expired_count integer;
begin
  update public.private_trainer_bookings
  set
    status = 'expired',
    payment_status = 'expired',
    seat_hold_expires_at = null
  where status = 'pending_payment'
    and payment_status = 'pending'
    and seat_hold_expires_at <= now()
    and deleted_at is null;

  get diagnostics v_expired_count = row_count;

  return query
  select v_expired_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Atomic private trainer booking creation
-- ---------------------------------------------------------------------------

create or replace function public.create_private_trainer_booking_atomic(
  p_user_id uuid,
  p_trainer_staff_profile_id uuid,
  p_session_date date,
  p_start_time time,
  p_duration_minutes integer,
  p_studio text default 'LAFAM Pilates Studio',
  p_payment_required boolean default false,
  p_idempotency_key text default null,
  p_created_by_admin_id uuid default null,
  p_source public.booking_source default 'customer_web',
  p_rescheduled_from_private_booking_id uuid default null
)
returns table (
  action_result text,
  private_booking_id uuid,
  booking_number text,
  trainer_staff_profile_id uuid,
  session_date date,
  start_time time,
  end_time time,
  status public.booking_status,
  payment_status public.booking_payment_status,
  realtime_version bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.app_users%rowtype;
  v_trainer public.staff_profiles%rowtype;
  v_trainer_user public.app_users%rowtype;
  v_existing_booking public.private_trainer_bookings%rowtype;
  v_new_booking public.private_trainer_bookings%rowtype;
  v_end_time time;
  v_now timestamptz := now();
  v_kwt_now timestamp := timezone('Asia/Kuwait', now());
begin
  perform public.expire_private_trainer_booking_holds_atomic();

  if p_user_id is null then
    raise exception 'User id is required.'
      using errcode = 'P0001';
  end if;

  if p_trainer_staff_profile_id is null then
    raise exception 'Trainer staff profile id is required.'
      using errcode = 'P0001';
  end if;

  if p_session_date is null then
    raise exception 'Session date is required.'
      using errcode = 'P0001';
  end if;

  if p_start_time is null then
    raise exception 'Start time is required.'
      using errcode = 'P0001';
  end if;

  if p_duration_minutes is null or p_duration_minutes not between 15 and 240 then
    raise exception 'Private session duration must be between 15 and 240 minutes.'
      using errcode = 'P0001';
  end if;

  v_end_time := (p_start_time + make_interval(mins => p_duration_minutes))::time;

  if v_end_time <= p_start_time then
    raise exception 'Private trainer sessions cannot cross midnight.'
      using errcode = 'P0001';
  end if;

  if
    p_session_date < v_kwt_now::date
    or
    (
      p_session_date = v_kwt_now::date
      and p_start_time <= v_kwt_now::time
    )
  then
    raise exception 'Cannot book a past private trainer session.'
      using errcode = 'P0001';
  end if;

  select *
  into v_user
  from public.app_users
  where id = p_user_id
  for update;

  if not found then
    raise exception 'User was not found.'
      using errcode = 'P0001';
  end if;

  if v_user.is_guest = true then
    raise exception 'Guest users cannot create private trainer bookings.'
      using errcode = 'P0001';
  end if;

  if v_user.status <> 'active' then
    raise exception 'Only active users can create private trainer bookings.'
      using errcode = 'P0001';
  end if;

  if p_idempotency_key is not null and length(trim(p_idempotency_key)) > 0 then
    select *
    into v_existing_booking
    from public.private_trainer_bookings
    where user_id = p_user_id
      and idempotency_key = nullif(trim(p_idempotency_key), '')
      and deleted_at is null
    order by created_at desc
    limit 1;

    if found then
      return query
      select
        'existing_private_booking',
        v_existing_booking.id,
        v_existing_booking.booking_number,
        v_existing_booking.trainer_staff_profile_id,
        v_existing_booking.session_date,
        v_existing_booking.start_time,
        v_existing_booking.end_time,
        v_existing_booking.status,
        v_existing_booking.payment_status,
        v_existing_booking.realtime_version;

      return;
    end if;
  end if;

  select *
  into v_trainer
  from public.staff_profiles
  where id = p_trainer_staff_profile_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Trainer profile was not found.'
      using errcode = 'P0001';
  end if;

  if v_trainer.status <> 'available' then
    raise exception 'Trainer is not available for private bookings.'
      using errcode = 'P0001';
  end if;

  select *
  into v_trainer_user
  from public.app_users
  where id = v_trainer.app_user_id
  for update;

  if not found then
    raise exception 'Trainer app user was not found.'
      using errcode = 'P0001';
  end if;

  if v_trainer_user.role not in ('trainer', 'staff') then
    raise exception 'Selected staff profile is not assignable as a trainer.'
      using errcode = 'P0001';
  end if;

  if v_trainer_user.status <> 'active' then
    raise exception 'Trainer account is not active.'
      using errcode = 'P0001';
  end if;

  if public.is_staff_available_for_time(
    p_trainer_staff_profile_id,
    p_session_date,
    p_start_time,
    v_end_time
  ) = false then
    raise exception 'Trainer does not have availability for this private session time.'
      using errcode = 'P0001';
  end if;

  if public.has_trainer_class_schedule_conflict(
    p_trainer_staff_profile_id,
    p_session_date,
    p_start_time,
    v_end_time,
    null
  ) = true then
    raise exception 'Trainer already has a Pilates class scheduled for this time.'
      using errcode = 'P0001';
  end if;

  if public.has_trainer_private_booking_conflict(
    p_trainer_staff_profile_id,
    p_session_date,
    p_start_time,
    v_end_time,
    null
  ) = true then
    raise exception 'Trainer already has a private booking for this time.'
      using errcode = 'P0001';
  end if;

  insert into public.private_trainer_bookings (
    booking_number,
    user_id,
    trainer_staff_profile_id,
    session_date,
    start_time,
    end_time,
    duration_minutes,
    studio,
    status,
    source,
    payment_status,
    payment_required,
    idempotency_key,
    seat_hold_expires_at,
    confirmed_at,
    rescheduled_from_private_booking_id,
    created_by_user_id,
    created_by_admin_id
  )
  values (
    public.build_lafam_booking_number(),
    p_user_id,
    p_trainer_staff_profile_id,
    p_session_date,
    p_start_time,
    v_end_time,
    p_duration_minutes,
    coalesce(nullif(trim(p_studio), ''), 'LAFAM Pilates Studio'),
    case
      when p_payment_required then 'pending_payment'::public.booking_status
      else 'confirmed'::public.booking_status
    end,
    p_source,
    case
      when p_payment_required then 'pending'::public.booking_payment_status
      else 'not_required'::public.booking_payment_status
    end,
    p_payment_required,
    nullif(trim(coalesce(p_idempotency_key, '')), ''),
    case
      when p_payment_required then v_now + interval '15 minutes'
      else null
    end,
    case
      when p_payment_required then null
      else v_now
    end,
    p_rescheduled_from_private_booking_id,
    case
      when p_created_by_admin_id is null then p_user_id
      else null
    end,
    p_created_by_admin_id
  )
  returning *
  into v_new_booking;

  insert into public.private_trainer_booking_history (
    private_booking_id,
    actor_user_id,
    actor_admin_id,
    actor_role,
    action,
    from_status,
    to_status,
    notes,
    metadata
  )
  values (
    v_new_booking.id,
    case when p_created_by_admin_id is null then p_user_id else null end,
    p_created_by_admin_id,
    case when p_created_by_admin_id is null then 'customer' else 'admin' end,
    'private_booking_created',
    null,
    v_new_booking.status,
    'Private trainer booking created.',
    jsonb_build_object(
      'trainer_staff_profile_id', v_new_booking.trainer_staff_profile_id,
      'session_date', v_new_booking.session_date,
      'start_time', v_new_booking.start_time,
      'end_time', v_new_booking.end_time,
      'payment_required', p_payment_required,
      'rescheduled_from_private_booking_id', p_rescheduled_from_private_booking_id
    )
  );

  insert into public.booking_domain_events (
    event_type,
    private_booking_id,
    payload
  )
  values (
    'private_booking.created',
    v_new_booking.id,
    jsonb_build_object(
      'private_booking_id', v_new_booking.id,
      'trainer_staff_profile_id', v_new_booking.trainer_staff_profile_id,
      'user_id', v_new_booking.user_id,
      'session_date', v_new_booking.session_date,
      'start_time', v_new_booking.start_time,
      'end_time', v_new_booking.end_time,
      'status', v_new_booking.status,
      'payment_status', v_new_booking.payment_status
    )
  );

  return query
  select
    'private_booked',
    v_new_booking.id,
    v_new_booking.booking_number,
    v_new_booking.trainer_staff_profile_id,
    v_new_booking.session_date,
    v_new_booking.start_time,
    v_new_booking.end_time,
    v_new_booking.status,
    v_new_booking.payment_status,
    v_new_booking.realtime_version;
end;
$$;

-- ---------------------------------------------------------------------------
-- Atomic private trainer booking cancellation
-- ---------------------------------------------------------------------------

create or replace function public.cancel_private_trainer_booking_atomic(
  p_private_booking_id uuid,
  p_actor_user_id uuid default null,
  p_actor_admin_id uuid default null,
  p_reason text default null
)
returns table (
  action_result text,
  private_booking_id uuid,
  status public.booking_status,
  payment_status public.booking_payment_status,
  realtime_version bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.private_trainer_bookings%rowtype;
  v_from_status public.booking_status;
begin
  if p_private_booking_id is null then
    raise exception 'Private booking id is required.'
      using errcode = 'P0001';
  end if;

  select *
  into v_booking
  from public.private_trainer_bookings
  where id = p_private_booking_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Private trainer booking was not found.'
      using errcode = 'P0001';
  end if;

  if v_booking.status not in ('pending_payment', 'confirmed') then
    raise exception 'Only active private trainer bookings can be cancelled.'
      using errcode = 'P0001';
  end if;

  v_from_status := v_booking.status;

  update public.private_trainer_bookings
  set
    status = 'cancelled',
    payment_status = case
      when payment_status = 'pending' then 'expired'::public.booking_payment_status
      else payment_status
    end,
    cancelled_at = now(),
    cancelled_by_user_id = p_actor_user_id,
    cancelled_by_admin_id = p_actor_admin_id,
    cancellation_reason = nullif(trim(coalesce(p_reason, '')), ''),
    seat_hold_expires_at = null
  where id = v_booking.id
  returning *
  into v_booking;

  insert into public.private_trainer_booking_history (
    private_booking_id,
    actor_user_id,
    actor_admin_id,
    actor_role,
    action,
    from_status,
    to_status,
    notes,
    metadata
  )
  values (
    v_booking.id,
    p_actor_user_id,
    p_actor_admin_id,
    case when p_actor_admin_id is null then 'customer' else 'admin' end,
    'private_booking_cancelled',
    v_from_status,
    v_booking.status,
    p_reason,
    jsonb_build_object(
      'trainer_staff_profile_id', v_booking.trainer_staff_profile_id,
      'session_date', v_booking.session_date,
      'start_time', v_booking.start_time,
      'end_time', v_booking.end_time
    )
  );

  insert into public.booking_domain_events (
    event_type,
    private_booking_id,
    payload
  )
  values (
    'private_booking.cancelled',
    v_booking.id,
    jsonb_build_object(
      'private_booking_id', v_booking.id,
      'trainer_staff_profile_id', v_booking.trainer_staff_profile_id,
      'user_id', v_booking.user_id,
      'status', v_booking.status
    )
  );

  return query
  select
    'private_cancelled',
    v_booking.id,
    v_booking.status,
    v_booking.payment_status,
    v_booking.realtime_version;
end;
$$;

-- ---------------------------------------------------------------------------
-- Atomic private trainer booking reschedule
-- ---------------------------------------------------------------------------

create or replace function public.reschedule_private_trainer_booking_atomic(
  p_private_booking_id uuid,
  p_target_session_date date,
  p_target_start_time time,
  p_target_duration_minutes integer,
  p_studio text default null,
  p_actor_user_id uuid default null,
  p_actor_admin_id uuid default null,
  p_reason text default null,
  p_idempotency_key text default null,
  p_payment_required boolean default false
)
returns table (
  action_result text,
  old_private_booking_id uuid,
  new_private_booking_id uuid,
  new_booking_number text,
  trainer_staff_profile_id uuid,
  session_date date,
  start_time time,
  end_time time,
  old_status public.booking_status,
  new_status public.booking_status,
  new_payment_status public.booking_payment_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_booking public.private_trainer_bookings%rowtype;
  v_old_status public.booking_status;
  v_new_result record;
begin
  if p_private_booking_id is null then
    raise exception 'Private booking id is required.'
      using errcode = 'P0001';
  end if;

  select *
  into v_old_booking
  from public.private_trainer_bookings
  where id = p_private_booking_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Private trainer booking was not found.'
      using errcode = 'P0001';
  end if;

  if v_old_booking.status not in ('pending_payment', 'confirmed') then
    raise exception 'Only active private trainer bookings can be rescheduled.'
      using errcode = 'P0001';
  end if;

  if p_actor_admin_id is null and p_actor_user_id is not null and v_old_booking.user_id <> p_actor_user_id then
    raise exception 'Private trainer booking does not belong to this user.'
      using errcode = 'P0001';
  end if;

  v_old_status := v_old_booking.status;

  select *
  into v_new_result
  from public.create_private_trainer_booking_atomic(
    v_old_booking.user_id,
    v_old_booking.trainer_staff_profile_id,
    p_target_session_date,
    p_target_start_time,
    p_target_duration_minutes,
    coalesce(nullif(trim(coalesce(p_studio, '')), ''), v_old_booking.studio),
    p_payment_required,
    p_idempotency_key,
    p_actor_admin_id,
    case
      when p_actor_admin_id is null then 'customer_web'::public.booking_source
      else 'admin_dashboard'::public.booking_source
    end,
    v_old_booking.id
  );

  update public.private_trainer_bookings
  set
    status = 'rescheduled',
    payment_status = case
      when payment_status = 'pending' then 'expired'::public.booking_payment_status
      else payment_status
    end,
    rescheduled_at = now(),
    rescheduled_to_private_booking_id = v_new_result.private_booking_id,
    seat_hold_expires_at = null,
    admin_notes = case
      when p_actor_admin_id is not null and p_reason is not null
        then concat_ws(E'\n', admin_notes, p_reason)
      else admin_notes
    end
  where id = v_old_booking.id
  returning *
  into v_old_booking;

  insert into public.private_trainer_booking_history (
    private_booking_id,
    actor_user_id,
    actor_admin_id,
    actor_role,
    action,
    from_status,
    to_status,
    notes,
    metadata
  )
  values (
    v_old_booking.id,
    p_actor_user_id,
    p_actor_admin_id,
    case when p_actor_admin_id is null then 'customer' else 'admin' end,
    'private_booking_rescheduled',
    v_old_status,
    v_old_booking.status,
    p_reason,
    jsonb_build_object(
      'old_private_booking_id', v_old_booking.id,
      'new_private_booking_id', v_new_result.private_booking_id,
      'target_session_date', p_target_session_date,
      'target_start_time', p_target_start_time,
      'target_duration_minutes', p_target_duration_minutes
    )
  );

  insert into public.booking_domain_events (
    event_type,
    private_booking_id,
    payload
  )
  values (
    'private_booking.rescheduled',
    v_old_booking.id,
    jsonb_build_object(
      'old_private_booking_id', v_old_booking.id,
      'new_private_booking_id', v_new_result.private_booking_id,
      'trainer_staff_profile_id', v_old_booking.trainer_staff_profile_id,
      'user_id', v_old_booking.user_id
    )
  );

  return query
  select
    'private_rescheduled',
    v_old_booking.id,
    v_new_result.private_booking_id::uuid,
    v_new_result.booking_number::text,
    v_new_result.trainer_staff_profile_id::uuid,
    v_new_result.session_date::date,
    v_new_result.start_time::time,
    v_new_result.end_time::time,
    v_old_booking.status,
    v_new_result.status::public.booking_status,
    v_new_result.payment_status::public.booking_payment_status;
end;
$$;

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------

comment on table public.pilates_schedule_series is
  'Recurring Pilates schedule templates. Templates generate real pilates_class_schedules rows; customers never book templates directly.';

comment on column public.pilates_schedule_series.days_of_week is
  'Weekly recurrence days. Uses 0 = Sunday through 6 = Saturday. Required only for weekly recurrence.';

comment on column public.pilates_schedule_series.excluded_dates is
  'Dates intentionally skipped during recurrence generation.';

comment on column public.pilates_class_schedules.series_id is
  'Nullable reference to the recurring schedule series that generated this bookable schedule occurrence.';

comment on column public.pilates_class_schedules.generation_source is
  'single = manually created one-off schedule, recurring = generated from pilates_schedule_series.';

comment on table public.private_trainer_bookings is
  'One-on-one private trainer bookings. Isolated from group class bookings while staying inside the booking domain.';

comment on table public.private_trainer_booking_history is
  'Audit/history records for private trainer booking lifecycle changes.';

comment on column public.booking_domain_events.private_booking_id is
  'Optional relation to private_trainer_bookings for future realtime/private booking event publishing.';