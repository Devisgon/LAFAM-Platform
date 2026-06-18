-- supabase/migrations/20260617071041_add_payment_wallet_and_schedule_time_slots.sql
-- LAFAM Payment Module, Wallet Foundation, KNET-ready Hosted Redirect Flow, and Multi-Time Schedule Slot Support
--
-- Purpose:
-- - Adds backend-owned payment records and gateway transaction logging.
-- - Adds KNET/card hosted redirect payment readiness without storing card data.
-- - Adds wallet accounts and immutable wallet ledger entries.
-- - Adds basic promo-code database support without loyalty/cashback logic.
-- - Adds backend-owned pricing fields for Pilates classes, schedules, and private trainer bookings.
-- - Adds normalized recurring schedule time slots so admins can generate several time slots from one schedule request.
-- - Adds atomic PostgreSQL functions for payment confirmation, failed/cancelled payment handling, wallet debit/credit, refund recording, and payment expiry.
--
-- Important:
-- - NestJS service-role access remains the trusted mutation path.
-- - Frontend must not mutate payment, wallet, booking, or schedule state directly.
-- - KNET/card payments are modeled as hosted redirect flows.
-- - Callback alone is not trusted; backend verification/webhook processing must confirm final payment state.
-- - Wallet ledger is append-only; wallet balances are changed only through atomic functions.
-- - Loyalty points, cashback, saved cards, Apple Pay, and salon payments are intentionally excluded from this migration.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Payment and wallet enums
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'payment_method'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.payment_method as enum (
      'knet',
      'card',
      'wallet'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'payment_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.payment_status as enum (
      'pending',
      'requires_redirect',
      'processing',
      'paid',
      'failed',
      'cancelled',
      'expired',
      'refund_requested',
      'refund_processing',
      'manual_refund_required',
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
    where typname = 'payment_target_type'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.payment_target_type as enum (
      'booking',
      'private_booking',
      'wallet_top_up'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'payment_provider'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.payment_provider as enum (
      'mock',
      'knet',
      'tap',
      'myfatoorah',
      'checkout',
      'wallet',
      'manual'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'payment_transaction_type'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.payment_transaction_type as enum (
      'intent_created',
      'provider_request',
      'provider_response',
      'callback_received',
      'webhook_received',
      'verification',
      'status_change',
      'wallet_debit',
      'wallet_credit',
      'refund_requested',
      'refund_processed',
      'refund_failed'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'payment_transaction_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.payment_transaction_status as enum (
      'pending',
      'succeeded',
      'failed',
      'ignored'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'wallet_account_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.wallet_account_status as enum (
      'active',
      'frozen',
      'closed'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'wallet_ledger_entry_type'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.wallet_ledger_entry_type as enum (
      'wallet_top_up',
      'booking_payment',
      'private_booking_payment',
      'refund_credit',
      'admin_adjustment_credit',
      'admin_adjustment_debit'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'wallet_ledger_entry_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.wallet_ledger_entry_status as enum (
      'pending',
      'posted',
      'reversed',
      'failed'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'promo_discount_type'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.promo_discount_type as enum (
      'fixed_amount',
      'percentage'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'promo_code_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.promo_code_status as enum (
      'active',
      'inactive',
      'expired',
      'deleted'
    );
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Shared helper functions
-- ---------------------------------------------------------------------------

create or replace function public.set_lafam_payment_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_lafam_payment_realtime_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.realtime_version = old.realtime_version + 1;
  return new;
end;
$$;

create or replace function public.build_lafam_payment_number()
returns text
language plpgsql
as $$
declare
  generated_number text;
begin
  generated_number :=
    'PAY-' ||
    to_char(now(), 'YYYYMMDD') ||
    '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  return generated_number;
end;
$$;

create or replace function public.build_lafam_receipt_number()
returns text
language plpgsql
as $$
declare
  generated_number text;
begin
  generated_number :=
    'RCPT-' ||
    to_char(now(), 'YYYYMMDD') ||
    '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  return generated_number;
end;
$$;

-- ---------------------------------------------------------------------------
-- Backend-owned pricing additions
-- ---------------------------------------------------------------------------

alter table public.pilates_classes
  add column if not exists default_price_amount numeric(12, 3) not null default 0.000;

alter table public.pilates_classes
  add column if not exists currency text not null default 'KWD';

alter table public.pilates_class_schedules
  add column if not exists price_amount numeric(12, 3);

alter table public.pilates_class_schedules
  add column if not exists currency text default 'KWD';

alter table public.private_trainer_bookings
  add column if not exists price_amount numeric(12, 3) not null default 0.000;

alter table public.private_trainer_bookings
  add column if not exists currency text not null default 'KWD';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pilates_classes_default_price_amount_non_negative'
      and conrelid = 'public.pilates_classes'::regclass
  ) then
    alter table public.pilates_classes
      add constraint pilates_classes_default_price_amount_non_negative
      check (default_price_amount >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'pilates_classes_currency_format'
      and conrelid = 'public.pilates_classes'::regclass
  ) then
    alter table public.pilates_classes
      add constraint pilates_classes_currency_format
      check (
        currency = upper(currency)
        and char_length(currency) = 3
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'pilates_class_schedules_price_amount_non_negative'
      and conrelid = 'public.pilates_class_schedules'::regclass
  ) then
    alter table public.pilates_class_schedules
      add constraint pilates_class_schedules_price_amount_non_negative
      check (price_amount is null or price_amount >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'pilates_class_schedules_currency_format'
      and conrelid = 'public.pilates_class_schedules'::regclass
  ) then
    alter table public.pilates_class_schedules
      add constraint pilates_class_schedules_currency_format
      check (
        currency is null
        or (
          currency = upper(currency)
          and char_length(currency) = 3
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'private_trainer_bookings_price_amount_non_negative'
      and conrelid = 'public.private_trainer_bookings'::regclass
  ) then
    alter table public.private_trainer_bookings
      add constraint private_trainer_bookings_price_amount_non_negative
      check (price_amount >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'private_trainer_bookings_currency_format'
      and conrelid = 'public.private_trainer_bookings'::regclass
  ) then
    alter table public.private_trainer_bookings
      add constraint private_trainer_bookings_currency_format
      check (
        currency = upper(currency)
        and char_length(currency) = 3
      );
  end if;
end
$$;

create index if not exists pilates_classes_currency_idx
  on public.pilates_classes (currency);

create index if not exists pilates_class_schedules_currency_idx
  on public.pilates_class_schedules (currency);

create index if not exists private_trainer_bookings_currency_idx
  on public.private_trainer_bookings (currency);

-- ---------------------------------------------------------------------------
-- Multi-time recurring schedule slots
-- ---------------------------------------------------------------------------

alter table public.pilates_schedule_series
  add column if not exists uses_multiple_time_slots boolean not null default false;

alter table public.pilates_schedule_series
  add column if not exists time_slot_count integer not null default 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pilates_schedule_series_time_slot_count_range'
      and conrelid = 'public.pilates_schedule_series'::regclass
  ) then
    alter table public.pilates_schedule_series
      add constraint pilates_schedule_series_time_slot_count_range
      check (time_slot_count between 1 and 24);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'pilates_schedule_series_multiple_time_slots_consistent'
      and conrelid = 'public.pilates_schedule_series'::regclass
  ) then
    alter table public.pilates_schedule_series
      add constraint pilates_schedule_series_multiple_time_slots_consistent
      check (
        (
          uses_multiple_time_slots = false
          and time_slot_count = 1
        )
        or
        (
          uses_multiple_time_slots = true
          and time_slot_count >= 2
        )
      );
  end if;
end
$$;

create table if not exists public.pilates_schedule_series_time_slots (
  id uuid primary key default gen_random_uuid(),

  series_id uuid not null
    references public.pilates_schedule_series(id)
    on update cascade
    on delete cascade,

  slot_index integer not null,

  studio text not null default 'LAFAM Pilates Studio',
  start_time time not null,
  end_time time not null,
  duration_minutes integer not null,
  capacity integer not null,

  price_amount numeric(12, 3),
  currency text default 'KWD',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint pilates_schedule_series_time_slots_slot_index_positive
    check (slot_index >= 1),

  constraint pilates_schedule_series_time_slots_studio_not_blank
    check (length(trim(studio)) > 0),

  constraint pilates_schedule_series_time_slots_studio_length
    check (char_length(studio) <= 120),

  constraint pilates_schedule_series_time_slots_time_order
    check (start_time < end_time),

  constraint pilates_schedule_series_time_slots_duration_range
    check (duration_minutes between 15 and 240),

  constraint pilates_schedule_series_time_slots_duration_matches_times
    check (
      extract(epoch from (end_time - start_time)) / 60 = duration_minutes
    ),

  constraint pilates_schedule_series_time_slots_capacity_range
    check (capacity between 1 and 100),

  constraint pilates_schedule_series_time_slots_price_non_negative
    check (price_amount is null or price_amount >= 0),

  constraint pilates_schedule_series_time_slots_currency_format
    check (
      currency is null
      or (
        currency = upper(currency)
        and char_length(currency) = 3
      )
    )
);

alter table public.pilates_class_schedules
  add column if not exists series_time_slot_id uuid
    references public.pilates_schedule_series_time_slots(id)
    on update cascade
    on delete set null;

alter table public.pilates_class_schedules
  add column if not exists series_date_index integer;

alter table public.pilates_class_schedules
  add column if not exists series_slot_index integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pilates_class_schedules_series_date_index_positive'
      and conrelid = 'public.pilates_class_schedules'::regclass
  ) then
    alter table public.pilates_class_schedules
      add constraint pilates_class_schedules_series_date_index_positive
      check (series_date_index is null or series_date_index >= 1);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'pilates_class_schedules_series_slot_index_positive'
      and conrelid = 'public.pilates_class_schedules'::regclass
  ) then
    alter table public.pilates_class_schedules
      add constraint pilates_class_schedules_series_slot_index_positive
      check (series_slot_index is null or series_slot_index >= 1);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'pilates_class_schedules_series_slot_reference_consistent'
      and conrelid = 'public.pilates_class_schedules'::regclass
  ) then
    alter table public.pilates_class_schedules
      add constraint pilates_class_schedules_series_slot_reference_consistent
      check (
        (
          series_time_slot_id is null
          and series_slot_index is null
        )
        or
        (
          series_time_slot_id is not null
          and series_id is not null
          and series_slot_index is not null
        )
      );
  end if;
end
$$;

create unique index if not exists pilates_schedule_series_time_slots_series_slot_uidx
  on public.pilates_schedule_series_time_slots (series_id, slot_index);

create unique index if not exists pilates_schedule_series_time_slots_series_time_uidx
  on public.pilates_schedule_series_time_slots (series_id, start_time, end_time);

create index if not exists pilates_schedule_series_time_slots_series_id_idx
  on public.pilates_schedule_series_time_slots (series_id);

create index if not exists pilates_schedule_series_time_slots_time_idx
  on public.pilates_schedule_series_time_slots (start_time, end_time);

create index if not exists pilates_class_schedules_series_time_slot_id_idx
  on public.pilates_class_schedules (series_time_slot_id);

create index if not exists pilates_class_schedules_series_date_slot_idx
  on public.pilates_class_schedules (series_id, series_date_index, series_slot_index);

drop trigger if exists trg_pilates_schedule_series_time_slots_set_updated_at
  on public.pilates_schedule_series_time_slots;

create trigger trg_pilates_schedule_series_time_slots_set_updated_at
before update on public.pilates_schedule_series_time_slots
for each row
execute function public.set_lafam_payment_updated_at();

alter table public.pilates_schedule_series_time_slots enable row level security;

-- ---------------------------------------------------------------------------
-- Payment tables
-- ---------------------------------------------------------------------------

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),

  payment_number text not null unique default public.build_lafam_payment_number(),
  receipt_number text unique,

  user_id uuid not null
    references public.app_users(id)
    on update cascade
    on delete restrict,

  target_type public.payment_target_type not null,

  booking_id uuid
    references public.bookings(id)
    on update cascade
    on delete restrict,

  private_booking_id uuid
    references public.private_trainer_bookings(id)
    on update cascade
    on delete restrict,

  amount numeric(12, 3) not null,
  discount_amount numeric(12, 3) not null default 0.000,
  final_amount numeric(12, 3) not null,

  currency text not null default 'KWD',

  payment_method public.payment_method not null,
  payment_provider public.payment_provider not null default 'mock',
  status public.payment_status not null default 'pending',

  gateway_reference text,
  gateway_payment_id text,
  gateway_invoice_id text,

  redirect_url text,
  callback_url text,

  webhook_verified_at timestamptz,

  paid_at timestamptz,
  failed_at timestamptz,
  cancelled_at timestamptz,
  expired_at timestamptz,
  refunded_at timestamptz,

  refunded_amount numeric(12, 3) not null default 0.000,

  expires_at timestamptz,

  idempotency_key text,

  failure_code text,
  failure_message text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  realtime_version bigint not null default 1,

  constraint payments_payment_number_not_blank
    check (length(trim(payment_number)) > 0),

  constraint payments_payment_number_length
    check (char_length(payment_number) <= 80),

  constraint payments_receipt_number_not_blank
    check (receipt_number is null or length(trim(receipt_number)) > 0),

  constraint payments_receipt_number_length
    check (receipt_number is null or char_length(receipt_number) <= 80),

  constraint payments_amount_non_negative
    check (amount >= 0),

  constraint payments_discount_amount_non_negative
    check (discount_amount >= 0),

  constraint payments_final_amount_non_negative
    check (final_amount >= 0),

  constraint payments_final_amount_matches_amount_discount
    check (final_amount = amount - discount_amount),

  constraint payments_refunded_amount_range
    check (refunded_amount >= 0 and refunded_amount <= final_amount),

  constraint payments_currency_format
    check (
      currency = upper(currency)
      and char_length(currency) = 3
    ),

  constraint payments_knet_currency_kwd
    check (
      payment_method <> 'knet'
      or currency = 'KWD'
    ),

  constraint payments_target_reference_valid
    check (
      (
        target_type = 'booking'
        and booking_id is not null
        and private_booking_id is null
      )
      or
      (
        target_type = 'private_booking'
        and booking_id is null
        and private_booking_id is not null
      )
      or
      (
        target_type = 'wallet_top_up'
        and booking_id is null
        and private_booking_id is null
      )
    ),

  constraint payments_wallet_method_provider_valid
    check (
      (
        payment_method = 'wallet'
        and payment_provider = 'wallet'
      )
      or
      (
        payment_method <> 'wallet'
        and payment_provider <> 'wallet'
      )
    ),

  constraint payments_wallet_top_up_method_valid
    check (
      target_type <> 'wallet_top_up'
      or payment_method <> 'wallet'
    ),

  constraint payments_external_redirect_state_valid
    check (
      status <> 'requires_redirect'
      or
      (
        payment_method in ('knet', 'card')
        and redirect_url is not null
      )
    ),

  constraint payments_paid_state_consistent
    check (
      status <> 'paid'
      or
      (
        paid_at is not null
        and failed_at is null
        and cancelled_at is null
        and expired_at is null
      )
    ),

  constraint payments_failed_state_consistent
    check (
      status <> 'failed'
      or failed_at is not null
    ),

  constraint payments_cancelled_state_consistent
    check (
      status <> 'cancelled'
      or cancelled_at is not null
    ),

  constraint payments_expired_state_consistent
    check (
      status <> 'expired'
      or expired_at is not null
    ),

  constraint payments_refunded_state_consistent
    check (
      status <> 'refunded'
      or
      (
        refunded_at is not null
        and refunded_amount = final_amount
      )
    ),

  constraint payments_idempotency_key_length
    check (idempotency_key is null or char_length(idempotency_key) <= 160),

  constraint payments_gateway_reference_length
    check (gateway_reference is null or char_length(gateway_reference) <= 255),

  constraint payments_gateway_payment_id_length
    check (gateway_payment_id is null or char_length(gateway_payment_id) <= 255),

  constraint payments_gateway_invoice_id_length
    check (gateway_invoice_id is null or char_length(gateway_invoice_id) <= 255),

  constraint payments_failure_code_length
    check (failure_code is null or char_length(failure_code) <= 120),

  constraint payments_failure_message_length
    check (failure_message is null or char_length(failure_message) <= 1000),

  constraint payments_metadata_object
    check (jsonb_typeof(metadata) = 'object'),

  constraint payments_realtime_version_positive
    check (realtime_version >= 1)
);

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),

  payment_id uuid not null
    references public.payments(id)
    on update cascade
    on delete cascade,

  transaction_type public.payment_transaction_type not null,
  transaction_status public.payment_transaction_status not null default 'pending',

  provider public.payment_provider not null default 'mock',
  provider_reference text,

  gateway_request jsonb not null default '{}'::jsonb,
  gateway_response jsonb not null default '{}'::jsonb,

  failure_code text,
  failure_message text,

  metadata jsonb not null default '{}'::jsonb,

  processed_at timestamptz,
  created_at timestamptz not null default now(),

  constraint payment_transactions_provider_reference_length
    check (provider_reference is null or char_length(provider_reference) <= 255),

  constraint payment_transactions_failure_code_length
    check (failure_code is null or char_length(failure_code) <= 120),

  constraint payment_transactions_failure_message_length
    check (failure_message is null or char_length(failure_message) <= 1000),

  constraint payment_transactions_gateway_request_object
    check (jsonb_typeof(gateway_request) = 'object'),

  constraint payment_transactions_gateway_response_object
    check (jsonb_typeof(gateway_response) = 'object'),

  constraint payment_transactions_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists payments_idempotency_key_uidx
  on public.payments (user_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists payments_user_id_idx
  on public.payments (user_id);

create index if not exists payments_target_type_idx
  on public.payments (target_type);

create index if not exists payments_booking_id_idx
  on public.payments (booking_id);

create index if not exists payments_private_booking_id_idx
  on public.payments (private_booking_id);

create index if not exists payments_method_status_idx
  on public.payments (payment_method, status);

create index if not exists payments_provider_status_idx
  on public.payments (payment_provider, status);

create index if not exists payments_status_created_at_idx
  on public.payments (status, created_at desc);

create index if not exists payments_gateway_reference_idx
  on public.payments (gateway_reference)
  where gateway_reference is not null;

create index if not exists payments_gateway_payment_id_idx
  on public.payments (gateway_payment_id)
  where gateway_payment_id is not null;

create index if not exists payments_expires_at_idx
  on public.payments (expires_at)
  where expires_at is not null;

create index if not exists payment_transactions_payment_id_idx
  on public.payment_transactions (payment_id);

create index if not exists payment_transactions_type_status_idx
  on public.payment_transactions (transaction_type, transaction_status);

create index if not exists payment_transactions_provider_reference_idx
  on public.payment_transactions (provider_reference)
  where provider_reference is not null;

create index if not exists payment_transactions_created_at_idx
  on public.payment_transactions (created_at desc);

drop trigger if exists trg_payments_set_updated_at on public.payments;

create trigger trg_payments_set_updated_at
before update on public.payments
for each row
execute function public.set_lafam_payment_realtime_updated_at();

alter table public.payments enable row level security;
alter table public.payment_transactions enable row level security;

-- ---------------------------------------------------------------------------
-- Wallet tables
-- ---------------------------------------------------------------------------

create table if not exists public.wallet_accounts (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references public.app_users(id)
    on update cascade
    on delete restrict,

  currency text not null default 'KWD',

  available_balance numeric(12, 3) not null default 0.000,
  pending_balance numeric(12, 3) not null default 0.000,

  status public.wallet_account_status not null default 'active',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  realtime_version bigint not null default 1,

  constraint wallet_accounts_currency_format
    check (
      currency = upper(currency)
      and char_length(currency) = 3
    ),

  constraint wallet_accounts_available_balance_non_negative
    check (available_balance >= 0),

  constraint wallet_accounts_pending_balance_non_negative
    check (pending_balance >= 0),

  constraint wallet_accounts_realtime_version_positive
    check (realtime_version >= 1)
);

create table if not exists public.wallet_ledger_entries (
  id uuid primary key default gen_random_uuid(),

  wallet_account_id uuid not null
    references public.wallet_accounts(id)
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

  booking_id uuid
    references public.bookings(id)
    on update cascade
    on delete set null,

  private_booking_id uuid
    references public.private_trainer_bookings(id)
    on update cascade
    on delete set null,

  entry_type public.wallet_ledger_entry_type not null,
  entry_status public.wallet_ledger_entry_status not null default 'posted',

  amount numeric(12, 3) not null,
  balance_before numeric(12, 3) not null,
  balance_after numeric(12, 3) not null,

  description text,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  constraint wallet_ledger_entries_amount_positive
    check (amount > 0),

  constraint wallet_ledger_entries_balance_before_non_negative
    check (balance_before >= 0),

  constraint wallet_ledger_entries_balance_after_non_negative
    check (balance_after >= 0),

  constraint wallet_ledger_entries_description_length
    check (description is null or char_length(description) <= 1000),

  constraint wallet_ledger_entries_metadata_object
    check (jsonb_typeof(metadata) = 'object'),

  constraint wallet_ledger_entries_target_reference_valid
    check (
      (
        entry_type in ('booking_payment', 'private_booking_payment')
        and payment_id is not null
      )
      or
      (
        entry_type not in ('booking_payment', 'private_booking_payment')
      )
    )
);

create unique index if not exists wallet_accounts_user_currency_uidx
  on public.wallet_accounts (user_id, currency);

create index if not exists wallet_accounts_user_id_idx
  on public.wallet_accounts (user_id);

create index if not exists wallet_accounts_status_idx
  on public.wallet_accounts (status);

create index if not exists wallet_ledger_entries_wallet_account_id_idx
  on public.wallet_ledger_entries (wallet_account_id);

create index if not exists wallet_ledger_entries_user_id_idx
  on public.wallet_ledger_entries (user_id);

create index if not exists wallet_ledger_entries_payment_id_idx
  on public.wallet_ledger_entries (payment_id)
  where payment_id is not null;

create index if not exists wallet_ledger_entries_booking_id_idx
  on public.wallet_ledger_entries (booking_id)
  where booking_id is not null;

create index if not exists wallet_ledger_entries_private_booking_id_idx
  on public.wallet_ledger_entries (private_booking_id)
  where private_booking_id is not null;

create index if not exists wallet_ledger_entries_created_at_idx
  on public.wallet_ledger_entries (created_at desc);

create unique index if not exists wallet_ledger_entries_payment_type_posted_uidx
  on public.wallet_ledger_entries (payment_id, entry_type)
  where payment_id is not null
    and entry_status = 'posted';

drop trigger if exists trg_wallet_accounts_set_updated_at on public.wallet_accounts;

create trigger trg_wallet_accounts_set_updated_at
before update on public.wallet_accounts
for each row
execute function public.set_lafam_payment_realtime_updated_at();

alter table public.wallet_accounts enable row level security;
alter table public.wallet_ledger_entries enable row level security;

-- ---------------------------------------------------------------------------
-- Basic promo-code support
-- ---------------------------------------------------------------------------

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),

  code text not null,
  description text,

  discount_type public.promo_discount_type not null,
  discount_value numeric(12, 3) not null,
  max_discount_amount numeric(12, 3),

  starts_at timestamptz,
  ends_at timestamptz,

  max_redemptions integer,
  per_user_limit integer,

  redemption_count integer not null default 0,

  status public.promo_code_status not null default 'active',

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

  constraint promo_codes_code_not_blank
    check (length(trim(code)) > 0),

  constraint promo_codes_code_length
    check (char_length(code) <= 80),

  constraint promo_codes_description_length
    check (description is null or char_length(description) <= 1000),

  constraint promo_codes_discount_value_positive
    check (discount_value > 0),

  constraint promo_codes_percentage_discount_range
    check (
      discount_type <> 'percentage'
      or discount_value <= 100
    ),

  constraint promo_codes_max_discount_amount_positive
    check (max_discount_amount is null or max_discount_amount > 0),

  constraint promo_codes_date_order
    check (
      starts_at is null
      or ends_at is null
      or starts_at <= ends_at
    ),

  constraint promo_codes_max_redemptions_positive
    check (max_redemptions is null or max_redemptions >= 1),

  constraint promo_codes_per_user_limit_positive
    check (per_user_limit is null or per_user_limit >= 1),

  constraint promo_codes_redemption_count_non_negative
    check (redemption_count >= 0),

  constraint promo_codes_redemption_count_within_max
    check (
      max_redemptions is null
      or redemption_count <= max_redemptions
    ),

  constraint promo_codes_deleted_state_consistent
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

create table if not exists public.payment_discounts (
  id uuid primary key default gen_random_uuid(),

  payment_id uuid not null
    references public.payments(id)
    on update cascade
    on delete cascade,

  promo_code_id uuid
    references public.promo_codes(id)
    on update cascade
    on delete set null,

  code text not null,
  discount_amount numeric(12, 3) not null,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  constraint payment_discounts_code_not_blank
    check (length(trim(code)) > 0),

  constraint payment_discounts_code_length
    check (char_length(code) <= 80),

  constraint payment_discounts_discount_amount_positive
    check (discount_amount > 0),

  constraint payment_discounts_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists promo_codes_code_active_uidx
  on public.promo_codes (upper(code))
  where status <> 'deleted';

create index if not exists promo_codes_status_idx
  on public.promo_codes (status);

create index if not exists promo_codes_active_window_idx
  on public.promo_codes (starts_at, ends_at)
  where status = 'active';

create index if not exists payment_discounts_payment_id_idx
  on public.payment_discounts (payment_id);

create index if not exists payment_discounts_promo_code_id_idx
  on public.payment_discounts (promo_code_id)
  where promo_code_id is not null;

drop trigger if exists trg_promo_codes_set_updated_at on public.promo_codes;

create trigger trg_promo_codes_set_updated_at
before update on public.promo_codes
for each row
execute function public.set_lafam_payment_updated_at();

alter table public.promo_codes enable row level security;
alter table public.payment_discounts enable row level security;

-- ---------------------------------------------------------------------------
-- Booking domain event payment relation
-- ---------------------------------------------------------------------------

alter table public.booking_domain_events
  add column if not exists payment_id uuid
    references public.payments(id)
    on update cascade
    on delete set null;

create index if not exists booking_domain_events_payment_id_idx
  on public.booking_domain_events (payment_id)
  where payment_id is not null;

-- ---------------------------------------------------------------------------
-- Atomic payment functions
-- ---------------------------------------------------------------------------

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
  p_idempotency_key text default null,
  p_redirect_url text default null,
  p_callback_url text default null,
  p_gateway_reference text default null,
  p_gateway_payment_id text default null,
  p_gateway_invoice_id text default null,
  p_expires_at timestamptz default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  payment_id uuid,
  payment_number text,
  target_type public.payment_target_type,
  booking_id uuid,
  private_booking_id uuid,
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

  if p_target_type = 'wallet_top_up' and p_payment_method = 'wallet' then
    raise exception 'Wallet top-up cannot be paid by wallet.';
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

  if p_target_type = 'booking' then
    if p_booking_id is null or p_private_booking_id is not null then
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
  elsif p_target_type = 'private_booking' then
    if p_private_booking_id is null or p_booking_id is not null then
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
  elsif p_target_type = 'wallet_top_up' then
    if p_booking_id is not null or p_private_booking_id is not null then
      raise exception 'Wallet top-up payment target cannot reference bookings.';
    end if;

    if p_final_amount <= 0 then
      raise exception 'Wallet top-up amount must be greater than zero.';
    end if;
  else
    raise exception 'Unsupported payment target type.';
  end if;

  v_status :=
    case
      when p_payment_method in ('knet', 'card') then 'requires_redirect'::public.payment_status
      else 'pending'::public.payment_status
    end;

  if v_status = 'requires_redirect' and nullif(trim(coalesce(p_redirect_url, '')), '') is null then
    raise exception 'Hosted payment redirect URL is required for external payments.';
  end if;

  insert into public.payments (
    user_id,
    target_type,
    booking_id,
    private_booking_id,
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
      'provider', v_payment.payment_provider
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
    v_payment.status,
    v_payment.payment_method,
    v_payment.payment_provider,
    v_payment.final_amount,
    v_payment.currency,
    v_payment.redirect_url,
    v_payment.expires_at;
end;
$$;

create or replace function public.credit_wallet_atomic(
  p_user_id uuid,
  p_amount numeric,
  p_currency text default 'KWD',
  p_payment_id uuid default null,
  p_description text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  wallet_account_id uuid,
  ledger_entry_id uuid,
  available_balance numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.wallet_accounts%rowtype;
  v_ledger public.wallet_ledger_entries%rowtype;
  v_currency text;
  v_metadata jsonb;
  v_existing_ledger public.wallet_ledger_entries%rowtype;
begin
  if p_user_id is null then
    raise exception 'Wallet credit user_id is required.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Wallet credit amount must be greater than zero.';
  end if;

  v_currency := upper(trim(coalesce(p_currency, 'KWD')));

  if char_length(v_currency) <> 3 then
    raise exception 'Wallet currency must be a 3-letter uppercase currency code.';
  end if;

  v_metadata := coalesce(p_metadata, '{}'::jsonb);

  if jsonb_typeof(v_metadata) <> 'object' then
    raise exception 'Wallet credit metadata must be a JSON object.';
  end if;

  if p_payment_id is not null then
    select *
    into v_existing_ledger
    from public.wallet_ledger_entries
    where payment_id = p_payment_id
      and entry_type = 'wallet_top_up'
      and entry_status = 'posted'
    limit 1;

    if found then
      select *
      into v_wallet
      from public.wallet_accounts
      where id = v_existing_ledger.wallet_account_id;

      return query
      select
        v_wallet.id,
        v_existing_ledger.id,
        v_wallet.available_balance;
      return;
    end if;
  end if;

  insert into public.wallet_accounts (
    user_id,
    currency,
    available_balance,
    pending_balance,
    status
  )
  values (
    p_user_id,
    v_currency,
    0.000,
    0.000,
    'active'
  )
  on conflict (user_id, currency)
  do nothing;

  select *
  into v_wallet
  from public.wallet_accounts
  where user_id = p_user_id
    and currency = v_currency
  for update;

  if not found then
    raise exception 'Wallet account could not be created.';
  end if;

  if v_wallet.status <> 'active' then
    raise exception 'Wallet account is not active.';
  end if;

  insert into public.wallet_ledger_entries (
    wallet_account_id,
    user_id,
    payment_id,
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
    p_user_id,
    p_payment_id,
    'wallet_top_up',
    'posted',
    p_amount,
    v_wallet.available_balance,
    v_wallet.available_balance + p_amount,
    p_description,
    v_metadata
  )
  returning *
  into v_ledger;

  update public.wallet_accounts
  set available_balance = available_balance + p_amount
  where id = v_wallet.id
  returning *
  into v_wallet;

  return query
  select
    v_wallet.id,
    v_ledger.id,
    v_wallet.available_balance;
end;
$$;

create or replace function public.mark_payment_paid_atomic(
  p_payment_id uuid,
  p_provider_reference text default null,
  p_gateway_response jsonb default '{}'::jsonb,
  p_webhook_verified boolean default false
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
  v_gateway_response jsonb;
begin
  if p_payment_id is null then
    raise exception 'Payment id is required.';
  end if;

  v_gateway_response := coalesce(p_gateway_response, '{}'::jsonb);

  if jsonb_typeof(v_gateway_response) <> 'object' then
    raise exception 'Gateway response must be a JSON object.';
  end if;

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

  update public.payments
  set
    status = 'paid',
    receipt_number = coalesce(receipt_number, public.build_lafam_receipt_number()),
    gateway_reference = coalesce(nullif(trim(coalesce(p_provider_reference, '')), ''), gateway_reference),
    webhook_verified_at = case when p_webhook_verified then now() else webhook_verified_at end,
    paid_at = now(),
    failed_at = null,
    cancelled_at = null,
    expired_at = null
  where id = v_payment.id
  returning *
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
    coalesce(nullif(trim(coalesce(p_provider_reference, '')), ''), v_payment.gateway_reference),
    v_gateway_response,
    now()
  );

  if v_payment.target_type = 'booking' then
    select *
    into v_booking
    from public.bookings
    where id = v_payment.booking_id
    for update;

    if not found then
      raise exception 'Target booking was not found.';
    end if;

    update public.bookings
    set
      status = 'confirmed',
      payment_status = 'paid',
      seat_hold_expires_at = null,
      confirmed_at = coalesce(confirmed_at, now())
    where id = v_booking.id
      and status = 'pending_payment'
      and payment_status = 'pending'
    returning *
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
        'booking_confirmed',
        'pending_payment',
        'confirmed',
        'Payment completed.',
        jsonb_build_object(
          'payment_id', v_payment.id,
          'payment_number', v_payment.payment_number,
          'receipt_number', v_payment.receipt_number
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
        payment_id,
        payload
      )
      values (
        'booking.payment_paid',
        v_booking.schedule_id,
        v_booking.id,
        v_payment.id,
        jsonb_build_object(
          'booking_id', v_booking.id,
          'payment_id', v_payment.id,
          'receipt_number', v_payment.receipt_number
        )
      );
    end if;
  elsif v_payment.target_type = 'private_booking' then
    select *
    into v_private_booking
    from public.private_trainer_bookings
    where id = v_payment.private_booking_id
    for update;

    if not found then
      raise exception 'Target private trainer booking was not found.';
    end if;

    update public.private_trainer_bookings
    set
      status = 'confirmed',
      payment_status = 'paid',
      seat_hold_expires_at = null,
      confirmed_at = coalesce(confirmed_at, now())
    where id = v_private_booking.id
      and status = 'pending_payment'
      and payment_status = 'pending'
    returning *
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
        'private_booking_confirmed',
        'pending_payment',
        'confirmed',
        'Payment completed.',
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
        'private_booking.payment_paid',
        v_private_booking.id,
        v_payment.id,
        jsonb_build_object(
          'private_booking_id', v_private_booking.id,
          'payment_id', v_payment.id,
          'receipt_number', v_payment.receipt_number
        )
      );
    end if;
  elsif v_payment.target_type = 'wallet_top_up' then
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

create or replace function public.mark_payment_failed_atomic(
  p_payment_id uuid,
  p_failure_code text default null,
  p_failure_message text default null,
  p_gateway_response jsonb default '{}'::jsonb
)
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
  v_gateway_response jsonb;
begin
  if p_payment_id is null then
    raise exception 'Payment id is required.';
  end if;

  v_gateway_response := coalesce(p_gateway_response, '{}'::jsonb);

  if jsonb_typeof(v_gateway_response) <> 'object' then
    raise exception 'Gateway response must be a JSON object.';
  end if;

  select *
  into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment was not found.';
  end if;

  if v_payment.status = 'paid' then
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
      'ignored',
      v_payment.payment_provider,
      v_payment.gateway_reference,
      jsonb_build_object(
        'ignored_reason', 'paid_status_is_terminal',
        'incoming_status', 'failed'
      ),
      now()
    );

    return query
    select
      v_payment.id,
      v_payment.target_type,
      v_payment.booking_id,
      v_payment.private_booking_id,
      v_payment.status;
    return;
  end if;

  if v_payment.status in ('failed', 'cancelled', 'expired', 'refunded') then
    return query
    select
      v_payment.id,
      v_payment.target_type,
      v_payment.booking_id,
      v_payment.private_booking_id,
      v_payment.status;
    return;
  end if;

  update public.payments
  set
    status = 'failed',
    failed_at = now(),
    failure_code = nullif(trim(coalesce(p_failure_code, '')), ''),
    failure_message = nullif(trim(coalesce(p_failure_message, '')), '')
  where id = v_payment.id
  returning *
  into v_payment;

  insert into public.payment_transactions (
    payment_id,
    transaction_type,
    transaction_status,
    provider,
    provider_reference,
    gateway_response,
    failure_code,
    failure_message,
    processed_at
  )
  values (
    v_payment.id,
    'verification',
    'failed',
    v_payment.payment_provider,
    v_payment.gateway_reference,
    v_gateway_response,
    v_payment.failure_code,
    v_payment.failure_message,
    now()
  );

  if v_payment.target_type = 'booking' then
    update public.bookings
    set
      status = 'expired',
      payment_status = 'failed',
      seat_hold_expires_at = null
    where id = v_payment.booking_id
      and status = 'pending_payment'
      and payment_status = 'pending'
    returning *
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
        'Payment failed and booking hold was released.',
        jsonb_build_object(
          'payment_id', v_payment.id,
          'failure_code', v_payment.failure_code,
          'failure_message', v_payment.failure_message
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
        payment_id,
        payload
      )
      values (
        'booking.payment_failed',
        v_booking.schedule_id,
        v_booking.id,
        v_payment.id,
        jsonb_build_object(
          'booking_id', v_booking.id,
          'payment_id', v_payment.id
        )
      );
    end if;
  elsif v_payment.target_type = 'private_booking' then
    update public.private_trainer_bookings
    set
      status = 'expired',
      payment_status = 'failed',
      seat_hold_expires_at = null
    where id = v_payment.private_booking_id
      and status = 'pending_payment'
      and payment_status = 'pending'
    returning *
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
        'Payment failed and private booking hold was released.',
        jsonb_build_object(
          'payment_id', v_payment.id,
          'failure_code', v_payment.failure_code,
          'failure_message', v_payment.failure_message
        )
      );

      insert into public.booking_domain_events (
        event_type,
        private_booking_id,
        payment_id,
        payload
      )
      values (
        'private_booking.payment_failed',
        v_private_booking.id,
        v_payment.id,
        jsonb_build_object(
          'private_booking_id', v_private_booking.id,
          'payment_id', v_payment.id
        )
      );
    end if;
  end if;

  return query
  select
    v_payment.id,
    v_payment.target_type,
    v_payment.booking_id,
    v_payment.private_booking_id,
    v_payment.status;
end;
$$;

create or replace function public.mark_payment_cancelled_atomic(
  p_payment_id uuid,
  p_reason text default null,
  p_gateway_response jsonb default '{}'::jsonb
)
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
  v_gateway_response jsonb;
begin
  if p_payment_id is null then
    raise exception 'Payment id is required.';
  end if;

  v_gateway_response := coalesce(p_gateway_response, '{}'::jsonb);

  if jsonb_typeof(v_gateway_response) <> 'object' then
    raise exception 'Gateway response must be a JSON object.';
  end if;

  select *
  into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment was not found.';
  end if;

  if v_payment.status = 'paid' then
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
      'ignored',
      v_payment.payment_provider,
      v_payment.gateway_reference,
      jsonb_build_object(
        'ignored_reason', 'paid_status_is_terminal',
        'incoming_status', 'cancelled'
      ),
      now()
    );

    return query
    select
      v_payment.id,
      v_payment.target_type,
      v_payment.booking_id,
      v_payment.private_booking_id,
      v_payment.status;
    return;
  end if;

  if v_payment.status in ('failed', 'cancelled', 'expired', 'refunded') then
    return query
    select
      v_payment.id,
      v_payment.target_type,
      v_payment.booking_id,
      v_payment.private_booking_id,
      v_payment.status;
    return;
  end if;

  update public.payments
  set
    status = 'cancelled',
    cancelled_at = now(),
    failure_message = nullif(trim(coalesce(p_reason, '')), '')
  where id = v_payment.id
  returning *
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

  if v_payment.target_type = 'booking' then
    update public.bookings
    set
      status = 'expired',
      payment_status = 'expired',
      seat_hold_expires_at = null
    where id = v_payment.booking_id
      and status = 'pending_payment'
      and payment_status = 'pending'
    returning *
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
        coalesce(p_reason, 'Payment was cancelled and booking hold was released.'),
        jsonb_build_object(
          'payment_id', v_payment.id
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
        payment_id,
        payload
      )
      values (
        'booking.payment_cancelled',
        v_booking.schedule_id,
        v_booking.id,
        v_payment.id,
        jsonb_build_object(
          'booking_id', v_booking.id,
          'payment_id', v_payment.id
        )
      );
    end if;
  elsif v_payment.target_type = 'private_booking' then
    update public.private_trainer_bookings
    set
      status = 'expired',
      payment_status = 'expired',
      seat_hold_expires_at = null
    where id = v_payment.private_booking_id
      and status = 'pending_payment'
      and payment_status = 'pending'
    returning *
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
        coalesce(p_reason, 'Payment was cancelled and private booking hold was released.'),
        jsonb_build_object(
          'payment_id', v_payment.id
        )
      );

      insert into public.booking_domain_events (
        event_type,
        private_booking_id,
        payment_id,
        payload
      )
      values (
        'private_booking.payment_cancelled',
        v_private_booking.id,
        v_payment.id,
        jsonb_build_object(
          'private_booking_id', v_private_booking.id,
          'payment_id', v_payment.id
        )
      );
    end if;
  end if;

  return query
  select
    v_payment.id,
    v_payment.target_type,
    v_payment.booking_id,
    v_payment.private_booking_id,
    v_payment.status;
end;
$$;

create or replace function public.debit_wallet_for_booking_atomic(
  p_payment_id uuid,
  p_description text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  payment_id uuid,
  wallet_account_id uuid,
  ledger_entry_id uuid,
  available_balance numeric,
  booking_id uuid,
  private_booking_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_wallet public.wallet_accounts%rowtype;
  v_ledger public.wallet_ledger_entries%rowtype;
  v_booking public.bookings%rowtype;
  v_private_booking public.private_trainer_bookings%rowtype;
  v_entry_type public.wallet_ledger_entry_type;
  v_metadata jsonb;
begin
  if p_payment_id is null then
    raise exception 'Payment id is required.';
  end if;

  v_metadata := coalesce(p_metadata, '{}'::jsonb);

  if jsonb_typeof(v_metadata) <> 'object' then
    raise exception 'Wallet debit metadata must be a JSON object.';
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

  if v_payment.target_type not in ('booking', 'private_booking') then
    raise exception 'Wallet debit is only supported for booking payments.';
  end if;

  if v_payment.status = 'paid' then
    select *
    into v_ledger
    from public.wallet_ledger_entries
    where payment_id = v_payment.id
      and entry_type in ('booking_payment', 'private_booking_payment')
      and entry_status = 'posted'
    limit 1;

    select *
    into v_wallet
    from public.wallet_accounts
    where id = v_ledger.wallet_account_id;

    return query
    select
      v_payment.id,
      v_wallet.id,
      v_ledger.id,
      v_wallet.available_balance,
      v_payment.booking_id,
      v_payment.private_booking_id;
    return;
  end if;

  if v_payment.status <> 'pending' then
    raise exception 'Wallet payment is not pending.';
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

  if v_payment.target_type = 'booking' then
    select *
    into v_booking
    from public.bookings
    where id = v_payment.booking_id
    for update;

    if not found then
      raise exception 'Target booking was not found.';
    end if;

    if v_booking.status <> 'pending_payment' or v_booking.payment_status <> 'pending' then
      raise exception 'Target booking is not pending payment.';
    end if;

    v_entry_type := 'booking_payment';
  else
    select *
    into v_private_booking
    from public.private_trainer_bookings
    where id = v_payment.private_booking_id
    for update;

    if not found then
      raise exception 'Target private trainer booking was not found.';
    end if;

    if v_private_booking.status <> 'pending_payment' or v_private_booking.payment_status <> 'pending' then
      raise exception 'Target private trainer booking is not pending payment.';
    end if;

    v_entry_type := 'private_booking_payment';
  end if;

  insert into public.wallet_ledger_entries (
    wallet_account_id,
    user_id,
    payment_id,
    booking_id,
    private_booking_id,
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
    v_payment.booking_id,
    v_payment.private_booking_id,
    v_entry_type,
    'posted',
    v_payment.final_amount,
    v_wallet.available_balance,
    v_wallet.available_balance - v_payment.final_amount,
    coalesce(p_description, 'Wallet payment completed.'),
    v_metadata
  )
  returning *
  into v_ledger;

  update public.wallet_accounts
  set available_balance = available_balance - v_payment.final_amount
  where id = v_wallet.id
  returning *
  into v_wallet;

  update public.payments
  set
    status = 'paid',
    receipt_number = coalesce(receipt_number, public.build_lafam_receipt_number()),
    paid_at = now()
  where id = v_payment.id
  returning *
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
      'available_balance', v_wallet.available_balance
    ),
    now()
  );

  if v_payment.target_type = 'booking' then
    update public.bookings
    set
      status = 'confirmed',
      payment_status = 'paid',
      seat_hold_expires_at = null,
      confirmed_at = coalesce(confirmed_at, now())
    where id = v_payment.booking_id
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
      'Wallet payment completed.',
      jsonb_build_object(
        'payment_id', v_payment.id,
        'wallet_ledger_entry_id', v_ledger.id,
        'receipt_number', v_payment.receipt_number
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
      payment_id,
      payload
    )
    values (
      'booking.wallet_paid',
      v_booking.schedule_id,
      v_booking.id,
      v_payment.id,
      jsonb_build_object(
        'booking_id', v_booking.id,
        'payment_id', v_payment.id,
        'wallet_ledger_entry_id', v_ledger.id
      )
    );
  else
    update public.private_trainer_bookings
    set
      status = 'confirmed',
      payment_status = 'paid',
      seat_hold_expires_at = null,
      confirmed_at = coalesce(confirmed_at, now())
    where id = v_payment.private_booking_id
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
      'Wallet payment completed.',
      jsonb_build_object(
        'payment_id', v_payment.id,
        'wallet_ledger_entry_id', v_ledger.id,
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
      'private_booking.wallet_paid',
      v_private_booking.id,
      v_payment.id,
      jsonb_build_object(
        'private_booking_id', v_private_booking.id,
        'payment_id', v_payment.id,
        'wallet_ledger_entry_id', v_ledger.id
      )
    );
  end if;

  return query
  select
    v_payment.id,
    v_wallet.id,
    v_ledger.id,
    v_wallet.available_balance,
    v_payment.booking_id,
    v_payment.private_booking_id;
end;
$$;

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
begin
  for v_payment in
    select *
    from public.payments
    where status in ('pending', 'requires_redirect', 'processing')
      and expires_at is not null
      and expires_at <= now()
    order by expires_at asc, created_at asc
    for update skip locked
  loop
    update public.payments
    set
      status = 'expired',
      expired_at = now()
    where id = v_payment.id
    returning *
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

    if v_payment.target_type = 'booking' then
      update public.bookings
      set
        status = 'expired',
        payment_status = 'expired',
        seat_hold_expires_at = null
      where id = v_payment.booking_id
        and status = 'pending_payment'
        and payment_status = 'pending'
      returning *
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

        update public.pilates_class_schedules
        set
          updated_at = now(),
          realtime_version = realtime_version + 1
        where id = v_booking.schedule_id;

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
    elsif v_payment.target_type = 'private_booking' then
      update public.private_trainer_bookings
      set
        status = 'expired',
        payment_status = 'expired',
        seat_hold_expires_at = null
      where id = v_payment.private_booking_id
        and status = 'pending_payment'
        and payment_status = 'pending'
      returning *
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

create or replace function public.refund_payment_atomic(
  p_payment_id uuid,
  p_actor_admin_id uuid default null,
  p_reason text default null,
  p_gateway_response jsonb default '{}'::jsonb
)
returns table (
  payment_id uuid,
  status public.payment_status,
  refunded_amount numeric,
  refunded_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_wallet public.wallet_accounts%rowtype;
  v_ledger public.wallet_ledger_entries%rowtype;
  v_gateway_response jsonb;
  v_entry_type public.wallet_ledger_entry_type;
begin
  if p_payment_id is null then
    raise exception 'Payment id is required.';
  end if;

  v_gateway_response := coalesce(p_gateway_response, '{}'::jsonb);

  if jsonb_typeof(v_gateway_response) <> 'object' then
    raise exception 'Gateway response must be a JSON object.';
  end if;

  select *
  into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment was not found.';
  end if;

  if v_payment.status = 'refunded' then
    return query
    select
      v_payment.id,
      v_payment.status,
      v_payment.refunded_amount,
      v_payment.refunded_at;
    return;
  end if;

  if v_payment.status <> 'paid' then
    raise exception 'Only paid payments can be refunded.';
  end if;

  if v_payment.payment_method = 'wallet' then
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

    insert into public.wallet_ledger_entries (
      wallet_account_id,
      user_id,
      payment_id,
      booking_id,
      private_booking_id,
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
      v_payment.booking_id,
      v_payment.private_booking_id,
      'refund_credit',
      'posted',
      v_payment.final_amount,
      v_wallet.available_balance,
      v_wallet.available_balance + v_payment.final_amount,
      coalesce(p_reason, 'Wallet payment refunded.'),
      jsonb_build_object(
        'actor_admin_id', p_actor_admin_id,
        'payment_id', v_payment.id
      )
    )
    returning *
    into v_ledger;

    update public.wallet_accounts
    set available_balance = available_balance + v_payment.final_amount
    where id = v_wallet.id;
  end if;

  update public.payments
  set
    status = 'refunded',
    refunded_amount = final_amount,
    refunded_at = now()
  where id = v_payment.id
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
    'refund_processed',
    'succeeded',
    v_payment.payment_provider,
    v_payment.gateway_reference,
    v_gateway_response,
    jsonb_build_object(
      'actor_admin_id', p_actor_admin_id,
      'reason', p_reason,
      'wallet_ledger_entry_id', case when v_ledger.id is null then null else v_ledger.id end
    ),
    now()
  );

  if v_payment.target_type = 'booking' then
    update public.bookings
    set payment_status = 'refunded'
    where id = v_payment.booking_id
      and payment_status = 'paid';

    insert into public.booking_domain_events (
      event_type,
      booking_id,
      payment_id,
      payload
    )
    values (
      'booking.payment_refunded',
      v_payment.booking_id,
      v_payment.id,
      jsonb_build_object(
        'payment_id', v_payment.id,
        'refunded_amount', v_payment.refunded_amount,
        'actor_admin_id', p_actor_admin_id
      )
    );
  elsif v_payment.target_type = 'private_booking' then
    update public.private_trainer_bookings
    set payment_status = 'refunded'
    where id = v_payment.private_booking_id
      and payment_status = 'paid';

    insert into public.booking_domain_events (
      event_type,
      private_booking_id,
      payment_id,
      payload
    )
    values (
      'private_booking.payment_refunded',
      v_payment.private_booking_id,
      v_payment.id,
      jsonb_build_object(
        'payment_id', v_payment.id,
        'refunded_amount', v_payment.refunded_amount,
        'actor_admin_id', p_actor_admin_id
      )
    );
  end if;

  return query
  select
    v_payment.id,
    v_payment.status,
    v_payment.refunded_amount,
    v_payment.refunded_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function permissions
-- ---------------------------------------------------------------------------

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
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  jsonb
) from public, anon, authenticated;

revoke all on function public.mark_payment_paid_atomic(uuid, text, jsonb, boolean)
  from public, anon, authenticated;

revoke all on function public.mark_payment_failed_atomic(uuid, text, text, jsonb)
  from public, anon, authenticated;

revoke all on function public.mark_payment_cancelled_atomic(uuid, text, jsonb)
  from public, anon, authenticated;

revoke all on function public.expire_payment_intents_atomic()
  from public, anon, authenticated;

revoke all on function public.debit_wallet_for_booking_atomic(uuid, text, jsonb)
  from public, anon, authenticated;

revoke all on function public.credit_wallet_atomic(uuid, numeric, text, uuid, text, jsonb)
  from public, anon, authenticated;

revoke all on function public.refund_payment_atomic(uuid, uuid, text, jsonb)
  from public, anon, authenticated;

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
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  jsonb
) to service_role;

grant execute on function public.mark_payment_paid_atomic(uuid, text, jsonb, boolean)
  to service_role;

grant execute on function public.mark_payment_failed_atomic(uuid, text, text, jsonb)
  to service_role;

grant execute on function public.mark_payment_cancelled_atomic(uuid, text, jsonb)
  to service_role;

grant execute on function public.expire_payment_intents_atomic()
  to service_role;

grant execute on function public.debit_wallet_for_booking_atomic(uuid, text, jsonb)
  to service_role;

grant execute on function public.credit_wallet_atomic(uuid, numeric, text, uuid, text, jsonb)
  to service_role;

grant execute on function public.refund_payment_atomic(uuid, uuid, text, jsonb)
  to service_role;

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------

comment on table public.payments is
  'Backend-owned payment intents and payment lifecycle records for booking, private trainer booking, and wallet top-up targets.';

comment on table public.payment_transactions is
  'Append-only payment gateway and wallet transaction log used for callbacks, webhooks, verification, reconciliation, and debugging.';

comment on table public.wallet_accounts is
  'One wallet account per user and currency. Balance changes must go through atomic wallet functions only.';

comment on table public.wallet_ledger_entries is
  'Append-only wallet ledger. Every wallet balance change is recorded here with before and after balances.';

comment on table public.promo_codes is
  'Basic promo-code definitions for checkout discounts. This does not implement loyalty, cashback, or marketing automation.';

comment on table public.payment_discounts is
  'Discount records applied to payments for audit and receipt reconstruction.';

comment on table public.pilates_schedule_series_time_slots is
  'Normalized time slots for recurring Pilates schedule series. Enables admins to create several time slots from one recurring schedule request.';

comment on column public.pilates_classes.default_price_amount is
  'Backend-owned default class price. Schedule-level price_amount overrides this value when present.';

comment on column public.pilates_class_schedules.price_amount is
  'Optional backend-owned schedule price override. If null, services should use the class default price.';

comment on column public.private_trainer_bookings.price_amount is
  'Backend-owned price for private trainer booking checkout. Services must not trust frontend-provided payment amounts.';

comment on column public.pilates_class_schedules.series_time_slot_id is
  'Nullable reference to the recurring series time slot that generated this concrete bookable schedule occurrence.';

comment on column public.booking_domain_events.payment_id is
  'Optional relation to payments for future payment-driven notification and reporting events.';

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
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  jsonb
) is
  'Atomically creates a local payment intent after validating the target booking/private booking/wallet top-up state.';

comment on function public.mark_payment_paid_atomic(uuid, text, jsonb, boolean) is
  'Atomically marks a payment as paid, confirms the payable booking/private booking, or credits wallet top-up balance.';

comment on function public.mark_payment_failed_atomic(uuid, text, text, jsonb) is
  'Atomically marks a payment as failed and releases pending booking/private booking holds when applicable.';

comment on function public.mark_payment_cancelled_atomic(uuid, text, jsonb) is
  'Atomically marks a payment as cancelled and releases pending booking/private booking holds when applicable.';

comment on function public.expire_payment_intents_atomic() is
  'Expires stale payment intents and releases pending payable booking/private booking holds.';

comment on function public.debit_wallet_for_booking_atomic(uuid, text, jsonb) is
  'Atomically debits a user wallet for a pending booking/private booking payment and confirms the payable target.';

comment on function public.credit_wallet_atomic(uuid, numeric, text, uuid, text, jsonb) is
  'Atomically credits a user wallet, primarily for successful wallet top-up payments.';

comment on function public.refund_payment_atomic(uuid, uuid, text, jsonb) is
  'Atomically records a full payment refund and credits wallet refunds when the original method was wallet.';