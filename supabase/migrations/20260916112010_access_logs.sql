-- Who entered the system, from where and on what: one row per login, and one per device per day for visits.
create table public.access_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event text not null check (event in ('login', 'visit')),
  ip text,
  city text,
  region text,
  country text,
  latitude double precision,
  longitude double precision,
  device_type text,          -- phone | tablet | desktop | unknown
  device_os text,
  device_browser text,
  user_agent text,
  path text,
  created_at timestamptz not null default now()
);
create index access_logs_user_idx on public.access_logs(user_id, created_at desc);
alter table public.access_logs enable row level security;
-- Parents see their family's entries; writes come from the server (service role) only.
create policy access_logs_parent_select on public.access_logs for select to authenticated
  using (app_private.student_in_family(user_id) or user_id = auth.uid());
