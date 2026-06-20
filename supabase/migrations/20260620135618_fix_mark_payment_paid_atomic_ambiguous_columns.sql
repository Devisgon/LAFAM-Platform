-- supabase\migrations\20260620135618_fix_mark_payment_paid_atomic_ambiguous_columns.sql
--
-- Problem:
-- mark_payment_paid_atomic returns a column named receipt_number.
-- In PL/pgSQL, RETURNS TABLE output columns are variables inside the function.
-- The previous function body used:
--
--   receipt_number = coalesce(receipt_number, public.build_lafam_receipt_number())
--
-- That makes receipt_number ambiguous because it can refer to either:
-- - the function output variable receipt_number
-- - the public.payments.receipt_number table column
--
-- Fix:
-- Recreate the same RPC signature and use the locked v_payment row as the
-- source for fallback payment values.

begin;

create or replace function public.mark_payment_paid_atomic(
  p_payment_id uuid,
  p_provider_reference text default null,
  p_gateway_payment_id text default null,
  p_gateway_invoice_id text default null,
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

  update public.payments
  set
    status = 'paid',
    receipt_number = coalesce(
      v_payment.receipt_number,
      public.build_lafam_receipt_number()
    ),
    gateway_reference = coalesce(
      v_provider_reference,
      v_payment.gateway_reference
    ),
    gateway_payment_id = coalesce(
      v_gateway_payment_id,
      v_payment.gateway_payment_id
    ),
    gateway_invoice_id = coalesce(
      v_gateway_invoice_id,
      v_payment.gateway_invoice_id
    ),
    webhook_verified_at = case
      when p_webhook_verified then now()
      else v_payment.webhook_verified_at
    end,
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
    v_payment.gateway_reference,
    v_gateway_response,
    now()
  );

  if v_payment.target_type = 'booking' then
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

  elsif v_payment.target_type = 'private_booking' then
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

revoke all on function public.mark_payment_paid_atomic(
  uuid,
  text,
  text,
  text,
  jsonb,
  boolean,
  public.payment_status
) from public, anon, authenticated;

grant execute on function public.mark_payment_paid_atomic(
  uuid,
  text,
  text,
  text,
  jsonb,
  boolean,
  public.payment_status
) to service_role;

comment on function public.mark_payment_paid_atomic(
  uuid,
  text,
  text,
  text,
  jsonb,
  boolean,
  public.payment_status
) is
  'Atomically marks a payment as paid, stores gateway identifiers, confirms the payable booking/private booking, or credits wallet top-up balance.';

notify pgrst, 'reload schema';

commit;