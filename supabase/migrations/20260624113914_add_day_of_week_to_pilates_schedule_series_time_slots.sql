alter table public.pilates_schedule_series_time_slots
  add column if not exists day_of_week integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pilates_schedule_series_time_slots_day_of_week_range'
      and conrelid = 'public.pilates_schedule_series_time_slots'::regclass
  ) then
    alter table public.pilates_schedule_series_time_slots
      add constraint pilates_schedule_series_time_slots_day_of_week_range
      check (day_of_week is null or day_of_week between 0 and 6);
  end if;
end
$$;

comment on column public.pilates_schedule_series_time_slots.day_of_week is
  'Weekday ownership for weekly-plan time slots. Uses 0 = Sunday through 6 = Saturday; null preserves legacy series slots.';

drop index if exists public.pilates_schedule_series_time_slots_series_time_uidx;

create unique index if not exists pilates_schedule_series_time_slots_legacy_series_time_uidx
  on public.pilates_schedule_series_time_slots (series_id, start_time, end_time)
  where day_of_week is null;

create unique index if not exists pilates_schedule_series_time_slots_weekday_time_uidx
  on public.pilates_schedule_series_time_slots (series_id, day_of_week, start_time, end_time)
  where day_of_week is not null;

create index if not exists pilates_schedule_series_time_slots_series_weekday_slot_idx
  on public.pilates_schedule_series_time_slots (series_id, day_of_week, slot_index);
