-- supabase/migrations/20260701133453_complete_promo_code_module.sql
--
-- Purpose:
-- Complete the backend Promo Code module database foundation.
--
-- This migration adds:
-- - Promo-code lifecycle status values for backend management.
-- - Promo-code targeting metadata and eligibility controls.
-- - Normalized class, schedule, trainer, and customer promo-code targets.
-- - Promo-code redemption reservation lifecycle.
-- - Payment-discount audit linkage to promo-code redemptions.
-- - Atomic PostgreSQL functions for reserve, attach, redeem, release, and expiry cleanup.
--
-- Notes:
-- - Promo codes apply before payment creation, not after payment is already paid.
-- - Wallet top-up remains excluded from promo-code usage.
-- - Loyalty points, cashback, referrals, automatic discounts, stacked discounts, and salon promo rules are intentionally excluded.
-- - NestJS service-role access remains the trusted mutation path.
-- - Frontend must not calculate discount, final amount, redemption state, or payment truth.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Existing enum extensions
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
      and enum_type.typname = 'promo_code_status'
      and enum_value.enumlabel = 'draft'
  ) then
    alter type public.promo_code_status add value 'draft';
  end if;
end
$$;

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
      and enum_type.typname = 'promo_code_status'
      and enum_value.enumlabel = 'paused'
  ) then
    alter type public.promo_code_status add value 'paused';
  end if;
end
$$;

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
      and enum_type.typname = 'promo_code_status'
      and enum_value.enumlabel = 'exhausted'
  ) then
    alter type public.promo_code_status add value 'exhausted';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Promo-code redemption enum
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'promo_code_redemption_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.promo_code_redemption_status as enum (
      'reserved',
      'redeemed',
      'released',
      'voided'
    );
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Promo-code table completion
-- ---------------------------------------------------------------------------

alter table public.promo_codes
  add column if not exists currency text not null default 'KWD';

alter table public.promo_codes
  add column if not exists minimum_order_amount numeric(12, 3) not null default 0.000;

alter table public.promo_codes
  add column if not exists first_time_customer_only boolean not null default false;

alter table public.promo_codes
  add column if not exists allowed_target_types text[] not null default array[
    'booking',
    'private_booking',
    'booking_order'
  ]::text[];

alter table public.promo_codes
  add column if not exists allowed_payment_methods text[] not null default array[
    'knet',
    'card',
    'wallet'
  ]::text[];

alter table public.promo_codes
  add column if not exists created_by_role text;

alter table public.promo_codes
  add column if not exists staff_limit_metadata jsonb not null default '{}'::jsonb;

alter table public.promo_codes
  add column if not exists admin_notes text;

alter table public.promo_codes
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'promo_codes_currency_format'
      and conrelid = 'public.promo_codes'::regclass
  ) then
    alter table public.promo_codes
      add constraint promo_codes_currency_format
      check (
        currency = upper(currency)
        and char_length(currency) = 3
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'promo_codes_minimum_order_amount_non_negative'
      and conrelid = 'public.promo_codes'::regclass
  ) then
    alter table public.promo_codes
      add constraint promo_codes_minimum_order_amount_non_negative
      check (minimum_order_amount >= 0);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'promo_codes_allowed_target_types_valid'
      and conrelid = 'public.promo_codes'::regclass
  ) then
    alter table public.promo_codes
      add constraint promo_codes_allowed_target_types_valid
      check (
        array_length(allowed_target_types, 1) is not null
        and allowed_target_types <@ array[
          'booking',
          'private_booking',
          'booking_order'
        ]::text[]
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'promo_codes_allowed_payment_methods_valid'
      and conrelid = 'public.promo_codes'::regclass
  ) then
    alter table public.promo_codes
      add constraint promo_codes_allowed_payment_methods_valid
      check (
        array_length(allowed_payment_methods, 1) is not null
        and allowed_payment_methods <@ array[
          'knet',
          'card',
          'wallet'
        ]::text[]
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'promo_codes_created_by_role_valid'
      and conrelid = 'public.promo_codes'::regclass
  ) then
    alter table public.promo_codes
      add constraint promo_codes_created_by_role_valid
      check (
        created_by_role is null
        or created_by_role in (
          'super_admin',
          'admin',
          'staff',
          'trainer',
          'system'
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'promo_codes_staff_limit_metadata_object'
      and conrelid = 'public.promo_codes'::regclass
  ) then
    alter table public.promo_codes
      add constraint promo_codes_staff_limit_metadata_object
      check (jsonb_typeof(staff_limit_metadata) = 'object');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'promo_codes_admin_notes_length'
      and conrelid = 'public.promo_codes'::regclass
  ) then
    alter table public.promo_codes
      add constraint promo_codes_admin_notes_length
      check (admin_notes is null or char_length(admin_notes) <= 2000);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'promo_codes_metadata_object'
      and conrelid = 'public.promo_codes'::regclass
  ) then
    alter table public.promo_codes
      add constraint promo_codes_metadata_object
      check (jsonb_typeof(metadata) = 'object');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Promo-code target tables
-- ---------------------------------------------------------------------------

create table if not exists public.promo_code_class_targets (
  id uuid primary key default gen_random_uuid(),

  promo_code_id uuid not null
    references public.promo_codes(id)
    on update cascade
    on delete cascade,

  class_id uuid not null
    references public.pilates_classes(id)
    on update cascade
    on delete cascade,

  created_at timestamptz not null default now(),

  constraint promo_code_class_targets_unique
    unique (promo_code_id, class_id)
);

create table if not exists public.promo_code_schedule_targets (
  id uuid primary key default gen_random_uuid(),

  promo_code_id uuid not null
    references public.promo_codes(id)
    on update cascade
    on delete cascade,

  schedule_id uuid not null
    references public.pilates_class_schedules(id)
    on update cascade
    on delete cascade,

  created_at timestamptz not null default now(),

  constraint promo_code_schedule_targets_unique
    unique (promo_code_id, schedule_id)
);

create table if not exists public.promo_code_trainer_targets (
  id uuid primary key default gen_random_uuid(),

  promo_code_id uuid not null
    references public.promo_codes(id)
    on update cascade
    on delete cascade,

  trainer_staff_profile_id uuid not null
    references public.staff_profiles(id)
    on update cascade
    on delete cascade,

  created_at timestamptz not null default now(),

  constraint promo_code_trainer_targets_unique
    unique (promo_code_id, trainer_staff_profile_id)
);

create table if not exists public.promo_code_customer_targets (
  id uuid primary key default gen_random_uuid(),

  promo_code_id uuid not null
    references public.promo_codes(id)
    on update cascade
    on delete cascade,

  customer_user_id uuid not null
    references public.app_users(id)
    on update cascade
    on delete cascade,

  created_at timestamptz not null default now(),

  constraint promo_code_customer_targets_unique
    unique (promo_code_id, customer_user_id)
);

-- ---------------------------------------------------------------------------
-- Promo-code redemption table
-- ---------------------------------------------------------------------------

create table if not exists public.promo_code_redemptions (
  id uuid primary key default gen_random_uuid(),

  promo_code_id uuid not null
    references public.promo_codes(id)
    on update cascade
    on delete restrict,

  user_id uuid not null
    references public.app_users(id)
    on update cascade
    on delete restrict,

  payment_id uuid
    references public.payments(id)
    on update cascade
    on delete set null,

  target_type public.payment_target_type not null,

  booking_id uuid
    references public.bookings(id)
    on update cascade
    on delete set null,

  private_booking_id uuid
    references public.private_trainer_bookings(id)
    on update cascade
    on delete set null,

  booking_order_id uuid
    references public.booking_orders(id)
    on update cascade
    on delete set null,

  payment_method public.payment_method not null,

  idempotency_key text not null,

  status public.promo_code_redemption_status not null default 'reserved',

  subtotal_amount numeric(12, 3) not null,
  discount_amount numeric(12, 3) not null,
  final_amount numeric(12, 3) not null,

  currency text not null default 'KWD',

  reserved_at timestamptz not null default now(),
  redeemed_at timestamptz,
  released_at timestamptz,
  expires_at timestamptz,

  release_reason text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint promo_code_redemptions_idempotency_key_not_blank
    check (length(trim(idempotency_key)) > 0),

  constraint promo_code_redemptions_idempotency_key_length
    check (char_length(idempotency_key) <= 160),

  constraint promo_code_redemptions_amounts_valid
    check (
      subtotal_amount > 0
      and discount_amount > 0
      and final_amount >= 0
      and final_amount = subtotal_amount - discount_amount
    ),

  constraint promo_code_redemptions_currency_format
    check (
      currency = upper(currency)
      and char_length(currency) = 3
    ),

  constraint promo_code_redemptions_target_not_wallet_top_up
    check (target_type::text <> 'wallet_top_up'),

  constraint promo_code_redemptions_target_reference_valid
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
        target_type::text = 'booking_order'
        and booking_id is null
        and private_booking_id is null
        and booking_order_id is not null
      )
    ),

  constraint promo_code_redemptions_status_timestamp_consistent
    check (
      (
        status::text = 'reserved'
        and redeemed_at is null
        and released_at is null
      )
      or
      (
        status::text = 'redeemed'
        and payment_id is not null
        and redeemed_at is not null
        and released_at is null
      )
      or
      (
        status::text in ('released', 'voided')
        and redeemed_at is null
        and released_at is not null
      )
    ),

  constraint promo_code_redemptions_expiry_after_reserved
    check (
      expires_at is null
      or expires_at > reserved_at
    ),

  constraint promo_code_redemptions_release_reason_length
    check (
      release_reason is null
      or char_length(release_reason) <= 1000
    ),

  constraint promo_code_redemptions_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

-- ---------------------------------------------------------------------------
-- Payment-discount redemption linkage
-- ---------------------------------------------------------------------------

alter table public.payment_discounts
  add column if not exists promo_code_redemption_id uuid
    references public.promo_code_redemptions(id)
    on update cascade
    on delete set null;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists promo_codes_currency_idx
  on public.promo_codes (currency);

create index if not exists promo_codes_created_by_admin_id_idx
  on public.promo_codes (created_by_admin_id)
  where created_by_admin_id is not null;

create index if not exists promo_codes_created_by_role_idx
  on public.promo_codes (created_by_role)
  where created_by_role is not null;

create index if not exists promo_code_class_targets_promo_code_id_idx
  on public.promo_code_class_targets (promo_code_id);

create index if not exists promo_code_class_targets_class_id_idx
  on public.promo_code_class_targets (class_id);

create index if not exists promo_code_schedule_targets_promo_code_id_idx
  on public.promo_code_schedule_targets (promo_code_id);

create index if not exists promo_code_schedule_targets_schedule_id_idx
  on public.promo_code_schedule_targets (schedule_id);

create index if not exists promo_code_trainer_targets_promo_code_id_idx
  on public.promo_code_trainer_targets (promo_code_id);

create index if not exists promo_code_trainer_targets_trainer_staff_profile_id_idx
  on public.promo_code_trainer_targets (trainer_staff_profile_id);

create index if not exists promo_code_customer_targets_promo_code_id_idx
  on public.promo_code_customer_targets (promo_code_id);

create index if not exists promo_code_customer_targets_customer_user_id_idx
  on public.promo_code_customer_targets (customer_user_id);

create index if not exists promo_code_redemptions_promo_code_id_idx
  on public.promo_code_redemptions (promo_code_id);

create index if not exists promo_code_redemptions_user_id_idx
  on public.promo_code_redemptions (user_id);

create index if not exists promo_code_redemptions_status_idx
  on public.promo_code_redemptions (status);

create index if not exists promo_code_redemptions_payment_id_idx
  on public.promo_code_redemptions (payment_id)
  where payment_id is not null;

create index if not exists promo_code_redemptions_booking_id_idx
  on public.promo_code_redemptions (booking_id)
  where booking_id is not null;

create index if not exists promo_code_redemptions_private_booking_id_idx
  on public.promo_code_redemptions (private_booking_id)
  where private_booking_id is not null;

create index if not exists promo_code_redemptions_booking_order_id_idx
  on public.promo_code_redemptions (booking_order_id)
  where booking_order_id is not null;

create index if not exists promo_code_redemptions_expires_at_idx
  on public.promo_code_redemptions (expires_at)
  where status = 'reserved'
    and expires_at is not null;

create unique index if not exists promo_code_redemptions_idempotency_active_uidx
  on public.promo_code_redemptions (
    promo_code_id,
    user_id,
    idempotency_key
  )
  where status in ('reserved', 'redeemed');

create unique index if not exists promo_code_redemptions_payment_id_uidx
  on public.promo_code_redemptions (payment_id)
  where payment_id is not null
    and status in ('reserved', 'redeemed');

create unique index if not exists payment_discounts_payment_id_uidx
  on public.payment_discounts (payment_id);

create index if not exists payment_discounts_promo_code_redemption_id_idx
  on public.payment_discounts (promo_code_redemption_id)
  where promo_code_redemption_id is not null;

create unique index if not exists payment_discounts_promo_code_redemption_id_uidx
  on public.payment_discounts (promo_code_redemption_id)
  where promo_code_redemption_id is not null;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

drop trigger if exists trg_promo_codes_set_updated_at on public.promo_codes;

create trigger trg_promo_codes_set_updated_at
before update on public.promo_codes
for each row
execute function public.set_lafam_payment_updated_at();

drop trigger if exists trg_promo_code_redemptions_set_updated_at on public.promo_code_redemptions;

create trigger trg_promo_code_redemptions_set_updated_at
before update on public.promo_code_redemptions
for each row
execute function public.set_lafam_payment_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.promo_code_class_targets enable row level security;
alter table public.promo_code_schedule_targets enable row level security;
alter table public.promo_code_trainer_targets enable row level security;
alter table public.promo_code_customer_targets enable row level security;
alter table public.promo_code_redemptions enable row level security;

-- ---------------------------------------------------------------------------
-- Atomic promo-code redemption reservation
-- ---------------------------------------------------------------------------

create or replace function public.reserve_promo_code_redemption_atomic(
  p_promo_code_id uuid,
  p_user_id uuid,
  p_payment_method public.payment_method,
  p_target_type public.payment_target_type,
  p_booking_id uuid default null::uuid,
  p_private_booking_id uuid default null::uuid,
  p_booking_order_id uuid default null::uuid,
  p_idempotency_key text default null::text,
  p_subtotal_amount numeric default null::numeric,
  p_discount_amount numeric default null::numeric,
  p_final_amount numeric default null::numeric,
  p_currency text default 'KWD'::text,
  p_expires_at timestamptz default null::timestamptz,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  redemption_id uuid,
  promo_code_id uuid,
  user_id uuid,
  payment_id uuid,
  target_type public.payment_target_type,
  booking_id uuid,
  private_booking_id uuid,
  booking_order_id uuid,
  payment_method public.payment_method,
  idempotency_key text,
  status public.promo_code_redemption_status,
  subtotal_amount numeric,
  discount_amount numeric,
  final_amount numeric,
  currency text,
  reserved_at timestamptz,
  redeemed_at timestamptz,
  released_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promo public.promo_codes%rowtype;
  v_existing public.promo_code_redemptions%rowtype;
  v_redemption public.promo_code_redemptions%rowtype;
  v_now timestamptz := now();
  v_metadata jsonb;
  v_user_active_redemption_count integer := 0;
  v_expires_at timestamptz;
begin
  if p_promo_code_id is null then
    raise exception 'Promo code id is required.';
  end if;

  if p_user_id is null then
    raise exception 'User id is required.';
  end if;

  if p_payment_method is null then
    raise exception 'Payment method is required.';
  end if;

  if p_target_type is null then
    raise exception 'Payment target type is required.';
  end if;

  if p_target_type::text = 'wallet_top_up' then
    raise exception 'Promo codes are not supported for wallet top-up.';
  end if;

  if nullif(trim(coalesce(p_idempotency_key, '')), '') is null then
    raise exception 'Idempotency key is required for promo-code redemption.';
  end if;

  if char_length(trim(p_idempotency_key)) > 160 then
    raise exception 'Idempotency key is too long.';
  end if;

  if p_subtotal_amount is null or p_subtotal_amount <= 0 then
    raise exception 'Subtotal amount must be greater than zero.';
  end if;

  if p_discount_amount is null or p_discount_amount <= 0 then
    raise exception 'Discount amount must be greater than zero.';
  end if;

  if p_final_amount is null or p_final_amount < 0 then
    raise exception 'Final amount must be zero or greater.';
  end if;

  if p_final_amount <> p_subtotal_amount - p_discount_amount then
    raise exception 'Final amount must equal subtotal amount minus discount amount.';
  end if;

  if p_discount_amount > p_subtotal_amount then
    raise exception 'Discount amount cannot exceed subtotal amount.';
  end if;

  if p_currency is null
    or p_currency <> upper(p_currency)
    or char_length(p_currency) <> 3
  then
    raise exception 'Valid uppercase three-letter currency is required.';
  end if;

  v_metadata := coalesce(p_metadata, '{}'::jsonb);

  if jsonb_typeof(v_metadata) <> 'object' then
    raise exception 'Promo-code redemption metadata must be a JSON object.';
  end if;

  if (
    p_target_type::text = 'booking'
    and (
      p_booking_id is null
      or p_private_booking_id is not null
      or p_booking_order_id is not null
    )
  )
  or (
    p_target_type::text = 'private_booking'
    and (
      p_booking_id is not null
      or p_private_booking_id is null
      or p_booking_order_id is not null
    )
  )
  or (
    p_target_type::text = 'booking_order'
    and (
      p_booking_id is not null
      or p_private_booking_id is not null
      or p_booking_order_id is null
    )
  )
  then
    raise exception 'Promo-code redemption target reference is invalid.';
  end if;

  select *
  into v_promo
  from public.promo_codes
  where id = p_promo_code_id
  for update;

  if not found then
    raise exception 'Promo code was not found.';
  end if;

  select *
  into v_existing
  from public.promo_code_redemptions
  where promo_code_id = p_promo_code_id
    and user_id = p_user_id
    and idempotency_key = trim(p_idempotency_key)
    and status in ('reserved', 'redeemed')
  order by created_at desc
  limit 1
  for update;

  if found then
    return query
    select
      v_existing.id,
      v_existing.promo_code_id,
      v_existing.user_id,
      v_existing.payment_id,
      v_existing.target_type,
      v_existing.booking_id,
      v_existing.private_booking_id,
      v_existing.booking_order_id,
      v_existing.payment_method,
      v_existing.idempotency_key,
      v_existing.status,
      v_existing.subtotal_amount,
      v_existing.discount_amount,
      v_existing.final_amount,
      v_existing.currency,
      v_existing.reserved_at,
      v_existing.redeemed_at,
      v_existing.released_at,
      v_existing.expires_at;

    return;
  end if;

  if v_promo.status::text <> 'active' then
    raise exception 'Promo code is not active.';
  end if;

  if v_promo.deleted_at is not null then
    raise exception 'Promo code is deleted.';
  end if;

  if v_promo.starts_at is not null and v_now < v_promo.starts_at then
    raise exception 'Promo code has not started yet.';
  end if;

  if v_promo.ends_at is not null and v_now > v_promo.ends_at then
    raise exception 'Promo code has expired.';
  end if;

  if v_promo.currency <> p_currency then
    raise exception 'Promo code currency does not match checkout currency.';
  end if;

  if p_subtotal_amount < v_promo.minimum_order_amount then
    raise exception 'Checkout amount does not meet the promo-code minimum order amount.';
  end if;

  if not (p_target_type::text = any(v_promo.allowed_target_types)) then
    raise exception 'Promo code is not allowed for this checkout target.';
  end if;

  if not (p_payment_method::text = any(v_promo.allowed_payment_methods)) then
    raise exception 'Promo code is not allowed for this payment method.';
  end if;

  select count(*)::integer
  into v_user_active_redemption_count
  from public.promo_code_redemptions as redemptions
  where redemptions.promo_code_id = p_promo_code_id
    and redemptions.user_id = p_user_id
    and redemptions.status in ('reserved', 'redeemed');

  if v_promo.per_user_limit is not null
    and v_user_active_redemption_count >= v_promo.per_user_limit
  then
    raise exception 'Promo-code per-user redemption limit has been reached.';
  end if;

  update public.promo_codes as promo
  set redemption_count = promo.redemption_count + 1
  where promo.id = v_promo.id
    and (
      promo.max_redemptions is null
      or promo.redemption_count < promo.max_redemptions
    )
  returning *
  into v_promo;

  if not found then
    raise exception 'Promo-code global redemption limit has been reached.';
  end if;

  v_expires_at := coalesce(p_expires_at, v_now + interval '30 minutes');

  if v_expires_at <= v_now then
    raise exception 'Promo-code redemption expiry must be in the future.';
  end if;

  insert into public.promo_code_redemptions (
    promo_code_id,
    user_id,
    target_type,
    booking_id,
    private_booking_id,
    booking_order_id,
    payment_method,
    idempotency_key,
    status,
    subtotal_amount,
    discount_amount,
    final_amount,
    currency,
    reserved_at,
    expires_at,
    metadata
  )
  values (
    v_promo.id,
    p_user_id,
    p_target_type,
    p_booking_id,
    p_private_booking_id,
    p_booking_order_id,
    p_payment_method,
    trim(p_idempotency_key),
    'reserved',
    p_subtotal_amount,
    p_discount_amount,
    p_final_amount,
    p_currency,
    v_now,
    v_expires_at,
    v_metadata
  )
  returning *
  into v_redemption;

  return query
  select
    v_redemption.id,
    v_redemption.promo_code_id,
    v_redemption.user_id,
    v_redemption.payment_id,
    v_redemption.target_type,
    v_redemption.booking_id,
    v_redemption.private_booking_id,
    v_redemption.booking_order_id,
    v_redemption.payment_method,
    v_redemption.idempotency_key,
    v_redemption.status,
    v_redemption.subtotal_amount,
    v_redemption.discount_amount,
    v_redemption.final_amount,
    v_redemption.currency,
    v_redemption.reserved_at,
    v_redemption.redeemed_at,
    v_redemption.released_at,
    v_redemption.expires_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- Atomic promo-code redemption payment attachment
-- ---------------------------------------------------------------------------

create or replace function public.attach_promo_code_redemption_payment_atomic(
  p_redemption_id uuid,
  p_payment_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  redemption_id uuid,
  promo_code_id uuid,
  user_id uuid,
  payment_id uuid,
  target_type public.payment_target_type,
  status public.promo_code_redemption_status,
  discount_amount numeric,
  final_amount numeric,
  currency text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_redemption public.promo_code_redemptions%rowtype;
  v_payment public.payments%rowtype;
  v_metadata jsonb;
begin
  if p_redemption_id is null then
    raise exception 'Promo-code redemption id is required.';
  end if;

  if p_payment_id is null then
    raise exception 'Payment id is required.';
  end if;

  v_metadata := coalesce(p_metadata, '{}'::jsonb);

  if jsonb_typeof(v_metadata) <> 'object' then
    raise exception 'Promo-code redemption payment metadata must be a JSON object.';
  end if;

  select *
  into v_redemption
  from public.promo_code_redemptions
  where id = p_redemption_id
  for update;

  if not found then
    raise exception 'Promo-code redemption was not found.';
  end if;

  if v_redemption.status not in ('reserved', 'redeemed') then
    raise exception 'Only reserved or redeemed promo-code redemptions can be attached to a payment.';
  end if;

  select *
  into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment was not found.';
  end if;

  if v_redemption.payment_id is not null
    and v_redemption.payment_id <> v_payment.id
  then
    raise exception 'Promo-code redemption is already attached to a different payment.';
  end if;

  if v_payment.user_id <> v_redemption.user_id then
    raise exception 'Promo-code redemption user does not match payment user.';
  end if;

  if v_payment.target_type::text <> v_redemption.target_type::text then
    raise exception 'Promo-code redemption target type does not match payment target type.';
  end if;

  if coalesce(v_payment.booking_id, '00000000-0000-0000-0000-000000000000'::uuid)
    <> coalesce(v_redemption.booking_id, '00000000-0000-0000-0000-000000000000'::uuid)
  then
    raise exception 'Promo-code redemption booking does not match payment booking.';
  end if;

  if coalesce(v_payment.private_booking_id, '00000000-0000-0000-0000-000000000000'::uuid)
    <> coalesce(v_redemption.private_booking_id, '00000000-0000-0000-0000-000000000000'::uuid)
  then
    raise exception 'Promo-code redemption private booking does not match payment private booking.';
  end if;

  if coalesce(v_payment.booking_order_id, '00000000-0000-0000-0000-000000000000'::uuid)
    <> coalesce(v_redemption.booking_order_id, '00000000-0000-0000-0000-000000000000'::uuid)
  then
    raise exception 'Promo-code redemption booking order does not match payment booking order.';
  end if;

  if v_payment.payment_method <> v_redemption.payment_method then
    raise exception 'Promo-code redemption payment method does not match payment method.';
  end if;

  if v_payment.amount <> v_redemption.subtotal_amount
    or v_payment.discount_amount <> v_redemption.discount_amount
    or v_payment.final_amount <> v_redemption.final_amount
    or v_payment.currency <> v_redemption.currency
  then
    raise exception 'Promo-code redemption pricing does not match payment pricing.';
  end if;

  update public.promo_code_redemptions
  set
    payment_id = v_payment.id,
    metadata = metadata || jsonb_build_object(
      'attached_payment_id', v_payment.id,
      'attached_at', now()
    ) || v_metadata
  where id = v_redemption.id
  returning *
  into v_redemption;

  return query
  select
    v_redemption.id,
    v_redemption.promo_code_id,
    v_redemption.user_id,
    v_redemption.payment_id,
    v_redemption.target_type,
    v_redemption.status,
    v_redemption.discount_amount,
    v_redemption.final_amount,
    v_redemption.currency;
end;
$$;

-- ---------------------------------------------------------------------------
-- Atomic promo-code redemption finalization
-- ---------------------------------------------------------------------------

create or replace function public.mark_promo_code_redemption_redeemed_atomic(
  p_redemption_id uuid default null::uuid,
  p_payment_id uuid default null::uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  redemption_id uuid,
  promo_code_id uuid,
  user_id uuid,
  payment_id uuid,
  target_type public.payment_target_type,
  status public.promo_code_redemption_status,
  discount_amount numeric,
  final_amount numeric,
  currency text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_redemption public.promo_code_redemptions%rowtype;
  v_payment public.payments%rowtype;
  v_promo public.promo_codes%rowtype;
  v_effective_payment_id uuid;
  v_metadata jsonb;
begin
  if p_redemption_id is null and p_payment_id is null then
    raise exception 'Either promo-code redemption id or payment id is required.';
  end if;

  v_metadata := coalesce(p_metadata, '{}'::jsonb);

  if jsonb_typeof(v_metadata) <> 'object' then
    raise exception 'Promo-code redemption metadata must be a JSON object.';
  end if;

  if p_redemption_id is not null then
    select *
    into v_redemption
    from public.promo_code_redemptions
    where id = p_redemption_id
    for update;
  else
    select *
    into v_redemption
    from public.promo_code_redemptions
    where payment_id = p_payment_id
      and status in ('reserved', 'redeemed')
    order by created_at desc
    limit 1
    for update;
  end if;

  if not found then
    raise exception 'Promo-code redemption was not found.';
  end if;

  if v_redemption.status in ('released', 'voided') then
    raise exception 'Released or voided promo-code redemption cannot be redeemed.';
  end if;

  v_effective_payment_id := coalesce(p_payment_id, v_redemption.payment_id);

  if v_effective_payment_id is null then
    raise exception 'Payment id is required to redeem a promo-code redemption.';
  end if;

  select *
  into v_payment
  from public.payments
  where id = v_effective_payment_id
  for update;

  if not found then
    raise exception 'Payment was not found.';
  end if;

  if v_payment.status <> 'paid' then
    raise exception 'Promo-code redemption can only be finalized after payment is paid.';
  end if;

  if v_payment.user_id <> v_redemption.user_id then
    raise exception 'Promo-code redemption user does not match payment user.';
  end if;

  if v_payment.target_type::text <> v_redemption.target_type::text then
    raise exception 'Promo-code redemption target type does not match payment target type.';
  end if;

  if v_payment.amount <> v_redemption.subtotal_amount
    or v_payment.discount_amount <> v_redemption.discount_amount
    or v_payment.final_amount <> v_redemption.final_amount
    or v_payment.currency <> v_redemption.currency
  then
    raise exception 'Promo-code redemption pricing does not match payment pricing.';
  end if;

  select *
  into v_promo
  from public.promo_codes
  where id = v_redemption.promo_code_id;

  if not found then
    raise exception 'Promo code was not found for redemption.';
  end if;

  if v_redemption.status = 'reserved' then
    update public.promo_code_redemptions
    set
      status = 'redeemed',
      payment_id = v_payment.id,
      redeemed_at = now(),
      released_at = null,
      release_reason = null,
      metadata = metadata || jsonb_build_object(
        'redeemed_payment_id', v_payment.id,
        'redeemed_at', now()
      ) || v_metadata
    where id = v_redemption.id
    returning *
    into v_redemption;
  end if;

  insert into public.payment_discounts (
    payment_id,
    promo_code_id,
    promo_code_redemption_id,
    code,
    discount_amount,
    metadata
  )
  values (
    v_payment.id,
    v_promo.id,
    v_redemption.id,
    v_promo.code,
    v_redemption.discount_amount,
    jsonb_build_object(
      'promo_code_redemption_id', v_redemption.id,
      'promo_code_id', v_promo.id,
      'code', v_promo.code,
      'discount_type', v_promo.discount_type,
      'discount_value', v_promo.discount_value,
      'subtotal_amount', v_redemption.subtotal_amount,
      'discount_amount', v_redemption.discount_amount,
      'final_amount', v_redemption.final_amount,
      'currency', v_redemption.currency,
      'target_type', v_redemption.target_type,
      'booking_id', v_redemption.booking_id,
      'private_booking_id', v_redemption.private_booking_id,
      'booking_order_id', v_redemption.booking_order_id
    )
  )
  on conflict (payment_id) do nothing;

  return query
  select
    v_redemption.id,
    v_redemption.promo_code_id,
    v_redemption.user_id,
    v_redemption.payment_id,
    v_redemption.target_type,
    v_redemption.status,
    v_redemption.discount_amount,
    v_redemption.final_amount,
    v_redemption.currency;
end;
$$;

-- ---------------------------------------------------------------------------
-- Atomic promo-code redemption release
-- ---------------------------------------------------------------------------

create or replace function public.release_promo_code_redemption_atomic(
  p_redemption_id uuid default null::uuid,
  p_payment_id uuid default null::uuid,
  p_release_reason text default null::text,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  redemption_id uuid,
  promo_code_id uuid,
  user_id uuid,
  payment_id uuid,
  target_type public.payment_target_type,
  status public.promo_code_redemption_status,
  discount_amount numeric,
  final_amount numeric,
  currency text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_redemption public.promo_code_redemptions%rowtype;
  v_metadata jsonb;
begin
  if p_redemption_id is null and p_payment_id is null then
    raise exception 'Either promo-code redemption id or payment id is required.';
  end if;

  if p_release_reason is not null and char_length(p_release_reason) > 1000 then
    raise exception 'Promo-code redemption release reason is too long.';
  end if;

  v_metadata := coalesce(p_metadata, '{}'::jsonb);

  if jsonb_typeof(v_metadata) <> 'object' then
    raise exception 'Promo-code redemption release metadata must be a JSON object.';
  end if;

  if p_redemption_id is not null then
    select *
    into v_redemption
    from public.promo_code_redemptions
    where id = p_redemption_id
    for update;

    if not found then
      raise exception 'Promo-code redemption was not found.';
    end if;
  else
    select *
    into v_redemption
    from public.promo_code_redemptions
    where payment_id = p_payment_id
      and status in ('reserved', 'redeemed', 'released', 'voided')
    order by created_at desc
    limit 1
    for update;

    if not found then
      return;
    end if;
  end if;

  if v_redemption.status = 'redeemed' then
    return query
    select
      v_redemption.id,
      v_redemption.promo_code_id,
      v_redemption.user_id,
      v_redemption.payment_id,
      v_redemption.target_type,
      v_redemption.status,
      v_redemption.discount_amount,
      v_redemption.final_amount,
      v_redemption.currency;

    return;
  end if;

  if v_redemption.status in ('released', 'voided') then
    return query
    select
      v_redemption.id,
      v_redemption.promo_code_id,
      v_redemption.user_id,
      v_redemption.payment_id,
      v_redemption.target_type,
      v_redemption.status,
      v_redemption.discount_amount,
      v_redemption.final_amount,
      v_redemption.currency;

    return;
  end if;

  update public.promo_code_redemptions
  set
    status = 'released',
    released_at = now(),
    release_reason = nullif(trim(coalesce(p_release_reason, '')), ''),
    metadata = metadata || jsonb_build_object(
      'released_at', now(),
      'release_reason', nullif(trim(coalesce(p_release_reason, '')), '')
    ) || v_metadata
  where id = v_redemption.id
  returning *
  into v_redemption;

  update public.promo_codes
  set redemption_count = greatest(redemption_count - 1, 0)
  where id = v_redemption.promo_code_id;

  return query
  select
    v_redemption.id,
    v_redemption.promo_code_id,
    v_redemption.user_id,
    v_redemption.payment_id,
    v_redemption.target_type,
    v_redemption.status,
    v_redemption.discount_amount,
    v_redemption.final_amount,
    v_redemption.currency;
end;
$$;

-- ---------------------------------------------------------------------------
-- Atomic expired promo-code redemption cleanup
-- ---------------------------------------------------------------------------

create or replace function public.release_expired_promo_code_redemptions_atomic(
  p_now timestamptz default now(),
  p_limit integer default 500
)
returns table (
  released_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_redemption public.promo_code_redemptions%rowtype;
  v_released_count integer := 0;
begin
  if p_limit is null or p_limit < 1 or p_limit > 5000 then
    raise exception 'Promo-code redemption cleanup limit must be between 1 and 5000.';
  end if;

  for v_redemption in
    select *
    from public.promo_code_redemptions
    where status = 'reserved'
      and expires_at is not null
      and expires_at <= p_now
    order by expires_at asc
    limit p_limit
    for update skip locked
  loop
    update public.promo_code_redemptions
    set
      status = 'released',
      released_at = p_now,
      release_reason = 'reservation_expired',
      metadata = metadata || jsonb_build_object(
        'released_at', p_now,
        'release_reason', 'reservation_expired'
      )
    where id = v_redemption.id;

    update public.promo_codes
    set redemption_count = greatest(redemption_count - 1, 0)
    where id = v_redemption.promo_code_id;

    v_released_count := v_released_count + 1;
  end loop;

  return query
  select v_released_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Documentation comments
-- ---------------------------------------------------------------------------

comment on table public.promo_code_class_targets is
  'Restricts promo codes to selected Pilates classes when rows exist for a promo code.';

comment on table public.promo_code_schedule_targets is
  'Restricts promo codes to selected Pilates class schedules when rows exist for a promo code.';

comment on table public.promo_code_trainer_targets is
  'Restricts promo codes to selected trainer staff profiles when rows exist for a promo code.';

comment on table public.promo_code_customer_targets is
  'Restricts promo codes to selected customer app users when rows exist for a promo code.';

comment on table public.promo_code_redemptions is
  'Tracks promo-code reservation, redemption, and release lifecycle for checkout-safe discount usage.';

comment on column public.promo_codes.redemption_count is
  'Counts active reserved and redeemed promo-code usage. Released reservations decrement this value.';

comment on column public.payment_discounts.promo_code_redemption_id is
  'Links final payment discount audit rows to the reserved/redeemed promo-code lifecycle record.';