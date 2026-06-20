-- supabase\migrations\20260620131155_fix_create_payment_intent_atomic_status_argument.sql
--
-- Problem:
-- The NestJS PaymentRepository passes p_status into create_payment_intent_atomic,
-- but the existing database function signature does not accept p_status.
--
-- Correct behavior:
-- The backend must be able to create an initial pending payment intent before
-- the hosted payment provider returns redirect_url/gateway references.
-- After the provider responds, the service updates the payment to requires_redirect.

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

  if p_target_type = 'wallet_top_up' and p_payment_method = 'wallet' then
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
  jsonb
) from public, anon, authenticated;

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
  jsonb
) to service_role;

notify pgrst, 'reload schema';