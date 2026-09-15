-- Nightly early-warning snapshots per student: rule-based tier and signal labels (no answers), for trends and the daily report.
create table public.attention_snapshots (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  taken_on date not null,
  score int not null,
  tier text not null check (tier in ('none', 'watch', 'amber', 'red')),
  signals jsonb not null,
  created_at timestamptz not null default now(),
  unique (student_id, taken_on)
);
create index attention_snapshots_student_idx on public.attention_snapshots(student_id, taken_on desc);
alter table public.attention_snapshots enable row level security;
create policy attention_snapshots_parent on public.attention_snapshots for select to authenticated
  using (family_id = app_private.current_family_id() and app_private.current_role_is('parent'));
