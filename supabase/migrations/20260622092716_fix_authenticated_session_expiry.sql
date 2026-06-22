begin;

update public.auth_sessions as session
set expires_at =
  greatest(
    session.created_at,
    coalesce(session.last_seen_at, session.created_at)
  ) + interval '24 hours'
from public.app_users as app_user
where app_user.id = session.user_id
  and session.session_type in ('authenticated', 'admin', 'staff')
  and session.revoked_at is null
  and session.converted_at is null
  and app_user.is_guest = false
  and app_user.status = 'active'
  and greatest(
    session.created_at,
    coalesce(session.last_seen_at, session.created_at)
  ) + interval '24 hours' > now()
  and session.expires_at is distinct from (
    greatest(
      session.created_at,
      coalesce(session.last_seen_at, session.created_at)
    ) + interval '24 hours'
  );

update public.auth_sessions as session
set expires_at =
  greatest(
    session.created_at,
    coalesce(session.last_seen_at, session.created_at)
  ) + interval '24 hours'
from public.app_users as app_user
where app_user.id = session.user_id
  and session.session_type in ('authenticated', 'admin', 'staff')
  and session.revoked_at is null
  and session.converted_at is null
  and app_user.is_guest = false
  and app_user.status = 'active'
  and greatest(
    session.created_at,
    coalesce(session.last_seen_at, session.created_at)
  ) + interval '24 hours' <= now()
  and (
    session.expires_at is null
    or session.expires_at > now()
  );

commit;
