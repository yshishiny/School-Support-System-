-- A lesson the checks stopped.
--
-- These were being written to `app_errors`, and the consequence showed up on the Admin page within hours of the
-- gate going live: one lesson correctly held produced three red rows — the hold itself, the week-preparation step
-- that counted it, and the cron run that saw the word "error" in its results — plus a note in the parent's inbox.
--
-- A held lesson is not a fault. It is the system working, and it has a proper destination already: the parent's
-- review queue. Dressing it as an error teaches an administrator to ignore red, which is the one thing an error
-- log must never do.
create table if not exists public.held_lessons (
  id          uuid primary key default gen_random_uuid(),
  topic_id    uuid not null references public.topics(id) on delete cascade,
  level       text not null,
  grade       int,
  blocking    text[] not null default '{}',
  results     jsonb,
  created_at  timestamptz not null default now(),
  cleared_at  timestamptz
);

create index if not exists held_lessons_topic_idx on public.held_lessons (topic_id, level, created_at desc);
create index if not exists held_lessons_open_idx on public.held_lessons (created_at desc) where cleared_at is null;

alter table public.held_lessons enable row level security;

drop policy if exists held_lessons_read on public.held_lessons;
create policy held_lessons_read on public.held_lessons for select to authenticated using (true);

-- Carry across anything already recorded as an error, then retire those rows.
insert into public.held_lessons (topic_id, level, grade, blocking, created_at)
select (e.meta->>'topicId')::uuid, coalesce(e.meta->>'level', 'basics'), t.grade,
       array(select jsonb_array_elements_text(e.meta->'blocking')), e.created_at
from public.app_errors e
join public.topics t on t.id = (e.meta->>'topicId')::uuid
where e.area = 'learning.lessonHeld'
  and not exists (select 1 from public.held_lessons h
                  where h.topic_id = (e.meta->>'topicId')::uuid and h.level = coalesce(e.meta->>'level','basics'));

update public.app_errors set resolved_at = now()
where area in ('learning.lessonHeld', 'learning.prepareWeek', 'cron.prepare-plan') and resolved_at is null;
