-- supabase\migrations\20260620143006_fix_payment_wallet_rpc_contracts_and_ambiguous_columns.sql
--
-- Purpose:
-- Fix payment/wallet RPC runtime ambiguity caused by RETURNS TABLE output
-- column names colliding with unqualified table column references.
--
-- Also fixes backend/database RPC contract drift for:
-- - mark_payment_failed_atomic(p_next_status)
-- - mark_payment_cancelled_atomic(p_next_status)
-- - refund_payment_atomic(p_refund_amount)
--
-- Do not edit older applied migrations. This migration replaces the active
-- function definitions safely.

begin;

create or replace function public.credit_wallet_atomic(
  p_user_id uuid,
  p_amount numeric,
  p_currency text default 'KWD'::text,
  p_payment_id uuid default null::uuid,
  p_description text default null::text,
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

      if not found then
        raise exception 'Wallet account was not found for existing wallet credit ledger entry.';
      end if;

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
  set available_balance = v_wallet.available_balance + p_amount
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

create or replace function public.debit_wallet_for_booking_atomic(
  p_payment_id uuid,
  p_description text default null::text,
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

    if not found then
      raise exception 'Wallet payment is marked paid but posted debit ledger entry was not found.';
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
  set available_balance = v_wallet.available_balance - v_payment.final_amount
  where id = v_wallet.id
  returning *
  into v_wallet;

  update public.payments
  set
    status = 'paid',
    receipt_number = coalesce(
      v_payment.receipt_number,
      public.build_lafam_receipt_number()
    ),
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
      confirmed_at = coalesce(v_booking.confirmed_at, now())
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
      confirmed_at = coalesce(v_private_booking.confirmed_at, now())
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

drop function if exists public.mark_payment_failed_atomic(
  uuid,
  text,
  text,
  jsonb,
  public.payment_status
);

drop function if exists public.mark_payment_failed_atomic(
  uuid,
  text,
  text,
  jsonb
);

create or replace function public.mark_payment_failed_atomic(
  p_payment_id uuid,
  p_failure_code text default null::text,
  p_failure_message text default null::text,
  p_gateway_response jsonb default '{}'::jsonb,
  p_next_status public.payment_status default 'failed'::public.payment_status
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

  if coalesce(p_next_status, 'failed'::public.payment_status) <> 'failed'::public.payment_status then
    raise exception 'mark_payment_failed_atomic only supports failed next status.';
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

drop function if exists public.mark_payment_cancelled_atomic(
  uuid,
  text,
  jsonb,
  public.payment_status
);

drop function if exists public.mark_payment_cancelled_atomic(
  uuid,
  text,
  jsonb
);

create or replace function public.mark_payment_cancelled_atomic(
  p_payment_id uuid,
  p_reason text default null::text,
  p_gateway_response jsonb default '{}'::jsonb,
  p_next_status public.payment_status default 'cancelled'::public.payment_status
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

  if coalesce(p_next_status, 'cancelled'::public.payment_status) <> 'cancelled'::public.payment_status then
    raise exception 'mark_payment_cancelled_atomic only supports cancelled next status.';
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

drop function if exists public.refund_payment_atomic(
  uuid,
  uuid,
  text,
  numeric,
  jsonb
);

drop function if exists public.refund_payment_atomic(
  uuid,
  uuid,
  text,
  jsonb
);

create or replace function public.refund_payment_atomic(
  p_payment_id uuid,
  p_actor_admin_id uuid default null::uuid,
  p_reason text default null::text,
  p_refund_amount numeric default null::numeric,
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
  v_refund_amount numeric;
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

  v_refund_amount := coalesce(p_refund_amount, v_payment.final_amount);

  if v_refund_amount <= 0 then
    raise exception 'Refund amount must be greater than zero.';
  end if;

  if v_refund_amount > v_payment.final_amount then
    raise exception 'Refund amount cannot exceed the payment final amount.';
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
      v_refund_amount,
      v_wallet.available_balance,
      v_wallet.available_balance + v_refund_amount,
      coalesce(p_reason, 'Wallet payment refunded.'),
      jsonb_build_object(
        'actor_admin_id', p_actor_admin_id,
        'payment_id', v_payment.id,
        'refund_amount', v_refund_amount
      )
    )
    returning *
    into v_ledger;

    update public.wallet_accounts
    set available_balance = v_wallet.available_balance + v_refund_amount
    where id = v_wallet.id
    returning *
    into v_wallet;
  end if;

  update public.payments
  set
    status = 'refunded',
    refunded_amount = v_refund_amount,
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
      'refund_amount', v_refund_amount,
      'wallet_ledger_entry_id', case
        when v_ledger.id is null then null
        else v_ledger.id
      end
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

revoke all on function public.credit_wallet_atomic(
  uuid,
  numeric,
  text,
  uuid,
  text,
  jsonb
) from public, anon, authenticated;

revoke all on function public.debit_wallet_for_booking_atomic(
  uuid,
  text,
  jsonb
) from public, anon, authenticated;

revoke all on function public.mark_payment_failed_atomic(
  uuid,
  text,
  text,
  jsonb,
  public.payment_status
) from public, anon, authenticated;

revoke all on function public.mark_payment_cancelled_atomic(
  uuid,
  text,
  jsonb,
  public.payment_status
) from public, anon, authenticated;

revoke all on function public.refund_payment_atomic(
  uuid,
  uuid,
  text,
  numeric,
  jsonb
) from public, anon, authenticated;

grant execute on function public.credit_wallet_atomic(
  uuid,
  numeric,
  text,
  uuid,
  text,
  jsonb
) to service_role;

grant execute on function public.debit_wallet_for_booking_atomic(
  uuid,
  text,
  jsonb
) to service_role;

grant execute on function public.mark_payment_failed_atomic(
  uuid,
  text,
  text,
  jsonb,
  public.payment_status
) to service_role;

grant execute on function public.mark_payment_cancelled_atomic(
  uuid,
  text,
  jsonb,
  public.payment_status
) to service_role;

grant execute on function public.refund_payment_atomic(
  uuid,
  uuid,
  text,
  numeric,
  jsonb
) to service_role;

comment on function public.credit_wallet_atomic(
  uuid,
  numeric,
  text,
  uuid,
  text,
  jsonb
) is
  'Atomically credits a customer wallet and returns the posted ledger entry and updated balance.';

comment on function public.debit_wallet_for_booking_atomic(
  uuid,
  text,
  jsonb
) is
  'Atomically debits wallet balance for booking/private booking payments and confirms the target booking.';

comment on function public.mark_payment_failed_atomic(
  uuid,
  text,
  text,
  jsonb,
  public.payment_status
) is
  'Atomically marks a payment as failed and releases the related payment hold.';

comment on function public.mark_payment_cancelled_atomic(
  uuid,
  text,
  jsonb,
  public.payment_status
) is
  'Atomically marks a payment as cancelled and releases the related payment hold.';

comment on function public.refund_payment_atomic(
  uuid,
  uuid,
  text,
  numeric,
  jsonb
) is
  'Atomically records a payment refund and credits wallet balance when refunding wallet-paid bookings.';

notify pgrst, 'reload schema';

commit;