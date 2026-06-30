-- supabase\migrations\20260630111307_allow_invited_app_user_status.sql

begin;

alter table public.app_users
  drop constraint if exists app_users_guest_consistency_check;

alter table public.app_users
  drop constraint if exists app_users_status_check;

alter table public.app_users
  add constraint app_users_status_check
    check (
      status in (
        'guest_active',
        'pending_email_verification',
        'invited',
        'active',
        'deactivated',
        'deleted'
      )
    );

alter table public.app_users
  add constraint app_users_guest_consistency_check
    check (
      (
        is_guest = true
        and role = 'guest'
        and status in ('guest_active', 'deleted')
        and guest_expires_at is not null
      )
      or
      (
        is_guest = false
        and role <> 'guest'
        and status in (
          'pending_email_verification',
          'invited',
          'active',
          'deactivated',
          'deleted'
        )
      )
    );

commit;