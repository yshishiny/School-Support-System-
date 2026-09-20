-- A wallet per child, kept like a real one: money earned sits "with Dad" until he hands it over, a hand-over is a
-- withdrawal on a date, and what the child then spends comes off the cash in his pocket. Two balances, one ledger.
create table if not exists public.wallet_entries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  kind text not null check (kind in ('earn', 'withdraw', 'spend', 'adjust')),
  amount_egp numeric(10, 2) not null check (amount_egp > 0),
  label text not null,
  category text,                                   -- for spend: food | fun | gift | tech | school | save | other
  occurred_on date not null,
  note text,
  ref_type text,                                   -- allowance_week | reward | manual
  ref_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists wallet_entries_student_idx on public.wallet_entries(student_id, occurred_on desc);
create unique index if not exists wallet_entries_ref_idx on public.wallet_entries(student_id, ref_type, ref_id) where ref_id is not null;

alter table public.wallet_entries enable row level security;
create policy wallet_entries_select on public.wallet_entries for select to authenticated
  using (family_id = app_private.current_family_id());
create policy wallet_entries_parent_write on public.wallet_entries for all to authenticated
  using (family_id = app_private.current_family_id() and app_private.current_role_is('parent'))
  with check (family_id = app_private.current_family_id() and app_private.current_role_is('parent'));
-- A child may record what he spent, and nothing else.
create policy wallet_entries_student_spend on public.wallet_entries for insert to authenticated
  with check (family_id = app_private.current_family_id() and student_id = auth.uid() and kind = 'spend');
