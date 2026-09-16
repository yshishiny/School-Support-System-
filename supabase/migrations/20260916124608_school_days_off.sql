-- Days the school is closed (holidays, strikes, exam breaks). The parent marks them; the home page and plan respect them.
create table public.school_days_off (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  day date not null,
  label text,
  created_at timestamptz not null default now(),
  unique (family_id, day)
);
alter table public.school_days_off enable row level security;
create policy school_days_off_select on public.school_days_off for select to authenticated using (family_id = app_private.current_family_id());
create policy school_days_off_parent_write on public.school_days_off for all to authenticated
  using (family_id = app_private.current_family_id() and app_private.current_role_is('parent'))
  with check (family_id = app_private.current_family_id() and app_private.current_role_is('parent'));
