-- supabase\migrations\20260620153423_fix_expire_payment_intents_atomic_ambiguous_status.sql
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

    if v_payment.target_type = 'booking' then
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
    elsif v_payment.target_type = 'private_booking' then
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

comment on function public.expire_payment_intents_atomic() is
  'Atomically expires unpaid payment intents and releases related booking holds.';

notify pgrst, 'reload schema';