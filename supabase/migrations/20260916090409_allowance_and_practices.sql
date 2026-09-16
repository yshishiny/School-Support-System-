-- Weekly allowance earned through basics (KPIs), parent daily ticks, computed weeks, and consequences ("practices").
alter table public.families
  add column allowance_enabled boolean not null default false,
  add column allowance_amount int not null default 250,
  add column allowance_pay_weekday int not null default 4 check (allowance_pay_weekday between 0 and 6), -- 4 = Thursday
  add column allowance_kpis jsonb,          -- overrides of the default KPI list: [{code, weight, enabled}]
  add column practices_enabled text[] not null default '{}';

create table public.kpi_ticks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  tick_date date not null,
  code text not null,
  value boolean not null,                   -- true = done/good, false = not done
  created_at timestamptz not null default now(),
  unique (student_id, tick_date, code)
);
create index kpi_ticks_student_idx on public.kpi_ticks(student_id, tick_date desc);
alter table public.kpi_ticks enable row level security;
create policy kpi_ticks_parent on public.kpi_ticks for all to authenticated
  using (family_id = app_private.current_family_id() and app_private.current_role_is('parent'))
  with check (family_id = app_private.current_family_id() and app_private.current_role_is('parent'));
create policy kpi_ticks_student_read on public.kpi_ticks for select to authenticated using (student_id = auth.uid());

create table public.allowance_weeks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  score int not null,
  band text not null,                       -- full | most | some | none
  amount int not null,
  breakdown jsonb not null,
  computed_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (student_id, week_start)
);
create index allowance_weeks_student_idx on public.allowance_weeks(student_id, week_start desc);
alter table public.allowance_weeks enable row level security;
create policy allowance_weeks_family on public.allowance_weeks for select to authenticated using (app_private.student_in_family(student_id));
create policy allowance_weeks_parent_write on public.allowance_weeks for update to authenticated
  using (family_id = app_private.current_family_id() and app_private.current_role_is('parent'));

create table public.consequences (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  code text not null,
  label text not null,
  reason text,
  starts_on date not null,
  ends_on date not null,
  earn_back_task text,
  student_claimed_at timestamptz,           -- child says the earn-back task is done
  earned_back_at timestamptz,               -- parent confirms; consequence ends early
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
create index consequences_student_idx on public.consequences(student_id, ends_on desc);
alter table public.consequences enable row level security;
create policy consequences_parent on public.consequences for all to authenticated
  using (family_id = app_private.current_family_id() and app_private.current_role_is('parent'))
  with check (family_id = app_private.current_family_id() and app_private.current_role_is('parent'));
create policy consequences_student_read on public.consequences for select to authenticated using (student_id = auth.uid());
create policy consequences_student_claim on public.consequences for update to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());
