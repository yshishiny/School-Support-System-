-- What was checked before a child was allowed to read it, and who settled what a model could not.
--
-- A lesson used to be written and stored in one step, with nothing between the model and the child. `checked_at`,
-- `failed_checks` and `review_model` are the record of the discernment pass; a lesson that fails a blocking check
-- is never stored at all, so a row here always means "released", and `failed_checks` on a released lesson is the
-- warning list a parent should see.
alter table public.lessons add column if not exists checked_at    timestamptz;
alter table public.lessons add column if not exists failed_checks text[] not null default '{}';
alter table public.lessons add column if not exists review_model  text;

-- The one job the four dimensions give a person rather than a model: did this match the class? The model can check
-- that a lesson is on its topic, in the right language and worked to its last line. It cannot check what the
-- child's teacher actually covered, and it must never claim to.
alter table public.lessons add column if not exists human_reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.lessons add column if not exists human_reviewed_at timestamptz;
alter table public.lessons add column if not exists human_note        text;

create index if not exists lessons_failed_checks_idx on public.lessons (topic_id)
  where array_length(failed_checks, 1) > 0;
create index if not exists lessons_human_reviewed_by_fkey_idx on public.lessons (human_reviewed_by);
create index if not exists lessons_awaiting_review_idx on public.lessons (created_at desc)
  where human_reviewed_at is null and array_length(failed_checks, 1) > 0;

-- Why a parent sent a lesson back.
--
-- The lesson itself is deleted, because the cache is the only reason it would ever be served again. But deleting it
-- and keeping nothing would have the writer make the same mistake tomorrow, so the reason stays here and is handed
-- to the model the next time that topic is written. It is the one piece of knowledge in the system that only a
-- person who saw the child's class could supply.
create table if not exists public.lesson_rejections (
  id         uuid primary key default gen_random_uuid(),
  topic_id   uuid not null references public.topics(id) on delete cascade,
  level      text not null,
  grade      int,
  reason     text not null,
  family_id  uuid references public.families(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists lesson_rejections_topic_idx on public.lesson_rejections (topic_id, level, created_at desc);
create index if not exists lesson_rejections_family_id_fkey_idx on public.lesson_rejections (family_id);
create index if not exists lesson_rejections_created_by_fkey_idx on public.lesson_rejections (created_by);

alter table public.lesson_rejections enable row level security;

drop policy if exists lesson_rejections_family on public.lesson_rejections;
create policy lesson_rejections_family on public.lesson_rejections for all to authenticated
  using (family_id = (select family_id from public.profiles where id = (select auth.uid())))
  with check (family_id = (select family_id from public.profiles where id = (select auth.uid())));
