-- Operations: every caught error, every cron run, and who administers the system.
alter table public.profiles add column is_admin boolean not null default false;

create table public.app_errors (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  area text not null,               -- 'materials.read', 'snaps.check', 'cron.prepare-plan', 'client', …
  message text not null,
  stack text,
  meta jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index app_errors_created_idx on public.app_errors(created_at desc);
create index app_errors_open_idx on public.app_errors(area) where resolved_at is null;
alter table public.app_errors enable row level security;
create policy app_errors_admin_select on public.app_errors for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create table public.cron_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null,
  started_at timestamptz not null,
  finished_at timestamptz not null default now(),
  seconds int not null default 0,
  ok boolean not null default true,
  results jsonb,
  error text
);
create index cron_runs_job_idx on public.cron_runs(job, started_at desc);
alter table public.cron_runs enable row level security;
create policy cron_runs_admin_select on public.cron_runs for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- The system owner administers it.
update public.profiles set is_admin = true
where id in (select id from auth.users where lower(email) = 'shishiny@gmail.com');
