-- supabase/migrations/20260625142254_add_booking_orders_bulk_booking_payment_support.sql
--
-- Purpose:
-- Add backend-owned bulk Pilates booking order support.
--
-- This migration adds:
-- - booking_orders
-- - booking_order_items
-- - booking_order_id relations on bookings, payments, wallet ledger, and booking domain events
-- - booking_order payment target support
-- - atomic booking-order creation
-- - atomic booking-order confirmation after payment
-- - atomic booking-order expiry
-- - atomic wallet debit for booking orders
-- - payment intent support for booking_order target
-- - hosted payment settlement support for booking_order target
-- - unpaid payment expiry support for booking_order target
--
-- Notes:
-- - Bulk booking is all-or-nothing.
-- - Bulk booking does not create waitlist entries.
-- - Booking orders are payment-required.
-- - Frontend-submitted prices are not trusted.
-- - Production provider settlement remains owned by the existing payment callback/webhook path.

-- ---------------------------------------------------------------------------
-- Existing enum extension
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_enum enum_value
    join pg_type enum_type
      on enum_type.oid = enum_value.enumtypid
    join pg_namespace enum_namespace
      on enum_namespace.oid = enum_type.typnamespace
    where enum_namespace.nspname = 'public'
      and enum_type.typname = 'payment_target_type'
      and enum_value.enumlabel = 'booking_order'
  ) then
    alter type public.payment_target_type add value 'booking_order';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Booking order enums
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'booking_order_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.booking_order_status as enum (
      'pending_payment',
      'paid',
      'expired',
      'cancelled',
      'refunded'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'booking_order_item_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.booking_order_item_status as enum (
      'pending_payment',
      'confirmed',
      'expired',
      'cancelled',
      'refunded'
    );
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Booking order helpers
-- ---------------------------------------------------------------------------

create or replace function public.build_lafam_booking_order_number()
returns text
language plpgsql
as $$
declare
  generated_number text;
begin
  generated_number :=
    'LAFAM-ORDER-' ||
    to_char(now(), 'YYYYMMDD') ||
    '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  return generated_number;
end;
$$;

-- ---------------------------------------------------------------------------
-- Booking order tables
-- ---------------------------------------------------------------------------

create table if not exists public.booking_orders (
  id uuid primary key default gen_random_uuid(),

  order_number text not null unique default public.build_lafam_booking_order_number(),

  customer_user_id uuid not null
    references public.app_users(id)
    on update cascade
    on delete restrict,

  status public.booking_order_status not null default 'pending_payment',
  payment_status public.booking_payment_status not null default 'pending',
  payment_required boolean not null default true,

  total_amount numeric(12, 3) not null,
  currency text not null default 'KWD',

  booking_count integer not null default 0,

  idempotency_key text,

  created_by_user_id uuid
    references public.app_users(id)
    on update cascade
    on delete set null,

  created_by_admin_id uuid
    references public.app_users(id)
    on update cascade
    on delete set null,

  created_by_staff_profile_id uuid
    references public.staff_profiles(id)
    on update cascade
    on delete set null,

  created_by_role text,

  admin_notes text,
  metadata jsonb not null default '{}'::jsonb,

  expires_at timestamptz not null,
  paid_at timestamptz,
  expired_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  realtime_version bigint not null default 1,

  constraint booking_orders_order_number_not_blank
    check (length(trim(order_number)) > 0),

  constraint booking_orders_order_number_length
    check (char_length(order_number) <= 100),

  constraint booking_orders_total_amount_positive
    check (total_amount > 0),

  constraint booking_orders_currency_format
    check (
      currency = upper(currency)
      and char_length(currency) = 3
    ),

  constraint booking_orders_kwd_only
    check (currency = 'KWD'),

  constraint booking_orders_booking_count_positive
    check (booking_count >= 1),

  constraint booking_orders_payment_required_true
    check (payment_required = true),

  constraint booking_orders_idempotency_key_length
    check (idempotency_key is null or char_length(idempotency_key) <= 160),

  constraint booking_orders_created_by_role_length
    check (created_by_role is null or char_length(created_by_role) <= 80),

  constraint booking_orders_admin_notes_length
    check (admin_notes is null or char_length(admin_notes) <= 2000),

  constraint booking_orders_metadata_object
    check (jsonb_typeof(metadata) = 'object'),

  constraint booking_orders_realtime_version_positive
    check (realtime_version >= 1),

  constraint booking_orders_pending_payment_state_consistent
    check (
      status <> 'pending_payment'
      or
      (
        payment_status = 'pending'
        and paid_at is null
        and expired_at is null
        and cancelled_at is null
        and refunded_at is null
        and expires_at > created_at
      )
    ),

  constraint booking_orders_paid_state_consistent
    check (
      status <> 'paid'
      or
      (
        payment_status = 'paid'
        and paid_at is not null
        and expired_at is null
        and cancelled_at is null
      )
    ),

  constraint booking_orders_expired_state_consistent
    check (
      status <> 'expired'
      or
      (
        payment_status = 'expired'
        and expired_at is not null
        and paid_at is null
        and refunded_at is null
      )
    ),

  constraint booking_orders_cancelled_state_consistent
    check (
      status <> 'cancelled'
      or cancelled_at is not null
    ),

  constraint booking_orders_refunded_state_consistent
    check (
      status <> 'refunded'
      or
      (
        payment_status = 'refunded'
        and paid_at is not null
        and refunded_at is not null
      )
    )
);

alter table public.bookings
  add column if not exists booking_order_id uuid
    references public.booking_orders(id)
    on update cascade
    on delete restrict;

create table if not exists public.booking_order_items (
  id uuid primary key default gen_random_uuid(),

  booking_order_id uuid not null
    references public.booking_orders(id)
    on update cascade
    on delete cascade,

  booking_id uuid not null
    references public.bookings(id)
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

  price_amount numeric(12, 3) not null,
  currency text not null default 'KWD',

  status public.booking_order_item_status not null default 'pending_payment',

  created_at timestamptz not null default now(),

  constraint booking_order_items_price_amount_positive
    check (price_amount > 0),

  constraint booking_order_items_currency_format
    check (
      currency = upper(currency)
      and char_length(currency) = 3
    ),

  constraint booking_order_items_kwd_only
    check (currency = 'KWD')
);

alter table public.payments
  add column if not exists booking_order_id uuid
    references public.booking_orders(id)
    on update cascade
    on delete restrict;

alter table public.wallet_ledger_entries
  add column if not exists booking_order_id uuid
    references public.booking_orders(id)
    on update cascade
    on delete set null;

alter table public.booking_domain_events
  add column if not exists booking_order_id uuid
    references public.booking_orders(id)
    on update cascade
    on delete set null;

-- ---------------------------------------------------------------------------
-- Existing payment/wallet constraints updated for booking_order target
-- ---------------------------------------------------------------------------

alter table public.payments
  drop constraint if exists payments_target_reference_valid;

alter table public.payments
  add constraint payments_target_reference_valid
  check (
    (
      target_type::text = 'booking'
      and booking_id is not null
      and private_booking_id is null
      and booking_order_id is null
    )
    or
    (
      target_type::text = 'private_booking'
      and booking_id is null
      and private_booking_id is not null
      and booking_order_id is null
    )
    or
    (
      target_type::text = 'wallet_top_up'
      and booking_id is null
      and private_booking_id is null
      and booking_order_id is null
    )
    or
    (
      target_type::text = 'booking_order'
      and booking_id is null
      and private_booking_id is null
      and booking_order_id is not null
    )
  );

alter table public.wallet_ledger_entries
  drop constraint if exists wallet_ledger_entries_target_reference_valid;

alter table public.wallet_ledger_entries
  add constraint wallet_ledger_entries_target_reference_valid
  check (
    (
      entry_type in ('booking_payment', 'private_booking_payment')
      and payment_id is not null
    )
    or
    (
      entry_type not in ('booking_payment', 'private_booking_payment')
    )
  );

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create unique index if not exists booking_orders_customer_idempotency_key_uidx
  on public.booking_orders (customer_user_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists booking_orders_customer_user_id_idx
  on public.booking_orders (customer_user_id);

create index if not exists booking_orders_status_idx
  on public.booking_orders (status);

create index if not exists booking_orders_payment_status_idx
  on public.booking_orders (payment_status);

create index if not exists booking_orders_expires_at_idx
  on public.booking_orders (expires_at)
  where status = 'pending_payment';

create index if not exists booking_orders_created_by_user_id_idx
  on public.booking_orders (created_by_user_id)
  where created_by_user_id is not null;

create index if not exists booking_orders_created_by_admin_id_idx
  on public.booking_orders (created_by_admin_id)
  where created_by_admin_id is not null;

create index if not exists booking_orders_created_by_staff_profile_id_idx
  on public.booking_orders (created_by_staff_profile_id)
  where created_by_staff_profile_id is not null;

create unique index if not exists booking_order_items_booking_id_uidx
  on public.booking_order_items (booking_id);

create unique index if not exists booking_order_items_order_schedule_uidx
  on public.booking_order_items (booking_order_id, schedule_id);

create index if not exists booking_order_items_booking_order_id_idx
  on public.booking_order_items (booking_order_id);

create index if not exists booking_order_items_schedule_id_idx
  on public.booking_order_items (schedule_id);

create index if not exists booking_order_items_status_idx
  on public.booking_order_items (status);

create index if not exists bookings_booking_order_id_idx
  on public.bookings (booking_order_id)
  where booking_order_id is not null;

create index if not exists payments_booking_order_id_idx
  on public.payments (booking_order_id)
  where booking_order_id is not null;

create index if not exists wallet_ledger_entries_booking_order_id_idx
  on public.wallet_ledger_entries (booking_order_id)
  where booking_order_id is not null;

create index if not exists booking_domain_events_booking_order_id_idx
  on public.booking_domain_events (booking_order_id)
  where booking_order_id is not null;

-- ---------------------------------------------------------------------------
-- Triggers and RLS
-- ---------------------------------------------------------------------------

drop trigger if exists trg_booking_orders_set_updated_at on public.booking_orders;

create trigger trg_booking_orders_set_updated_at
before update on public.booking_orders
for each row
execute function public.set_lafam_booking_realtime_updated_at();

alter table public.booking_orders enable row level security;
alter table public.booking_order_items enable row level security;

-- ---------------------------------------------------------------------------
-- Atomic booking order creation
-- ---------------------------------------------------------------------------

create or replace function public.create_booking_order_atomic(
  p_customer_user_id uuid,
  p_schedule_ids uuid[],
  p_idempotency_key text default null::text,
  p_created_by_user_id uuid default null::uuid,
  p_created_by_admin_id uuid default null::uuid,
  p_created_by_staff_profile_id uuid default null::uuid,
  p_created_by_role text default 'customer'::text,
  p_source public.booking_source default 'customer_web'::public.booking_source,
  p_expires_at timestamptz default null::timestamptz,
  p_admin_notes text default null::text,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  action_result text,
  booking_order_id uuid,
  order_number text,
  status public.booking_order_status,
  payment_status public.booking_payment_status,
  total_amount numeric,
  currency text,
  expires_at timestamptz,
  booking_count integer,
  items jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.app_users%rowtype;
  v_existing_order public.booking_orders%rowtype;
  v_order public.booking_orders%rowtype;
  v_schedule_ids uuid[];
  v_requested_count integer;
  v_found_count integer;
  v_schedule_row record;
  v_new_booking public.bookings%rowtype;
  v_new_item public.booking_order_items%rowtype;
  v_booked_count integer;
  v_pending_hold_count integer;
  v_available_seats integer;
  v_price_amount numeric(12, 3);
  v_total_amount numeric(12, 3) := 0.000;
  v_currency text := 'KWD';
  v_now timestamptz := now();
  v_kwt_now timestamp := timezone('Asia/Kuwait', now());
  v_expires_at timestamptz;
  v_item_idempotency_key text;
  v_items jsonb;
  v_metadata jsonb;
begin
  if p_customer_user_id is null then
    raise exception 'Customer user id is required.'
      using errcode = 'P0001';
  end if;

  if p_schedule_ids is null or coalesce(cardinality(p_schedule_ids), 0) = 0 then
    raise exception 'At least one schedule id is required for bulk booking.'
      using errcode = 'P0001';
  end if;

  if cardinality(p_schedule_ids) > 20 then
    raise exception 'Bulk booking cannot include more than 20 schedules.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from unnest(p_schedule_ids) as requested(schedule_id)
    where requested.schedule_id is null
  ) then
    raise exception 'Bulk booking schedule ids cannot contain null values.'
      using errcode = 'P0001';
  end if;

  select array_agg(distinct requested.schedule_id order by requested.schedule_id)
  into v_schedule_ids
  from unnest(p_schedule_ids) as requested(schedule_id);

  v_requested_count := cardinality(p_schedule_ids);

  if cardinality(v_schedule_ids) <> v_requested_count then
    raise exception 'Bulk booking schedule ids must be unique.'
      using errcode = 'P0001';
  end if;

  v_metadata := coalesce(p_metadata, '{}'::jsonb);

  if jsonb_typeof(v_metadata) <> 'object' then
    raise exception 'Booking order metadata must be a JSON object.'
      using errcode = 'P0001';
  end if;

  v_expires_at := coalesce(p_expires_at, v_now + interval '15 minutes');

  if v_expires_at <= v_now then
    raise exception 'Booking order expiry must be in the future.'
      using errcode = 'P0001';
  end if;

  select *
  into v_customer
  from public.app_users
  where id = p_customer_user_id
  for update;

  if not found then
    raise exception 'Customer was not found.'
      using errcode = 'P0001';
  end if;

  if v_customer.is_guest = true then
    raise exception 'Guest users cannot create bookings.'
      using errcode = 'P0001';
  end if;

  if v_customer.role <> 'customer' then
    raise exception 'Bulk booking customer_user_id must belong to a customer account.'
      using errcode = 'P0001';
  end if;

  if v_customer.status <> 'active' then
    raise exception 'Only active customers can create bookings.'
      using errcode = 'P0001';
  end if;

  if nullif(trim(coalesce(p_idempotency_key, '')), '') is not null then
    select *
    into v_existing_order
    from public.booking_orders
    where customer_user_id = p_customer_user_id
      and idempotency_key = nullif(trim(coalesce(p_idempotency_key, '')), '')
    order by created_at desc
    limit 1;

    if found then
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', boi.id,
            'booking_id', boi.booking_id,
            'schedule_id', boi.schedule_id,
            'class_id', boi.class_id,
            'trainer_staff_profile_id', boi.trainer_staff_profile_id,
            'price_amount', boi.price_amount,
            'currency', boi.currency,
            'status', boi.status
          )
          order by boi.created_at asc
        ),
        '[]'::jsonb
      )
      into v_items
      from public.booking_order_items as boi
      where boi.booking_order_id = v_existing_order.id;

      return query
      select
        'existing_order'::text,
        v_existing_order.id,
        v_existing_order.order_number,
        v_existing_order.status,
        v_existing_order.payment_status,
        v_existing_order.total_amount,
        v_existing_order.currency,
        v_existing_order.expires_at,
        v_existing_order.booking_count,
        v_items;

      return;
    end if;
  end if;

  select count(*)::integer
  into v_found_count
  from public.pilates_class_schedules as schedules
  where schedules.id = any(v_schedule_ids);

  if v_found_count <> v_requested_count then
    raise exception 'One or more selected Pilates schedules were not found.'
      using errcode = 'P0001';
  end if;

  for v_schedule_row in
    select
      schedules.*,
      classes.status as class_status,
      classes.deleted_at as class_deleted_at,
      classes.default_price_amount as class_default_price_amount,
      classes.currency as class_currency
    from unnest(v_schedule_ids) with ordinality as requested(schedule_id, requested_order)
    join public.pilates_class_schedules as schedules
      on schedules.id = requested.schedule_id
    join public.pilates_classes as classes
      on classes.id = schedules.class_id
    order by requested.requested_order asc
    for update of schedules, classes
  loop
    if v_schedule_row.deleted_at is not null or v_schedule_row.status <> 'scheduled' then
      raise exception 'One or more selected schedules are not bookable.'
        using errcode = 'P0001';
    end if;

    if v_schedule_row.class_deleted_at is not null or v_schedule_row.class_status <> 'active' then
      raise exception 'One or more selected schedules belong to an inactive Pilates class.'
        using errcode = 'P0001';
    end if;

    if
      v_schedule_row.class_date < v_kwt_now::date
      or
      (
        v_schedule_row.class_date = v_kwt_now::date
        and v_schedule_row.start_time <= v_kwt_now::time
      )
    then
      raise exception 'Cannot bulk book a past Pilates schedule.'
        using errcode = 'P0001';
    end if;

    if exists (
      select 1
      from public.bookings as existing_bookings
      where existing_bookings.user_id = p_customer_user_id
        and existing_bookings.schedule_id = v_schedule_row.id
        and existing_bookings.status in ('pending_payment', 'confirmed')
        and existing_bookings.deleted_at is null
    ) then
      raise exception 'Customer already has an active booking for one or more selected schedules.'
        using errcode = 'P0001';
    end if;

    select count(*)::integer
    into v_booked_count
    from public.bookings as confirmed_bookings
    where confirmed_bookings.schedule_id = v_schedule_row.id
      and confirmed_bookings.status = 'confirmed'
      and confirmed_bookings.deleted_at is null;

    select count(*)::integer
    into v_pending_hold_count
    from public.bookings as pending_bookings
    where pending_bookings.schedule_id = v_schedule_row.id
      and pending_bookings.status = 'pending_payment'
      and pending_bookings.payment_status = 'pending'
      and pending_bookings.deleted_at is null
      and pending_bookings.seat_hold_expires_at > v_now;

    v_available_seats := greatest(
      v_schedule_row.capacity - v_booked_count - v_pending_hold_count,
      0
    );

    if v_available_seats <= 0 then
      raise exception 'Bulk booking only supports schedules with available seats.'
        using errcode = 'P0001';
    end if;

    v_price_amount := coalesce(
      v_schedule_row.price_amount,
      v_schedule_row.class_default_price_amount
    );

    if v_price_amount is null or v_price_amount <= 0 then
      raise exception 'One or more selected schedules do not have a valid payable price.'
        using errcode = 'P0001';
    end if;

    if upper(coalesce(v_schedule_row.currency, v_schedule_row.class_currency, 'KWD')) <> 'KWD' then
      raise exception 'Bulk booking currently supports KWD schedules only.'
        using errcode = 'P0001';
    end if;

    v_total_amount := v_total_amount + v_price_amount;
  end loop;

  if v_total_amount <= 0 then
    raise exception 'Booking order total amount must be greater than zero.'
      using errcode = 'P0001';
  end if;

  insert into public.booking_orders (
    customer_user_id,
    status,
    payment_status,
    payment_required,
    total_amount,
    currency,
    booking_count,
    idempotency_key,
    created_by_user_id,
    created_by_admin_id,
    created_by_staff_profile_id,
    created_by_role,
    admin_notes,
    metadata,
    expires_at
  )
  values (
    p_customer_user_id,
    'pending_payment',
    'pending',
    true,
    v_total_amount,
    v_currency,
    v_requested_count,
    nullif(trim(coalesce(p_idempotency_key, '')), ''),
    p_created_by_user_id,
    p_created_by_admin_id,
    p_created_by_staff_profile_id,
    nullif(trim(coalesce(p_created_by_role, '')), ''),
    nullif(trim(coalesce(p_admin_notes, '')), ''),
    v_metadata,
    v_expires_at
  )
  returning *
  into v_order;

  for v_schedule_row in
    select
      schedules.*,
      classes.default_price_amount as class_default_price_amount,
      classes.currency as class_currency
    from unnest(v_schedule_ids) with ordinality as requested(schedule_id, requested_order)
    join public.pilates_class_schedules as schedules
      on schedules.id = requested.schedule_id
    join public.pilates_classes as classes
      on classes.id = schedules.class_id
    order by requested.requested_order asc
  loop
    v_price_amount := coalesce(
      v_schedule_row.price_amount,
      v_schedule_row.class_default_price_amount
    );

    v_item_idempotency_key :=
      case
        when nullif(trim(coalesce(p_idempotency_key, '')), '') is null then null
        else left(
          nullif(trim(coalesce(p_idempotency_key, '')), '') ||
          ':' ||
          v_schedule_row.id::text,
          160
        )
      end;

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
      booking_order_id,
      seat_hold_expires_at,
      confirmed_at,
      created_by_user_id,
      created_by_admin_id,
      admin_notes
    )
    values (
      public.build_lafam_booking_number(),
      p_customer_user_id,
      v_schedule_row.id,
      v_schedule_row.class_id,
      v_schedule_row.trainer_staff_profile_id,
      'pending_payment',
      coalesce(p_source, 'customer_web'::public.booking_source),
      'pending',
      true,
      v_item_idempotency_key,
      v_order.id,
      v_order.expires_at,
      null,
      p_created_by_user_id,
      p_created_by_admin_id,
      nullif(trim(coalesce(p_admin_notes, '')), '')
    )
    returning *
    into v_new_booking;

    insert into public.booking_order_items (
      booking_order_id,
      booking_id,
      schedule_id,
      class_id,
      trainer_staff_profile_id,
      price_amount,
      currency,
      status
    )
    values (
      v_order.id,
      v_new_booking.id,
      v_schedule_row.id,
      v_schedule_row.class_id,
      v_schedule_row.trainer_staff_profile_id,
      v_price_amount,
      'KWD',
      'pending_payment'
    )
    returning *
    into v_new_item;

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
      case when p_created_by_admin_id is null then p_created_by_user_id else null end,
      p_created_by_admin_id,
      coalesce(nullif(trim(coalesce(p_created_by_role, '')), ''), 'customer'),
      'booking_created',
      null,
      'pending_payment',
      'Booking created as part of a bulk booking order.',
      jsonb_build_object(
        'booking_order_id', v_order.id,
        'schedule_id', v_schedule_row.id,
        'class_id', v_schedule_row.class_id,
        'payment_required', true
      )
    );

    update public.pilates_class_schedules as schedules
    set
      updated_at = now(),
      realtime_version = schedules.realtime_version + 1
    where schedules.id = v_schedule_row.id;

    insert into public.booking_domain_events (
      event_type,
      schedule_id,
      booking_id,
      booking_order_id,
      payload
    )
    values (
      'booking_order.item_created',
      v_schedule_row.id,
      v_new_booking.id,
      v_order.id,
      jsonb_build_object(
        'booking_order_id', v_order.id,
        'booking_id', v_new_booking.id,
        'schedule_id', v_schedule_row.id,
        'status', v_new_booking.status,
        'payment_status', v_new_booking.payment_status
      )
    );
  end loop;

  insert into public.booking_domain_events (
    event_type,
    booking_order_id,
    payload
  )
  values (
    'booking_order.created',
    v_order.id,
    jsonb_build_object(
      'booking_order_id', v_order.id,
      'order_number', v_order.order_number,
      'customer_user_id', v_order.customer_user_id,
      'booking_count', v_order.booking_count,
      'total_amount', v_order.total_amount,
      'currency', v_order.currency
    )
  );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', boi.id,
        'booking_id', boi.booking_id,
        'schedule_id', boi.schedule_id,
        'class_id', boi.class_id,
        'trainer_staff_profile_id', boi.trainer_staff_profile_id,
        'price_amount', boi.price_amount,
        'currency', boi.currency,
        'status', boi.status
      )
      order by boi.created_at asc
    ),
    '[]'::jsonb
  )
  into v_items
  from public.booking_order_items as boi
  where boi.booking_order_id = v_order.id;

  return query
  select
    'created_order'::text,
    v_order.id,
    v_order.order_number,
    v_order.status,
    v_order.payment_status,
    v_order.total_amount,
    v_order.currency,
    v_order.expires_at,
    v_order.booking_count,
    v_items;
end;
$$;

-- ---------------------------------------------------------------------------
-- Atomic booking order confirmation
-- ---------------------------------------------------------------------------

create or replace function public.confirm_booking_order_paid_atomic(
  p_booking_order_id uuid,
  p_payment_id uuid default null::uuid
)
returns table (
  booking_order_id uuid,
  status public.booking_order_status,
  payment_status public.booking_payment_status,
  confirmed_booking_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.booking_orders%rowtype;
  v_booking public.bookings%rowtype;
  v_confirmed_count integer := 0;
begin
  if p_booking_order_id is null then
    raise exception 'Booking order id is required.'
      using errcode = 'P0001';
  end if;

  select *
  into v_order
  from public.booking_orders
  where id = p_booking_order_id
  for update;

  if not found then
    raise exception 'Booking order was not found.'
      using errcode = 'P0001';
  end if;

  if v_order.status = 'paid' and v_order.payment_status = 'paid' then
    select count(*)::integer
    into v_confirmed_count
    from public.bookings as existing_bookings
    where existing_bookings.booking_order_id = v_order.id
      and existing_bookings.status = 'confirmed'
      and existing_bookings.payment_status = 'paid'
      and existing_bookings.deleted_at is null;

    return query
    select
      v_order.id,
      v_order.status,
      v_order.payment_status,
      v_confirmed_count;

    return;
  end if;

  if v_order.status <> 'pending_payment' or v_order.payment_status <> 'pending' then
    raise exception 'Booking order is not pending payment.'
      using errcode = 'P0001';
  end if;

  update public.booking_orders as orders
  set
    status = 'paid',
    payment_status = 'paid',
    paid_at = coalesce(orders.paid_at, now()),
    expired_at = null,
    cancelled_at = null
  where orders.id = v_order.id
  returning orders.*
  into v_order;

  for v_booking in
    update public.bookings as bookings_to_confirm
    set
      status = 'confirmed',
      payment_status = 'paid',
      seat_hold_expires_at = null,
      confirmed_at = coalesce(bookings_to_confirm.confirmed_at, now())
    where bookings_to_confirm.booking_order_id = v_order.id
      and bookings_to_confirm.status = 'pending_payment'
      and bookings_to_confirm.payment_status = 'pending'
      and bookings_to_confirm.deleted_at is null
    returning bookings_to_confirm.*
  loop
    v_confirmed_count := v_confirmed_count + 1;

    update public.booking_order_items as items
    set status = 'confirmed'
    where items.booking_order_id = v_order.id
      and items.booking_id = v_booking.id;

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
      'booking_confirmed',
      'pending_payment',
      'confirmed',
      'Booking order payment completed and booking confirmed.',
      jsonb_build_object(
        'booking_order_id', v_order.id,
        'payment_id', p_payment_id
      )
    );

    update public.pilates_class_schedules as schedules
    set
      updated_at = now(),
      realtime_version = schedules.realtime_version + 1
    where schedules.id = v_booking.schedule_id;

    insert into public.booking_domain_events (
      event_type,
      schedule_id,
      booking_id,
      booking_order_id,
      payment_id,
      payload
    )
    values (
      'booking_order.item_confirmed',
      v_booking.schedule_id,
      v_booking.id,
      v_order.id,
      p_payment_id,
      jsonb_build_object(
        'booking_order_id', v_order.id,
        'booking_id', v_booking.id,
        'payment_id', p_payment_id
      )
    );
  end loop;

  insert into public.booking_domain_events (
    event_type,
    booking_order_id,
    payment_id,
    payload
  )
  values (
    'booking_order.paid',
    v_order.id,
    p_payment_id,
    jsonb_build_object(
      'booking_order_id', v_order.id,
      'payment_id', p_payment_id,
      'confirmed_booking_count', v_confirmed_count
    )
  );

  return query
  select
    v_order.id,
    v_order.status,
    v_order.payment_status,
    v_confirmed_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Atomic booking order expiry
-- ---------------------------------------------------------------------------

create or replace function public.expire_booking_order_atomic(
  p_booking_order_id uuid default null::uuid,
  p_payment_id uuid default null::uuid,
  p_reason text default 'Booking order payment expired.'::text
)
returns table (
  booking_order_id uuid,
  status public.booking_order_status,
  payment_status public.booking_payment_status,
  expired_booking_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.booking_orders%rowtype;
  v_payment public.payments%rowtype;
  v_booking public.bookings%rowtype;
  v_expired_count integer := 0;
begin
  if p_booking_order_id is null and p_payment_id is null then
    raise exception 'Booking order id or payment id is required.'
      using errcode = 'P0001';
  end if;

  if p_booking_order_id is null then
    select *
    into v_payment
    from public.payments
    where id = p_payment_id
    for update;

    if not found then
      raise exception 'Payment was not found for booking order expiry.'
        using errcode = 'P0001';
    end if;

    p_booking_order_id := v_payment.booking_order_id;
  end if;

  if p_booking_order_id is null then
    raise exception 'Payment is not linked to a booking order.'
      using errcode = 'P0001';
  end if;

  select *
  into v_order
  from public.booking_orders
  where id = p_booking_order_id
  for update;

  if not found then
    raise exception 'Booking order was not found.'
      using errcode = 'P0001';
  end if;

  if v_order.status = 'expired' and v_order.payment_status = 'expired' then
    select count(*)::integer
    into v_expired_count
    from public.bookings as existing_bookings
    where existing_bookings.booking_order_id = v_order.id
      and existing_bookings.status = 'expired'
      and existing_bookings.payment_status = 'expired'
      and existing_bookings.deleted_at is null;

    return query
    select
      v_order.id,
      v_order.status,
      v_order.payment_status,
      v_expired_count;

    return;
  end if;

  if v_order.status <> 'pending_payment' or v_order.payment_status <> 'pending' then
    raise exception 'Only pending booking orders can be expired.'
      using errcode = 'P0001';
  end if;

  update public.booking_orders as orders
  set
    status = 'expired',
    payment_status = 'expired',
    expired_at = now()
  where orders.id = v_order.id
  returning orders.*
  into v_order;

  for v_booking in
    update public.bookings as bookings_to_expire
    set
      status = 'expired',
      payment_status = 'expired',
      seat_hold_expires_at = null
    where bookings_to_expire.booking_order_id = v_order.id
      and bookings_to_expire.status = 'pending_payment'
      and bookings_to_expire.payment_status = 'pending'
      and bookings_to_expire.deleted_at is null
    returning bookings_to_expire.*
  loop
    v_expired_count := v_expired_count + 1;

    update public.booking_order_items as items
    set status = 'expired'
    where items.booking_order_id = v_order.id
      and items.booking_id = v_booking.id;

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
      p_reason,
      jsonb_build_object(
        'booking_order_id', v_order.id,
        'payment_id', p_payment_id
      )
    );

    update public.pilates_class_schedules as schedules
    set
      updated_at = now(),
      realtime_version = schedules.realtime_version + 1
    where schedules.id = v_booking.schedule_id;

    insert into public.booking_domain_events (
      event_type,
      schedule_id,
      booking_id,
      booking_order_id,
      payment_id,
      payload
    )
    values (
      'booking_order.item_expired',
      v_booking.schedule_id,
      v_booking.id,
      v_order.id,
      p_payment_id,
      jsonb_build_object(
        'booking_order_id', v_order.id,
        'booking_id', v_booking.id,
        'payment_id', p_payment_id
      )
    );
  end loop;

  insert into public.booking_domain_events (
    event_type,
    booking_order_id,
    payment_id,
    payload
  )
  values (
    'booking_order.expired',
    v_order.id,
    p_payment_id,
    jsonb_build_object(
      'booking_order_id', v_order.id,
      'payment_id', p_payment_id,
      'expired_booking_count', v_expired_count
    )
  );

  return query
  select
    v_order.id,
    v_order.status,
    v_order.payment_status,
    v_expired_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Payment intent RPC with booking_order target support
-- ---------------------------------------------------------------------------

drop function if exists public.create_payment_intent_atomic(
  uuid,
  public.payment_target_type,
  uuid,
  uuid,
  numeric,
  numeric,
  numeric,
  text,
  public.payment_method,
  public.payment_provider,
  public.payment_status,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  jsonb
);

create or replace function public.create_payment_intent_atomic(
  p_user_id uuid,
  p_target_type public.payment_target_type,
  p_booking_id uuid,
  p_private_booking_id uuid,
  p_amount numeric,
  p_discount_amount numeric,
  p_final_amount numeric,
  p_currency text,
  p_payment_method public.payment_method,
  p_payment_provider public.payment_provider,
  p_status public.payment_status default 'pending'::public.payment_status,
  p_idempotency_key text default null::text,
  p_redirect_url text default null::text,
  p_callback_url text default null::text,
  p_gateway_reference text default null::text,
  p_gateway_payment_id text default null::text,
  p_gateway_invoice_id text default null::text,
  p_expires_at timestamptz default null::timestamptz,
  p_metadata jsonb default '{}'::jsonb,
  p_booking_order_id uuid default null::uuid
)
returns table (
  payment_id uuid,
  payment_number text,
  target_type public.payment_target_type,
  booking_id uuid,
  private_booking_id uuid,
  booking_order_id uuid,
  status public.payment_status,
  payment_method public.payment_method,
  payment_provider public.payment_provider,
  final_amount numeric,
  currency text,
  redirect_url text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_payment public.payments%rowtype;
  v_payment public.payments%rowtype;
  v_booking public.bookings%rowtype;
  v_private_booking public.private_trainer_bookings%rowtype;
  v_booking_order public.booking_orders%rowtype;
  v_status public.payment_status;
  v_currency text;
  v_metadata jsonb;
begin
  if p_user_id is null then
    raise exception 'Payment user_id is required.';
  end if;

  if p_amount is null or p_amount < 0 then
    raise exception 'Payment amount must be greater than or equal to zero.';
  end if;

  if p_discount_amount is null or p_discount_amount < 0 then
    raise exception 'Payment discount amount must be greater than or equal to zero.';
  end if;

  if p_final_amount is null or p_final_amount < 0 then
    raise exception 'Payment final amount must be greater than or equal to zero.';
  end if;

  if p_final_amount <> (p_amount - p_discount_amount) then
    raise exception 'Payment final amount must equal amount minus discount amount.';
  end if;

  v_status := coalesce(p_status, 'pending'::public.payment_status);

  if v_status not in (
    'pending'::public.payment_status,
    'requires_redirect'::public.payment_status
  ) then
    raise exception 'Payment intent can only be created as pending or requires_redirect.';
  end if;

  v_currency := upper(trim(coalesce(p_currency, 'KWD')));

  if char_length(v_currency) <> 3 then
    raise exception 'Payment currency must be a 3-letter uppercase currency code.';
  end if;

  if p_payment_method = 'knet' and v_currency <> 'KWD' then
    raise exception 'KNET payments only support KWD.';
  end if;

  if p_payment_method = 'wallet' and p_payment_provider <> 'wallet' then
    raise exception 'Wallet payments must use wallet provider.';
  end if;

  if p_payment_method <> 'wallet' and p_payment_provider = 'wallet' then
    raise exception 'External payments cannot use wallet provider.';
  end if;

  if p_payment_method = 'wallet' and v_status <> 'pending' then
    raise exception 'Wallet payment intents must be created as pending.';
  end if;

  if p_target_type::text = 'wallet_top_up' and p_payment_method = 'wallet' then
    raise exception 'Wallet top-up cannot be paid by wallet.';
  end if;

  if v_status = 'requires_redirect'
    and p_payment_method in ('knet', 'card')
    and nullif(trim(coalesce(p_redirect_url, '')), '') is null then
    raise exception 'Hosted payment redirect URL is required when creating a requires_redirect payment intent.';
  end if;

  v_metadata := coalesce(p_metadata, '{}'::jsonb);

  if jsonb_typeof(v_metadata) <> 'object' then
    raise exception 'Payment metadata must be a JSON object.';
  end if;

  if p_idempotency_key is not null then
    select *
    into v_existing_payment
    from public.payments
    where user_id = p_user_id
      and idempotency_key = p_idempotency_key
    limit 1;

    if found then
      return query
      select
        v_existing_payment.id,
        v_existing_payment.payment_number,
        v_existing_payment.target_type,
        v_existing_payment.booking_id,
        v_existing_payment.private_booking_id,
        v_existing_payment.booking_order_id,
        v_existing_payment.status,
        v_existing_payment.payment_method,
        v_existing_payment.payment_provider,
        v_existing_payment.final_amount,
        v_existing_payment.currency,
        v_existing_payment.redirect_url,
        v_existing_payment.expires_at;
      return;
    end if;
  end if;

  if p_target_type::text = 'booking' then
    if p_booking_id is null or p_private_booking_id is not null or p_booking_order_id is not null then
      raise exception 'Booking payment target requires booking_id only.';
    end if;

    select *
    into v_booking
    from public.bookings
    where id = p_booking_id
      and deleted_at is null
    for update;

    if not found then
      raise exception 'Booking was not found.';
    end if;

    if v_booking.user_id <> p_user_id then
      raise exception 'Booking does not belong to the payment user.';
    end if;

    if v_booking.status <> 'pending_payment' then
      raise exception 'Booking is not pending payment.';
    end if;

    if v_booking.payment_required is false or v_booking.payment_status <> 'pending' then
      raise exception 'Booking is not payable.';
    end if;

  elsif p_target_type::text = 'private_booking' then
    if p_private_booking_id is null or p_booking_id is not null or p_booking_order_id is not null then
      raise exception 'Private booking payment target requires private_booking_id only.';
    end if;

    select *
    into v_private_booking
    from public.private_trainer_bookings
    where id = p_private_booking_id
      and deleted_at is null
    for update;

    if not found then
      raise exception 'Private trainer booking was not found.';
    end if;

    if v_private_booking.user_id <> p_user_id then
      raise exception 'Private trainer booking does not belong to the payment user.';
    end if;

    if v_private_booking.status <> 'pending_payment' then
      raise exception 'Private trainer booking is not pending payment.';
    end if;

    if v_private_booking.payment_required is false or v_private_booking.payment_status <> 'pending' then
      raise exception 'Private trainer booking is not payable.';
    end if;

  elsif p_target_type::text = 'booking_order' then
    if p_booking_order_id is null or p_booking_id is not null or p_private_booking_id is not null then
      raise exception 'Booking order payment target requires booking_order_id only.';
    end if;

    select *
    into v_booking_order
    from public.booking_orders
    where id = p_booking_order_id
    for update;

    if not found then
      raise exception 'Booking order was not found.';
    end if;

    if v_booking_order.customer_user_id <> p_user_id then
      raise exception 'Booking order does not belong to the payment user.';
    end if;

    if v_booking_order.status <> 'pending_payment' or v_booking_order.payment_status <> 'pending' then
      raise exception 'Booking order is not pending payment.';
    end if;

    if v_booking_order.payment_required is false then
      raise exception 'Booking order is not payable.';
    end if;

    if v_booking_order.expires_at <= now() then
      raise exception 'Booking order has expired.';
    end if;

    if v_booking_order.total_amount <> p_final_amount then
      raise exception 'Booking order payment amount does not match the order total.';
    end if;

    if v_booking_order.currency <> v_currency then
      raise exception 'Booking order payment currency does not match the order currency.';
    end if;

  elsif p_target_type::text = 'wallet_top_up' then
    if p_booking_id is not null or p_private_booking_id is not null or p_booking_order_id is not null then
      raise exception 'Wallet top-up payment target cannot reference bookings.';
    end if;

    if p_final_amount <= 0 then
      raise exception 'Wallet top-up amount must be greater than zero.';
    end if;

  else
    raise exception 'Unsupported payment target type.';
  end if;

  insert into public.payments (
    user_id,
    target_type,
    booking_id,
    private_booking_id,
    booking_order_id,
    amount,
    discount_amount,
    final_amount,
    currency,
    payment_method,
    payment_provider,
    status,
    gateway_reference,
    gateway_payment_id,
    gateway_invoice_id,
    redirect_url,
    callback_url,
    expires_at,
    idempotency_key,
    metadata
  )
  values (
    p_user_id,
    p_target_type,
    p_booking_id,
    p_private_booking_id,
    p_booking_order_id,
    p_amount,
    p_discount_amount,
    p_final_amount,
    v_currency,
    p_payment_method,
    p_payment_provider,
    v_status,
    nullif(trim(coalesce(p_gateway_reference, '')), ''),
    nullif(trim(coalesce(p_gateway_payment_id, '')), ''),
    nullif(trim(coalesce(p_gateway_invoice_id, '')), ''),
    nullif(trim(coalesce(p_redirect_url, '')), ''),
    nullif(trim(coalesce(p_callback_url, '')), ''),
    coalesce(p_expires_at, now() + interval '15 minutes'),
    nullif(trim(coalesce(p_idempotency_key, '')), ''),
    v_metadata
  )
  returning *
  into v_payment;

  insert into public.payment_transactions (
    payment_id,
    transaction_type,
    transaction_status,
    provider,
    provider_reference,
    gateway_response,
    metadata,
    processed_at
  )
  values (
    v_payment.id,
    'intent_created',
    'succeeded',
    v_payment.payment_provider,
    v_payment.gateway_reference,
    jsonb_build_object(
      'payment_id', v_payment.id,
      'status', v_payment.status,
      'method', v_payment.payment_method,
      'provider', v_payment.payment_provider,
      'booking_order_id', v_payment.booking_order_id
    ),
    v_metadata,
    now()
  );

  return query
  select
    v_payment.id,
    v_payment.payment_number,
    v_payment.target_type,
    v_payment.booking_id,
    v_payment.private_booking_id,
    v_payment.booking_order_id,
    v_payment.status,
    v_payment.payment_method,
    v_payment.payment_provider,
    v_payment.final_amount,
    v_payment.currency,
    v_payment.redirect_url,
    v_payment.expires_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- Wallet debit for booking order
-- ---------------------------------------------------------------------------

create or replace function public.debit_wallet_for_booking_order_atomic(
  p_payment_id uuid,
  p_description text default null::text,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  payment_id uuid,
  wallet_account_id uuid,
  ledger_entry_id uuid,
  available_balance numeric,
  booking_order_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.booking_orders%rowtype;
  v_wallet public.wallet_accounts%rowtype;
  v_ledger public.wallet_ledger_entries%rowtype;
  v_confirm_result record;
  v_metadata jsonb;
begin
  if p_payment_id is null then
    raise exception 'Payment id is required.';
  end if;

  v_metadata := coalesce(p_metadata, '{}'::jsonb);

  if jsonb_typeof(v_metadata) <> 'object' then
    raise exception 'Wallet booking order debit metadata must be a JSON object.';
  end if;

  select *
  into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment was not found.';
  end if;

  if v_payment.payment_method <> 'wallet' or v_payment.payment_provider <> 'wallet' then
    raise exception 'Payment is not a wallet payment.';
  end if;

  if v_payment.target_type::text <> 'booking_order' then
    raise exception 'Wallet booking order debit requires a booking_order payment target.';
  end if;

  if v_payment.booking_order_id is null then
    raise exception 'Booking order wallet payment is missing booking_order_id.';
  end if;

  if v_payment.status = 'paid' then
    select *
    into v_ledger
    from public.wallet_ledger_entries
    where payment_id = v_payment.id
      and booking_order_id = v_payment.booking_order_id
      and entry_type = 'booking_payment'
      and entry_status = 'posted'
    limit 1;

    if not found then
      raise exception 'Wallet booking order payment is marked paid but posted debit ledger entry was not found.';
    end if;

    select *
    into v_wallet
    from public.wallet_accounts
    where id = v_ledger.wallet_account_id;

    if not found then
      raise exception 'Wallet account was not found for posted debit ledger entry.';
    end if;

    return query
    select
      v_payment.id,
      v_wallet.id,
      v_ledger.id,
      v_wallet.available_balance,
      v_payment.booking_order_id;

    return;
  end if;

  if v_payment.status <> 'pending' then
    raise exception 'Wallet booking order payment is not pending.';
  end if;

  select *
  into v_order
  from public.booking_orders
  where id = v_payment.booking_order_id
  for update;

  if not found then
    raise exception 'Booking order was not found.';
  end if;

  if v_order.customer_user_id <> v_payment.user_id then
    raise exception 'Booking order does not belong to the payment user.';
  end if;

  if v_order.status <> 'pending_payment' or v_order.payment_status <> 'pending' then
    raise exception 'Booking order is not pending payment.';
  end if;

  if v_order.total_amount <> v_payment.final_amount then
    raise exception 'Wallet payment amount does not match booking order total.';
  end if;

  insert into public.wallet_accounts (
    user_id,
    currency,
    available_balance,
    pending_balance,
    status
  )
  values (
    v_payment.user_id,
    v_payment.currency,
    0.000,
    0.000,
    'active'
  )
  on conflict (user_id, currency)
  do nothing;

  select *
  into v_wallet
  from public.wallet_accounts
  where user_id = v_payment.user_id
    and currency = v_payment.currency
  for update;

  if not found then
    raise exception 'Wallet account was not found.';
  end if;

  if v_wallet.status <> 'active' then
    raise exception 'Wallet account is not active.';
  end if;

  if v_wallet.available_balance < v_payment.final_amount then
    raise exception 'Insufficient wallet balance.';
  end if;

  insert into public.wallet_ledger_entries (
    wallet_account_id,
    user_id,
    payment_id,
    booking_order_id,
    entry_type,
    entry_status,
    amount,
    balance_before,
    balance_after,
    description,
    metadata
  )
  values (
    v_wallet.id,
    v_payment.user_id,
    v_payment.id,
    v_order.id,
    'booking_payment',
    'posted',
    v_payment.final_amount,
    v_wallet.available_balance,
    v_wallet.available_balance - v_payment.final_amount,
    coalesce(p_description, 'Wallet payment completed for booking order.'),
    v_metadata || jsonb_build_object(
      'booking_order_id', v_order.id,
      'payment_id', v_payment.id
    )
  )
  returning *
  into v_ledger;

  update public.wallet_accounts as wallets
  set available_balance = v_wallet.available_balance - v_payment.final_amount
  where wallets.id = v_wallet.id
  returning wallets.*
  into v_wallet;

  update public.payments as payments
  set
    status = 'paid',
    receipt_number = coalesce(
      v_payment.receipt_number,
      public.build_lafam_receipt_number()
    ),
    paid_at = now()
  where payments.id = v_payment.id
  returning payments.*
  into v_payment;

  insert into public.payment_transactions (
    payment_id,
    transaction_type,
    transaction_status,
    provider,
    provider_reference,
    gateway_response,
    processed_at
  )
  values (
    v_payment.id,
    'wallet_debit',
    'succeeded',
    'wallet',
    v_ledger.id::text,
    jsonb_build_object(
      'wallet_account_id', v_wallet.id,
      'ledger_entry_id', v_ledger.id,
      'booking_order_id', v_order.id,
      'available_balance', v_wallet.available_balance
    ),
    now()
  );

  select *
  into v_confirm_result
  from public.confirm_booking_order_paid_atomic(v_order.id, v_payment.id);

  return query
  select
    v_payment.id,
    v_wallet.id,
    v_ledger.id,
    v_wallet.available_balance,
    v_order.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Paid payment settlement extended for booking_order target
-- ---------------------------------------------------------------------------

create or replace function public.mark_payment_paid_atomic(
  p_payment_id uuid,
  p_provider_reference text default null::text,
  p_gateway_payment_id text default null::text,
  p_gateway_invoice_id text default null::text,
  p_gateway_response jsonb default '{}'::jsonb,
  p_webhook_verified boolean default false,
  p_next_status public.payment_status default 'paid'::public.payment_status
)
returns table (
  payment_id uuid,
  payment_number text,
  target_type public.payment_target_type,
  booking_id uuid,
  private_booking_id uuid,
  status public.payment_status,
  receipt_number text,
  paid_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_booking public.bookings%rowtype;
  v_private_booking public.private_trainer_bookings%rowtype;
  v_schedule public.pilates_class_schedules%rowtype;
  v_wallet_result record;
  v_order_result record;
  v_gateway_response jsonb;
  v_provider_reference text;
  v_gateway_payment_id text;
  v_gateway_invoice_id text;
begin
  if p_payment_id is null then
    raise exception 'Payment id is required.';
  end if;

  if coalesce(p_next_status, 'paid'::public.payment_status) <> 'paid'::public.payment_status then
    raise exception 'mark_payment_paid_atomic only supports paid next status.';
  end if;

  v_gateway_response := coalesce(p_gateway_response, '{}'::jsonb);

  if jsonb_typeof(v_gateway_response) <> 'object' then
    raise exception 'Gateway response must be a JSON object.';
  end if;

  v_provider_reference := nullif(trim(coalesce(p_provider_reference, '')), '');
  v_gateway_payment_id := nullif(trim(coalesce(p_gateway_payment_id, '')), '');
  v_gateway_invoice_id := nullif(trim(coalesce(p_gateway_invoice_id, '')), '');

  select *
  into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment was not found.';
  end if;

  if v_payment.status = 'paid' then
    return query
    select
      v_payment.id,
      v_payment.payment_number,
      v_payment.target_type,
      v_payment.booking_id,
      v_payment.private_booking_id,
      v_payment.status,
      v_payment.receipt_number,
      v_payment.paid_at;
    return;
  end if;

  if v_payment.status in ('refunded', 'refund_processing', 'refund_requested') then
    raise exception 'Payment refund state cannot be marked as paid.';
  end if;

  if v_payment.status in ('failed', 'cancelled', 'expired') then
    raise exception 'Terminal failed, cancelled, or expired payment cannot be marked as paid.';
  end if;

  update public.payments as payments
  set
    status = 'paid',
    receipt_number = coalesce(v_payment.receipt_number, public.build_lafam_receipt_number()),
    gateway_reference = coalesce(v_provider_reference, payments.gateway_reference),
    gateway_payment_id = coalesce(v_gateway_payment_id, payments.gateway_payment_id),
    gateway_invoice_id = coalesce(v_gateway_invoice_id, payments.gateway_invoice_id),
    webhook_verified_at = case
      when p_webhook_verified then now()
      else payments.webhook_verified_at
    end,
    paid_at = now(),
    failed_at = null,
    cancelled_at = null,
    expired_at = null
  where payments.id = v_payment.id
  returning payments.*
  into v_payment;

  insert into public.payment_transactions (
    payment_id,
    transaction_type,
    transaction_status,
    provider,
    provider_reference,
    gateway_response,
    processed_at
  )
  values (
    v_payment.id,
    'verification',
    'succeeded',
    v_payment.payment_provider,
    v_payment.gateway_reference,
    v_gateway_response,
    now()
  );

  if v_payment.target_type::text = 'booking' then
    if v_payment.booking_id is null then
      raise exception 'Booking payment is missing booking id.';
    end if;

    select *
    into v_booking
    from public.bookings
    where id = v_payment.booking_id
    for update;

    if not found then
      raise exception 'Booking was not found for paid payment.';
    end if;

    if v_booking.status = 'pending_payment' and v_booking.payment_status = 'pending' then
      update public.bookings
      set
        status = 'confirmed',
        payment_status = 'paid',
        seat_hold_expires_at = null,
        confirmed_at = coalesce(confirmed_at, now())
      where id = v_booking.id
      returning *
      into v_booking;

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
        'booking_confirmed',
        'pending_payment',
        'confirmed',
        'Payment completed and booking confirmed.',
        jsonb_build_object(
          'payment_id', v_payment.id,
          'payment_number', v_payment.payment_number,
          'receipt_number', v_payment.receipt_number
        )
      );

      select *
      into v_schedule
      from public.pilates_class_schedules
      where id = v_booking.schedule_id
      for update;

      if found then
        update public.pilates_class_schedules
        set
          updated_at = now(),
          realtime_version = realtime_version + 1
        where id = v_schedule.id;
      end if;

      insert into public.booking_domain_events (
        event_type,
        schedule_id,
        booking_id,
        payment_id,
        payload
      )
      values (
        'booking.payment_confirmed',
        v_booking.schedule_id,
        v_booking.id,
        v_payment.id,
        jsonb_build_object(
          'booking_id', v_booking.id,
          'payment_id', v_payment.id,
          'payment_number', v_payment.payment_number,
          'receipt_number', v_payment.receipt_number
        )
      );
    elsif v_booking.status = 'confirmed' then
      update public.bookings
      set payment_status = 'paid'
      where id = v_booking.id
        and payment_status <> 'paid'
      returning *
      into v_booking;
    else
      raise exception 'Booking is not payable in its current state.';
    end if;

  elsif v_payment.target_type::text = 'private_booking' then
    if v_payment.private_booking_id is null then
      raise exception 'Private booking payment is missing private booking id.';
    end if;

    select *
    into v_private_booking
    from public.private_trainer_bookings
    where id = v_payment.private_booking_id
    for update;

    if not found then
      raise exception 'Private booking was not found for paid payment.';
    end if;

    if v_private_booking.status = 'pending_payment' and v_private_booking.payment_status = 'pending' then
      update public.private_trainer_bookings
      set
        status = 'confirmed',
        payment_status = 'paid',
        seat_hold_expires_at = null,
        confirmed_at = coalesce(confirmed_at, now())
      where id = v_private_booking.id
      returning *
      into v_private_booking;

      insert into public.private_trainer_booking_history (
        private_booking_id,
        actor_role,
        action,
        from_status,
        to_status,
        notes,
        metadata
      )
      values (
        v_private_booking.id,
        'system',
        'private_booking_confirmed',
        'pending_payment',
        'confirmed',
        'Payment completed and private booking confirmed.',
        jsonb_build_object(
          'payment_id', v_payment.id,
          'payment_number', v_payment.payment_number,
          'receipt_number', v_payment.receipt_number
        )
      );

      insert into public.booking_domain_events (
        event_type,
        private_booking_id,
        payment_id,
        payload
      )
      values (
        'private_booking.payment_confirmed',
        v_private_booking.id,
        v_payment.id,
        jsonb_build_object(
          'private_booking_id', v_private_booking.id,
          'payment_id', v_payment.id,
          'payment_number', v_payment.payment_number,
          'receipt_number', v_payment.receipt_number
        )
      );
    elsif v_private_booking.status = 'confirmed' then
      update public.private_trainer_bookings
      set payment_status = 'paid'
      where id = v_private_booking.id
        and payment_status <> 'paid'
      returning *
      into v_private_booking;
    else
      raise exception 'Private booking is not payable in its current state.';
    end if;

  elsif v_payment.target_type::text = 'booking_order' then
    if v_payment.booking_order_id is null then
      raise exception 'Booking order payment is missing booking_order_id.';
    end if;

    select *
    into v_order_result
    from public.confirm_booking_order_paid_atomic(
      v_payment.booking_order_id,
      v_payment.id
    );

  elsif v_payment.target_type::text = 'wallet_top_up' then
    select *
    into v_wallet_result
    from public.credit_wallet_atomic(
      v_payment.user_id,
      v_payment.final_amount,
      v_payment.currency,
      v_payment.id,
      'Wallet top-up payment completed.',
      jsonb_build_object(
        'payment_id', v_payment.id,
        'payment_number', v_payment.payment_number,
        'receipt_number', v_payment.receipt_number
      )
    );

    insert into public.payment_transactions (
      payment_id,
      transaction_type,
      transaction_status,
      provider,
      provider_reference,
      gateway_response,
      processed_at
    )
    values (
      v_payment.id,
      'wallet_credit',
      'succeeded',
      'wallet',
      v_payment.gateway_reference,
      jsonb_build_object(
        'wallet_account_id', v_wallet_result.wallet_account_id,
        'ledger_entry_id', v_wallet_result.ledger_entry_id,
        'available_balance', v_wallet_result.available_balance
      ),
      now()
    );
  else
    raise exception 'Unsupported paid payment target type.';
  end if;

  return query
  select
    v_payment.id,
    v_payment.payment_number,
    v_payment.target_type,
    v_payment.booking_id,
    v_payment.private_booking_id,
    v_payment.status,
    v_payment.receipt_number,
    v_payment.paid_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- Expire unpaid payments extended for booking_order target
-- ---------------------------------------------------------------------------

create or replace function public.expire_payment_intents_atomic()
returns table (
  payment_id uuid,
  target_type public.payment_target_type,
  booking_id uuid,
  private_booking_id uuid,
  status public.payment_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_booking public.bookings%rowtype;
  v_private_booking public.private_trainer_bookings%rowtype;
  v_order_result record;
begin
  for v_payment in
    select p.*
    from public.payments as p
    where p.status in ('pending', 'requires_redirect', 'processing')
      and p.expires_at is not null
      and p.expires_at <= now()
    order by p.expires_at asc, p.created_at asc
    for update skip locked
  loop
    update public.payments as p
    set
      status = 'expired',
      expired_at = now()
    where p.id = v_payment.id
    returning p.*
    into v_payment;

    insert into public.payment_transactions (
      payment_id,
      transaction_type,
      transaction_status,
      provider,
      provider_reference,
      gateway_response,
      processed_at
    )
    values (
      v_payment.id,
      'status_change',
      'succeeded',
      v_payment.payment_provider,
      v_payment.gateway_reference,
      jsonb_build_object('expired_at', v_payment.expired_at),
      now()
    );

    if v_payment.target_type::text = 'booking' then
      update public.bookings as b
      set
        status = 'expired',
        payment_status = 'expired',
        seat_hold_expires_at = null
      where b.id = v_payment.booking_id
        and b.status = 'pending_payment'
        and b.payment_status = 'pending'
      returning b.*
      into v_booking;

      if found then
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
          'Payment intent expired.',
          jsonb_build_object('payment_id', v_payment.id)
        );

        update public.pilates_class_schedules as pcs
        set
          updated_at = now(),
          realtime_version = pcs.realtime_version + 1
        where pcs.id = v_booking.schedule_id;

        insert into public.booking_domain_events (
          event_type,
          schedule_id,
          booking_id,
          payment_id,
          payload
        )
        values (
          'booking.payment_expired',
          v_booking.schedule_id,
          v_booking.id,
          v_payment.id,
          jsonb_build_object(
            'booking_id', v_booking.id,
            'payment_id', v_payment.id
          )
        );
      end if;

    elsif v_payment.target_type::text = 'private_booking' then
      update public.private_trainer_bookings as ptb
      set
        status = 'expired',
        payment_status = 'expired',
        seat_hold_expires_at = null
      where ptb.id = v_payment.private_booking_id
        and ptb.status = 'pending_payment'
        and ptb.payment_status = 'pending'
      returning ptb.*
      into v_private_booking;

      if found then
        insert into public.private_trainer_booking_history (
          private_booking_id,
          actor_role,
          action,
          from_status,
          to_status,
          notes,
          metadata
        )
        values (
          v_private_booking.id,
          'system',
          'private_booking_expired',
          'pending_payment',
          'expired',
          'Payment intent expired.',
          jsonb_build_object('payment_id', v_payment.id)
        );

        insert into public.booking_domain_events (
          event_type,
          private_booking_id,
          payment_id,
          payload
        )
        values (
          'private_booking.payment_expired',
          v_private_booking.id,
          v_payment.id,
          jsonb_build_object(
            'private_booking_id', v_private_booking.id,
            'payment_id', v_payment.id
          )
        );
      end if;

    elsif v_payment.target_type::text = 'booking_order' then
      select *
      into v_order_result
      from public.expire_booking_order_atomic(
        v_payment.booking_order_id,
        v_payment.id,
        'Payment intent expired for booking order.'
      );
    end if;

    payment_id := v_payment.id;
    target_type := v_payment.target_type;
    booking_id := v_payment.booking_id;
    private_booking_id := v_payment.private_booking_id;
    status := v_payment.status;

    return next;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function permissions
-- ---------------------------------------------------------------------------

revoke all on function public.create_booking_order_atomic(
  uuid,
  uuid[],
  text,
  uuid,
  uuid,
  uuid,
  text,
  public.booking_source,
  timestamptz,
  text,
  jsonb
) from public, anon, authenticated;

revoke all on function public.confirm_booking_order_paid_atomic(
  uuid,
  uuid
) from public, anon, authenticated;

revoke all on function public.expire_booking_order_atomic(
  uuid,
  uuid,
  text
) from public, anon, authenticated;

revoke all on function public.create_payment_intent_atomic(
  uuid,
  public.payment_target_type,
  uuid,
  uuid,
  numeric,
  numeric,
  numeric,
  text,
  public.payment_method,
  public.payment_provider,
  public.payment_status,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  jsonb,
  uuid
) from public, anon, authenticated;

revoke all on function public.debit_wallet_for_booking_order_atomic(
  uuid,
  text,
  jsonb
) from public, anon, authenticated;

revoke all on function public.mark_payment_paid_atomic(
  uuid,
  text,
  text,
  text,
  jsonb,
  boolean,
  public.payment_status
) from public, anon, authenticated;

revoke all on function public.expire_payment_intents_atomic()
  from public, anon, authenticated;

grant execute on function public.create_booking_order_atomic(
  uuid,
  uuid[],
  text,
  uuid,
  uuid,
  uuid,
  text,
  public.booking_source,
  timestamptz,
  text,
  jsonb
) to service_role;

grant execute on function public.confirm_booking_order_paid_atomic(
  uuid,
  uuid
) to service_role;

grant execute on function public.expire_booking_order_atomic(
  uuid,
  uuid,
  text
) to service_role;

grant execute on function public.create_payment_intent_atomic(
  uuid,
  public.payment_target_type,
  uuid,
  uuid,
  numeric,
  numeric,
  numeric,
  text,
  public.payment_method,
  public.payment_provider,
  public.payment_status,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  jsonb,
  uuid
) to service_role;

grant execute on function public.debit_wallet_for_booking_order_atomic(
  uuid,
  text,
  jsonb
) to service_role;

grant execute on function public.mark_payment_paid_atomic(
  uuid,
  text,
  text,
  text,
  jsonb,
  boolean,
  public.payment_status
) to service_role;

grant execute on function public.expire_payment_intents_atomic()
  to service_role;

comment on function public.create_booking_order_atomic(
  uuid,
  uuid[],
  text,
  uuid,
  uuid,
  uuid,
  text,
  public.booking_source,
  timestamptz,
  text,
  jsonb
) is
  'Atomically creates one payment-required booking order and multiple pending Pilates bookings. Bulk booking is all-or-nothing and does not create waitlist entries.';

comment on function public.confirm_booking_order_paid_atomic(uuid, uuid) is
  'Atomically marks a booking order as paid and confirms every pending booking item under the order.';

comment on function public.expire_booking_order_atomic(uuid, uuid, text) is
  'Atomically expires an unpaid booking order and releases every pending booking hold under the order.';

comment on function public.create_payment_intent_atomic(
  uuid,
  public.payment_target_type,
  uuid,
  uuid,
  numeric,
  numeric,
  numeric,
  text,
  public.payment_method,
  public.payment_provider,
  public.payment_status,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  jsonb,
  uuid
) is
  'Atomically creates a payment intent for booking, private booking, wallet top-up, or booking order targets.';

comment on function public.debit_wallet_for_booking_order_atomic(uuid, text, jsonb) is
  'Atomically debits wallet balance once for a booking order payment and confirms all bookings under that order.';

comment on function public.mark_payment_paid_atomic(
  uuid,
  text,
  text,
  text,
  jsonb,
  boolean,
  public.payment_status
) is
  'Atomically marks a payment as paid, stores gateway identifiers, confirms payable booking/private booking/booking order targets, or credits wallet top-up balance.';

comment on function public.expire_payment_intents_atomic() is
  'Atomically expires unpaid payment intents and releases related booking, private booking, or booking order holds.';

notify pgrst, 'reload schema';