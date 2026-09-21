-- Who may administer a family's accounts, and which accounts are switched off.
--
-- "Main parent" had no representation: the code ordered parents by created_at and hoped. Making it a column
-- means it can be read in one place, moved deliberately, and audited when it moves.
alter table public.profiles add column if not exists is_family_owner boolean not null default false;

-- Disabling has to end the session that is already open, not only refuse the next login, so it is a fact on the
-- profile that every request checks — the auth ban alone would leave a signed-in child working for an hour.
alter table public.profiles add column if not exists disabled_at timestamptz;
alter table public.profiles add column if not exists disabled_reason text;

with first_parent as (
  select distinct on (family_id) id from public.profiles
  where role = 'parent' order by family_id, created_at
)
update public.profiles p set is_family_owner = true
from first_parent f where p.id = f.id and p.is_family_owner = false;

create index if not exists profiles_family_owner_idx on public.profiles (family_id) where is_family_owner;

create table if not exists public.account_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.profiles (id) on delete cascade,
  family_id uuid references public.families (id) on delete set null,
  action text not null,
  detail text,
  ok boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists account_audit_subject_idx on public.account_audit (subject_id, created_at desc);
create index if not exists account_audit_family_idx on public.account_audit (family_id, created_at desc);

alter table public.account_audit enable row level security;

drop policy if exists account_audit_read on public.account_audit;
create policy account_audit_read on public.account_audit for select
  using (
    family_id in (select family_id from public.profiles where id = (select auth.uid()) and role = 'parent')
  );
