-- A child photographed his working and was told where it went wrong.
--
-- The photograph is not kept. What is kept is what a parent would actually want and what the app has never had:
-- that he tried, on what, and where he got stuck. Until now the app could tell you he *opened* a lesson and
-- nothing about whether he could do it — the teaching model calls the child the unit of success and had no
-- measure of that unit. This is the first one.
create table if not exists public.working_checks (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.profiles(id) on delete cascade,
  family_id        uuid not null references public.families(id) on delete cascade,
  topic_id         uuid references public.topics(id) on delete set null,
  subject          text,
  problem          text,
  correct          boolean,
  first_wrong_line int,
  what_went_wrong  text,
  created_at       timestamptz not null default now()
);

create index if not exists working_checks_student_idx on public.working_checks (student_id, created_at desc);
create index if not exists working_checks_family_id_fkey_idx on public.working_checks (family_id);
create index if not exists working_checks_topic_id_fkey_idx on public.working_checks (topic_id);

alter table public.working_checks enable row level security;

-- A child sees his own; the rest of the family sees them too, because a parent knowing he is stuck on quadratics
-- is the entire point of recording it.
drop policy if exists working_checks_family on public.working_checks;
create policy working_checks_family on public.working_checks for select to authenticated
  using (family_id = (select family_id from public.profiles where id = (select auth.uid())));
