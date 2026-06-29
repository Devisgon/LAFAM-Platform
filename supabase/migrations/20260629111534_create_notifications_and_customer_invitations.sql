-- supabase/migrations/20260629111534_create_notifications_and_customer_invitations.sql

/**
 * LAFAM Notifications + Customer Invitation Foundation
 *
 * Purpose:
 * - Adds LAFAM-owned customer invitation records.
 * - Adds a backend-owned email notification outbox.
 * - Adds delivery-attempt tracking for Brevo or any future email provider.
 * - Keeps invite tokens, email delivery state, and feature modules decoupled.
 *
 * Security rules:
 * - Raw invite tokens must never be stored here.
 * - token_hash stores only a backend-generated hash.
 * - Civil ID must never be stored in notification metadata/payload.
 * - Passwords must never be stored or emailed.
 * - Provider API keys and raw provider secrets must never be stored here.
 * - RLS is enabled and no public policies are added because NestJS remains the authority.
 */

begin;

create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_lafam_updated_at()
returns trigger
language plpgsql
as
$$
begin
  new.updated_at = now();
  return new;
end;
$$;

/**
 * app_users.status is intentionally application-controlled text in the current
 * schema, not a PostgreSQL enum.
 *
 * The new invited customer state will be stored as:
 *
 *   app_users.status = 'invited'
 *
 * Backend constants, DTOs, repositories, and Swagger will be updated in the
 * source files. No enum migration is required here.
 */

do
$$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'customer_invitation_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.customer_invitation_status as enum (
      'pending',
      'accepted',
      'expired',
      'revoked'
    );
  end if;
end
$$;

do
$$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'email_notification_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.email_notification_status as enum (
      'pending',
      'sending',
      'sent',
      'failed',
      'skipped',
      'cancelled'
    );
  end if;
end
$$;

do
$$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'email_delivery_attempt_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.email_delivery_attempt_status as enum (
      'succeeded',
      'failed',
      'skipped'
    );
  end if;
end
$$;

do
$$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'email_recipient_role'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.email_recipient_role as enum (
      'customer',
      'admin',
      'trainer',
      'staff',
      'system'
    );
  end if;
end
$$;

do
$$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'email_notification_event'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.email_notification_event as enum (
      'customer_invite_created',
      'customer_invite_resent',
      'customer_invite_expiring_soon',
      'customer_invite_expired',
      'customer_invite_accepted',
      'admin_created_customer_with_password_welcome',
      'password_changed',
      'account_deactivated_by_admin',
      'account_reactivated_by_admin',
      'account_deleted_or_closed',

      'booking_created_pending_payment',
      'booking_confirmed_after_payment',
      'booking_cancelled_by_customer',
      'booking_cancelled_by_admin',
      'booking_rescheduled_by_customer',
      'booking_rescheduled_by_admin',
      'booking_completed',
      'booking_marked_no_show',
      'booking_expired_due_to_unpaid_payment',

      'waitlist_joined',
      'waitlist_cancelled_by_customer',
      'waitlist_removed_by_admin',
      'waitlist_promoted_to_booking',
      'waitlist_promotion_payment_required',
      'waitlist_promotion_expiring_soon',
      'waitlist_promotion_expired',
      'class_space_available',

      'payment_checkout_created_optional',
      'payment_success_receipt',
      'payment_failed',
      'payment_cancelled',
      'payment_expired',
      'payment_refunded',
      'payment_refund_failed_or_manual_review_required',
      'payment_duplicate_callback_ignored_admin_only_if_suspicious',

      'wallet_top_up_success',
      'wallet_top_up_failed',
      'wallet_top_up_expired',
      'wallet_booking_debit_success',
      'wallet_refund_credit_success',
      'wallet_admin_adjustment_credit',
      'wallet_admin_adjustment_debit',
      'wallet_low_balance_optional',

      'private_booking_created_pending_payment',
      'private_booking_confirmed_after_payment',
      'private_booking_cancelled_by_customer',
      'private_booking_cancelled_by_admin',
      'private_booking_rescheduled_by_customer',
      'private_booking_rescheduled_by_admin',
      'private_booking_reminder_24_hours_before',
      'private_booking_reminder_2_hours_before',
      'private_booking_refunded',
      'private_booking_expired_due_to_unpaid_payment',

      'trainer_account_created_with_password',
      'trainer_availability_updated',
      'trainer_assigned_to_class',
      'trainer_removed_from_class',
      'trainer_schedule_changed',
      'trainer_booking_cancelled',
      'trainer_daily_schedule_summary'
    );
  end if;
end
$$;

create table if not exists public.customer_invitations (
  id uuid primary key default gen_random_uuid(),

  app_user_id uuid not null
    references public.app_users(id)
    on update cascade
    on delete restrict,

  customer_profile_id uuid not null
    references public.customer_profiles(id)
    on update cascade
    on delete restrict,

  email text not null,
  token_hash text not null,
  status public.customer_invitation_status not null default 'pending',

  invited_by_admin_id uuid
    references public.app_users(id)
    on update cascade
    on delete set null,

  revoked_by_admin_id uuid
    references public.app_users(id)
    on update cascade
    on delete set null,

  invited_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  expired_at timestamptz,
  revoked_at timestamptz,

  resend_count integer not null default 0,
  last_sent_at timestamptz,
  revoked_reason text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint customer_invitations_email_not_blank
    check (length(btrim(email)) between 3 and 320),

  constraint customer_invitations_email_has_at
    check (position('@' in email) > 1),

  constraint customer_invitations_token_hash_format
    check (token_hash ~ '^[a-f0-9]{64}$'),

  constraint customer_invitations_expiry_after_invite
    check (expires_at > invited_at),

  constraint customer_invitations_resend_count_non_negative
    check (resend_count >= 0),

  constraint customer_invitations_revoked_reason_length
    check (revoked_reason is null or length(btrim(revoked_reason)) between 1 and 500),

  constraint customer_invitations_metadata_is_object
    check (jsonb_typeof(metadata) = 'object'),

  constraint customer_invitations_status_timestamp_consistency
    check (
      (
        status = 'pending'
        and accepted_at is null
        and expired_at is null
        and revoked_at is null
      )
      or (
        status = 'accepted'
        and accepted_at is not null
        and expired_at is null
        and revoked_at is null
      )
      or (
        status = 'expired'
        and accepted_at is null
        and expired_at is not null
        and revoked_at is null
      )
      or (
        status = 'revoked'
        and accepted_at is null
        and expired_at is null
        and revoked_at is not null
      )
    )
);

create unique index if not exists customer_invitations_token_hash_uidx
  on public.customer_invitations (token_hash);

create unique index if not exists customer_invitations_pending_app_user_uidx
  on public.customer_invitations (app_user_id)
  where status = 'pending';

create unique index if not exists customer_invitations_pending_customer_profile_uidx
  on public.customer_invitations (customer_profile_id)
  where status = 'pending';

create index if not exists customer_invitations_app_user_status_idx
  on public.customer_invitations (app_user_id, status);

create index if not exists customer_invitations_customer_profile_status_idx
  on public.customer_invitations (customer_profile_id, status);

create index if not exists customer_invitations_email_status_idx
  on public.customer_invitations (lower(email), status);

create index if not exists customer_invitations_pending_expiry_idx
  on public.customer_invitations (expires_at)
  where status = 'pending';

create table if not exists public.email_notifications (
  id uuid primary key default gen_random_uuid(),

  event_type public.email_notification_event not null,
  recipient_role public.email_recipient_role not null,

  recipient_app_user_id uuid
    references public.app_users(id)
    on update cascade
    on delete set null,

  recipient_email text not null,
  recipient_name text,

  subject text not null,
  html_content text not null,
  text_content text not null,

  status public.email_notification_status not null default 'pending',
  provider text not null default 'brevo',

  entity_type text,
  entity_id uuid,

  idempotency_key text,

  scheduled_for timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,

  attempt_count integer not null default 0,
  max_attempts integer not null default 3,

  sent_at timestamptz,
  failed_at timestamptz,
  skipped_at timestamptz,
  cancelled_at timestamptz,

  provider_message_id text,
  failure_code text,
  failure_message text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint email_notifications_recipient_email_not_blank
    check (length(btrim(recipient_email)) between 3 and 320),

  constraint email_notifications_recipient_email_has_at
    check (position('@' in recipient_email) > 1),

  constraint email_notifications_recipient_name_length
    check (recipient_name is null or length(btrim(recipient_name)) between 1 and 150),

  constraint email_notifications_subject_length
    check (length(btrim(subject)) between 1 and 255),

  constraint email_notifications_html_content_not_blank
    check (length(btrim(html_content)) between 1 and 200000),

  constraint email_notifications_text_content_not_blank
    check (length(btrim(text_content)) between 1 and 50000),

  constraint email_notifications_provider_length
    check (length(btrim(provider)) between 1 and 50),

  constraint email_notifications_entity_type_length
    check (entity_type is null or length(btrim(entity_type)) between 1 and 100),

  constraint email_notifications_idempotency_key_length
    check (idempotency_key is null or length(btrim(idempotency_key)) between 1 and 200),

  constraint email_notifications_attempt_count_non_negative
    check (attempt_count >= 0),

  constraint email_notifications_max_attempts_positive
    check (max_attempts between 1 and 20),

  constraint email_notifications_attempt_count_not_over_max
    check (attempt_count <= max_attempts),

  constraint email_notifications_locked_by_length
    check (locked_by is null or length(btrim(locked_by)) between 1 and 100),

  constraint email_notifications_failure_code_length
    check (failure_code is null or length(btrim(failure_code)) between 1 and 100),

  constraint email_notifications_failure_message_length
    check (failure_message is null or length(btrim(failure_message)) between 1 and 1000),

  constraint email_notifications_metadata_is_object
    check (jsonb_typeof(metadata) = 'object'),

  constraint email_notifications_status_timestamp_consistency
    check (
      (
        status in ('pending', 'sending')
        and sent_at is null
        and failed_at is null
        and skipped_at is null
        and cancelled_at is null
      )
      or (
        status = 'sent'
        and sent_at is not null
      )
      or (
        status = 'failed'
        and failed_at is not null
      )
      or (
        status = 'skipped'
        and skipped_at is not null
      )
      or (
        status = 'cancelled'
        and cancelled_at is not null
      )
    )
);

create unique index if not exists email_notifications_idempotency_key_uidx
  on public.email_notifications (idempotency_key)
  where idempotency_key is not null;

create index if not exists email_notifications_status_scheduled_idx
  on public.email_notifications (status, scheduled_for);

create index if not exists email_notifications_recipient_app_user_idx
  on public.email_notifications (recipient_app_user_id, created_at desc);

create index if not exists email_notifications_recipient_email_idx
  on public.email_notifications (lower(recipient_email), created_at desc);

create index if not exists email_notifications_event_entity_idx
  on public.email_notifications (event_type, entity_type, entity_id);

create index if not exists email_notifications_provider_message_idx
  on public.email_notifications (provider, provider_message_id)
  where provider_message_id is not null;

create table if not exists public.email_delivery_attempts (
  id uuid primary key default gen_random_uuid(),

  email_notification_id uuid not null
    references public.email_notifications(id)
    on update cascade
    on delete cascade,

  attempt_number integer not null,
  provider text not null default 'brevo',
  status public.email_delivery_attempt_status not null,

  provider_message_id text,
  provider_request_id text,
  provider_status_code integer,

  error_code text,
  error_message text,

  safe_response_metadata jsonb not null default '{}'::jsonb,

  attempted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint email_delivery_attempts_attempt_number_positive
    check (attempt_number >= 1),

  constraint email_delivery_attempts_provider_length
    check (length(btrim(provider)) between 1 and 50),

  constraint email_delivery_attempts_provider_status_code_range
    check (provider_status_code is null or provider_status_code between 100 and 599),

  constraint email_delivery_attempts_provider_message_id_length
    check (provider_message_id is null or length(btrim(provider_message_id)) between 1 and 255),

  constraint email_delivery_attempts_provider_request_id_length
    check (provider_request_id is null or length(btrim(provider_request_id)) between 1 and 255),

  constraint email_delivery_attempts_error_code_length
    check (error_code is null or length(btrim(error_code)) between 1 and 100),

  constraint email_delivery_attempts_error_message_length
    check (error_message is null or length(btrim(error_message)) between 1 and 1000),

  constraint email_delivery_attempts_safe_response_metadata_is_object
    check (jsonb_typeof(safe_response_metadata) = 'object')
);

create unique index if not exists email_delivery_attempts_notification_attempt_uidx
  on public.email_delivery_attempts (email_notification_id, attempt_number);

create index if not exists email_delivery_attempts_notification_created_idx
  on public.email_delivery_attempts (email_notification_id, created_at desc);

create index if not exists email_delivery_attempts_provider_status_idx
  on public.email_delivery_attempts (provider, status, created_at desc);

do
$$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_customer_invitations_updated_at'
      and tgrelid = 'public.customer_invitations'::regclass
  ) then
    create trigger set_customer_invitations_updated_at
    before update on public.customer_invitations
    for each row
    execute function public.set_lafam_updated_at();
  end if;
end
$$;

do
$$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_email_notifications_updated_at'
      and tgrelid = 'public.email_notifications'::regclass
  ) then
    create trigger set_email_notifications_updated_at
    before update on public.email_notifications
    for each row
    execute function public.set_lafam_updated_at();
  end if;
end
$$;

alter table public.customer_invitations enable row level security;
alter table public.email_notifications enable row level security;
alter table public.email_delivery_attempts enable row level security;

comment on table public.customer_invitations is
  'Stores LAFAM-owned customer invitation lifecycle records. Raw invite tokens are never stored; only token_hash is persisted.';

comment on column public.customer_invitations.token_hash is
  'SHA-256 hash of the invite token. Raw invite token must never be stored or logged.';

comment on column public.customer_invitations.metadata is
  'Safe invitation metadata only. Must not contain Civil ID, passwords, raw invite tokens, full invite URLs, OTPs, cookies, or provider secrets.';

comment on table public.email_notifications is
  'Backend-owned email notification outbox for Brevo and future email providers. Feature modules create notification intents here instead of calling providers directly.';

comment on column public.email_notifications.html_content is
  'Rendered safe HTML email body. Must not contain Civil ID, passwords, OTPs, raw tokens, cookies, or secrets.';

comment on column public.email_notifications.text_content is
  'Rendered safe plain-text email body. Must not contain Civil ID, passwords, OTPs, raw tokens, cookies, or secrets.';

comment on column public.email_notifications.metadata is
  'Safe notification metadata only. Must not contain Civil ID, passwords, raw invite tokens, full invite URLs, OTPs, cookies, provider secrets, or raw provider payloads.';

comment on table public.email_delivery_attempts is
  'Stores safe email provider delivery attempts. Raw provider secrets and full raw provider payloads must not be stored.';

comment on column public.email_delivery_attempts.safe_response_metadata is
  'Safe provider response summary only. Do not store raw provider payloads if they contain secrets or personal data.';

notify pgrst, 'reload schema';

commit;