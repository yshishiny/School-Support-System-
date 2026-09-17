-- Morning routine snaps (sandwich, bag), screen-time screenshots, the morning log, and an hourly scheduler inside the database.
alter table public.snap_tasks drop constraint if exists snap_tasks_kind_check;
alter table public.snap_tasks add constraint snap_tasks_kind_check check (kind in ('photo','homework','handwriting','bag','screentime'));
alter table public.snaps drop constraint if exists snaps_kind_check;
alter table public.snaps add constraint snaps_kind_check check (kind in ('photo','homework','handwriting','bag','screentime'));

alter table public.families add column screen_limit_minutes int not null default 180;

create table public.morning_log (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  ready_at timestamptz,          -- "I'm ready, leaving on time"
  champion_at timestamptz,       -- every morning item done before school: +10 once
  created_at timestamptz not null default now(),
  unique (student_id, day)
);
alter table public.morning_log enable row level security;
create policy morning_log_family_select on public.morning_log for select to authenticated using (app_private.student_in_family(student_id));

-- Settings the server writes for database-side jobs (service role only; no policies).
create table public.ops_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.ops_settings enable row level security;

-- Hourly reminders without an external scheduler: pg_cron calls the app's nudges endpoint once the secret is stored.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule(
  'study-portal-nudges-hourly',
  '5 * * * *',
  $$
  select net.http_get(
    url := (select value from public.ops_settings where key = 'app_url') || '/api/cron/nudges',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select value from public.ops_settings where key = 'cron_secret')),
    timeout_milliseconds := 60000
  )
  where exists (select 1 from public.ops_settings where key = 'cron_secret')
    and exists (select 1 from public.ops_settings where key = 'app_url');
  $$
);
