-- Prayer tracking and Telegram delivery for the daily report.
alter table public.families
  add column telegram_chat_id text,
  add column latitude double precision not null default 30.0444,   -- Cairo
  add column longitude double precision not null default 31.2357;

create type public.prayer_name as enum ('fajr', 'dhuhr', 'asr', 'maghrib', 'isha');
create type public.prayer_status as enum ('on_time', 'late');

create table public.prayer_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  log_date date not null,
  prayer public.prayer_name not null,
  status public.prayer_status not null,
  logged_at timestamptz not null default now(),
  unique (student_id, log_date, prayer)
);
create index prayer_logs_student_date_idx on public.prayer_logs(student_id, log_date desc);

alter table public.prayer_logs enable row level security;
create policy prayer_logs_select on public.prayer_logs for select to authenticated using (app_private.student_in_family(student_id));
-- writes go through the server (service role) so the on-time rule cannot be bypassed
