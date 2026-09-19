-- Who invited whom, whether the newcomer has used their discount, and how many times each family has paid.
alter table public.families add column if not exists invited_by_family_id uuid references public.families(id) on delete set null;
alter table public.families add column if not exists welcome_used boolean not null default false;
create index if not exists families_invited_by_idx on public.families(invited_by_family_id);

-- A purchase made at the welcome price is marked, so the discount is given exactly once.
alter table public.access_grants add column if not exists discounted boolean not null default false;
comment on column public.families.invited_by_family_id is 'The family whose invite code this one used; they earn the bonus and the commission.';
