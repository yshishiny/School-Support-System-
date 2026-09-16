-- Where the child was when he acted in the app (check-in, prayer), with his phone's permission. Never silent.
create table public.location_pings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null check (source in ('checkin', 'prayer', 'manual')),
  latitude double precision not null,
  longitude double precision not null,
  accuracy_m int,
  created_at timestamptz not null default now()
);
create index location_pings_user_idx on public.location_pings(user_id, created_at desc);
alter table public.location_pings enable row level security;
create policy location_pings_family_select on public.location_pings for select to authenticated
  using (app_private.student_in_family(user_id) or user_id = auth.uid());
