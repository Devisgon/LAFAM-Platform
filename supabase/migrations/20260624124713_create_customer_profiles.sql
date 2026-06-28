-- supabase/migrations/20260624124713_create_customer_profiles.sql

/**
 * LAFAM Customer Profile Tables
 *
 * Purpose:
 * - Stores customer business identity separately from authentication identity.
 * - Links every customer profile to the existing public.app_users table.
 * - Stores Civil ID for admin/customer identity verification and fast lookup.
 * - Keeps email, phone, auth identity, role, status, and sessions owned by Auth/app_users.
 *
 * Important:
 * - Passwords are never stored here.
 * - Login identity remains in Supabase auth.users.
 * - Platform identity remains in public.app_users.
 * - Customer business identity lives in public.customer_profiles.
 * - Civil ID is sensitive PII and must not be written into audit metadata or logs.
 * - RLS is enabled and no public policies are added because the NestJS backend
 *   must remain the authority for privileged customer mutations.
 */

begin;

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

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),

  app_user_id uuid not null
    references public.app_users(id)
    on update cascade
    on delete restrict,

  civil_id text not null,
  civil_id_normalized text not null,

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

  constraint customer_profiles_app_user_id_unique
    unique (app_user_id),

  constraint customer_profiles_civil_id_normalized_unique
    unique (civil_id_normalized),

  constraint customer_profiles_civil_id_not_blank
    check (length(trim(civil_id)) > 0),

  constraint customer_profiles_civil_id_length
    check (char_length(civil_id) <= 32),

  constraint customer_profiles_civil_id_allowed_characters
    check (civil_id ~ '^[0-9 -]+$'),

  constraint customer_profiles_civil_id_normalized_not_blank
    check (length(trim(civil_id_normalized)) > 0),

  constraint customer_profiles_civil_id_normalized_format
    check (civil_id_normalized ~ '^[0-9]{12}$'),

  constraint customer_profiles_civil_id_normalization_consistent
    check (civil_id_normalized = regexp_replace(civil_id, '[^0-9]', '', 'g'))
);

comment on table public.customer_profiles is
  'Customer business identity records linked one-to-one with public.app_users.';

comment on column public.customer_profiles.app_user_id is
  'References the platform user identity in public.app_users.';

comment on column public.customer_profiles.civil_id is
  'Admin-visible customer Civil ID value. Sensitive PII; do not log.';

comment on column public.customer_profiles.civil_id_normalized is
  'Normalized 12-digit Civil ID used for exact lookup and uniqueness. Sensitive PII; do not log.';

comment on column public.customer_profiles.created_by_admin_id is
  'Admin app user who created this customer profile, when created by admin.';

comment on column public.customer_profiles.updated_by_admin_id is
  'Admin app user who last updated this customer profile.';

create unique index if not exists app_users_non_guest_active_phone_uidx
  on public.app_users (phone)
  where phone is not null
    and is_guest = false
    and status <> 'deleted'
    and deleted_at is null;

create index if not exists customer_profiles_app_user_id_idx
  on public.customer_profiles (app_user_id);

create index if not exists customer_profiles_created_by_admin_id_idx
  on public.customer_profiles (created_by_admin_id)
  where created_by_admin_id is not null;

create index if not exists customer_profiles_updated_by_admin_id_idx
  on public.customer_profiles (updated_by_admin_id)
  where updated_by_admin_id is not null;

create index if not exists customer_profiles_deleted_at_idx
  on public.customer_profiles (deleted_at);

create index if not exists customer_profiles_created_at_idx
  on public.customer_profiles (created_at desc);

drop trigger if exists set_customer_profiles_updated_at on public.customer_profiles;

create trigger set_customer_profiles_updated_at
before update on public.customer_profiles
for each row
execute function public.set_lafam_updated_at();

alter table public.customer_profiles enable row level security;

commit;