-- supabase/migrations/20260612055859_create_booking_module_tables.sql
-- LAFAM Booking Module
--
-- Purpose:
-- - Adds transaction-safe Pilates booking records.
-- - Adds booking lifecycle history.
-- - Adds FIFO waitlist management for full Pilates schedules.
-- - Adds domain-event storage for future WebSocket/SSE broadcasting.
-- - Adds atomic PostgreSQL functions for seat allocation, cancellation, waitlist promotion, rescheduling, and hold expiry.
--
-- Important:
-- - Booking is the authority for real availability.
-- - Pilates class schedules remain the source for class date/time/capacity.
-- - The frontend must not write directly to these tables.
-- - RLS is enabled. Backend service-role access remains the trusted mutation path.
-- - Payment gateway settlement is not implemented here. This migration only prepares payment-aware booking states.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'booking_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.booking_status as enum (
      'pending_payment',
      'confirmed',
      'cancelled',
      'completed',
      'no_show',
      'expired',
      'rescheduled',
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
    where typname = 'booking_payment_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.booking_payment_status as enum (
      'not_required',
      'pending',
      'paid',
      'failed',
      'refunded',
      'expired'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'booking_source'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.booking_source as enum (
      'customer_web',
      'admin_dashboard',
      'system_waitlist_promotion'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'waitlist_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.waitlist_status as enum (
      'waiting',
      'promoted',
      'expired',
      'cancelled',
      'converted',
      'removed'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'booking_history_action'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.booking_history_action as enum (
      'booking_created',
      'booking_confirmed',
      'booking_cancelled',
      'booking_completed',
      'booking_no_show',
      'booking_expired',
      'booking_rescheduled',
      'waitlist_joined',
      'waitlist_promoted',
      'waitlist_cancelled',
      'admin_override'
    );
  end if;
end
$$;

create or replace function public.set_lafam_booking_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_lafam_booking_realtime_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.realtime_version = old.realtime_version + 1;
  return new;
end;
$$;

create or replace function public.build_lafam_booking_number()
returns text
language plpgsql
as $$
declare
  generated_number text;
begin
  generated_number :=
    'LAFAM-' ||
    to_char(now(), 'YYYYMMDD') ||
    '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  return generated_number;
end;
$$;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),

  booking_number text not null unique,

  user_id uuid not null
    references public.app_users(id)
    on update cascade
    on delete restrict,

  schedule_id uuid not null
    references public.pilates_class_schedules(id)
    on update cascade
    on delete restrict,

  class_id uuid not null
    references public.pilates_classes(id)
    on update cascade
    on delete restrict,

  trainer_staff_profile_id uuid
    references public.staff_profiles(id)
    on update cascade
    on delete set null,

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

  rescheduled_from_booking_id uuid
    references public.bookings(id)
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

  constraint bookings_booking_number_not_blank
    check (length(trim(booking_number)) > 0),

  constraint bookings_booking_number_length
    check (char_length(booking_number) <= 80),

  constraint bookings_idempotency_key_length
    check (idempotency_key is null or char_length(idempotency_key) <= 160),

  constraint bookings_cancellation_reason_length
    check (cancellation_reason is null or char_length(cancellation_reason) <= 1000),

  constraint bookings_admin_notes_length
    check (admin_notes is null or char_length(admin_notes) <= 2000),

  constraint bookings_realtime_version_positive
    check (realtime_version >= 1),

  constraint bookings_payment_state_consistent
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

  constraint bookings_pending_payment_state_consistent
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
        and deleted_at is null
      )
    ),

  constraint bookings_confirmed_state_consistent
    check (
      status <> 'confirmed'
      or
      (
        confirmed_at is not null
        and cancelled_at is null
        and completed_at is null
        and no_show_at is null
        and deleted_at is null
      )
    ),

  constraint bookings_cancelled_state_consistent
    check (
      status <> 'cancelled'
      or
      (
        cancelled_at is not null
        and completed_at is null
        and no_show_at is null
        and deleted_at is null
      )
    ),

  constraint bookings_completed_state_consistent
    check (
      status <> 'completed'
      or
      (
        completed_at is not null
        and cancelled_at is null
        and no_show_at is null
        and deleted_at is null
      )
    ),

  constraint bookings_no_show_state_consistent
    check (
      status <> 'no_show'
      or
      (
        no_show_at is not null
        and cancelled_at is null
        and completed_at is null
        and deleted_at is null
      )
    ),

  constraint bookings_deleted_state_consistent
    check (
      (status = 'deleted' and deleted_at is not null)
      or
      (status <> 'deleted' and deleted_at is null)
    )
);

create table if not exists public.booking_history (
  id uuid primary key default gen_random_uuid(),

  booking_id uuid not null
    references public.bookings(id)
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
  action public.booking_history_action not null,
  from_status public.booking_status,
  to_status public.booking_status,
  notes text,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  constraint booking_history_actor_role_length
    check (actor_role is null or char_length(actor_role) <= 80),

  constraint booking_history_notes_length
    check (notes is null or char_length(notes) <= 2000),

  constraint booking_history_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.booking_waitlist (
  id uuid primary key default gen_random_uuid(),

  schedule_id uuid not null
    references public.pilates_class_schedules(id)
    on update cascade
    on delete restrict,

  class_id uuid not null
    references public.pilates_classes(id)
    on update cascade
    on delete restrict,

  user_id uuid not null
    references public.app_users(id)
    on update cascade
    on delete restrict,

  position integer not null,
  status public.waitlist_status not null default 'waiting',

  joined_at timestamptz not null default now(),
  promoted_at timestamptz,
  expired_at timestamptz,
  cancelled_at timestamptz,
  promotion_expires_at timestamptz,

  converted_booking_id uuid
    references public.bookings(id)
    on update cascade
    on delete set null,

  cancellation_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  realtime_version bigint not null default 1,

  constraint booking_waitlist_position_positive
    check (position > 0),

  constraint booking_waitlist_cancellation_reason_length
    check (cancellation_reason is null or char_length(cancellation_reason) <= 1000),

  constraint booking_waitlist_realtime_version_positive
    check (realtime_version >= 1),

  constraint booking_waitlist_promoted_state_consistent
    check (
      status <> 'promoted'
      or promoted_at is not null
    ),

  constraint booking_waitlist_converted_state_consistent
    check (
      status <> 'converted'
      or
      (
        promoted_at is not null
        and converted_booking_id is not null
      )
    ),

  constraint booking_waitlist_expired_state_consistent
    check (
      status <> 'expired'
      or expired_at is not null
    ),

  constraint booking_waitlist_cancelled_state_consistent
    check (
      status <> 'cancelled'
      or cancelled_at is not null
    )
);

create table if not exists public.booking_domain_events (
  id uuid primary key default gen_random_uuid(),

  event_type text not null,
  schedule_id uuid
    references public.pilates_class_schedules(id)
    on update cascade
    on delete set null,

  booking_id uuid
    references public.bookings(id)
    on update cascade
    on delete set null,

  waitlist_id uuid
    references public.booking_waitlist(id)
    on update cascade
    on delete set null,

  payload jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  published_at timestamptz,

  constraint booking_domain_events_event_type_not_blank
    check (length(trim(event_type)) > 0),

  constraint booking_domain_events_event_type_length
    check (char_length(event_type) <= 120),

  constraint booking_domain_events_payload_object
    check (jsonb_typeof(payload) = 'object')
);

create unique index if not exists bookings_active_user_schedule_uidx
  on public.bookings (user_id, schedule_id)
  where deleted_at is null
    and status in ('pending_payment', 'confirmed');

create unique index if not exists bookings_idempotency_key_uidx
  on public.bookings (user_id, idempotency_key)
  where idempotency_key is not null
    and deleted_at is null;

create index if not exists bookings_user_id_idx
  on public.bookings (user_id);

create index if not exists bookings_schedule_id_idx
  on public.bookings (schedule_id);

create index if not exists bookings_class_id_idx
  on public.bookings (class_id);

create index if not exists bookings_trainer_staff_profile_id_idx
  on public.bookings (trainer_staff_profile_id);

create index if not exists bookings_status_idx
  on public.bookings (status);

create index if not exists bookings_payment_status_idx
  on public.bookings (payment_status);

create index if not exists bookings_created_at_idx
  on public.bookings (created_at desc);

create index if not exists bookings_schedule_status_idx
  on public.bookings (schedule_id, status);

create index if not exists bookings_rescheduled_from_booking_id_idx
  on public.bookings (rescheduled_from_booking_id)
  where rescheduled_from_booking_id is not null;

create index if not exists booking_history_booking_id_idx
  on public.booking_history (booking_id);

create index if not exists booking_history_created_at_idx
  on public.booking_history (created_at desc);

create unique index if not exists booking_waitlist_schedule_position_uidx
  on public.booking_waitlist (schedule_id, position);

create unique index if not exists booking_waitlist_active_user_schedule_uidx
  on public.booking_waitlist (schedule_id, user_id)
  where status in ('waiting', 'promoted');

create index if not exists booking_waitlist_schedule_id_idx
  on public.booking_waitlist (schedule_id);

create index if not exists booking_waitlist_user_id_idx
  on public.booking_waitlist (user_id);

create index if not exists booking_waitlist_status_idx
  on public.booking_waitlist (status);

create index if not exists booking_waitlist_schedule_status_position_idx
  on public.booking_waitlist (schedule_id, status, position, joined_at);

create index if not exists booking_domain_events_schedule_id_idx
  on public.booking_domain_events (schedule_id);

create index if not exists booking_domain_events_booking_id_idx
  on public.booking_domain_events (booking_id);

create index if not exists booking_domain_events_waitlist_id_idx
  on public.booking_domain_events (waitlist_id);

create index if not exists booking_domain_events_published_at_idx
  on public.booking_domain_events (published_at);

drop trigger if exists trg_bookings_set_updated_at on public.bookings;
create trigger trg_bookings_set_updated_at
before update on public.bookings
for each row
execute function public.set_lafam_booking_realtime_updated_at();

drop trigger if exists trg_booking_waitlist_set_updated_at on public.booking_waitlist;
create trigger trg_booking_waitlist_set_updated_at
before update on public.booking_waitlist
for each row
execute function public.set_lafam_booking_realtime_updated_at();

alter table public.bookings enable row level security;
alter table public.booking_history enable row level security;
alter table public.booking_waitlist enable row level security;
alter table public.booking_domain_events enable row level security;

create or replace function public.get_pilates_schedule_availability(
  p_schedule_id uuid
)
returns table (
  schedule_id uuid,
  capacity integer,
  booked_count integer,
  pending_hold_count integer,
  available_seats integer,
  waitlist_count integer,
  waitlist_available boolean,
  schedule_realtime_version bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule public.pilates_class_schedules%rowtype;
  v_booked_count integer;
  v_pending_hold_count integer;
  v_waitlist_count integer;
  v_available_seats integer;
begin
  select *
  into v_schedule
  from public.pilates_class_schedules
  where id = p_schedule_id
    and deleted_at is null;

  if not found then
    raise exception 'Pilates schedule was not found.'
      using errcode = 'P0001';
  end if;

  select count(*)::integer
  into v_booked_count
  from public.bookings
  where bookings.schedule_id = p_schedule_id
    and bookings.status = 'confirmed'
    and bookings.deleted_at is null;

  select count(*)::integer
  into v_pending_hold_count
  from public.bookings
  where bookings.schedule_id = p_schedule_id
    and bookings.status = 'pending_payment'
    and bookings.payment_status = 'pending'
    and bookings.deleted_at is null
    and bookings.seat_hold_expires_at > now();

  select count(*)::integer
  into v_waitlist_count
  from public.booking_waitlist
  where booking_waitlist.schedule_id = p_schedule_id
    and booking_waitlist.status = 'waiting';

  v_available_seats := greatest(
    v_schedule.capacity - v_booked_count - v_pending_hold_count,
    0
  );

  return query
  select
    v_schedule.id,
    v_schedule.capacity,
    v_booked_count,
    v_pending_hold_count,
    v_available_seats,
    v_waitlist_count,
    v_schedule.status = 'scheduled'
      and v_schedule.deleted_at is null
      and v_available_seats = 0,
    v_schedule.realtime_version;
end;
$$;

create or replace function public.create_pilates_booking_atomic(
  p_user_id uuid,
  p_schedule_id uuid,
  p_payment_required boolean default false,
  p_idempotency_key text default null,
  p_created_by_admin_id uuid default null,
  p_source public.booking_source default 'customer_web'
)
returns table (
  action_result text,
  booking_id uuid,
  waitlist_id uuid,
  booking_number text,
  waitlist_position integer,
  capacity integer,
  booked_count integer,
  pending_hold_count integer,
  available_seats integer,
  waitlist_count integer,
  schedule_realtime_version bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.app_users%rowtype;
  v_schedule public.pilates_class_schedules%rowtype;
  v_class public.pilates_classes%rowtype;
  v_existing_booking public.bookings%rowtype;
  v_existing_waitlist public.booking_waitlist%rowtype;
  v_new_booking public.bookings%rowtype;
  v_new_waitlist public.booking_waitlist%rowtype;
  v_booked_count integer;
  v_pending_hold_count integer;
  v_waitlist_count integer;
  v_available_seats integer;
  v_next_position integer;
  v_now timestamptz := now();
  v_kwt_now timestamp := timezone('Asia/Kuwait', now());
begin
  if p_user_id is null then
    raise exception 'User id is required.'
      using errcode = 'P0001';
  end if;

  if p_schedule_id is null then
    raise exception 'Schedule id is required.'
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
    raise exception 'Guest users cannot create bookings.'
      using errcode = 'P0001';
  end if;

  if v_user.status <> 'active' then
    raise exception 'Only active users can create bookings.'
      using errcode = 'P0001';
  end if;

  if p_idempotency_key is not null then
    select *
    into v_existing_booking
    from public.bookings
    where user_id = p_user_id
      and idempotency_key = p_idempotency_key
      and deleted_at is null
    order by created_at desc
    limit 1;

    if found then
      select *
      into v_schedule
      from public.pilates_class_schedules
      where id = v_existing_booking.schedule_id;

      select count(*)::integer
      into v_booked_count
      from public.bookings
      where bookings.schedule_id = v_existing_booking.schedule_id
        and bookings.status = 'confirmed'
        and bookings.deleted_at is null;

      select count(*)::integer
      into v_pending_hold_count
      from public.bookings
      where bookings.schedule_id = v_existing_booking.schedule_id
        and bookings.status = 'pending_payment'
        and bookings.payment_status = 'pending'
        and bookings.deleted_at is null
        and bookings.seat_hold_expires_at > now();

      select count(*)::integer
      into v_waitlist_count
      from public.booking_waitlist
      where booking_waitlist.schedule_id = v_existing_booking.schedule_id
        and booking_waitlist.status = 'waiting';

      v_available_seats := greatest(
        v_schedule.capacity - v_booked_count - v_pending_hold_count,
        0
      );

      return query
      select
        'existing_booking',
        v_existing_booking.id,
        null::uuid,
        v_existing_booking.booking_number,
        null::integer,
        v_schedule.capacity,
        v_booked_count,
        v_pending_hold_count,
        v_available_seats,
        v_waitlist_count,
        v_schedule.realtime_version;

      return;
    end if;
  end if;

  select *
  into v_schedule
  from public.pilates_class_schedules
  where id = p_schedule_id
  for update;

  if not found then
    raise exception 'Pilates schedule was not found.'
      using errcode = 'P0001';
  end if;

  select *
  into v_class
  from public.pilates_classes
  where id = v_schedule.class_id
  for update;

  if not found then
    raise exception 'Pilates class was not found.'
      using errcode = 'P0001';
  end if;

  if v_schedule.deleted_at is not null or v_schedule.status <> 'scheduled' then
    raise exception 'Pilates schedule is not bookable.'
      using errcode = 'P0001';
  end if;

  if v_class.deleted_at is not null or v_class.status <> 'active' then
    raise exception 'Pilates class is not active.'
      using errcode = 'P0001';
  end if;

  if
    v_schedule.class_date < v_kwt_now::date
    or
    (
      v_schedule.class_date = v_kwt_now::date
      and v_schedule.start_time <= v_kwt_now::time
    )
  then
    raise exception 'Cannot book a past Pilates schedule.'
      using errcode = 'P0001';
  end if;

  select *
  into v_existing_booking
  from public.bookings
  where user_id = p_user_id
    and schedule_id = p_schedule_id
    and status in ('pending_payment', 'confirmed')
    and deleted_at is null
  order by created_at desc
  limit 1;

  if found then
    raise exception 'User already has an active booking for this schedule.'
      using errcode = 'P0001';
  end if;

  select *
  into v_existing_waitlist
  from public.booking_waitlist
  where user_id = p_user_id
    and schedule_id = p_schedule_id
    and status in ('waiting', 'promoted')
  order by joined_at desc
  limit 1;

  if found then
    raise exception 'User already has an active waitlist entry for this schedule.'
      using errcode = 'P0001';
  end if;

  select count(*)::integer
  into v_booked_count
  from public.bookings
  where bookings.schedule_id = p_schedule_id
    and bookings.status = 'confirmed'
    and bookings.deleted_at is null;

  select count(*)::integer
  into v_pending_hold_count
  from public.bookings
  where bookings.schedule_id = p_schedule_id
    and bookings.status = 'pending_payment'
    and bookings.payment_status = 'pending'
    and bookings.deleted_at is null
    and bookings.seat_hold_expires_at > now();

  v_available_seats := greatest(
    v_schedule.capacity - v_booked_count - v_pending_hold_count,
    0
  );

  if v_available_seats > 0 then
    insert into public.bookings (
      booking_number,
      user_id,
      schedule_id,
      class_id,
      trainer_staff_profile_id,
      status,
      source,
      payment_status,
      payment_required,
      idempotency_key,
      seat_hold_expires_at,
      confirmed_at,
      created_by_user_id,
      created_by_admin_id
    )
    values (
      public.build_lafam_booking_number(),
      p_user_id,
      v_schedule.id,
      v_schedule.class_id,
      v_schedule.trainer_staff_profile_id,
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
      case
        when p_created_by_admin_id is null then p_user_id
        else null
      end,
      p_created_by_admin_id
    )
    returning *
    into v_new_booking;

    insert into public.booking_history (
      booking_id,
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
      'booking_created',
      null,
      v_new_booking.status,
      'Booking created.',
      jsonb_build_object(
        'schedule_id', v_schedule.id,
        'class_id', v_schedule.class_id,
        'payment_required', p_payment_required
      )
    );

    update public.pilates_class_schedules
    set
      updated_at = now(),
      realtime_version = realtime_version + 1
    where id = v_schedule.id
    returning *
    into v_schedule;

    insert into public.booking_domain_events (
      event_type,
      schedule_id,
      booking_id,
      payload
    )
    values (
      'booking.created',
      v_schedule.id,
      v_new_booking.id,
      jsonb_build_object(
        'booking_id', v_new_booking.id,
        'schedule_id', v_schedule.id,
        'class_id', v_schedule.class_id,
        'status', v_new_booking.status,
        'payment_status', v_new_booking.payment_status
      )
    );

    select count(*)::integer
    into v_booked_count
    from public.bookings
    where bookings.schedule_id = p_schedule_id
      and bookings.status = 'confirmed'
      and bookings.deleted_at is null;

    select count(*)::integer
    into v_pending_hold_count
    from public.bookings
    where bookings.schedule_id = p_schedule_id
      and bookings.status = 'pending_payment'
      and bookings.payment_status = 'pending'
      and bookings.deleted_at is null
      and bookings.seat_hold_expires_at > now();

    select count(*)::integer
    into v_waitlist_count
    from public.booking_waitlist
    where booking_waitlist.schedule_id = p_schedule_id
      and booking_waitlist.status = 'waiting';

    v_available_seats := greatest(
      v_schedule.capacity - v_booked_count - v_pending_hold_count,
      0
    );

    return query
    select
      'booked',
      v_new_booking.id,
      null::uuid,
      v_new_booking.booking_number,
      null::integer,
      v_schedule.capacity,
      v_booked_count,
      v_pending_hold_count,
      v_available_seats,
      v_waitlist_count,
      v_schedule.realtime_version;

    return;
  end if;

  select coalesce(max(position), 0) + 1
  into v_next_position
  from public.booking_waitlist
  where schedule_id = p_schedule_id;

  insert into public.booking_waitlist (
    schedule_id,
    class_id,
    user_id,
    position,
    status
  )
  values (
    v_schedule.id,
    v_schedule.class_id,
    p_user_id,
    v_next_position,
    'waiting'
  )
  returning *
  into v_new_waitlist;

  update public.pilates_class_schedules
  set
    updated_at = now(),
    realtime_version = realtime_version + 1
  where id = v_schedule.id
  returning *
  into v_schedule;

  insert into public.booking_domain_events (
    event_type,
    schedule_id,
    waitlist_id,
    payload
  )
  values (
    'waitlist.joined',
    v_schedule.id,
    v_new_waitlist.id,
    jsonb_build_object(
      'waitlist_id', v_new_waitlist.id,
      'schedule_id', v_schedule.id,
      'class_id', v_schedule.class_id,
      'user_id', p_user_id,
      'position', v_new_waitlist.position
    )
  );

  select count(*)::integer
  into v_waitlist_count
  from public.booking_waitlist
  where booking_waitlist.schedule_id = p_schedule_id
    and booking_waitlist.status = 'waiting';

  return query
  select
    'waitlisted',
    null::uuid,
    v_new_waitlist.id,
    null::text,
    v_new_waitlist.position,
    v_schedule.capacity,
    v_booked_count,
    v_pending_hold_count,
    0,
    v_waitlist_count,
    v_schedule.realtime_version;
end;
$$;

create or replace function public.cancel_pilates_booking_atomic(
  p_booking_id uuid,
  p_actor_user_id uuid default null,
  p_actor_admin_id uuid default null,
  p_reason text default null
)
returns table (
  action_result text,
  cancelled_booking_id uuid,
  promoted_booking_id uuid,
  promoted_waitlist_id uuid,
  capacity integer,
  booked_count integer,
  pending_hold_count integer,
  available_seats integer,
  waitlist_count integer,
  schedule_realtime_version bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_schedule public.pilates_class_schedules%rowtype;
  v_waitlist public.booking_waitlist%rowtype;
  v_promoted_booking public.bookings%rowtype;
  v_booked_count integer;
  v_pending_hold_count integer;
  v_waitlist_count integer;
  v_available_seats integer;
  v_now timestamptz := now();
begin
  if p_booking_id is null then
    raise exception 'Booking id is required.'
      using errcode = 'P0001';
  end if;

  select *
  into v_booking
  from public.bookings
  where id = p_booking_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Booking was not found.'
      using errcode = 'P0001';
  end if;

  if v_booking.status not in ('pending_payment', 'confirmed') then
    raise exception 'Only active bookings can be cancelled.'
      using errcode = 'P0001';
  end if;

  select *
  into v_schedule
  from public.pilates_class_schedules
  where id = v_booking.schedule_id
  for update;

  if not found then
    raise exception 'Pilates schedule was not found.'
      using errcode = 'P0001';
  end if;

  update public.bookings
  set
    status = 'cancelled',
    payment_status = case
      when payment_status = 'pending' then 'expired'::public.booking_payment_status
      else payment_status
    end,
    cancelled_at = v_now,
    cancelled_by_user_id = p_actor_user_id,
    cancelled_by_admin_id = p_actor_admin_id,
    cancellation_reason = nullif(trim(coalesce(p_reason, '')), ''),
    seat_hold_expires_at = null
  where id = v_booking.id
  returning *
  into v_booking;

  insert into public.booking_history (
    booking_id,
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
    'booking_cancelled',
    'confirmed',
    'cancelled',
    p_reason,
    jsonb_build_object(
      'schedule_id', v_booking.schedule_id,
      'class_id', v_booking.class_id
    )
  );

  select count(*)::integer
  into v_booked_count
  from public.bookings
  where bookings.schedule_id = v_booking.schedule_id
    and bookings.status = 'confirmed'
    and bookings.deleted_at is null;

  select count(*)::integer
  into v_pending_hold_count
  from public.bookings
  where bookings.schedule_id = v_booking.schedule_id
    and bookings.status = 'pending_payment'
    and bookings.payment_status = 'pending'
    and bookings.deleted_at is null
    and bookings.seat_hold_expires_at > now();

  v_available_seats := greatest(
    v_schedule.capacity - v_booked_count - v_pending_hold_count,
    0
  );

  if v_available_seats > 0 and v_schedule.status = 'scheduled' and v_schedule.deleted_at is null then
    select *
    into v_waitlist
    from public.booking_waitlist
    where schedule_id = v_booking.schedule_id
      and status = 'waiting'
    order by position asc, joined_at asc, id asc
    for update skip locked
    limit 1;

    if found then
      insert into public.bookings (
        booking_number,
        user_id,
        schedule_id,
        class_id,
        trainer_staff_profile_id,
        status,
        source,
        payment_status,
        payment_required,
        confirmed_at,
        created_by_user_id
      )
      values (
        public.build_lafam_booking_number(),
        v_waitlist.user_id,
        v_schedule.id,
        v_schedule.class_id,
        v_schedule.trainer_staff_profile_id,
        'confirmed',
        'system_waitlist_promotion',
        'not_required',
        false,
        v_now,
        v_waitlist.user_id
      )
      returning *
      into v_promoted_booking;

      update public.booking_waitlist
      set
        status = 'converted',
        promoted_at = v_now,
        converted_booking_id = v_promoted_booking.id
      where id = v_waitlist.id
      returning *
      into v_waitlist;

      insert into public.booking_history (
        booking_id,
        actor_role,
        action,
        from_status,
        to_status,
        notes,
        metadata
      )
      values (
        v_promoted_booking.id,
        'system',
        'waitlist_promoted',
        null,
        'confirmed',
        'Waitlist entry promoted after booking cancellation.',
        jsonb_build_object(
          'waitlist_id', v_waitlist.id,
          'cancelled_booking_id', v_booking.id,
          'schedule_id', v_schedule.id
        )
      );

      insert into public.booking_domain_events (
        event_type,
        schedule_id,
        booking_id,
        waitlist_id,
        payload
      )
      values (
        'waitlist.promoted',
        v_schedule.id,
        v_promoted_booking.id,
        v_waitlist.id,
        jsonb_build_object(
          'booking_id', v_promoted_booking.id,
          'waitlist_id', v_waitlist.id,
          'schedule_id', v_schedule.id,
          'class_id', v_schedule.class_id
        )
      );
    end if;
  end if;

  update public.pilates_class_schedules
  set
    updated_at = now(),
    realtime_version = realtime_version + 1
  where id = v_schedule.id
  returning *
  into v_schedule;

  insert into public.booking_domain_events (
    event_type,
    schedule_id,
    booking_id,
    payload
  )
  values (
    'booking.cancelled',
    v_schedule.id,
    v_booking.id,
    jsonb_build_object(
      'booking_id', v_booking.id,
      'schedule_id', v_schedule.id,
      'reason', p_reason
    )
  );

  select count(*)::integer
  into v_booked_count
  from public.bookings
  where bookings.schedule_id = v_booking.schedule_id
    and bookings.status = 'confirmed'
    and bookings.deleted_at is null;

  select count(*)::integer
  into v_pending_hold_count
  from public.bookings
  where bookings.schedule_id = v_booking.schedule_id
    and bookings.status = 'pending_payment'
    and bookings.payment_status = 'pending'
    and bookings.deleted_at is null
    and bookings.seat_hold_expires_at > now();

  select count(*)::integer
  into v_waitlist_count
  from public.booking_waitlist
  where booking_waitlist.schedule_id = v_booking.schedule_id
    and booking_waitlist.status = 'waiting';

  v_available_seats := greatest(
    v_schedule.capacity - v_booked_count - v_pending_hold_count,
    0
  );

  return query
  select
    case
      when v_promoted_booking.id is null then 'cancelled'
      else 'cancelled_and_promoted'
    end,
    v_booking.id,
    v_promoted_booking.id,
    v_waitlist.id,
    v_schedule.capacity,
    v_booked_count,
    v_pending_hold_count,
    v_available_seats,
    v_waitlist_count,
    v_schedule.realtime_version;
end;
$$;

create or replace function public.reschedule_pilates_booking_atomic(
  p_booking_id uuid,
  p_target_schedule_id uuid,
  p_actor_user_id uuid default null,
  p_actor_admin_id uuid default null,
  p_join_waitlist_if_full boolean default false,
  p_reason text default null
)
returns table (
  action_result text,
  old_booking_id uuid,
  new_booking_id uuid,
  waitlist_id uuid,
  waitlist_position integer,
  capacity integer,
  booked_count integer,
  pending_hold_count integer,
  available_seats integer,
  waitlist_count integer,
  schedule_realtime_version bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_booking public.bookings%rowtype;
  v_old_schedule public.pilates_class_schedules%rowtype;
  v_target_schedule public.pilates_class_schedules%rowtype;
  v_target_class public.pilates_classes%rowtype;
  v_existing_target_booking public.bookings%rowtype;
  v_existing_waitlist public.booking_waitlist%rowtype;
  v_new_booking public.bookings%rowtype;
  v_new_waitlist public.booking_waitlist%rowtype;
  v_booked_count integer;
  v_pending_hold_count integer;
  v_waitlist_count integer;
  v_available_seats integer;
  v_next_position integer;
  v_now timestamptz := now();
  v_kwt_now timestamp := timezone('Asia/Kuwait', now());
begin
  if p_booking_id is null then
    raise exception 'Booking id is required.'
      using errcode = 'P0001';
  end if;

  if p_target_schedule_id is null then
    raise exception 'Target schedule id is required.'
      using errcode = 'P0001';
  end if;

  select *
  into v_old_booking
  from public.bookings
  where id = p_booking_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Booking was not found.'
      using errcode = 'P0001';
  end if;

  if v_old_booking.status <> 'confirmed' then
    raise exception 'Only confirmed bookings can be rescheduled.'
      using errcode = 'P0001';
  end if;

  if p_actor_admin_id is null and p_actor_user_id is distinct from v_old_booking.user_id then
    raise exception 'Booking does not belong to the current user.'
      using errcode = 'P0001';
  end if;

  if v_old_booking.schedule_id = p_target_schedule_id then
    raise exception 'Target schedule must be different from current schedule.'
      using errcode = 'P0001';
  end if;

  perform 1
  from public.pilates_class_schedules
  where id in (v_old_booking.schedule_id, p_target_schedule_id)
  order by id
  for update;

  select *
  into v_old_schedule
  from public.pilates_class_schedules
  where id = v_old_booking.schedule_id;

  select *
  into v_target_schedule
  from public.pilates_class_schedules
  where id = p_target_schedule_id;

  if not found then
    raise exception 'Target Pilates schedule was not found.'
      using errcode = 'P0001';
  end if;

  select *
  into v_target_class
  from public.pilates_classes
  where id = v_target_schedule.class_id
  for update;

  if not found then
    raise exception 'Target Pilates class was not found.'
      using errcode = 'P0001';
  end if;

  if v_target_schedule.deleted_at is not null or v_target_schedule.status <> 'scheduled' then
    raise exception 'Target Pilates schedule is not bookable.'
      using errcode = 'P0001';
  end if;

  if v_target_class.deleted_at is not null or v_target_class.status <> 'active' then
    raise exception 'Target Pilates class is not active.'
      using errcode = 'P0001';
  end if;

  if
    v_target_schedule.class_date < v_kwt_now::date
    or
    (
      v_target_schedule.class_date = v_kwt_now::date
      and v_target_schedule.start_time <= v_kwt_now::time
    )
  then
    raise exception 'Cannot reschedule to a past Pilates schedule.'
      using errcode = 'P0001';
  end if;

  select *
  into v_existing_target_booking
  from public.bookings
  where user_id = v_old_booking.user_id
    and schedule_id = p_target_schedule_id
    and status in ('pending_payment', 'confirmed')
    and deleted_at is null
  limit 1;

  if found then
    raise exception 'User already has an active booking for the target schedule.'
      using errcode = 'P0001';
  end if;

  select count(*)::integer
  into v_booked_count
  from public.bookings
  where bookings.schedule_id = p_target_schedule_id
    and bookings.status = 'confirmed'
    and bookings.deleted_at is null;

  select count(*)::integer
  into v_pending_hold_count
  from public.bookings
  where bookings.schedule_id = p_target_schedule_id
    and bookings.status = 'pending_payment'
    and bookings.payment_status = 'pending'
    and bookings.deleted_at is null
    and bookings.seat_hold_expires_at > now();

  v_available_seats := greatest(
    v_target_schedule.capacity - v_booked_count - v_pending_hold_count,
    0
  );

  if v_available_seats <= 0 then
    if not p_join_waitlist_if_full then
      raise exception 'Target Pilates schedule is full.'
        using errcode = 'P0001';
    end if;

    select *
    into v_existing_waitlist
    from public.booking_waitlist
    where user_id = v_old_booking.user_id
      and schedule_id = p_target_schedule_id
      and status in ('waiting', 'promoted')
    limit 1;

    if found then
      raise exception 'User already has an active waitlist entry for the target schedule.'
        using errcode = 'P0001';
    end if;

    select coalesce(max(position), 0) + 1
    into v_next_position
    from public.booking_waitlist
    where schedule_id = p_target_schedule_id;

    insert into public.booking_waitlist (
      schedule_id,
      class_id,
      user_id,
      position,
      status
    )
    values (
      v_target_schedule.id,
      v_target_schedule.class_id,
      v_old_booking.user_id,
      v_next_position,
      'waiting'
    )
    returning *
    into v_new_waitlist;

    update public.pilates_class_schedules
    set
      updated_at = now(),
      realtime_version = realtime_version + 1
    where id = v_target_schedule.id
    returning *
    into v_target_schedule;

    insert into public.booking_domain_events (
      event_type,
      schedule_id,
      waitlist_id,
      payload
    )
    values (
      'waitlist.joined',
      v_target_schedule.id,
      v_new_waitlist.id,
      jsonb_build_object(
        'waitlist_id', v_new_waitlist.id,
        'schedule_id', v_target_schedule.id,
        'class_id', v_target_schedule.class_id,
        'user_id', v_old_booking.user_id,
        'source_booking_id', v_old_booking.id,
        'position', v_new_waitlist.position
      )
    );

    select count(*)::integer
    into v_waitlist_count
    from public.booking_waitlist
    where booking_waitlist.schedule_id = p_target_schedule_id
      and booking_waitlist.status = 'waiting';

    return query
    select
      'target_waitlisted',
      v_old_booking.id,
      null::uuid,
      v_new_waitlist.id,
      v_new_waitlist.position,
      v_target_schedule.capacity,
      v_booked_count,
      v_pending_hold_count,
      0,
      v_waitlist_count,
      v_target_schedule.realtime_version;

    return;
  end if;

  update public.bookings
  set
    status = 'rescheduled',
    cancellation_reason = nullif(trim(coalesce(p_reason, '')), '')
  where id = v_old_booking.id
  returning *
  into v_old_booking;

  insert into public.bookings (
    booking_number,
    user_id,
    schedule_id,
    class_id,
    trainer_staff_profile_id,
    status,
    source,
    payment_status,
    payment_required,
    confirmed_at,
    rescheduled_from_booking_id,
    created_by_user_id,
    created_by_admin_id
  )
  values (
    public.build_lafam_booking_number(),
    v_old_booking.user_id,
    v_target_schedule.id,
    v_target_schedule.class_id,
    v_target_schedule.trainer_staff_profile_id,
    'confirmed',
    case
      when p_actor_admin_id is null then 'customer_web'::public.booking_source
      else 'admin_dashboard'::public.booking_source
    end,
    'not_required',
    false,
    v_now,
    v_old_booking.id,
    case when p_actor_admin_id is null then v_old_booking.user_id else null end,
    p_actor_admin_id
  )
  returning *
  into v_new_booking;

  insert into public.booking_history (
    booking_id,
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
    'booking_rescheduled',
    'confirmed',
    'rescheduled',
    p_reason,
    jsonb_build_object(
      'old_schedule_id', v_old_schedule.id,
      'new_schedule_id', v_target_schedule.id,
      'new_booking_id', v_new_booking.id
    )
  );

  insert into public.booking_history (
    booking_id,
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
    p_actor_user_id,
    p_actor_admin_id,
    case when p_actor_admin_id is null then 'customer' else 'admin' end,
    'booking_created',
    null,
    'confirmed',
    'Booking created from reschedule.',
    jsonb_build_object(
      'old_booking_id', v_old_booking.id,
      'old_schedule_id', v_old_schedule.id,
      'new_schedule_id', v_target_schedule.id
    )
  );

  update public.pilates_class_schedules
  set
    updated_at = now(),
    realtime_version = realtime_version + 1
  where id in (v_old_schedule.id, v_target_schedule.id);

  select *
  into v_target_schedule
  from public.pilates_class_schedules
  where id = p_target_schedule_id;

  insert into public.booking_domain_events (
    event_type,
    schedule_id,
    booking_id,
    payload
  )
  values (
    'booking.rescheduled',
    v_target_schedule.id,
    v_new_booking.id,
    jsonb_build_object(
      'old_booking_id', v_old_booking.id,
      'new_booking_id', v_new_booking.id,
      'old_schedule_id', v_old_schedule.id,
      'new_schedule_id', v_target_schedule.id
    )
  );

  select count(*)::integer
  into v_booked_count
  from public.bookings
  where bookings.schedule_id = p_target_schedule_id
    and bookings.status = 'confirmed'
    and bookings.deleted_at is null;

  select count(*)::integer
  into v_pending_hold_count
  from public.bookings
  where bookings.schedule_id = p_target_schedule_id
    and bookings.status = 'pending_payment'
    and bookings.payment_status = 'pending'
    and bookings.deleted_at is null
    and bookings.seat_hold_expires_at > now();

  select count(*)::integer
  into v_waitlist_count
  from public.booking_waitlist
  where booking_waitlist.schedule_id = p_target_schedule_id
    and booking_waitlist.status = 'waiting';

  v_available_seats := greatest(
    v_target_schedule.capacity - v_booked_count - v_pending_hold_count,
    0
  );

  return query
  select
    'rescheduled',
    v_old_booking.id,
    v_new_booking.id,
    null::uuid,
    null::integer,
    v_target_schedule.capacity,
    v_booked_count,
    v_pending_hold_count,
    v_available_seats,
    v_waitlist_count,
    v_target_schedule.realtime_version;
end;
$$;

create or replace function public.expire_booking_holds_atomic()
returns table (
  expired_booking_id uuid,
  schedule_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_schedule public.pilates_class_schedules%rowtype;
begin
  for v_booking in
    select *
    from public.bookings
    where status = 'pending_payment'
      and payment_status = 'pending'
      and seat_hold_expires_at is not null
      and seat_hold_expires_at <= now()
      and deleted_at is null
    order by seat_hold_expires_at asc, created_at asc
    for update skip locked
  loop
    select *
    into v_schedule
    from public.pilates_class_schedules
    where id = v_booking.schedule_id
    for update;

    update public.bookings
    set
      status = 'expired',
      payment_status = 'expired',
      seat_hold_expires_at = null
    where id = v_booking.id;

    insert into public.booking_history (
      booking_id,
      actor_role,
      action,
      from_status,
      to_status,
      notes,
      metadata
    )
    values (
      v_booking.id,
      'system',
      'booking_expired',
      'pending_payment',
      'expired',
      'Payment hold expired.',
      jsonb_build_object(
        'schedule_id', v_booking.schedule_id,
        'class_id', v_booking.class_id
      )
    );

    update public.pilates_class_schedules
    set
      updated_at = now(),
      realtime_version = realtime_version + 1
    where id = v_booking.schedule_id;

    insert into public.booking_domain_events (
      event_type,
      schedule_id,
      booking_id,
      payload
    )
    values (
      'booking.expired',
      v_booking.schedule_id,
      v_booking.id,
      jsonb_build_object(
        'booking_id', v_booking.id,
        'schedule_id', v_booking.schedule_id
      )
    );

    expired_booking_id := v_booking.id;
    schedule_id := v_booking.schedule_id;
    return next;
  end loop;
end;
$$;

revoke all on function public.get_pilates_schedule_availability(uuid) from public, anon, authenticated;
revoke all on function public.create_pilates_booking_atomic(uuid, uuid, boolean, text, uuid, public.booking_source) from public, anon, authenticated;
revoke all on function public.cancel_pilates_booking_atomic(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.reschedule_pilates_booking_atomic(uuid, uuid, uuid, uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.expire_booking_holds_atomic() from public, anon, authenticated;

grant execute on function public.get_pilates_schedule_availability(uuid) to service_role;
grant execute on function public.create_pilates_booking_atomic(uuid, uuid, boolean, text, uuid, public.booking_source) to service_role;
grant execute on function public.cancel_pilates_booking_atomic(uuid, uuid, uuid, text) to service_role;
grant execute on function public.reschedule_pilates_booking_atomic(uuid, uuid, uuid, uuid, boolean, text) to service_role;
grant execute on function public.expire_booking_holds_atomic() to service_role;

comment on table public.bookings is
  'Transaction-safe Pilates booking records. This table owns real booking lifecycle state and real schedule capacity usage.';

comment on table public.booking_history is
  'Append-only booking lifecycle history for customer, admin, and system booking actions.';

comment on table public.booking_waitlist is
  'FIFO waitlist entries for full Pilates schedules. Position is assigned by the backend/database only.';

comment on table public.booking_domain_events is
  'Stored booking-domain events prepared for future WebSocket/SSE or notification broadcasting.';

comment on function public.create_pilates_booking_atomic(uuid, uuid, boolean, text, uuid, public.booking_source) is
  'Atomically creates a Pilates booking or FIFO waitlist entry after locking the target schedule row.';

comment on function public.cancel_pilates_booking_atomic(uuid, uuid, uuid, text) is
  'Atomically cancels an active booking and promotes the first eligible FIFO waitlist entry when a seat opens.';

comment on function public.reschedule_pilates_booking_atomic(uuid, uuid, uuid, uuid, boolean, text) is
  'Atomically reschedules a confirmed booking to another Pilates schedule or joins the target waitlist when allowed.';

comment on function public.expire_booking_holds_atomic() is
  'Expires stale pending-payment booking holds and releases capacity for affected schedules.';