-- Named places (home, school) to label where a child was, and public web sources the app checks weekly for announcements.
create table public.places (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  student_id uuid references public.profiles(id) on delete cascade,   -- null = whole family (home)
  kind text not null check (kind in ('home', 'school', 'other')),
  label text not null,
  address text,
  latitude double precision not null,
  longitude double precision not null,
  radius_m int not null default 250,
  created_at timestamptz not null default now()
);
create index places_family_idx on public.places(family_id);
alter table public.places enable row level security;
create policy places_family on public.places for all to authenticated
  using (family_id = app_private.current_family_id() and app_private.current_role_is('parent'))
  with check (family_id = app_private.current_family_id() and app_private.current_role_is('parent'));

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  student_id uuid references public.profiles(id) on delete set null,
  label text not null,
  url text not null,
  enabled boolean not null default true,
  last_checked_at timestamptz,
  last_hash text,
  last_error text,
  created_at timestamptz not null default now()
);
alter table public.sources enable row level security;
create policy sources_family on public.sources for all to authenticated
  using (family_id = app_private.current_family_id() and app_private.current_role_is('parent'))
  with check (family_id = app_private.current_family_id() and app_private.current_role_is('parent'));

create table public.source_findings (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  found_at timestamptz not null default now(),
  summary text not null,
  items jsonb not null,             -- ExtractedItem[] awaiting the parent's approval
  status text not null default 'new' check (status in ('new', 'reviewed'))
);
create index source_findings_family_idx on public.source_findings(family_id, found_at desc);
alter table public.source_findings enable row level security;
create policy source_findings_family on public.source_findings for all to authenticated
  using (family_id = app_private.current_family_id() and app_private.current_role_is('parent'))
  with check (family_id = app_private.current_family_id() and app_private.current_role_is('parent'));
